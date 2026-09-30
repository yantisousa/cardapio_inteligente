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
                            'image_url' => $this->image($name),
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

    /** Foto (Unsplash) por título do produto; sem entrada, o produto fica sem imagem. */
    private function image(string $name): ?string
    {
        $ids = [
            'Picanha' => '1767974968707-db3d448d4ef3',
            'Carne (fraldinha)' => '1779474989201-fe2d22ff3f79',
            'Cupim' => '1775263895193-00169142a6d5',
            'Frango' => '1775379995350-43098b52d8ed',
            'Porco' => '1735279944608-5f0f05334904',
            'Tripa' => '1598401863352-3de5501f4890',
            'Coração de frango' => '1779358964755-75464e144187',
            'Coração de boi' => '1626323109252-0adb3b46692b',
            'Linguiça' => '1591989330748-777649e84466',
            'Asa de frango' => '1783788357923-649e29b7b006',
            'Queijo' => '1695754146526-5bab379f597a',
            'Medalhão de carne' => '1654876203651-64761cbcc5cc',
            'Medalhão de frango' => '1757961047502-0c0351ae7a48',
            'Medalhão de queijo' => '1695754146526-5bab379f597a',
            'Medalhão de ovo de codorna' => '1775263895193-00169142a6d5',
            'Kafta com queijo' => '1779883804052-7250ffc9d276',
            'Espeto especial de camarão e queijo' => '1788603970138-4edbdaf80cc4',
            'Espeto de camarão' => '1569172131007-4954763443d2',
            'Batata frita (300 g)' => '1630431341636-999a7e047f3b',
            'Bolinho (12 unidades)' => '1767974963436-2208b3553561',
            'Pastelo (12 unidades)' => '1781446842582-0c30c427cd66',
            'Pão de alho' => '1556008531-57e6eefc7be4',
            'Caldinho de camarão' => '1659603606213-cb19636f9f34',
            'Caldinho de feijão preto' => '1665088127661-83aeff6104c4',
            'Arroz de leite' => '1536304993881-ff6e9eefa2a6',
            'Arroz de camarão' => '1512058564366-18510be2db19',
            'Arroz P' => '1536304993881-ff6e9eefa2a6',
            'Arroz G' => '1536304993881-ff6e9eefa2a6',
            'Baião P' => '1626266799523-941311ea2273',
            'Baião G' => '1626266799523-941311ea2273',
            'Feijão verde Mini' => '1564707919-233dd0c17c56',
            'Feijão verde P' => '1564707919-233dd0c17c56',
            'Feijão verde G' => '1564707919-233dd0c17c56',
            'Feijão verde especial' => '1564707919-233dd0c17c56',
            'Caranguejo combo com 3' => '1580841129862-bc2a2d113c45',
            'Caldo de caranguejo' => '1659603606213-cb19636f9f34',
        ];

        return isset($ids[$name])
            ? "https://images.unsplash.com/photo-{$ids[$name]}?auto=format&fit=crop&w=900&q=85"
            : null;
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
