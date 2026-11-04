<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lot extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'customer_id',
        'lot_number',
        'area_m2',
        'total_price',
        'status',
        'installments_count',
        'sale_date',
        'payment_day',
        'coordinates_geojson',
    ];

    protected $casts = [
        'area_m2' => 'decimal:2',
        'total_price' => 'decimal:2',
        'installments_count' => 'integer',
        'payment_day' => 'integer',
        'sale_date' => 'date',
        'coordinates_geojson' => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function deeds(): HasMany
    {
        return $this->hasMany(Deed::class);
    }

    /**
     * Calcula dinámicamente el estado de mora real de este lote.
     */
    public function calculateMoraStatus(): array
    {
        if ($this->status !== 'Vendido' || !$this->customer_id) {
            return [
                'status' => 'DISPONIBLE',
                'label' => 'Disponible',
                'installments_count' => $this->installments_count ?? 12,
                'installment_amount' => 0,
                'due_installments' => 0,
                'expected_paid' => 0,
                'actual_paid' => 0,
                'overdue_amount' => 0,
                'overdue_installments' => 0,
                'payment_day' => $this->payment_day ?? 15,
                'sale_date' => null,
            ];
        }

        $totalPrice = (float) $this->total_price;
        $installmentsCount = max(1, (int) ($this->installments_count ?: 12));
        $installmentAmount = round($totalPrice / $installmentsCount, 2);
        $paymentDay = (int) ($this->payment_day ?: 15);

        $startDate = $this->sale_date 
            ? Carbon::parse($this->sale_date)->startOfDay()
            : ($this->created_at ? $this->created_at->copy()->startOfDay() : Carbon::now()->startOfDay());
        
        $currentDate = Carbon::now()->startOfDay();

        // Calcular cuántos vencimientos han ocurrido desde sale_date hasta la fecha actual
        $monthsPassed = $startDate->diffInMonths($currentDate);
        if ($currentDate->day >= $paymentDay && $currentDate->format('Y-m') !== $startDate->format('Y-m')) {
            $monthsPassed++;
        }
        if ($monthsPassed == 0 && $currentDate->day >= $paymentDay && $startDate->day <= $paymentDay) {
            $monthsPassed = 1;
        }

        $dueInstallments = min($installmentsCount, max(0, $monthsPassed));
        $expectedPaid = round($dueInstallments * $installmentAmount, 2);

        // Suma de pagos reales válidos únicamente
        $actualPaid = (float) ($this->relationLoaded('payments') 
            ? $this->payments->where('status', 'Válido')->sum('amount_paid') 
            : $this->payments()->where('status', 'Válido')->sum('amount_paid'));

        if ($actualPaid >= $totalPrice) {
            $status = 'AL DÍA';
            $label = 'Al Día';
            $overdueAmount = 0;
            $overdueInstallments = 0;
        } elseif ($actualPaid >= $expectedPaid) {
            $nextDueDay = min($currentDate->daysInMonth, $paymentDay);
            $nextDueDate = Carbon::create($currentDate->year, $currentDate->month, $nextDueDay)->startOfDay();
            if ($currentDate->day < $paymentDay && $nextDueDate->diffInDays($currentDate) <= 5) {
                $status = 'POR VENCER';
                $label = 'Por Vencer';
            } else {
                $status = 'AL DÍA';
                $label = 'Al Día';
            }
            $overdueAmount = 0;
            $overdueInstallments = 0;
        } else {
            $status = 'EN MORA';
            $label = 'En Mora';
            $overdueAmount = round($expectedPaid - $actualPaid, 2);
            $overdueInstallments = max(1, (int) ceil($overdueAmount / max(1, $installmentAmount)));
        }

        return [
            'status' => $status,
            'label' => $label,
            'installments_count' => $installmentsCount,
            'installment_amount' => $installmentAmount,
            'payment_day' => $paymentDay,
            'sale_date' => $startDate->toDateString(),
            'due_installments' => $dueInstallments,
            'expected_paid' => $expectedPaid,
            'actual_paid' => $actualPaid,
            'overdue_amount' => $overdueAmount,
            'overdue_installments' => $overdueInstallments,
        ];
    }
}
