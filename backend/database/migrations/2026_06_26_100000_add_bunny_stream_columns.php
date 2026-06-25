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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'bunny_storage_used_gb')) {
                $table->decimal('bunny_storage_used_gb', 10, 4)->default(0.0000);
            }
            if (!Schema::hasColumn('users', 'bunny_storage_limit_gb')) {
                $table->decimal('bunny_storage_limit_gb', 10, 4)->default(10.0000); // Default to Starter (10 GB)
            }
        });

        Schema::table('videos', function (Blueprint $table) {
            if (!Schema::hasColumn('videos', 'bunny_video_id')) {
                $table->string('bunny_video_id')->nullable();
            }
            if (!Schema::hasColumn('videos', 'bunny_thumbnail_url')) {
                $table->string('bunny_thumbnail_url')->nullable();
            }
            if (!Schema::hasColumn('videos', 'bunny_duration')) {
                $table->integer('bunny_duration')->default(0);
            }
            if (!Schema::hasColumn('videos', 'bunny_size_bytes')) {
                $table->bigInteger('bunny_size_bytes')->default(0);
            }
            if (!Schema::hasColumn('videos', 'bunny_status')) {
                $table->string('bunny_status')->default('queued'); // queued, processing, finished, failed, uploaded
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['bunny_storage_used_gb', 'bunny_storage_limit_gb']);
        });

        Schema::table('videos', function (Blueprint $table) {
            $table->dropColumn(['bunny_video_id', 'bunny_thumbnail_url', 'bunny_duration', 'bunny_size_bytes', 'bunny_status']);
        });
    }
};
