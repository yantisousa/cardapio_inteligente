# Contexto de build: raiz do repositório (ver docker-compose.prod.yml)

# --- Dependências PHP (sem pacotes de desenvolvimento) ---
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs
COPY backend/ ./
RUN composer dump-autoload --no-dev --optimize --no-scripts --ignore-platform-reqs

# --- Imagem de execução ---
FROM php:8.4-fpm-alpine

COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_pgsql pgsql bcmath intl zip opcache pcntl redis

COPY docker/backend/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html
COPY --from=vendor /app ./

RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]
