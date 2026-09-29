<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean', 'is_sold_out' => 'boolean', 'availability' => 'array'];

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function modifierGroups()
    {
        return $this->hasMany(ModifierGroup::class)->orderBy('position');
    }
}
