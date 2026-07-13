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
        // Clean up duplicate video_progresses records keeping the one with max watched_seconds
        $duplicates = \DB::table('video_progresses')
            ->select('student_id', 'video_id')
            ->groupBy('student_id', 'video_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            $bestRecordId = \DB::table('video_progresses')
                ->where('student_id', $duplicate->student_id)
                ->where('video_id', $duplicate->video_id)
                ->orderBy('watched_seconds', 'desc')
                ->orderBy('updated_at', 'desc')
                ->value('id');

            if ($bestRecordId) {
                \DB::table('video_progresses')
                    ->where('student_id', $duplicate->student_id)
                    ->where('video_id', $duplicate->video_id)
                    ->where('id', '!=', $bestRecordId)
                    ->delete();
            }
        }

        // Add unique constraint
        Schema::table('video_progresses', function (Blueprint $table) {
            $table->unique(['student_id', 'video_id'], 'video_progresses_student_id_video_id_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('video_progresses', function (Blueprint $table) {
            $table->dropUnique('video_progresses_student_id_video_id_unique');
        });
    }
};
