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
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'latitude')) {
                $table->decimal('latitude', 10, 7)->default(-0.9538000)->nullable();
            }
            if (!Schema::hasColumn('projects', 'longitude')) {
                $table->decimal('longitude', 10, 7)->default(-80.7089000)->nullable();
            }
        });

        // Copiar o inicializar con center_lat y center_lng si existen
        $projects = DB::table('projects')->get();
        foreach ($projects as $project) {
            $lat = $project->center_lat ?? -0.9538;
            $lng = $project->center_lng ?? -80.7089;
            DB::table('projects')->where('id', $project->id)->update([
                'latitude' => $lat,
                'longitude' => $lng,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'latitude')) {
                $table->dropColumn('latitude');
            }
            if (Schema::hasColumn('projects', 'longitude')) {
                $table->dropColumn('longitude');
            }
        });
    }
};
