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
        Schema::table('courses', function (Blueprint $table) {
            $table->index(['is_published', 'category', 'grade'], 'idx_courses_pub_cat_grade');
            $table->index(['teacher_id', 'is_published'], 'idx_courses_teacher_pub');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index(['role', 'status', 'category'], 'idx_users_role_status_cat');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->index(['course_id', 'student_id'], 'idx_enrollments_course_student');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropIndex('idx_courses_pub_cat_grade');
            $table->dropIndex('idx_courses_teacher_pub');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_role_status_cat');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropIndex('idx_enrollments_course_student');
        });
    }
};
