<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            if (!Schema::hasColumn('lots', 'installments_count')) {
                $table->integer('installments_count')->default(12)->after('total_price');
            }
            if (!Schema::hasColumn('lots', 'sale_date')) {
                $table->date('sale_date')->nullable()->after('installments_count');
            }
            if (!Schema::hasColumn('lots', 'payment_day')) {
                $table->integer('payment_day')->default(15)->after('sale_date');
            }
        });

        // Actualizar lotes vendidos existentes con fecha de venta para cálculo de mora real
        DB::table('lots')
            ->where('status', 'Vendido')
            ->whereNull('sale_date')
            ->update([
                'sale_date' => now()->subMonths(3)->toDateString(),
                'installments_count' => 12,
                'payment_day' => 15,
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lots', function (Blueprint $table) {
            $table->dropColumn(['installments_count', 'sale_date', 'payment_day']);
        });
    }
};
