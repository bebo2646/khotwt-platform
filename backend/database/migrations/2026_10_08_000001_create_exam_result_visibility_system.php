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
        // 1. Add exam-level default visibility settings to exams table
        Schema::table('exams', function (Blueprint $table) {
            if (!Schema::hasColumn('exams', 'show_score')) {
                $table->boolean('show_score')->default(true)->after('show_answers_after_submission');
            }
            if (!Schema::hasColumn('exams', 'show_student_answers')) {
                $table->boolean('show_student_answers')->default(true)->after('show_score');
            }
            if (!Schema::hasColumn('exams', 'show_correct_answers')) {
                $table->boolean('show_correct_answers')->default(true)->after('show_student_answers');
            }
            if (!Schema::hasColumn('exams', 'show_explanations')) {
                $table->boolean('show_explanations')->default(true)->after('show_correct_answers');
            }
        });

        // 2. Create student-specific override table
        if (!Schema::hasTable('exam_student_result_visibilities')) {
            Schema::create('exam_student_result_visibilities', function (Blueprint $table) {
                $table->id();
                $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
                $table->boolean('show_score')->nullable()->default(null);
                $table->boolean('show_student_answers')->nullable()->default(null);
                $table->boolean('show_correct_answers')->nullable()->default(null);
                $table->boolean('show_explanations')->nullable()->default(null);
                $table->timestamps();

                $table->unique(['exam_id', 'student_id'], 'exam_student_visibility_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exam_student_result_visibilities');

        Schema::table('exams', function (Blueprint $table) {
            $columnsToDrop = [];
            foreach (['show_score', 'show_student_answers', 'show_correct_answers', 'show_explanations'] as $col) {
                if (Schema::hasColumn('exams', $col)) {
                    $columnsToDrop[] = $col;
                }
            }
            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
