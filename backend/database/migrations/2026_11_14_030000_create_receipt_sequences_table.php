<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receipt_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('prefix', 4)->unique();
            $table->string('book_name');
            $table->unsignedInteger('last_manual_number')->default(0);
            $table->timestamps();
        });

        $now = now();
        DB::table('receipt_sequences')->insert([
            ['prefix' => 'GER-', 'book_name' => 'Gerencia / CEO', 'created_at' => $now, 'updated_at' => $now],
            ['prefix' => 'ADM-', 'book_name' => 'Administración', 'created_at' => $now, 'updated_at' => $now],
            ['prefix' => 'ASE-', 'book_name' => 'Asesoría Comercial', 'created_at' => $now, 'updated_at' => $now],
            ['prefix' => 'TOP-', 'book_name' => 'Topografía', 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_sequences');
    }
};
