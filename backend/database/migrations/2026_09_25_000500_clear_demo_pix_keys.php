<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach (DB::table('tenants')->pluck('id') as $tenantId) {
                DB::statement("select set_config('app.current_tenant', ?, false)", [$tenantId]);
                DB::table('tenant_settings')
                    ->where('tenant_id', $tenantId)
                    ->where('pix_key', 'pedido@fornoeafeto.com.br')
                    ->update(['pix_key' => null]);
            }

            DB::statement("select set_config('app.current_tenant', '', false)");

            return;
        }

        DB::table('tenant_settings')
            ->where('pix_key', 'pedido@fornoeafeto.com.br')
            ->update(['pix_key' => null]);
    }

    public function down(): void
    {
        // A credential-like payment key must not be restored automatically.
    }
};
