<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'location',
        'description',
        'status',
        'center_lat',
        'center_lng',
        'latitude',
        'longitude',
        'blueprint_image_url',
    ];

    protected $casts = [
        'center_lat' => 'float',
        'center_lng' => 'float',
        'latitude' => 'float',
        'longitude' => 'float',
    ];

    /**
     * Lotes pertenecientes al proyecto.
     */
    public function lots(): HasMany
    {
        return $this->hasMany(Lot::class);
    }

    /**
     * Administradores asignados a este proyecto por el CEO.
     */
    public function administrators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_user')->withTimestamps();
    }

    public function lotPayments(): HasManyThrough
    {
        return $this->hasManyThrough(Payment::class, Lot::class);
    }

    public function assignedUsers(): BelongsToMany
    {
        return $this->administrators();
    }

    /**
     * Escrituras del proyecto.
     */
    public function deeds(): HasMany
    {
        return $this->hasMany(Deed::class);
    }

    /**
     * Tareas asignadas vinculadas a este proyecto.
     */
    public function adminTasks(): HasMany
    {
        return $this->hasMany(AdminTask::class);
    }
}
