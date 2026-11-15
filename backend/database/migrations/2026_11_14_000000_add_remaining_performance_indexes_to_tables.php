<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEXES = [
        'audit_logs' => ['idx_audit_logs_action' => ['action']],
        'cheques' => ['idx_cheques_cheque_number' => ['cheque_number']],
        'leads' => ['idx_leads_stage' => ['stage'], 'idx_leads_created_at_id' => ['created_at', 'id']],
        'model_has_roles' => ['idx_model_has_roles_role_type' => ['role_id', 'model_type']],
        'payments' => ['idx_payments_book_created_at' => ['receipt_book', 'created_at']],
        'admin_tasks' => ['idx_admin_tasks_due_date' => ['due_date']],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            Schema::table($table, function (Blueprint $blueprint) use ($indexes) {
                foreach ($indexes as $name => $columns) {
                    $blueprint->index($columns, $name);
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            Schema::table($table, function (Blueprint $blueprint) use ($indexes) {
                foreach (array_keys($indexes) as $name) {
                    $blueprint->dropIndex($name);
                }
            });
        }
    }
};
