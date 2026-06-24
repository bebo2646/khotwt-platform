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
            if (!Schema::hasColumn('teacher_subscriptions', 'billing_period')) {
                $table->string('billing_period')->default('monthly'); // monthly, semi_annual, annual
            }
        });

        Schema::table('subscription_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('subscription_requests', 'billing_period')) {
                $table->string('billing_period')->default('monthly'); // monthly, semi_annual, annual
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_requests', function (Blueprint $table) {
            if (Schema::hasColumn('subscription_requests', 'billing_period')) {
                $table->dropColumn('billing_period');
            }
        });

        Schema::table('teacher_subscriptions', function (Blueprint $table) {
            if (Schema::hasColumn('teacher_subscriptions', 'billing_period')) {
                $table->dropColumn('billing_period');
            }
        });
    }
};
