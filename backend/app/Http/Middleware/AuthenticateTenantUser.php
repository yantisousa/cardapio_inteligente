<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateTenantUser
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $token = $request->bearerToken();
        $user = $token ? User::where('api_token_hash', hash('sha256', $token))->first() : null;

        abort_unless($user, 401, 'Não autenticado.');

        $membership = DB::table('tenant_users')
            ->where('tenant_id', app(TenantContext::class)->id())
            ->where('user_id', $user->id)
            ->first();

        abort_unless($membership, 403, 'Usuário sem acesso a esta loja.');
        abort_if($roles && ! in_array($membership->role, $roles, true), 403, 'Papel sem permissão para esta ação.');

        $request->setUserResolver(fn () => $user);
        $request->attributes->set('tenant_role', $membership->role);

        return $next($request);
    }
}
