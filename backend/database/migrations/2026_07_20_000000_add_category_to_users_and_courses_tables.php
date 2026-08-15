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
        if (!Schema::hasColumn('users', 'category')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('category')->default('school')->nullable()->after('subject');
            });
        }

        if (!Schema::hasColumn('courses', 'category')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->string('category')->default('school')->nullable()->after('subject');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('users', 'category')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }

        if (Schema::hasColumn('courses', 'category')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }
    }
};
