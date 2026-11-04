<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['Super Admin', 'Administrador', 'Asesor Comercial', 'Topógrafo'] as $roleName) {
            Role::firstOrCreate([
                'name' => $roleName,
                'guard_name' => 'web',
            ]);
        }

        $superAdminRole = Role::where('name', 'Super Admin')->where('guard_name', 'web')->firstOrFail();
        $ceo = User::firstOrNew(['email' => 'ceo@vendeymas.com']);

        if (! $ceo->exists) {
            $password = config('seed.ceo_password');
            if (! is_string($password) || $password === '') {
                throw new RuntimeException('Define SEED_CEO_PASSWORD antes de crear la cuenta inicial.');
            }

            $ceo->name = 'Nicky Mingo';
            $ceo->password = Hash::make($password);
            $ceo->save();
        }

        $ceo->syncRoles([$superAdminRole]);
    }
}
