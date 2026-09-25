<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminAuthController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', $credentials['email'])->first();

        abort_unless($user && Hash::check($credentials['password'], $user->password), 422, 'Credenciais inválidas.');

        $membership = DB::table('tenant_users')
            ->where('tenant_id', app(TenantContext::class)->id())
            ->where('user_id', $user->id)
            ->first();
        abort_unless($membership, 403, 'Usuário sem acesso a esta loja.');

        $token = Str::random(60);
        $user->forceFill(['api_token_hash' => hash('sha256', $token)])->save();

        return response()->json(['token' => $token, 'user' => $user->only('id', 'name', 'email'), 'role' => $membership->role]);
    }
}
