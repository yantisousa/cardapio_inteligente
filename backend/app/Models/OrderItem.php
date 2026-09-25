<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use BelongsToTenant, HasUuids;
    protected $guarded = [];
    public function modifiers() { return $this->hasMany(OrderItemModifier::class); }
}
