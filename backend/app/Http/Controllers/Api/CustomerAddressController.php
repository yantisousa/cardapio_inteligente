<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CustomerAddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:32'],
        ]);

        $phone = PhoneNumber::normalize($validated['phone']);

        if (strlen($phone) < 10 || strlen($phone) > 11) {
            throw ValidationException::withMessages([
                'phone' => 'Informe um telefone válido com DDD.',
            ]);
        }

        $customer = Customer::query()
            ->with(['addresses' => fn ($query) => $query->latest('updated_at')])
            ->where('phone', $phone)
            ->first();

        return response()->json([
            'customer' => $customer?->only('name'),
            'addresses' => $customer
                ? $customer->addresses->map(fn ($address) => $address->only([
                    'id', 'label', 'street', 'number', 'complement', 'neighborhood',
                    'city', 'state', 'postal_code', 'reference',
                ]))->values()
                : [],
        ]);
    }
}
