<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Correct Monthly Plans
        DB::table('subscription_plans')
            ->where('billing_type', 'monthly')
            ->update([
                'codes_limit_type' => 'max',
                'max_codes_limit' => DB::raw('COALESCE(max_codes_limit, included_codes, student_codes, 0)')
            ]);

        // 2. Correct Revenue Sharing Plans
        DB::table('subscription_plans')
            ->where('billing_type', 'revenue_sharing')
            ->update([
                'codes_limit_type' => 'unlimited'
            ]);

        // 3. Clear cached or hardcoded unlimited values from previous configurations in subscriptions
        // (Calculations are dynamic but we can trigger a recalculation to update counts)
        try {
            $syncService = new \App\Services\BunnySubscriptionService();
            $syncService->syncStorageAndCodes(null, true);
        } catch (\Exception $e) {
            // Ignore if service fails during migration bootstrap
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op
    }
};
