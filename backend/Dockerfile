# syntax=docker/dockerfile:1
FROM composer:2 AS composer

FROM php:8.4-fpm-trixie AS php-runtime
WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-dejavu-core gosu libfcgi-bin postgresql-client-17 tzdata \
        libfreetype6 libicu76 libjpeg62-turbo libpng16-16t64 libpq5 libwebp7 libzip5 \
        libfreetype-dev libicu-dev libjpeg62-turbo-dev libpng-dev libpq-dev libwebp-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" gd intl opcache pcntl pdo_pgsql zip \
    && apt-get purge -y --auto-remove \
        libfreetype-dev libicu-dev libjpeg62-turbo-dev libpng-dev libpq-dev libwebp-dev libzip-dev \
    && rm -rf /var/lib/apt/lists/* \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

FROM php-runtime AS build

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --no-scripts --no-autoloader

COPY artisan ./
COPY app app
COPY bootstrap bootstrap
COPY config config
COPY database database
COPY public public
COPY resources resources
COPY routes routes
RUN mkdir -p bootstrap/cache \
    && composer dump-autoload --no-dev --optimize --no-interaction --no-scripts \
    && composer check-platform-reqs --no-dev

FROM php-runtime AS app

COPY --from=build /var/www/html /var/www/html
COPY docker/php.ini /usr/local/etc/php/conf.d/production.ini
COPY docker/fpm.conf /usr/local/etc/php-fpm.d/zz-inmobiliaria.conf
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/inmobiliaria-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/inmobiliaria-entrypoint \
    && chown root:root /var/www/html \
    && chmod 0755 /var/www/html \
    && install -d -m 0755 -o www-data -g www-data storage storage/app storage/app/public \
    && install -d -m 0770 -o www-data -g www-data \
        bootstrap/cache storage/app/private storage/app/public/recibos storage/app/backup-temp \
        storage/framework storage/framework/cache storage/framework/cache/data \
        storage/framework/sessions storage/framework/views storage/logs \
    && gosu www-data php artisan package:discover --no-interaction

EXPOSE 9000
ENTRYPOINT ["inmobiliaria-entrypoint"]
CMD ["php-fpm"]
