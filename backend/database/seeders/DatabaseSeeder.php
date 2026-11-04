<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Lot;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database con datos estrictamente reales y válidos.
     */
    public function run(): void
    {
        // 1. Roles y Permisos Spatie
        $this->call(RoleSeeder::class);

        // 2. Usuarios del Sistema
        $admin = User::firstOrCreate(
            ['email' => 'admin@vendeymas.com'],
            [
                'name' => 'Administrador',
                'password' => Hash::make('admin123'),
            ]
        );
        $admin->assignRole('Super Admin');

        $asesor = User::firstOrCreate(
            ['email' => 'carlos@vendeymas.com'],
            [
                'name' => 'Carlos Asesor',
                'password' => Hash::make('asesor123'),
            ]
        );
        $asesor->assignRole('Asesor Comercial');

        // 3. Los 3 Proyectos Reales
        $bosqueUrbano = Project::firstOrCreate(
            ['name' => 'Bosque Urbano'],
            ['location' => 'Vía Principal', 'status' => 'Activo']
        );

        $guapuca = Project::firstOrCreate(
            ['name' => 'Guapuca'],
            ['location' => 'Sector Norte', 'status' => 'En Desarrollo']
        );

        $valleVerde = Project::firstOrCreate(
            ['name' => 'Valle Verde'],
            ['location' => 'Sector Sur', 'status' => 'En Desarrollo']
        );

        // 4. Clientes Reales Iniciales
        $jordi = Customer::firstOrCreate(
            ['id_card' => '0928374651'],
            [
                'name' => 'Jordi Mero',
                'email' => 'jordi@email.com',
                'phone' => '0991234567',
            ]
        );

        $nicky = Customer::firstOrCreate(
            ['id_card' => '1314987654'],
            [
                'name' => 'Nicky M.',
                'email' => 'nicky@email.com',
                'phone' => '0987654321',
            ]
        );

        // 5. Inicializar Lotes si aún no existen
        if (Lot::count() === 0) {
            Lot::create([
                'project_id' => $bosqueUrbano->id,
                'customer_id' => $jordi->id,
                'lot_number' => 'Lote 5',
                'area_m2' => 250.00,
                'total_price' => 30000.00,
                'status' => 'Vendido',
            ]);

            Lot::create([
                'project_id' => $bosqueUrbano->id,
                'customer_id' => $jordi->id,
                'lot_number' => 'Lote 6',
                'area_m2' => 250.00,
                'total_price' => 30000.00,
                'status' => 'Vendido',
            ]);

            for ($i = 1; $i <= 10; $i++) {
                if ($i !== 5 && $i !== 6) {
                    Lot::create([
                        'project_id' => $bosqueUrbano->id,
                        'customer_id' => null,
                        'lot_number' => 'Lote ' . $i,
                        'area_m2' => 200.00,
                        'total_price' => 25000.00,
                        'status' => 'Disponible',
                    ]);
                }
            }

            Lot::create([
                'project_id' => $guapuca->id,
                'customer_id' => $nicky->id,
                'lot_number' => 'Lote 14',
                'area_m2' => 220.00,
                'total_price' => 35000.00,
                'status' => 'Vendido',
            ]);

            for ($i = 1; $i <= 9; $i++) {
                Lot::create([
                    'project_id' => $guapuca->id,
                    'customer_id' => null,
                    'lot_number' => 'Lote ' . $i,
                    'area_m2' => 190.00,
                    'total_price' => 24000.00,
                    'status' => 'Disponible',
                ]);
            }

            for ($i = 1; $i <= 10; $i++) {
                Lot::create([
                    'project_id' => $valleVerde->id,
                    'customer_id' => null,
                    'lot_number' => 'Lote ' . $i,
                    'area_m2' => 210.00,
                    'total_price' => 28000.00,
                    'status' => 'Disponible',
                ]);
            }
        }

        // 6. Simulación de Logs de Auditoría (3 Registros iniciales de actividad)
        AuditLog::record(
            $admin->id,
            'Autenticación',
            'Inicio de sesión exitoso al panel administrativo',
            '192.168.100.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
        );

        AuditLog::record(
            $asesor->id,
            'Cobros',
            'Emitió recibo oficial REC-0000001 por cuota mensual $250.00 USD',
            '190.152.12.88',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
        );

        AuditLog::record(
            $asesor->id,
            'Clientes',
            'Actualización y validación de expediente de cliente: Jordi Mero',
            '190.152.12.88',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        );
    }
}

