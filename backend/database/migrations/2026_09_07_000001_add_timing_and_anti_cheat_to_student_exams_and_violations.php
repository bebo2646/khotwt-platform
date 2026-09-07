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
        Schema::table('student_exams', function (Blueprint $table) {
            if (!Schema::hasColumn('student_exams', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('student_exams', 'expires_at')) {
                $table->timestamp('expires_at')->nullable()->after('started_at');
            }
            if (!Schema::hasColumn('student_exams', 'last_heartbeat_at')) {
                $table->timestamp('last_heartbeat_at')->nullable()->after('expires_at');
            }
            if (!Schema::hasColumn('student_exams', 'duration_minutes')) {
                $table->integer('duration_minutes')->nullable()->after('last_heartbeat_at');
            }
            if (!Schema::hasColumn('student_exams', 'auto_submitted')) {
                $table->boolean('auto_submitted')->default(false)->after('duration_minutes');
            }
            if (!Schema::hasColumn('student_exams', 'submission_reason')) {
                $table->string('submission_reason')->nullable()->after('auto_submitted');
            }
            if (!Schema::hasColumn('student_exams', 'cheat_violations_count')) {
                $table->integer('cheat_violations_count')->default(0)->after('submission_reason');
            }
            if (!Schema::hasColumn('student_exams', 'terminated_for_cheating_at')) {
                $table->timestamp('terminated_for_cheating_at')->nullable()->after('cheat_violations_count');
            }
            if (!Schema::hasColumn('student_exams', 'answers_unlocked_at')) {
                $table->timestamp('answers_unlocked_at')->nullable()->after('terminated_for_cheating_at');
            }
            if (!Schema::hasColumn('student_exams', 'answers_unlocked_by')) {
                $table->unsignedBigInteger('answers_unlocked_by')->nullable()->after('answers_unlocked_at');
            }
            if (!Schema::hasColumn('student_exams', 'session_token')) {
                $table->string('session_token', 100)->nullable()->after('answers_unlocked_by');
            }
        });

        if (!Schema::hasTable('exam_violations')) {
            Schema::create('exam_violations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
                $table->foreignId('exam_id')->constrained('exams')->onDelete('cascade');
                $table->foreignId('student_exam_id')->constrained('student_exams')->onDelete('cascade');
                $table->string('violation_type', 100);
                $table->integer('time_remaining_seconds')->nullable();
                $table->unsignedBigInteger('question_id')->nullable();
                $table->integer('question_number')->nullable();
                $table->string('session_token', 100)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exam_violations');

        Schema::table('student_exams', function (Blueprint $table) {
            $columnsToDrop = [];
            $possibleColumns = [
                'started_at',
                'expires_at',
                'last_heartbeat_at',
                'duration_minutes',
                'auto_submitted',
                'submission_reason',
                'cheat_violations_count',
                'terminated_for_cheating_at',
                'answers_unlocked_at',
                'answers_unlocked_by',
                'session_token',
            ];

            foreach ($possibleColumns as $col) {
                if (Schema::hasColumn('student_exams', $col)) {
                    $columnsToDrop[] = $col;
                }
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
