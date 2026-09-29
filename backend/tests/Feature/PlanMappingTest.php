<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanMappingTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_three_plans_are_mapped_and_basic_contains_the_current_product_plus_pix(): void
    {
        $this->assertSame(['basic', 'premium', 'pro'], Plan::query()->orderBy('slug')->pluck('slug')->all());

        $basic = Plan::query()->where('slug', 'basic')->firstOrFail();
        $this->assertTrue($basic->active);
        $this->assertTrue($basic->hasFeature('storefront'));
        $this->assertTrue($basic->hasFeature('catalog_management'));
        $this->assertTrue($basic->hasFeature('order_management'));
        $this->assertTrue($basic->hasFeature('manual_pix'));

        $this->assertFalse(Plan::query()->where('slug', 'pro')->firstOrFail()->active);
        $this->assertFalse(Plan::query()->where('slug', 'premium')->firstOrFail()->active);
    }

    public function test_existing_tenants_are_assigned_to_basic(): void
    {
        $this->seed();

        $tenant = Tenant::query()->where('slug', 'forno-afeto')->with('plan')->firstOrFail();

        $this->assertSame('basic', $tenant->plan->slug);
        $this->assertTrue($tenant->hasFeature('manual_pix'));

        $this->withHeaders(['X-Tenant-Host' => 'demo.localhost'])
            ->getJson('/api/storefront')
            ->assertOk()
            ->assertJsonPath('plan.slug', 'basic')
            ->assertJsonPath('plan.features.11', 'manual_pix');
    }
}
