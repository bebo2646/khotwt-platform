<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Pdf;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Enrollment;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\PaymentHistory;
use App\Models\TeacherEarning;
use App\Models\PlatformEarning;
use App\Models\TeacherPayout;
use App\Models\VideoProgress;
use App\Models\StudentExam;
use App\Models\StudentAnswer;
use App\Models\ExamPurchase;
use App\Models\Notification;
use App\Models\NotificationRead;
use App\Models\StudentPdfProgress;
use App\Models\StudentCourseViewLimit;
use App\Models\VideoViewSession;
use App\Services\AcademicYearResetService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class AcademicYearResetTest extends TestCase
{
    use DatabaseTransactions;

    protected function createAdmin(bool $isSuper = true, array $permissions = ['academic_year.initialize']): User
    {
        return User::create([
            'name' => 'Test Admin ' . uniqid(),
            'email' => 'admin_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super' => $isSuper,
            'is_super_admin' => $isSuper,
            'permissions' => $permissions,
            'status' => 'active',
        ]);
    }

    public function test_reset_requires_authentication(): void
    {
        $response = $this->postJson('/api/admin/reset-year', [
            'confirmation' => AcademicYearResetService::REQUIRED_CONFIRMATION,
        ]);
        $response->assertStatus(401);
    }

    public function test_reset_denies_student_role(): void
    {
        $student = User::create([
            'name' => 'Student ' . uniqid(),
            'email' => 'student_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->actingAs($student)->postJson('/api/admin/reset-year', [
            'confirmation' => AcademicYearResetService::REQUIRED_CONFIRMATION,
        ]);
        $response->assertStatus(403);
    }

    public function test_reset_requires_academic_year_initialize_permission(): void
    {
        // Admin with other permission, but not academic_year.initialize
        $admin = $this->createAdmin(false, ['dashboard.view']);

        $response = $this->actingAs($admin)->postJson('/api/admin/reset-year', [
            'confirmation' => AcademicYearResetService::REQUIRED_CONFIRMATION,
        ]);
        $response->assertStatus(403);
    }

    public function test_reset_requires_exact_confirmation_text(): void
    {
        $admin = $this->createAdmin(true);

        $response = $this->actingAs($admin)->postJson('/api/admin/reset-year', [
            'confirmation' => 'WRONG CONFIRMATION TEXT',
        ]);
        $response->assertStatus(422);
    }

    /**
     * Complete comprehensive Test scenario (Tests A through M).
     */
    public function test_full_academic_year_reset_lifecycle_and_safety(): void
    {
        $admin = $this->createAdmin(true);

        // TEST A: Create teacher A
        $teacher = User::create([
            'name' => 'Teacher A ' . uniqid(),
            'email' => 'teacher_a_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['first_secondary'],
        ]);

        // TEST B: Teacher A owns Course A, Course B, and Bundle AB containing Course A + B
        $courseA = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course A Physics',
            'price' => 150.00,
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $unitA = Unit::create(['course_id' => $courseA->id, 'title' => 'Unit 1', 'order' => 1]);
        $lessonA = Lesson::create(['unit_id' => $unitA->id, 'title' => 'Lesson 1', 'order' => 1]);
        $videoA = Video::create([
            'lesson_id' => $lessonA->id,
            'title' => 'Video 1',
            'bunny_stream_id' => 'bunny-vid-123',
            'bunny_embed_url' => 'https://iframe.mediadelivery.net/embed/123/bunny-vid-123',
            'duration_seconds' => 1800,
        ]);
        $pdfA = Pdf::create(['lesson_id' => $lessonA->id, 'title' => 'Notes 1', 'file_path' => '/storage/notes1.pdf']);
        $examA = Exam::create(['lesson_id' => $lessonA->id, 'title' => 'Quiz 1', 'type' => 'quiz', 'max_score' => 20]);
        $questionA = Question::create([
            'exam_id' => $examA->id,
            'text' => 'What is velocity?',
            'type' => 'mcq',
            'options' => json_encode(['Speed with direction', 'Mass', 'Energy']),
            'correct_answer' => 'Speed with direction',
            'score' => 5,
        ]);

        $courseB = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course B Physics',
            'price' => 200.00,
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $bundleAB = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Bundle AB (Course A + Course B)',
            'price' => 300.00,
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'is_published' => true,
            'is_bundle' => true,
        ]);

        // Link Course A and Course B inside Bundle AB
        DB::table('course_bundle_items')->insert([
            ['parent_id' => $bundleAB->id, 'child_id' => $courseA->id, 'created_at' => now(), 'updated_at' => now()],
            ['parent_id' => $bundleAB->id, 'child_id' => $courseB->id, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // TEST C: Student 1 purchases Bundle AB
        $student1 = User::create([
            'name' => 'Student 1 ' . uniqid(),
            'email' => 'student1_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        // Student 1 enrolled only in Bundle AB
        $bundleEnrollment = Enrollment::create([
            'student_id' => $student1->id,
            'course_id' => $bundleAB->id,
            'enrolled_at' => now(),
        ]);

        // Verify Student 1 is NOT directly enrolled in Course A or Course B
        $directEnrollmentA = Enrollment::where('student_id', $student1->id)->where('course_id', $courseA->id)->first();
        $this->assertNull($directEnrollmentA);

        // TEST D: Student 2 purchases standalone Course A
        $student2 = User::create([
            'name' => 'Student 2 ' . uniqid(),
            'email' => 'student2_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $directEnrollment2A = Enrollment::create([
            'student_id' => $student2->id,
            'course_id' => $courseA->id,
            'enrolled_at' => now(),
        ]);
        $this->assertNotNull($directEnrollment2A);

        // TEST E: Create student progress, exam attempts, wallet balances, payment history, earnings
        $wallet1 = Wallet::create(['student_id' => $student1->id, 'balance' => 500.00]);
        WalletTransaction::create([
            'wallet_id' => $wallet1->id,
            'type' => 'purchase',
            'amount' => 300.00,
            'description' => 'Purchase Bundle AB',
        ]);

        VideoProgress::create([
            'student_id' => $student1->id,
            'video_id' => $videoA->id,
            'watched_seconds' => 900,
            'watched_percentage' => 50.00,
            'completed' => false,
        ]);

        if (\Schema::hasTable('student_pdf_progresses')) {
            DB::table('student_pdf_progresses')->insert([
                'student_id' => $student1->id,
                'pdf_id' => $pdfA->id,
                'open_count' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (\Schema::hasTable('student_course_view_limits')) {
            DB::table('student_course_view_limits')->insert([
                'student_id' => $student1->id,
                'course_id' => $courseA->id,
                'views_used' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $studentExam = StudentExam::create([
            'student_id' => $student1->id,
            'exam_id' => $examA->id,
            'score' => 18,
            'status' => 'graded',
            'submitted_at' => now(),
        ]);

        StudentAnswer::create([
            'student_exam_id' => $studentExam->id,
            'question_id' => $questionA->id,
            'answer_text' => 'Speed with direction',
            'is_correct' => true,
            'score' => 5,
        ]);

        PaymentHistory::create([
            'student_id' => $student1->id,
            'teacher_id' => $teacher->id,
            'course_id' => $bundleAB->id,
            'amount' => 300.00,
            'payment_method' => 'wallet',
            'status' => 'paid',
        ]);

        TeacherEarning::create([
            'teacher_id' => $teacher->id,
            'student_id' => $student1->id,
            'course_id' => $bundleAB->id,
            'amount' => 240.00,
            'source' => 'direct_purchase',
            'status' => 'pending',
        ]);

        PlatformEarning::create([
            'teacher_id' => $teacher->id,
            'student_id' => $student1->id,
            'course_id' => $bundleAB->id,
            'amount' => 60.00,
            'source' => 'direct_purchase',
        ]);

        $notification = Notification::create([
            'title' => 'Welcome to Semester 1',
            'message' => 'Good luck with your courses.',
            'recipient_type' => 'all',
        ]);

        NotificationRead::create([
            'notification_id' => $notification->id,
            'user_id' => $student1->id,
            'read_at' => now(),
        ]);

        // TEST F: Run "Initialize New Academic Year"
        $response = $this->actingAs($admin)->postJson('/api/admin/reset-year', [
            'confirmation' => AcademicYearResetService::REQUIRED_CONFIRMATION,
        ]);

        $response->assertStatus(200);
        $this->assertTrue($response->json('success'));

        // Verify financial archive was created and exists on disk
        $archiveFile = $response->json('archive_file');
        $this->assertNotEmpty($archiveFile);
        $archivePath = storage_path('app/financial_archives/' . $archiveFile);
        $this->assertTrue(File::exists($archivePath));
        $archiveContent = json_decode(File::get($archivePath), true);
        $this->assertIsArray($archiveContent);
        $this->assertArrayHasKey('tables', $archiveContent);
        $this->assertArrayHasKey('payment_histories', $archiveContent['tables']);

        // Verify PERMANENT EDUCATIONAL STRUCTURE IS PRESERVED
        $this->assertNotNull(User::find($teacher->id));
        $this->assertNotNull(Course::find($courseA->id));
        $this->assertNotNull(Course::find($courseB->id));
        $this->assertNotNull(Course::find($bundleAB->id));
        $this->assertNotNull(Unit::find($unitA->id));
        $this->assertNotNull(Lesson::find($lessonA->id));
        $this->assertNotNull(Video::find($videoA->id));
        $this->assertNotNull(Pdf::find($pdfA->id));
        $this->assertNotNull(Exam::find($examA->id));
        $this->assertNotNull(Question::find($questionA->id));

        // Verify bundle relationship is preserved
        $bundleItemsCount = DB::table('course_bundle_items')->where('parent_id', $bundleAB->id)->count();
        $this->assertEquals(2, $bundleItemsCount);

        // Verify STUDENT/FINANCIAL OPERATIONAL DATA IS RESET
        $this->assertEquals(0, Enrollment::count());
        $this->assertEquals(0, VideoProgress::count());
        $this->assertEquals(0, StudentExam::count());
        $this->assertEquals(0, StudentAnswer::count());
        $this->assertEquals(0, PaymentHistory::count());
        $this->assertEquals(0, TeacherEarning::count());
        $this->assertEquals(0, PlatformEarning::count());
        $this->assertEquals(0, WalletTransaction::count());
        $this->assertEquals(0, Wallet::count());
        $this->assertEquals(0, Notification::count());
        $this->assertEquals(0, NotificationRead::count());
        $this->assertEquals(0, User::where('role', 'student')->count());

        if (\Schema::hasTable('student_pdf_progresses')) {
            $this->assertEquals(0, DB::table('student_pdf_progresses')->count());
        }
        if (\Schema::hasTable('student_course_view_limits')) {
            $this->assertEquals(0, DB::table('student_course_view_limits')->count());
        }

        // TEST G: Register a NEW Student in the new academic year
        $newStudent = User::create([
            'name' => 'New Student ' . uniqid(),
            'email' => 'new_student_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $newWallet = Wallet::create(['student_id' => $newStudent->id, 'balance' => 1000.00]);

        // TEST H: New student purchases standalone Course A
        Enrollment::create([
            'student_id' => $newStudent->id,
            'course_id' => $courseA->id,
            'enrolled_at' => now(),
        ]);

        PaymentHistory::create([
            'student_id' => $newStudent->id,
            'teacher_id' => $teacher->id,
            'course_id' => $courseA->id,
            'amount' => 150.00,
            'payment_method' => 'wallet',
            'status' => 'paid',
        ]);

        TeacherEarning::create([
            'teacher_id' => $teacher->id,
            'student_id' => $newStudent->id,
            'course_id' => $courseA->id,
            'amount' => 120.00,
            'source' => 'direct_purchase',
            'status' => 'pending',
        ]);

        PlatformEarning::create([
            'teacher_id' => $teacher->id,
            'student_id' => $newStudent->id,
            'course_id' => $courseA->id,
            'amount' => 30.00,
            'source' => 'direct_purchase',
        ]);

        // TEST I: New student purchases Bundle AB
        Enrollment::create([
            'student_id' => $newStudent->id,
            'course_id' => $bundleAB->id,
            'enrolled_at' => now(),
        ]);

        // TEST J & K: Verify teacher and platform accounting in new cycle
        $newTeacherEarningsSum = TeacherEarning::where('teacher_id', $teacher->id)->sum('amount');
        $this->assertEquals(120.00, (float)$newTeacherEarningsSum);

        $newPlatformEarningsSum = PlatformEarning::sum('amount');
        $this->assertEquals(30.00, (float)$newPlatformEarningsSum);

        $this->assertEquals(2, Enrollment::where('student_id', $newStudent->id)->count());
    }

    /**
     * TEST L: Verify concurrency lock blocks duplicate execution.
     */
    public function test_concurrent_execution_is_blocked(): void
    {
        $admin = $this->createAdmin(true);

        // Manually acquire lock
        $lock = Cache::lock(AcademicYearResetService::LOCK_KEY, 60);
        $this->assertTrue($lock->get());

        try {
            // Attempt reset while locked
            $response = $this->actingAs($admin)->postJson('/api/admin/reset-year', [
                'confirmation' => AcademicYearResetService::REQUIRED_CONFIRMATION,
            ]);

            $response->assertStatus(409);
            $this->assertFalse($response->json('success'));
        } finally {
            $lock->release();
        }
    }

    /**
     * Explicit verification that all student accounts are deleted and old student login fails.
     */
    public function test_student_accounts_are_permanently_deleted_and_cannot_login(): void
    {
        $admin = $this->createAdmin(true);

        $oldStudentEmail = 'old_student_' . uniqid() . '@test.com';
        $oldStudent = User::create([
            'name' => 'Old Student',
            'email' => $oldStudentEmail,
            'password' => bcrypt('secret123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $teacher = User::create([
            'name' => 'Teacher Preserved',
            'email' => 'teacher_preserved_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
        ]);

        // Student count before reset >= 1
        $this->assertGreaterThan(0, DB::table('users')->where('role', 'student')->count());

        // Execute reset
        $response = $this->actingAs($admin)->postJson('/api/admin/reset-year', [
            'confirmation' => AcademicYearResetService::REQUIRED_CONFIRMATION,
        ]);
        $response->assertStatus(200);

        // Explicit Check: SELECT COUNT(*) FROM users WHERE role = 'student' === 0
        $studentCount = DB::table('users')->where('role', 'student')->count();
        $this->assertEquals(0, $studentCount, 'Student count must be 0 after reset');

        // Verify that old student user record does NOT exist in database
        $this->assertNull(User::find($oldStudent->id));
        $this->assertNull(User::where('email', $oldStudentEmail)->first());

        // Verify that teacher and admin still exist
        $this->assertNotNull(User::find($teacher->id));
        $this->assertNotNull(User::find($admin->id));
    }
}

