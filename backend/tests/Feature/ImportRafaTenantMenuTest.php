<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\ModifierGroup;
use App\Models\ModifierOption;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImportRafaTenantMenuTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_replaces_the_demo_menu_with_the_complete_rafa_menu(): void
    {
        $this->seed();

        $this->artisan('tenant:import-rafa-menu', [
            'host' => 'demo.localhost',
            '--replace' => true,
        ])->assertSuccessful();

        $this->assertSame(27, Category::query()->count());
        $this->assertSame(150, Product::query()->count());
        $this->assertSame(92, ModifierGroup::query()->count());
        $this->assertSame(1472, ModifierOption::query()->count());

        $this->assertDatabaseHas('products', [
            'name' => '001 · Amanteigada',
            'price_cents' => 400,
        ]);
        $this->assertDatabaseHas('products', [
            'name' => '150 · Leite quente',
            'price_cents' => 300,
        ]);
        $this->assertDatabaseHas('tenant_settings', [
            'store_name' => 'Tapiocaria do Rafa',
        ]);

        $simpleProduct = Product::query()->where('slug', '001-amanteigada')->firstOrFail();
        $productWithExtras = Product::query()->where('slug', '008-carne-do-sol-com-frango')->firstOrFail();

        $this->assertSame(0, $simpleProduct->modifierGroups()->count());
        $this->assertSame(1, $productWithExtras->modifierGroups()->count());
        $this->assertSame(16, $productWithExtras->modifierGroups()->firstOrFail()->options()->count());
    }
}
