<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TenantSetting;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['settings' => TenantSetting::query()->firstOrFail()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_name' => ['sometimes', 'required', 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:240'],
            'logo_url' => $this->imageUrlRules(),
            'banner_url' => $this->imageUrlRules(),
            'primary_color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accent_color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'address' => ['nullable', 'array'],
            'address.street' => ['nullable', 'string', 'max:190'],
            'address.number' => ['nullable', 'string', 'max:30'],
            'address.city' => ['nullable', 'string', 'max:120'],
            'address.state' => ['nullable', 'string', 'size:2'],
            'business_hours' => ['nullable', 'array'],
            'business_hours.summary' => ['nullable', 'string', 'max:120'],
            'delivery_fee_cents' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'minimum_order_cents' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'estimated_delivery_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'pix_key' => ['nullable', 'string', 'max:190'],
            'accepts_delivery' => ['sometimes', 'boolean'],
            'accepts_pickup' => ['sometimes', 'boolean'],
        ]);

        $settings = TenantSetting::query()->firstOrFail();
        $settings->update($data);

        return response()->json(['settings' => $settings->fresh()]);
    }

    public function uploadBrandAsset(Request $request, TenantContext $tenantContext): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:logo,banner'],
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ], [
            'image.image' => 'Envie um arquivo de imagem válido.',
            'image.mimes' => 'A imagem deve estar em JPG, PNG ou WebP.',
            'image.max' => 'A imagem pode ter no máximo 5 MB.',
        ]);

        $tenantId = $tenantContext->id();
        $extension = strtolower($data['image']->guessExtension() ?: $data['image']->extension() ?: 'jpg');
        $filename = Str::uuid().'.'.$extension;
        $path = $data['image']->storeAs("tenants/{$tenantId}/branding", $filename, 'public');

        abort_unless($path, 500, 'Não foi possível armazenar a imagem.');

        $settings = TenantSetting::query()->firstOrFail();
        $field = $data['kind'].'_url';
        $previousPath = $this->localAssetPath($settings->{$field});
        $url = "/api/media/{$tenantId}/{$filename}";

        try {
            $settings->update([$field => $url]);
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($path);
            throw $exception;
        }

        if ($previousPath && $previousPath !== $path) {
            Storage::disk('public')->delete($previousPath);
        }

        return response()->json([
            'kind' => $data['kind'],
            'url' => $url,
            'settings' => $settings->fresh(),
        ], 201);
    }

    private function imageUrlRules(): array
    {
        return ['nullable', 'string', 'max:2048', function (string $attribute, mixed $value, \Closure $fail): void {
            $isRemoteUrl = filter_var($value, FILTER_VALIDATE_URL)
                && in_array(parse_url($value, PHP_URL_SCHEME), ['http', 'https'], true);
            $isUploadedAsset = preg_match('#^/api/media/[0-9a-f-]{36}/[0-9a-f-]{36}\.(?:jpe?g|png|webp)$#i', $value) === 1;

            if (! $isRemoteUrl && ! $isUploadedAsset) {
                $fail('Informe uma URL de imagem válida ou envie um novo arquivo.');
            }
        }];
    }

    private function localAssetPath(?string $url): ?string
    {
        if (! $url || ! preg_match('#^/api/media/([0-9a-f-]{36})/([0-9a-f-]{36}\.(?:jpe?g|png|webp))$#i', $url, $matches)) {
            return null;
        }

        return "tenants/{$matches[1]}/branding/{$matches[2]}";
    }
}
