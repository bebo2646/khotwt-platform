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
            if (!Schema::hasColumn('users', 'current_session_token')) {
                $table->string('current_session_token')->nullable();
            }
        });

        Schema::table('lessons', function (Blueprint $table) {
            if (!Schema::hasColumn('lessons', 'duration_seconds')) {
                $table->integer('duration_seconds')->default(0);
            }
            if (!Schema::hasColumn('lessons', 'duration_text')) {
                $table->string('duration_text')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'current_session_token')) {
                $table->dropColumn('current_session_token');
            }
        });

        Schema::table('lessons', function (Blueprint $table) {
            if (Schema::hasColumn('lessons', 'duration_seconds')) {
                $table->dropColumn('duration_seconds');
            }
            if (Schema::hasColumn('lessons', 'duration_text')) {
                $table->dropColumn('duration_text');
            }
        });
    }
};
