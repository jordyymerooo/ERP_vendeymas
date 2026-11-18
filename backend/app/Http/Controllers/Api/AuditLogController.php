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

        $query = AuditLog::with(['user:id,name,email,is_active,deleted_at', 'user.roles:id,name'])->latest('id');

        // Filtro por módulo si se proporciona
        if ($request->filled('module') && $request->input('module') !== 'TODOS') {
            $query->where('module', $request->input('module'));
        }

        // Filtro de búsqueda por acción, ip o usuario
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('action', 'ilike', '%' . $search . '%')
                  ->orWhereRaw('cast(ip_address as text) like ?', ['%' . $search . '%'])
                  ->orWhereHas('user', function ($u) use ($search) {
                      $u->where('name', 'ilike', '%' . $search . '%')
                        ->orWhere('email', 'ilike', '%' . $search . '%');
                  });
            });
        }

        $counts = (clone $query)->reorder()->toBase()
            ->selectRaw('module, count(*) as count')->groupBy('module')->pluck('count', 'module');
        $logs = $query->paginate($this->perPage($request))->withQueryString();

        return response()->json([...$logs->toArray(), 'module_counts' => $counts]);
    }
}
