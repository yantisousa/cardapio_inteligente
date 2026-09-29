<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\TenantSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_manage_menu_and_store_settings(): void
    {
        Storage::fake('public');
        $this->seed();

        $login = $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])->postJson('/api/admin/login', [
            'email' => 'admin@demo.test',
            'password' => 'password',
        ])->assertOk();

        $headers = [
            'X-Tenant-Host' => 'demo.localhost',
            'Authorization' => 'Bearer '.$login->json('token'),
        ];

        $category = $this->withHeaders($headers)->postJson('/api/admin/categories', [
            'name' => 'Sobremesas',
        ])->assertCreated()->json('category');

        $product = $this->withHeaders($headers)->postJson('/api/admin/products', [
            'category_id' => $category['id'],
            'name' => 'Tiramisù',
            'description' => 'Receita da casa',
            'image_url' => 'https://example.com/tiramisu.jpg',
            'price_cents' => 2790,
            'active' => true,
            'variants' => [
                ['name' => 'Individual', 'price_delta_cents' => 0, 'is_default' => true],
            ],
            'modifier_groups' => [
                [
                    'name' => 'Finalização', 'min_choices' => 0, 'max_choices' => 1,
                    'options' => [['name' => 'Cacau extra', 'price_cents' => 200]],
                ],
            ],
        ])->assertCreated()->assertJsonPath('product.price_cents', 2790)->json('product');

        $this->withHeaders($headers)->getJson('/api/admin/menu')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Tiramisù']);

        $this->withHeaders($headers)->patchJson("/api/admin/products/{$product['id']}/availability", [
            'is_sold_out' => true,
        ])->assertOk()->assertJsonPath('product.is_sold_out', true);

        $this->withHeaders($headers)->patchJson('/api/admin/store/operational-status', [
            'is_paused' => true,
            'pause_message' => 'Pausa para organização.',
        ])->assertOk()->assertJsonPath('settings.is_paused', true);

        $this->withHeaders($headers)->patchJson('/api/admin/store/operational-status', [
            'is_paused' => false,
        ])->assertOk()->assertJsonPath('settings.is_paused', false);

        $upload = $this->withHeaders($headers)->post('/api/admin/settings/assets', [
            'kind' => 'logo',
            'image' => UploadedFile::fake()->image('logo.png', 512, 512)->size(250),
        ])->assertCreated()->assertJsonPath('kind', 'logo');

        $logoUrl = $upload->json('url');
        $logoPath = str_replace('/api/media/', 'tenants/', $logoUrl);
        $logoPath = preg_replace('#^tenants/([^/]+)/#', 'tenants/$1/branding/', $logoPath);
        Storage::disk('public')->assertExists($logoPath);
        $this->get($logoUrl)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');

        $bannerUrl = $this->withHeaders($headers)->post('/api/admin/settings/assets', [
            'kind' => 'banner',
            'image' => UploadedFile::fake()->image('banner.jpg', 1600, 600)->size(500),
        ])->assertCreated()->assertJsonPath('kind', 'banner')->json('url');

        $this->withHeaders($headers)->putJson('/api/admin/settings', [
            'store_name' => 'Forno & Afeto Centro',
            'logo_url' => $logoUrl,
            'banner_url' => $bannerUrl,
            'primary_color' => '#d9482b',
            'accent_color' => '#173c2b',
            'delivery_fee_cents' => 790,
            'delivery_zones' => [
                ['neighborhood' => 'Centro', 'city' => 'Fortaleza', 'state' => 'CE', 'fee_cents' => 500, 'active' => true],
            ],
            'minimum_order_cents' => 3000,
            'estimated_delivery_minutes' => 50,
            'enforce_business_hours' => true,
            'outside_hours_mode' => 'schedule',
            'business_hours' => [
                'summary' => 'Segunda, 18h às 23h',
                'timezone' => 'America/Sao_Paulo',
                'schedule' => ['monday' => [['open' => '18:00', 'close' => '23:00']]],
            ],
            'pix_key' => '85996479539',
            'storefront_content' => [
                'hero_badge' => 'Aberto agora',
                'hero_title' => 'Sabores do centro',
                'hero_highlight' => 'para você.',
                'story_text' => 'Nossa história pertence a esta unidade.',
            ],
            'accepts_delivery' => true,
            'accepts_pickup' => true,
        ])->assertOk()
            ->assertJsonPath('settings.delivery_fee_cents', 790)
            ->assertJsonPath('settings.delivery_zones.0.neighborhood', 'Centro')
            ->assertJsonPath('settings.delivery_zones.0.fee_cents', 500);

        $this->withHeaders($headers)->putJson('/api/admin/settings', [
            'accepts_delivery' => false,
            'accepts_pickup' => false,
        ])->assertUnprocessable()->assertJsonValidationErrors('accepts_delivery');

        $this->withHeaders($headers)->getJson('/api/admin/settings')
            ->assertOk()
            ->assertJsonPath('settings.pix_key', '+5585996479539');

        $this->assertDatabaseHas('tenants', ['name' => 'Forno & Afeto Centro']);

        $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])->getJson('/api/storefront')
            ->assertOk()
            ->assertJsonPath('store.store_name', 'Forno & Afeto Centro')
            ->assertJsonPath('store.logo_url', $logoUrl)
            ->assertJsonPath('store.banner_url', $bannerUrl)
            ->assertJsonPath('store.storefront_content.hero_title', 'Sabores do centro')
            ->assertJsonPath('tenant.name', 'Forno & Afeto Centro')
            ->assertJsonFragment(['id' => $product['id'], 'name' => 'Tiramisù']);
    }

    public function test_admin_routes_require_a_valid_tenant_membership(): void
    {
        $this->seed();

        $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])
            ->getJson('/api/admin/menu')
            ->assertUnauthorized();
    }

    public function test_owner_can_set_any_valid_order_status_manually(): void
    {
        $this->seed();
        $product = Product::query()->firstOrFail();

        $order = $this->withHeaders([
            'X-Tenant-Host' => 'demo.localhost',
            'Idempotency-Key' => 'manual-status-001',
        ])->postJson('/api/orders', [
            'customer' => ['name' => 'Cliente', 'phone' => '11988887777'],
            'fulfillment_type' => 'pickup',
            'payment_method' => 'cash',
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

        $this->withHeaders($headers)
            ->getJson("/api/admin/orders/{$order['id']}")
            ->assertOk()
            ->assertJsonPath('order.customer_snapshot.name', 'Cliente')
            ->assertJsonPath('order.items.0.product_id', $product->id)
            ->assertJsonPath('order.payments.0.method', 'cash')
            ->assertJsonPath('order.events.0.type', 'created');

        $this->withHeaders($headers)
            ->patchJson("/api/admin/orders/{$order['id']}", ['status' => 'ready'])
            ->assertOk()
            ->assertJsonPath('order.status', 'ready');

        $this->withHeaders($headers)
            ->patchJson("/api/admin/orders/{$order['id']}", ['status' => 'pending'])
            ->assertOk()
            ->assertJsonPath('order.status', 'pending');

        $this->withHeaders($headers)
            ->patchJson("/api/admin/orders/{$order['id']}", ['status' => 'invented'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseHas('order_events', [
            'order_id' => $order['id'],
            'from_status' => 'pending',
            'to_status' => 'ready',
        ]);
        $this->assertDatabaseHas('order_events', [
            'order_id' => $order['id'],
            'from_status' => 'ready',
            'to_status' => 'pending',
        ]);
    }

    public function test_pix_payment_must_be_confirmed_before_preparation(): void
    {
        $this->seed();
        TenantSetting::query()->firstOrFail()->update(['pix_key' => '+5511999998888']);
        $product = Product::query()->firstOrFail();

        $order = $this->withHeaders([
            'X-Tenant-Host' => 'demo.localhost',
            'Idempotency-Key' => 'pix-confirmation-001',
        ])->postJson('/api/orders', [
            'customer' => ['name' => 'Cliente Pix', 'phone' => '11999998888'],
            'fulfillment_type' => 'pickup',
            'payment_method' => 'pix',
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

        $this->withHeaders($headers)
            ->patchJson("/api/admin/orders/{$order['id']}", ['status' => 'preparing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->withHeaders($headers)
            ->patchJson("/api/admin/orders/{$order['id']}/payment", ['status' => 'paid'])
            ->assertOk()
            ->assertJsonPath('order.payment_status', 'paid')
            ->assertJsonPath('order.payments.0.status', 'paid');

        $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])
            ->getJson("/api/orders/{$order['public_id']}")
            ->assertOk()
            ->assertJsonPath('order.payment_status', 'paid');

        $this->withHeaders($headers)
            ->patchJson("/api/admin/orders/{$order['id']}", ['status' => 'preparing'])
            ->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        $this->assertDatabaseHas('order_events', [
            'order_id' => $order['id'],
            'type' => 'payment_status_changed',
            'from_status' => 'pending',
            'to_status' => 'paid',
        ]);
    }
}
