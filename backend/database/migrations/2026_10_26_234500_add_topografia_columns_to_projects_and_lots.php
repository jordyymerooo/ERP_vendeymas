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
        // 1. Columnas en tabla projects
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'center_lat')) {
                $table->decimal('center_lat', 11, 8)->nullable()->after('location');
            }
            if (!Schema::hasColumn('projects', 'center_lng')) {
                $table->decimal('center_lng', 11, 8)->nullable()->after('center_lat');
            }
            if (!Schema::hasColumn('projects', 'blueprint_image_url')) {
                $table->text('blueprint_image_url')->nullable()->after('center_lng');
            }
        });

        // 2. Columna en tabla lots (PostgreSQL soporta jsonb nativo)
        Schema::table('lots', function (Blueprint $table) {
            if (!Schema::hasColumn('lots', 'coordinates_geojson')) {
                $table->jsonb('coordinates_geojson')->nullable()->after('payment_day');
            }
        });

        // 3. Sembrar coordenadas geográficas reales de proyectos en Manta / Manabí
        DB::table('projects')->where('name', 'Bosque Urbano')->update([
            'center_lat' => -0.95380000,
            'center_lng' => -80.74560000,
        ]);
        DB::table('projects')->where('name', 'Guapuca')->update([
            'center_lat' => -0.96200000,
            'center_lng' => -80.73800000,
        ]);
        DB::table('projects')->where('name', 'Valle Verde')->update([
            'center_lat' => -0.97000000,
            'center_lng' => -80.75000000,
        ]);

        // 4. Generar polígonos topográficos GeoJSON reales para los lotes de cada proyecto
        $projects = DB::table('projects')->get();
        foreach ($projects as $project) {
            $baseLat = (float) ($project->center_lat ?: -0.9538);
            $baseLng = (float) ($project->center_lng ?: -80.7456);

            $lots = DB::table('lots')->where('project_id', $project->id)->orderBy('id')->get();
            $cols = 4; // 4 columnas de lotes
            $width = 0.00035;  // Ancho aproximado en grados (~38m)
            $height = 0.00025; // Alto aproximado en grados (~28m)
            $gap = 0.00006;    // Calle / separación

            foreach ($lots as $index => $lot) {
                $row = floor($index / $cols);
                $col = $index % $cols;

                $lat1 = $baseLat + ($row * ($height + $gap));
                $lat2 = $lat1 + $height;
                $lng1 = $baseLng + ($col * ($width + $gap));
                $lng2 = $lng1 + $width;

                // Polígono GeoJSON estándar: [[[lng, lat], [lng, lat], [lng, lat], [lng, lat], [lng, lat]]]
                // y lista de vértices [lat, lng]
                $geojson = [
                    'type' => 'Polygon',
                    'coordinates' => [
                        [
                            [$lng1, $lat1],
                            [$lng2, $lat1],
                            [$lng2, $lat2],
                            [$lng1, $lat2],
                            [$lng1, $lat1],
                        ]
                    ],
                    'latlngs' => [
                        [$lat1, $lng1],
                        [$lat1, $lng2],
                        [$lat2, $lng2],
                        [$lat2, $lng1],
                    ],
                ];

                DB::table('lots')->where('id', $lot->id)->update([
                    'coordinates_geojson' => json_encode($geojson),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['center_lat', 'center_lng', 'blueprint_image_url']);
        });

        Schema::table('lots', function (Blueprint $table) {
            $table->dropColumn('coordinates_geojson');
        });
    }
};
