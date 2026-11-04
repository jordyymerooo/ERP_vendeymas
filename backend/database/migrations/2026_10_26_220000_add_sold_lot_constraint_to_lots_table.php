<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Limpieza inmediata de registros inconsistentes: Lote vendido DEBE tener cliente obligatorio
        DB::table('lots')
            ->whereNull('customer_id')
            ->update(['status' => 'Disponible']);

        // 2. Agregar restricción CHECK nativa en PostgreSQL
        // Garantiza que es imposible en la BD que un lote tenga status = 'Vendido' con customer_id NULL
        DB::statement("ALTER TABLE lots ADD CONSTRAINT check_sold_lot_has_customer CHECK (status != 'Vendido' OR customer_id IS NOT NULL)");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE lots DROP CONSTRAINT IF EXISTS check_sold_lot_has_customer");
    }
};
