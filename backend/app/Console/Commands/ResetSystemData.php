<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class ResetSystemData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sistema:reset {--base : Dejar creados los 3 proyectos base vacíos y cuentas de asesores}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Formatea todas las tablas a cero reiniciando IDs a 1 para puesta en producción limpia';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->warn("=======================================================================");
        $this->warn("  FORMATEO Y REINICIO A CERO DEL SISTEMA INMOBILIARIO VENDE & MÁS");
        $this->warn("=======================================================================");

        $isBase = $this->option('base');

        $this->info("1/4. Purgando archivos generados de recibos y contratos en storage...");
        $receiptsDir = storage_path('app/public/receipts');
        $contractsDir = storage_path('app/public/contracts');

        if (File::exists($receiptsDir)) {
            File::cleanDirectory($receiptsDir);
        }
        if (File::exists($contractsDir)) {
            File::cleanDirectory($contractsDir);
        }

        $this->info("2/4. Ejecutando TRUNCATE TABLE con RESTART IDENTITY CASCADE en PostgreSQL...");
        DB::statement('TRUNCATE TABLE audit_logs, payments, lot_documents, leads, topography_jobs, lots, customers, projects RESTART IDENTITY CASCADE;');

        $this->info("3/4. Asegurando roles y usuario Super Admin...");
        $roleAdmin = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
        $roleAsesor = Role::firstOrCreate(['name' => 'Asesor Comercial', 'guard_name' => 'web']);

        $admin = User::updateOrCreate(
            ['email' => 'admin@vendeymas.com'],
            [
                'name' => 'Administrador General',
                'password' => Hash::make('admin123'),
                'role' => 'Super Admin',
            ]
        );
        $admin->syncRoles([$roleAdmin]);

        // Si se solicitó la opción --base, crear los 3 proyectos vacíos y 3 cuentas de asesores
        if ($isBase) {
            $this->info("4/4. [Modo --base activo] Creando los 3 proyectos iniciales vacíos y las cuentas de asesores...");

            // 3 Cuentas de Asesores
            $asesor1 = User::updateOrCreate(
                ['email' => 'asesor1@vendeymas.com'],
                [
                    'name' => 'Carlos Mendoza - Asesor 1',
                    'password' => Hash::make('asesor123'),
                    'role' => 'Asesor Comercial',
                ]
            );
            $asesor1->syncRoles([$roleAsesor]);

            $asesor2 = User::updateOrCreate(
                ['email' => 'asesor2@vendeymas.com'],
                [
                    'name' => 'Diana Palacios - Asesor 2',
                    'password' => Hash::make('asesor123'),
                    'role' => 'Asesor Comercial',
                ]
            );
            $asesor2->syncRoles([$roleAsesor]);

            $asesor3 = User::updateOrCreate(
                ['email' => 'asesor3@vendeymas.com'],
                [
                    'name' => 'Andrés Zambrano - Asesor 3',
                    'password' => Hash::make('asesor123'),
                    'role' => 'Asesor Comercial',
                ]
            );
            $asesor3->syncRoles([$roleAsesor]);

            // 3 Proyectos Iniciales Vacíos
            Project::create([
                'name' => 'Bosque Urbano',
                'location' => 'Vía Principal - Sucúa',
                'status' => 'Activo',
                'center_lat' => -2.4540000,
                'center_lng' => -78.1720000,
                'latitude' => -2.4540000,
                'longitude' => -78.1720000,
            ]);

            Project::create([
                'name' => 'Guapuca',
                'location' => 'Sector Norte - Sucúa',
                'status' => 'Activo',
                'center_lat' => -2.4480000,
                'center_lng' => -78.1680000,
                'latitude' => -2.4480000,
                'longitude' => -78.1680000,
            ]);

            Project::create([
                'name' => 'Valle Verde',
                'location' => 'Sector Sur - Sucúa',
                'status' => 'Activo',
                'center_lat' => -2.4620000,
                'center_lng' => -78.1760000,
                'latitude' => -2.4620000,
                'longitude' => -78.1760000,
            ]);
        } else {
            $this->info("4/4. Formateo limpio absoluto completado (sin asesores ni proyectos residuales).");
        }

        // Registrar acción en logs
        AuditLog::create([
            'user_id' => $admin->id,
            'module' => 'Sistema & Mantenimiento',
            'action' => $isBase
                ? 'Reinicio a cero del sistema con estructura base (3 proyectos y 3 asesores)'
                : 'Reinicio total a cero del sistema para producción (TRUNCATE completo)',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Artisan CLI / Console System Command',
        ]);

        $this->newLine();
        $this->info("=======================================================================");
        $this->info("  ¡EL SISTEMA HA SIDO REINICIADO A CERO EXITOSAMENTE PARA PRODUCCIÓN!");
        $this->info("=======================================================================");
        $this->info("Usuario Super Admin disponible:");
        $this->info("  Email: admin@vendeymas.com | Contraseña: admin123");
        if ($isBase) {
            $this->info("Estructura base disponible:");
            $this->info("  - 3 Proyectos listos: Bosque Urbano, Guapuca, Valle Verde");
            $this->info("  - 3 Asesores listos: asesor1, asesor2, asesor3 (clave: asesor123)");
        }
        $this->newLine();

        return Command::SUCCESS;
    }
}
