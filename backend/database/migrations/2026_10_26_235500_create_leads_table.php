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
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('stage')->default('Nuevo Prospecto'); // 'Nuevo Prospecto', 'Visita Agendada', 'En Negociación', 'Cierre Ganado', 'Descartado'
            $table->text('notes')->nullable();
            $table->decimal('budget', 12, 2)->nullable();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->timestamps();
        });

        // Sembrar algunos leads iniciales realistas para alimentar el Pipeline
        $bosqueId = DB::table('projects')->where('name', 'Bosque Urbano')->value('id');
        $guapucaId = DB::table('projects')->where('name', 'Guapuca')->value('id');
        $valleId = DB::table('projects')->where('name', 'Valle Verde')->value('id');

        $initialLeads = [
            [
                'name' => 'Carlos Zambrano',
                'phone' => '0987654321',
                'email' => 'carlos.zambrano@gmail.com',
                'project_id' => $bosqueId,
                'stage' => 'Nuevo Prospecto',
                'notes' => 'Interesado en lote esquinero de más de 200m2 con crédito directo.',
                'budget' => 28000.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Mariana Villavicencio',
                'phone' => '0991234567',
                'email' => 'mariana.v@outlook.com',
                'project_id' => $bosqueId,
                'stage' => 'Visita Agendada',
                'notes' => 'Visita al terreno programada para este sábado a las 10:00 AM.',
                'budget' => 32000.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Esteban Moreira',
                'phone' => '0984561234',
                'email' => 'esteban.moreira@yahoo.com',
                'project_id' => $guapucaId ?: $bosqueId,
                'stage' => 'En Negociación',
                'notes' => 'Revisando propuesta de cuotas a 24 meses sin intereses.',
                'budget' => 25000.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Diana Palacios',
                'phone' => '0978901234',
                'email' => 'diana.palacios@hotmail.com',
                'project_id' => $bosqueId,
                'stage' => 'Cierre Ganado',
                'notes' => 'Acordó entrada del 20% y ya definió Lote 1. Lista para asignar.',
                'budget' => 30000.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Jorge Cevallos',
                'phone' => '0965432109',
                'email' => 'jorge.cevallos@gmail.com',
                'project_id' => $valleId ?: $bosqueId,
                'stage' => 'Nuevo Prospecto',
                'notes' => 'Llegó por campaña en Facebook Ads. Pide catálogo y precios.',
                'budget' => 22000.00,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('leads')->insert($initialLeads);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
