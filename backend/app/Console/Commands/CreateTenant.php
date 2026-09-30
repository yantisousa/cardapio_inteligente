<?php

namespace App\Console\Commands;

use App\Models\Domain;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Cria uma loja (tenant) com domínio e usuário proprietário, sem dados de demonstração.
 * Em produção, use no lugar de `db:seed`, que cria a loja demo com senha conhecida.
 */
class CreateTenant extends Command
{
    protected $signature = 'tenant:create
        {name : Nome da loja}
        {host : Domínio da loja, ex.: triunfomenu.com.br}
        {email : E-mail do proprietário}
        {--owner-name= : Nome do proprietário (padrão: nome da loja)}
        {--slug= : Slug da loja (padrão: gerado a partir do nome)}
        {--plan=basic : Slug do plano}
        {--password= : Senha do proprietário (se omitida, uma senha é gerada e exibida uma vez)}';

    protected $description = 'Cria uma loja com domínio e proprietário, sem dados de demonstração';

    public function handle(TenantContext $context): int
    {
        $host = strtolower(trim((string) $this->argument('host')));
        $email = strtolower(trim((string) $this->argument('email')));
        $name = (string) $this->argument('name');
        $slug = $this->option('slug') ?: Str::slug($name);

        $plan = Plan::query()->where('slug', $this->option('plan'))->first();
        if (! $plan) {
            $this->error("Plano '{$this->option('plan')}' não encontrado. Rode as migrations antes.");

            return self::FAILURE;
        }

        if (Domain::withoutGlobalScopes()->where('host', $host)->exists()) {
            $this->error("O domínio {$host} já está cadastrado.");

            return self::FAILURE;
        }

        if (Tenant::query()->where('slug', $slug)->exists()) {
            $this->error("Já existe uma loja com o slug '{$slug}'. Use --slug.");

            return self::FAILURE;
        }

        $password = $this->option('password');
        $generated = false;
        if (! $password) {
            $password = Str::password(20, symbols: false);
            $generated = true;
        }

        $userExisted = false;

        DB::transaction(function () use ($context, $plan, $name, $slug, $host, $email, $password, &$userExisted) {
            $tenant = Tenant::create(['plan_id' => $plan->id, 'name' => $name, 'slug' => $slug, 'status' => 'active']);
            Domain::create(['tenant_id' => $tenant->id, 'host' => $host, 'is_primary' => true, 'verified_at' => now()]);

            $context->set($tenant);

            TenantSetting::create([
                'store_name' => $name,
                'banner_url' => 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1100&q=90',
                'storefront_content' => [
                    'hero_badge' => 'Estamos abertos',
                    'hero_title' => 'Comida que abraça a',
                    'hero_highlight' => 'mesa.',
                    'hero_note' => 'feito com afeto ↗',
                    'menu_title' => 'Escolha seu momento favorito',
                    'story_eyebrow' => 'Nossa cozinha',
                    'story_title' => 'Tem coisas que só o tempo sabe fazer.',
                    'story_text' => 'Receitas cuidadosas, ingredientes selecionados e uma história que pertence a cada loja.',
                    'story_since' => 'feito com carinho',
                ],
            ]);

            $user = User::query()->where('email', $email)->first();
            $userExisted = $user !== null;
            $user ??= User::create(['name' => $this->option('owner-name') ?: $name, 'email' => $email, 'password' => $password]);

            DB::table('tenant_users')->insert([
                'tenant_id' => $tenant->id,
                'user_id' => $user->id,
                'role' => 'owner',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $context->clear();
        });

        $this->info("Loja '{$name}' criada em {$host}.");
        $this->line("Painel: https://{$host}/admin");
        $this->line("Login: {$email}");
        if ($userExisted) {
            $this->line('Usuário já existia: a senha atual foi mantida e ele agora também é proprietário desta loja.');
        } elseif ($generated) {
            $this->warn("Senha gerada (não será exibida de novo): {$password}");
        }

        return self::SUCCESS;
    }
}
