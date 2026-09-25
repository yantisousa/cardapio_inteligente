<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Models\Order;
use App\Services\CheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function store(CheckoutRequest $request, CheckoutService $checkout): JsonResponse
    {
        $key = (string) $request->header('Idempotency-Key');
        abort_unless(strlen($key) >= 8 && strlen($key) <= 100, 422, 'Idempotency-Key deve ter entre 8 e 100 caracteres.');

        $result = $checkout->create($request->validated(), $key);

        return response()->json($result, $result['replayed'] ? 200 : 201);
    }

    public function show(Request $request, string $publicId): JsonResponse
    {
        $order = Order::with('items.modifiers', 'events')->where('public_id', $publicId)->firstOrFail();
        return response()->json(['order' => $order]);
    }
}
