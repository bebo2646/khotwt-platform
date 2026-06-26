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
            if (!Schema::hasColumn('video_progresses', 'watched_segments')) {
                $table->json('watched_segments')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('video_progresses', function (Blueprint $table) {
            if (Schema::hasColumn('video_progresses', 'watched_segments')) {
                $table->dropColumn('watched_segments');
            }
        });
    }
};
