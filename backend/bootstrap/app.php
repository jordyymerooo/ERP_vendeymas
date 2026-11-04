<?php

use App\Http\Middleware\HandleApiTokenFromQuery;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Soporte de autenticación Sanctum vía query param (?token=...)
        $middleware->api(prepend: [
            HandleApiTokenFromQuery::class,
        ]);

        // Evitar error Route [login] not defined en peticiones API no autenticadas
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/login');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function (Request $request, Throwable $e) {
            if ($request->is('api/*')) {
                return true;
            }
            return $request->expectsJson();
        });

        // 1. Manejo seguro de validación (422)
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Los datos proporcionados no son válidos.',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        // 2. Manejo de autenticación (401)
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'No autenticado o sesión expirada. Inicie sesión nuevamente.',
                ], 401);
            }
        });

        // 3. Manejo de errores de base de datos SQL (500 blindado sin fugas de información)
        $exceptions->render(function (QueryException $e, Request $request) {
            if ($request->is('api/*')) {
                Log::error('API Database QueryException: ' . $e->getMessage(), [
                    'url' => $request->fullUrl(),
                    'method' => $request->method(),
                    'user_id' => $request->user()?->id,
                    'ip' => $request->ip(),
                ]);

                return response()->json([
                    'message' => 'Ocurrió un error procesando la solicitud.',
                ], 500);
            }
        });

        // 4. Manejo de excepciones generales
        $exceptions->render(function (Throwable $e, Request $request) {
            // Si la excepción ya empaqueta una respuesta HTTP directa (ej. RateLimiter custom response o abort con respuesta)
            if ($e instanceof \Illuminate\Http\Exceptions\HttpResponseException) {
                return $e->getResponse();
            }

            if ($request->is('api/*')) {
                // Rate Limit general
                if ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Demasiadas solicitudes. Por favor espere un momento antes de reintentar.',
                    ], 429);
                }

                // Respetar excepciones HTTP estándar (403 Forbidden, 404 Not Found, 429 Too Many Requests, etc.)
                if ($e instanceof HttpExceptionInterface) {
                    return response()->json([
                        'message' => $e->getMessage() ?: 'Error en la solicitud.',
                    ], $e->getStatusCode());
                }

                Log::error('API Unhandled Exception: ' . $e->getMessage(), [
                    'url' => $request->fullUrl(),
                    'method' => $request->method(),
                    'trace' => $e->getTraceAsString(),
                    'user_id' => $request->user()?->id,
                    'ip' => $request->ip(),
                ]);

                return response()->json([
                    'message' => 'Ocurrió un error procesando la solicitud.',
                ], 500);
            }
        });
    })->create();
