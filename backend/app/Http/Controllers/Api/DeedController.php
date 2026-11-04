<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Deed;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeedController extends Controller
{
    /**
     * Retorna el listado del pipeline de escrituras (12 etapas).
     * El 'Super Admin' (CEO) puede ver y filtrar escrituras de todos los proyectos y administradores.
     * El 'Administrador' ve y gestiona escrituras de sus proyectos asignados.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $simulatedRole = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role') ?: $request->query('simulate_role');

        $query = Deed::with([
            'customer:id,name,id_card,phone,email',
            'lot:id,lot_number,project_id',
            'project:id,name,location',
            'assignedAdmin:id,name,email',
        ])->withSum([
            'payments as payments_sum_amount_paid' => function ($q) {
                $q->where('status', 'Válido');
            }
        ], 'amount_paid');

        // Determinar si aplica el filtro estricto de proyectos asignados
        $isAdminRole = ($user && $user->hasRole('Administrador') && !$user->hasRole('Super Admin') && $user->id !== 1)
            || ($simulatedRole === 'Administrador');

        if ($isAdminRole) {
            $effectiveAdmin = ($user && $user->hasRole('Administrador')) 
                ? $user 
                : (User::where('email', 'administrador1@vendeymas.com')->first() 
                   ?: User::whereHas('assignedProjects')->first() 
                   ?: User::role('Administrador')->first());

            $assignedProjectIds = $effectiveAdmin ? $effectiveAdmin->assignedProjects()->pluck('projects.id')->toArray() : [];
            $query->whereIn('project_id', $assignedProjectIds);
        } else {
            // Filtro exclusivo para el CEO por administrador responsable
            if ($request->filled('assigned_admin_id') && $request->assigned_admin_id !== 'all') {
                $query->where('assigned_admin_id', $request->assigned_admin_id);
            }
        }

        // Filtro por proyecto
        if ($request->filled('project_id') && $request->project_id !== 'all') {
            $query->where('project_id', $request->project_id);
        }

        // Filtro por etapa (de las 12 etapas)
        if ($request->filled('stage') && $request->stage !== 'all') {
            $query->where('stage', $request->stage);
        }

        // Búsqueda por cliente o cédula
        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('customer', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('id_card', 'like', "%{$search}%");
            });
        }

        $deeds = $query->orderBy('updated_at', 'desc')->get();

        // Calcular balances y porcentajes de avance
        $deeds->transform(function ($deed) {
            $totalBudget = (float) $deed->total_budget;
            $paid = (float) ($deed->payments_sum_amount_paid ?? 0);
            $pending = max(0, round($totalBudget - $paid, 2));

            $stageIndex = array_search($deed->stage, Deed::STAGES);
            $stageNum = $stageIndex !== false ? $stageIndex + 1 : 1;
            $progressPercent = round(($stageNum / count(Deed::STAGES)) * 100);

            $deed->total_budget = $totalBudget;
            $deed->total_paid = $paid;
            $deed->pending_balance = $pending;
            $deed->stage_number = $stageNum;
            $deed->progress_percent = $progressPercent;

            return $deed;
        });

        return response()->json([
            'success' => true,
            'stages' => Deed::STAGES,
            'data' => $deeds,
        ]);
    }

    /**
     * Registra un nuevo trámite de escrituración.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'lot_id' => 'nullable|exists:lots,id',
            'project_id' => 'required|exists:projects,id',
            'assigned_admin_id' => 'nullable|exists:users,id',
            'stage' => ['nullable', Rule::in(Deed::STAGES)],
            'total_budget' => 'nullable|numeric|min:0|max:999999',
            'notes' => 'nullable|string|max:1000',
        ]);

        if (isset($validated['notes'])) {
            $validated['notes'] = strip_tags(trim($validated['notes']));
        }

        $deed = Deed::create([
            'customer_id' => $validated['customer_id'],
            'lot_id' => $validated['lot_id'] ?? null,
            'project_id' => $validated['project_id'],
            'assigned_admin_id' => $validated['assigned_admin_id'] ?? auth()->id(),
            'stage' => $validated['stage'] ?? 'Informe',
            'total_budget' => $validated['total_budget'] ?? 0,
            'notes' => $validated['notes'] ?? null,
        ]);

        AuditLog::record(
            auth()->id() ?? 1,
            'Escrituras',
            "Inició trámite de escritura #{$deed->id} (Etapa: {$deed->stage}) para cliente #{$deed->customer_id}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Trámite de escritura registrado exitosamente.',
            'data' => $deed->load(['customer', 'lot', 'project', 'assignedAdmin']),
        ], 201);
    }

    /**
     * Actualiza los datos generales de un trámite de escritura.
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $deed = Deed::findOrFail($id);

        $validated = $request->validate([
            'customer_id' => 'sometimes|required|exists:customers,id',
            'lot_id' => 'nullable|exists:lots,id',
            'project_id' => 'sometimes|required|exists:projects,id',
            'assigned_admin_id' => 'nullable|exists:users,id',
            'stage' => ['sometimes', 'required', Rule::in(Deed::STAGES)],
            'total_budget' => 'nullable|numeric|min:0|max:999999',
            'notes' => 'nullable|string|max:1000',
        ]);

        if (isset($validated['notes'])) {
            $validated['notes'] = strip_tags(trim($validated['notes']));
        }

        $oldStage = $deed->stage;
        $oldNotes = $deed->notes;
        $deed->update($validated);

        if (isset($validated['stage']) && $validated['stage'] !== $oldStage) {
            AuditLog::record(
                auth()->id() ?? 1,
                'Escrituras',
                "Avanzó trámite de escritura #{$deed->id} de '{$oldStage}' a '{$deed->stage}'",
                $request->ip(),
                $request->userAgent()
            );
        }

        if (array_key_exists('notes', $validated) && $validated['notes'] !== $oldNotes) {
            AuditLog::record(
                auth()->id() ?? 1,
                'Escrituras',
                "Actualizó nota de situación para trámite de escritura #{$deed->id}",
                $request->ip(),
                $request->userAgent()
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Trámite de escritura actualizado exitosamente.',
            'data' => $deed->fresh(['customer', 'lot', 'project', 'assignedAdmin']),
        ]);
    }

    /**
     * Actualiza específicamente la etapa en el pipeline de 12 pasos.
     */
    public function updateStage(Request $request, int|string $id): JsonResponse
    {
        $deed = Deed::findOrFail($id);

        $validated = $request->validate([
            'stage' => ['required', Rule::in(Deed::STAGES)],
        ]);

        $oldStage = $deed->stage;
        $deed->update([
            'stage' => $validated['stage'],
        ]);

        AuditLog::record(
            auth()->id() ?? 1,
            'Escrituras',
            "Cambió etapa de escritura #{$deed->id} a '{$deed->stage}' (anterior: {$oldStage})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Escritura avanzada a etapa '{$deed->stage}'.",
            'data' => $deed->fresh(['customer', 'lot', 'project', 'assignedAdmin']),
        ]);
    }

    /**
     * Elimina un trámite de escritura.
     */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        $deed = Deed::findOrFail($id);
        $deedId = $deed->id;
        $deed->delete();

        AuditLog::record(
            auth()->id() ?? 1,
            'Escrituras',
            "Eliminó trámite de escritura #{$deedId}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Trámite de escritura eliminado con éxito.',
        ]);
    }
}
