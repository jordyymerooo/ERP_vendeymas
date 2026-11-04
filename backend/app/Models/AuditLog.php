<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'module',
        'action',
        'ip_address',
        'user_agent',
    ];

    /**
     * Un registro de auditoría pertenece a un usuario/colaborador.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Helper estático para registrar eventos de auditoría de forma rápida y limpia.
     */
    public static function record($userId, $module, $action, $ip = null, $userAgent = null)
    {
        return self::create([
            'user_id' => $userId,
            'module' => $module,
            'action' => $action,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
        ]);
    }
}
