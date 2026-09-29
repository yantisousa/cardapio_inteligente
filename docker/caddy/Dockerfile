# Contexto de build: raiz do repositório (ver docker-compose.prod.yml)

# --- Build do React ---
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Caddy: HTTPS, estáticos do React e ponte para o php-fpm ---
FROM caddy:2-alpine
COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
# O Caddy precisa enxergar public/ no mesmo caminho do php-fpm para resolver o index.php
COPY backend/public /var/www/html/public
COPY --from=frontend /app/dist /srv/frontend
