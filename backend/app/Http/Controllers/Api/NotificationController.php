<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\AdminTask;
use App\Services\DelinquentLots;
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
        $effectiveRole = AdminTaskController::resolveTaskRole($request);
        $effectiveUserId = AdminTaskController::resolveEffectiveAssigneeId($request);

        // 1. Filtrar notificaciones según rol y usuario
        $notifQuery = $this->buildScopedNotificationQuery($effectiveRole, $effectiveUserId);

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
        if (in_array($effectiveRole, ['Administrador', 'Asesor Comercial'], true)) {
            $pendingTasksCount = AdminTask::where('assigned_to', $effectiveUserId)
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
    public function markAsRead(Request $request, int|string $id): JsonResponse
    {
        $role = AdminTaskController::resolveTaskRole($request);
        $userId = AdminTaskController::resolveEffectiveAssigneeId($request);
        $notification = $this->buildScopedNotificationQuery($role, $userId)->findOrFail($id);
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
        $effectiveRole = AdminTaskController::resolveTaskRole($request);
        $effectiveUserId = AdminTaskController::resolveEffectiveAssigneeId($request);
        $query = $this->buildScopedNotificationQuery($effectiveRole, $effectiveUserId);
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
    protected function buildScopedNotificationQuery(string $role, int $userId)
    {
        return AppNotification::where(function ($query) use ($role, $userId) {
            $query->where('target_user_id', $userId)
                ->orWhere(function ($broadcast) use ($role) {
                    $broadcast->whereNull('target_user_id')->where(function ($targetRole) use ($role) {
                        $targetRole->where('target_role', $role);
                        if ($role === 'Super Admin') {
                            $targetRole->orWhereNull('target_role');
                        }
                    });
                });
        });
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
