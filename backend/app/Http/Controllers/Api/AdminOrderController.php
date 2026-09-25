<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminOrderController extends Controller
{
    private const TRANSITIONS = [
        'pending' => ['accepted', 'cancelled'],
        'accepted' => ['preparing', 'cancelled'],
        'preparing' => ['ready', 'cancelled'],
        'ready' => ['out_for_delivery', 'completed'],
        'out_for_delivery' => ['completed'],
        'completed' => [],
        'cancelled' => [],
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

    public function update(Request $request, string $order): JsonResponse
    {
        $order = Order::query()->findOrFail($order);
        $data = $request->validate(['status' => ['required', 'string']]);
        $allowed = self::TRANSITIONS[$order->status] ?? [];

        if (! in_array($data['status'], $allowed, true)) {
            throw ValidationException::withMessages(['status' => "Transição de {$order->status} para {$data['status']} não permitida."]);
        }

        DB::transaction(function () use ($order, $data, $request) {
            $from = $order->status;
            $order->update(['status' => $data['status']]);
            $order->events()->create([
                'type' => 'status_changed',
                'from_status' => $from,
                'to_status' => $data['status'],
                'actor_id' => $request->user()->id,
            ]);
        });

        return response()->json(['order' => $order->fresh('items.modifiers', 'events')]);
    }
}
