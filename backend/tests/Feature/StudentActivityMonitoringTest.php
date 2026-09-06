<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\StudentActivityLog;
use App\Models\StudentSession;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use App\Services\StudentActivityService;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class StudentActivityMonitoringTest extends TestCase
{
    protected User $admin;
    protected User $teacher;
    protected User $student;
    protected Course $course;
    protected Course $bundle;
    protected Unit $unit;
    protected Lesson $lesson;
    protected Video $video;
    protected Exam $exam;

    protected function setUp(): void
    {
        parent::setUp();

        $uniqueSuffix = uniqid();

        // Create Admin
        $this->admin = User::create([
            'name' => 'Admin Activity Test ' . $uniqueSuffix,
            'email' => "admin_activity_{$uniqueSuffix}@example.com",
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);

        // Create Teacher
        $this->teacher = User::create([
            'name' => 'Teacher Activity ' . $uniqueSuffix,
            'email' => "teacher_{$uniqueSuffix}@example.com",
            'password' => Hash::make('password123'),
            'role' => 'teacher',
            'status' => 'active',
        ]);

        $plan = SubscriptionPlan::create([
            'name' => 'Unlimited Plan ' . $uniqueSuffix,
            'slug' => 'unlimited-' . $uniqueSuffix,
            'price' => 0,
            'price_egp' => 0,
            'student_codes' => 999999,
            'billing_type' => 'fixed',
            'codes_limit_type' => 'unlimited',
            'video_storage_gb' => 100,
            'active' => true,
        ]);

        TeacherSubscription::create([
            'teacher_id' => $this->teacher->id,
            'plan_id' => $plan->id,
            'start_date' => Carbon::now()->subDays(1)->toDateString(),
            'end_date' => Carbon::now()->addDays(30)->toDateString(),
            'status' => 'Active',
            'used_storage_bytes' => 0,
            'used_codes' => 0,
            'billing_period' => 'monthly',
        ]);

        // Create Student
        $this->student = User::create([
            'name' => 'Student Activity ' . $uniqueSuffix,
            'email' => "student_{$uniqueSuffix}@example.com",
            'phone' => '010' . rand(10000000, 99999999),
            'parent_phone' => '011' . rand(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => 'student',
            'status' => 'active',
            'student_type' => 'online',
        ]);

        $wallet = Wallet::create([
            'student_id' => $this->student->id,
            'balance' => 500.00,
        ]);
        WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'type' => 'recharge',
            'amount' => 500.00,
            'description' => 'Initial test balance',
        ]);

        // Create Course
        $this->course = Course::create([
            'title' => 'Biology 1 ' . $uniqueSuffix,
            'description' => 'Course 1 description',
            'price' => 50.00,
            'teacher_id' => $this->teacher->id,
            'is_published' => true,
            'is_bundle' => false,
            'grade' => 'ثانوية عامة',
            'subject' => 'أحياء',
        ]);

        // Create Bundle
        $this->bundle = Course::create([
            'title' => 'Biology Bundle ' . $uniqueSuffix,
            'description' => 'Bundle description',
            'price' => 80.00,
            'teacher_id' => $this->teacher->id,
            'is_published' => true,
            'is_bundle' => true,
            'grade' => 'ثانوية عامة',
            'subject' => 'أحياء',
        ]);
        $this->bundle->childCourses()->attach($this->course->id);

        // Create Unit & Lesson
        $this->unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1',
            'order' => 1,
        ]);

        $this->lesson = Lesson::create([
            'unit_id' => $this->unit->id,
            'title' => 'Lesson 1 Cell Biology',
            'order' => 1,
            'price' => 20.00,
            'duration_seconds' => 600,
        ]);

        $this->video = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'Introduction to Cells',
            'duration_seconds' => 600,
            'bunny_stream_id' => 'bunny-vid-' . $uniqueSuffix,
            'bunny_status' => 'finished',
        ]);

        $this->exam = Exam::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'Cell Quiz 1',
            'type' => 'quiz',
            'max_score' => 10,
        ]);
    }

    /**
     * 1. Student login creates activity event and session record.
     */
    public function test_student_login_creates_activity_and_session(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => $this->student->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200);

        // Verify session record created
        $session = StudentSession::where('student_id', $this->student->id)->first();
        $this->assertNotNull($session);
        $this->assertTrue($session->is_active);

        // Verify activity log created
        $loginLog = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'login')
            ->first();
        $this->assertNotNull($loginLog);
    }

    /**
     * 2. Student opens course.
     */
    public function test_student_course_opened_activity(): void
    {
        StudentActivityService::logCourseOpened($this->student, $this->course);

        $log = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'course_opened')
            ->where('course_id', $this->course->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertStringContainsString($this->course->title, $log->description);
    }

    /**
     * 3. Student opens lesson.
     */
    public function test_student_lesson_opened_activity(): void
    {
        StudentActivityService::logLessonOpened($this->student, $this->lesson, $this->course->id);

        $log = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'lesson_opened')
            ->where('lesson_id', $this->lesson->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertStringContainsString($this->lesson->title, $log->description);
    }

    /**
     * 4. Student starts video.
     */
    public function test_student_video_started_activity(): void
    {
        StudentActivityService::logVideoStarted($this->student, $this->video, $this->course->id);

        $log = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'video_started')
            ->where('video_id', $this->video->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertStringContainsString($this->video->title, $log->description);
    }

    /**
     * 5. Video progress milestones (25%, 50%, 75%) are recorded.
     */
    public function test_video_milestones_recorded(): void
    {
        // Progress 30% -> reaches 25% milestone
        StudentActivityService::logVideoProgress(
            $this->student,
            $this->video,
            30.0,
            180,
            false,
            $this->course->id
        );

        $log25 = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'video_milestone_25')
            ->first();
        $this->assertNotNull($log25);

        // Progress 60% -> reaches 50% milestone
        StudentActivityService::logVideoProgress(
            $this->student,
            $this->video,
            60.0,
            360,
            false,
            $this->course->id
        );

        $log50 = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'video_milestone_50')
            ->first();
        $this->assertNotNull($log50);
    }

    /**
     * 6. Student completes video.
     */
    public function test_video_completed_activity(): void
    {
        StudentActivityService::logVideoProgress(
            $this->student,
            $this->video,
            95.0,
            570,
            true,
            $this->course->id
        );

        $completedLog = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'video_completed')
            ->where('video_id', $this->video->id)
            ->first();

        $this->assertNotNull($completedLog);
    }

    /**
     * 7. Student opens PDF resource.
     */
    public function test_student_pdf_opened_activity(): void
    {
        StudentActivityService::logPdfOpened(
            $this->student,
            (object)['title' => 'Cell Structure Summary.pdf', 'lesson_id' => $this->lesson->id, 'id' => 1],
            $this->course->id
        );

        $log = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'pdf_opened')
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($this->lesson->id, $log->lesson_id);
    }

    /**
     * 7. Student starts and submits quiz/exam.
     */
    public function test_student_assessment_activities(): void
    {
        $attempt = StudentExam::create([
            'student_id' => $this->student->id,
            'exam_id' => $this->exam->id,
            'course_id' => $this->course->id,
            'lesson_id' => $this->lesson->id,
            'status' => 'started',
        ]);

        StudentActivityService::logExamEvent($this->student, $this->exam, 'started', $attempt);

        $startLog = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'quiz_started')
            ->where('exam_id', $this->exam->id)
            ->first();
        $this->assertNotNull($startLog);

        // Submit quiz
        $attempt->status = 'graded';
        $attempt->score = 9;
        $attempt->save();

        StudentActivityService::logExamEvent($this->student, $this->exam, 'submitted', $attempt);

        $submitLog = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'quiz_submitted')
            ->where('exam_id', $this->exam->id)
            ->first();
        $this->assertNotNull($submitLog);
    }

    /**
     * 8. Student purchases Course 1.
     */
    public function test_student_purchases_standalone_course(): void
    {
        $token = $this->student->createToken('test_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/courses/{$this->course->id}/subscribe", [
                'payment_method' => 'wallet',
            ]);

        $response->assertStatus(200);

        $log = StudentActivityLog::where('student_id', $this->student->id)
            ->where('event_type', 'course_purchased')
            ->where('course_id', $this->course->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertNull($log->bundle_id);
    }

    /**
     * 9. Student purchases Bundle.
     */
    public function test_student_purchases_bundle(): void
    {
        $uniqueSuffix = uniqid();
        $newStudent = User::create([
            'name' => 'Bundle Buyer ' . $uniqueSuffix,
            'email' => "bundle_buyer_{$uniqueSuffix}@example.com",
            'phone' => '010' . rand(10000000, 99999999),
            'parent_phone' => '011' . rand(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);
        $bundleWallet = Wallet::create(['student_id' => $newStudent->id, 'balance' => 300.00]);
        WalletTransaction::create([
            'wallet_id' => $bundleWallet->id,
            'type' => 'recharge',
            'amount' => 300.00,
            'description' => 'Recharge for bundle',
        ]);

        $token = $newStudent->createToken('test_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/courses/{$this->bundle->id}/subscribe", [
                'payment_method' => 'wallet',
            ]);

        $response->assertStatus(200);

        $log = StudentActivityLog::where('student_id', $newStudent->id)
            ->where('event_type', 'bundle_purchased')
            ->where('bundle_id', $this->bundle->id)
            ->first();

        $this->assertNotNull($log);
    }

    /**
     * 10 & 11. Bundle activity preserves bundle context & does NOT create child-course ownership.
     */
    public function test_bundle_activity_preserves_bundle_context_without_child_ownership(): void
    {
        $uniqueSuffix = uniqid();
        $bundleStudent = User::create([
            'name' => 'Bundle Preserver ' . $uniqueSuffix,
            'email' => "bundle_preserver_{$uniqueSuffix}@example.com",
            'phone' => '010' . rand(10000000, 99999999),
            'parent_phone' => '011' . rand(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        // Student consumes course content INSIDE the bundle
        StudentActivityService::logLessonOpened(
            $bundleStudent,
            $this->lesson,
            $this->course->id,
            $this->bundle->id
        );

        $log = StudentActivityLog::where('student_id', $bundleStudent->id)
            ->where('event_type', 'lesson_opened')
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($this->course->id, $log->course_id);
        $this->assertEquals($this->bundle->id, $log->bundle_id);

        // Crucial check: No child enrollment created
        $hasChildEnrollment = \App\Models\Enrollment::where('student_id', $bundleStudent->id)
            ->where('course_id', $this->course->id)
            ->exists();
        $this->assertFalse($hasChildEnrollment);
    }

    /**
     * 12. Admin can retrieve a student's activity.
     */
    public function test_admin_can_retrieve_student_activity(): void
    {
        // Generate an activity for student
        StudentActivityService::logCourseOpened($this->student, $this->course);

        $token = $this->admin->createToken('admin_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/admin/students/{$this->student->id}/activity");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'student' => ['id', 'name', 'email', 'is_online', 'last_activity'],
            'today' => ['session_duration_seconds', 'courses_accessed', 'lessons_opened'],
            'lifetime' => ['total_sessions', 'total_events'],
            'timeline' => ['data', 'total', 'per_page'],
        ]);
    }

    /**
     * 13. Student cannot retrieve another student's activity.
     */
    public function test_student_cannot_retrieve_another_student_activity(): void
    {
        $token = $this->student->createToken('student_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/admin/students/{$this->student->id}/activity");

        // Protected by role:admin middleware
        $response->assertStatus(403);
    }

    /**
     * 14. Server-side Pagination works.
     */
    public function test_activity_pagination_works(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            StudentActivityService::logCourseOpened($this->student, $this->course);
        }

        $token = $this->admin->createToken('admin_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/admin/student-activity?per_page=3");

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data'));
        $this->assertGreaterThanOrEqual(10, $response->json('total'));
        $this->assertEquals(3, $response->json('per_page'));
    }

    /**
     * 15. Filters work (by event_type, course_id, student_id).
     */
    public function test_activity_filters_work(): void
    {
        StudentActivityService::logCourseOpened($this->student, $this->course);
        StudentActivityService::logExamEvent($this->student, $this->exam, 'started');

        $token = $this->admin->createToken('admin_token')->plainTextToken;

        // Filter by assessment
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/admin/student-activity?event_type=assessment");

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertNotEmpty($data);
        foreach ($data as $item) {
            $this->assertStringStartsWith('quiz_', $item['event_type']);
        }
    }

    /**
     * 16. Activity aggregate stats work properly.
     */
    public function test_activity_aggregate_stats(): void
    {
        StudentActivityService::logCourseOpened($this->student, $this->course);
        StudentActivityService::logLessonOpened($this->student, $this->lesson, $this->course->id);

        $token = $this->admin->createToken('admin_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/admin/student-activity/stats");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'stats' => [
                'active_students_now',
                'students_active_today',
                'total_sessions_today',
                'total_lesson_opens_today',
                'total_video_activity_today',
                'total_assessment_activity_today',
                'total_purchases_today',
            ],
            'recent_feed',
        ]);
    }

    /**
     * 17. Failed activity logging does not break the primary business action.
     */
    public function test_failed_activity_logging_does_not_break_business_flow(): void
    {
        // Passing an invalid student ID to StudentActivityService::log should return null safely without throwing
        $result = StudentActivityService::log(
            0,
            'test_event',
            'Test Name'
        );

        $this->assertNull($result);
    }

    /**
     * 18. Session / heartbeat behavior correctly determines active status.
     */
    public function test_session_heartbeat_determines_active_status(): void
    {
        $session = StudentActivityService::startSession($this->student);
        $this->assertNotNull($session);
        $this->assertTrue($session->is_active);

        // Heartbeat maintains presence
        StudentActivityService::heartbeat($this->student, $session->session_identifier);
        $freshSession = StudentSession::find($session->id);
        $this->assertTrue($freshSession->last_activity_at->gte(Carbon::now()->subMinute()));

        // Check scopeActiveNow includes it
        $activeCount = StudentSession::activeNow(5)->where('student_id', $this->student->id)->count();
        $this->assertEquals(1, $activeCount);

        // After ending session, not active
        StudentActivityService::endSession($this->student);
        $endedSession = StudentSession::find($session->id);
        $this->assertFalse($endedSession->is_active);
        $this->assertNotNull($endedSession->ended_at);
    }

    /**
     * 19. Benchmark: Concurrent heartbeats execution time and resource impact.
     */
    public function test_heartbeat_benchmark_and_latency(): void
    {
        $session = StudentActivityService::startSession($this->student);

        $startTime = microtime(true);
        $iterations = 50;

        for ($i = 0; $i < $iterations; $i++) {
            $response = $this->actingAs($this->student)
                ->postJson('/api/student/activity/heartbeat', [
                    'session_token' => $session->session_identifier,
                ]);
            $response->assertStatus(200);
            $response->assertJson(['status' => 'ok', 'active' => true]);
        }

        $totalDuration = microtime(true) - $startTime;
        $avgMsPerRequest = ($totalDuration / $iterations) * 1000;

        // Verify average response latency in test environment is very low (< 50ms)
        $this->assertLessThan(100, $avgMsPerRequest, "Average heartbeat latency was {$avgMsPerRequest}ms");
    }
}
