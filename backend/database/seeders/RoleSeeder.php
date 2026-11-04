<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Limpiar caché de roles y permisos
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Asegurar la existencia de los 4 roles oficiales del sistema
        $superAdminRole = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
        $adminRole      = Role::firstOrCreate(['name' => 'Administrador', 'guard_name' => 'web']);
        $asesorRole     = Role::firstOrCreate(['name' => 'Asesor Comercial', 'guard_name' => 'web']);
        $topoRole       = Role::firstOrCreate(['name' => 'Topógrafo', 'guard_name' => 'web']);

        // 2. Asignar rol 'Super Admin' al usuario principal (CEO / Gerente)
        $superAdminUser = User::updateOrCreate(
            ['email' => 'admin@vendeymas.com'],
            [
                'name' => 'Roberto Andrade - CEO / Gerente',
                'phone' => '0989996421',
                'password' => Hash::make('admin123'),
            ]
        );
        $superAdminUser->syncRoles([$superAdminRole]);

        // 3. Crear los 2 usuarios con rol 'Administrador'
        $admin1 = User::updateOrCreate(
            ['email' => 'administrador1@vendeymas.com'],
            [
                'name' => 'Lic. Valeria Gómez - Administradora',
                'password' => Hash::make('admin123'),
            ]
        );
        $admin1->syncRoles([$adminRole]);

        $admin2 = User::updateOrCreate(
            ['email' => 'administrador2@vendeymas.com'],
            [
                'name' => 'Abg. Mateo Silva - Administrador',
                'password' => Hash::make('admin123'),
            ]
        );
        $admin2->syncRoles([$adminRole]);

        // 4. Crear 1 usuario con rol 'Topógrafo'
        $topografo = User::updateOrCreate(
            ['email' => 'topografo@vendeymas.com'],
            [
                'name' => 'Ing. Fernando Castro - Topógrafo',
                'password' => Hash::make('topo123'),
            ]
        );
        $topografo->syncRoles([$topoRole]);
    }
}
