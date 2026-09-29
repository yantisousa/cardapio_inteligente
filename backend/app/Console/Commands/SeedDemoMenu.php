<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Domain;
use App\Models\Product;
use App\Models\TenantSetting;
use App\Tenancy\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Popula uma loja com um cardápio de teste (categorias, produtos, variações e adicionais).
 * Serve para validar vitrine, carrinho e checkout; troque pelo cardápio real depois.
 */
class SeedDemoMenu extends Command
{
    protected $signature = 'tenant:seed-demo-menu
        {host : Domínio da loja que receberá o cardápio de teste}
        {--replace : Apaga as categorias atuais da loja antes de criar}';

    protected $description = 'Cria um cardápio de teste em uma loja existente';

    public function handle(TenantContext $context): int
    {
        $domain = Domain::withoutGlobalScopes()->with('tenant')->where('host', strtolower($this->argument('host')))->first();

        if (! $domain?->tenant) {
            $this->error('Nenhuma loja encontrada para esse domínio. Rode tenant:create antes.');

            return self::FAILURE;
        }

        $context->set($domain->tenant);

        try {
            $existing = Category::query()->count();
            if ($existing > 0 && ! $this->option('replace')) {
                $this->error("A loja já tem {$existing} categoria(s). Use --replace para substituir.");

                return self::FAILURE;
            }

            DB::transaction(function () use ($existing): void {
                if ($existing > 0) {
                    Category::query()->delete();
                }

                $lanches = Category::create(['name' => 'Lanches', 'slug' => 'lanches', 'position' => 1, 'active' => true]);
                $porcoes = Category::create(['name' => 'Porções', 'slug' => 'porcoes', 'position' => 2, 'active' => true]);
                $bebidas = Category::create(['name' => 'Bebidas', 'slug' => 'bebidas', 'position' => 3, 'active' => true]);
                $sobremesas = Category::create(['name' => 'Sobremesas', 'slug' => 'sobremesas', 'position' => 4, 'active' => true]);

                $burger = $this->product($lanches, 'Hambúrguer da casa', 'Pão brioche, blend 160 g, queijo prato, alface, tomate e molho especial.', 2890, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85');
                $frango = $this->product($lanches, 'Sanduíche de frango crocante', 'Frango empanado, maionese de ervas, picles e alface americana.', 2690, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=85');
                $veggie = $this->product($lanches, 'Burger vegetariano', 'Hambúrguer de grão-de-bico, queijo coalho grelhado e geleia de pimenta.', 2590, 'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=85');

                $this->product($porcoes, 'Batata frita', 'Porção crocante com sal e páprica.', 1890, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85');
                $this->product($porcoes, 'Onion rings', 'Anéis de cebola empanados, servidos com molho barbecue.', 2190, 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=900&q=85');

                $refri = $this->product($bebidas, 'Refrigerante lata', 'Lata 350 ml, gelada.', 690, 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?auto=format&fit=crop&w=900&q=85');
                $this->product($bebidas, 'Suco natural', 'Laranja ou limão, 400 ml.', 1090, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=85');
                $this->product($bebidas, 'Água mineral', 'Sem gás, 500 ml.', 400, 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=85');

                $this->product($sobremesas, 'Brownie com sorvete', 'Brownie de chocolate meio amargo com bola de sorvete de creme.', 1690, 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&w=900&q=85');

                foreach ([$burger, $frango, $veggie] as $lanche) {
                    $lanche->variants()->createMany([
                        ['name' => 'Simples', 'price_delta_cents' => 0, 'is_default' => true],
                        ['name' => 'Duplo', 'price_delta_cents' => 900],
                    ]);
                    $group = $lanche->modifierGroups()->create(['name' => 'Adicionais', 'min_choices' => 0, 'max_choices' => 3]);
                    $group->options()->createMany([
                        ['name' => 'Bacon', 'price_cents' => 500],
                        ['name' => 'Queijo extra', 'price_cents' => 400],
                        ['name' => 'Ovo', 'price_cents' => 300],
                    ]);
                }

                $refri->variants()->createMany([
                    ['name' => 'Cola', 'price_delta_cents' => 0, 'is_default' => true],
                    ['name' => 'Guaraná', 'price_delta_cents' => 0],
                    ['name' => 'Laranja', 'price_delta_cents' => 0],
                ]);

                TenantSetting::query()->firstOrFail()->update([
                    'tagline' => 'Cardápio de teste para validar pedidos.',
                    'delivery_fee_cents' => 500,
                    'minimum_order_cents' => 1500,
                    'estimated_delivery_minutes' => 40,
                    'business_hours' => ['summary' => 'Todos os dias, 11h às 23h'],
                ]);
            });

            $this->info('Cardápio de teste criado: 4 categorias, 9 produtos, com variações e adicionais.');

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        } finally {
            $context->clear();
        }
    }

    private function product(Category $category, string $name, string $description, int $priceCents, string $image): Product
    {
        return Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => $description,
            'price_cents' => $priceCents,
            'image_url' => $image,
            'active' => true,
        ]);
    }
}
