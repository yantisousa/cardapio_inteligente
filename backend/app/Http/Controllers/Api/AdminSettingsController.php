<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TenantSetting;
use App\Support\PixKey;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['settings' => TenantSetting::query()->firstOrFail()]);
    }

    public function update(Request $request, TenantContext $tenantContext): JsonResponse
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
            'business_hours.timezone' => ['nullable', 'timezone'],
            'business_hours.schedule' => ['nullable', 'array'],
            'business_hours.schedule.*' => ['array', 'max:4'],
            'business_hours.schedule.*.*.open' => ['required', 'date_format:H:i'],
            'business_hours.schedule.*.*.close' => ['required', 'date_format:H:i'],
            'storefront_content' => ['nullable', 'array'],
            'storefront_content.hero_badge' => ['nullable', 'string', 'max:80'],
            'storefront_content.hero_title' => ['nullable', 'string', 'max:120'],
            'storefront_content.hero_highlight' => ['nullable', 'string', 'max:80'],
            'storefront_content.hero_note' => ['nullable', 'string', 'max:80'],
            'storefront_content.menu_title' => ['nullable', 'string', 'max:120'],
            'storefront_content.story_eyebrow' => ['nullable', 'string', 'max:80'],
            'storefront_content.story_title' => ['nullable', 'string', 'max:160'],
            'storefront_content.story_text' => ['nullable', 'string', 'max:1200'],
            'storefront_content.story_since' => ['nullable', 'string', 'max:80'],
            'storefront_design' => ['sometimes', 'array:background_color,surface_color,text_color,hero_layout,card_layout,corner_style,sections,section_order,story_image_url'],
            'storefront_design.background_color' => ['required_with:storefront_design', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'storefront_design.surface_color' => ['required_with:storefront_design', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'storefront_design.text_color' => ['required_with:storefront_design', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'storefront_design.hero_layout' => ['required_with:storefront_design', 'in:split,centered,compact'],
            'storefront_design.card_layout' => ['required_with:storefront_design', 'in:grid,list'],
            'storefront_design.corner_style' => ['required_with:storefront_design', 'in:soft,square,round'],
            'storefront_design.sections' => ['required_with:storefront_design', 'array:hero,services,story,footer'],
            'storefront_design.sections.hero' => ['required_with:storefront_design', 'boolean'],
            'storefront_design.sections.services' => ['required_with:storefront_design', 'boolean'],
            'storefront_design.sections.story' => ['required_with:storefront_design', 'boolean'],
            'storefront_design.sections.footer' => ['required_with:storefront_design', 'boolean'],
            'storefront_design.section_order' => ['required_with:storefront_design', 'array', 'size:4'],
            'storefront_design.section_order.*' => ['required', 'distinct', 'in:hero,services,menu,story'],
            'storefront_design.story_image_url' => $this->imageUrlRules(),
            'delivery_fee_cents' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'delivery_zones' => ['nullable', 'array', 'max:100'],
            'delivery_zones.*.neighborhood' => ['required', 'string', 'max:120'],
            'delivery_zones.*.city' => ['nullable', 'string', 'max:120'],
            'delivery_zones.*.state' => ['nullable', 'string', 'size:2'],
            'delivery_zones.*.fee_cents' => ['required', 'integer', 'min:0', 'max:1000000'],
            'delivery_zones.*.active' => ['sometimes', 'boolean'],
            'minimum_order_cents' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'estimated_delivery_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'pix_key' => ['nullable', 'string', 'max:77'],
            'accepts_delivery' => ['sometimes', 'boolean'],
            'accepts_pickup' => ['sometimes', 'boolean'],
            'is_paused' => ['sometimes', 'boolean'],
            'pause_message' => ['nullable', 'string', 'max:240'],
            'enforce_business_hours' => ['sometimes', 'boolean'],
            'outside_hours_mode' => ['sometimes', 'in:block,schedule'],
        ]);

        if (array_key_exists('pix_key', $data)) {
            $data['pix_key'] = PixKey::normalize($data['pix_key']);
        }

        if (array_key_exists('delivery_zones', $data)) {
            $data['delivery_zones'] = collect($data['delivery_zones'] ?? [])->map(fn (array $zone) => [
                'neighborhood' => trim($zone['neighborhood']),
                'city' => filled($zone['city'] ?? null) ? trim($zone['city']) : null,
                'state' => filled($zone['state'] ?? null) ? strtoupper(trim($zone['state'])) : null,
                'fee_cents' => (int) $zone['fee_cents'],
                'active' => $zone['active'] ?? true,
            ])->values()->all();
        }

        return DB::transaction(function () use ($data, $tenantContext): JsonResponse {
            $settings = TenantSetting::query()->firstOrFail();

            $acceptsDelivery = $data['accepts_delivery'] ?? $settings->accepts_delivery;
            $acceptsPickup = $data['accepts_pickup'] ?? $settings->accepts_pickup;
            if (! $acceptsDelivery && ! $acceptsPickup) {
                throw ValidationException::withMessages([
                    'accepts_delivery' => 'Mantenha entrega ou retirada ativa para receber pedidos.',
                ]);
            }

            $settings->update($data);

            if (array_key_exists('store_name', $data)) {
                $tenantContext->tenant()->update(['name' => $data['store_name']]);
            }

            return response()->json(['settings' => $settings->fresh()]);
        });
    }

    public function updateOperationalStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'is_paused' => ['required', 'boolean'],
            'pause_message' => ['nullable', 'string', 'max:240'],
        ]);

        $settings = TenantSetting::query()->firstOrFail();
        $settings->update($data);

        return response()->json(['settings' => $settings->fresh()]);
    }

    public function uploadBrandAsset(Request $request, TenantContext $tenantContext): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'in:logo,banner,story'],
            'draft' => ['sometimes', 'boolean'],
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ], [
            'image.image' => 'Envie um arquivo de imagem válido.',
            'image.mimes' => 'A imagem deve estar em JPG, PNG ou WebP.',
            'image.max' => 'A imagem pode ter no máximo 5 MB.',
        ]);

        $tenantId = $tenantContext->id();
        abort_if($data['kind'] === 'story' && ! ($data['draft'] ?? false), 422, 'Envie esta imagem pelo editor do site.');
        $extension = strtolower($data['image']->guessExtension() ?: $data['image']->extension() ?: 'jpg');
        $filename = Str::uuid().'.'.$extension;
        $path = $data['image']->storeAs("tenants/{$tenantId}/branding", $filename, 'public');

        abort_unless($path, 500, 'Não foi possível armazenar a imagem.');

        if ($data['draft'] ?? false) {
            return response()->json([
                'kind' => $data['kind'],
                'url' => "/api/media/{$tenantId}/{$filename}",
                'draft' => true,
            ], 201);
        }

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
