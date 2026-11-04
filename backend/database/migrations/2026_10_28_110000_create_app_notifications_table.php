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
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('target_role')->nullable(); // 'Super Admin', 'Administrador', 'Asesor Comercial', 'Topógrafo'
            $table->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type'); // 'payment_created', 'payment_voided', 'task_assigned', 'task_completed'
            $table->string('title');
            $table->text('message');
            $table->string('action_url')->nullable(); // '/recibos', '/tareas', etc.
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index(['target_role', 'is_read']);
            $table->index(['target_user_id', 'is_read']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('app_notifications');
    }
};
