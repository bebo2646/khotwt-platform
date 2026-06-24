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
        Schema::table('notification_reads', function (Blueprint $table) {
            if (!Schema::hasColumn('notification_reads', 'is_seen')) {
                $table->boolean('is_seen')->default(false);
            }
            if (!Schema::hasColumn('notification_reads', 'seen_at')) {
                $table->timestamp('seen_at')->nullable();
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'session_token')) {
                $table->string('session_token')->nullable();
            }
            if (!Schema::hasColumn('users', 'device_id')) {
                $table->string('device_id')->nullable();
            }
            if (!Schema::hasColumn('users', 'last_activity')) {
                $table->timestamp('last_activity')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notification_reads', function (Blueprint $table) {
            if (Schema::hasColumn('notification_reads', 'is_seen')) {
                $table->dropColumn('is_seen');
            }
            if (Schema::hasColumn('notification_reads', 'seen_at')) {
                $table->dropColumn('seen_at');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'session_token')) {
                $table->dropColumn('session_token');
            }
            if (Schema::hasColumn('users', 'device_id')) {
                $table->dropColumn('device_id');
            }
            if (Schema::hasColumn('users', 'last_activity')) {
                $table->dropColumn('last_activity');
            }
        });
    }
};
