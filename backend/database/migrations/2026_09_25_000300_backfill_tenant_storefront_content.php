<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $content = json_encode([
            'hero_badge' => 'Estamos abertos',
            'hero_title' => 'Comida que abraça a',
            'hero_highlight' => 'mesa.',
            'hero_note' => 'feito com afeto ↗',
            'menu_title' => 'Escolha seu momento favorito',
            'story_eyebrow' => 'Nossa cozinha',
            'story_title' => 'Tem coisas que só o tempo sabe fazer.',
            'story_text' => 'Receitas cuidadosas, ingredientes selecionados e uma história que pertence a cada loja.',
            'story_since' => 'feito com carinho',
        ], JSON_UNESCAPED_UNICODE);

        foreach (DB::table('tenants')->pluck('id') as $tenantId) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("select set_config('app.current_tenant', ?, false)", [$tenantId]);
            }

            $settings = DB::table('tenant_settings')->where('tenant_id', $tenantId)->first();
            if (! $settings) {
                continue;
            }

            if ($settings->storefront_content === null) {
                DB::table('tenant_settings')->where('tenant_id', $tenantId)->update(['storefront_content' => $content]);
            }

            DB::table('tenants')->where('id', $tenantId)->update(['name' => $settings->store_name]);
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("select set_config('app.current_tenant', '', false)");
        }
    }

    public function down(): void
    {
        // Data backfill only.
    }
};
