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
        Schema::table('packages', function (Blueprint $table) {
            $table->unsignedBigInteger('course_id')->nullable()->change();
            $table->foreignId('teacher_id')->nullable()->constrained('users')->onDelete('cascade');
        });

        // Populate teacher_id for existing packages based on their course_id
        DB::statement("UPDATE packages SET teacher_id = (SELECT teacher_id FROM courses WHERE courses.id = packages.course_id) WHERE course_id IS NOT NULL");

        // Make teacher_id non-nullable now that existing data is populated
        Schema::table('packages', function (Blueprint $table) {
            $table->unsignedBigInteger('teacher_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Delete any package that doesn't have a course_id since it can't exist with non-nullable course_id
        DB::table('packages')->whereNull('course_id')->delete();

        Schema::table('packages', function (Blueprint $table) {
            $table->dropForeign(['teacher_id']);
            $table->dropColumn('teacher_id');
            $table->unsignedBigInteger('course_id')->nullable(false)->change();
        });
    }
};
