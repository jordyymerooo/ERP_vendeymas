<?php

namespace App\Console\Commands;

use App\Models\AdminTask;
use App\Models\AppNotification;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Deed;
use App\Models\Lead;
use App\Models\Lot;
use App\Models\Payment;
use App\Models\Project;
use App\Models\TopographyJob;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class SimulateSystemData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sistema:simular';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Simula volumen operativo masivo con 4 roles, 4 reciberas independientes, tareas CEO y 12 etapas de escrituras';

    /**
     * Firma digital en Base64 ligera y realista (PNG transparente)
     */
    private string $signatureBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAABaCAYAAABj1QzWAAAACXBIWXMAAA7EAAAOxAGVKw4bAAADx0lEQVR4nO3dTU4bQRiG4Zc4CSvIElbgBFyDk3CSrICdOMlKkISdKAsgygrIAnbgJCs4AZeAE1iBFTgBiU+w0o9m6pnuntfvfZ9kaT2dqv6Yrq6urt4QAAAAAAAAAODQfsx+AQAA/n2G7A8AeJp1/w8z+1k3Y68d2bL9rD/f+/t3e9/ev9t7s/a6+v3t+hO3626+H833b+t/2V7btZ+/rP21m9m1z2bt9bvrn9/svd79v5z18/b+3q6/Xv+0e3+19vvZ/91m9+0/P5q114ft3t/s/V/Wvt++f7P2147W/tqxmb0/tvbH+v1q9n7b7r4fe/ff58fO833k5z6z99v349Hcf37s/Zrt+9P3/9Dq/bf7z+fHzr/Xfv68/tzb82/r327Xn999f/v+7fvT9//Q6v23+8/nx86/137+vP7c2/Nv699u15/ffX/7/u370/f/0Or9t/vP58fOv9d+/rz+3Nvzb+vfbtef331/+/7t+9P3/9Dq/bf7z+fHzr/Xfv68/tzb82/r327Xn999f/v+7fvT9//Q6v23+8/nx86/137+vP7c2/Nv699u15/ffX/7/u370/f/0Or9t/vP58fOv9d+/rz+3Nvzb+vfbtef331/+/7t+9P3/9Dq/bf7z+fHzr/Xfv68/tzb82/r327X';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info("=======================================================================");
        $this->info("  SIMULACIÓN OPERATIVA ESCALADA - 4 ROLES, 4 RECIBERAS Y 12 ETAPAS");
        $this->info("=======================================================================");

        $startTime = microtime(true);

        DB::transaction(function () {
            // 1. Limpieza de tablas previas reiniciando IDs
            $this->info("1/9. Limpiando datos previos con TRUNCATE en cascada...");
            DB::statement('TRUNCATE TABLE app_notifications, audit_logs, payments, lot_documents, leads, topography_jobs, admin_tasks, deeds, project_user, lots, customers, projects RESTART IDENTITY CASCADE;');

            // Limpiar usuarios antiguos obsoletos (conservando solo las cuentas oficiales)
            User::whereNotIn('email', [
                'admin@vendeymas.com',
                'administrador1@vendeymas.com',
                'administrador2@vendeymas.com',
                'asesor1@vendeymas.com',
                'asesor2@vendeymas.com',
                'asesor3@vendeymas.com',
                'topografo@vendeymas.com',
            ])->delete();

            // 2. Roles y Usuarios (4 Roles Oficiales)
            $this->info("2/9. Configurando los 4 roles oficiales de Spatie y usuarios...");
            $roleSuperAdmin = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
            $roleAdmin      = Role::firstOrCreate(['name' => 'Administrador', 'guard_name' => 'web']);
            $roleAsesor     = Role::firstOrCreate(['name' => 'Asesor Comercial', 'guard_name' => 'web']);
            $roleTopografo  = Role::firstOrCreate(['name' => 'Topógrafo', 'guard_name' => 'web']);

            // 1 Super Admin (CEO / Gerente)
            $superAdmin = User::updateOrCreate(
                ['email' => 'admin@vendeymas.com'],
                [
                    'name' => 'Roberto Andrade - CEO / Gerente',
                    'password' => Hash::make('admin123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $superAdmin->syncRoles([$roleSuperAdmin]);

            // 2 Administradores (Área Administrativa)
            $adminArea1 = User::updateOrCreate(
                ['email' => 'administrador1@vendeymas.com'],
                [
                    'name' => 'Lic. Valeria Gómez - Administradora',
                    'password' => Hash::make('admin123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $adminArea1->syncRoles([$roleAdmin]);

            $adminArea2 = User::updateOrCreate(
                ['email' => 'administrador2@vendeymas.com'],
                [
                    'name' => 'Abg. Mateo Silva - Administrador',
                    'password' => Hash::make('admin123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $adminArea2->syncRoles([$roleAdmin]);

            // 3 Asesores Comerciales (Ventas)
            $asesor1 = User::updateOrCreate(
                ['email' => 'asesor1@vendeymas.com'],
                [
                    'name' => 'Carlos Mendoza - Asesor 1',
                    'password' => Hash::make('asesor123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $asesor1->syncRoles([$roleAsesor]);

            $asesor2 = User::updateOrCreate(
                ['email' => 'asesor2@vendeymas.com'],
                [
                    'name' => 'Diana Palacios - Asesor 2',
                    'password' => Hash::make('asesor123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $asesor2->syncRoles([$roleAsesor]);

            $asesor3 = User::updateOrCreate(
                ['email' => 'asesor3@vendeymas.com'],
                [
                    'name' => 'Andrés Zambrano - Asesor 3',
                    'password' => Hash::make('asesor123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $asesor3->syncRoles([$roleAsesor]);

            // 1 Topógrafo (Área de Topografía)
            $topografo = User::updateOrCreate(
                ['email' => 'topografo@vendeymas.com'],
                [
                    'name' => 'Ing. Fernando Castro - Topógrafo',
                    'password' => Hash::make('topo123'),
                    'signature_base64' => $this->signatureBase64,
                ]
            );
            $topografo->syncRoles([$roleTopografo]);

            $advisors = [$asesor1, $asesor2, $asesor3];

            // 3. 6 Proyectos Inmobiliarios y Asignación a Administradores (project_user)
            $this->info("3/9. Creando 6 proyectos en Sucúa y asignándolos a los administradores...");

            $projectsConfig = [
                ['name' => 'Bosque Urbano', 'location' => 'Vía Principal - Sucúa', 'lots_count' => 24, 'lat' => -2.4540, 'lng' => -78.1720, 'base_price' => 100.0],
                ['name' => 'Guapuca', 'location' => 'Sector Norte - Sucúa', 'lots_count' => 20, 'lat' => -2.4480, 'lng' => -78.1680, 'base_price' => 95.0],
                ['name' => 'Valle Verde', 'location' => 'Sector Sur - Sucúa', 'lots_count' => 20, 'lat' => -2.4620, 'lng' => -78.1760, 'base_price' => 85.0],
                ['name' => 'Mirador del Upano', 'location' => 'Vía Macas - Sucúa', 'lots_count' => 22, 'lat' => -2.4420, 'lng' => -78.1650, 'base_price' => 110.0],
                ['name' => 'La Asunción', 'location' => 'Sector Este - Sucúa', 'lots_count' => 18, 'lat' => -2.4560, 'lng' => -78.1620, 'base_price' => 90.0],
                ['name' => 'Portal del Edén', 'location' => 'Entrada a Sucúa', 'lots_count' => 16, 'lat' => -2.4680, 'lng' => -78.1790, 'base_price' => 105.0],
            ];

            $allProjects = [];
            foreach ($projectsConfig as $idx => $pCfg) {
                $proj = Project::create([
                    'name' => $pCfg['name'],
                    'location' => $pCfg['location'],
                    'status' => 'En Venta',
                    'center_lat' => $pCfg['lat'],
                    'center_lng' => $pCfg['lng'],
                    'latitude' => $pCfg['lat'],
                    'longitude' => $pCfg['lng'],
                    'blueprint_image_url' => '/logos/logo-transparent.png',
                ]);
                $allProjects[] = $proj;
            }

            // Asignación de Proyectos a Administradores (project_user)
            // Lic. Valeria Gómez (Admin 1) gestiona Bosque Urbano y Guapuca (Proyectos 0 y 1)
            $adminArea1->assignedProjects()->sync([$allProjects[0]->id, $allProjects[1]->id]);
            // Abg. Mateo Silva (Admin 2) gestiona Valle Verde y Mirador del Upano (Proyectos 2 y 3)
            $adminArea2->assignedProjects()->sync([$allProjects[2]->id, $allProjects[3]->id]);

            // 4. Lotes (120 en total)
            $this->info("4/9. Creando 120 lotes con polígonos GeoJSON...");
            $allLots = [];
            foreach ($allProjects as $pIndex => $proj) {
                $count = $projectsConfig[$pIndex]['lots_count'];
                $baseLat = $projectsConfig[$pIndex]['lat'];
                $baseLng = $projectsConfig[$pIndex]['lng'];
                $basePricePerM2 = $projectsConfig[$pIndex]['base_price'];

                for ($num = 1; $num <= $count; $num++) {
                    $row = (int) ceil($num / 6);
                    $col = ($num - 1) % 6;
                    $latOffset = ($row - 1) * 0.00035;
                    $lngOffset = $col * 0.00045;

                    $cLat = $baseLat + $latOffset;
                    $cLng = $baseLng + $lngOffset;

                    $p1 = [$cLng, $cLat];
                    $p2 = [$cLng + 0.00040, $cLat];
                    $p3 = [$cLng + 0.00040, $cLat + 0.00030];
                    $p4 = [$cLng, $cLat + 0.00030];

                    $geojson = [
                        'type' => 'Feature',
                        'geometry' => [
                            'type' => 'Polygon',
                            'coordinates' => [[$p1, $p2, $p3, $p4, $p1]],
                        ],
                        'properties' => [
                            'lot_number' => "Lote {$num}",
                            'project_name' => $proj->name,
                        ],
                    ];

                    $areaM2 = rand(200, 350);
                    $totalPrice = round($areaM2 * $basePricePerM2, 2);

                    $lot = Lot::create([
                        'project_id' => $proj->id,
                        'lot_number' => "Lote {$num}",
                        'area_m2' => $areaM2,
                        'total_price' => $totalPrice,
                        'status' => 'Disponible',
                        'installments_count' => 24,
                        'payment_day' => 15,
                        'coordinates_geojson' => $geojson,
                    ]);
                    $allLots[] = $lot;
                }
            }

            // 5. Clientes y Asignación de Lotes
            $this->info("5/9. Creando 100 clientes y asignando 80 lotes vendidos...");
            $nombres = [
                'Juan', 'Carlos', 'María', 'José', 'Luis', 'Ana', 'Pedro', 'Rosa', 'Jorge', 'Elena',
                'Manuel', 'Carmen', 'David', 'Patricia', 'Daniel', 'Silvia', 'Ángel', 'Teresa', 'Miguel', 'Lucía',
                'Fernando', 'Gloria', 'Diego', 'Martha', 'Gabriel', 'Nancy', 'Raúl', 'Beatriz', 'Javier', 'Mercedes'
            ];
            $apellidos = [
                'García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
                'Castro', 'Morales', 'Rivadeneira', 'Ortiz', 'Gutiérrez', 'Chávez', 'Ramos', 'Mendoza', 'Vargas', 'Castillo',
                'Jiménez', 'Moreno', 'Romero', 'Herrera', 'Medina', 'Aguilar', 'Vega', 'Guzmán', 'Palacios', 'Cárdenas'
            ];

            $allCustomers = [];
            for ($i = 1; $i <= 100; $i++) {
                $nom = $nombres[($i - 1) % count($nombres)];
                $ape1 = $apellidos[($i - 1) % count($apellidos)];
                $ape2 = $apellidos[$i % count($apellidos)];
                $fullName = "{$nom} {$ape1} {$ape2}";
                $assignedAdvisor = $advisors[($i - 1) % count($advisors)];

                $cedula = '14' . str_pad(1000000 + $i * 73, 8, '0', STR_PAD_LEFT);

                $customer = Customer::create([
                    'name' => $fullName,
                    'email' => strtolower("cliente{$i}.{$nom}@gmail.com"),
                    'phone' => '098' . str_pad(1234560 + $i * 17, 7, '0', STR_PAD_LEFT),
                    'id_card' => $cedula,
                    'assigned_user_id' => $assignedAdvisor->id,
                ]);
                $allCustomers[] = $customer;
            }

            // Asignar los primeros 80 lotes a clientes
            $soldLots = [];
            for ($k = 0; $k < 80; $k++) {
                $lot = $allLots[$k];
                $cust = $allCustomers[$k];
                $saleDate = Carbon::now()->subMonths(rand(3, 18))->setDay(rand(1, 28));

                $lot->update([
                    'customer_id' => $cust->id,
                    'status' => 'Vendido',
                    'installments_count' => rand(0, 1) ? 24 : 36,
                    'sale_date' => $saleDate,
                    'payment_day' => 15,
                ]);
                $soldLots[] = $lot;
            }

            // 6. Tareas del CEO para Administradores (admin_tasks)
            $this->info("6/9. Creando 10 tareas del CEO asignadas a las Administradoras...");
            $sampleTasks = [
                ['title' => 'Revisión catastral y desmembración en Municipio', 'desc' => 'Ingresar carpetas técnicas para aprobación de linderos en el GAD Municipal de Sucúa.', 'proj_idx' => 0, 'admin' => $adminArea1, 'priority' => 'Alta', 'days' => 2, 'status' => 'En Curso'],
                ['title' => 'Coordinación de minutas con Notaría Segunda', 'desc' => 'Entregar matrices de escrituración y copias de cédulas para protocolización.', 'proj_idx' => 1, 'admin' => $adminArea1, 'priority' => 'Media', 'days' => 4, 'status' => 'Pendiente'],
                ['title' => 'Liquidación de alcabalas de Bosque Urbano', 'desc' => 'Gestionar la exoneración o pago de alcabalas para 8 clientes en mora de escrituras.', 'proj_idx' => 0, 'admin' => $adminArea1, 'priority' => 'Alta', 'days' => -1, 'status' => 'Completada'],
                ['title' => 'Inspección de mojones con Topógrafo', 'desc' => 'Acompañar al Ing. Fernando Castro en el replanteo perimetral del Mirador del Upano.', 'proj_idx' => 3, 'admin' => $adminArea2, 'priority' => 'Alta', 'days' => 3, 'status' => 'En Curso'],
                ['title' => 'Inscripciones en Registro de la Propiedad', 'desc' => 'Retirar razones de inscripción de las sentencias del proyecto Mirador del Upano.', 'proj_idx' => 3, 'admin' => $adminArea2, 'priority' => 'Alta', 'days' => 6, 'status' => 'Pendiente'],
                ['title' => 'Auditoría de expedientes legales de Valle Verde', 'desc' => 'Verificar que todos los contratos de compraventa tengan anexados los recibos contables.', 'proj_idx' => 2, 'admin' => $adminArea2, 'priority' => 'Baja', 'days' => -3, 'status' => 'Completada'],
                ['title' => 'Cierre contable mensual y arqueo de caja', 'desc' => 'Consolidar los cobros de administración con las conciliaciones bancarias.', 'proj_idx' => 1, 'admin' => $adminArea1, 'priority' => 'Media', 'days' => 1, 'status' => 'Pendiente'],
                ['title' => 'Recepción de planos definitivos para Portal del Edén', 'desc' => 'Firmar acta de entrega-recepción de planos topográficos aprobados.', 'proj_idx' => 1, 'admin' => $adminArea1, 'priority' => 'Media', 'days' => 5, 'status' => 'Pendiente'],
                ['title' => 'Notificación de citaciones a colindantes', 'desc' => 'Coordinar con la secretaría judicial la citación en prensa para el juicio de prescripción.', 'proj_idx' => 3, 'admin' => $adminArea2, 'priority' => 'Alta', 'days' => 2, 'status' => 'En Curso'],
                ['title' => 'Archivo digital de escrituras registradas', 'desc' => 'Escanear y respaldar en el servidor las escrituras con sellos del Registro.', 'proj_idx' => 2, 'admin' => $adminArea2, 'priority' => 'Baja', 'days' => -2, 'status' => 'Completada'],
            ];

            foreach ($sampleTasks as $st) {
                AdminTask::create([
                    'title' => $st['title'],
                    'description' => $st['desc'],
                    'project_id' => $allProjects[$st['proj_idx']]->id,
                    'assigned_to' => $st['admin']->id,
                    'assigned_by' => $superAdmin->id,
                    'priority' => $st['priority'],
                    'due_date' => Carbon::now()->addDays($st['days']),
                    'status' => $st['status'],
                ]);
            }

            // 7. Pipeline Legal de Escrituras en las 12 Etapas Oficiales (deeds)
            $this->info("7/9. Creando 24 trámites de escrituración distribuidos en las 12 etapas oficiales...");
            $stages12 = Deed::STAGES;

            for ($d = 0; $d < 24; $d++) {
                $targetLot = $soldLots[$d];
                $targetCustomer = $targetLot->customer;
                $targetProject = $targetLot->project;

                // Asignar al administrador encargado de ese proyecto
                $adminAssigned = $targetProject->administrators()->first() ?? ($d % 2 === 0 ? $adminArea1 : $adminArea2);
                $stageIndex = $d % count($stages12);
                $stageName = $stages12[$stageIndex];

                $budget = rand(12, 35) * 100; // $1,200 a $3,500

                Deed::create([
                    'customer_id' => $targetCustomer->id,
                    'lot_id' => $targetLot->id,
                    'project_id' => $targetProject->id,
                    'assigned_admin_id' => $adminAssigned->id,
                    'stage' => $stageName,
                    'total_budget' => $budget,
                    'notes' => "Expediente de escrituración tramitado bajo seguimiento del área legal (Etapa actual: {$stageName}).",
                ]);
            }

            // 8. 15 Trabajos Topográficos
            $this->info("8/9. Creando 15 trabajos topográficos asignados al Topógrafo...");
            $topographyServices = [
                'Levantamiento Planimétrico con Estación Total',
                'Replanteo de Linderos y Mojonamiento',
                'Subdivisión y Desmembración de Predios',
                'Nivelación Topográfica y Curvas de Nivel',
                'Georreferenciación GPS Diferencial RTK',
            ];
            $topoStatuses = ['Pendiente', 'En Campo', 'En Planos (AutoCAD)', 'Entregado'];

            $allTopoJobs = [];
            for ($t = 1; $t <= 15; $t++) {
                $tProj = $allProjects[$t % count($allProjects)];
                $cost = rand(15, 45) * 20; // $300 a $900
                $status = $topoStatuses[$t % count($topoStatuses)];
                $paid = ($status === 'Entregado') ? $cost : (($status === 'En Campo') ? round($cost / 2, 2) : 0);

                $job = TopographyJob::create([
                    'client_name' => "Ing. {$nombres[$t]} {$apellidos[$t]}",
                    'client_phone' => '098' . str_pad(8881000 + $t * 23, 7, '0', STR_PAD_LEFT),
                    'service_type' => $topographyServices[$t % count($topographyServices)],
                    'location' => "Sector {$tProj->name} - Sucúa",
                    'area_m2' => rand(250, 1500),
                    'cost' => $cost,
                    'amount_paid' => $paid,
                    'status' => $status,
                    'notes' => "Trabajo topográfico profesional coordinado para {$tProj->name}.",
                    'created_at' => Carbon::now()->subDays($t * 3),
                ]);
                $allTopoJobs[] = $job;
            }

            // 9. Pagos y Recibos en las 4 Reciberas Independientes
            $this->info("9/9. Generando pagos en las 4 reciberas independientes (GERENCIA, ADMINISTRACION, ASESORIA, TOPOGRAFIA)...");

            // Recibera A: ASESORIA (Comercial) -> ~200 recibos correlativos ASE-00001, ASE-00002...
            $aseSeq = 1;
            foreach ($soldLots as $idx => $lot) {
                $paymentsCount = ($idx < 4) ? rand(6, 12) : rand(1, 3);
                $lotPrice = (float) $lot->total_price;
                $cuotaBase = round($lotPrice / $lot->installments_count, 2);
                $currentDebt = $lotPrice;

                for ($p = 1; $p <= $paymentsCount; $p++) {
                    $paidAmount = ($p === 1 && rand(0, 1)) ? round($cuotaBase * 1.5, 2) : $cuotaBase;
                    $currentDebt = max(0, round($currentDebt - $paidAmount, 2));
                    $paymentDate = Carbon::parse($lot->sale_date)->addMonths($p)->setDay(15);
                    $method = ($p % 2 === 0) ? 'Transferencia Bancaria' : 'Efectivo';
                    $issuerAdvisor = $advisors[$idx % count($advisors)];

                    $isVoid = ($idx === 10 && $p === $paymentsCount);
                    $code = 'ASE-' . str_pad($aseSeq, 5, '0', STR_PAD_LEFT);

                    Payment::create([
                        'lot_id' => $lot->id,
                        'user_id' => $issuerAdvisor->id,
                        'receipt_book' => 'ASESORIA',
                        'book_sequence' => $aseSeq,
                        'receipt_code' => $code,
                        'concept_detail' => "Abono a cuota #{$p} de terreno ({$lot->lot_number} - {$lot->project?->name})",
                        'amount_paid' => $paidAmount,
                        'debt_balance' => $currentDebt,
                        'payment_method' => $method,
                        'signature_base64' => $this->signatureBase64,
                        'status' => $isVoid ? 'Anulado' : 'Válido',
                        'void_reason' => $isVoid ? 'Error en digitación de cuenta receptora' : null,
                        'voided_at' => $isVoid ? now() : null,
                        'voided_by' => $isVoid ? $superAdmin->id : null,
                        'created_at' => $paymentDate,
                        'updated_at' => $paymentDate,
                    ]);
                    $aseSeq++;
                }
            }

            // Recibera B: ADMINISTRACION -> 20 recibos correlativos ADM-00001, ADM-00002...
            $admSeq = 1;
            $allDeeds = Deed::all();
            foreach ($allDeeds as $deed) {
                $adminIssuer = $deed->assignedAdmin ?? $adminArea1;
                $abonoTramite = round((float) $deed->total_budget * 0.35, 2);
                $code = 'ADM-' . str_pad($admSeq, 5, '0', STR_PAD_LEFT);

                Payment::create([
                    'lot_id' => $deed->lot_id,
                    'deed_id' => $deed->id,
                    'user_id' => $adminIssuer->id,
                    'receipt_book' => 'ADMINISTRACION',
                    'book_sequence' => $admSeq,
                    'receipt_code' => $code,
                    'concept_detail' => "Abono parcial de Escrituración - Etapa {$deed->stage} ({$deed->project?->name})",
                    'amount_paid' => $abonoTramite,
                    'debt_balance' => max(0, (float) $deed->total_budget - $abonoTramite),
                    'payment_method' => 'Transferencia Bancaria',
                    'signature_base64' => $this->signatureBase64,
                    'status' => 'Válido',
                    'created_at' => Carbon::now()->subDays(rand(2, 30)),
                    'updated_at' => Carbon::now()->subDays(rand(2, 30)),
                ]);
                $admSeq++;
            }

            // Recibera C: GERENCIA -> 10 recibos correlativos GER-00001, GER-00002...
            for ($g = 1; $g <= 10; $g++) {
                $code = 'GER-' . str_pad($g, 5, '0', STR_PAD_LEFT);
                $gCust = $allCustomers[$g % count($allCustomers)];
                $gProj = $allProjects[$g % count($allProjects)];
                $gMonto = rand(20, 60) * 100; // $2,000 a $6,000

                Payment::create([
                    'lot_id' => null,
                    'user_id' => $superAdmin->id,
                    'receipt_book' => 'GERENCIA',
                    'book_sequence' => $g,
                    'receipt_code' => $code,
                    'concept_detail' => "Abono directo de inversión y plusvalía aprobado por Gerencia General ({$gProj->name})",
                    'amount_paid' => $gMonto,
                    'debt_balance' => 0,
                    'payment_method' => 'Cheque de Gerencia',
                    'signature_base64' => $this->signatureBase64,
                    'status' => 'Válido',
                    'created_at' => Carbon::now()->subDays(rand(5, 45)),
                    'updated_at' => Carbon::now()->subDays(rand(5, 45)),
                ]);
            }

            // Recibera D: TOPOGRAFIA -> 12 recibos correlativos TOP-00001, TOP-00002...
            $topSeq = 1;
            foreach ($allTopoJobs as $job) {
                if ($job->amount_paid > 0) {
                    $code = 'TOP-' . str_pad($topSeq, 5, '0', STR_PAD_LEFT);

                    Payment::create([
                        'topography_job_id' => $job->id,
                        'user_id' => $topografo->id,
                        'receipt_book' => 'TOPOGRAFIA',
                        'book_sequence' => $topSeq,
                        'receipt_code' => $code,
                        'concept_detail' => "Pago por servicio: {$job->service_type} ({$job->location})",
                        'amount_paid' => $job->amount_paid,
                        'debt_balance' => (float) $job->pending_balance,
                        'payment_method' => 'Efectivo',
                        'signature_base64' => $this->signatureBase64,
                        'status' => 'Válido',
                        'created_at' => Carbon::now()->subDays(rand(3, 20)),
                        'updated_at' => Carbon::now()->subDays(rand(3, 20)),
                    ]);
                    $topSeq++;
                }
            }

            // 10. Leads Comerciales
            $stages = ['Nuevo Prospecto', 'Visita Agendada', 'En Negociación', 'Cierre Ganado', 'Descartado'];
            for ($l = 1; $l <= 30; $l++) {
                $leadAdvisor = $advisors[$l % count($advisors)];
                $leadProject = $allProjects[$l % count($allProjects)];

                Lead::create([
                    'name' => "{$nombres[$l % count($nombres)]} {$apellidos[$l % count($apellidos)]}",
                    'phone' => '099' . str_pad(7654320 + $l * 13, 7, '0', STR_PAD_LEFT),
                    'email' => strtolower("prospecto{$l}@gmail.com"),
                    'project_id' => $leadProject->id,
                    'user_id' => $leadAdvisor->id,
                    'stage' => $stages[$l % count($stages)],
                    'budget' => rand(18, 42) * 1000,
                    'notes' => "Interés registrado para crédito directo en {$leadProject->name}.",
                    'created_at' => Carbon::now()->subDays($l * 2),
                    'updated_at' => Carbon::now()->subDays($l),
                ]);
            }

            // 11. Auditoría
            for ($a = 1; $a <= 40; $a++) {
                AuditLog::create([
                    'user_id' => ($a % 3 === 0) ? $superAdmin->id : (($a % 3 === 1) ? $adminArea1->id : $asesor1->id),
                    'module' => ($a % 2 === 0) ? 'Recibos & Caja' : 'Escrituras',
                    'action' => "Operación contable/legal registrada en el sistema (#{$a})",
                    'ip_address' => "192.168.1." . (10 + ($a % 20)),
                    'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0',
                    'created_at' => Carbon::now()->subHours($a * 3),
                ]);
            }

            // 12. Notificaciones de Ejemplo en Tiempo Real (Campanita)
            $this->info("Creando notificaciones iniciales para el Centro de Notificaciones...");
            AppNotification::create([
                'target_role' => 'Super Admin',
                'target_user_id' => null,
                'type' => 'payment_created',
                'title' => 'Nuevo Pago Registrado (ADM-00024)',
                'message' => 'Se cobró $350.00 USD a Juan Carlos Morales (Mirador del Valle) por Lic. Valeria Gómez en recibera ADMINISTRACION.',
                'action_url' => '/recibos',
                'is_read' => false,
                'created_at' => Carbon::now()->subMinutes(12),
            ]);

            AppNotification::create([
                'target_role' => 'Super Admin',
                'target_user_id' => null,
                'type' => 'payment_created',
                'title' => 'Nuevo Pago Registrado (ASE-00045)',
                'message' => 'Se cobró $250.00 USD a María Fernanda López (Altos del Paraíso) por Carlos Mendoza en recibera ASESORIA.',
                'action_url' => '/recibos',
                'is_read' => false,
                'created_at' => Carbon::now()->subMinutes(42),
            ]);

            AppNotification::create([
                'target_role' => 'Super Admin',
                'target_user_id' => null,
                'type' => 'task_completed',
                'title' => 'Tarea Completada por Administrador',
                'message' => 'Lic. Valeria Gómez completó la tarea: Conciliación bancaria quincenal de cuotas',
                'action_url' => '/tareas',
                'is_read' => false,
                'created_at' => Carbon::now()->subHours(2),
            ]);

            AppNotification::create([
                'target_role' => 'Administrador',
                'target_user_id' => $adminArea1->id,
                'type' => 'task_assigned',
                'title' => 'Nueva Tarea Asignada (Alta)',
                'message' => 'El CEO te asignó: Liquidación de gastos de escrituras notariales',
                'action_url' => '/tareas',
                'is_read' => false,
                'created_at' => Carbon::now()->subHours(1),
            ]);

            AppNotification::create([
                'target_role' => 'Administrador',
                'target_user_id' => $adminArea1->id,
                'type' => 'task_assigned',
                'title' => 'Nueva Tarea Asignada (Media)',
                'message' => 'El CEO te asignó: Seguimiento a clientes con promesas de pago',
                'action_url' => '/tareas',
                'is_read' => false,
                'created_at' => Carbon::now()->subHours(3),
            ]);
        });

        $elapsed = round(microtime(true) - $startTime, 2);

        $this->newLine();
        $this->info("=======================================================================");
        $this->info("  ¡SIMULACIÓN ESCALADA COMPLETADA CON ÉXITO EN {$elapsed} SEGUNDOS!");
        $this->info("=======================================================================");
        $this->table(
            ['Entidad / Módulo', 'Registros', 'Detalles Operativos'],
            [
                ['Roles de Spatie', '4 roles', 'Super Admin, Administrador, Asesor Comercial, Topógrafo'],
                ['Usuarios Oficiales', '7 cuentas', '1 CEO + 2 Administradores + 3 Asesores + 1 Topógrafo'],
                ['Proyectos Asignados', '6 proyectos', 'project_user vincula 3 proyectos a cada Administradora'],
                ['Tareas del CEO', '10 tareas', 'Asignadas a Administradores (Pendiente, En Curso, Completada)'],
                ['Pipeline Escrituras', '24 trámites', 'Distribuidas en las 12 etapas oficiales estrictas'],
                ['Recibera GERENCIA', '10 recibos', 'Correlativos GER-00001 al GER-00010 (Gerencia General)'],
                ['Recibera ADMINISTRACION', '24 recibos', 'Correlativos ADM-00001 al ADM-00024 (Área Administrativa)'],
                ['Recibera ASESORIA', '~200 recibos', 'Correlativos ASE-00001 en adelante (Asesores Comerciales)'],
                ['Recibera TOPOGRAFIA', '12 recibos', 'Correlativos TOP-00001 al TOP-00012 (Área de Topografía)'],
                ['Notificaciones en Tiempo Real', '5 alertas', 'Pagos emitidos en reciberas y tareas asignadas/completadas'],
            ]
        );
        $this->newLine();

        return Command::SUCCESS;
    }
}
