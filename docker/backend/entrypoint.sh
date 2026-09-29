#!/bin/sh
set -e

cd /var/www/html

# Só o php-fpm prepara o cache do Laravel; o worker e o artisan rodam direto.
if [ "$1" = "php-fpm" ]; then
    if [ -z "$APP_KEY" ]; then
        echo "APP_KEY não definida. Gere uma e coloque no .env da raiz." >&2
        exit 1
    fi

    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan event:cache

    chown -R www-data:www-data storage bootstrap/cache
fi

exec "$@"
