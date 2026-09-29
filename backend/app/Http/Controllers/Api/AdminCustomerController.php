<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminCustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search'));
        $customers = Customer::query()
            ->withCount('orders')
            ->withSum('orders', 'total_cents')
            ->withMax('orders', 'placed_at')
            ->when($search !== '', function ($query) use ($search): void {
                $term = '%'.mb_strtolower($search).'%';
                $phone = preg_replace('/\D+/', '', $search) ?? '';
                $query->where(function ($query) use ($term, $phone): void {
                    $query->whereRaw('LOWER(name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(COALESCE(email, \'\')) LIKE ?', [$term]);
                    if ($phone !== '') {
                        $query->orWhere('phone', 'like', '%'.$phone.'%');
                    }
                });
            })
            ->latest('updated_at')
            ->limit(100)
            ->get();

        return response()->json(['customers' => $customers]);
    }

    public function show(string $customer): JsonResponse
    {
        $customer = Customer::query()
            ->with([
                'addresses' => fn ($query) => $query->latest('updated_at'),
                'orders' => fn ($query) => $query->with('items')->latest('placed_at')->limit(30),
            ])
            ->withCount('orders')
            ->withSum('orders', 'total_cents')
            ->findOrFail($customer);

        return response()->json(['customer' => $customer]);
    }

    public function update(Request $request, string $customer): JsonResponse
    {
        $customer = Customer::query()->findOrFail($customer);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:190'],
        ]);

        $data['phone'] = PhoneNumber::normalize($data['phone']);
        if (strlen($data['phone']) < 10 || strlen($data['phone']) > 11) {
            throw ValidationException::withMessages(['phone' => 'Informe um telefone válido com DDD.']);
        }

        $phoneInUse = Customer::query()
            ->where('phone', $data['phone'])
            ->whereKeyNot($customer->id)
            ->exists();
        if ($phoneInUse) {
            throw ValidationException::withMessages(['phone' => 'Este telefone já pertence a outro cliente.']);
        }

        $customer->update($data);

        return $this->show($customer->id);
    }

    public function destroyAddress(string $customer, string $address): JsonResponse
    {
        Customer::query()->findOrFail($customer);
        CustomerAddress::query()
            ->where('customer_id', $customer)
            ->findOrFail($address)
            ->delete();

        return response()->json(status: 204);
    }
}
