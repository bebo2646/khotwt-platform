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
use App\Models\StudentAnswer;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Carbon\Carbon;

class ExamAvailabilityAndCheatingTest extends TestCase
{
    use DatabaseTransactions;

    protected function createTeacher(): User
    {
        return User::create([
            'name' => 'Prof Teacher ' . uniqid(),
            'email' => 'teacher_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
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

    protected function createAdmin(array $permissions = []): User
    {
        return User::create([
            'name' => 'Admin ' . uniqid(),
            'email' => 'admin_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'status' => 'active',
            'permissions' => $permissions,
        ]);
    }

    protected function setupCourseExam(User $teacher, array $examAttributes = []): array
    {
        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Test Course ' . uniqid(),
            'description' => 'Test Course Description',
            'price' => 0,
            'status' => 'published',
            'subject' => 'Math',
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
            'title' => 'Test Exam ' . uniqid(),
            'type' => 'quiz',
            'time_limit_minutes' => 60,
            'max_score' => 20,
            'allowed_violations' => 3,
            'auto_submit_on_violation' => true,
        ], $examAttributes));

        $q1 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'What is 2 + 2?',
            'type' => 'mcq',
            'options' => ['2', '3', '4', '5'],
            'correct_answer' => '4',
            'score' => 10,
        ]);

        $q2 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'What is 5 * 2?',
            'type' => 'mcq',
            'options' => ['5', '10', '15', '20'],
            'correct_answer' => '10',
            'score' => 10,
        ]);

        return compact('course', 'unit', 'lesson', 'exam', 'q1', 'q2');
    }

    public function test_student_cannot_start_exam_after_availability_window_ended(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        // Expired availability window: ended yesterday
        $setup = $this->setupCourseExam($teacher, [
            'open_date' => Carbon::now()->subDays(5)->toDateString(),
            'open_time' => '00:00:00',
            'close_date' => Carbon::now()->subDays(1)->toDateString(),
            'close_time' => '23:59:59',
            'enable_schedule' => true,
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
            'status' => 'active',
        ]);

        $response = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");

        $response->assertStatus(403);
        $response->assertJson([
            'error_code' => 'SCHEDULE_EXPIRED',
            'status' => 'expired',
        ]);

        // Verify NO StudentExam attempt was created
        $this->assertEquals(0, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
    }

    public function test_student_cannot_start_exam_before_availability_window_starts(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        // Not started availability window: starts tomorrow
        $setup = $this->setupCourseExam($teacher, [
            'open_date' => Carbon::now()->addDay()->toDateString(),
            'open_time' => '09:00:00',
            'close_date' => Carbon::now()->addDays(5)->toDateString(),
            'close_time' => '23:59:59',
            'enable_schedule' => true,
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
            'status' => 'active',
        ]);

        $response = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$setup['exam']->id}");

        $response->assertStatus(403);
        $response->assertJson([
            'error_code' => 'SCHEDULE_NOT_STARTED',
            'status' => 'not_started',
        ]);

        $this->assertEquals(0, StudentExam::where('student_id', $student->id)->where('exam_id', $setup['exam']->id)->count());
    }

    public function test_submitting_legally_started_attempt_succeeds_even_if_exam_window_ended(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        // Exam window is now in the past
        $setup = $this->setupCourseExam($teacher, [
            'close_date' => Carbon::now()->subMinutes(10)->toDateString(),
            'close_time' => Carbon::now()->subMinutes(10)->toTimeString(),
            'enable_schedule' => true,
        ]);

        // But student started attempt 15 minutes ago with 60 minute duration (attempt expires in 45 mins)
        $startedAt = Carbon::now()->subMinutes(15);
        $attempt = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $setup['exam']->id,
            'course_id' => $setup['course']->id,
            'lesson_id' => $setup['lesson']->id,
            'status' => 'started',
            'started_at' => $startedAt,
            'duration_minutes' => 60,
            'expires_at' => $startedAt->copy()->addMinutes(60),
        ]);

        $response = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/submit", [
            'attempt_id' => $attempt->id,
            'answers' => [
                $setup['q1']->id => '4', // correct (+10)
                $setup['q2']->id => '10', // correct (+10)
            ],
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'score' => 20,
            'status' => 'graded',
        ]);

        $attempt->refresh();
        $this->assertEquals('graded', $attempt->status);
        $this->assertEquals(20, $attempt->score);
    }

    public function test_cheating_terminated_attempt_has_answers_hidden_until_unlocked(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        $setup = $this->setupCourseExam($teacher, [
            'allowed_violations' => 2,
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $setup['course']->id,
            'status' => 'active',
        ]);

        $attempt = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $setup['exam']->id,
            'course_id' => $setup['course']->id,
            'lesson_id' => $setup['lesson']->id,
            'status' => 'started',
            'started_at' => now(),
            'duration_minutes' => 60,
            'expires_at' => now()->addMinutes(60),
        ]);

        // Violation 1
        $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/log-violation", [
            'attempt_id' => $attempt->id,
            'violation_type' => 'tab_switch',
        ]);

        // Violation 2 -> Limit reached (2) -> Terminated for cheating!
        $violRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$setup['exam']->id}/log-violation", [
            'attempt_id' => $attempt->id,
            'violation_type' => 'window_blur',
        ]);

        $violRes->assertStatus(200);
        $violRes->assertJson([
            'status' => 'terminated_for_cheating',
            'terminated' => true,
        ]);

        $attempt->refresh();
        $this->assertEquals('terminated_for_cheating', $attempt->status);
        $this->assertEquals(0, $attempt->score);
        $this->assertFalse($attempt->canViewAnswers());

        // View results as student: answers and explanations must be stripped
        $resultsRes = $this->actingAs($student, 'sanctum')->getJson('/api/student/results');
        $resultsRes->assertStatus(200);
        $resAttempt = collect($resultsRes->json())->firstWhere('id', $attempt->id);
        $this->assertNotNull($resAttempt);
        $this->assertFalse($resAttempt['can_view_answers']);
        $this->assertTrue($resAttempt['is_terminated_for_cheating']);

        // Check each question has no correct_answer
        foreach ($resAttempt['exam']['questions'] as $q) {
            $this->assertNull($q['correct_answer'] ?? null);
            $this->assertNull($q['explanation'] ?? null);
        }

        // Teacher unlocks answers
        $unlockRes = $this->actingAs($teacher, 'sanctum')->postJson("/api/teacher/exams/attempts/{$attempt->id}/unlock-answers");
        $unlockRes->assertStatus(200);
        $unlockRes->assertJson(['success' => true]);

        $attempt->refresh();
        $this->assertTrue($attempt->canViewAnswers());

        // Now student can view answers
        $resultsRes2 = $this->actingAs($student, 'sanctum')->getJson('/api/student/results');
        $resultsRes2->assertStatus(200);
        $resAttempt2 = collect($resultsRes2->json())->firstWhere('id', $attempt->id);
        $this->assertTrue($resAttempt2['can_view_answers']);
    }

    public function test_monthly_exam_start_enforces_availability(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        $monthlyExam = Exam::create([
            'teacher_id' => $teacher->id,
            'title' => 'Monthly Exam ' . uniqid(),
            'type' => 'monthly_exam',
            'month' => 'شهر سبتمبر',
            'grade' => '3',
            'subject' => 'Math',
            'time_limit_minutes' => 60,
            'max_score' => 50,
            'price' => 0,
            'is_paid' => false,
            'is_published' => true,
            'is_active' => true,
            'close_date' => Carbon::now()->subDays(2)->toDateString(),
            'close_time' => '23:59:59',
            'enable_schedule' => true,
        ]);

        Question::create([
            'exam_id' => $monthlyExam->id,
            'text' => 'Sample Question',
            'type' => 'mcq',
            'options' => ['A', 'B'],
            'correct_answer' => 'A',
            'score' => 50,
        ]);

        $response = $this->actingAs($student, 'sanctum')->postJson("/api/monthly-exams/{$monthlyExam->id}/start");

        $response->assertStatus(403);
        $response->assertJson([
            'error_code' => 'SCHEDULE_EXPIRED',
            'status' => 'expired',
        ]);
    }

    public function test_exam_start_enforces_max_attempts_limit(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupCourseExam($teacher, [
            'max_attempts' => 1,
        ]);
        $exam = $data['exam'];
        $course = $data['course'];

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
        ]);

        // First attempt: should succeed
        $startRes1 = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$exam->id}/start");
        $startRes1->assertStatus(200);

        // Submit the first attempt
        $submitRes = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$exam->id}/submit", [
            'attempt_id' => $startRes1->json('attempt_id'),
            'answers' => [
                $data['q1']->id => '4',
                $data['q2']->id => '2',
            ],
            'time_spent' => 120,
        ]);
        $submitRes->assertStatus(200);

        // Second attempt: should be rejected with 403 ATTEMPTS_LIMIT_REACHED
        $startRes2 = $this->actingAs($student, 'sanctum')->postJson("/api/exams/{$exam->id}/start");
        $startRes2->assertStatus(403);
        $startRes2->assertJson([
            'error_code' => 'ATTEMPTS_LIMIT_REACHED',
        ]);

        // checkAvailability endpoint should also return ATTEMPTS_LIMIT_REACHED
        $checkRes = $this->actingAs($student, 'sanctum')->getJson("/api/exams/{$exam->id}/check-availability");
        $checkRes->assertStatus(403);
        $checkRes->assertJson([
            'error_code' => 'ATTEMPTS_LIMIT_REACHED',
        ]);
    }

    public function test_student_results_with_null_lesson_exam_returns_cleanly(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        $standaloneExam = Exam::create([
            'teacher_id' => $teacher->id,
            'title' => 'Standalone Exam Without Lesson ' . uniqid(),
            'type' => 'exam',
            'lesson_id' => null,
            'time_limit_minutes' => 60,
            'max_score' => 20,
            'is_published' => true,
        ]);

        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $standaloneExam->id,
            'score' => 18,
            'status' => 'graded',
            'started_at' => now()->subMinutes(30),
            'submitted_at' => now()->subMinutes(10),
        ]);

        $res = $this->actingAs($student, 'sanctum')->getJson('/api/student/results');
        $res->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($res->json()));
        $found = collect($res->json())->firstWhere('exam.id', $standaloneExam->id);
        $this->assertNotNull($found);
        $this->assertNull($found['exam']['lesson'] ?? null);
    }
}
