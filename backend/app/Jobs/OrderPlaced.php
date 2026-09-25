<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class OrderPlaced implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $tenantId, public string $orderId) {}

    public function handle(): void
    {
        Log::info('Pedido disponível para notificações e integrações.', [
            'tenant_id' => $this->tenantId,
            'order_id' => $this->orderId,
        ]);
    }
}
