<?php

namespace App\Tenancy;

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use LogicException;

class TenantContext
{
    private ?Tenant $tenant = null;

    public function set(Tenant $tenant): void
    {
        $this->tenant = $tenant;

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("select set_config('app.current_tenant', ?, false)", [$tenant->getKey()]);
        }
    }

    public function clear(): void
    {
        if ($this->tenant && DB::getDriverName() === 'pgsql') {
            DB::statement("select set_config('app.current_tenant', '', false)");
        }

        $this->tenant = null;
    }

    public function tenant(): Tenant
    {
        return $this->tenant ?? throw new LogicException('Nenhum tenant foi resolvido para esta operação.');
    }

    public function id(): string
    {
        return (string) $this->tenant()->getKey();
    }

    public function check(): bool
    {
        return $this->tenant !== null;
    }
}
