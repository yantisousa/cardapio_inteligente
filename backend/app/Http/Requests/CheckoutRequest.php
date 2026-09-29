<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer.name' => ['required', 'string', 'max:120'],
            'customer.phone' => ['required', 'string', 'max:32'],
            'customer.email' => ['nullable', 'email', 'max:190'],
            'fulfillment_type' => ['required', 'in:delivery,pickup'],
            'payment_method' => ['required', 'in:pix,cash,card_on_delivery'],
            'delivery_address' => ['required_if:fulfillment_type,delivery', 'nullable', 'array'],
            'delivery_address.street' => ['required_if:fulfillment_type,delivery', 'nullable', 'string', 'max:190'],
            'delivery_address.number' => ['required_if:fulfillment_type,delivery', 'nullable', 'string', 'max:30'],
            'delivery_address.neighborhood' => ['required_if:fulfillment_type,delivery', 'nullable', 'string', 'max:120'],
            'delivery_address.city' => ['required_if:fulfillment_type,delivery', 'nullable', 'string', 'max:120'],
            'delivery_address.state' => ['nullable', 'string', 'size:2'],
            'delivery_address.postal_code' => ['required_if:fulfillment_type,delivery', 'nullable', 'string', 'max:12'],
            'delivery_address.label' => ['nullable', 'string', 'max:60'],
            'delivery_address.complement' => ['nullable', 'string', 'max:120'],
            'delivery_address.reference' => ['nullable', 'string', 'max:190'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'uuid'],
            'items.*.variant_id' => ['nullable', 'uuid'],
            'items.*.modifier_option_ids' => ['sometimes', 'array'],
            'items.*.modifier_option_ids.*' => ['uuid', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
