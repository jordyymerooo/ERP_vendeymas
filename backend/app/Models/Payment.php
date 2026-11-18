<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'lot_id',
        'deed_id',
        'topography_job_id',
        'user_id',
        'receipt_book',
        'book_sequence',
        'receipt_code',
        'concept_detail',
        'amount_paid',
        'status',
        'void_reason',
        'voided_at',
        'voided_by',
        'debt_balance',
        'payment_method',
        'bank_reference',
        'signature_base64',
        'customer_signature',
        'receipt_pdf_url',
        'pdf_path',
        'pdf_generated_at',
    ];

    protected $casts = [
        'amount_paid' => 'decimal:2',
        'debt_balance' => 'decimal:2',
        'book_sequence' => 'integer',
        'voided_at' => 'datetime',
        'pdf_generated_at' => 'datetime',
    ];

    /**
     * Un pago puede pertenecer a un lote (opcional en caso de ser pago exclusivo de trámite o topografía).
     */
    public function lot(): BelongsTo
    {
        return $this->belongsTo(Lot::class);
    }

    /**
     * Pago vinculado a un trámite legal de escritura (opcional).
     */
    public function deed(): BelongsTo
    {
        return $this->belongsTo(Deed::class, 'deed_id');
    }

    /**
     * Pago vinculado a un trabajo de topografía (opcional).
     */
    public function topographyJob(): BelongsTo
    {
        return $this->belongsTo(TopographyJob::class, 'topography_job_id');
    }

    /**
     * Cajero / Asesor / Administrador que emitió el pago.
     */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    /**
     * Usuario que anuló el pago (si aplica).
     */
    public function voidedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->withTrashed();
    }

    /**
     * Scope para pagos válidos contablemente.
     */
    public function scopeValid($query)
    {
        return $query->where('status', 'Válido');
    }

    /**
     * Scope para pagos anulados.
     */
    public function scopeVoided($query)
    {
        return $query->where('status', 'Anulado');
    }
}
