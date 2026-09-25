<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class OrderEvent extends Model
{
    use BelongsToTenant;
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = ['payload' => 'array', 'created_at' => 'datetime'];
}
