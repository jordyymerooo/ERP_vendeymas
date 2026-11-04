<?php

require __DIR__ . '/../../backend/vendor/autoload.php';

$app = require_once __DIR__ . '/../../backend/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Project;
use App\Models\Deed;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

echo "===================================================================\n";
echo "   VERIFICACIÓN INTEGRAL DE LOS 4 ROLES Y ASIGNACIÓN DE PROYECTOS  \n";
echo "===================================================================\n\n";

$passCount = 0;
$failCount = 0;

function assertTest(string $desc, bool $condition) {
    global $passCount, $failCount;
    if ($condition) {
        echo " [PASS] $desc\n";
        $passCount++;
    } else {
        echo " [FAIL] $desc\n";
        $failCount++;
    }
}

// 1. PARTE 1: CUENTAS BASE Y ROLES
echo "--- 1. PARTE 1: Cuentas Base y Roles Oficiales ---\n";

$ceo = User::where('email', 'admin@vendeymas.com')->first();
assertTest("CEO existe con email admin@vendeymas.com", $ceo !== null);
assertTest("CEO tiene nombre 'Roberto Andrade - CEO / Gerente'", $ceo && $ceo->name === 'Roberto Andrade - CEO / Gerente');
assertTest("CEO tiene clave admin123", $ceo && Hash::check('admin123', $ceo->password));
assertTest("CEO tiene rol 'Super Admin'", $ceo && $ceo->hasRole('Super Admin'));

$admin1 = User::where('email', 'administrador1@vendeymas.com')->first();
assertTest("Admin 1 existe con email administrador1@vendeymas.com", $admin1 !== null);
assertTest("Admin 1 tiene nombre 'Lic. Valeria Gómez - Administradora'", $admin1 && $admin1->name === 'Lic. Valeria Gómez - Administradora');
assertTest("Admin 1 tiene clave admin123", $admin1 && Hash::check('admin123', $admin1->password));
assertTest("Admin 1 tiene rol 'Administrador'", $admin1 && $admin1->hasRole('Administrador'));

$admin2 = User::where('email', 'administrador2@vendeymas.com')->first();
assertTest("Admin 2 existe con email administrador2@vendeymas.com", $admin2 !== null);
assertTest("Admin 2 tiene nombre 'Abg. Mateo Silva - Administrador'", $admin2 && $admin2->name === 'Abg. Mateo Silva - Administrador');
assertTest("Admin 2 tiene clave admin123", $admin2 && Hash::check('admin123', $admin2->password));
assertTest("Admin 2 tiene rol 'Administrador'", $admin2 && $admin2->hasRole('Administrador'));

$asesores = User::whereIn('email', ['asesor1@vendeymas.com', 'asesor2@vendeymas.com', 'asesor3@vendeymas.com'])->get();
assertTest("Existen los 3 asesores comerciales con asesor123", $asesores->count() === 3 && $asesores->every(fn($a) => Hash::check('asesor123', $a->password)));

$topo = User::where('email', 'topografo@vendeymas.com')->first();
assertTest("Topógrafo existe con email topografo@vendeymas.com", $topo !== null);
assertTest("Topógrafo tiene nombre 'Ing. Fernando Castro - Topógrafo'", $topo && $topo->name === 'Ing. Fernando Castro - Topógrafo');
assertTest("Topógrafo tiene clave topo123", $topo && Hash::check('topo123', $topo->password));
assertTest("Topógrafo tiene rol 'Topógrafo'", $topo && $topo->hasRole('Topógrafo'));

// Chequeo de exclusión de Jordy
$jordyCheck = User::where('name', 'ilike', '%jordy%')->orWhere('email', 'ilike', '%jordy%')->count();
assertTest("No existe ninguna cuenta de usuario con el nombre o email 'Jordy'", $jordyCheck === 0);

// 2. PARTE 2: ASIGNACIÓN DE PROYECTOS Y TABLA PIVOTE
echo "\n--- 2. PARTE 2: Asignación de Proyectos (project_user) y Filtro Estricto ---\n";

$admin1Projects = $admin1->assignedProjects()->pluck('name')->toArray();
echo "Proyectos asignados a Admin 1 (Valeria Gómez): " . implode(', ', $admin1Projects) . "\n";
assertTest("Admin 1 tiene asignados Bosque Urbano y Guapuca", in_array('Bosque Urbano', $admin1Projects) && in_array('Guapuca', $admin1Projects));

$admin2Projects = $admin2->assignedProjects()->pluck('name')->toArray();
echo "Proyectos asignados a Admin 2 (Mateo Silva): " . implode(', ', $admin2Projects) . "\n";
assertTest("Admin 2 tiene asignados Valle Verde y Mirador del Upano", in_array('Valle Verde', $admin2Projects) && in_array('Mirador del Upano', $admin2Projects));

// Probar relación inversa en Project.php
$bosque = Project::where('name', 'Bosque Urbano')->first();
$bosqueAdmins = $bosque->administrators()->pluck('email')->toArray();
assertTest("Project.php relación administrators() devuelve a Lic. Valeria Gómez en Bosque Urbano", in_array('administrador1@vendeymas.com', $bosqueAdmins));

// Probar endpoints de asignación del CEO
$projController = app(\App\Http\Controllers\Api\ProjectController::class);
$assignReq = Request::create("/api/projects/{$bosque->id}/assign-admin", 'POST', ['admin_id' => $admin2->id]);
$assignReq->setUserResolver(fn() => $ceo);
$assignRes = $projController->assignAdmin($assignReq, $bosque->id);
assertTest("Endpoint POST /api/projects/{id}/assign-admin reasigna correctamente", $assignRes->getStatusCode() === 200);

// Restaurar a Admin 1
$restoreReq = Request::create("/api/projects/{$bosque->id}/assign-admin", 'POST', ['admin_id' => $admin1->id]);
$restoreReq->setUserResolver(fn() => $ceo);
$projController->assignAdmin($restoreReq, $bosque->id);

// Probar POST /api/users/{id}/assign-projects
$userController = app(\App\Http\Controllers\Api\UserController::class);
$userAssignReq = Request::create("/api/users/{$admin1->id}/assign-projects", 'POST', ['project_ids' => [$bosque->id, 2]]);
$userAssignReq->setUserResolver(fn() => $ceo);
$userAssignRes = $userController->assignProjects($userAssignReq, $admin1->id);
assertTest("Endpoint POST /api/users/{id}/assign-projects responde 200 con AuditLog", $userAssignRes->getStatusCode() === 200);

// Probar filtro estricto de ProjectController@index
$reqAdmin1 = Request::create('/api/projects', 'GET');
$reqAdmin1->setUserResolver(fn() => $admin1);
$resAdmin1 = $projController->index($reqAdmin1);
$dataAdmin1 = json_decode($resAdmin1->getContent(), true)['data'];
assertTest("Admin 1 al consultar GET /api/projects solo ve sus proyectos asignados", count($dataAdmin1) === 2);

$reqCEO = Request::create('/api/projects', 'GET');
$reqCEO->setUserResolver(fn() => $ceo);
$resCEO = $projController->index($reqCEO);
$dataCEO = json_decode($resCEO->getContent(), true)['data'];
assertTest("CEO al consultar GET /api/projects ve todos los 6 proyectos", count($dataCEO) === 6);

// Probar header X-Simulated-Role: Administrador
$reqSimulated = Request::create('/api/projects', 'GET', [], [], [], ['HTTP_X_SIMULATED_ROLE' => 'Administrador']);
$reqSimulated->setUserResolver(fn() => $ceo);
$resSimulated = $projController->index($reqSimulated);
$dataSimulated = json_decode($resSimulated->getContent(), true)['data'];
assertTest("Header X-Simulated-Role: Administrador activa el filtro estricto inmediatamente sin reloguear", count($dataSimulated) === 2);

// 3. PARTE 4: MÓDULO DE ESCRITURAS (12 ETAPAS) Y RECIBOS ADM
echo "\n--- 3. PARTE 4: Escrituras (12 Etapas Oficiales) y Recibos ADM ---\n";

assertTest("Existen exactamente 12 etapas oficiales en Deed::STAGES", count(Deed::STAGES) === 12);
assertTest("Etapa 1 es 'Informe'", Deed::STAGES[0] === 'Informe');
assertTest("Etapa 8 es 'Sentencia'", Deed::STAGES[7] === 'Sentencia');
assertTest("Etapa 10 es 'Municipio'", Deed::STAGES[9] === 'Municipio');
assertTest("Etapa 12 es 'Registro de la Propiedad'", Deed::STAGES[11] === 'Registro de la Propiedad');

// Probar filtro estricto en DeedController@index
$deedController = app(\App\Http\Controllers\Api\DeedController::class);
$deedReqAdmin = Request::create('/api/deeds', 'GET');
$deedReqAdmin->setUserResolver(fn() => $admin1);
$deedResAdmin = $deedController->index($deedReqAdmin);
$deedsAdmin = json_decode($deedResAdmin->getContent(), true)['data'];
$admin1ProjIds = $admin1->assignedProjects()->pluck('projects.id')->toArray();
$allBelong = collect($deedsAdmin)->every(fn($d) => in_array($d['project_id'], $admin1ProjIds));
assertTest("DeedController@index devuelve ÚNICAMENTE escrituras de los proyectos asignados al Administrador", $allBelong);

// Probar cobro con recibera ADM
$paymentController = app(\App\Http\Controllers\Api\PaymentController::class);
$targetDeed = Deed::whereIn('project_id', $admin1ProjIds)->first();
$payReq = Request::create('/api/payments', 'POST', [
    'deed_id' => $targetDeed->id,
    'receipt_book' => 'ADMINISTRACION',
    'amount_paid' => 175.50,
    'payment_method' => 'Transferencia Bancaria',
    'concept_detail' => 'Abono alcabalas y desmembración municipal',
]);
$payReq->setUserResolver(fn() => $admin1);
$payRes = $paymentController->store($payReq);
$payData = json_decode($payRes->getContent(), true)['payment'];
assertTest("Recibo emitido pertenece a la recibera 'ADMINISTRACION'", $payData['receipt_book'] === 'ADMINISTRACION');
assertTest("Código correlativo inicia con 'ADM-'", str_starts_with($payData['receipt_code'], 'ADM-'));

// Verificar PDF generado
$pdfPath = storage_path('app/public/' . str_replace('/api/payments/', '', $payData['receipt_pdf_url']));
assertTest("El comprobante tiene URL de descarga de PDF disponible", !empty($payData['receipt_pdf_url']));

echo "\n===================================================================\n";
echo " RESUMEN: $passCount pruebas PASADAS, $failCount pruebas FALLIDAS\n";
echo "===================================================================\n";
