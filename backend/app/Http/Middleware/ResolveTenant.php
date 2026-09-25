<?php

namespace App\Http\Middleware;

use App\Models\Domain;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $host = $request->getHost();

        if (app()->environment(['local', 'testing']) && $request->hasHeader('X-Tenant-Host')) {
            $host = $request->header('X-Tenant-Host');
        }

        $host = strtolower(rtrim(explode(':', (string) $host)[0], '.'));
        $domain = Domain::withoutGlobalScopes()->with('tenant')->where('host', $host)->first();

        abort_unless($domain?->tenant?->status === 'active', 404, 'Loja não encontrada ou inativa.');

        $context = app(TenantContext::class);
        $context->set($domain->tenant);
        $request->attributes->set('tenant', $domain->tenant);

        try {
            return $next($request);
        } finally {
            $context->clear();
        }
    }
}
