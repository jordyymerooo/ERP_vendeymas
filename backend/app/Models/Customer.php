<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'id_card',
        'assigned_user_id',
    ];

    /**
     * Un cliente puede poseer varios lotes.
     */
    public function lots(): HasMany
    {
        return $this->hasMany(Lot::class);
    }

    /**
     * Asesor comercial que captó o gestiona a este cliente.
     */
    public function advisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id')->withTrashed();
    }

    /**
     * Trámites de escrituración pertenecientes a este cliente.
     */
    public function deeds(): HasMany
    {
        return $this->hasMany(Deed::class);
    }
}
