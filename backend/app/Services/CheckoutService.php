<?php

namespace App\Services;

use App\Jobs\OrderPlaced;
use App\Models\Customer;
use App\Models\ModifierOption;
use App\Models\Order;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function create(array $payload, string $idempotencyKey): array
    {
        $tenantId = app(TenantContext::class)->id();

        return DB::transaction(function () use ($payload, $idempotencyKey, $tenantId) {
            Tenant::query()->whereKey($tenantId)->lockForUpdate()->firstOrFail();

            if ($existing = Order::where('idempotency_key', $idempotencyKey)->first()) {
                return ['order' => $existing->load('items.modifiers', 'payments'), 'replayed' => true];
            }

            $settings = TenantSetting::query()->firstOrFail();
            $this->validateFulfillment($payload['fulfillment_type'], $settings);

            $pricedItems = collect($payload['items'])->map(fn (array $item) => $this->priceItem($item));
            $subtotal = $pricedItems->sum('total_cents');
            $deliveryFee = $payload['fulfillment_type'] === 'delivery' ? $settings->delivery_fee_cents : 0;

            if ($subtotal < $settings->minimum_order_cents) {
                throw ValidationException::withMessages(['items' => 'O subtotal não atingiu o pedido mínimo da loja.']);
            }

            $customer = Customer::updateOrCreate(
                ['phone' => $payload['customer']['phone']],
                ['name' => $payload['customer']['name'], 'email' => $payload['customer']['email'] ?? null],
            );

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
}
