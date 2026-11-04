<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'signature_base64',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Proyectos asignados a este usuario (exclusivo para Administradores asignados por el CEO).
     */
    public function assignedProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_user')->withTimestamps();
    }

    /**
     * Tareas administrativas asignadas a este usuario.
     */
    public function assignedTasks(): HasMany
    {
        return $this->hasMany(AdminTask::class, 'assigned_to');
    }

    /**
     * Tareas creadas por el CEO para Administradores.
     */
    public function createdTasks(): HasMany
    {
        return $this->hasMany(AdminTask::class, 'assigned_by');
    }

    /**
     * Escrituras legales donde este usuario es el Administrador responsable.
     */
    public function assignedDeeds(): HasMany
    {
        return $this->hasMany(Deed::class, 'assigned_admin_id');
    }

    /**
     * Prospectos comerciales asignados a este usuario (CRM).
     */
    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'user_id');
    }
}
