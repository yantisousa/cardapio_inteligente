<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminOrderController extends Controller
{
    private const STATUSES = [
        'pending',
        'accepted',
        'preparing',
        'ready',
        'out_for_delivery',
        'completed',
        'cancelled',
    ];

    private const PAYMENT_STATUSES = [
        'pending',
        'paid',
        'failed',
        'expired',
    ];

    public function index(Request $request): JsonResponse
    {
        $orders = Order::with('items.modifiers')
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->latest('placed_at')
            ->limit(100)
            ->get();

        return response()->json(['orders' => $orders]);
    }

    public function show(string $order): JsonResponse
    {
        $order = Order::query()
            ->with(['items.modifiers', 'payments', 'events'])
            ->findOrFail($order);

        return response()->json(['order' => $order]);
    }

    public function update(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(self::STATUSES)],
        ]);

        $order = DB::transaction(function () use ($order, $data, $request) {
            $model = Order::query()->lockForUpdate()->findOrFail($order);

            if ($model->payment_method === 'pix'
                && $model->payment_status !== 'paid'
                && in_array($data['status'], ['preparing', 'ready', 'out_for_delivery', 'completed'], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Confirme o pagamento Pix antes de iniciar a produção.',
                ]);
            }

            if ($model->status !== $data['status']) {
                $from = $model->status;
                $model->update(['status' => $data['status']]);
                $model->events()->create([
                    'type' => 'status_changed',
                    'from_status' => $from,
                    'to_status' => $data['status'],
                    'actor_id' => $request->user()->id,
                ]);
            }

            return $model;
        });

        return response()->json(['order' => $order->fresh('items.modifiers', 'payments', 'events')]);
    }

    public function updatePayment(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(self::PAYMENT_STATUSES)],
        ]);

        $order = DB::transaction(function () use ($order, $data, $request) {
            $model = Order::query()->lockForUpdate()->findOrFail($order);

            if ($model->payment_status !== $data['status']) {
                $from = $model->payment_status;
                $model->update(['payment_status' => $data['status']]);

                $payment = $model->payments()->lockForUpdate()->latest()->first();
                if ($payment) {
                    $payment->update([
                        'status' => $data['status'],
                        'paid_at' => $data['status'] === 'paid' ? ($payment->paid_at ?? now()) : null,
                    ]);
                }

                $model->events()->create([
                    'type' => 'payment_status_changed',
                    'from_status' => $from,
                    'to_status' => $data['status'],
                    'actor_id' => $request->user()->id,
                    'payload' => ['payment_method' => $model->payment_method],
                ]);
            }

            return $model;
        });

        return response()->json(['order' => $order->fresh('items.modifiers', 'payments', 'events')]);
    }
}
