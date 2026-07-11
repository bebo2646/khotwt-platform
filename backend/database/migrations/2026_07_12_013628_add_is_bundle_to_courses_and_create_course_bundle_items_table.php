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
        Schema::table('courses', function (Blueprint $table) {
            $table->boolean('is_bundle')->default(false);
        });

        Schema::create('course_bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->constrained('courses')->onDelete('cascade');
            $table->foreignId('child_id')->constrained('courses')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('course_bundle_items');
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('is_bundle');
        });
    }
};
