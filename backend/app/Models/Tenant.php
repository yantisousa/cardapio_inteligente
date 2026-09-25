<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function settings() { return $this->hasOne(TenantSetting::class); }
    public function domains() { return $this->hasMany(Domain::class); }
}
