<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $bannerUrl = 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1100&q=90';

        foreach (DB::table('tenants')->pluck('id') as $tenantId) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("select set_config('app.current_tenant', ?, false)", [$tenantId]);
            }

            DB::table('tenant_settings')
                ->where('tenant_id', $tenantId)
                ->update(['banner_url' => $bannerUrl]);
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("select set_config('app.current_tenant', '', false)");
        }
    }

    public function down(): void
    {
        // Keep any banner selected later by the store owner.
    }
};
