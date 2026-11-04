<?php

namespace App\Helpers;

use App\Models\User;
use Illuminate\Http\Request;

class RoleSecurity
{
    /**
     * Resuelve de forma segura el rol activo del usuario autenticado.
     * Si la petición incluye headers o parámetros de simulación (X-Simulated-Role, role, simulate_role),
     * SOLO se aceptan si el usuario real en base de datos es Super Admin (ID 1 o con rol 'Super Admin').
     * Si el usuario es Administrador, Asesor Comercial o Topógrafo, cualquier intento de simulación
     * es ignorado y se fuerza estrictamente su rol real registrado en la base de datos.
     */
    public static function resolveActiveRole(Request $request, ?User $user = null): string
    {
        $user = $user ?: $request->user();
        if (!$user) {
            return 'Guest';
        }

        $isRealSuperAdmin = ($user->id === 1) 
            || (method_exists($user, 'hasRole') && $user->hasRole('Super Admin'))
            || (isset($user->roles) && $user->roles->contains('name', 'Super Admin'));

        // Obtener rol real de la base de datos
        $realRole = $user->roles->first()?->name ?? ($user->id === 1 ? 'Super Admin' : 'Asesor Comercial');

        if ($isRealSuperAdmin) {
            $simulated = $request->header('X-Simulated-Role')
                ?: $request->header('X-Simulate-Role')
                ?: $request->input('role')
                ?: $request->input('simulate_role');

            if ($simulated && in_array($simulated, ['Super Admin', 'CEO / Gerente', 'Administrador', 'Asesor Comercial', 'Topógrafo', 'Topografo'])) {
                return ($simulated === 'CEO / Gerente') ? 'Super Admin' : (($simulated === 'Topografo') ? 'Topógrafo' : $simulated);
            }
            return 'Super Admin';
        }

        // Usuario no Super Admin: estrictamente su rol real en base de datos
        return $realRole;
    }

    /**
     * Resuelve de forma exacta el usuario titular o efectivo que ejecuta la acción.
     * - Si el usuario autenticado NO es Super Admin (es un Asesor, Administrador o Topógrafo
     *   logueado con su propia cuenta), devuelve siempre su propio usuario: $request->user().
     * - Si el usuario autenticado es Super Admin y está usando el selector de roles
     *   (X-Simulated-Role o X-Simulate-Role), devuelve el usuario titular de ese rol en base de datos
     *   para aislar su perfil y firmas del CEO.
     */
    public static function resolveEffectiveUser(Request $request, ?User $user = null): User
    {
        $authUser = $user ?: $request->user();
        if (!$authUser) {
            return User::find(1) ?? new User();
        }

        // Si el usuario autenticado NO es Super Admin: devuelve siempre su propio usuario
        if (!self::isRealSuperAdmin($authUser)) {
            return $authUser;
        }

        // Si es Super Admin con simulación de roles activa
        $activeRole = $request->header('X-Simulated-Role')
            ?: $request->header('X-Simulate-Role')
            ?: $request->input('role')
            ?: $request->input('simulate_role')
            ?: self::resolveActiveRole($request, $authUser);

        if ($activeRole === 'Administrador') {
            $adminUser = User::role('Administrador')->orderBy('id', 'asc')->first();
            return $adminUser ?: $authUser;
        }

        if ($activeRole === 'Asesor Comercial') {
            $asesorUser = User::role('Asesor Comercial')->orderBy('id', 'asc')->first();
            return $asesorUser ?: $authUser;
        }

        if ($activeRole === 'Topógrafo' || $activeRole === 'Topografo') {
            $topoUser = User::role('Topógrafo')->orderBy('id', 'asc')->first()
                ?: User::where('email', 'topografo@vendeymas.com')->first();
            return $topoUser ?: $authUser;
        }

        // Si el rol activo es 'CEO / Gerente' o 'Super Admin'
        return User::find(1) ?: $authUser;
    }

    /**
     * Verifica si el usuario actúa válidamente como Super Admin.
     */
    public static function isSuperAdmin(Request $request, ?User $user = null): bool
    {
        return self::resolveActiveRole($request, $user) === 'Super Admin';
    }

    /**
     * Verifica si el usuario es realmente Super Admin en base de datos (independientemente de simulación).
     */
    public static function isRealSuperAdmin(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        return ($user->id === 1)
            || (method_exists($user, 'hasRole') && $user->hasRole('Super Admin'))
            || (isset($user->roles) && $user->roles->contains('name', 'Super Admin'));
    }
}
