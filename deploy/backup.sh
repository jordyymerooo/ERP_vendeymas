#!/bin/sh
set -eu
umask 077

. "$(dirname "$0")/lib.sh"
require_application_db

if [ "$#" -ne 0 ]; then
    echo "Uso: backup.sh" >&2
    exit 2
fi

destination="$APP_PATH/storage/app/private/docker-backups"
if [ -n "$(find "$APP_PATH/storage/app/public" -mindepth 1 ! -type f ! -type d -print -quit)" ]; then
    echo "El directorio de archivos contiene enlaces o entradas especiales que no pueden restaurarse." >&2
    exit 1
fi
mkdir -p "$destination"
work=$(mktemp -d "$destination/.backup.XXXXXXXX")
cleanup() {
    if [ -d "$work" ]; then
        rm -rf -- "$work"
    fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

pg_dump --format=custom --no-owner --no-privileges --file="$work/database.dump"
tar -C "$APP_PATH/storage/app" -czf "$work/public-files.tar.gz" public
(
    cd "$work"
    sha256sum -- database.dump public-files.tar.gz > SHA256SUMS
)

bundle="$destination/$(date -u +%Y%m%dT%H%M%SZ)-${work##*.}"
mv -T -- "$work" "$bundle"
printf '%s\n' "$bundle"
