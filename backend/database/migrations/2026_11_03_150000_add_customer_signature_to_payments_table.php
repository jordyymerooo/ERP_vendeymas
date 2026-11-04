<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Agrega la columna customer_signature para almacenar la firma táctil del cliente
     * capturada en el pad de firma del modal de cobro directo.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->longText('customer_signature')->nullable()->after('signature_base64');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('customer_signature');
        });
    }
};

