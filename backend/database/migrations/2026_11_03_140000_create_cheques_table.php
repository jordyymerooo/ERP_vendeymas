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
        Schema::create('cheques', function (Blueprint $table) {
            $table->id();
            $table->string('bank_name'); // Banco o Cooperativa, ej. 'JEP', 'Pichincha', 'Jardín Azuayo'
            $table->string('cheque_number'); // Número de cheque
            $table->date('issue_date'); // Fecha de emisión
            $table->string('payee'); // A favor de / A quién va dirigido
            $table->decimal('amount', 12, 2); // Monto del cheque
            $table->text('concept'); // Concepto o detalle del cheque
            $table->string('status')->default('Emitido'); // 'Emitido', 'Cobrado', 'Anulado'
            $table->timestamps();

            $table->index('bank_name');
            $table->index('status');
            $table->index('issue_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cheques');
    }
};

