#!/bin/sh

APP_PATH=/var/www/html

require_application_db() {
    if [ "${DB_CONNECTION:-}" != pgsql ] || [ "${DB_HOST:-}" != db ] || [ -n "${DB_URL:-}" ]; then
        echo "Ejecuta este comando en el servicio app de Docker Compose, conectado al servicio db." >&2
        exit 1
    fi
    : "${DB_DATABASE:?Falta DB_DATABASE}"
    : "${DB_USERNAME:?Falta DB_USERNAME}"
    : "${DB_PASSWORD:?Falta DB_PASSWORD}"
    export PGHOST="$DB_HOST" PGPORT="${DB_PORT:-5432}" PGDATABASE="$DB_DATABASE"
    export PGUSER="$DB_USERNAME" PGPASSWORD="$DB_PASSWORD" PGCONNECT_TIMEOUT=10
}

require_empty_application_db() {
    result=$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align <<'SQL'
SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
      AND n.nspname NOT LIKE 'pg_temp_%'
) OR EXISTS (
    SELECT 1 FROM pg_namespace
    WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema')
      AND nspname NOT LIKE 'pg_toast%'
      AND nspname NOT LIKE 'pg_temp_%'
) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
) OR EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
);
SQL
    )
    if [ "$result" != f ]; then
        echo "La base de destino contiene objetos. Se requiere una base vacía." >&2
        exit 1
    fi
}
