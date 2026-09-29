<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class TenantSetting extends Model
{
    use BelongsToTenant;

    protected $primaryKey = 'tenant_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = [
        'address' => 'array',
        'business_hours' => 'array',
        'storefront_content' => 'array',
        'storefront_design' => 'array',
        'delivery_zones' => 'array',
        'accepts_delivery' => 'boolean',
        'accepts_pickup' => 'boolean',
        'is_paused' => 'boolean',
        'enforce_business_hours' => 'boolean',
    ];
}
