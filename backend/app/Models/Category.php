<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = [];
    protected $casts = ['active' => 'boolean'];
    public function products() { return $this->hasMany(Product::class)->orderBy('name'); }
}
