<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LeadController extends Controller
{
    /**
     * Helper para verificar si el usuario es Super Admin de forma segura.
     */
    protected function checkIsSuperAdmin($user, Request $request): bool
    {
        return \App\Helpers\RoleSecurity::isSuperAdmin($request, $user);
    }

    /**
     * Listado de prospectos con aislamiento por asesor y estadísticas para el Pipeline Kanban.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($user, $request);

        $query = Lead::with(['project', 'customer', 'advisor:id,name'])
            ->latest('created_at')->latest('id');

        // ==========================================================
        // REGLA ESTRICTA DE VISIBILIDAD / AISLAMIENTO POR ASESOR
        // ==========================================================
        if (!$isSuperAdmin) {
            // El asesor comercial solo puede ver y gestionar sus propios prospectos asignados
            $query->where('user_id', $user ? $user->id : -1);
        } else {
            // El Super Admin puede ver todo el pipeline o filtrar por un asesor específico
            if ($request->filled('advisor_id') && $request->input('advisor_id') !== 'TODOS') {
                $query->where('user_id', $request->input('advisor_id'));
            }
        }

        // Filtros opcionales
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('stage') && $request->stage !== 'TODAS') {
            $query->where('stage', $request->stage);
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->whereLike('name', "%{$s}%")
                  ->orWhereLike('phone', "%{$s}%")
                  ->orWhereLike('email', "%{$s}%");
            });
        }

        $stageTotals = (clone $query)->reorder()->toBase()
            ->selectRaw('stage, count(*) as count, sum(budget) as budget')
            ->groupBy('stage')->get()->keyBy('stage');
        $count = fn (string $stage) => (int) ($stageTotals->get($stage)->count ?? 0);
        $total = (int) $stageTotals->sum('count');
        $stats = [
            'total' => $total,
            'nuevo' => $count('Nuevo Prospecto'),
            'visita' => $count('Visita Agendada'),
            'negociacion' => $count('En Negociación'),
            'ganado' => $count('Cierre Ganado'),
            'descartado' => $count('Descartado'),
            'activos' => $total - $count('Cierre Ganado') - $count('Descartado'),
            'total_pipeline_value' => $stageTotals->except('Descartado')->sum('budget'),
        ];

        if ($request->input('view') === 'discarded') {
            $query->where('stage', 'Descartado');
        } elseif ($request->input('view') === 'kanban') {
            $query->where('stage', '!=', 'Descartado');
        }

        $leads = $query->paginate($this->perPage($request))->withQueryString();

        // ==========================================================
        // RESUMEN DE RENDIMIENTO POR ASESOR (Solo para Super Admin)
        // Regla: Excluir estrictamente a 'Administrador' y 'Topógrafo'.
        // Mostrar únicamente a 'Asesor Comercial' (y Super Admin solo si gestiona ventas).
        // ==========================================================
        $advisorsSummary = [];
        $advisorsList = [];

        if ($isSuperAdmin) {
            // Agrupación contable de todos los prospectos en la base de datos
            $leadsGrouped = Lead::selectRaw("
                user_id,
                count(*) as total_assigned,
                count(case when stage in ('Visita Agendada', 'En Negociación') then 1 end) as in_negotiation_or_visit,
                count(case when stage = 'Cierre Ganado' then 1 end) as won_count,
                count(case when stage = 'Descartado' then 1 end) as discarded_count,
                count(case when stage not in ('Cierre Ganado', 'Descartado') then 1 end) as active_count
            ")->groupBy('user_id')->get()->keyBy('user_id');

            // Filtrado estricto en BD: excluir por completo Administradores y Topógrafos
            $allUsers = User::select('id', 'name', 'email')->with('roles:id,name')
                ->whereDoesntHave('roles', function ($q) {
                    $q->whereIn('name', ['Administrador', 'Topógrafo']);
                })
                ->where(function ($q) {
                    $q->whereHas('roles', function ($sub) {
                        $sub->where('name', 'Asesor Comercial');
                    })->orWhere(function ($sub) {
                        $sub->whereHas('roles', function ($r) {
                            $r->where('name', 'Super Admin');
                        })->whereHas('leads'); // Solo si el Super Admin gestiona ventas activas
                    });
                })
                ->orderBy('name', 'asc')
                ->get()
                ->filter(function ($u) use ($leadsGrouped) {
                    $roleName = $u->roles->first()?->name ?? '';
                    if (in_array($roleName, ['Administrador', 'Topógrafo'])) {
                        return false;
                    }
                    if ($roleName === 'Asesor Comercial') {
                        return true;
                    }
                    if ($roleName === 'Super Admin' && $leadsGrouped->has($u->id)) {
                        return true;
                    }
                    return false;
                })
                ->values();

            $advisorsSummary = $allUsers->map(function ($adv) use ($leadsGrouped) {
                $advStats = $leadsGrouped->get($adv->id);
                return [
                    'id' => $adv->id,
                    'name' => $adv->name,
                    'email' => $adv->email,
                    'role' => $adv->roles->first()?->name ?? 'Asesor Comercial',
                    'total_assigned' => $advStats ? (int) $advStats->total_assigned : 0,
                    'in_negotiation_or_visit' => $advStats ? (int) $advStats->in_negotiation_or_visit : 0,
                    'won_count' => $advStats ? (int) $advStats->won_count : 0,
                    'discarded_count' => $advStats ? (int) $advStats->discarded_count : 0,
                    'active_count' => $advStats ? (int) $advStats->active_count : 0,
                ];
            });

            $advisorsList = $allUsers->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->roles->first()?->name ?? 'Asesor Comercial',
            ]);
        }

        $responseData = [
            'success' => true,
            'is_super_admin' => $isSuperAdmin,
            ...$leads->toArray(),
            'stats' => $stats,
        ];

        if ($isSuperAdmin) {
            $responseData['advisors_summary'] = $advisorsSummary;
            $responseData['advisors_list'] = $advisorsList;
        }

        return response()->json($responseData);
    }

    /**
     * Registrar un nuevo prospecto comercial
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($user, $request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'stage' => 'nullable|string',
            'notes' => 'nullable|string|max:1000',
            'budget' => 'nullable|numeric|min:0',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $name = strip_tags(trim($validated['name']));
        $phone = !empty($validated['phone']) ? strip_tags(trim($validated['phone'])) : null;
        $notes = !empty($validated['notes']) ? strip_tags(trim($validated['notes'])) : null;
        $stage = $validated['stage'] ?? 'Nuevo Prospecto';

        // Si es Asesor Comercial, asignar obligatoriamente a sí mismo. Si es Super Admin, respetar elección o default.
        if (!$isSuperAdmin) {
            $assignedUserId = $user ? $user->id : 1;
        } else {
            $assignedUserId = !empty($validated['user_id']) ? (int) $validated['user_id'] : ($user ? $user->id : 1);
        }

        $lead = Lead::create([
            'name' => $name,
            'phone' => $phone,
            'email' => $validated['email'] ?? null,
            'project_id' => $validated['project_id'] ?? null,
            'user_id' => $assignedUserId,
            'stage' => $stage,
            'notes' => $notes,
            'budget' => $validated['budget'] ?? 0,
        ]);

        // Registrar en Auditoría del Sistema
        $lead->load(['project', 'advisor']);
        $advisorName = $lead->advisor?->name ?? 'Sin Asignar';
        AuditLog::record(
            $user ? $user->id : 1,
            'Marketing & CRM',
            "Registró prospecto '{$lead->name}' en etapa '{$lead->stage}', asignado al asesor {$advisorName}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Prospecto {$lead->name} registrado exitosamente asignado a {$advisorName}.",
            'data' => $lead,
        ], 201);
    }

    /**
     * Actualizar datos y reasignación de asesor del prospecto
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($user, $request);

        $lead = Lead::with('advisor')->findOrFail($id);

        // Regla de Seguridad: un asesor solo puede modificar prospectos donde lead->user_id === auth()->id()
        if (!$isSuperAdmin && $lead->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. No tienes permisos para modificar un prospecto asignado a otro asesor.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'stage' => 'nullable|string',
            'notes' => 'nullable|string|max:1000',
            'budget' => 'nullable|numeric|min:0',
            'user_id' => 'nullable|exists:users,id',
            'discard_reason' => 'nullable|string|max:500',
        ]);

        if (isset($validated['name'])) {
            $validated['name'] = strip_tags(trim($validated['name']));
        }
        if (isset($validated['phone'])) {
            $validated['phone'] = strip_tags(trim($validated['phone']));
        }
        if (isset($validated['notes'])) {
            $validated['notes'] = strip_tags(trim($validated['notes']));
        }
        if (isset($validated['discard_reason'])) {
            $validated['discard_reason'] = strip_tags(trim($validated['discard_reason']));
        }

        // Solo Super Admin puede reasignar a otro asesor
        if (!$isSuperAdmin) {
            unset($validated['user_id']);
        }

        // Detectar si hubo reasignación
        $reassigned = false;
        $prevAdvisorName = $lead->advisor?->name ?? 'General';
        if ($isSuperAdmin && isset($validated['user_id']) && $validated['user_id'] != $lead->user_id) {
            $reassigned = true;
        }

        // Si cambia a descartado, registrar motivo
        if (isset($validated['stage']) && $validated['stage'] === 'Descartado') {
            $validated['discard_reason'] = $validated['discard_reason'] ?? $request->input('discard_reason');
        }

        $lead->update($validated);
        $lead->load(['project', 'advisor', 'customer']);

        // Registrar auditoría de reasignación si ocurrió
        if ($reassigned) {
            $newAdvisorName = $lead->advisor?->name ?? 'Nuevo Asesor';
            AuditLog::record(
                $user->id,
                'Marketing & CRM',
                "Reasignó prospecto '{$lead->name}' de {$prevAdvisorName} a {$newAdvisorName}",
                $request->ip(),
                $request->userAgent()
            );
        }

        return response()->json([
            'success' => true,
            'message' => "Prospecto {$lead->name} actualizado exitosamente.",
            'data' => $lead,
        ]);
    }

    /**
     * Actualizar la etapa del prospecto en el tablero Kanban y registrar motivos de descarte.
     */
    public function updateStage(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($user, $request);

        $lead = Lead::findOrFail($id);

        // Regla de Seguridad
        if (!$isSuperAdmin && $lead->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. No tienes permisos para mover de etapa prospectos de otro asesor.',
            ], 403);
        }

        $validated = $request->validate([
            'stage' => 'required|string|in:Nuevo Prospecto,Visita Agendada,En Negociación,Cierre Ganado,Descartado',
            'discard_reason' => 'nullable|string|max:500',
        ]);

        $updateData = ['stage' => $validated['stage']];
        if ($validated['stage'] === 'Descartado') {
            $updateData['discard_reason'] = $validated['discard_reason'] ?? $request->input('discard_reason', 'Descartado por asesor comercial');
        }

        $prevStage = $lead->stage;
        $lead->update($updateData);

        // Auditoría
        $logAction = "Movió prospecto '{$lead->name}' de '{$prevStage}' a '{$lead->stage}'";
        if ($lead->stage === 'Descartado') {
            $logAction .= ". Motivo de descarte: {$lead->discard_reason}";
        }
        AuditLog::record(
            $user ? $user->id : 1,
            'Marketing & CRM',
            $logAction,
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Prospecto movido a etapa '{$lead->stage}'.",
            'data' => $lead->load(['project', 'customer', 'advisor']),
        ]);
    }

    /**
     * Convierte automáticamente un prospecto en cliente real de customers,
     * asignando assigned_user_id al asesor responsable.
     */
    public function convert(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($user, $request);

        $lead = Lead::with(['project', 'advisor'])->findOrFail($id);

        if (!$isSuperAdmin && $lead->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. No puedes convertir un prospecto asignado a otro asesor.',
            ], 403);
        }

        // Si ya tiene un cliente asociado, retornarlo
        if ($lead->customer_id) {
            $customer = Customer::find($lead->customer_id);
            if ($customer) {
                $slug = $lead->project ? Str::slug($lead->project->name) : 'bosque-urbano';
                return response()->json([
                    'success' => true,
                    'message' => "El prospecto ya está registrado como cliente ({$customer->name}).",
                    'customer' => $customer,
                    'project' => $lead->project,
                    'redirect_url' => "/proyectos/{$slug}/lotes",
                ]);
            }
        }

        // Buscar cliente existente por email o teléfono, o crearlo
        $email = $lead->email ?: ('lead' . $lead->id . '@inmuebles.com');
        $phone = $lead->phone ?: '0990000000';
        $idCard = $request->input('id_card') ?: ('PROV-' . str_pad($lead->id, 5, '0', STR_PAD_LEFT));

        $customer = Customer::where('email', $email)
            ->orWhere('id_card', $idCard)
            ->first();

        $advisorId = $lead->user_id ?: ($user ? $user->id : 1);

        if (!$customer) {
            $customer = Customer::create([
                'name' => $lead->name,
                'email' => $email,
                'phone' => $phone,
                'id_card' => $idCard,
                'assigned_user_id' => $advisorId,
            ]);
        } else {
            // Asignar el asesor si no tenía uno asignado
            if (!$customer->assigned_user_id) {
                $customer->update(['assigned_user_id' => $advisorId]);
            }
        }

        // Actualizar lead a Cierre Ganado y vincular customer_id
        $lead->update([
            'customer_id' => $customer->id,
            'stage' => 'Cierre Ganado',
        ]);

        $advisorName = $lead->advisor?->name ?? ($user ? $user->name : 'Asesor');
        AuditLog::record(
            $user ? $user->id : 1,
            'Marketing & CRM',
            "Cierre Ganado: Convirtió prospecto '{$lead->name}' a Cliente formal. Asesor responsable: {$advisorName}",
            $request->ip(),
            $request->userAgent()
        );

        $slug = $lead->project ? Str::slug($lead->project->name) : 'bosque-urbano';

        return response()->json([
            'success' => true,
            'message' => "¡Prospecto {$lead->name} convertido en Cliente con éxito por el asesor {$advisorName}!",
            'customer' => $customer,
            'project' => $lead->project,
            'redirect_url' => "/proyectos/{$slug}/lotes",
        ]);
    }

    /**
     * Eliminar prospecto
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($user, $request);

        $lead = Lead::findOrFail($id);

        if (!$isSuperAdmin && $lead->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. No tienes permisos para eliminar prospectos de otro asesor.',
            ], 403);
        }

        $name = $lead->name;
        $lead->delete();

        AuditLog::record(
            $user ? $user->id : 1,
            'Marketing & CRM',
            "Eliminó prospecto '{$name}' del pipeline comercial",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Prospecto {$name} eliminado.",
        ]);
    }
}
