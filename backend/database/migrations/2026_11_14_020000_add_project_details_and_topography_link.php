<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->text('description')->nullable();
        });
        Schema::table('topography_jobs', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->constrained()->cascadeOnDelete()->index();
        });
    }

    public function down(): void
    {
        Schema::table('topography_jobs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_id');
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
