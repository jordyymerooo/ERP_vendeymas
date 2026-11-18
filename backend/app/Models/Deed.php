<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Deed extends Model
{
    use HasFactory;

    /**
     * Las 12 etapas oficiales en orden estricto del pipeline de escrituras.
     */
    public const STAGES = [
        'Informe',
        'Demanda',
        'Inscripción',
        'Calificación',
        'Citaciones',
        'Audiencia Uno',
        'Audiencia Dos',
        'Sentencia',
        'Copias de Sentencia',
        'Municipio',
        'Notaría',
        'Registro de la Propiedad',
    ];

    protected $fillable = [
        'customer_id',
        'lot_id',
        'project_id',
        'assigned_admin_id',
        'stage',
        'total_budget',
        'notes',
    ];

    protected $casts = [
        'total_budget' => 'decimal:2',
    ];

    /**
     * Cliente titular de la escritura.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Lote correspondiente (opcional si es trámite general o vinculado a un lote).
     */
    public function lot(): BelongsTo
    {
        return $this->belongsTo(Lot::class);
    }

    /**
     * Proyecto inmobiliario al que pertenece la escritura.
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Administrador responsable de gestionar este trámite legal de escritura.
     */
    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_admin_id')->withTrashed();
    }

    /**
     * Pagos o abonos realizados a este trámite de escrituración.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'deed_id');
    }
}
