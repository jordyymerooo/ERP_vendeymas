<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReceiptSequence extends Model
{
    protected $fillable = ['last_manual_number'];

    protected $casts = ['last_manual_number' => 'integer'];

    public const PREFIXES = [
        'GERENCIA' => 'GER-',
        'ADMINISTRACION' => 'ADM-',
        'ASESORIA' => 'ASE-',
        'TOPOGRAFIA' => 'TOP-',
    ];

    public function maxDigitalNumber(): int
    {
        return (int) Payment::where('receipt_code', 'like', $this->prefix.'%')
            ->whereRaw('receipt_code ~ ?', ['^'.$this->prefix.'[0-9]+$'])
            ->selectRaw('MAX(CAST(SUBSTRING(receipt_code FROM CAST(? AS integer)) AS bigint)) AS number', [strlen($this->prefix) + 1])
            ->first()->number;
    }

    public function formatNumber(int $number): string
    {
        return $this->prefix.str_pad((string) $number, 5, '0', STR_PAD_LEFT);
    }

    public function summary(): array
    {
        $digital = $this->maxDigitalNumber();
        $current = max($this->last_manual_number, $digital);

        return [
            'prefix' => $this->prefix,
            'book_name' => $this->book_name,
            'last_manual_number' => $this->last_manual_number,
            'max_digital_number' => $digital,
            'current_number' => $current,
            'next_receipt_code' => $this->formatNumber($current + 1),
        ];
    }
}


