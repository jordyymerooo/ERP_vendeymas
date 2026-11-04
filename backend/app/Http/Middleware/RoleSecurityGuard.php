<?php

namespace App\Http\Middleware;

use App\Helpers\RoleSecurity;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleSecurityGuard
{
    /**
     * Blindaje contra suplantación de rol:
     * Si un usuario no es Super Admin real, elimina cualquier header o parámetro simulado
     * y fija el rol activo con su rol de base de datos.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            $isRealSuperAdmin = RoleSecurity::isRealSuperAdmin($user);

            if (!$isRealSuperAdmin) {
                // Eliminar cualquier intento de header o query parameter de simulación
                $request->headers->remove('X-Simulate-Role');
                $request->headers->remove('X-Simulated-Role');
                $request->query->remove('simulate_role');
                $request->query->remove('role');
                $request->request->remove('simulate_role');
                $request->request->remove('role');

                $realRole = $user->roles->first()?->name ?? 'Asesor Comercial';
                $request->attributes->set('active_role', $realRole);
            } else {
                $activeRole = RoleSecurity::resolveActiveRole($request, $user);
                $request->attributes->set('active_role', $activeRole);
            }
        }

        return $next($request);
    }
}
