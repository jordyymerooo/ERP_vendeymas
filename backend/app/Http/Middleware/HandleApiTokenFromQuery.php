<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class HandleApiTokenFromQuery
{
    /**
     * Permite autenticación Sanctum vía query param (?token=...) para descargas directas de PDFs.
     */
    public function handle(Request $request, Closure $next)
    {
        if (!$request->bearerToken() && $request->has('token')) {
            $token = $request->query('token');
            if (!empty($token)) {
                $request->headers->set('Authorization', 'Bearer ' . $token);
            }
        }

        return $next($request);
    }
}
