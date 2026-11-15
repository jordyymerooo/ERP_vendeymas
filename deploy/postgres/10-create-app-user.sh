#!/bin/sh
(
set -eu

: "${POSTGRES_USER:?Falta POSTGRES_USER}"
: "${APP_DB_NAME:?Falta APP_DB_NAME}"
: "${APP_DB_USER:?Falta APP_DB_USER}"
: "${APP_DB_PASSWORD:?Falta APP_DB_PASSWORD}"

if [ "$APP_DB_USER" = "$POSTGRES_USER" ] || [ "${#APP_DB_PASSWORD}" -lt 20 ]; then
    echo "Configura un usuario de aplicación independiente y una contraseña de al menos 20 caracteres." >&2
    exit 1
fi

# psql receives credentials from the container environment, never in its command line.
psql --no-psqlrc --username "$POSTGRES_USER" --dbname postgres --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_database APP_DB_NAME
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD

SELECT :'app_database' ~ '^[a-z][a-z0-9_]{0,62}$'
   AND :'app_database' NOT IN ('postgres', 'template0', 'template1')
   AND :'app_user' ~ '^[a-z][a-z0-9_]{0,62}$'
   AND :'app_user' !~ '^pg_'
   AS names_valid \gset
\if :names_valid
\else
    \echo Nombres de base o usuario inválidos.
    DO $$ BEGIN RAISE EXCEPTION 'Identificadores de aplicación inválidos'; END $$;
\endif

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'app_user' AND rolcanlogin
        AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
) AS role_valid \gset
\if :role_valid
\else
    DO $$ BEGIN RAISE EXCEPTION 'La cuenta de aplicación existente tiene privilegios incompatibles'; END $$;
\endif

SELECT format('CREATE DATABASE %I OWNER %I', :'app_database', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_database')
\gexec

SELECT EXISTS (
    SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba
    WHERE d.datname = :'app_database' AND r.rolname = :'app_user'
) AS owner_valid \gset
\if :owner_valid
\else
    DO $$ BEGIN RAISE EXCEPTION 'La base existente tiene otro propietario'; END $$;
\endif

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app_database')
\gexec
SQL
)
