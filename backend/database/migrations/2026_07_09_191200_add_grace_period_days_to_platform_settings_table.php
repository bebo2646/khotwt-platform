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
        Schema::table('platform_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('platform_settings', 'grace_period_days')) {
                $table->integer('grace_period_days')->default(7)->after('video_threshold_seconds');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            if (Schema::hasColumn('platform_settings', 'grace_period_days')) {
                $table->dropColumn('grace_period_days');
            }
        });
    }
};
