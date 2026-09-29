<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (config('plans') as $slug => $plan) {
            DB::table('plans')->updateOrInsert(
                ['slug' => $slug],
                [
                    'name' => $plan['name'],
                    'price_cents' => $plan['price_cents'],
                    'features' => json_encode($plan['features'], JSON_THROW_ON_ERROR),
                    'active' => $plan['active'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }

        $basicPlanId = DB::table('plans')->where('slug', 'basic')->value('id');
        DB::table('tenants')->whereNull('plan_id')->update(['plan_id' => $basicPlanId]);
    }

    public function down(): void
    {
        $planIds = DB::table('plans')->whereIn('slug', array_keys(config('plans')))->pluck('id');
        DB::table('tenants')->whereIn('plan_id', $planIds)->update(['plan_id' => null]);
        DB::table('plans')->whereIn('id', $planIds)->delete();
    }
};
