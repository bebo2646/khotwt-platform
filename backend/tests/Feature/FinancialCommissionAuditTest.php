<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Course;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use App\Models\PaymentHistory;
use App\Models\TeacherEarning;
use App\Models\PlatformEarning;
use App\Services\RevenueSharingService;
use App\Http\Controllers\FinancialController;
use Illuminate\Http\Request;
use Carbon\Carbon;

class FinancialCommissionAuditTest extends TestCase
{
    use RefreshDatabase;

    private function createPlan(array $overrides = []): SubscriptionPlan
    {
        return SubscriptionPlan::create(array_merge([
            'name' => 'Test Plan ' . uniqid(),
            'slug' => 'test-plan-' . uniqid(),
            'price' => 0,
            'price_egp' => 0,
            'student_codes' => 100,
            'video_storage_gb' => 50,
            'billing_type' => 'revenue_sharing',
            'commission_percentage' => 20.00,
            'active' => true,
        ], $overrides));
    }

    private function createCourse(User $teacher, float $price = 100.00): Course
    {
        return Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Test Course ' . uniqid(),
            'description' => 'Test Description',
            'price' => $price,
            'status' => 'published',
            'subject' => 'Math',
            'grade' => '3',
        ]);
    }

    public function test_standard_revenue_sharing_teacher_receives_80_percent_and_platform_20_percent()
    {
        $student = User::factory()->create(['role' => 'student']);
        $teacher = User::factory()->create(['role' => 'teacher']);
        
        $plan = $this->createPlan([
            'billing_type' => 'revenue_sharing',
            'commission_percentage' => 20.00,
        ]);

        TeacherSubscription::create([
            'teacher_id' => $teacher->id,
            'plan_id' => $plan->id,
            'status' => 'Active',
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
        ]);

        $course = $this->createCourse($teacher, 100.00);

        $success = RevenueSharingService::handlePurchase(
            $student->id,
            $teacher->id,
            100.00,
            $course->id
        );

        $this->assertTrue($success);

        $teacherEarning = TeacherEarning::where('teacher_id', $teacher->id)->latest()->first();
        $platformEarning = PlatformEarning::where('teacher_id', $teacher->id)->latest()->first();
        $paymentHistory = PaymentHistory::where('student_id', $student->id)->latest()->first();

        $this->assertEquals(80.00, (float)$teacherEarning->amount);
        $this->assertEquals(20.00, (float)$platformEarning->amount);
        $this->assertEquals(100.00, (float)$paymentHistory->amount);
        $this->assertEquals(20.00, (float)$paymentHistory->commission_rate);
    }

    public function test_saas_monthly_teacher_has_zero_commission_and_keeps_100_percent()
    {
        $student = User::factory()->create(['role' => 'student']);
        $teacher = User::factory()->create(['role' => 'teacher']);
        
        $plan = $this->createPlan([
            'billing_type' => 'monthly',
            'commission_percentage' => null,
            'price' => 100,
            'price_egp' => 100,
        ]);

        TeacherSubscription::create([
            'teacher_id' => $teacher->id,
            'plan_id' => $plan->id,
            'status' => 'Active',
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
        ]);

        $course = $this->createCourse($teacher, 50.00);

        $success = RevenueSharingService::handlePurchase(
            $student->id,
            $teacher->id,
            50.00,
            $course->id
        );

        $this->assertTrue($success);

        $teacherEarning = TeacherEarning::where('teacher_id', $teacher->id)->latest()->first();
        $platformEarning = PlatformEarning::where('teacher_id', $teacher->id)->latest()->first();

        $this->assertEquals(50.00, (float)$teacherEarning->amount);
        $this->assertEquals(0.00, (float)$platformEarning->amount);
    }

    public function test_combined_financial_reconciliation_identity_holds_exactly()
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_super_admin' => true]);

        // RevShare teacher sale (100 EGP: 80 teacher, 20 platform)
        $student1 = User::factory()->create(['role' => 'student']);
        $teacher1 = User::factory()->create(['role' => 'teacher']);
        $plan1 = $this->createPlan(['billing_type' => 'revenue_sharing', 'commission_percentage' => 20]);
        TeacherSubscription::create([
            'teacher_id' => $teacher1->id,
            'plan_id' => $plan1->id,
            'status' => 'Active',
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
        ]);
        $course1 = $this->createCourse($teacher1, 100.00);
        RevenueSharingService::handlePurchase($student1->id, $teacher1->id, 100.00, $course1->id);

        // SaaS teacher sale (50 EGP: 50 teacher, 0 platform)
        $student2 = User::factory()->create(['role' => 'student']);
        $teacher2 = User::factory()->create(['role' => 'teacher']);
        $plan2 = $this->createPlan(['billing_type' => 'monthly', 'commission_percentage' => null]);
        TeacherSubscription::create([
            'teacher_id' => $teacher2->id,
            'plan_id' => $plan2->id,
            'status' => 'Active',
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
        ]);
        $course2 = $this->createCourse($teacher2, 50.00);
        RevenueSharingService::handlePurchase($student2->id, $teacher2->id, 50.00, $course2->id);

        $controller = new FinancialController();
        $request = Request::create('/api/admin/financial/dashboard', 'GET', ['range' => 'this_month']);
        $request->setUserResolver(fn() => $admin);
        
        $response = $controller->dashboard($request);
        $data = json_decode($response->getContent(), true);

        $totalRevenue = $data['summary']['filtered_total'];
        $teacherEarnings = $data['summary']['teachers_earnings'];
        $platformCommission = $data['summary']['platform_commission'];

        // Identity: Gross relevant revenue = teacher earnings + platform commission
        $this->assertEquals(150.00, (float)$totalRevenue);
        $this->assertEquals(130.00, (float)$teacherEarnings);
        $this->assertEquals(20.00, (float)$platformCommission);
        $this->assertEquals((float)$totalRevenue, (float)$teacherEarnings + (float)$platformCommission);

        // Reconciliation mismatch alert is false
        $this->assertFalse($data['alerts']['revenue_mismatch']['mismatch']);
        $this->assertEquals(0.00, (float)$data['alerts']['revenue_mismatch']['difference']);
    }

    public function test_two_separate_100_egp_sales_produce_accurate_aggregate_commission()
    {
        $student1 = User::factory()->create(['role' => 'student']);
        $student2 = User::factory()->create(['role' => 'student']);
        $teacher = User::factory()->create(['role' => 'teacher']);
        
        $plan = $this->createPlan(['billing_type' => 'revenue_sharing', 'commission_percentage' => 20]);
        TeacherSubscription::create([
            'teacher_id' => $teacher->id,
            'plan_id' => $plan->id,
            'status' => 'Active',
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
        ]);

        $course1 = $this->createCourse($teacher, 100.00);
        $course2 = $this->createCourse($teacher, 100.00);

        RevenueSharingService::handlePurchase($student1->id, $teacher->id, 100.00, $course1->id);
        RevenueSharingService::handlePurchase($student2->id, $teacher->id, 100.00, $course2->id);

        $teacherEarnings = TeacherEarning::where('teacher_id', $teacher->id)->sum('amount');
        $platformEarnings = PlatformEarning::where('teacher_id', $teacher->id)->sum('amount');
        $totalSales = PaymentHistory::where('teacher_id', $teacher->id)->sum('amount');

        $this->assertEquals(200.00, (float)$totalSales);
        $this->assertEquals(160.00, (float)$teacherEarnings);
        $this->assertEquals(40.00, (float)$platformEarnings);
    }

    public function test_discounted_sale_calculates_commission_from_actual_paid_amount()
    {
        $student = User::factory()->create(['role' => 'student']);
        $teacher = User::factory()->create(['role' => 'teacher']);
        
        $plan = $this->createPlan(['billing_type' => 'revenue_sharing', 'commission_percentage' => 20]);
        TeacherSubscription::create([
            'teacher_id' => $teacher->id,
            'plan_id' => $plan->id,
            'status' => 'Active',
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
        ]);

        $course = $this->createCourse($teacher, 100.00);

        // Original 100, discount 30, actual paid 70
        RevenueSharingService::handlePurchase(
            $student->id,
            $teacher->id,
            70.00,
            $course->id,
            null,
            null,
            null,
            'wallet',
            null,
            100.00,
            30.00
        );

        $teacherEarning = TeacherEarning::where('teacher_id', $teacher->id)->latest()->first();
        $platformEarning = PlatformEarning::where('teacher_id', $teacher->id)->latest()->first();
        $paymentHistory = PaymentHistory::where('student_id', $student->id)->latest()->first();

        // 20% of 70 = 14, 80% of 70 = 56
        $this->assertEquals(70.00, (float)$paymentHistory->amount);
        $this->assertEquals(100.00, (float)$paymentHistory->original_price);
        $this->assertEquals(30.00, (float)$paymentHistory->discount_amount);
        $this->assertEquals(56.00, (float)$teacherEarning->amount);
        $this->assertEquals(14.00, (float)$platformEarning->amount);
    }
}
