#!/bin/sh
set -eu

# Private files created by Artisan and PHP should only be accessible to the app user.
umask 027

if [ "$(id -u)" -eq 0 ]; then
    install -d -m 0755 -o www-data -g www-data storage storage/app storage/app/public
    install -d -m 0770 -o www-data -g www-data \
        bootstrap/cache storage/app/private storage/framework storage/framework/cache storage/framework/cache/data \
        storage/framework/sessions storage/framework/views storage/logs
    # The FPM master owns stderr and switches the request workers to www-data.
    if [ "${1:-}" = php-fpm ]; then
        exec "$@"
    fi
    exec gosu www-data "$@"
fi

exec "$@"
