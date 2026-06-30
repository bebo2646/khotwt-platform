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
            if (!Schema::hasColumn('subscription_plans', 'durationType')) {
                $table->string('durationType')->default('monthly')->nullable();
            }
            if (!Schema::hasColumn('subscription_plans', 'discountPercentage')) {
                $table->decimal('discountPercentage', 8, 2)->default(0.00);
            }
            if (!Schema::hasColumn('subscription_plans', 'finalPrice')) {
                $table->decimal('finalPrice', 10, 2)->default(0.00);
            }
            if (!Schema::hasColumn('subscription_plans', 'isActive')) {
                $table->boolean('isActive')->default(true);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn(['durationType', 'discountPercentage', 'finalPrice', 'isActive']);
        });
    }
};
