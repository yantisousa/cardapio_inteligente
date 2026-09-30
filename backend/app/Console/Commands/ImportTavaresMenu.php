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
 * Cardápio do Tavares Spettus (transcrito da foto do cardápio impresso).
 * Preços em centavos. Itens marcados com "// ?" tinham leitura duvidosa na foto.
 */
class ImportTavaresMenu extends Command
{
    protected $signature = 'tenant:import-tavares-menu
        {host=tavares-spettus.triunfomenu.com.br : Domínio da loja}
        {--replace : Apaga as categorias atuais da loja antes de importar}';

    protected $description = 'Importa o cardápio do Tavares Spettus para a loja';

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

            $count = 0;

            DB::transaction(function () use ($existing, &$count): void {
                if ($existing > 0) {
                    Category::query()->delete();
                }

                foreach ($this->menu() as $position => $section) {
                    $category = Category::create([
                        'name' => $section['name'],
                        'slug' => Str::slug($section['name']),
                        'position' => $position + 1,
                        'active' => true,
                    ]);

                    foreach ($section['items'] as [$name, $price, $description]) {
                        $product = Product::create([
                            'category_id' => $category->id,
                            'name' => $name,
                            'slug' => Str::slug($name),
                            'description' => $description,
                            'price_cents' => $price,
                            'active' => true,
                        ]);
                        $count++;

                        if ($section['skewer'] ?? false) {
                            $sides = $product->modifierGroups()->create(['name' => 'Acompanha farofa e...', 'min_choices' => 1, 'max_choices' => 1]);
                            $sides->options()->createMany([
                                ['name' => 'Vinagrete', 'price_cents' => 0],
                                ['name' => 'Molho da casa', 'price_cents' => 0],
                            ]);

                            $extras = $product->modifierGroups()->create(['name' => 'Acompanhamentos extras', 'min_choices' => 0, 'max_choices' => 2]);
                            $extras->options()->createMany([
                                ['name' => 'Barbecue', 'price_cents' => 400],
                                ['name' => 'Melaço', 'price_cents' => 400],
                            ]);
                        }
                    }
                }

                TenantSetting::query()->firstOrFail()->update([
                    'tagline' => 'Espetos, porções e caranguejada às quintas. Cobramos 10% de serviço.',
                ]);
            });

            $this->info("Cardápio do Tavares Spettus importado: {$count} produtos.");

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        } finally {
            $context->clear();
        }
    }

    /** @return array<int, array{name: string, skewer?: bool, items: array<int, array{0: string, 1: int, 2: ?string}>}> */
    private function menu(): array
    {
        return [
            ['name' => 'Espetos Tradicionais', 'skewer' => true, 'items' => [
                ['Picanha', 1590, null],
                ['Carne (fraldinha)', 1090, null],
                ['Cupim', 1090, null],
                ['Frango', 990, null],
                ['Porco', 990, null],
                ['Tripa', 1090, null],
                ['Coração de frango', 990, null],
                ['Coração de boi', 990, null], // ?
                ['Linguiça', 1090, null],
                ['Asa de frango', 1090, null],
                ['Queijo', 990, null],
            ]],
            ['name' => 'Espetos Especiais', 'skewer' => true, 'items' => [
                ['Medalhão de carne', 1090, 'Bacon enrolado na carne fraldinha.'],
                ['Medalhão de frango', 1090, 'Bacon enrolado no frango.'],
                ['Medalhão de queijo', 1090, 'Bacon enrolado no queijo.'],
                ['Medalhão de ovo de codorna', 1090, 'Bacon enrolado no ovo de codorna.'],
                ['Kafta com queijo', 990, null],
            ]],
            ['name' => 'Espetos de Camarão', 'skewer' => true, 'items' => [
                ['Espeto especial de camarão e queijo', 1890, null],
                ['Espeto de camarão', 1690, null],
            ]],
            ['name' => 'Entradas', 'items' => [
                ['Batata frita (300 g)', 2499, 'Porção de 300 g.'],
                ['Bolinho (12 unidades)', 2299, 'Queijo e carne do sol.'],
                ['Pastelo (12 unidades)', 2699, 'Queijo, carne do sol com queijo e camarão.'],
                ['Pão de alho', 700, null],
                ['Farofa de ovos', 1690, null],
            ]],
            ['name' => 'Caldinhos', 'items' => [
                ['Caldinho de camarão', 1199, null],
                ['Caldinho de feijão preto', 1199, null],
            ]],
            ['name' => 'Guarnições', 'items' => [
                ['Arroz de leite', 2090, null],
                ['Arroz de camarão', 3290, null],
                ['Arroz P', 900, null],
                ['Arroz G', 1590, null],
                ['Baião P', 1190, null],
                ['Baião G', 1990, null],
            ]],
            ['name' => 'Feijão Verde', 'items' => [
                ['Feijão verde Mini', 800, null],
                ['Feijão verde P', 1590, null],
                ['Feijão verde G', 2990, null],
                ['Feijão verde especial', 3890, 'Com carne do sol e ovos de codorna.'], // ?
            ]],
            ['name' => 'Caranguejada (todas as quintas)', 'items' => [
                ['Caranguejo combo com 3', 2800, 'Disponível todas as quintas.'],
                ['Caldo de caranguejo', 699, 'Disponível todas as quintas.'],
            ]],
        ];
    }
}
