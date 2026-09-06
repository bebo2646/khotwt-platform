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
            $table->unsignedBigInteger('lesson_id')->nullable()->change();
            if (!Schema::hasColumn('exams', 'description')) {
                $table->text('description')->nullable();
            }
            if (!Schema::hasColumn('exams', 'month')) {
                $table->string('month', 50)->nullable();
            }
            if (!Schema::hasColumn('exams', 'stage')) {
                $table->string('stage', 100)->nullable();
            }
            if (!Schema::hasColumn('exams', 'academic_stage_id')) {
                $table->unsignedBigInteger('academic_stage_id')->nullable();
            }
            if (!Schema::hasColumn('exams', 'grade')) {
                $table->string('grade', 100)->nullable();
            }
            if (!Schema::hasColumn('exams', 'academic_grade_id')) {
                $table->unsignedBigInteger('academic_grade_id')->nullable();
            }
            if (!Schema::hasColumn('exams', 'subject')) {
                $table->string('subject', 100)->nullable();
            }
            if (!Schema::hasColumn('exams', 'category')) {
                $table->string('category', 100)->nullable()->default('school');
            }
            if (!Schema::hasColumn('exams', 'course_id')) {
                $table->unsignedBigInteger('course_id')->nullable();
            }
            if (!Schema::hasColumn('exams', 'teacher_id')) {
                $table->unsignedBigInteger('teacher_id')->nullable();
            }
            if (!Schema::hasColumn('exams', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
            if (!Schema::hasColumn('exams', 'is_published')) {
                $table->boolean('is_published')->default(true);
            }
            if (!Schema::hasColumn('exams', 'included_in_course')) {
                $table->boolean('included_in_course')->default(false);
            }
            if (!Schema::hasColumn('exams', 'randomize_questions')) {
                $table->boolean('randomize_questions')->default(false);
            }
            if (!Schema::hasColumn('exams', 'randomize_options')) {
                $table->boolean('randomize_options')->default(false);
            }
            if (!Schema::hasColumn('exams', 'use_question_bank')) {
                $table->boolean('use_question_bank')->default(false);
            }
            if (!Schema::hasColumn('exams', 'questions_per_attempt')) {
                $table->integer('questions_per_attempt')->nullable();
            }
            if (!Schema::hasColumn('exams', 'show_result_immediately')) {
                $table->boolean('show_result_immediately')->default(true);
            }
            if (!Schema::hasColumn('exams', 'show_answers_after_submission')) {
                $table->boolean('show_answers_after_submission')->default(true);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Safe reversible
    }
};
