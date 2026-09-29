<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = [];

    protected $casts = ['customer_snapshot' => 'array', 'delivery_address_snapshot' => 'array', 'placed_at' => 'datetime', 'scheduled_for' => 'datetime'];

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function events()
    {
        return $this->hasMany(OrderEvent::class)->orderBy('created_at');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
