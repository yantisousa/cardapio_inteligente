<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use BelongsToTenant, HasUuids;
    protected $guarded = [];
    protected $casts = ['metadata' => 'array', 'paid_at' => 'datetime'];
}
