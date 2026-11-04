<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * Determina si el usuario autenticado tiene privilegios de Super Admin (CEO) de forma segura.
     */
    private function checkIsSuperAdmin(Request $request): bool
    {
        return \App\Helpers\RoleSecurity::isSuperAdmin($request, $request->user());
    }

    /**
     * Retorna el listado paginado de clientes con aislamiento por rol.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth()->user();
        $isSuperAdmin = $this->checkIsSuperAdmin($request);
        $simulate = $request->header('X-Simulate-Role') ?: $request->header('X-Simulated-Role') ?: $request->query('simulate_role');

        $query = Customer::select(['id', 'name', 'email', 'phone', 'id_card', 'assigned_user_id', 'created_at', 'updated_at'])
            ->with([
                'lots:id,project_id,customer_id,lot_number,total_price,status',
                'lots.project:id,name,location',
                'advisor:id,name,email'
            ]);

        // Reglas de Visibilidad por Rol:
        if ($isSuperAdmin) {
            // Super Admin (CEO) ve todos y puede filtrar por asesor o proyecto
            $query->when($request->filled('advisor_id') && $request->advisor_id !== 'all' && $request->advisor_id !== 'TODOS', function ($q) use ($request) {
                $q->where('assigned_user_id', $request->advisor_id);
            });
        } elseif (($user && $user->hasRole('Administrador')) || ($simulate === 'Administrador')) {
            // Administrador: solo ve los clientes de los proyectos que el CEO le haya asignado en project_user
            $effectiveAdmin = ($user && $user->hasRole('Administrador')) 
                ? $user 
                : (User::where('email', 'administrador1@vendeymas.com')->first() 
                   ?: User::whereHas('assignedProjects')->first() 
                   ?: User::role('Administrador')->first());
            $assignedProjectIds = $effectiveAdmin ? $effectiveAdmin->assignedProjects()->pluck('projects.id')->toArray() : [];
            $query->where(function ($q) use ($assignedProjectIds) {
                $q->whereHas('lots', function ($lotQ) use ($assignedProjectIds) {
                    $lotQ->whereIn('project_id', $assignedProjectIds);
                })->orWhereHas('deeds', function ($deedQ) use ($assignedProjectIds) {
                    $deedQ->whereIn('project_id', $assignedProjectIds);
                });
            });
        } elseif (($user && $user->hasRole('Asesor Comercial')) || ($simulate === 'Asesor Comercial')) {
            // Asesor Comercial: exclusivamente los clientes asignados a su cartera comercial
            $effectiveAsesor = ($user && $user->hasRole('Asesor Comercial')) ? $user : User::role('Asesor Comercial')->first();
            if ($effectiveAsesor) {
                $query->where('assigned_user_id', $effectiveAsesor->id);
            }
        }

        // Búsqueda por término
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('id_card', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%");
            });
        }

        $customers = $query->latest('id')->paginate(50);

        return response()->json($customers);
    }

    /**
     * Almacena un nuevo cliente en la base de datos real.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:50',
            'id_card' => 'required|string|max:50',
            'assigned_user_id' => 'nullable|exists:users,id',
        ]);

        $isSuperAdmin = $this->checkIsSuperAdmin($request);

        if (! $isSuperAdmin || empty($validated['assigned_user_id'])) {
            $validated['assigned_user_id'] = $request->user()?->id ?? 1;
        }

        $validated['name'] = strip_tags(trim($validated['name']));
        $validated['phone'] = strip_tags(trim($validated['phone']));
        $validated['id_card'] = strip_tags(trim($validated['id_card']));

        $customer = Customer::create($validated);

        // Registro de Auditoría
        AuditLog::record(
            $request->user()?->id ?? 1,
            'Clientes',
            "Registró nuevo cliente: {$customer->name} (CI: {$customer->id_card}) asignado a asesor ID #{$customer->assigned_user_id}",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'data' => $customer->load('advisor:id,name,email'),
        ], 201);
    }

    /**
     * Retorna un cliente específico con sus lotes relacionados.
     */
    public function show(string|int $id): JsonResponse
    {
        $customer = Customer::with(['lots.project', 'lots.payments', 'advisor:id,name,email'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $customer,
        ]);
    }

    /**
     * Actualiza el registro del cliente en la tabla customers de PostgreSQL.
     */
    public function update(Request $request, string|int $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'required|string|max:50',
            'id_card' => 'required|string|max:50',
            'assigned_user_id' => 'nullable|exists:users,id',
        ]);

        $validated['name'] = strip_tags(trim($validated['name']));
        $validated['phone'] = strip_tags(trim($validated['phone']));
        $validated['id_card'] = strip_tags(trim($validated['id_card']));

        $isSuperAdmin = $this->checkIsSuperAdmin($request);
        // Solo el Super Admin puede reasignar el cliente a otro asesor
        if (! $isSuperAdmin) {
            unset($validated['assigned_user_id']);
        }

        $customer->update($validated);

        // Registro de Auditoría
        AuditLog::record(
            $request->user()?->id ?? 1,
            'Clientes',
            "Actualizó información del cliente: {$customer->name} (CI: {$customer->id_card})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Cliente actualizado con éxito en la base de datos.',
            'data' => $customer->load(['lots.project', 'advisor:id,name,email']),
        ]);
    }

    /**
     * Elimina un cliente verificando que no posea propiedades activas.
     */
    public function destroy(Request $request, string|int $id): JsonResponse
    {
        $customer = Customer::findOrFail($id);

        // Regla de Seguridad: Verificar si el cliente tiene lotes asignados en la tabla lots
        if ($customer->lots()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar el cliente porque tiene propiedades activas a su nombre.',
            ], 422);
        }

        $customerName = $customer->name;
        $customerIdCard = $customer->id_card;
        $customer->delete();

        // Registro de Auditoría
        AuditLog::record(
            $request->user()?->id ?? 1,
            'Clientes',
            "Eliminó cliente del CRM: {$customerName} (CI: {$customerIdCard})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Cliente eliminado con éxito de la base de datos.',
        ]);
    }
}
