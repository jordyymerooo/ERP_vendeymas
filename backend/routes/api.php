<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LotController;
use App\Http\Controllers\Api\LotDocumentController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\SystemBackupController;
use App\Http\Controllers\Api\AdminTaskController;
use App\Http\Controllers\Api\ChequeController;
use App\Http\Controllers\Api\DeedController;
use App\Http\Controllers\Api\TopographyJobController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\RoleSecurityGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Sistema Inmobiliario Vende & Más
|--------------------------------------------------------------------------
*/

// ==========================================================
// RUTA PÚBLICA DE AUTENTICACIÓN (Rate Limiting: 5 intentos/min)
// ==========================================================
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('login');

// ==========================================================
// RUTAS PROTEGIDAS CON LARAVEL SANCTUM (auth:sanctum + throttle:api + RoleSecurityGuard)
// ==========================================================
Route::middleware(['auth:sanctum', 'throttle:api', RoleSecurityGuard::class])->group(function () {
    // Sesión y Usuario autenticado
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles');
    });
    Route::get('/profile/signature', [UserController::class, 'getSignature']);
    Route::post('/profile/signature', [UserController::class, 'updateSignature']);
    Route::delete('/profile/signature', [UserController::class, 'deleteSignature']);

    // Centro de Mando e Indicadores
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Endpoints de Proyectos
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{slug}/customers', [ProjectController::class, 'customersByProject']);
    Route::get('/projects/{slug}/lots', [ProjectController::class, 'lotsByProject']);
    Route::post('/projects/{slug}/lots', [LotController::class, 'storeLot']);
    Route::put('/projects/{id}/coordinates', [ProjectController::class, 'updateCoordinates']);
    Route::put('/projects/{id}/location', [ProjectController::class, 'updateLocation']);
    Route::post('/projects/{id}/assign-admin', [ProjectController::class, 'assignAdmin']);

    // Endpoints de Lotes
    Route::put('/lots/{id}/assign', [LotController::class, 'assignCustomer']);
    Route::put('/lots/{id}/release', [LotController::class, 'releaseLot']);
    Route::put('/lots/{id}/geojson', [LotController::class, 'updateGeojson']);
    Route::get('/lots/{id}/amortization', [LotController::class, 'amortizationSchedule']);
    Route::get('/lots/{id}/amortization-pdf', [LotController::class, 'amortizationPdf']);

    // Endpoints de Clientes (CRM)
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);
    Route::put('/customers/{id}', [CustomerController::class, 'update']);
    Route::delete('/customers/{id}', [CustomerController::class, 'destroy']);

    // Endpoints de Lectura de Usuarios (para selectores y asignaciones)
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);

    // ==========================================================
    // RUTAS EXCLUSIVAS PARA SUPER ADMINISTRADOR / CEO
    // ==========================================================
    Route::middleware(EnsureSuperAdmin::class)->group(function () {
        // Gestión de Usuarios (Crear, Editar, Eliminar y Asignar Proyectos)
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::post('/users/{id}/assign-projects', [UserController::class, 'assignProjects']);

        // Auditoría, Respaldo y Mantenimiento del Sistema
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/system/backup', [SystemBackupController::class, 'downloadBackup']);
        Route::post('/system/simulate', [\App\Http\Controllers\Api\SystemMaintenanceController::class, 'simulate']);
        Route::post('/system/reset', [\App\Http\Controllers\Api\SystemMaintenanceController::class, 'reset']);

        // Control y Emisión de Cheques (Exclusivo CEO / Super Admin)
        Route::get('/cheques', [ChequeController::class, 'index']);
        Route::post('/cheques', [ChequeController::class, 'store']);
        Route::get('/cheques/{id}', [ChequeController::class, 'show']);
        Route::put('/cheques/{id}', [ChequeController::class, 'update']);
        Route::patch('/cheques/{id}/status', [ChequeController::class, 'updateStatus']);
        Route::delete('/cheques/{id}', [ChequeController::class, 'destroy']);
    });

    // Endpoints de Documentos y Contratos
    Route::get('/lots/{id}/documents', [LotDocumentController::class, 'indexByLot']);
    Route::get('/customers/{id}/documents', [LotDocumentController::class, 'indexByCustomer']);
    Route::post('/lots/{id}/documents', [LotDocumentController::class, 'store']);
    Route::get('/documents/{id}/download', [LotDocumentController::class, 'download']);
    Route::delete('/documents/{id}', [LotDocumentController::class, 'destroy']);

    // Endpoints de Pagos y Recibos
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::get('/payments/export/excel', [PaymentController::class, 'exportExcel']);
    Route::get('/payments/export/pdf', [PaymentController::class, 'exportPdf']);
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::post('/payments/{id}/void', [PaymentController::class, 'voidReceipt']);
    Route::get('/payments/{id}/pdf', [PaymentController::class, 'downloadPdf']);

    // Pipeline Comercial / Leads (CRM de Ventas)
    Route::get('/leads', [LeadController::class, 'index']);
    Route::post('/leads', [LeadController::class, 'store']);
    Route::put('/leads/{id}', [LeadController::class, 'update']);
    Route::put('/leads/{id}/stage', [LeadController::class, 'updateStage']);
    Route::post('/leads/{id}/convert', [LeadController::class, 'convert']);
    Route::delete('/leads/{id}', [LeadController::class, 'destroy']);

    // Módulo Administrativo de Trabajos Topográficos
    Route::get('/topography-jobs', [TopographyJobController::class, 'index']);
    Route::post('/topography-jobs', [TopographyJobController::class, 'store']);
    Route::put('/topography-jobs/{id}', [TopographyJobController::class, 'update']);
    Route::delete('/topography-jobs/{id}', [TopographyJobController::class, 'destroy']);

    // Tareas del CEO para Administradores
    Route::get('/admin-tasks', [AdminTaskController::class, 'index']);
    Route::post('/admin-tasks', [AdminTaskController::class, 'store']);
    Route::put('/admin-tasks/{id}', [AdminTaskController::class, 'update']);
    Route::delete('/admin-tasks/completed/clear', [AdminTaskController::class, 'clearCompleted']);
    Route::delete('/admin-tasks/{id}', [AdminTaskController::class, 'destroy']);

    // Módulo Legal y Pipeline de Escrituras (12 Etapas)
    Route::get('/deeds', [DeedController::class, 'index']);
    Route::post('/deeds', [DeedController::class, 'store']);
    Route::put('/deeds/{id}', [DeedController::class, 'update']);
    Route::put('/deeds/{id}/stage', [DeedController::class, 'updateStage']);
    Route::delete('/deeds/{id}', [DeedController::class, 'destroy']);

    // Centro de Notificaciones en Tiempo Real
    Route::get('/notifications/summary', [NotificationController::class, 'summary']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
});
