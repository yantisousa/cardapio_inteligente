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
use RuntimeException;
use Throwable;

class ImportRafaTenantMenu extends Command
{
    protected $signature = 'tenant:import-rafa-menu
        {host=demo.localhost : Domínio do tenant que receberá o cardápio}
        {--replace : Substitui o cardápio atual do tenant}';

    protected $description = 'Importa o cardápio e os horários da Tapiocaria do Rafa para um tenant';

    public function handle(TenantContext $tenantContext): int
    {
        $domain = Domain::query()->with('tenant')->where('host', $this->argument('host'))->first();

        if (! $domain) {
            $this->error('Tenant não encontrado para o domínio informado.');

            return self::FAILURE;
        }

        $tenant = $domain->tenant;
        $tenantContext->set($tenant);

        try {
            $this->validateMenu();

            $existingCategories = Category::query()->count();

            if ($existingCategories > 0 && ! $this->option('replace')) {
                $this->error("O tenant já possui {$existingCategories} categoria(s). Use --replace para substituir o cardápio.");

                return self::FAILURE;
            }

            DB::transaction(function () use ($tenant, $existingCategories): void {
                if ($existingCategories > 0) {
                    Category::query()->delete();
                }

                $productCount = 0;
                $modifierGroupCount = 0;

                foreach ($this->menu() as $position => $section) {
                    $category = Category::query()->create([
                        'name' => $section['name'],
                        'slug' => 'rafa-'.Str::slug($section['name']),
                        'position' => $position + 1,
                        'active' => true,
                    ]);

                    foreach ($section['items'] as $item) {
                        $product = Product::query()->create([
                            'category_id' => $category->id,
                            'name' => sprintf('%03d · %s', $item[0], $item[1]),
                            'slug' => sprintf('%03d-%s', $item[0], Str::slug($item[1])),
                            'description' => $this->description($item),
                            'price_cents' => $item[2],
                            'active' => true,
                        ]);

                        $productCount++;

                        if ($section['extras']) {
                            $this->addExtras($product);
                            $modifierGroupCount++;
                        }
                    }
                }

                $settings = TenantSetting::query()->firstOrFail();
                $settings->update([
                    'store_name' => 'Tapiocaria do Rafa',
                    'tagline' => 'Tapiocas, cuscuz, crepiocas, sanduíches e bebidas.',
                    'primary_color' => '#b52a20',
                    'accent_color' => '#6f1f1a',
                    'business_hours' => [
                        'summary' => 'Terça a sábado, 07:00–10:30 e 14:00–17:30 · Domingo, 07:00–10:40',
                        'monday' => ['closed' => true],
                        'tuesday' => [['opens' => '07:00', 'closes' => '10:30'], ['opens' => '14:00', 'closes' => '17:30']],
                        'wednesday' => [['opens' => '07:00', 'closes' => '10:30'], ['opens' => '14:00', 'closes' => '17:30']],
                        'thursday' => [['opens' => '07:00', 'closes' => '10:30'], ['opens' => '14:00', 'closes' => '17:30']],
                        'friday' => [['opens' => '07:00', 'closes' => '10:30'], ['opens' => '14:00', 'closes' => '17:30']],
                        'saturday' => [['opens' => '07:00', 'closes' => '10:30'], ['opens' => '14:00', 'closes' => '17:30']],
                        'sunday' => [['opens' => '07:00', 'closes' => '10:40']],
                    ],
                    'storefront_content' => array_merge($settings->storefront_content ?? [], [
                        'hero_badge' => 'Cardápio completo',
                        'hero_title' => 'Seu pedido feito com',
                        'hero_highlight' => 'sabor.',
                        'hero_note' => 'feito na hora ↗',
                        'menu_title' => 'Escolha o seu pedido',
                        'story_eyebrow' => 'Tapiocaria do Rafa',
                        'story_title' => 'Do café da manhã ao lanche da tarde.',
                        'story_text' => 'Tapiocas, cuscuz, crepiocas, sanduíches e bebidas preparados para deixar o seu dia mais gostoso.',
                        'story_since' => '',
                    ]),
                ]);

                $tenant->update(['name' => 'Tapiocaria do Rafa']);

                $this->info("Importados {$productCount} produtos em 27 categorias, com {$modifierGroupCount} grupos de adicionais.");
            });
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        } finally {
            $tenantContext->clear();
        }

        return self::SUCCESS;
    }

    private function description(array $item): string
    {
        $description = sprintf('Código %03d.', $item[0]);

        return isset($item[3]) ? $description.' '.$item[3] : $description;
    }

    private function addExtras(Product $product): void
    {
        $group = $product->modifierGroups()->create([
            'name' => 'Adicionais',
            'min_choices' => 0,
            'max_choices' => count($this->extras()),
            'position' => 1,
        ]);

        $group->options()->createMany(array_map(
            fn (array $extra): array => ['name' => $extra[0], 'price_cents' => $extra[1], 'active' => true],
            $this->extras(),
        ));
    }

    private function validateMenu(): void
    {
        $codes = [];

        foreach ($this->menu() as $section) {
            foreach ($section['items'] as $item) {
                $codes[] = $item[0];
            }
        }

        sort($codes);

        if ($codes !== range(1, 150)) {
            throw new RuntimeException('O cardápio precisa conter os códigos 001 a 150, sem lacunas ou duplicidades.');
        }
    }

    private function extras(): array
    {
        return [
            ['Carne do sol', 600],
            ['Carne moída', 600],
            ['Frango', 500],
            ['Requeijão', 400],
            ['Carne de hambúrguer', 300],
            ['Queijo', 300],
            ['Calabresa', 300],
            ['Ovo', 200],
            ['Catupiry', 200],
            ['Presunto', 200],
            ['Cheiro-verde', 100],
            ['Tomate', 100],
            ['Cebola', 100],
            ['Orégano', 100],
            ['Chia', 100],
            ['Embalagem para viagem', 100],
        ];
    }

    private function menu(): array
    {
        return [
            ['name' => 'Tapiocas — Simples', 'extras' => false, 'items' => [
                [1, 'Amanteigada', 400], [2, 'Leite de coco', 400], [3, 'Requeijão', 500],
                [4, 'Presunto', 500], [5, 'Ovo', 500], [6, 'Queijo', 600], [7, 'Mista (queijo e presunto)', 750],
            ]],
            ['name' => 'Tapiocas — Carne do Sol', 'extras' => true, 'items' => [
                [8, 'Carne do sol com frango', 1100], [9, 'Carne do sol com queijo', 1000],
                [10, 'Carne do sol com presunto', 950], [11, 'Carne do sol com calabresa', 950],
                [12, 'Carne do sol com ovo', 950], [13, 'Carne do sol', 900],
            ]],
            ['name' => 'Tapiocas — Frango', 'extras' => true, 'items' => [
                [14, 'Frango com carne do sol', 1100], [15, 'Frango com queijo', 900],
                [16, 'Frango com presunto', 850], [17, 'Frango com calabresa', 850],
                [18, 'Frango com ovo', 850], [19, 'Frango', 800],
            ]],
            ['name' => 'Tapiocas — Calabresa', 'extras' => true, 'items' => [
                [20, 'Calabresa com queijo', 800], [21, 'Calabresa com presunto', 750],
                [22, 'Calabresa com ovo', 750], [23, 'Calabresa', 700],
            ]],
            ['name' => 'Tapiocas — Especiais', 'extras' => true, 'items' => [
                [24, 'À moda da casa', 1400, 'Carne do sol, frango, queijo, presunto e ovo.'],
                [25, 'Modão', 1600, 'Carne do sol, frango, queijo, presunto, ovo, calabresa e requeijão.'],
            ]],
            ['name' => 'Tapiocas — Doces', 'extras' => false, 'items' => [
                [26, 'Leite condensado', 600], [27, 'Doce de leite', 600],
            ]],
            ['name' => 'Cuscuz — Simples', 'extras' => false, 'items' => [
                [28, 'Amanteigada', 500], [29, 'Leite de coco', 500], [30, 'Requeijão', 600],
                [31, 'Presunto', 600], [32, 'Ovo', 600], [33, 'Queijo', 700], [34, 'Misto (queijo e presunto)', 850],
            ]],
            ['name' => 'Cuscuz — Carne do Sol', 'extras' => true, 'items' => [
                [35, 'Carne do sol com frango', 1200], [36, 'Carne do sol com queijo', 1100],
                [37, 'Carne do sol com presunto', 1050], [38, 'Carne do sol com calabresa', 1050],
                [39, 'Carne do sol com ovo', 1050], [40, 'Carne do sol', 1000],
            ]],
            ['name' => 'Cuscuz — Frango', 'extras' => true, 'items' => [
                [41, 'Frango com carne do sol', 1200], [42, 'Frango com queijo', 1000],
                [43, 'Frango com presunto', 950], [44, 'Frango com calabresa', 950],
                [45, 'Frango com ovo', 950], [46, 'Frango', 900],
            ]],
            ['name' => 'Cuscuz — Calabresa', 'extras' => true, 'items' => [
                [47, 'Calabresa com queijo', 950], [48, 'Calabresa com presunto', 900],
                [49, 'Calabresa com ovo', 900], [50, 'Calabresa', 800],
            ]],
            ['name' => 'Cuscuz — Especiais', 'extras' => true, 'items' => [
                [51, 'Gostosinho', 1400, 'Carne moída, ovo, cheiro-verde e tomate.'],
                [52, 'À moda da casa', 1600, 'Carne do sol, frango, queijo, presunto e ovo.'],
            ]],
            ['name' => 'Pães de Forma ou Bola — Simples', 'extras' => false, 'items' => [
                [53, 'Amanteigado', 300], [54, 'Catupiry', 300], [55, 'Requeijão', 400],
                [56, 'Presunto', 400], [57, 'Ovo', 400], [58, 'Queijo', 500], [59, 'Misto (queijo e presunto)', 700],
            ]],
            ['name' => 'Pães de Forma ou Bola — Carne do Sol', 'extras' => true, 'items' => [
                [60, 'Carne do sol com frango', 950], [61, 'Carne do sol com queijo', 900],
                [62, 'Carne do sol com presunto', 850], [63, 'Carne do sol com calabresa', 850],
                [64, 'Carne do sol com ovo', 850], [65, 'Carne do sol', 800],
            ]],
            ['name' => 'Pães de Forma ou Bola — Frango', 'extras' => true, 'items' => [
                [66, 'Frango com carne do sol', 950], [67, 'Frango com queijo', 800],
                [68, 'Frango com presunto', 750], [69, 'Frango com calabresa', 750],
                [70, 'Frango com ovo', 750], [71, 'Frango', 700],
            ]],
            ['name' => 'Pães de Forma ou Bola — Calabresa', 'extras' => true, 'items' => [
                [72, 'Calabresa com queijo', 700], [73, 'Calabresa com presunto', 650],
                [74, 'Calabresa com ovo', 650], [75, 'Calabresa', 600],
            ]],
            ['name' => 'Pães de Forma ou Bola — Especiais', 'extras' => true, 'items' => [
                [76, 'X-Tudo', 1200, 'Carne do sol, frango, queijo, presunto e ovo.'],
                [77, 'Modão', 1400, 'Carne do sol, frango, queijo, presunto, ovo, calabresa e requeijão.'],
            ]],
            ['name' => 'Pães Árabes — Carne do Sol', 'extras' => true, 'items' => [
                [78, 'Carne do sol com frango', 1200], [79, 'Carne do sol com queijo', 1100],
                [80, 'Carne do sol com presunto', 1050], [81, 'Carne do sol com calabresa', 1050],
                [82, 'Carne do sol com ovo', 1050], [83, 'Carne do sol', 1000],
            ]],
            ['name' => 'Pães Árabes — Frango', 'extras' => true, 'items' => [
                [84, 'Frango com carne do sol', 1200], [85, 'Frango com queijo', 1000],
                [86, 'Frango com presunto', 950], [87, 'Frango com calabresa', 950],
                [88, 'Frango com ovo', 950], [89, 'Frango', 900],
            ]],
            ['name' => 'Pães Árabes — Calabresa', 'extras' => true, 'items' => [
                [90, 'Calabresa com queijo', 950], [91, 'Calabresa com presunto', 900],
                [92, 'Calabresa com ovo', 900], [93, 'Calabresa', 850],
            ]],
            ['name' => 'Pães Árabes — Carne Hambúrguer', 'extras' => true, 'items' => [
                [94, 'Hambúrguer com carne do sol', 1200], [95, 'Hambúrguer com frango', 1100],
                [96, 'Hambúrguer com queijo', 950], [97, 'Hambúrguer com presunto', 900],
                [98, 'Hambúrguer com calabresa', 900], [99, 'Hambúrguer com ovo', 900], [100, 'Hambúrguer', 800],
            ]],
            ['name' => 'Pães Árabes — Especiais', 'extras' => true, 'items' => [
                [101, 'Mistão', 1300, 'Queijo, presunto, calabresa e ovo.'],
                [102, 'X-Tudo', 1600, 'Carne do sol, frango, queijo, presunto e ovo.'],
                [103, 'Modão', 1800, 'Carne do sol, frango, queijo, presunto, ovo, calabresa e requeijão.'],
            ]],
            ['name' => 'Crepiocas — Simples', 'extras' => false, 'items' => [
                [104, 'Carne do sol', 1100], [105, 'Mista', 1000], [106, 'Frango', 900],
                [107, 'Calabresa', 850], [108, 'Queijo', 850], [109, 'Ovo', 700],
            ]],
            ['name' => 'Crepiocas — Carne do Sol', 'extras' => true, 'items' => [
                [110, 'Carne do sol com frango', 1500], [111, 'Carne do sol com requeijão', 1400],
                [112, 'Carne do sol com queijo', 1300], [113, 'Carne do sol com presunto', 1200],
                [114, 'Carne do sol com calabresa', 1200], [115, 'Carne do sol com ovo', 1200],
            ]],
            ['name' => 'Crepiocas — Frango', 'extras' => true, 'items' => [
                [116, 'Frango com carne do sol', 1500], [117, 'Frango com requeijão', 1300],
                [118, 'Frango com queijo', 1200], [119, 'Frango com presunto', 1100],
                [120, 'Frango com calabresa', 1100], [121, 'Frango com ovo', 1100],
            ]],
            ['name' => 'Sucos — Garrafinha 500 ml', 'extras' => false, 'items' => [
                [122, 'Abacaxi', 600], [123, 'Abacaxi com hortelã', 600], [124, 'Acerola', 600],
                [125, 'Caju', 600], [126, 'Cajá', 600], [127, 'Goiaba', 600], [128, 'Graviola', 700],
                [129, 'Manga', 600], [130, 'Morango', 800], [131, 'Maracujá', 800],
                [132, 'Siriguela', 600], [133, 'Tamarindo', 600],
            ]],
            ['name' => 'Vitaminas — Garrafinha 500 ml', 'extras' => false, 'items' => [
                [134, 'Açaí', 1100], [135, 'Açaí com banana', 1200], [136, 'Abacaxi', 800],
                [137, 'Abacaxi com hortelã', 800], [138, 'Acerola', 800], [139, 'Caju', 800],
                [140, 'Cajá', 900], [141, 'Goiaba', 800], [142, 'Graviola', 900], [143, 'Manga', 800],
                [144, 'Maracujá', 1000], [145, 'Morango', 1000], [146, 'Siriguela', 800], [147, 'Tamarindo', 800],
            ]],
            ['name' => 'Cafés — Copinho 150 ml', 'extras' => false, 'items' => [
                [148, 'Café puro', 200], [149, 'Café com leite', 300], [150, 'Leite quente', 300],
            ]],
        ];
    }
}
