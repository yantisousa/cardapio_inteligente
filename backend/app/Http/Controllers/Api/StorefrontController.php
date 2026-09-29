<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\TenantSetting;
use App\Services\StoreAvailabilityService;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;

class StorefrontController extends Controller
{
    public function __invoke(TenantContext $tenantContext, StoreAvailabilityService $availability): JsonResponse
    {
        $settings = TenantSetting::query()->firstOrFail();
        $categories = Category::query()
            ->where('active', true)
            ->with(['products' => fn ($query) => $query->where('active', true)->with([
                'variants' => fn ($query) => $query->where('active', true),
                'modifierGroups.options' => fn ($query) => $query->where('active', true),
            ])])
            ->orderBy('position')
            ->get();

        $tenant = $tenantContext->tenant()->loadMissing('plan');

        return response()->json([
            'tenant' => $tenant->only('id', 'name', 'slug'),
            'plan' => $tenant->plan?->only('name', 'slug', 'features'),
            'store' => $settings,
            'operation' => $availability->status($settings),
            'categories' => $categories,
        ]);
    }
}
