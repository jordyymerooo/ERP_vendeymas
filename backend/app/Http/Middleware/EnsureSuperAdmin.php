<?php

namespace App\Http\Middleware;

use App\Helpers\RoleSecurity;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    /**
     * Bloquea rutas críticas para que SOLO el Super Admin real pueda ejecutarlas.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!RoleSecurity::isRealSuperAdmin($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. Esta acción o módulo es exclusivo para el Super Administrador / CEO.',
            ], 403);
        }

        return $next($request);
    }
}
