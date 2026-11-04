<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->index('id_card', 'perf_customers_cedula');
            $table->index('name', 'perf_customers_name');
        });

        Schema::table('lots', function (Blueprint $table) {
            $table->index('project_id', 'perf_lots_project_id');
            $table->index('customer_id', 'perf_lots_customer_id');
            $table->index('status', 'perf_lots_status');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index('receipt_code', 'perf_payments_receipt_code');
            $table->index('payment_method', 'perf_payments_payment_method');
            $table->index('user_id', 'perf_payments_user_id');
            $table->index('lot_id', 'perf_payments_lot_id');
        });

        Schema::table('deeds', function (Blueprint $table) {
            $table->index('lot_id', 'perf_deeds_lot_id');
            $table->index('stage', 'perf_deeds_current_stage');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex('perf_customers_cedula');
            $table->dropIndex('perf_customers_name');
        });

        Schema::table('lots', function (Blueprint $table) {
            $table->dropIndex('perf_lots_project_id');
            $table->dropIndex('perf_lots_customer_id');
            $table->dropIndex('perf_lots_status');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('perf_payments_receipt_code');
            $table->dropIndex('perf_payments_payment_method');
            $table->dropIndex('perf_payments_user_id');
            $table->dropIndex('perf_payments_lot_id');
        });

        Schema::table('deeds', function (Blueprint $table) {
            $table->dropIndex('perf_deeds_lot_id');
            $table->dropIndex('perf_deeds_current_stage');
        });
    }
};
