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
        Schema::table('teacher_subscriptions', function (Blueprint $table) {
            if (!Schema::hasColumn('teacher_subscriptions', 'billing_cycle')) {
                $table->string('billing_cycle')->nullable()->default('monthly'); // monthly, quarterly, semi_annual, annual
            }
            if (!Schema::hasColumn('teacher_subscriptions', 'discount_percentage')) {
                $table->decimal('discount_percentage', 5, 2)->default(0);
            }
            if (!Schema::hasColumn('teacher_subscriptions', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->default(0);
            }
            if (!Schema::hasColumn('teacher_subscriptions', 'final_price')) {
                $table->decimal('final_price', 10, 2)->default(0);
            }
        });

        Schema::table('subscription_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('subscription_requests', 'billing_cycle')) {
                $table->string('billing_cycle')->nullable()->default('monthly'); // monthly, quarterly, semi_annual, annual
            }
            if (!Schema::hasColumn('subscription_requests', 'discount_percentage')) {
                $table->decimal('discount_percentage', 5, 2)->default(0);
            }
            if (!Schema::hasColumn('subscription_requests', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->default(0);
            }
            if (!Schema::hasColumn('subscription_requests', 'final_price')) {
                $table->decimal('final_price', 10, 2)->default(0);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_requests', function (Blueprint $table) {
            $table->dropColumn(['billing_cycle', 'discount_percentage', 'discount_amount', 'final_price']);
        });

        Schema::table('teacher_subscriptions', function (Blueprint $table) {
            $table->dropColumn(['billing_cycle', 'discount_percentage', 'discount_amount', 'final_price']);
        });
    }
};
