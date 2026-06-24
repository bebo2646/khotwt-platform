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
        Schema::table('lessons', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->default(0.00);
        });

        Schema::table('packages', function (Blueprint $table) {
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            $table->dropColumn(['description', 'cover_image']);
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn('price');
        });
    }
};
