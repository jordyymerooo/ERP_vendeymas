<?php

namespace App\Http\Controllers\Api;

use App\Helpers\RoleSecurity;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function requestPasswordReset(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => 'required|email']);
        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            return response()->json([
                'message' => 'No encontramos una cuenta asociada a ese correo electrónico.',
            ], 404);
        }

        if (RoleSecurity::isRealSuperAdmin($user)) {
            return response()->json([
                'type' => 'ceo',
                'message' => 'Por políticas de seguridad, el restablecimiento de la cuenta CEO / Gerencia debe solicitarse directamente al equipo de Desarrollo de Software para su intervención técnica en el servidor.',
            ]);
        }

        if (!$user->hasAnyRole(['Administrador', 'Asesor Comercial', 'Topógrafo'])) {
            return response()->json([
                'message' => 'El rol de esta cuenta requiere asistencia del equipo de Desarrollo de Software.',
            ], 422);
        }

        $user->update([
            'password_reset_requested' => true,
            'password_reset_requested_at' => now(),
        ]);

        return response()->json([
            'type' => 'staff',
            'message' => 'Solicitud enviada al CEO / Gerencia. Comuníquese con Gerencia para recibir su nueva contraseña temporal.',
        ]);
    }

    /**
     * Autenticación de usuarios y emisión de token personal de acceso Sanctum.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciales incorrectas. Verifique su correo y contraseña.',
            ], 401);
        }

        /** @var User $user */
        $user = Auth::user();

        // Generar token mediante Laravel Sanctum
        $token = $user->createToken('auth_token')->plainTextToken;

        // Registrar en Auditoría del Sistema
        AuditLog::record(
            $user->id,
            'Autenticación',
            'Inicio de sesión exitoso',
            $request->ip(),
            $request->userAgent()
        );

        return response()->json([
            'success' => true,
            'message' => 'Inicio de sesión exitoso.',
            'token' => $token,
            'user' => $user->load('roles'),
            'roles' => $user->getRoleNames(),
        ]);
    }

    /**
     * Cierre de sesión y revocación del token activo.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            // Registrar en Auditoría del Sistema
            AuditLog::record(
                $user->id,
                'Autenticación',
                'Cierre de sesión',
                $request->ip(),
                $request->userAgent()
            );

            // Revocar el token actual en base de datos
            $currentToken = $user->currentAccessToken();
            if ($currentToken) {
                $currentToken->delete();
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente.',
        ]);
    }

    /**
     * Retorna los datos y roles del usuario autenticado actualmente.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'user' => $user ? $user->load('roles') : null,
            'roles' => $user ? $user->getRoleNames() : [],
        ]);
    }
}
