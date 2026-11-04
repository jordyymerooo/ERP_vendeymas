<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class SystemMaintenanceController extends Controller
{
    /**
     * Valida que el usuario tenga privilegios reales de Super Admin (sin suplantación).
     */
    private function checkIsSuperAdmin(Request $request): bool
    {
        return \App\Helpers\RoleSecurity::isRealSuperAdmin($request->user());
    }

    /**
     * Dispara la simulación operativa masiva (100 clientes, 120 lotes, ~250 recibos).
     */
    public function simulate(Request $request): JsonResponse
    {
        if (!$this->checkIsSuperAdmin($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. La simulación de datos es exclusiva para el Super Administrador.',
            ], 403);
        }

        try {
            $exitCode = Artisan::call('sistema:simular');
            $output = Artisan::output();

            AuditLog::record(
                $request->user()?->id ?? 1,
                'Sistema & Mantenimiento',
                'Ejecutó simulación masiva de datos (100 clientes, 120 lotes, ~250 recibos)',
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'success' => $exitCode === 0,
                'message' => 'Simulación operativa masiva completada exitosamente.',
                'output' => $output,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar la simulación masiva: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reinicia el sistema a cero para producción.
     * Requiere que el usuario confirme explícitamente enviando confirm: 'CONFIRMAR'.
     */
    public function reset(Request $request): JsonResponse
    {
        if (!$this->checkIsSuperAdmin($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. El formateo a cero es exclusivo para el Super Administrador.',
            ], 403);
        }

        if (trim(strtoupper($request->input('confirm', ''))) !== 'CONFIRMAR') {
            return response()->json([
                'success' => false,
                'message' => 'Confirmación requerida. Debe escribir "CONFIRMAR" exactamente para proceder con el borrado.',
            ], 422);
        }

        try {
            $isBase = (bool) $request->input('base', false);

            $exitCode = Artisan::call('sistema:reset', [
                '--base' => $isBase,
            ]);
            $output = Artisan::output();

            return response()->json([
                'success' => $exitCode === 0,
                'message' => $isBase
                    ? 'Sistema reiniciado a cero con estructura base (3 proyectos y 3 asesores).'
                    : 'Sistema formateado a cero completamente para producción.',
                'output' => $output,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al reiniciar el sistema: ' . $e->getMessage(),
            ], 500);
        }
    }
}
