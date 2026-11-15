<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    public function up(): void
    {
        if (!Storage::disk('public')->makeDirectory('recibos')) {
            throw new RuntimeException('No se pudo crear el directorio de archivo de recibos.');
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->string('pdf_path')->nullable();
            $table->timestamp('pdf_generated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['pdf_path', 'pdf_generated_at']);
        });
    }
};
