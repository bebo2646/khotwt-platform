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
        // 1. Student Sessions Table
        if (!Schema::hasTable('student_sessions')) {
            Schema::create('student_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->string('session_identifier')->index();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->string('device_type', 50)->nullable(); // desktop, mobile, tablet
                $table->string('browser', 100)->nullable();
                $table->timestamp('started_at')->useCurrent();
                $table->timestamp('last_activity_at')->useCurrent()->index();
                $table->timestamp('ended_at')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->integer('duration_seconds')->default(0);
                $table->timestamps();

                $table->index(['student_id', 'is_active', 'last_activity_at'], 'idx_student_sessions_active');
            });
        }

        // 2. Student Activity Logs Table
        if (!Schema::hasTable('student_activity_logs')) {
            Schema::create('student_activity_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->string('event_type', 50)->index(); // login, course_opened, video_started, etc.
                $table->string('event_name', 100);
                $table->text('description')->nullable();
                
                // Entity Relationships (all nullable with cascade/set null)
                $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
                $table->foreignId('bundle_id')->nullable()->constrained('courses')->onDelete('set null');
                $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('set null');
                $table->foreignId('video_id')->nullable()->constrained('videos')->onDelete('set null');
                $table->foreignId('exam_id')->nullable()->constrained('exams')->onDelete('set null');
                $table->foreignId('attempt_id')->nullable()->constrained('student_exams')->onDelete('set null');

                // Metadata and request context
                $table->json('metadata')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->string('session_identifier')->nullable()->index();
                
                // Precise occurred timestamp
                $table->timestamp('occurred_at')->useCurrent()->index();
                $table->timestamps();

                // Optimized compound indexes for reporting & audit queries
                $table->index(['student_id', 'occurred_at'], 'idx_activity_student_occurred');
                $table->index(['event_type', 'occurred_at'], 'idx_activity_type_occurred');
                $table->index(['course_id', 'occurred_at'], 'idx_activity_course_occurred');
                $table->index(['bundle_id', 'occurred_at'], 'idx_activity_bundle_occurred');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_activity_logs');
        Schema::dropIfExists('student_sessions');
    }
};
