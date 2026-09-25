<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class AdminMenuController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $categories = Category::query()
            ->with(['products' => fn ($query) => $query->with('variants', 'modifierGroups.options')->orderBy('name')])
            ->orderBy('position')
            ->get();

        return response()->json(['categories' => $categories]);
    }
}
