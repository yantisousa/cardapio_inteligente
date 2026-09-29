<?php

namespace App\Services;

use App\Jobs\OrderPlaced;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\ModifierOption;
use App\Models\Order;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Support\PhoneNumber;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function __construct(private readonly StoreAvailabilityService $availability) {}

    public function create(array $payload, string $idempotencyKey): array
    {
        $tenantId = app(TenantContext::class)->id();

        return DB::transaction(function () use ($payload, $idempotencyKey, $tenantId) {
            $tenant = Tenant::query()->with('plan')->whereKey($tenantId)->lockForUpdate()->firstOrFail();

            if ($existing = Order::where('idempotency_key', $idempotencyKey)->first()) {
                return ['order' => $existing->load('items.modifiers', 'payments'), 'replayed' => true];
            }

            $settings = TenantSetting::query()->firstOrFail();
            $operation = $this->availability->status($settings);
            if (! $operation['accepting_orders']) {
                throw ValidationException::withMessages(['store' => $operation['message']]);
            }
            $this->validateFulfillment($payload['fulfillment_type'], $settings);
            $this->validatePayment($payload['payment_method'], $settings, $tenant);

            $pricedItems = collect($payload['items'])->map(fn (array $item) => $this->priceItem($item));
            $subtotal = $pricedItems->sum('total_cents');
            $deliveryFee = $payload['fulfillment_type'] === 'delivery'
                ? $this->deliveryFee($payload['delivery_address'], $settings)
                : 0;

            if ($subtotal < $settings->minimum_order_cents) {
                throw ValidationException::withMessages(['items' => 'O subtotal não atingiu o pedido mínimo da loja.']);
            }

            $customerPhone = PhoneNumber::normalize($payload['customer']['phone']);
            if (strlen($customerPhone) < 10 || strlen($customerPhone) > 11) {
                throw ValidationException::withMessages(['customer.phone' => 'Informe um telefone válido com DDD.']);
            }

            $customer = Customer::updateOrCreate(
                ['phone' => $customerPhone],
                ['name' => $payload['customer']['name'], 'email' => $payload['customer']['email'] ?? null],
            );

            $payload['customer']['phone'] = $customerPhone;

            if ($payload['fulfillment_type'] === 'delivery') {
                $this->saveCustomerAddress($customer, $payload['delivery_address']);
            }

            $order = Order::create([
                'public_id' => (string) Str::uuid(),
                'customer_id' => $customer->id,
                'number' => ((int) Order::max('number')) + 1,
                'status' => 'pending',
                'fulfillment_type' => $payload['fulfillment_type'],
                'payment_method' => $payload['payment_method'],
                'payment_status' => 'pending',
                'subtotal_cents' => $subtotal,
                'delivery_fee_cents' => $deliveryFee,
                'discount_cents' => 0,
                'total_cents' => $subtotal + $deliveryFee,
                'customer_snapshot' => $payload['customer'],
                'delivery_address_snapshot' => $payload['fulfillment_type'] === 'delivery' ? $payload['delivery_address'] : null,
                'notes' => $payload['notes'] ?? null,
                'idempotency_key' => $idempotencyKey,
                'placed_at' => now(),
                'scheduled_for' => $operation['will_schedule'] ? $operation['scheduled_for'] : null,
            ]);

            foreach ($pricedItems as $priced) {
                $orderItem = $order->items()->create(collect($priced)->except('modifiers')->all());

                foreach ($priced['modifiers'] as $modifier) {
                    $orderItem->modifiers()->create($modifier);
                }
            }

            $order->payments()->create([
                'method' => $payload['payment_method'],
                'status' => 'pending',
                'amount_cents' => $order->total_cents,
            ]);

            $order->events()->create(['type' => 'created', 'to_status' => 'pending']);
            OrderPlaced::dispatch($tenantId, $order->id)->afterCommit();

            return ['order' => $order->load('items.modifiers', 'payments'), 'replayed' => false];
        }, 3);
    }

    private function priceItem(array $input): array
    {
        $product = Product::with(['variants', 'modifierGroups.options'])
            ->whereKey($input['product_id'])
            ->where('active', true)
            ->where('is_sold_out', false)
            ->lockForUpdate()
            ->first();

        if (! $product) {
            throw ValidationException::withMessages(['items' => 'Um produto não está mais disponível.']);
        }

        $variant = null;
        if ($input['variant_id'] ?? null) {
            $variant = $product->variants->first(fn ($candidate) => $candidate->id === $input['variant_id'] && $candidate->active);
            if (! $variant) {
                throw ValidationException::withMessages(['items' => "Variação inválida para {$product->name}."]);
            }
        }

        $requestedIds = collect($input['modifier_option_ids'] ?? []);
        $options = $requestedIds->isEmpty()
            ? collect()
            : ModifierOption::with('group')->whereIn('id', $requestedIds)->where('active', true)->get();

        if ($options->count() !== $requestedIds->count() || $options->contains(fn ($option) => $option->group->product_id !== $product->id)) {
            throw ValidationException::withMessages(['items' => "Adicional inválido para {$product->name}."]);
        }

        foreach ($product->modifierGroups as $group) {
            $count = $options->where('modifier_group_id', $group->id)->count();
            if ($count < $group->min_choices || $count > $group->max_choices) {
                throw ValidationException::withMessages(['items' => "Escolha entre {$group->min_choices} e {$group->max_choices} opção(ões) em {$group->name}."]);
            }
        }

        $unitPrice = max(0, $product->price_cents + ($variant?->price_delta_cents ?? 0) + $options->sum('price_cents'));
        $quantity = (int) $input['quantity'];

        return [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'variant_name' => $variant?->name,
            'unit_price_cents' => $unitPrice,
            'quantity' => $quantity,
            'total_cents' => $unitPrice * $quantity,
            'notes' => $input['notes'] ?? null,
            'modifiers' => $options->map(fn ($option) => [
                'modifier_option_id' => $option->id,
                'group_name' => $option->group->name,
                'option_name' => $option->name,
                'price_cents' => $option->price_cents,
            ])->all(),
        ];
    }

    private function validateFulfillment(string $type, TenantSetting $settings): void
    {
        if (($type === 'delivery' && ! $settings->accepts_delivery) || ($type === 'pickup' && ! $settings->accepts_pickup)) {
            throw ValidationException::withMessages(['fulfillment_type' => 'Modalidade indisponível nesta loja.']);
        }
    }

    private function validatePayment(string $method, TenantSetting $settings, Tenant $tenant): void
    {
        if ($method === 'pix' && (! $tenant->hasFeature('manual_pix') || blank($settings->pix_key))) {
            throw ValidationException::withMessages([
                'payment_method' => 'O Pix ainda não está configurado para esta loja.',
            ]);
        }
    }

    private function deliveryFee(array $address, TenantSetting $settings): int
    {
        $zones = collect($settings->delivery_zones ?? [])->filter(
            fn (array $zone) => ($zone['active'] ?? true) && filled($zone['neighborhood'] ?? null)
        );

        if ($zones->isEmpty()) {
            return (int) $settings->delivery_fee_cents;
        }

        $zone = $zones->first(function (array $zone) use ($address): bool {
            if ($this->normalizeLocation($zone['neighborhood']) !== $this->normalizeLocation($address['neighborhood'])) {
                return false;
            }
            if (filled($zone['city'] ?? null) && $this->normalizeLocation($zone['city']) !== $this->normalizeLocation($address['city'])) {
                return false;
            }

            // O estado é opcional no endereço: sem ele, a zona é reconhecida só por cidade e bairro.
            return blank($zone['state'] ?? null)
                || blank($address['state'] ?? null)
                || strtoupper(trim($zone['state'])) === strtoupper(trim($address['state']));
        });

        if (! $zone) {
            throw ValidationException::withMessages([
                'delivery_address.neighborhood' => 'Este endereço está fora da área de entrega da loja.',
            ]);
        }

        return (int) $zone['fee_cents'];
    }

    private function normalizeLocation(string $value): string
    {
        return Str::lower(Str::ascii(preg_replace('/\s+/', ' ', trim($value))));
    }

    private function saveCustomerAddress(Customer $customer, array $input): void
    {
        $address = [
            'label' => trim($input['label'] ?? '') ?: 'Principal',
            'street' => trim($input['street']),
            'number' => trim($input['number']),
            'complement' => filled($input['complement'] ?? null) ? trim($input['complement']) : null,
            'neighborhood' => trim($input['neighborhood']),
            'city' => trim($input['city']),
            'state' => strtoupper(trim($input['state'] ?? '')),
            'postal_code' => preg_replace('/\D+/', '', $input['postal_code']),
            'reference' => filled($input['reference'] ?? null) ? trim($input['reference']) : null,
        ];

        CustomerAddress::query()->updateOrCreate(
            [
                'customer_id' => $customer->id,
                'street' => $address['street'],
                'number' => $address['number'],
                'postal_code' => $address['postal_code'],
            ],
            $address,
        );
    }
}
