<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Seed plans
        $plans = [
            [
                'name' => 'Starter',
                'video_storage_gb' => 10,
                'student_codes' => 50,
                'price_egp' => 199.00,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => 'Basic',
                'video_storage_gb' => 25,
                'student_codes' => 100,
                'price_egp' => 399.00,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => 'Pro',
                'video_storage_gb' => 50,
                'student_codes' => 250,
                'price_egp' => 699.00,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
            [
                'name' => 'Academy',
                'video_storage_gb' => 100,
                'student_codes' => 500,
                'price_egp' => 1199.00,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ],
        ];

        DB::table('subscription_plans')->insert($plans);

        // 2. Assign default Starter plan to existing teachers
        $starterPlan = DB::table('subscription_plans')->where('name', 'Starter')->first();
        if ($starterPlan) {
            $teachers = DB::table('users')->where('role', 'teacher')->get();
            foreach ($teachers as $teacher) {
                // Check if already subscribed (precaution)
                $exists = DB::table('teacher_subscriptions')
                    ->where('teacher_id', $teacher->id)
                    ->exists();

                if (!$exists) {
                    DB::table('teacher_subscriptions')->insert([
                        'teacher_id' => $teacher->id,
                        'plan_id' => $starterPlan->id,
                        'start_date' => Carbon::now()->toDateString(),
                        'end_date' => Carbon::now()->addYear()->toDateString(),
                        'status' => 'Active',
                        'used_storage_bytes' => 0,
                        'used_codes' => 0,
                        'created_at' => Carbon::now(),
                        'updated_at' => Carbon::now(),
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('teacher_subscriptions')->truncate();
        DB::table('subscription_plans')->truncate();
    }
};
