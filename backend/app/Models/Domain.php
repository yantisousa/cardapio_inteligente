<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Domain extends Model
{
    protected $guarded = [];
    protected $casts = ['is_primary' => 'boolean', 'verified_at' => 'datetime'];
    public function tenant() { return $this->belongsTo(Tenant::class); }
}
