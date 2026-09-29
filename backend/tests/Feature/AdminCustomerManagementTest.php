<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCustomerManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_search_view_update_a_customer_and_remove_an_address(): void
    {
        $this->seed();
        $product = Product::query()->firstOrFail();

        $order = $this->withHeaders([
            'X-Tenant-Host' => 'demo.localhost',
            'Idempotency-Key' => 'customer-management-001',
        ])->postJson('/api/orders', [
            'customer' => ['name' => 'Ana Cliente', 'phone' => '(11) 98888-7777', 'email' => 'ana@example.com'],
            'fulfillment_type' => 'delivery',
            'payment_method' => 'cash',
            'delivery_address' => [
                'label' => 'Casa',
                'street' => 'Rua da Cliente',
                'number' => '25',
                'neighborhood' => 'Centro',
                'city' => 'São Paulo',
                'state' => 'SP',
                'postal_code' => '01000-000',
            ],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');

        $token = $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])
            ->postJson('/api/admin/login', [
                'email' => 'admin@demo.test',
                'password' => 'password',
            ])->assertOk()->json('token');

        $headers = [
            'X-Tenant-Host' => 'demo.localhost',
            'Authorization' => 'Bearer '.$token,
        ];

        $customer = $this->withHeaders($headers)
            ->getJson('/api/admin/customers?search=Ana')
            ->assertOk()
            ->assertJsonCount(1, 'customers')
            ->assertJsonPath('customers.0.orders_count', 1)
            ->assertJsonPath('customers.0.orders_sum_total_cents', $order['total_cents'])
            ->json('customers.0');

        $detail = $this->withHeaders($headers)
            ->getJson("/api/admin/customers/{$customer['id']}")
            ->assertOk()
            ->assertJsonPath('customer.addresses.0.label', 'Casa')
            ->assertJsonPath('customer.orders.0.id', $order['id'])
            ->json('customer');

        $this->withHeaders($headers)
            ->patchJson("/api/admin/customers/{$customer['id']}", [
                'name' => 'Ana Atualizada',
                'phone' => '(11) 97777-6666',
                'email' => 'nova@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('customer.name', 'Ana Atualizada')
            ->assertJsonPath('customer.phone', '11977776666');

        $this->withHeaders($headers)
            ->deleteJson("/api/admin/customers/{$customer['id']}/addresses/{$detail['addresses'][0]['id']}")
            ->assertNoContent();

        $this->assertDatabaseMissing('customer_addresses', ['id' => $detail['addresses'][0]['id']]);
    }
}
