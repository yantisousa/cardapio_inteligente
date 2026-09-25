# Triunfo Menu

MVP multitenant de cardápio e pedidos para restaurantes. O projeto fica isolado do ERP existente neste repositório.

## Stack e estrutura

- `frontend/`: React 19 + Vite, com loja, carrinho, checkout como visitante e painel administrativo responsivo.
- `backend/`: Laravel 12, API REST, cálculo seguro do checkout, autenticação simples da equipe e fila após commit.
- PostgreSQL compartilhado com `tenant_id`, escopo Eloquent e Row Level Security com `FORCE ROW LEVEL SECURITY`.
- Redis para cache e processamento assíncrono.
- `docker-compose.yml`: PostgreSQL 17 e Redis 7 para desenvolvimento.

## Rodando localmente

```bash
docker compose up -d

cd backend
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve

# em outro terminal
php artisan queue:work redis

# em outro terminal
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`. O Vite encaminha `/api` para o Laravel em `127.0.0.1:8000`. As portas podem ser alteradas com `npm run dev -- --port 5181` e `php artisan serve --port=8011`; nessa instalação, esses serviços estão disponíveis em `http://127.0.0.1:5181` e `http://127.0.0.1:8011`. Em desenvolvimento, a interface envia `X-Tenant-Host: demo.localhost`; esse cabeçalho é ignorado fora dos ambientes `local` e `testing`.

O frontend possui dados de demonstração e continua navegável se a API estiver desligada. Após `migrate --seed`, passa a consumir o catálogo real. O painel está em `http://localhost:5173/admin` (ou `http://127.0.0.1:5181/admin` nesta instalação). Nele, proprietários e gerentes podem criar categorias, produtos, variações e adicionais, além de alterar identidade visual, entrega, retirada, Pix e endereço da loja.

Usuário de demonstração da API administrativa:

```text
admin@demo.test
password
```

## Endpoints principais

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/storefront` | Identidade da loja e cardápio ativo |
| `POST` | `/api/orders` | Checkout; exige `Idempotency-Key` |
| `GET` | `/api/orders/{public_id}` | Acompanhamento público do pedido |
| `POST` | `/api/admin/login` | Token da equipe no tenant atual |
| `GET` | `/api/admin/orders` | Fila de pedidos autenticada |
| `PATCH` | `/api/admin/orders/{id}` | Transição validada de status |
| `GET` | `/api/admin/menu` | Cardápio completo para administração |
| `POST/PATCH/DELETE` | `/api/admin/categories/{id?}` | Gestão de categorias |
| `POST/PUT/DELETE` | `/api/admin/products/{id?}` | Gestão de produtos, variações e adicionais |
| `GET/PUT` | `/api/admin/settings` | Identidade e operação da loja |
| `POST` | `/api/admin/settings/assets` | Upload de logo ou banner em JPG, PNG ou WebP |
| `GET` | `/api/media/{tenant}/{arquivo}` | Entrega pública das imagens enviadas |

## Isolamento e segurança

O domínio é resolvido antes de qualquer dado operacional. O cliente nunca envia `tenant_id`. Models operacionais recebem um escopo global, e o PostgreSQL repete a proteção com políticas RLS baseadas em `app.current_tenant`.

`domains` não usa RLS porque é a tabela pública de resolução inicial; ela não é exposta pela API. Em produção, use usuários PostgreSQL separados para migrações e aplicação, e não conceda `BYPASSRLS` ao usuário da aplicação.

O checkout bloqueia o tenant durante a numeração, relê produtos, variações e adicionais, recalcula todos os valores, grava snapshots e só despacha o job `OrderPlaced` depois do commit. Repetir a mesma chave de idempotência devolve o pedido original.

## Validação

```bash
cd backend && php artisan test
cd frontend && npm run build
```
