<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // On PostgreSQL, alter column to drop not null
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE teacher_earnings ALTER COLUMN student_id DROP NOT NULL');
            DB::statement('ALTER TABLE platform_earnings ALTER COLUMN student_id DROP NOT NULL');
        } else {
            Schema::table('teacher_earnings', function (Blueprint $table) {
                $table->unsignedBigInteger('student_id')->nullable()->change();
            });
            Schema::table('platform_earnings', function (Blueprint $table) {
                $table->unsignedBigInteger('student_id')->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE teacher_earnings ALTER COLUMN student_id SET NOT NULL');
            DB::statement('ALTER TABLE platform_earnings ALTER COLUMN student_id SET NOT NULL');
        } else {
            Schema::table('teacher_earnings', function (Blueprint $table) {
                $table->unsignedBigInteger('student_id')->nullable(false)->change();
            });
            Schema::table('platform_earnings', function (Blueprint $table) {
                $table->unsignedBigInteger('student_id')->nullable(false)->change();
            });
        }
    }
};
