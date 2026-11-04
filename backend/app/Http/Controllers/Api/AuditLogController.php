<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Retorna el listado paginado de logs de auditoría con información del usuario y sus roles.
     */
    public function index(Request $request): JsonResponse
    {
        if (!\App\Helpers\RoleSecurity::isRealSuperAdmin($request->user())) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. Los registros de auditoría son exclusivos para el Super Administrador.',
            ], 403);
        }

        $query = AuditLog::with(['user.roles'])->orderBy('created_at', 'desc');

        // Filtro por módulo si se proporciona
        if ($request->filled('module') && $request->input('module') !== 'TODOS') {
            $query->where('module', $request->input('module'));
        }

        // Filtro de búsqueda por acción, ip o usuario
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('action', 'ilike', '%' . $search . '%')
                  ->orWhere('ip_address', 'like', '%' . $search . '%')
                  ->orWhereHas('user', function ($u) use ($search) {
                      $u->where('name', 'ilike', '%' . $search . '%')
                        ->orWhere('email', 'ilike', '%' . $search . '%');
                  });
            });
        }

        $logs = $query->paginate(20);

        return response()->json($logs);
    }
}
