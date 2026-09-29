<?php

namespace Tests\Feature;

use App\Jobs\OrderPlaced;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Domain;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_recalculates_prices_snapshots_items_and_is_idempotent(): void
    {
        Queue::fake();
        [$tenant, $product] = $this->makeStore('pizza.test', 4890);

        $payload = [
            'customer' => ['name' => 'Ana', 'phone' => '(11) 99999-9999'],
            'fulfillment_type' => 'delivery',
            'payment_method' => 'pix',
            'delivery_address' => [
                'street' => 'Rua A', 'number' => '10', 'neighborhood' => 'Centro',
                'city' => 'São Paulo', 'state' => 'SP', 'postal_code' => '01000-000',
            ],
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ];

        $headers = ['X-Tenant-Host' => 'pizza.test', 'Idempotency-Key' => 'checkout-ana-001'];
        $first = $this->withHeaders($headers)->postJson('/api/orders', $payload);
        $first->assertCreated()->assertJsonPath('order.total_cents', 10470)->assertJsonPath('replayed', false);

        $this->withHeaders($headers)->postJson('/api/orders', $payload)
            ->assertOk()->assertJsonPath('replayed', true)->assertJsonPath('order.id', $first->json('order.id'));

        $this->assertSame(1, Order::withoutGlobalScopes()->where('tenant_id', $tenant->id)->count());
        $this->assertDatabaseHas('order_items', [
            'order_id' => $first->json('order.id'), 'product_name' => 'Margherita',
            'unit_price_cents' => 4890, 'quantity' => 2, 'total_cents' => 9780,
        ]);
        $this->assertDatabaseHas('customers', ['tenant_id' => $tenant->id, 'phone' => '11999999999']);
        $this->assertDatabaseHas('customer_addresses', [
            'tenant_id' => $tenant->id,
            'street' => 'Rua A',
            'number' => '10',
            'postal_code' => '01000000',
        ]);

        $this->withHeaders(['X-Tenant-Host' => 'pizza.test'])
            ->getJson('/api/customers/addresses?phone=11999999999')
            ->assertOk()
            ->assertJsonPath('customer.name', 'Ana')
            ->assertJsonPath('addresses.0.street', 'Rua A');
        Queue::assertPushed(OrderPlaced::class, 1);
    }

    public function test_a_tenant_cannot_order_a_product_from_another_tenant(): void
    {
        $this->makeStore('first.test', 3000);
        [, $foreignProduct] = $this->makeStore('second.test', 4000);

        $this->withHeaders(['X-Tenant-Host' => 'first.test', 'Idempotency-Key' => 'cross-tenant-001'])
            ->postJson('/api/orders', [
                'customer' => ['name' => 'Teste', 'phone' => '11911111111'],
                'fulfillment_type' => 'pickup',
                'payment_method' => 'cash',
                'items' => [['product_id' => $foreignProduct->id, 'quantity' => 1]],
            ])
            ->assertUnprocessable();
    }

    public function test_pix_requires_a_key_configured_for_the_store(): void
    {
        [$tenant, $product] = $this->makeStore('without-pix.test', 3000);

        app(TenantContext::class)->set($tenant);
        TenantSetting::query()->update(['pix_key' => null]);
        app(TenantContext::class)->clear();

        $this->withHeaders(['X-Tenant-Host' => 'without-pix.test', 'Idempotency-Key' => 'missing-pix-001'])
            ->postJson('/api/orders', [
                'customer' => ['name' => 'Teste', 'phone' => '11911111111'],
                'fulfillment_type' => 'pickup',
                'payment_method' => 'pix',
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_method');
    }

    public function test_customer_addresses_do_not_leak_between_tenants(): void
    {
        [$firstTenant] = $this->makeStore('addresses-first.test', 3000);

        app(TenantContext::class)->set($firstTenant);
        $customer = Customer::create(['name' => 'Cliente', 'phone' => '11988887777']);
        CustomerAddress::create([
            'customer_id' => $customer->id,
            'label' => 'Casa',
            'street' => 'Rua Privada',
            'number' => '25',
            'neighborhood' => 'Centro',
            'city' => 'São Paulo',
            'state' => 'SP',
            'postal_code' => '01000000',
        ]);
        app(TenantContext::class)->clear();

        $this->makeStore('addresses-second.test', 3000);

        $this->withHeaders(['X-Tenant-Host' => 'addresses-second.test'])
            ->getJson('/api/customers/addresses?phone=11988887777')
            ->assertOk()
            ->assertJsonPath('customer', null)
            ->assertJsonCount(0, 'addresses');
    }

    public function test_delivery_zone_sets_the_fee_and_rejects_addresses_outside_the_service_area(): void
    {
        [$tenant, $product] = $this->makeStore('zones.test', 3000);

        app(TenantContext::class)->set($tenant);
        TenantSetting::query()->firstOrFail()->update([
            'delivery_zones' => [
                ['neighborhood' => 'Centro', 'city' => 'São Paulo', 'state' => 'SP', 'fee_cents' => 450, 'active' => true],
                ['neighborhood' => 'Jardins', 'city' => 'São Paulo', 'state' => 'SP', 'fee_cents' => 850, 'active' => true],
            ],
        ]);
        app(TenantContext::class)->clear();

        $payload = [
            'customer' => ['name' => 'Cliente', 'phone' => '11977776666'],
            'fulfillment_type' => 'delivery',
            'payment_method' => 'cash',
            'delivery_address' => [
                'street' => 'Rua A', 'number' => '10', 'neighborhood' => 'CENTRO',
                'city' => 'Sao Paulo', 'state' => 'sp', 'postal_code' => '01000-000',
            ],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ];

        $this->withHeaders(['X-Tenant-Host' => 'zones.test', 'Idempotency-Key' => 'zone-covered-001'])
            ->postJson('/api/orders', $payload)
            ->assertCreated()
            ->assertJsonPath('order.delivery_fee_cents', 450)
            ->assertJsonPath('order.total_cents', 3450);

        $payload['delivery_address']['neighborhood'] = 'Bairro distante';
        $this->withHeaders(['X-Tenant-Host' => 'zones.test', 'Idempotency-Key' => 'zone-outside-001'])
            ->postJson('/api/orders', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('delivery_address.neighborhood');
    }

    public function test_operational_controls_schedule_orders_and_block_paused_or_sold_out_orders(): void
    {
        [$tenant, $product] = $this->makeStore('operation.test', 3000);
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-28 10:00:00', 'America/Sao_Paulo'));

        app(TenantContext::class)->set($tenant);
        TenantSetting::query()->firstOrFail()->update([
            'enforce_business_hours' => true,
            'outside_hours_mode' => 'schedule',
            'business_hours' => [
                'timezone' => 'America/Sao_Paulo',
                'schedule' => ['monday' => [['open' => '18:00', 'close' => '23:00']]],
            ],
        ]);
        app(TenantContext::class)->clear();

        $payload = [
            'customer' => ['name' => 'Cliente', 'phone' => '11966665555'],
            'fulfillment_type' => 'pickup',
            'payment_method' => 'cash',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ];

        $order = $this->withHeaders(['X-Tenant-Host' => 'operation.test', 'Idempotency-Key' => 'scheduled-order-001'])
            ->postJson('/api/orders', $payload)
            ->assertCreated()
            ->assertJsonPath('order.status', 'pending');
        $this->assertNotNull($order->json('order.scheduled_for'));

        app(TenantContext::class)->set($tenant);
        TenantSetting::query()->firstOrFail()->update(['is_paused' => true, 'pause_message' => 'Voltamos logo.']);
        app(TenantContext::class)->clear();
        $this->withHeaders(['X-Tenant-Host' => 'operation.test', 'Idempotency-Key' => 'paused-order-001'])
            ->postJson('/api/orders', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store');

        app(TenantContext::class)->set($tenant);
        TenantSetting::query()->firstOrFail()->update(['is_paused' => false, 'enforce_business_hours' => false]);
        Product::query()->whereKey($product->id)->update(['is_sold_out' => true]);
        app(TenantContext::class)->clear();
        $this->withHeaders(['X-Tenant-Host' => 'operation.test', 'Idempotency-Key' => 'sold-out-order-001'])
            ->postJson('/api/orders', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        CarbonImmutable::setTestNow();
    }

    private function makeStore(string $host, int $price): array
    {
        $basicPlan = Plan::query()->where('slug', 'basic')->firstOrFail();
        $tenant = Tenant::create(['plan_id' => $basicPlan->id, 'name' => $host, 'slug' => str($host)->slug(), 'status' => 'active']);
        Domain::create(['tenant_id' => $tenant->id, 'host' => $host, 'verified_at' => now()]);
        app(TenantContext::class)->set($tenant);
        TenantSetting::create(['store_name' => $host, 'delivery_fee_cents' => 690, 'pix_key' => 'pix@teste.local']);
        $category = Category::create(['name' => 'Pizzas', 'slug' => 'pizzas']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Margherita', 'slug' => 'margherita', 'price_cents' => $price]);
        app(TenantContext::class)->clear();

        return [$tenant, $product];
    }
}
