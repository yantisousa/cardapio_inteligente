<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ModifierOption extends Model
{
    use BelongsToTenant, HasUuids;
    protected $guarded = [];
    protected $casts = ['active' => 'boolean'];
    public function group() { return $this->belongsTo(ModifierGroup::class, 'modifier_group_id'); }
}
