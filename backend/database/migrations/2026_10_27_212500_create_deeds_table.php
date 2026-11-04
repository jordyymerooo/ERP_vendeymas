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
        if (!Schema::hasTable('deeds')) {
            Schema::create('deeds', function (Blueprint $table) {
                $table->id();
                $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
                $table->foreignId('lot_id')->nullable()->constrained('lots')->nullOnDelete();
                $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
                $table->foreignId('assigned_admin_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('stage')->default('Informe');
                $table->decimal('total_budget', 12, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('customer_id');
                $table->index('project_id');
                $table->index('assigned_admin_id');
                $table->index('stage');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deeds');
    }
};
