#!/bin/bash
# Roda uma única vez, na criação do volume do Postgres.
#
# POSTGRES_USER é superusuário e ignora o Row Level Security. Por isso a aplicação
# NÃO pode conectar com ele: ela usa este papel, sem SUPERUSER e sem BYPASSRLS,
# e o RLS por tenant passa a valer de verdade. As migrations rodam com o dono.

psql -v ON_ERROR_STOP=1 -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
EOSQL
