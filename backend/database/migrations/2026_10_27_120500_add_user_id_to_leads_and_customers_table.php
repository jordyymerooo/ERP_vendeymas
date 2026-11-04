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
        // 1. Agregar user_id y discard_reason a la tabla leads
        Schema::table('leads', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('project_id')->constrained('users')->nullOnDelete();
            $table->string('discard_reason')->nullable()->after('stage');
        });

        // 2. Agregar assigned_user_id a la tabla customers
        Schema::table('customers', function (Blueprint $table) {
            $table->foreignId('assigned_user_id')->nullable()->after('id_card')->constrained('users')->nullOnDelete();
        });

        // 3. Asignar registros previos al usuario principal o asesor comercial
        $firstUser = DB::table('users')->orderBy('id', 'asc')->first();
        $adminId = $firstUser ? $firstUser->id : 1;

        // Buscar asesor comercial si existe para distribuir algunos prospectos de prueba
        $asesorUser = DB::table('users')
            ->join('model_has_roles', 'users.id', '=', 'model_has_roles.model_id')
            ->join('roles', 'model_has_roles.role_id', '=', 'roles.id')
            ->where('roles.name', 'Asesor Comercial')
            ->select('users.id')
            ->first();

        $asesorId = $asesorUser ? $asesorUser->id : $adminId;

        // Actualizar customers previos
        DB::table('customers')->whereNull('assigned_user_id')->update([
            'assigned_user_id' => $adminId,
        ]);

        // Actualizar leads previos
        $leadIds = DB::table('leads')->pluck('id');
        foreach ($leadIds as $index => $leadId) {
            // Asignar alternadamente al admin y al asesor comercial si existen para pruebas de aislamiento
            $assignedTo = ($index % 2 === 0 || $asesorId === $adminId) ? $adminId : $asesorId;
            DB::table('leads')->where('id', $leadId)->update([
                'user_id' => $assignedTo,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id', 'discard_reason']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropForeign(['assigned_user_id']);
            $table->dropColumn(['assigned_user_id']);
        });
    }
};
