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
        // 1. Add fields to platform_settings table
        Schema::table('platform_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('platform_settings', 'require_student_approval')) {
                $table->boolean('require_student_approval')->default(false);
            }
            if (!Schema::hasColumn('platform_settings', 'auto_delete_rejected_accounts')) {
                $table->boolean('auto_delete_rejected_accounts')->default(false);
            }
            if (!Schema::hasColumn('platform_settings', 'view_limit_enabled')) {
                $table->boolean('view_limit_enabled')->default(false);
            }
            if (!Schema::hasColumn('platform_settings', 'default_max_views')) {
                $table->integer('default_max_views')->default(10);
            }
            if (!Schema::hasColumn('platform_settings', 'video_threshold_seconds')) {
                $table->integer('video_threshold_seconds')->default(300); // 5 minutes
            }
        });

        // 2. Add fields to courses table
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'view_limit_enabled')) {
                $table->boolean('view_limit_enabled')->nullable(); // null means use global setting
            }
            if (!Schema::hasColumn('courses', 'max_views')) {
                $table->integer('max_views')->nullable(); // null means use default_max_views
            }
        });

        // 3. Add fields to users table
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable();
            }
        });

        // 4. Create video_view_sessions table
        if (!Schema::hasTable('video_view_sessions')) {
            Schema::create('video_view_sessions', function (Blueprint $table) {
                $table->id();
                $table->string('session_id')->unique();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('video_id')->constrained('videos')->onDelete('cascade');
                $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
                $table->integer('watch_time')->default(0);
                $table->boolean('counted')->default(false);
                $table->timestamps();
            });
        }

        // 5. Create student_course_view_limits table
        if (!Schema::hasTable('student_course_view_limits')) {
            Schema::create('student_course_view_limits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
                $table->integer('views_used')->default(0);
                $table->integer('max_views_override')->nullable();
                $table->integer('extra_views')->default(0);
                $table->timestamps();

                $table->unique(['student_id', 'course_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_course_view_limits');
        Schema::dropIfExists('video_view_sessions');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('rejection_reason');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['view_limit_enabled', 'max_views']);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn([
                'require_student_approval',
                'auto_delete_rejected_accounts',
                'view_limit_enabled',
                'default_max_views',
                'video_threshold_seconds'
            ]);
        });
    }
};
