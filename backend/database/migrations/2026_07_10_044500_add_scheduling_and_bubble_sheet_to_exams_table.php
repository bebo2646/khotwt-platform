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
        Schema::table('exams', function (Blueprint $table) {
            if (!Schema::hasColumn('exams', 'homework_type')) {
                $table->string('homework_type')->default('normal');
            }
            if (!Schema::hasColumn('exams', 'enable_schedule')) {
                $table->boolean('enable_schedule')->default(false);
            }
            if (!Schema::hasColumn('exams', 'open_time')) {
                $table->time('open_time')->nullable();
            }
            if (!Schema::hasColumn('exams', 'close_time')) {
                $table->time('close_time')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn(['homework_type', 'enable_schedule', 'open_time', 'close_time']);
        });
    }
};
