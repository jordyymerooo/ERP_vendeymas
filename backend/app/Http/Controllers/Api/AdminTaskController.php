<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminTask;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminTaskController extends Controller
{
    /**
     * Resuelve de forma unificada qué Administrador se está consultando.
     * Si el usuario autenticado tiene rol 'Administrador' (y no es Super Admin), usa su id.
     * Si el usuario autenticado es 'Super Admin' pero simula 'Administrador' (por header o query),
     * toma el ID del primer Administrador activo (Lic. Valeria Gómez).
     */
    public static function resolveEffectiveAdminId(Request $request): int
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role')
            ?: $request->header('X-Simulated-Role')
            ?: $request->query('role')
            ?: $request->query('simulate_role');

        $isSimulatingAdmin = ($simulatedRole === 'Administrador');

        // Si es un Administrador auténtico (no el CEO)
        if ($user && $user->hasRole('Administrador') && !$user->hasRole('Super Admin')) {
            return (int) $user->id;
        }

        // Si se envió explícitamente un admin_id diferente del CEO (id = 1)
        $explicitAdminId = $request->header('X-Admin-Id') ?: $request->query('admin_id');
        if ($explicitAdminId && (int) $explicitAdminId > 1) {
            return (int) $explicitAdminId;
        }

        // Si está simulando el rol Administrador o es un Administrador
        if ($isSimulatingAdmin) {
            $firstAdminId = User::role('Administrador')
                ->where('email', 'administrador1@vendeymas.com')
                ->value('id');

            if ($firstAdminId) {
                return (int) $firstAdminId;
            }

            $anyAdminId = User::role('Administrador')->value('id');
            if ($anyAdminId) {
                return (int) $anyAdminId;
            }
        }

        return (int) ($user?->id ?? 2);
    }

    /**
     * Retorna el listado de tareas asignadas del CEO a Administradores.
     * El CEO (Super Admin) ve y filtra todas las tareas; cada Administrador ve únicamente las suyas.
     * Ordenamiento estricto: Prioridad (Alta -> Media -> Baja) y luego fecha de envío más reciente.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role')
            ?: $request->header('X-Simulated-Role')
            ?: $request->query('role')
            ?: $request->query('simulate_role');

        $isSuperAdmin = ($user && ($user->hasRole('Super Admin') || $user->id === 1) && $simulatedRole !== 'Administrador')
            || ($simulatedRole === 'Super Admin' || $simulatedRole === 'CEO / Gerente');

        $query = AdminTask::with([
            'project:id,name,location',
            'assignedTo:id,name,email',
            'assignedBy:id,name,email',
        ]);

        if (!$isSuperAdmin) {
            $effectiveAdminId = self::resolveEffectiveAdminId($request);
            $query->where('assigned_to', $effectiveAdminId);
        } else {
            // Filtros exclusivos para el CEO
            if ($request->filled('assigned_to') && $request->assigned_to !== 'all') {
                $query->where('assigned_to', $request->assigned_to);
            }
        }

        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        // Orden estricto: Prioridad (Alta 1 -> Media 2 -> Baja 3) y fecha de creación más reciente
        $tasks = $query
            ->orderByRaw("CASE priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 WHEN 'Baja' THEN 3 ELSE 4 END ASC")
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $tasks,
        ]);
    }

    /**
     * El CEO (Super Admin) crea y asigna una nueva tarea a un Administrador.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'project_id' => 'nullable|exists:projects,id',
            'assigned_to' => 'required|exists:users,id',
            'priority' => 'nullable|in:Alta,Media,Baja',
            'due_date' => 'nullable|date',
            'status' => 'nullable|in:Pendiente,En Curso,Completada',
        ]);

        $title = strip_tags(trim($validated['title']));
        $description = !empty($validated['description']) ? strip_tags(trim($validated['description'])) : null;

        $status = $validated['status'] ?? 'Pendiente';
        $completedAt = ($status === 'Completada') ? now() : null;

        $task = AdminTask::create([
            'title' => $title,
            'description' => $description,
            'project_id' => $validated['project_id'] ?? null,
            'assigned_to' => $validated['assigned_to'],
            'assigned_by' => $user->id,
            'priority' => $validated['priority'] ?? 'Media',
            'due_date' => $validated['due_date'] ?? null,
            'status' => $status,
            'completed_at' => $completedAt,
        ]);

        // Disparo automático de notificación en tiempo real para el Administrador asignado
        try {
            \App\Models\AppNotification::create([
                'target_role' => 'Administrador',
                'target_user_id' => $task->assigned_to,
                'type' => 'task_assigned',
                'title' => "Nueva Tarea Asignada ({$task->priority})",
                'message' => "El CEO te asignó: {$task->title}",
                'action_url' => '/tareas',
                'is_read' => false,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Aviso notificación tarea asignada: ' . $e->getMessage());
        }

        AuditLog::record(
            $user->id,
            'Tareas CEO',
            "Asignó tarea '{$task->title}' al usuario #{$task->assigned_to}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Tarea asignada exitosamente.',
            'data' => $task->load(['project', 'assignedTo', 'assignedBy']),
        ], 201);
    }

    /**
     * Actualiza el estado o detalle de una tarea.
     * Si pasa a 'Completada', guarda automáticamente completed_at = now().
     * Si vuelve a 'Pendiente' o 'En Curso', pone completed_at = null.
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role')
            ?: $request->header('X-Simulated-Role')
            ?: $request->query('role')
            ?: $request->query('simulate_role');

        $isRealSuperAdmin = ($user && ($user->hasRole('Super Admin') || $user->id === 1));
        $isSimulatingAdmin = ($simulatedRole === 'Administrador');
        $isSuperAdmin = ($isRealSuperAdmin && !$isSimulatingAdmin) 
            || ($simulatedRole === 'Super Admin' || $simulatedRole === 'CEO / Gerente');

        $task = AdminTask::findOrFail($id);

        if (!$isSuperAdmin) {
            $effectiveAdminId = self::resolveEffectiveAdminId($request);

            // Si es un Administrador real (no CEO simulando), restringir a sus tareas asignadas
            if (!$isRealSuperAdmin && (int)$task->assigned_to !== (int)$effectiveAdminId) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes permisos para modificar esta tarea.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'project_id' => 'nullable|exists:projects,id',
            'assigned_to' => 'sometimes|required|exists:users,id',
            'priority' => 'nullable|in:Alta,Media,Baja',
            'due_date' => 'nullable|date',
            'status' => 'nullable|in:Pendiente,En Curso,Completada',
        ]);

        if (isset($validated['title'])) {
            $validated['title'] = strip_tags(trim($validated['title']));
        }
        if (isset($validated['description'])) {
            $validated['description'] = strip_tags(trim($validated['description']));
        }

        $newStatus = $validated['status'] ?? $task->status;

        // Regla Estricta: Solo el Administrador Asignado puede marcar como 'Completada'
        if ($isSuperAdmin && isset($validated['status']) && $validated['status'] === 'Completada') {
            return response()->json([
                'success' => false,
                'message' => 'Restricción de rol: Solo el Administrador asignado a esta tarea puede certificar y marcar su estado como Completada.',
            ], 422);
        }

        $updates = $isSuperAdmin ? $validated : ['status' => $newStatus];

        // Lógica de finalización automática de fecha
        if ($newStatus === 'Completada') {
            $updates['completed_at'] = $task->completed_at ?: now();
        } elseif ($newStatus === 'Pendiente' || $newStatus === 'En Curso') {
            $updates['completed_at'] = null;
        }

        $task->update($updates);

        if ($newStatus === 'Completada') {
            try {
                $adminName = $user?->name ?? $task->assignedTo?->name ?? 'Administrador';
                \App\Models\AppNotification::create([
                    'target_role' => 'Super Admin',
                    'target_user_id' => null,
                    'type' => 'task_completed',
                    'title' => 'Tarea Completada por Administrador',
                    'message' => "{$adminName} completó la tarea: {$task->title}",
                    'action_url' => '/tareas',
                    'is_read' => false,
                ]);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Aviso notificación tarea completada: ' . $e->getMessage());
            }
        }

        AuditLog::record(
            $user->id,
            'Tareas CEO',
            "Actualizó tarea #{$task->id} ('{$task->title}') a estado '{$task->status}'",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Tarea actualizada exitosamente.',
            'data' => $task->fresh(['project', 'assignedTo', 'assignedBy']),
        ]);
    }

    /**
     * Elimina una tarea específica (permitido para Super Admin y para el Administrador titular).
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role') ?: $request->query('simulate_role');
        $isSuperAdmin = ($user && ($user->hasRole('Super Admin') || $user->id === 1) && $simulatedRole !== 'Administrador') 
            || ($simulatedRole === 'Super Admin' || $simulatedRole === 'CEO / Gerente');

        $task = AdminTask::findOrFail($id);

        if (!$isSuperAdmin) {
            $effectiveAdminId = ($user && $user->hasRole('Administrador')) 
                ? $user->id 
                : (User::where('email', 'administrador1@vendeymas.com')->value('id') ?? $user->id);

            if ($task->assigned_to !== $effectiveAdminId) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes permisos para eliminar esta tarea.',
                ], 403);
            }
        }

        $taskTitle = $task->title;
        $task->delete();

        AuditLog::record(
            $user->id,
            'Tareas CEO',
            "Eliminó tarea asignada #{$id} ('{$taskTitle}')",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Tarea eliminada exitosamente.',
        ]);
    }

    /**
     * Vacía todas las tareas completadas en 1 clic para liberar espacio.
     * Si es CEO (Super Admin), puede vaciar todas las completadas (o del admin filtrado).
     * Si es Administrador, limpia sus propias tareas completadas.
     */
    public function clearCompleted(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role') ?: $request->query('simulate_role');
        $isSuperAdmin = ($user && ($user->hasRole('Super Admin') || $user->id === 1) && $simulatedRole !== 'Administrador') 
            || ($simulatedRole === 'Super Admin' || $simulatedRole === 'CEO / Gerente');

        $query = AdminTask::where('status', 'Completada');

        if (!$isSuperAdmin) {
            $effectiveAdminId = ($user && $user->hasRole('Administrador')) 
                ? $user->id 
                : (User::where('email', 'administrador1@vendeymas.com')->value('id') ?? $user->id);

            $query->where('assigned_to', $effectiveAdminId);
        } else {
            if ($request->filled('assigned_to') && $request->assigned_to !== 'all') {
                $query->where('assigned_to', $request->assigned_to);
            }
        }

        $count = $query->count();
        $query->delete();

        AuditLog::record(
            $user->id,
            'Tareas CEO',
            "Vació {$count} tareas completadas del archivo",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Se eliminaron {$count} tareas completadas exitosamente.",
            'deleted_count' => $count,
        ]);
    }
}
