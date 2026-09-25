<?php

namespace Tests\Feature;

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
            'minimum_order_cents' => 3000,
            'estimated_delivery_minutes' => 50,
            'accepts_delivery' => true,
            'accepts_pickup' => true,
        ])->assertOk()->assertJsonPath('settings.delivery_fee_cents', 790);

        $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])->getJson('/api/storefront')
            ->assertOk()
            ->assertJsonPath('store.store_name', 'Forno & Afeto Centro')
            ->assertJsonPath('store.logo_url', $logoUrl)
            ->assertJsonPath('store.banner_url', $bannerUrl)
            ->assertJsonFragment(['id' => $product['id'], 'name' => 'Tiramisù']);
    }

    public function test_admin_routes_require_a_valid_tenant_membership(): void
    {
        $this->seed();

        $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])
            ->getJson('/api/admin/menu')
            ->assertUnauthorized();
    }
}
