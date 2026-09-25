<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Domain;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::create(['name' => 'Forno & Afeto', 'slug' => 'forno-afeto', 'status' => 'active']);
        Domain::create(['tenant_id' => $tenant->id, 'host' => 'demo.localhost', 'is_primary' => true, 'verified_at' => now()]);
        app(TenantContext::class)->set($tenant);

        TenantSetting::create([
            'store_name' => 'Forno & Afeto',
            'tagline' => 'Receitas artesanais, feitas para compartilhar.',
            'primary_color' => '#e85d37',
            'accent_color' => '#183c2d',
            'address' => ['street' => 'Rua das Oliveiras', 'number' => '184', 'city' => 'São Paulo', 'state' => 'SP'],
            'business_hours' => ['summary' => 'Hoje, 18h às 23h'],
            'delivery_fee_cents' => 690,
            'minimum_order_cents' => 2500,
            'estimated_delivery_minutes' => 42,
            'pix_key' => 'pedido@fornoeafeto.com.br',
        ]);

        $pizzas = Category::create(['name' => 'Pizzas artesanais', 'slug' => 'pizzas', 'position' => 1]);
        $entradas = Category::create(['name' => 'Para começar', 'slug' => 'entradas', 'position' => 2]);
        $bebidas = Category::create(['name' => 'Bebidas', 'slug' => 'bebidas', 'position' => 3]);

        $margherita = $this->product($pizzas, 'Margherita da casa', 'Molho de tomates assados, fior di latte, manjericão e azeite.', 4890, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85');
        $calabresa = $this->product($pizzas, 'Calabresa defumada', 'Calabresa artesanal, cebola roxa, muçarela e orégano fresco.', 5290, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85');
        $burrata = $this->product($pizzas, 'Burrata & pesto', 'Burrata cremosa, pesto de manjericão, tomate confit e rúcula.', 6490, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85');
        $this->product($entradas, 'Focaccia da casa', 'Massa de longa fermentação, alecrim, flor de sal e azeite.', 2490, 'https://images.unsplash.com/photo-1593280405106-e438ebe93f5b?auto=format&fit=crop&w=900&q=85');
        $this->product($bebidas, 'Limonada siciliana', 'Limão siciliano, água com gás e xarope da casa. 500 ml.', 1490, 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?auto=format&fit=crop&w=900&q=85');

        foreach ([$margherita, $calabresa, $burrata] as $pizza) {
            $pizza->variants()->createMany([
                ['name' => 'Média · 6 fatias', 'price_delta_cents' => 0, 'is_default' => true],
                ['name' => 'Grande · 8 fatias', 'price_delta_cents' => 1200],
            ]);
            $group = $pizza->modifierGroups()->create(['name' => 'Deixe do seu jeito', 'min_choices' => 0, 'max_choices' => 2]);
            $group->options()->createMany([
                ['name' => 'Borda de catupiry', 'price_cents' => 890],
                ['name' => 'Muçarela extra', 'price_cents' => 690],
                ['name' => 'Azeitonas', 'price_cents' => 300],
            ]);
        }

        $user = User::create(['name' => 'Marina', 'email' => 'admin@demo.test', 'password' => Hash::make('password')]);
        DB::table('tenant_users')->insert(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => 'owner', 'created_at' => now(), 'updated_at' => now()]);
        app(TenantContext::class)->clear();
    }

    private function product(Category $category, string $name, string $description, int $price, string $image): Product
    {
        return Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => str($name)->slug(),
            'description' => $description,
            'price_cents' => $price,
            'image_url' => $image,
        ]);
    }
}
