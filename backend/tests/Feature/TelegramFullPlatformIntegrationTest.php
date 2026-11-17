<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\ExamStudentResultVisibility;
use App\Models\TelegramUser;
use App\Models\GuardianStudentRelation;
use App\Models\GiftCode;
use App\Models\GiftCodeRedemption;
use App\Models\MarketingCampaign;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\TelegramService;
use App\Services\TelegramUserService;
use App\Services\TelegramGuardianService;
use App\Services\TelegramGiftCodeService;
use App\Services\TelegramCampaignService;
use App\Services\ExamResultVisibilityService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;
use Carbon\Carbon;

class TelegramFullPlatformIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Config::set('services.telegram.bot_token', '123456789:ABCDefGhIJKlmNoPQRstuvWXyz');
        Config::set('services.telegram.bot_username', 'khatwtk_edu_bot');
        Config::set('services.telegram.official_frontend_domain', 'https://manst-khatwtak.vercel.app');
    }

    /**
     * Test Phase 6: Student course listing and exam result masking.
     */
    public function test_student_services_respect_exam_visibility(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $student = User::factory()->create(['role' => 'student']);

        $course = Course::factory()->create([
            'teacher_id' => $teacher->id,
            'title' => 'كيمياء الثانوية العامة',
            'subject' => 'كيمياء',
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
        ]);

        $exam = Exam::factory()->create([
            'course_id' => $course->id,
            'title' => 'امتحان الباب الأول',
            'total_score' => 100,
            'show_score' => false, // Teacher hid score
        ]);

        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $exam->id,
            'score' => 85,
            'status' => 'graded',
        ]);

        $userService = app(TelegramUserService::class);

        $coursesText = $userService->getStudentCoursesText($student);
        $this->assertStringContainsString('كيمياء الثانوية العامة', $coursesText);

        $resultsText = $userService->getStudentResultsText($student);
        $this->assertStringContainsString('امتحان الباب الأول', $resultsText);
        $this->assertStringContainsString('قيد المراجعة', $resultsText);
        $this->assertStringNotContainsString('85', $resultsText); // Score must be masked!
    }

    /**
     * Test Phase 6: Teacher & University Doctor statistics.
     */
    public function test_teacher_and_doctor_statistics(): void
    {
        $schoolTeacher = User::factory()->create([
            'role' => 'teacher',
            'category' => 'school',
            'bunny_storage_used_gb' => 12.5,
            'bunny_storage_limit_gb' => 50.0,
        ]);

        $doctor = User::factory()->create([
            'role' => 'teacher',
            'category' => 'university',
            'bunny_storage_used_gb' => 25.0,
            'bunny_storage_limit_gb' => 100.0,
        ]);

        $userService = app(TelegramUserService::class);

        $teacherText = $userService->getTeacherStatsText($schoolTeacher);
        $this->assertStringContainsString('أستاذ', $teacherText);
        $this->assertStringContainsString('12.5 GB', $teacherText);

        $doctorText = $userService->getTeacherStatsText($doctor);
        $this->assertStringContainsString('دكتور', $doctorText);
        $this->assertStringContainsString('25 GB', $doctorText);
    }

    /**
     * Test Phase 5: Guardian weekly report and unauthorized access prevention.
     */
    public function test_guardian_weekly_report_and_authorization(): void
    {
        $student = User::factory()->create(['role' => 'student', 'name' => 'يوسف إبراهيم']);
        $unrelatedStudent = User::factory()->create(['role' => 'student', 'name' => 'طالب غريب']);

        $guardianTg = TelegramUser::create([
            'telegram_user_id' => 888101,
            'telegram_chat_id' => 888101,
            'role' => 'guardian',
        ]);

        GuardianStudentRelation::create([
            'guardian_telegram_account_id' => $guardianTg->id,
            'student_user_id' => $student->id,
            'verified_phone' => '01012345678',
            'status' => 'active',
        ]);

        $guardianService = app(TelegramGuardianService::class);

        $authorizedReport = $guardianService->getStudentWeeklyReportText($guardianTg, $student->id);
        $this->assertStringContainsString('يوسف إبراهيم', $authorizedReport);

        $unauthorizedReport = $guardianService->getStudentWeeklyReportText($guardianTg, $unrelatedStudent->id);
        $this->assertStringContainsString('غير مصرح لك', $unauthorizedReport);
    }

    /**
     * Test Phase 7: Multi-role Gift Codes and Wallet recharge.
     */
    public function test_multi_role_gift_codes_and_wallet_credit(): void
    {
        $student = User::factory()->create(['role' => 'student']);
        $teacher = User::factory()->create(['role' => 'teacher', 'category' => 'school']);

        // 1. Student-only code
        $studentCode = GiftCode::create([
            'code' => 'STUDENT2026',
            'target_roles' => ['student'],
            'gift_type' => 'wallet_credit',
            'benefit_value' => 50.00,
            'max_redemptions' => 10,
            'is_active' => true,
        ]);

        $giftService = app(TelegramGiftCodeService::class);

        // Teacher tries to redeem student code -> REJECTED
        $resTeacher = $giftService->redeem($teacher, 'STUDENT2026');
        $this->assertFalse($resTeacher['success']);
        $this->assertStringContainsString('غير مخصص لفئتك', $resTeacher['message']);

        // Student redeems student code -> SUCCESS
        $resStudent = $giftService->redeem($student, 'STUDENT2026');
        $this->assertTrue($resStudent['success']);
        $this->assertStringContainsString('50', $resStudent['message']);

        // Check wallet
        $wallet = Wallet::where('student_id', $student->id)->first();
        $this->assertNotNull($wallet);
        $this->assertEquals(50.00, $wallet->balance);

        // Reusing the same code -> REJECTED
        $resReuse = $giftService->redeem($student, 'STUDENT2026');
        $this->assertFalse($resReuse['success']);
        $this->assertStringContainsString('مسبقاً', $resReuse['message']);
    }

    /**
     * Test Phase 7: Targeted Marketing Campaign Broadcast.
     */
    public function test_targeted_marketing_campaign_broadcast(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        TelegramUser::create([
            'telegram_user_id' => 777101,
            'telegram_chat_id' => 777101,
            'role' => 'student',
            'marketing_opt_in' => true,
        ]);

        TelegramUser::create([
            'telegram_user_id' => 777102,
            'telegram_chat_id' => 777102,
            'role' => 'teacher',
            'marketing_opt_in' => true,
        ]);

        $campaign = MarketingCampaign::create([
            'title' => 'عرض خاص بالطلاب',
            'message_template' => 'أهلاً بك {name}، خصم 20% على باقات المراجعة!',
            'target_roles' => ['student'], // Targeted to students only
            'status' => 'draft',
        ]);

        $campaignService = app(TelegramCampaignService::class);
        $result = $campaignService->broadcastCampaign($campaign);

        $this->assertEquals(1, $result['total']);
        $this->assertEquals(1, $result['successful']);
        $this->assertEquals(0, $result['failed']);
    }
}
