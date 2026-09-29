# Deploy na VPS (Ubuntu + Docker)

Tudo roda em containers: Postgres 17, Redis 7, Laravel (php-fpm), worker de fila e o Caddy,
que entrega o React buildado, encaminha `/api` ao Laravel e cuida do HTTPS automaticamente.

Comandos abaixo: use `dc` como atalho (opcional):

```bash
alias dc='docker compose -f docker-compose.prod.yml'
```

## 1. DNS e firewall

- No provedor do domínio, crie registros **A** de `triunfomenu.com.br` e `www.triunfomenu.com.br`
  apontando para o IP da VPS. O HTTPS só é emitido depois que o DNS propagar.
- Libere apenas SSH, HTTP e HTTPS. Postgres e Redis **não** publicam portas no compose de produção.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443 && sudo ufw enable
```

## 2. Docker na VPS

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # saia e entre de novo no SSH
```

## 3. Código e variáveis

```bash
git clone <URL-DO-REPOSITORIO> triunfo-menu && cd triunfo-menu
nano .env
```

Conteúdo do `.env` (na raiz do repositório, na VPS; ele já está no `.gitignore`, nunca commite):

```dotenv
DOMAIN=triunfomenu.com.br
ACME_EMAIL=seu-email@exemplo.com

APP_KEY=
POSTGRES_DB=triunfo_menu

# Dono do banco (superusuário): usado só por migrations e comandos administrativos
POSTGRES_OWNER_USER=triunfo_owner
POSTGRES_OWNER_PASSWORD=

# Papel da aplicação (sem superusuário, sem BYPASSRLS), com senha diferente da do dono
APP_DB_USER=triunfo_app
APP_DB_PASSWORD=

REDIS_PASSWORD=
```

Gere os valores em branco assim e cole no arquivo:

```bash
echo "APP_KEY=base64:$(openssl rand -base64 32)"
echo "POSTGRES_OWNER_PASSWORD=$(openssl rand -hex 24)"
echo "APP_DB_PASSWORD=$(openssl rand -hex 24)"
echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
```

Use senhas **diferentes** para o dono do banco e para a aplicação. Guarde a `APP_KEY`: sem ela os
dados criptografados não podem ser lidos depois.

## 4. Subir

```bash
dc up -d --build
dc ps
```

Na primeira subida, o Postgres cria o papel restrito da aplicação (`docker/postgres/init`). Isso
acontece **uma vez**, ao criar o volume. Se o volume já existir de tentativas anteriores, apague-o
(`dc down -v`, o que apaga os dados) para o script rodar.

## 5. Banco e primeira loja

As migrations rodam com o usuário dono (o serviço `artisan`). **Não use `--seed`**: o seeder cria a
loja demo com `admin@demo.test` / `password`.

```bash
dc run --rm artisan migrate --force
dc run --rm artisan tenant:create "Nome da Loja" triunfomenu.com.br dono@exemplo.com
```

O comando mostra a senha gerada uma única vez. O painel fica em `https://triunfomenu.com.br/admin`.

A loja é resolvida pelo **domínio da requisição**: o host cadastrado em `domains` precisa ser igual ao
domínio acessado. A página comercial em `/triunfo-menu` não depende de loja.

## 6. Conferir

```bash
curl -I https://triunfomenu.com.br/
curl -s https://triunfomenu.com.br/api/storefront | head -c 300
dc logs -f app worker web
```

Confirme também que o RLS está valendo para a aplicação:

```bash
dc exec postgres sh -c 'psql -U "$APP_DB_USER" -d "$POSTGRES_DB" -c "select count(*) from orders"'
# deve retornar 0 (sem tenant definido, o RLS esconde todas as linhas)
```

## 7. Atualizar depois

```bash
git pull
dc up -d --build
dc run --rm artisan migrate --force
```

O worker é recriado no `up` e passa a usar o código novo.

## 8. Backup

```bash
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > backup-$(date +%F).sql.gz
```

As imagens enviadas pelas lojas ficam no volume `app_storage`; inclua-o no backup da VPS.

## Novas lojas em outros domínios

Cada loja precisa de um domínio próprio em `domains` (`tenant:create ... <dominio>`), do DNS
apontando para a VPS e de HTTPS. Para um subdomínio ou domínio novo, adicione o host ao
`docker/caddy/Caddyfile` (ou configure TLS sob demanda do Caddy). Certificado curinga
(`*.triunfomenu.com.br`) exige desafio DNS do seu provedor.
