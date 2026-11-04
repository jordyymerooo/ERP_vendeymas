<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Índices en customers
        Schema::table('customers', function (Blueprint $table) {
            $table->index('name', 'idx_customers_name');
            $table->index('id_card', 'idx_customers_id_card');
            $table->index('assigned_user_id', 'idx_customers_assigned_user_id');
        });

        // 2. Índices en lots
        Schema::table('lots', function (Blueprint $table) {
            $table->index(['project_id', 'status'], 'idx_lots_project_status');
            $table->index('customer_id', 'idx_lots_customer_id');
        });

        // 3. Índices en payments
        Schema::table('payments', function (Blueprint $table) {
            $table->index(['lot_id', 'status'], 'idx_payments_lot_status');
            $table->index('created_at', 'idx_payments_created_at');
            $table->index('status', 'idx_payments_status');
        });

        // 4. Índices en leads
        Schema::table('leads', function (Blueprint $table) {
            $table->index(['user_id', 'stage'], 'idx_leads_user_stage');
            $table->index('project_id', 'idx_leads_project_id');
        });

        // 5. Índices en audit_logs
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('module', 'idx_audit_logs_module');
            $table->index('created_at', 'idx_audit_logs_created_at');
            $table->index('user_id', 'idx_audit_logs_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex('idx_customers_name');
            $table->dropIndex('idx_customers_id_card');
            $table->dropIndex('idx_customers_assigned_user_id');
        });

        Schema::table('lots', function (Blueprint $table) {
            $table->dropIndex('idx_lots_project_status');
            $table->dropIndex('idx_lots_customer_id');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('idx_payments_lot_status');
            $table->dropIndex('idx_payments_created_at');
            $table->dropIndex('idx_payments_status');
        });

        Schema::table('leads', function (Blueprint $table) {
            $table->dropIndex('idx_leads_user_stage');
            $table->dropIndex('idx_leads_project_id');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_audit_logs_module');
            $table->dropIndex('idx_audit_logs_created_at');
            $table->dropIndex('idx_audit_logs_user_id');
        });
    }
};
