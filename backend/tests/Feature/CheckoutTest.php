<?php

namespace Tests\Feature;

use App\Jobs\OrderPlaced;
use App\Models\Category;
use App\Models\Domain;
use App\Models\Order;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Tenancy\TenantContext;
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
            'customer' => ['name' => 'Ana', 'phone' => '11999999999'],
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

    private function makeStore(string $host, int $price): array
    {
        $tenant = Tenant::create(['name' => $host, 'slug' => str($host)->slug(), 'status' => 'active']);
        Domain::create(['tenant_id' => $tenant->id, 'host' => $host, 'verified_at' => now()]);
        app(TenantContext::class)->set($tenant);
        TenantSetting::create(['store_name' => $host, 'delivery_fee_cents' => 690]);
        $category = Category::create(['name' => 'Pizzas', 'slug' => 'pizzas']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Margherita', 'slug' => 'margherita', 'price_cents' => $price]);
        app(TenantContext::class)->clear();

        return [$tenant, $product];
    }
}
