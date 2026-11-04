<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SystemBackupController extends Controller
{
    public function downloadBackup(Request $request): BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $backupDirectory = storage_path('app/Laravel');
        $files = File::glob($backupDirectory . DIRECTORY_SEPARATOR . '*.zip');

        if (empty($files)) {
            return response()->json([
                'success' => false,
                'message' => 'No existe un respaldo ZIP disponible. Ejecuta backup:run.',
            ], 404);
        }

        usort($files, fn (string $a, string $b) => filemtime($b) <=> filemtime($a));
        $backup = $files[0];

        $user = $request->user();
        AuditLog::record(
            $user->id,
            'Seguridad',
            'Descargó el respaldo ZIP más reciente: ' . basename($backup),
            $request->ip(),
            $request->userAgent()
        );

        return response()->download($backup, basename($backup), [
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
