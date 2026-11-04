<?php

namespace App\Http\Controllers\Api;

use App\Helpers\RoleSecurity;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Retorna el listado completo de usuarios junto con sus roles y proyectos asignados.
     */
    public function index(): JsonResponse
    {
        $users = User::with(['roles', 'assignedProjects'])->orderBy('id', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Valida que el usuario sea Super Admin real.
     */
    private function ensureSuperAdmin(Request $request): ?JsonResponse
    {
        if (!\App\Helpers\RoleSecurity::isRealSuperAdmin($request->user())) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. Esta acción de gestión de usuarios es exclusiva para el Super Administrador.',
            ], 403);
        }
        return null;
    }

    /**
     * Crea un nuevo empleado/asesor y le asigna su rol y proyectos correspondientes.
     */
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:6',
            'role' => 'required|string|exists:roles,name',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $name = strip_tags(trim($validated['name']));
        $phone = isset($validated['phone']) ? strip_tags(trim($validated['phone'])) : '0989996421';

        $user = User::create([
            'name' => $name,
            'email' => $validated['email'],
            'phone' => $phone,
            'password' => Hash::make($validated['password']),
        ]);

        $user->assignRole($validated['role']);

        if ($request->has('project_ids')) {
            $user->assignedProjects()->sync($request->input('project_ids', []));
        }

        // Auditoría
        AuditLog::record(
            $request->user()?->id ?? 1,
            'Usuarios',
            "Registró nuevo usuario: {$user->name} con rol '{$validated['role']}'",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Usuario creado exitosamente con el rol asignado.',
            'data' => $user->load(['roles', 'assignedProjects']),
        ], 201);
    }

    /**
     * Retorna los datos de un usuario específico.
     */
    public function show(string|int $id): JsonResponse
    {
        $user = User::with(['roles', 'assignedProjects'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * Actualiza la información, el rol y los proyectos asignados de un usuario.
     */
    public function update(Request $request, string|int $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:6',
            'role' => 'required|string|exists:roles,name',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $userData = [
            'name' => strip_tags(trim($validated['name'])),
            'email' => $validated['email'],
        ];

        if ($request->has('phone')) {
            $userData['phone'] = !empty($validated['phone']) ? strip_tags(trim($validated['phone'])) : '0989996421';
        }

        if (!empty($validated['password'])) {
            $userData['password'] = Hash::make($validated['password']);
        }

        $user->update($userData);
        $user->syncRoles([$validated['role']]);

        if ($request->has('project_ids')) {
            $user->assignedProjects()->sync($request->input('project_ids', []));
        }

        // Auditoría
        AuditLog::record(
            $request->user()?->id ?? 1,
            'Usuarios',
            "Actualizó información/rol de: {$user->name} (Rol: {$validated['role']})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Usuario y rol actualizados con éxito.',
            'data' => $user->load(['roles', 'assignedProjects']),
        ]);
    }

    /**
     * Elimina un usuario del sistema (impidiendo eliminar al Administrador Principal).
     */
    public function destroy(Request $request, string|int $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $user = User::findOrFail($id);

        // Regla de seguridad: Proteger al administrador principal
        if ((int)$user->id === 1 || ($user->hasRole('Super Admin') && User::role('Super Admin')->count() <= 1)) {
            return response()->json([
                'success' => false,
                'message' => 'No es posible eliminar al Administrador Principal del sistema.',
            ], 422);
        }

        $deletedName = $user->name;
        $deletedEmail = $user->email;
        $user->delete();

        // Auditoría
        AuditLog::record(
            $request->user()?->id ?? 1,
            'Usuarios',
            "Eliminó usuario del sistema: {$deletedName} ({$deletedEmail})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Usuario eliminado con éxito del sistema.',
        ]);
    }

    /**
     * Resuelve el usuario objetivo para la gestión de su firma digital.
     * Si el Super Admin envía un 'user_id' explícito desde el panel de administración,
     * se gestiona ese usuario en particular; de lo contrario, se resuelve el usuario
     * efectivo (propio o titular representativo por simulación de rol).
     */
    protected function resolveTargetUserForSignature(Request $request): User
    {
        if ($request->filled('user_id') && RoleSecurity::isRealSuperAdmin($request->user())) {
            return User::with('roles')->findOrFail($request->input('user_id'));
        }

        return RoleSecurity::resolveEffectiveUser($request)->loadMissing('roles');
    }

    /**
     * Retorna los datos de firma digital del usuario efectivo o especificado.
     * Formato: { user_id, name, role, signature_base64 }
     */
    public function getSignature(Request $request): JsonResponse
    {
        $targetUser = $this->resolveTargetUserForSignature($request);
        $roleName = $targetUser->roles->first()?->name ?? ($targetUser->id === 1 ? 'Super Admin' : 'Asesor Comercial');

        return response()->json([
            'success' => true,
            'user_id' => $targetUser->id,
            'name' => $targetUser->name,
            'role' => $roleName,
            'signature_base64' => $targetUser->signature_base64,
        ]);
    }

    /**
     * Guarda o actualiza la firma digital (Base64) únicamente en la fila de $targetUser.
     */
    public function updateSignature(Request $request): JsonResponse
    {
        $request->validate([
            'signature_base64' => 'required|string',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $targetUser = $this->resolveTargetUserForSignature($request);
        $targetUser->update([
            'signature_base64' => $request->signature_base64,
        ]);

        $roleName = $targetUser->roles->first()?->name ?? ($targetUser->id === 1 ? 'Super Admin' : 'Asesor Comercial');

        AuditLog::record(
            $request->user()?->id ?? $targetUser->id,
            'Usuarios',
            "Actualizó la firma digital oficial de {$targetUser->name} ({$roleName})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Firma digital guardada exitosamente para {$targetUser->name}.",
            'user_id' => $targetUser->id,
            'name' => $targetUser->name,
            'role' => $roleName,
            'signature_base64' => $targetUser->signature_base64,
            'user' => $targetUser->fresh('roles'),
        ]);
    }

    /**
     * Elimina la firma digital (null) únicamente en la fila de $targetUser.
     */
    public function deleteSignature(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $targetUser = $this->resolveTargetUserForSignature($request);
        $targetUser->update([
            'signature_base64' => null,
        ]);

        $roleName = $targetUser->roles->first()?->name ?? ($targetUser->id === 1 ? 'Super Admin' : 'Asesor Comercial');

        AuditLog::record(
            $request->user()?->id ?? $targetUser->id,
            'Usuarios',
            "Eliminó la firma digital de {$targetUser->name} ({$roleName})",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Firma digital eliminada correctamente para {$targetUser->name}.",
            'user_id' => $targetUser->id,
            'name' => $targetUser->name,
            'role' => $roleName,
            'signature_base64' => null,
            'user' => $targetUser->fresh('roles'),
        ]);
    }

    /**
     * Asigna proyectos a un Administrador específico (Exclusivo CEO / Super Admin).
     */
    public function assignProjects(Request $request, int|string $id): JsonResponse
    {
        if ($denied = $this->ensureSuperAdmin($request)) {
            return $denied;
        }

        $user = User::findOrFail($id);

        $validated = $request->validate([
            'project_ids' => 'present|array',
            'project_ids.*' => 'exists:projects,id',
        ]);

        $user->assignedProjects()->sync($validated['project_ids']);

        AuditLog::record(
            auth()->id() ?? 1,
            'Usuarios',
            "Asignó " . count($validated['project_ids']) . " proyectos al administrador '{$user->name}'",
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => "Proyectos asignados exitosamente al administrador {$user->name}.",
            'user' => $user->fresh(['roles', 'assignedProjects']),
        ]);
    }
}


