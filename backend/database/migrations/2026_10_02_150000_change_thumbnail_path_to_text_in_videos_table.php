<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->text('thumbnail_path')->nullable()->change();
            if (Schema::hasColumn('videos', 'bunny_thumbnail_url')) {
                $table->text('bunny_thumbnail_url')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->string('thumbnail_path', 255)->nullable()->change();
            if (Schema::hasColumn('videos', 'bunny_thumbnail_url')) {
                $table->string('bunny_thumbnail_url', 255)->nullable()->change();
            }
        });
    }
};
