<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const USER_REFERENCE_TABLES = [
        'payments',
        'customers',
        'leads',
        'cheques',
        'deeds',
        'audit_logs',
        'activity_logs',
        'admin_tasks',
        'app_notifications',
        'project_user',
    ];

    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'deleted_at')) {
                $table->softDeletes();
            }
            if (!Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });

        foreach (self::USER_REFERENCE_TABLES as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            foreach (Schema::getForeignKeys($table) as $foreignKey) {
                if ($foreignKey['foreign_table'] !== 'users' || $foreignKey['on_delete'] !== 'cascade') {
                    continue;
                }

                Schema::table($table, function (Blueprint $blueprint) use ($foreignKey) {
                    $blueprint->dropForeign($foreignKey['name'] ?? $foreignKey['columns']);
                    $blueprint->foreign($foreignKey['columns'], $foreignKey['name'])
                        ->references($foreignKey['foreign_columns'])
                        ->on('users')
                        ->onUpdate($foreignKey['on_update'])
                        ->restrictOnDelete();
                });
            }
        }
    }

    public function down(): void
    {
        throw new LogicException('Esta migración conserva el estado histórico de las cuentas y no admite reversión automática. La recuperación requiere una revisión previa de los datos.');
    }
};
