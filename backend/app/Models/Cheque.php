<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cheque extends Model
{
    use HasFactory;

    protected $fillable = [
        'bank_name',
        'cheque_number',
        'issue_date',
        'payee',
        'amount',
        'concept',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'issue_date' => 'date',
    ];

    /**
     * Scope para cheques emitidos.
     */
    public function scopeEmitido($query)
    {
        return $query->where('status', 'Emitido');
    }

    /**
     * Scope para cheques cobrados.
     */
    public function scopeCobrado($query)
    {
        return $query->where('status', 'Cobrado');
    }

    /**
     * Scope para cheques anulados.
     */
    public function scopeAnulado($query)
    {
        return $query->where('status', 'Anulado');
    }
}

