<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TopographyJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'client_name',
        'client_phone',
        'service_type',
        'location',
        'area_m2',
        'cost',
        'amount_paid',
        'status',
        'notes',
    ];

    protected $casts = [
        'area_m2' => 'float',
        'cost' => 'float',
        'amount_paid' => 'float',
    ];

    protected $appends = [
        'pending_balance',
    ];

    /**
     * Pagos vinculados al trabajo topográfico.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'topography_job_id');
    }

    /**
     * Calcula el saldo pendiente por cobrar
     */
    public function getPendingBalanceAttribute(): float
    {
        return max(0, (float) $this->cost - (float) $this->amount_paid);
    }
}
