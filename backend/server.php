<?php

// Keep the public storage link from serving signed receipts through artisan serve.
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');
$resolved = realpath(getcwd().$uri);
$storage = realpath(__DIR__.'/storage/app/public');

if ($resolved !== false && $storage !== false) {
    foreach (['recibos', 'receipts'] as $directory) {
        $prefix = $storage.DIRECTORY_SEPARATOR.$directory.DIRECTORY_SEPARATOR;
        if (strncasecmp($resolved, $prefix, strlen($prefix)) === 0) {
            http_response_code(403);
            return true;
        }
    }
}

return require __DIR__.'/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php';
