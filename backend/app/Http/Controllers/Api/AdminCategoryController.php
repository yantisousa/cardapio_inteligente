<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminCategoryController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'position' => ['nullable', 'integer', 'min:0', 'max:999'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $category = Category::create([
            ...$data,
            'slug' => $this->uniqueSlug($data['name']),
            'position' => $data['position'] ?? ((int) Category::max('position')) + 1,
            'active' => $data['active'] ?? true,
        ]);

        return response()->json(['category' => $category], 201);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        $category = Category::query()->findOrFail($category);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'position' => ['sometimes', 'integer', 'min:0', 'max:999'],
            'active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['name']) && $data['name'] !== $category->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $category->id);
        }

        $category->update($data);
        return response()->json(['category' => $category->fresh()]);
    }

    public function destroy(string $category): JsonResponse
    {
        $category = Category::query()->withCount('products')->findOrFail($category);

        if ($category->products_count > 0) {
            throw ValidationException::withMessages(['category' => 'Mova ou exclua os produtos antes de remover a categoria.']);
        }

        $category->delete();
        return response()->json(status: 204);
    }

    private function uniqueSlug(string $name, ?string $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'categoria';
        $slug = $base;
        $counter = 2;

        while (Category::query()->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }
}
