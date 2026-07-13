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
        Schema::table('video_progresses', function (Blueprint $table) {
            // Drop old unique constraint
            $table->dropUnique('video_progresses_student_id_video_id_unique');
            
            // Add new unique constraint including course_id and package_id
            $table->unique(['student_id', 'video_id', 'course_id', 'package_id'], 'video_progress_context_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('video_progresses', function (Blueprint $table) {
            $table->dropUnique('video_progress_context_unique');
            $table->unique(['student_id', 'video_id'], 'video_progresses_student_id_video_id_unique');
        });
    }
};
