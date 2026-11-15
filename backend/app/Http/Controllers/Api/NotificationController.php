<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\AdminTask;
use App\Services\DelinquentLots;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class NotificationController extends Controller
{
    /**
     * Resumen unificado de notificaciones, conteo de no leídas,
     * tareas pendientes y total de casos en mora.
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();

        // Detección de Rol Activo y Simulado
        $simulatedRole = $request->header('X-Simulate-Role')
            ?: $request->header('X-Simulated-Role')
            ?: $request->query('role')
            ?: $request->query('simulate_role');

        $effectiveRole = $simulatedRole ?: ($user?->roles?->first()?->name ?? 'Super Admin');
        if ($effectiveRole === 'CEO / Gerente') {
            $effectiveRole = 'Super Admin';
        }

        // Detección de Administrador específico unificada
        $effectiveAdminId = AdminTaskController::resolveEffectiveAdminId($request);

        // 1. Filtrar notificaciones según rol y usuario
        $notifQuery = $this->buildScopedNotificationQuery($effectiveRole, $effectiveAdminId);

        $unreadCount = (clone $notifQuery)->where('is_read', false)->count();

        $notifications = (clone $notifQuery)
            ->orderBy('created_at', 'desc')
            ->limit(15)
            ->get()
            ->map(function ($notif) {
                return [
                    'id' => $notif->id,
                    'type' => $notif->type,
                    'title' => $notif->title,
                    'message' => $notif->message,
                    'action_url' => $notif->action_url ?: '/recibos',
                    'is_read' => (bool) $notif->is_read,
                    'created_at' => $notif->created_at ? $notif->created_at->toISOString() : null,
                    'time_ago' => $notif->created_at ? $notif->created_at->diffForHumans() : '',
                ];
            });

        // 2. Conteo de Tareas Pendientes por Realizar
        $pendingTasksCount = 0;
        if ($effectiveRole === 'Administrador') {
            $pendingTasksCount = AdminTask::where('assigned_to', $effectiveAdminId)
                ->whereIn('status', ['Pendiente', 'En Curso'])
                ->count();
        } elseif ($effectiveRole === 'Super Admin') {
            $pendingTasksCount = AdminTask::whereIn('status', ['Pendiente', 'En Curso'])
                ->count();
        }

        // 3. Conteo de Casos en Mora (solo número entero sin listar clientes)
        $moraCount = $this->calculateTotalMoraCount();

        return response()->json([
            'success' => true,
            'role' => $effectiveRole,
            'unread_count' => $unreadCount,
            'mora_count' => $moraCount,
            'pending_tasks_count' => $pendingTasksCount,
            'notifications' => $notifications,
        ]);
    }

    /**
     * Marca una notificación individual como leída.
     */
    public function markAsRead(int|string $id): JsonResponse
    {
        $notification = AppNotification::findOrFail($id);
        $notification->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Notificación marcada como leída.',
            'data' => $notification,
        ]);
    }

    /**
     * Marca todas las notificaciones del rol/usuario activo como leídas.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();

        $simulatedRole = $request->header('X-Simulate-Role')
            ?: $request->header('X-Simulated-Role')
            ?: $request->query('role')
            ?: $request->query('simulate_role');

        $effectiveRole = $simulatedRole ?: ($user?->roles?->first()?->name ?? 'Super Admin');
        if ($effectiveRole === 'CEO / Gerente') {
            $effectiveRole = 'Super Admin';
        }

        $effectiveAdminId = AdminTaskController::resolveEffectiveAdminId($request);
        $query = $this->buildScopedNotificationQuery($effectiveRole, $effectiveAdminId);
        $updated = (clone $query)->where('is_read', false)->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Todas las notificaciones fueron marcadas como leídas.',
            'updated_count' => $updated,
        ]);
    }

    /**
     * Construye la consulta filtrada según el rol y usuario.
     */
    protected function buildScopedNotificationQuery(string $role, int $adminId)
    {
        if ($role === 'Super Admin') {
            return AppNotification::where(function ($q) {
                $q->where('target_role', 'Super Admin')
                  ->orWhereNull('target_role');
            });
        }

        if ($role === 'Administrador') {
            return AppNotification::where(function ($q) use ($adminId) {
                $q->where(function ($sq) use ($adminId) {
                    $sq->where('target_role', 'Administrador')
                       ->where(function ($ssq) use ($adminId) {
                           $ssq->where('target_user_id', $adminId)
                               ->orWhereNull('target_user_id');
                       });
                })->orWhere('target_user_id', $adminId);
            });
        }

        return AppNotification::where('target_role', $role);
    }

    /**
     * Calcula rápidamente el número de lotes vendidos en mora sin devolver la lista detallada.
     * Optimizado con caché de 10 minutos (600s) para evitar sobrecargar RAM y CPU.
     */
    protected function calculateTotalMoraCount(): int
    {
        return Cache::remember('system_mora_count', 600, fn () => app(DelinquentLots::class)->query()->count());
    }
}
