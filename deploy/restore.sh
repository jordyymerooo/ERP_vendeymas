#!/bin/sh
set -eu
umask 077

. "$(dirname "$0")/lib.sh"
require_application_db

if [ "$#" -ne 2 ] || [ "${1:-}" != --confirm-empty ]; then
    echo "Uso: restore.sh --confirm-empty /ruta/al/respaldo" >&2
    exit 2
fi

bundle=$(realpath "$2")
(
    cd "$bundle"
    sha256sum -- database.dump public-files.tar.gz | cmp - SHA256SUMS
)
require_empty_application_db

public="$APP_PATH/storage/app/public"
if [ -L "$public" ] || [ ! -d "$public" ] || [ -n "$(find "$public" -mindepth 1 ! -type d -print -quit)" ]; then
    echo "El destino de archivos debe ser un directorio sin archivos de usuario." >&2
    exit 1
fi

work=$(mktemp -d "$APP_PATH/storage/app/.docker-restore.XXXXXXXX")
cleanup() {
    if [ -d "$work/original" ]; then
        # Restore the previously empty directory if PostgreSQL rolled back.
        if [ "${restored:-no}" != yes ]; then
            if [ -d "$public" ]; then
                mv -T -- "$public" "$work/failed-public" || return 1
            fi
            mv -T -- "$work/original" "$public" || return 1
        fi
    fi
    rm -rf -- "$work"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

archive="$bundle/public-files.tar.gz"
tar -tzf "$archive" > "$work/paths"
tar -tvzf "$archive" > "$work/types"
if ! awk '! /^public(\/|$)/ || /(^|\/)\.\.(\/|$)/ {exit 1}' "$work/paths" ||
   ! awk 'substr($0, 1, 1) !~ /^[-d]$/ {exit 1}' "$work/types"; then
    echo "El respaldo contiene rutas o tipos de archivo no admitidos." >&2
    exit 1
fi

mkdir "$work/new"
tar --no-same-owner --same-permissions -xzf "$archive" -C "$work/new"
test -d "$work/new/public"
mv -T -- "$public" "$work/original"
mv -T -- "$work/new/public" "$public"

pg_restore --single-transaction --exit-on-error --no-owner --no-privileges \
    --dbname="$PGDATABASE" "$bundle/database.dump"
restored=yes
echo "Base de datos y archivos públicos del ERP restaurados."
