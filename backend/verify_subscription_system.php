<?php

define('LARAVEL_START', microtime(true));

// Register the Composer autoloader
require __DIR__.'/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use App\Models\SubscriptionRequest;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionAddon;
use App\Models\Notification;
use App\Models\AdminActivityLog;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

echo "========================================================\n";
echo "   STARTING COMPREHENSIVE SUBSCRIPTION SYSTEM VERIFICATION\n";
echo "========================================================\n\n";

$testsPassed = 0;
$testsFailed = 0;

function assertTest($condition, $description, $actual = null, $expected = null) {
    global $testsPassed, $testsFailed;
    if ($condition) {
        echo "✅ PASS: $description\n";
        $testsPassed++;
    } else {
        echo "❌ FAIL: $description\n";
        if ($actual !== null || $expected !== null) {
            echo "   [Actual: " . var_export($actual, true) . ", Expected: " . var_export($expected, true) . "]\n";
        }
        $testsFailed++;
    }
}

try {
    // 1. Verify Database Plans
    echo "--- 1. Verification of Database Plans ---\n";
    $plans = SubscriptionPlan::all();
    assertTest($plans->count() >= 4, "At least 4 plans exist (Found: " . $plans->count() . ")");
    foreach ($plans as $p) {
        echo "  - Plan: {$p->name} | Storage: {$p->video_storage_gb}GB | Codes: {$p->student_codes} | Price: {$p->price_egp} EGP\n";
    }

    // 2. Test Pricing Calculation Logic
    echo "\n--- 2. Testing Pricing Calculation Logic ---\n";
    $controller = new \App\Http\Controllers\SubscriptionController(
        new \App\Services\BunnySubscriptionService(),
        new \App\Services\NotificationService()
    );

    $plan = SubscriptionPlan::where('name', 'Basic')->first();
    if ($plan) {
        $refMethod = new ReflectionMethod(\App\Http\Controllers\SubscriptionController::class, 'calculatePlanPrice');
        $refMethod->setAccessible(true);
        
        $priceMonthly = $refMethod->invoke($controller, $plan, 1);
        $priceQuarterly = $refMethod->invoke($controller, $plan, 3);
        $priceSemiAnnual = $refMethod->invoke($controller, $plan, 6);
        $priceAnnual = $refMethod->invoke($controller, $plan, 12);
        
        // Base is 399
        assertTest($priceMonthly == 399, "Monthly price has no discount: $priceMonthly EGP (Expected: 399)");
        // 3 Months is 399 * 3 = 1197 (no discount)
        assertTest($priceQuarterly == 1197, "3 Months price has no discount: $priceQuarterly EGP (Expected: 1197)");
        // 6 months base: 2394. 10% discount: 2154.6
        assertTest($priceSemiAnnual == (399 * 6 * 0.9), "Semi-annual has 10% discount: $priceSemiAnnual EGP (Expected: 2154.6)");
        // 12 months base: 4788. 20% discount: 3830.4
        assertTest($priceAnnual == (399 * 12 * 0.8), "Annual has 20% discount: $priceAnnual EGP (Expected: 3830.4)");
    } else {
        echo "⚠️ Skipping plan pricing test (Basic plan not found)\n";
    }

    // 3. Test Addon Pricing Calculations
    echo "\n--- 3. Testing Addon Pricing Calculations ---\n";
    $refAddon = new ReflectionMethod(\App\Http\Controllers\SubscriptionController::class, 'calculateAddonPrice');
    $refAddon->setAccessible(true);

    // Extra storage pricing:
    // Packages: 1=>15, 10=>120, 25=>250, 50=>450
    $storagePrice1 = $refAddon->invoke($controller, 'storage', 1);
    $storagePrice10 = $refAddon->invoke($controller, 'storage', 10);
    $storagePrice12 = $refAddon->invoke($controller, 'storage', 12); // should use 10GB pkg (120) + 2x1GB pkg (30) = 150
    $storagePrice50 = $refAddon->invoke($controller, 'storage', 50);

    assertTest($storagePrice1 == 15, "1 GB Extra Storage Price is 15 EGP");
    assertTest($storagePrice10 == 120, "10 GB Extra Storage Price is 120 EGP (Saved 30 EGP)");
    assertTest($storagePrice12 == 150, "12 GB Extra Storage Price is 150 EGP");
    assertTest($storagePrice50 == 450, "50 GB Extra Storage Price is 450 EGP");

    // Extra codes pricing:
    // Packages: 50=>75, 100=>140, 250=>300
    $codesPrice50 = $refAddon->invoke($controller, 'codes', 50);
    $codesPrice100 = $refAddon->invoke($controller, 'codes', 100);
    $codesPrice120 = $refAddon->invoke($controller, 'codes', 120); // 100 codes pkg (140) + remaining 20 (scaled to 50 codes pkg = 75) = 215

    assertTest($codesPrice50 == 75, "50 Extra Codes Price is 75 EGP");
    assertTest($codesPrice100 == 140, "100 Extra Codes Price is 140 EGP");
    assertTest($codesPrice120 == 215, "120 Extra Codes Price is 215 EGP");

    // 4. Test Teacher Request Submission and Admin Workflows
    echo "\n--- 4. Testing Request & Approval Workflow ---\n";
    
    // Create a temporary teacher for the test
    DB::beginTransaction();

    $mockTeacher = User::create([
        'name' => 'Mock Teacher Test',
        'email' => 'mock_teacher_test_' . time() . '@test.com',
        'phone' => '010' . rand(10000000, 99999999),
        'password' => bcrypt('password123'),
        'role' => 'teacher',
        'subject' => 'chemistry',
        'experience' => '3 years',
        'status' => 'active'
    ]);

    $allPlans = SubscriptionPlan::all();
    $starterPlan = $allPlans->firstWhere('name', 'starter') ?? $allPlans->firstWhere('name', 'Starter') ?? $allPlans->first();
    $basicPlan = $allPlans->firstWhere('name', 'basic') ?? $allPlans->firstWhere('name', 'Basic') ?? ($allPlans->skip(1)->first() ?? $starterPlan);

    // Ensure basicPlan allows dynamic pricing by clearing single-duration fields during the test transaction
    $basicPlan->update([
        'durationType' => null,
        'billing_options' => null,
    ]);

    // Create Subscription
    $teacherSub = TeacherSubscription::create([
        'teacher_id' => $mockTeacher->id,
        'plan_id' => $starterPlan->id,
        'start_date' => Carbon::now()->toDateString(),
        'end_date' => Carbon::now()->addMonth()->toDateString(),
        'status' => 'Active',
        'used_storage_bytes' => 0,
        'used_codes' => 0
    ]);

    assertTest($teacherSub->exists, "Teacher subscription created successfully in Starter plan");

    // Create upgrade request (plan_upgrade)
    $upgradeReq = SubscriptionRequest::create([
        'teacher_id' => $mockTeacher->id,
        'type' => 'plan_upgrade',
        'requested_plan_id' => $basicPlan->id,
        'billing_period' => 'semi_annual',
        'status' => 'Pending'
    ]);

    assertTest($upgradeReq->exists, "Plan upgrade request submitted with status: Pending");

    // Process upgrade request as Approved
    $adminUser = User::where('role', 'admin')->first() ?: $mockTeacher; // fallback to self if no admin
    
    $reqAction = Request::create("/api/admin/subscriptions/requests/{$upgradeReq->id}/action", 'POST', [
        'status' => 'Approved',
        'admin_response' => 'تمت الموافقة وتفعيل العرض نصف السنوي.'
    ]);
    $reqAction->setUserResolver(function() use ($adminUser) { return $adminUser; });

    $response = $controller->handleSubscriptionRequest($reqAction, $upgradeReq->id);
    assertTest($response->getStatusCode() == 200, "handleSubscriptionRequest returns status 200");

    // Refresh sub & request
    $teacherSub->refresh();
    $upgradeReq->refresh();

    assertTest($upgradeReq->status === 'Approved', "Request status changed to Approved");
    assertTest($upgradeReq->admin_response === 'تمت الموافقة وتفعيل العرض نصف السنوي.', "Admin response message saved correctly");
    assertTest($teacherSub->plan_id == $basicPlan->id, "Subscription updated to requested plan (Basic)");
    assertTest($teacherSub->billing_period === 'semi_annual', "Billing period set to semi_annual");
    
    // Check payment record
    $payment = SubscriptionPayment::where('teacher_subscription_id', $teacherSub->id)->latest()->first();
    assertTest($payment->amount == ($basicPlan->price_egp * 6 * 0.9), "Billing invoice issued for discounted semi-annual price", $payment->amount, ($basicPlan->price_egp * 6 * 0.9));
    assertTest($payment->payment_status === 'Pending', "Invoice status is Pending");

    // Check Notification sent to teacher
    $notif = Notification::where('recipient_id', $mockTeacher->id)->latest('id')->first();
    assertTest($notif && strpos($notif->message, 'تمت الموافقة وتفعيل العرض نصف السنوي.') !== false, "Notification containing admin notes delivered to the teacher");

    // Check Activity Logs
    $log = AdminActivityLog::where('action_type', 'like', "%معالجة طلب ترقية للمعلم {$mockTeacher->name}%")->first();
    assertTest($log !== null, "Admin activity log registered for request handling");

    // 5. Test Extra Storage Request rejection
    echo "\n--- 5. Testing Extra Resource Request Rejection ---\n";
    
    $addonReq = SubscriptionRequest::create([
        'teacher_id' => $mockTeacher->id,
        'type' => 'extra_storage',
        'amount' => 10,
        'status' => 'Pending'
    ]);

    $reqRejectAction = Request::create("/api/admin/subscriptions/requests/{$addonReq->id}/action", 'POST', [
        'status' => 'Rejected',
        'admin_response' => 'لا يمكن قبول طلبات إضافية حالياً لعدم السداد.'
    ]);
    $reqRejectAction->setUserResolver(function() use ($adminUser) { return $adminUser; });

    $rejectResponse = $controller->handleSubscriptionRequest($reqRejectAction, $addonReq->id);
    assertTest($rejectResponse->getStatusCode() == 200, "handleSubscriptionRequest for rejection returns 200");

    $addonReq->refresh();
    assertTest($addonReq->status === 'Rejected', "Addon request rejected successfully");
    assertTest($addonReq->admin_response === 'لا يمكن قبول طلبات إضافية حالياً لعدم السداد.', "Admin rejection note recorded");

    // Verify no addon was created on rejection
    $addonCount = SubscriptionAddon::where('teacher_subscription_id', $teacherSub->id)->where('type', 'storage')->count();
    assertTest($addonCount == 0, "No addon record created for rejected request");

    // Check rejection Notification
    $rejectNotif = Notification::where('recipient_id', $mockTeacher->id)->latest('id')->first();
    assertTest($rejectNotif && strpos($rejectNotif->message, 'لا يمكن قبول طلبات إضافية حالياً لعدم السداد.') !== false, "Rejection Notification containing admin rejection note delivered to the teacher");

    // 6. Student Capacity Calculations
    echo "\n--- 6. Testing Active Students/Capacity Calculation ---\n";
    
    // Create mock student and enrollment
    $mockStudent = User::create([
        'name' => 'Mock Student Test',
        'email' => 'mock_student_test_' . time() . '@test.com',
        'phone' => '010' . rand(10000000, 99999999),
        'password' => bcrypt('password123'),
        'role' => 'student',
        'status' => 'active'
    ]);

    $mockCourse = Course::create([
        'teacher_id' => $mockTeacher->id,
        'title' => 'Mock Course',
        'subject' => 'chemistry',
        'grade' => 'third_secondary',
        'price' => 100,
        'status' => 'published',
        'slug' => 'mock-course-' . time()
    ]);

    Enrollment::create([
        'student_id' => $mockStudent->id,
        'course_id' => $mockCourse->id,
        'enrolled_at' => Carbon::now()
    ]);

    // Fetch teacher subscription self details
    $reqDashboard = Request::create('/api/teacher/subscription', 'GET');
    $reqDashboard->setUserResolver(function() use ($mockTeacher) { return $mockTeacher; });
    
    $dashboardResponse = $controller->getTeacherSubscriptionSelf($reqDashboard);
    $dashboardData = json_decode($dashboardResponse->getContent(), true);

    assertTest($dashboardData['subscription']['students_count'] == 1, "Students count calculated correctly as 1 active student");
    assertTest($dashboardData['subscription']['plan']['name'] === $basicPlan->name, "Plan name verified as " . $basicPlan->name);

    // 7. Test Student Capacity Validation Check
    echo "\n--- 7. Testing Active Student Capacity Enforcement ---\n";
    
    // Temporarily limit the plan capacity to 1 student code
    $plan = SubscriptionPlan::find($teacherSub->plan_id);
    $originalCodes = $plan->student_codes;
    $originalLimitType = $plan->codes_limit_type;
    $plan->update(['student_codes' => 1, 'codes_limit_type' => 'max']);
    
    $teacherSub->refresh(); // Now remaining codes is 0
    
    // Create a second student
    $mockStudent2 = User::create([
        'name' => 'Mock Student Test 2',
        'email' => 'mock_student_test_2_' . time() . '@test.com',
        'phone' => '010' . rand(10000000, 99999999),
        'password' => bcrypt('password123'),
        'role' => 'student',
        'status' => 'active'
    ]);

    // Credit student wallet
    $wallet2 = \App\Models\Wallet::create(['student_id' => $mockStudent2->id, 'balance' => 200.00]);
    \App\Models\WalletTransaction::create([
        'wallet_id' => $wallet2->id,
        'type' => 'recharge',
        'amount' => 200.00,
        'description' => 'Test recharge',
    ]);
    
    // Attempt enrollment
    $studentController = new \App\Http\Controllers\StudentController();
    $reqSubscribe = Request::create("/api/student/courses/{$mockCourse->id}/subscribe", 'POST', [
        'payment_method' => 'wallet'
    ]);
    $reqSubscribe->setUserResolver(function() use ($mockStudent2) { return $mockStudent2; });
    
    $subResponse = $studentController->subscribeCourse($reqSubscribe, $mockCourse->id);
    assertTest($subResponse->getStatusCode() == 422, "Enrollment blocked with status 422 when capacity is full (Got: " . $subResponse->getStatusCode() . ")");
    
    $resData = json_decode($subResponse->getContent(), true);
    assertTest(strpos($resData['message'], 'السعة الاستيعابية') !== false, "Error message correctly warns about student capacity limits: '{$resData['message']}'");
    
    // Restore capacity limit
    $plan->update([
        'student_codes' => $originalCodes,
        'codes_limit_type' => $originalLimitType
    ]);

    // Rollback transactions to keep database clean
    DB::rollBack();
    echo "\nMock database changes rolled back successfully.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ EXCEPTION OCCURRED: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    $testsFailed++;
}

echo "\n========================================================\n";
echo "   VERIFICATION SUMMARY\n";
echo "========================================================\n";
echo "Tests Passed: $testsPassed\n";
echo "Tests Failed: $testsFailed\n";
echo "========================================================\n";

if ($testsFailed > 0) {
    exit(1);
} else {
    exit(0);
}
