<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ModifierGroup extends Model
{
    use BelongsToTenant, HasUuids;
    protected $guarded = [];
    public function options() { return $this->hasMany(ModifierOption::class); }
}
