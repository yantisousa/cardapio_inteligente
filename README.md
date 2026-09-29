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

O frontend consome exclusivamente o tenant resolvido pela API; se ela estiver indisponível, exibe um erro claro em vez de misturar dados de demonstração com a loja real. Após `migrate --seed`, o painel está em `http://localhost:5173/admin` (ou `http://127.0.0.1:5181/admin` nesta instalação). Nele, proprietários e gerentes podem criar categorias, produtos, variações e adicionais, além de alterar identidade visual, conteúdo da vitrine, entrega, retirada, Pix e endereço da loja.

Cada loja é resolvida pelo domínio cadastrado em `domains`. Em desenvolvimento, selecione um tenant sem alterar o arquivo hosts usando `http://127.0.0.1:5181/?tenant=demo.localhost`; os links entre vitrine e painel preservam essa seleção. As sessões administrativas do navegador também são isoladas por domínio.

Usuário de demonstração da API administrativa:

```text
admin@demo.test
password
```

## Site comercial da Triunfo Menu

A página comercial está em `http://127.0.0.1:5173/triunfo-menu` (use a porta do Vite em execução). A vitrine da loja em `/` e o painel em `/admin` continuam independentes.

- Plano anunciado: **Basic — R$ 149,90/mês**.
- Botões de contratação: WhatsApp **(85) 98990-7530**, com mensagem preenchida; não enviam mensagens automaticamente.
- Prévia interativa com abas de pedidos, cardápio e personalização de cores. Os dados são ilustrativos e não criam pedidos reais.
- Página e estilos em `frontend/src/TriunfoMenu.jsx` e `frontend/src/TriunfoMenu.css`; logo oficial original em `frontend/public/triunfo-menu-logo.png`, preservada sem alteração. O viewport SVG no componente compartilhado `TriunfoLogo` enquadra a imagem sem as margens transparentes. Ícone compacto em `frontend/public/triunfo-mark.svg`.
- Identidade visual: azul-marinho `#142735`, dourado `#D2A861` e destaque `#B8863D`, extraídos da logo oficial. O site comercial, os ícones de marca e o painel usam essa identidade, sem modificar as logos e cores configuradas nas vitrines das lojas.
- Componentes compartilhados de marca em `frontend/src/TriunfoBrand.jsx`; login e identidade do admin em `frontend/src/AdminBrand.css`. O favicon global e os estados de carregamento usam o símbolo da Triunfo Menu. Ícones funcionais mantêm seus significados (pedido, pagamento, excluir, etc.).
- A oferta comercial não altera preços de assinaturas no banco nem implementa cobrança automática. A contratação acontece com a equipe pelo WhatsApp.

Em produção, configure o servidor do frontend para entregar `index.html` nas rotas da SPA, incluindo `/triunfo-menu`.

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

Dentro de `frontend/`, execute `node scripts/check-branding.mjs` para verificar a marca compartilhada, o favicon e a renderização do login e do painel autenticado. Essa verificação é offline: não faz login nem altera dados ou sessões do navegador.

```bash
cd backend && php artisan test
cd frontend && npm run build
```
