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
        // Add security configurations to exams table
        Schema::table('exams', function (Blueprint $table) {
            $table->integer('allowed_violations')->default(3);
            $table->boolean('auto_submit_on_violation')->default(true);
            $table->boolean('enable_fullscreen')->default(true);
            $table->boolean('enable_anti_tab_switching')->default(true);
            $table->boolean('enable_copy_protection')->default(true);
        });

        // Add anti-cheating tracking to student_exams table
        Schema::table('student_exams', function (Blueprint $table) {
            $table->integer('violation_count')->default(0);
            $table->jsonb('violation_timestamps')->nullable();
            $table->boolean('is_suspicious')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn([
                'allowed_violations',
                'auto_submit_on_violation',
                'enable_fullscreen',
                'enable_anti_tab_switching',
                'enable_copy_protection'
            ]);
        });

        Schema::table('student_exams', function (Blueprint $table) {
            $table->dropColumn([
                'violation_count',
                'violation_timestamps',
                'is_suspicious'
            ]);
        });
    }
};
