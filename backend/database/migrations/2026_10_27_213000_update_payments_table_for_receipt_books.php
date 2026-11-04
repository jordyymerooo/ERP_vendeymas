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
        // 1. En PostgreSQL, permitir que lot_id sea nullable
        DB::statement('ALTER TABLE payments ALTER COLUMN lot_id DROP NOT NULL;');

        // 2. Agregar nuevas columnas para las 4 reciberas y conceptos ampliados
        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'deed_id')) {
                $table->foreignId('deed_id')->nullable()->after('lot_id')->constrained('deeds')->nullOnDelete();
            }
            if (!Schema::hasColumn('payments', 'topography_job_id')) {
                $table->foreignId('topography_job_id')->nullable()->after('deed_id')->constrained('topography_jobs')->nullOnDelete();
            }
            if (!Schema::hasColumn('payments', 'receipt_book')) {
                $table->string('receipt_book')->default('ASESORIA')->after('topography_job_id');
            }
            if (!Schema::hasColumn('payments', 'book_sequence')) {
                $table->integer('book_sequence')->default(1)->after('receipt_book');
            }
            if (!Schema::hasColumn('payments', 'receipt_code')) {
                $table->string('receipt_code')->nullable()->index()->after('book_sequence');
            }
            if (!Schema::hasColumn('payments', 'concept_detail')) {
                $table->string('concept_detail')->nullable()->after('payment_method');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'concept_detail')) {
                $table->dropColumn('concept_detail');
            }
            if (Schema::hasColumn('payments', 'receipt_code')) {
                $table->dropColumn('receipt_code');
            }
            if (Schema::hasColumn('payments', 'book_sequence')) {
                $table->dropColumn('book_sequence');
            }
            if (Schema::hasColumn('payments', 'receipt_book')) {
                $table->dropColumn('receipt_book');
            }
            if (Schema::hasColumn('payments', 'topography_job_id')) {
                $table->dropForeign(['topography_job_id']);
                $table->dropColumn('topography_job_id');
            }
            if (Schema::hasColumn('payments', 'deed_id')) {
                $table->dropForeign(['deed_id']);
                $table->dropColumn('deed_id');
            }
        });
    }
};
