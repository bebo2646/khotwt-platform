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
        Schema::table('subscription_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('subscription_plans', 'most_popular')) {
                $table->boolean('most_popular')->default(false)->after('featured');
            }
            if (!Schema::hasColumn('subscription_plans', 'recommended')) {
                $table->boolean('recommended')->default(false)->after('most_popular');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn(['most_popular', 'recommended']);
        });
    }
};
