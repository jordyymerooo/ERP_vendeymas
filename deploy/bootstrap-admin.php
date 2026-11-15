<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

if ($argc !== 3 || getenv('DB_CONNECTION') !== 'pgsql' || getenv('DB_HOST') !== 'db' || getenv('DB_URL')) {
    fwrite(STDERR, "Uso en el servicio app: php /opt/erp/bootstrap-admin.php 'Nombre' correo@empresa.test < contraseña\n");
    exit(2);
}

$name = trim($argv[1]);
$email = strtolower(trim($argv[2]));
$password = rtrim((string) stream_get_contents(STDIN), "\r\n");

if ($name === '' || mb_strlen($name) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL) ||
    strlen($password) < 16 || strlen($password) > 72 || str_contains($password, "\0")) {
    fwrite(STDERR, "Indica un nombre, un correo válido y una contraseña de 16 a 72 bytes.\n");
    exit(2);
}

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$created = DB::transaction(function () use ($name, $email, $password) {
    DB::statement('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    if (User::query()->exists()) {
        return false;
    }

    foreach (['Super Admin', 'Administrador', 'Asesor Comercial', 'Topógrafo'] as $role) {
        Role::findOrCreate($role, 'web');
    }

    User::create([
        'name' => $name,
        'email' => $email,
        'password' => Hash::make($password),
    ])->assignRole('Super Admin');

    return true;
});

if (!$created) {
    fwrite(STDERR, "Ya existen usuarios. La inicialización de la cuenta se canceló.\n");
    exit(1);
}

$app->make(PermissionRegistrar::class)->forgetCachedPermissions();
fwrite(STDOUT, "Cuenta inicial creada.\n");
