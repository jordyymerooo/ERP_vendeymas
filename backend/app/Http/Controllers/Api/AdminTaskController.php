<?php

namespace App\Http\Controllers\Api;

use App\Helpers\RoleSecurity;
use App\Http\Controllers\Controller;
use App\Models\AdminTask;
use App\Models\AppNotification;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminTaskController extends Controller
{
    private const ASSIGNEE_ROLES = ['Administrador', 'Asesor Comercial'];

    /** Task role filters must never act as CEO role simulation. */
    public static function resolveTaskRole(Request $request): string
    {
        $user = $request->user();
        if (!RoleSecurity::isRealSuperAdmin($user)) {
            return $user?->roles->first()?->name ?? 'Guest';
        }

        $role = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role')
            ?: $request->query('simulate_role');
        if (!$role && !$request->is('api/admin-tasks', 'api/admin-tasks/*')) {
            $role = $request->query('role');
        }

        return match ($role) {
            'Administrador', 'Asesor Comercial' => $role,
            'Topógrafo', 'Topografo' => 'Topógrafo',
            default => 'Super Admin',
        };
    }

    public static function resolveEffectiveAssigneeId(Request $request): int
    {
        $user = $request->user();
        if (!RoleSecurity::isRealSuperAdmin($user)) {
            // A real employee cannot select another identity with headers or query parameters.
            return (int) $user?->id;
        }

        $role = self::resolveTaskRole($request);
        if (!in_array($role, self::ASSIGNEE_ROLES, true)) {
            return (int) $user->id;
        }
        $query = User::role($role)->where('is_active', true)
            ->whereDoesntHave('roles', fn ($roles) => $roles->where('name', 'Super Admin'));
        $explicitId = $request->header('X-Admin-Id') ?: $request->query('admin_id');
        if ($explicitId && ($id = (clone $query)->whereKey($explicitId)->value('id'))) {
            return (int) $id;
        }
        if ($role === 'Administrador' && ($id = (clone $query)->where('email', 'administrador1@vendeymas.com')->value('id'))) {
            return (int) $id;
        }

        return (int) ((clone $query)->orderBy('id')->value('id') ?? $user->id);
    }

    public static function resolveEffectiveAdminId(Request $request): int
    {
        return self::resolveEffectiveAssigneeId($request);
    }

    private function isManager(Request $request): bool
    {
        return RoleSecurity::isRealSuperAdmin($request->user()) && self::resolveTaskRole($request) === 'Super Admin';
    }

    private function authorizeAccess(Request $request): void
    {
        $user = $request->user();
        abort_unless($user && (RoleSecurity::isRealSuperAdmin($user) || $user->hasAnyRole(self::ASSIGNEE_ROLES)),
            403, 'Este módulo está disponible para Gerencia, Administradores y Asesores Comerciales.');
    }

    private function taskRelations(): array
    {
        return [
            'project:id,name,location',
            'assignedTo:id,name,email,is_active,deleted_at',
            'assignedTo.roles:id,name',
            'assignedBy:id,name,email,is_active,deleted_at',
        ];
    }

    private function presentTask(AdminTask $task): AdminTask
    {
        $task->setRelation('assignee', $task->assignedTo);
        $task->setAttribute('assignee_role', $task->assignedTo?->roles->first()?->name);

        return $task;
    }

    private function assigneeRules(): array
    {
        $eligibleIds = User::role(self::ASSIGNEE_ROLES)->select('users.id')
            ->whereDoesntHave('roles', fn ($roles) => $roles->where('name', 'Super Admin'));

        return ['required', 'integer', Rule::exists('users', 'id')
            ->whereNull('deleted_at')->where('is_active', true)->whereIn('id', $eligibleIds)];
    }

    private function lockAssignee(int $id): User
    {
        $user = User::role(self::ASSIGNEE_ROLES)->where('is_active', true)
            ->whereDoesntHave('roles', fn ($roles) => $roles->where('name', 'Super Admin'))
            ->lockForUpdate()->find($id);
        if (!$user) {
            throw ValidationException::withMessages([
                'assigned_to' => 'Seleccione un Administrador o Asesor Comercial activo.',
            ]);
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAccess($request);
        $manager = $this->isManager($request);
        $query = AdminTask::with($this->taskRelations());
        if (!$manager) {
            $query->where('assigned_to', self::resolveEffectiveAssigneeId($request));
        } else {
            if ($request->filled('assigned_to') && $request->assigned_to !== 'all') {
                $query->where('assigned_to', $request->assigned_to);
            }
            if (in_array($request->input('role'), self::ASSIGNEE_ROLES, true)) {
                $query->whereHas('assignedTo.roles', fn ($roles) => $roles->where('name', $request->input('role')));
            }
        }
        $this->applyFilters($query, $request);
        $tasks = $query->orderByRaw("CASE priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 WHEN 'Baja' THEN 3 ELSE 4 END")
            ->latest('created_at')->latest('id')->get()->map(fn ($task) => $this->presentTask($task));

        return response()->json(['success' => true, 'data' => $tasks]);
    }

    private function applyFilters($query, Request $request): void
    {
        foreach (['project_id', 'priority'] as $field) {
            if ($request->filled($field) && $request->input($field) !== 'all') {
                $query->where($field, $request->input($field));
            }
        }
        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'pending') {
                $query->whereIn('status', ['Pendiente', 'En Curso']);
            } else {
                $query->where('status', $request->status === 'completed' ? 'Completada' : $request->status);
            }
        }
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(RoleSecurity::isRealSuperAdmin($request->user()), 403, 'Solo Gerencia puede asignar nuevas tareas.');
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'project_id' => 'nullable|exists:projects,id',
            'assigned_to' => $this->assigneeRules(),
            'priority' => 'nullable|in:Alta,Media,Baja',
            'due_date' => 'nullable|date',
            'status' => 'nullable|in:Pendiente,En Curso,Completada',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $assignee = $this->lockAssignee((int) $validated['assigned_to']);
            $task = AdminTask::create([
                ...$validated,
                'title' => strip_tags(trim($validated['title'])),
                'description' => isset($validated['description']) ? strip_tags(trim($validated['description'])) : null,
                'assigned_by' => $request->user()->id,
                'priority' => $validated['priority'] ?? 'Media',
                'status' => $validated['status'] ?? 'Pendiente',
                'completed_at' => ($validated['status'] ?? '') === 'Completada' ? now() : null,
            ]);
            $this->notify([
                'target_role' => $assignee->roles->first()?->name,
                'target_user_id' => $assignee->id,
                'type' => 'task_assigned',
                'title' => "Nueva Tarea Asignada ({$task->priority})",
                'message' => "El CEO te asignó: {$task->title}",
            ]);
            AuditLog::record($request->user()->id, 'Tareas CEO',
                "Asignó tarea '{$task->title}' a {$assignee->name} ({$assignee->roles->first()?->name}), usuario #{$assignee->id}",
                $request->ip(), $request->userAgent());

            return response()->json(['success' => true, 'message' => 'Tarea asignada exitosamente.',
                'data' => $this->presentTask($task->load($this->taskRelations()))], 201);
        });
    }

    public function update(Request $request, int|string $id): JsonResponse
    {
        $this->authorizeAccess($request);
        return DB::transaction(function () use ($request, $id) {
            $task = AdminTask::lockForUpdate()->findOrFail($id);
            $manager = $this->isManager($request);
            abort_unless($manager || (int) $task->assigned_to === self::resolveEffectiveAssigneeId($request),
                403, 'No tienes permisos para modificar esta tarea.');

            $rules = ['status' => ($manager ? 'sometimes|required' : 'required').'|in:Pendiente,En Curso,Completada'];
            if ($manager) {
                $rules += [
                    'title' => 'sometimes|required|string|max:255',
                    'description' => 'nullable|string|max:1000',
                    'project_id' => 'nullable|exists:projects,id',
                    'assigned_to' => ['sometimes', ...$this->assigneeRules()],
                    'priority' => 'nullable|in:Alta,Media,Baja',
                    'due_date' => 'nullable|date',
                ];
            }
            $validated = $request->validate($rules);
            if ($manager && ($validated['status'] ?? null) === 'Completada') {
                return response()->json(['success' => false,
                    'message' => 'Solo el responsable asignado puede certificar la tarea como Completada.'], 422);
            }
            if (isset($validated['assigned_to'])) {
                $this->lockAssignee((int) $validated['assigned_to']);
            }
            foreach (['title', 'description'] as $field) {
                if (isset($validated[$field])) {
                    $validated[$field] = strip_tags(trim($validated[$field]));
                }
            }

            $previousStatus = $task->status;
            $newStatus = $validated['status'] ?? $previousStatus;
            $validated['completed_at'] = $newStatus === 'Completada' ? ($task->completed_at ?: now()) : null;
            $task->update($validated);
            if ($newStatus === 'Completada' && $previousStatus !== 'Completada') {
                $this->notify([
                    'target_role' => 'Super Admin',
                    'target_user_id' => null,
                    'type' => 'task_completed',
                    'title' => 'Tarea Completada por '.$request->user()->roles->first()?->name,
                    'message' => "{$request->user()->name} completó la tarea: {$task->title}",
                ]);
            }
            AuditLog::record($request->user()->id, 'Tareas CEO',
                "Actualizó tarea #{$task->id} ('{$task->title}') a estado '{$task->status}'", $request->ip(), $request->userAgent());

            return response()->json(['success' => true, 'message' => 'Tarea actualizada exitosamente.',
                'data' => $this->presentTask($task->fresh($this->taskRelations()))]);
        });
    }

    private function notify(array $attributes): void
    {
        try {
            // A failed optional notification must not abort the task transaction on PostgreSQL.
            DB::transaction(fn () => AppNotification::create([...$attributes, 'action_url' => '/tareas', 'is_read' => false]));
        } catch (\Throwable $error) {
            Log::warning('Aviso notificación de tarea: '.$error->getMessage());
        }
    }

    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $this->authorizeAccess($request);
        return DB::transaction(function () use ($request, $id) {
            $task = AdminTask::lockForUpdate()->findOrFail($id);
            $manager = $this->isManager($request);
            abort_unless($manager || (self::resolveTaskRole($request) === 'Administrador'
                && (int) $task->assigned_to === self::resolveEffectiveAssigneeId($request)),
                403, 'No tienes permisos para eliminar esta tarea.');
            $task->delete();
            AuditLog::record($request->user()->id, 'Tareas CEO',
                "Eliminó tarea asignada #{$task->id} ('{$task->title}')", $request->ip(), $request->userAgent());

            return response()->json(['success' => true, 'message' => 'Tarea eliminada exitosamente.']);
        });
    }

    public function clearCompleted(Request $request): JsonResponse
    {
        $this->authorizeAccess($request);
        $manager = $this->isManager($request);
        abort_unless($manager || self::resolveTaskRole($request) === 'Administrador', 403);
        $query = AdminTask::where('status', 'Completada');
        if (!$manager) {
            $query->where('assigned_to', self::resolveEffectiveAssigneeId($request));
        } else {
            if ($request->filled('assigned_to') && $request->assigned_to !== 'all') {
                $query->where('assigned_to', $request->assigned_to);
            }
            if (in_array($request->input('role'), self::ASSIGNEE_ROLES, true)) {
                $query->whereHas('assignedTo.roles', fn ($roles) => $roles->where('name', $request->input('role')));
            }
        }
        $this->applyFilters($query, $request);
        $count = DB::transaction(function () use ($request, $query) {
            $count = $query->delete();
            AuditLog::record($request->user()->id, 'Tareas CEO', "Vació {$count} tareas completadas del archivo",
                $request->ip(), $request->userAgent());

            return $count;
        });

        return response()->json(['success' => true, 'message' => "Se eliminaron {$count} tareas completadas exitosamente.", 'deleted_count' => $count]);
    }
}
