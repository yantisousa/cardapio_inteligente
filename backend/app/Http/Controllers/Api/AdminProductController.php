<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminProductController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        Category::query()->findOrFail($data['category_id']);

        $product = DB::transaction(function () use ($data) {
            $product = Product::create([
                ...Arr::except($data, ['variants', 'modifier_groups']),
                'slug' => $this->uniqueSlug($data['name']),
            ]);
            $this->syncOptions($product, $data);
            return $product;
        });

        return response()->json(['product' => $product->load('variants', 'modifierGroups.options')], 201);
    }

    public function update(Request $request, string $product): JsonResponse
    {
        $product = Product::query()->findOrFail($product);
        $data = $this->validated($request);
        Category::query()->findOrFail($data['category_id']);

        DB::transaction(function () use ($product, $data) {
            $attributes = Arr::except($data, ['variants', 'modifier_groups']);
            if ($attributes['name'] !== $product->name) {
                $attributes['slug'] = $this->uniqueSlug($attributes['name'], $product->id);
            }
            $product->update($attributes);
            $this->syncOptions($product, $data);
        });

        return response()->json(['product' => $product->fresh()->load('variants', 'modifierGroups.options')]);
    }

    public function destroy(string $product): JsonResponse
    {
        Product::query()->findOrFail($product)->delete();
        return response()->json(status: 204);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'category_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:140'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'url', 'max:2048'],
            'price_cents' => ['required', 'integer', 'min:0', 'max:10000000'],
            'active' => ['required', 'boolean'],
            'availability' => ['nullable', 'array'],
            'variants' => ['present', 'array', 'max:20'],
            'variants.*.name' => ['required', 'string', 'max:100'],
            'variants.*.price_delta_cents' => ['required', 'integer', 'min:-1000000', 'max:1000000'],
            'variants.*.is_default' => ['required', 'boolean'],
            'modifier_groups' => ['present', 'array', 'max:20'],
            'modifier_groups.*.name' => ['required', 'string', 'max:100'],
            'modifier_groups.*.min_choices' => ['required', 'integer', 'min:0', 'max:20'],
            'modifier_groups.*.max_choices' => ['required', 'integer', 'min:1', 'max:20'],
            'modifier_groups.*.options' => ['required', 'array', 'min:1', 'max:50'],
            'modifier_groups.*.options.*.name' => ['required', 'string', 'max:100'],
            'modifier_groups.*.options.*.price_cents' => ['required', 'integer', 'min:0', 'max:1000000'],
        ]);

        foreach ($data['modifier_groups'] as $group) {
            if ($group['min_choices'] > $group['max_choices'] || $group['max_choices'] > count($group['options'])) {
                throw ValidationException::withMessages(['modifier_groups' => "Revise os limites do grupo {$group['name']}."]);
            }
        }

        return $data;
    }

    private function syncOptions(Product $product, array $data): void
    {
        $product->variants()->delete();
        foreach ($data['variants'] as $index => $variant) {
            $product->variants()->create([
                ...$variant,
                'is_default' => collect($data['variants'])->contains('is_default', true) ? $variant['is_default'] : $index === 0,
                'active' => true,
            ]);
        }

        $product->modifierGroups()->delete();
        foreach ($data['modifier_groups'] as $position => $groupData) {
            $group = $product->modifierGroups()->create([
                'name' => $groupData['name'],
                'min_choices' => $groupData['min_choices'],
                'max_choices' => $groupData['max_choices'],
                'position' => $position,
            ]);
            foreach ($groupData['options'] as $option) {
                $group->options()->create([...$option, 'active' => true]);
            }
        }
    }

    private function uniqueSlug(string $name, ?string $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'produto';
        $slug = $base;
        $counter = 2;

        while (Product::query()->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }
}
