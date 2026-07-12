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
        // 1. Update video_progresses table
        Schema::table('video_progresses', function (Blueprint $table) {
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('cascade');
            $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('cascade');
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('cascade');
        });

        // 2. Update student_pdf_progresses table
        Schema::table('student_pdf_progresses', function (Blueprint $table) {
            // Drop unique constraint
            $table->dropUnique('student_pdf_progresses_student_id_pdf_id_unique');
            
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('cascade');
            $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('cascade');
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('cascade');
        });

        // 3. Update student_exams table
        Schema::table('student_exams', function (Blueprint $table) {
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('cascade');
            $table->foreignId('package_id')->nullable()->constrained('packages')->onDelete('cascade');
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('student_exams', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
            $table->dropForeign(['package_id']);
            $table->dropForeign(['lesson_id']);
            $table->dropColumn(['course_id', 'package_id', 'lesson_id']);
        });

        Schema::table('student_pdf_progresses', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
            $table->dropForeign(['package_id']);
            $table->dropForeign(['lesson_id']);
            $table->dropColumn(['course_id', 'package_id', 'lesson_id']);
            
            $table->unique(['student_id', 'pdf_id']);
        });

        Schema::table('video_progresses', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
            $table->dropForeign(['package_id']);
            $table->dropForeign(['lesson_id']);
            $table->dropColumn(['course_id', 'package_id', 'lesson_id']);
        });
    }
};
