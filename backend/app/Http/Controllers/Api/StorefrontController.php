<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\TenantSetting;
use Illuminate\Http\JsonResponse;

class StorefrontController extends Controller
{
    public function __invoke(): JsonResponse
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

        return response()->json(['store' => $settings, 'categories' => $categories]);
    }
}
