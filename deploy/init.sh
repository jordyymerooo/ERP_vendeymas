#!/bin/sh
set -eu

. "$(dirname "$0")/lib.sh"
require_application_db

case "$#" in
    0) require_empty_application_db ;;
    1)
        if [ "$1" != --allow-existing ]; then
            echo "Uso: init.sh [--allow-existing]" >&2
            exit 2
        fi
        ;;
    *) echo "Uso: init.sh [--allow-existing]" >&2; exit 2 ;;
esac

cd "$APP_PATH"
exec php artisan migrate --force --no-interaction
