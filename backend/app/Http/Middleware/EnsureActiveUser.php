<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ($user->trashed() || !$user->is_active)) {
            return response()->json(['message' => 'Esta cuenta ha sido desactivada por Gerencia.'], 403);
        }

        return $next($request);
    }
}
