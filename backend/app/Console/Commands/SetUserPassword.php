<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Redefine a senha (e opcionalmente o e-mail) de um usuário. Use com o serviço "artisan" (usuário dono do banco).
 */
class SetUserPassword extends Command
{
    protected $signature = 'user:set-password
        {email : E-mail atual do usuário}
        {password : Nova senha (mínimo 6 caracteres)}
        {--new-email= : Troca também o e-mail de login}';

    protected $description = 'Redefine a senha de um usuário (e opcionalmente o e-mail)';

    public function handle(): int
    {
        $user = User::query()->where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error('Usuário não encontrado.');

            return self::FAILURE;
        }

        if (strlen($this->argument('password')) < 6) {
            $this->error('A senha precisa ter ao menos 6 caracteres.');

            return self::FAILURE;
        }

        $newEmail = $this->option('new-email');
        if ($newEmail && User::query()->where('email', $newEmail)->whereKeyNot($user->getKey())->exists()) {
            $this->error('Já existe outro usuário com esse e-mail.');

            return self::FAILURE;
        }

        $user->password = $this->argument('password');
        if ($newEmail) {
            $user->email = $newEmail;
        }
        $user->save();

        $this->info("Atualizado. Login: {$user->email}");

        return self::SUCCESS;
    }
}
