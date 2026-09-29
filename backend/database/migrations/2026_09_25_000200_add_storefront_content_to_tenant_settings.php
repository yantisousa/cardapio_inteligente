<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->json('storefront_content')->nullable()->after('business_hours');
        });

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

        if (DB::getDriverName() === 'pgsql') {
            foreach (DB::table('tenants')->pluck('id') as $tenantId) {
                DB::statement("select set_config('app.current_tenant', ?, false)", [$tenantId]);
                DB::table('tenant_settings')->where('tenant_id', $tenantId)->whereNull('storefront_content')->update(['storefront_content' => $content]);
            }
            DB::statement("select set_config('app.current_tenant', '', false)");
        } else {
            DB::table('tenant_settings')->whereNull('storefront_content')->update(['storefront_content' => $content]);
        }
    }

    public function down(): void
    {
        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->dropColumn('storefront_content');
        });
    }
};
