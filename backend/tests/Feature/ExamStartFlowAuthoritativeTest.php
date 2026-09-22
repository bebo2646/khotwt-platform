<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Exam;
use App\Models\Question;
use App\Models\StudentExam;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Carbon\Carbon;

class ExamStartFlowAuthoritativeTest extends TestCase
{
    use DatabaseTransactions;

    protected function createTeacher(): User
    {
        return User::create([
            'name' => 'Teacher ' . uniqid(),
            'email' => 'teacher_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Physics',
        ]);
    }

    protected function createStudent(): User
    {
        return User::create([
            'name' => 'Student ' . uniqid(),
            'email' => 'student_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);
    }

    protected function setupExam(User $teacher, array $examAttributes = []): array
    {
        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course ' . uniqid(),
            'description' => 'Test Course Description',
            'price' => 0,
            'status' => 'published',
            'is_published' => true,
            'subject' => 'Physics',
            'grade' => '3',
        ]);

        $unit = Unit::create([
            'course_id' => $course->id,
            'title' => 'Unit 1',
            'order' => 1,
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson 1',
            'order' => 1,
        ]);

        $exam = Exam::create(array_merge([
            'lesson_id' => $lesson->id,
            'teacher_id' => $teacher->id,
            'title' => 'Physics Quiz ' . uniqid(),
            'type' => 'quiz',
            'time_limit_minutes' => 30,
            'max_score' => 20,
            'max_attempts' => 1,
            'allowed_violations' => 3,
            'auto_submit_on_violation' => true,
        ], $examAttributes));

        $q1 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'What is the unit of force?',
            'type' => 'mcq',
            'options' => ['Newton', 'Joule', 'Watt', 'Pascal'],
            'correct_answer' => 'Newton',
            'score' => 10,
        ]);

        $q2 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'Velocity is a vector quantity.',
            'type' => 'true_false',
            'options' => ['true', 'false'],
            'correct_answer' => 'true',
            'score' => 10,
        ]);

        return compact('course', 'unit', 'lesson', 'exam', 'q1', 'q2');
    }

    /**
     * 1. Rules page does not create or consume an attempt.
     */
    public function test_rules_page_preflight_does_not_create_or_consume_attempt(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Student opens rules page (GET /api/exams/{id})
        $response = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");

        $response->assertStatus(200);
        $response->assertJson([
            'has_active_attempt' => false,
            'can_start' => true,
            'attempt_id' => null,
            'attempts_used' => 0,
            'attempts_remaining' => 1,
            'max_attempts' => 1,
            'questions' => [],
        ]);

        // Assert ZERO StudentExam records created
        $this->assertEquals(0, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
    }

    /**
     * 2. Rules page preflight is idempotent across repeat visits/refreshes.
     */
    public function test_rules_page_preflight_is_idempotent(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Simulate 4 page refreshes on rules screen
        for ($i = 0; $i < 4; $i++) {
            $res = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");
            $res->assertStatus(200);
            $res->assertJson(['has_active_attempt' => false, 'attempt_id' => null]);
        }

        $this->assertEquals(0, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
    }

    /**
     * 3. Back navigation does not activate attempt, and course card shows not_started.
     */
    public function test_back_navigation_leaves_course_in_not_started_state(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Visit rules
        $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");

        // Navigate Back to Course (GET /api/courses/{id})
        $courseRes = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$setup['course']->id}");
        $courseRes->assertStatus(200);

        $examData = $courseRes->json('units.0.lessons.0.exams.0');
        $this->assertEquals('not_started', $examData['progress']['status']);
        $this->assertEquals(0, $examData['progress']['attempts_used']);
        $this->assertEquals(1, $examData['progress']['attempts_remaining']);
        $this->assertNull($examData['last_attempt']);
    }

    /**
     * 4. Explicit accept/start creates exactly one attempt.
     */
    public function test_explicit_accept_start_creates_exactly_one_attempt(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Click "أوافق وأبدأ الامتحان" (POST /api/exams/{id}/start)
        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start", [
            'confirmed_rules' => true,
        ]);

        $startRes->assertStatus(200);
        $startRes->assertJson([
            'has_active_attempt' => true,
            'is_resumed' => false,
        ]);
        $this->assertNotNull($startRes->json('attempt_id'));
        $this->assertCount(2, $startRes->json('questions'));
        $this->assertNotNull($startRes->json('started_at'));
        $this->assertNotNull($startRes->json('expires_at'));

        // Assert exactly one record in database
        $this->assertEquals(1, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
        $attempt = StudentExam::find($startRes->json('attempt_id'));
        $this->assertEquals('started', $attempt->status);
        $this->assertNotNull($attempt->started_at);
        $this->assertNotNull($attempt->expires_at);
    }

    /**
     * 5. In-progress state appears on course page ONLY after real start.
     */
    public function test_in_progress_state_appears_only_after_real_start(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Before start: course shows not_started
        $beforeRes = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$setup['course']->id}");
        $this->assertEquals('not_started', $beforeRes->json('units.0.lessons.0.exams.0.progress.status'));

        // Start exam
        $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");

        // After start: course shows in_progress
        $afterRes = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$setup['course']->id}");
        $this->assertEquals('in_progress', $afterRes->json('units.0.lessons.0.exams.0.progress.status'));
        $this->assertEquals(1, $afterRes->json('units.0.lessons.0.exams.0.progress.attempts_used'));
    }

    /**
     * 6. Result is NOT available until valid final submission.
     */
    public function test_result_available_only_after_valid_submission(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Rules page: results list empty
        $resultsBefore = $this->actingAs($student, 'sanctum')->getJson('/api/student/results');
        $this->assertCount(0, $resultsBefore->json());

        // Start exam
        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $attemptId = $startRes->json('attempt_id');

        // While in_progress: results list still does NOT include this started attempt
        $resultsInProgress = $this->actingAs($student, 'sanctum')->getJson('/api/student/results');
        $this->assertCount(0, $resultsInProgress->json());

        // Submit attempt
        $submitRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/submit", [
            'attempt_id' => $attemptId,
            'answers' => [
                $setup['q1']->id => 'Newton',
                $setup['q2']->id => 'true',
            ],
            'time_spent' => 60,
        ]);
        $submitRes->assertStatus(200);

        // Now results list contains the submitted/graded attempt
        $resultsAfter = $this->actingAs($student, 'sanctum')->getJson('/api/student/results');
        $this->assertCount(1, $resultsAfter->json());
        $this->assertEquals($attemptId, $resultsAfter->json('0.id'));
    }

    /**
     * 7. Max attempts remaining unchanged before real start.
     */
    public function test_max_attempts_unchanged_before_real_start(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher, ['max_attempts' => 1]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Check availability before
        $check1 = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}/check-availability");
        $check1->assertStatus(200);
        $check1->assertJson(['available' => true]);

        // Open rules 3 times
        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");
        }

        // Check availability still available
        $check2 = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}/check-availability");
        $check2->assertStatus(200);
        $check2->assertJson(['available' => true]);
    }

    /**
     * 8. Multiple tabs / duplicate start requests resolve safely to same attempt without duplicates.
     */
    public function test_multiple_tabs_duplicate_start_requests_are_safe(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher, ['max_attempts' => 1]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Tab A calls start
        $tabA = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $tabA->assertStatus(200);
        $attemptIdA = $tabA->json('attempt_id');

        // Tab B calls start
        $tabB = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $tabB->assertStatus(200);
        $attemptIdB = $tabB->json('attempt_id');

        // Both resolve to the EXACT SAME attempt ID
        $this->assertEquals($attemptIdA, $attemptIdB);

        // Exactly 1 row in database
        $this->assertEquals(1, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
    }

    /**
     * 9. Active attempt is resumed on revisit.
     */
    public function test_active_attempt_is_resumed_on_revisit(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Start exam
        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $attemptId = $startRes->json('attempt_id');

        // Revisit exam via GET
        $revisit = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");
        $revisit->assertStatus(200);
        $revisit->assertJson([
            'has_active_attempt' => true,
            'is_resumed' => true,
            'attempt_id' => $attemptId,
        ]);

        // Total count still 1
        $this->assertEquals(1, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
    }

    /**
     * 10. Timer starts only after actual start.
     */
    public function test_timer_starts_only_after_actual_start(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $setup = $this->setupExam($teacher, ['time_limit_minutes' => 45]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        // Rules page: no started_at, no expires_at
        $rulesRes = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");
        $this->assertNull($rulesRes->json('started_at'));
        $this->assertNull($rulesRes->json('expires_at'));

        // Real start
        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $this->assertNotNull($startRes->json('started_at'));
        $this->assertNotNull($startRes->json('expires_at'));

        $startedAt = Carbon::parse($startRes->json('started_at'));
        $expiresAt = Carbon::parse($startRes->json('expires_at'));
        $this->assertEquals(45, $startedAt->diffInMinutes($expiresAt));
    }

    /**
     * 11. Effective duration is capped when availability deadline is earlier than nominal duration.
     * Example: duration 60 min, ends in 30 min -> effective duration is 30 min, expires_at = ends_at.
     */
    public function test_effective_duration_is_capped_when_deadline_is_earlier_than_nominal_duration(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        
        $now = Carbon::create(2026, 9, 23, 11, 30, 0);
        Carbon::setTestNow($now);

        $deadline = Carbon::create(2026, 9, 23, 12, 0, 0);

        $setup = $this->setupExam($teacher, [
            'time_limit_minutes' => 60,
            'close_date' => $deadline->toDateString(),
            'close_time' => $deadline->toTimeString(),
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $startRes->assertStatus(200);

        $this->assertEquals(30, $startRes->json('effective_duration_minutes'));
        $this->assertEquals(1800, $startRes->json('effective_duration_seconds'));
        $this->assertEquals(3600, $startRes->json('duration_seconds'));
        $this->assertEquals($deadline->toIso8601String(), Carbon::parse($startRes->json('expires_at'))->toIso8601String());
        $this->assertEquals(1800, $startRes->json('time_remaining_seconds'));

        // DB record also capped
        $attempt = StudentExam::find($startRes->json('attempt_id'));
        $this->assertEquals(30, $attempt->duration_minutes);
        $this->assertEquals($deadline->toIso8601String(), $attempt->expires_at->toIso8601String());

        Carbon::setTestNow();
    }

    /**
     * 12. Nominal duration is kept when availability deadline is farther than nominal duration.
     * Example: duration 60 min, ends in 2 hours -> effective duration is 60 min, expires_at = now + 60 min.
     */
    public function test_nominal_duration_is_kept_when_deadline_is_farther_than_nominal_duration(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        
        $now = Carbon::create(2026, 9, 23, 10, 0, 0);
        Carbon::setTestNow($now);

        $deadline = Carbon::create(2026, 9, 23, 12, 0, 0);

        $setup = $this->setupExam($teacher, [
            'time_limit_minutes' => 60,
            'close_date' => $deadline->toDateString(),
            'close_time' => $deadline->toTimeString(),
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $startRes->assertStatus(200);

        $expectedExpiry = Carbon::create(2026, 9, 23, 11, 0, 0);

        $this->assertEquals(60, $startRes->json('effective_duration_minutes'));
        $this->assertEquals(3600, $startRes->json('effective_duration_seconds'));
        $this->assertEquals(3600, $startRes->json('duration_seconds'));
        $this->assertEquals($expectedExpiry->toIso8601String(), Carbon::parse($startRes->json('expires_at'))->toIso8601String());
        $this->assertEquals(3600, $startRes->json('time_remaining_seconds'));

        Carbon::setTestNow();
    }

    /**
     * 13. Refreshing an active attempt preserves original expires_at without extending time.
     * Example: starts at 11:30 with 12:00 deadline -> expires_at is 12:00.
     * Refresh at 11:50 -> expires_at is STILL 12:00, remaining is 10 min (600s).
     */
    public function test_refreshing_active_attempt_preserves_original_expires_at_without_extending_time(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        
        $t1130 = Carbon::create(2026, 9, 23, 11, 30, 0);
        Carbon::setTestNow($t1130);

        $deadline = Carbon::create(2026, 9, 23, 12, 0, 0);

        $setup = $this->setupExam($teacher, [
            'time_limit_minutes' => 60,
            'close_date' => $deadline->toDateString(),
            'close_time' => $deadline->toTimeString(),
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $attemptId = $startRes->json('attempt_id');
        $this->assertEquals($deadline->toIso8601String(), Carbon::parse($startRes->json('expires_at'))->toIso8601String());

        // Fast forward 20 minutes to 11:50
        $t1150 = Carbon::create(2026, 9, 23, 11, 50, 0);
        Carbon::setTestNow($t1150);

        // Student refreshes (GET /exams/{id})
        $refreshRes = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");
        $refreshRes->assertStatus(200);

        $this->assertTrue($refreshRes->json('has_active_attempt'));
        $this->assertTrue($refreshRes->json('is_resumed'));
        $this->assertEquals($attemptId, $refreshRes->json('attempt_id'));
        $this->assertEquals($deadline->toIso8601String(), Carbon::parse($refreshRes->json('expires_at'))->toIso8601String());
        // Remaining time is 10 minutes = 600s (NOT 30 min or 60 min!)
        $this->assertEquals(600, $refreshRes->json('time_remaining_seconds'));

        Carbon::setTestNow();
    }

    /**
     * 14. Cannot start exam after availability deadline has passed.
     */
    public function test_cannot_start_exam_after_availability_deadline(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        
        $now = Carbon::create(2026, 9, 23, 12, 1, 0);
        Carbon::setTestNow($now);

        $deadline = Carbon::create(2026, 9, 23, 12, 0, 0);

        $setup = $this->setupExam($teacher, [
            'time_limit_minutes' => 60,
            'close_date' => $deadline->toDateString(),
            'close_time' => $deadline->toTimeString(),
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $startRes->assertStatus(403);
        $this->assertEquals('SCHEDULE_EXPIRED', $startRes->json('error_code'));

        Carbon::setTestNow();
    }

    /**
     * 15. Cannot start exam before availability start window.
     */
    public function test_cannot_start_exam_before_availability_start(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        
        $now = Carbon::create(2026, 9, 23, 8, 0, 0);
        Carbon::setTestNow($now);

        $openTime = Carbon::create(2026, 9, 23, 9, 0, 0);

        $setup = $this->setupExam($teacher, [
            'time_limit_minutes' => 60,
            'open_date' => $openTime->toDateString(),
            'open_time' => $openTime->toTimeString(),
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
        ]);

        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/start");
        $startRes->assertStatus(403);
        $this->assertEquals('SCHEDULE_NOT_STARTED', $startRes->json('error_code'));

        Carbon::setTestNow();
    }

    /**
     * 16. Monthly exam duration is also capped by availability deadline.
     */
    public function test_monthly_exam_duration_is_capped_by_availability_deadline(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        $now = Carbon::create(2026, 9, 23, 11, 30, 0);
        Carbon::setTestNow($now);

        $deadline = Carbon::create(2026, 9, 23, 12, 0, 0);

        $exam = Exam::create([
            'teacher_id' => $teacher->id,
            'title' => 'Monthly Exam ' . uniqid(),
            'type' => 'monthly_exam',
            'time_limit_minutes' => 60,
            'max_score' => 100,
            'max_attempts' => 1,
            'is_active' => true,
            'is_published' => true,
            'is_paid' => false,
            'close_date' => $deadline->toDateString(),
            'close_time' => $deadline->toTimeString(),
        ]);

        Question::create([
            'exam_id' => $exam->id,
            'text' => 'Monthly Question 1?',
            'type' => 'mcq',
            'options' => ['A', 'B', 'C', 'D'],
            'correct_answer' => 'A',
            'score' => 100,
        ]);

        $startRes = $this->actingAs($student, 'sanctum')->postJson("/api/monthly-exams/{$exam->id}/start");
        $startRes->assertStatus(200);

        $this->assertEquals(30, $startRes->json('effective_duration_minutes'));
        $this->assertEquals(1800, $startRes->json('effective_duration_seconds'));
        $this->assertEquals(3600, $startRes->json('duration_seconds'));
        $this->assertEquals($deadline->toIso8601String(), Carbon::parse($startRes->json('expires_at'))->toIso8601String());
        $this->assertEquals(1800, $startRes->json('time_remaining_seconds'));

        // Verify resume also preserves expires_at
        $t1150 = Carbon::create(2026, 9, 23, 11, 50, 0);
        Carbon::setTestNow($t1150);

        $resumeRes = $this->actingAs($student, 'sanctum')->postJson("/api/monthly-exams/{$exam->id}/start");
        $resumeRes->assertStatus(200);
        $this->assertEquals($deadline->toIso8601String(), Carbon::parse($resumeRes->json('expires_at'))->toIso8601String());
        $this->assertEquals(600, $resumeRes->json('time_remaining_seconds'));

        Carbon::setTestNow();
    }
}
