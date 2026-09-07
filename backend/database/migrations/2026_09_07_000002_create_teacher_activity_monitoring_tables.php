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
        // 1. Teacher Sessions Table
        if (!Schema::hasTable('teacher_sessions')) {
            Schema::create('teacher_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->string('session_identifier')->index();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->string('device_type', 50)->nullable(); // desktop, mobile, tablet
                $table->string('browser', 100)->nullable();
                $table->string('current_page', 255)->nullable();
                $table->string('current_action', 255)->nullable();
                $table->timestamp('started_at')->useCurrent();
                $table->timestamp('last_activity_at')->useCurrent()->index();
                $table->timestamp('ended_at')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->integer('duration_seconds')->default(0);
                $table->timestamps();

                $table->index(['teacher_id', 'is_active', 'last_activity_at'], 'idx_teacher_sessions_active');
            });
        }

        // 2. Teacher Activity Logs Table
        if (!Schema::hasTable('teacher_activity_logs')) {
            Schema::create('teacher_activity_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
                $table->string('event_type', 50)->index(); // course_created, lesson_updated, video_uploaded, etc.
                $table->string('event_name', 100);
                $table->text('description')->nullable();

                // Entity Relationships (all nullable with set null on delete)
                $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
                $table->foreignId('unit_id')->nullable()->constrained('units')->onDelete('set null');
                $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('set null');
                $table->foreignId('video_id')->nullable()->constrained('videos')->onDelete('set null');
                $table->foreignId('exam_id')->nullable()->constrained('exams')->onDelete('set null');

                // Metadata and request context
                $table->json('metadata')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->string('session_identifier')->nullable()->index();

                // Precise occurred timestamp
                $table->timestamp('occurred_at')->useCurrent()->index();
                $table->timestamps();

                // Optimized compound indexes for audit queries
                $table->index(['teacher_id', 'occurred_at'], 'idx_teacher_activity_occurred');
                $table->index(['event_type', 'occurred_at'], 'idx_teacher_activity_type');
                $table->index(['course_id', 'occurred_at'], 'idx_teacher_activity_course');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teacher_activity_logs');
        Schema::dropIfExists('teacher_sessions');
    }
};
