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
use App\Models\ExamStudentResultVisibility;
use App\Services\ExamResultVisibilityService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Carbon\Carbon;

class ExamVisibilityAndAttemptsTest extends TestCase
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

    protected function createAdmin(): User
    {
        return User::create([
            'name' => 'Admin ' . uniqid(),
            'email' => 'admin_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);
    }

    protected function setupExam(User $teacher, array $examAttributes = []): array
    {
        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Physics Course ' . uniqid(),
            'description' => 'Course description',
            'price' => 0,
            'status' => 'published',
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
            'course_id' => $course->id,
            'teacher_id' => $teacher->id,
            'title' => 'Comprehensive Quiz',
            'type' => 'quiz',
            'max_score' => 20,
            'passing_score' => 10,
            'time_limit_minutes' => 30,
            'max_attempts' => 2,
            'is_published' => true,
            'is_active' => true,
            'show_score' => true,
            'show_student_answers' => true,
            'show_correct_answers' => true,
            'show_explanations' => true,
        ], $examAttributes));

        $q1 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'What is the speed of light?',
            'type' => 'mcq',
            'options' => ['3x10^8 m/s', '1.5x10^8 m/s', '300 m/s', 'None'],
            'correct_answer' => '3x10^8 m/s',
            'score' => 10,
            'explanation' => 'Speed of light in vacuum is approximately 300,000 km/s.',
        ]);

        $q2 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'Energy is conserved.',
            'type' => 'true_false',
            'options' => ['صح', 'خطأ'],
            'correct_answer' => 'صح',
            'score' => 10,
            'explanation' => 'Law of conservation of energy states that energy cannot be created or destroyed.',
        ]);

        return compact('course', 'unit', 'lesson', 'exam', 'q1', 'q2');
    }

    protected function enrollStudent(User $student, Course $course): Enrollment
    {
        return Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'status' => 'active',
            'enrolled_at' => Carbon::now(),
        ]);
    }

    // =========================================================================
    // 1. ATTEMPT LIFECYCLE TESTS (The 1/2 attempts bug fix verification)
    // =========================================================================

    public function test_student_can_start_second_attempt_when_max_attempts_is_two(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['max_attempts' => 2]);
        $this->enrollStudent($student, $data['course']);

        // First attempt started and submitted
        $attempt1 = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 10,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
            'graded_at' => Carbon::now()->subMinutes(5),
        ]);

        // Student views results
        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);
        $attemptData = collect($res->json())->firstWhere('id', $attempt1->id);
        $this->assertNotNull($attemptData);
        $this->assertEquals(1, $attemptData['attempts_used']);
        $this->assertEquals(2, $attemptData['max_attempts']);
        $this->assertEquals(1, $attemptData['attempts_remaining']);

        // Student views course detail - verify course exam card payload
        $courseRes = $this->actingAs($student)->getJson("/api/courses/{$data['course']->id}");
        $courseRes->assertStatus(200);
        $examPayload = $courseRes->json('units.0.lessons.0.exams.0');
        $this->assertNotNull($examPayload);
        $this->assertEquals(1, $examPayload['attempts_count']);
        $this->assertEquals(2, $examPayload['max_attempts']);
        $this->assertEquals(1, $examPayload['progress']['attempts_used']);
        $this->assertEquals(1, $examPayload['progress']['attempts_remaining']);

        // Student starts attempt 2
        $startRes = $this->actingAs($student)->postJson("/api/exams/{$data['exam']->id}/start");
        $startRes->assertStatus(200);

        $attempt2 = StudentExam::where('student_id', $student->id)
            ->where('exam_id', $data['exam']->id)
            ->where('id', '!=', $attempt1->id)
            ->first();
        $this->assertNotNull($attempt2);
        $this->assertEquals('started', $attempt2->status);
    }

    public function test_student_blocked_from_starting_third_attempt_when_max_attempts_is_two(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['max_attempts' => 2]);
        $this->enrollStudent($student, $data['course']);

        // Attempt 1 submitted
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 10,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(40),
            'submitted_at' => Carbon::now()->subMinutes(30),
        ]);

        // Attempt 2 submitted
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 20,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(10),
        ]);

        // Results verify 2/2 attempts used
        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);
        $attemptData = collect($res->json())->firstWhere('exam_id', $data['exam']->id);
        $this->assertNotNull($attemptData);
        $this->assertEquals(2, $attemptData['attempts_used']);
        $this->assertEquals(2, $attemptData['max_attempts']);
        $this->assertEquals(0, $attemptData['attempts_remaining']);

        // Starting attempt 3 must be blocked with 403
        $startRes = $this->actingAs($student)->postJson("/api/exams/{$data['exam']->id}/start");
        $startRes->assertStatus(403);
    }

    public function test_course_detail_and_lesson_detail_share_authoritative_attempt_quota(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['max_attempts' => 2]);
        $this->enrollStudent($student, $data['course']);

        // Attempt 1 submitted with no course_id (e.g. taken directly)
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => null,
            'score' => 10,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
            'graded_at' => Carbon::now()->subMinutes(5),
        ]);

        // 1. Course Detail check
        $courseRes = $this->actingAs($student)->getJson("/api/courses/{$data['course']->id}");
        $courseRes->assertStatus(200);
        $examPayload = $courseRes->json('units.0.lessons.0.exams.0');
        $this->assertEquals(1, $examPayload['attempts_count']);
        $this->assertEquals(2, $examPayload['max_attempts']);
        $this->assertEquals(1, $examPayload['progress']['attempts_used']);
        $this->assertEquals(1, $examPayload['progress']['attempts_remaining']);
        $this->assertEquals('graded', $examPayload['progress']['status']);

        // 2. Lesson Detail check
        $lessonRes = $this->actingAs($student)->getJson("/api/student/courses/{$data['course']->id}/lessons/{$data['lesson']->id}");
        $lessonRes->assertStatus(200);
        $lessonExamPayload = $lessonRes->json('exams.0');
        $this->assertEquals(1, $lessonExamPayload['attempts_count']);
        $this->assertEquals(2, $lessonExamPayload['max_attempts']);
        $this->assertEquals(1, $lessonExamPayload['progress']['attempts_used']);
        $this->assertEquals(1, $lessonExamPayload['progress']['attempts_remaining']);

        // 3. Check availability endpoint allows start
        $availRes = $this->actingAs($student)->getJson("/api/exams/{$data['exam']->id}/check-availability");
        $availRes->assertStatus(200);
        $this->assertTrue($availRes->json('available'));
    }

    public function test_expired_exam_with_remaining_attempts_reports_expired_status_and_blocks_start(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        // Exam with end date 2 days in the past, max attempts = 2
        $data = $this->setupExam($teacher, [
            'max_attempts' => 2,
            'start_date' => Carbon::now()->subDays(10)->toDateString(),
            'end_date' => Carbon::now()->subDays(2)->toDateString(),
            'start_time' => '00:00:00',
            'end_time' => '23:59:59',
            'enable_schedule' => true,
        ]);
        $this->enrollStudent($student, $data['course']);

        // Student consumed 1 of 2 attempts (graded)
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 10,
            'status' => 'graded',
            'started_at' => Carbon::now()->subDays(3),
            'submitted_at' => Carbon::now()->subDays(3)->addMinutes(15),
            'graded_at' => Carbon::now()->subDays(3)->addMinutes(15),
        ]);

        // 1. Course Detail check
        $courseRes = $this->actingAs($student)->getJson("/api/courses/{$data['course']->id}");
        $courseRes->assertStatus(200);
        $examPayload = $courseRes->json('units.0.lessons.0.exams.0');
        $this->assertEquals(1, $examPayload['attempts_count']);
        $this->assertEquals(2, $examPayload['max_attempts']);
        $this->assertEquals(1, $examPayload['progress']['attempts_used']);
        $this->assertEquals(1, $examPayload['progress']['attempts_remaining']);
        // Crucial: status must be 'expired', NOT 'all attempts completed' or 'graded'
        $this->assertEquals('expired', $examPayload['progress']['status']);
        $this->assertTrue($examPayload['is_expired']);

        // 2. Lesson Detail check
        $lessonRes = $this->actingAs($student)->getJson("/api/student/courses/{$data['course']->id}/lessons/{$data['lesson']->id}");
        $lessonRes->assertStatus(200);
        $lessonExamPayload = $lessonRes->json('exams.0');
        $this->assertEquals(1, $lessonExamPayload['attempts_count']);
        $this->assertEquals(2, $lessonExamPayload['max_attempts']);
        $this->assertEquals(1, $lessonExamPayload['progress']['attempts_used']);
        $this->assertEquals(1, $lessonExamPayload['progress']['attempts_remaining']);
        $this->assertEquals('expired', $lessonExamPayload['progress']['status']);

        // 3. Availability endpoint strictly rejects with SCHEDULE_EXPIRED and 403
        $availRes = $this->actingAs($student)->getJson("/api/exams/{$data['exam']->id}/check-availability");
        $availRes->assertStatus(403);
        $this->assertFalse($availRes->json('available'));
        $this->assertEquals('SCHEDULE_EXPIRED', $availRes->json('error_code'));

        // 4. Starting attempt strictly rejected with SCHEDULE_EXPIRED and 403
        $startRes = $this->actingAs($student)->postJson("/api/exams/{$data['exam']->id}/start");
        $startRes->assertStatus(403);
        $this->assertEquals('SCHEDULE_EXPIRED', $startRes->json('error_code'));
    }

    // =========================================================================
    // 2. EXAM RESULT VISIBILITY TESTS (SERVER-SIDE LEAK PREVENTION)
    // =========================================================================

    public function test_hiding_score_removes_numerical_score_from_student_response(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, [
            'show_score' => false,
            'show_student_answers' => true,
            'show_correct_answers' => true,
            'show_explanations' => true,
        ]);
        $this->enrollStudent($student, $data['course']);

        $attempt = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 20,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
            'graded_at' => Carbon::now()->subMinutes(5),
        ]);

        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);

        // Verification: score must be null in response and raw content
        $content = collect($res->json())->firstWhere('id', $attempt->id);
        $this->assertTrue(!isset($content['score']) || $content['score'] === null);
        $this->assertFalse($content['effective_visibility']['show_score']);
        $this->assertStringNotContainsString('"score":20', $res->getContent());
    }

    public function test_hiding_student_answers_redacts_submitted_text(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, [
            'show_score' => true,
            'show_student_answers' => false,
            'show_correct_answers' => true,
            'show_explanations' => true,
        ]);
        $this->enrollStudent($student, $data['course']);

        $attempt = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 20,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        StudentAnswer::create([
            'student_exam_id' => $attempt->id,
            'question_id' => $data['q1']->id,
            'answer_text' => '3x10^8 m/s',
            'is_correct' => true,
            'score' => 10,
        ]);

        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);

        $content = collect($res->json())->firstWhere('id', $attempt->id);
        $this->assertFalse($content['effective_visibility']['show_student_answers']);
        $this->assertTrue(!isset($content['answers'][0]['answer_text']) || $content['answers'][0]['answer_text'] === null);
    }

    public function test_hiding_correct_answers_and_explanations_redacts_them_from_student(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, [
            'show_score' => true,
            'show_student_answers' => true,
            'show_correct_answers' => false,
            'show_explanations' => false,
        ]);
        $this->enrollStudent($student, $data['course']);

        $attempt = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 10,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);

        $content = collect($res->json())->firstWhere('id', $attempt->id);
        $this->assertFalse($content['effective_visibility']['show_correct_answers']);
        $this->assertFalse($content['effective_visibility']['show_explanations']);

        // Confirm questions do not leak correct_answer or explanation
        foreach ($content['exam']['questions'] as $q) {
            $this->assertTrue(!isset($q['correct_answer']) || $q['correct_answer'] === null);
            $this->assertTrue(!isset($q['explanation']) || $q['explanation'] === null);
        }

        $this->assertStringNotContainsString('Speed of light in vacuum is approximately', $res->getContent());
    }

    // =========================================================================
    // 3. STUDENT OVERRIDES & PRECEDENCE (Override > Exam Default)
    // =========================================================================

    public function test_student_override_takes_precedence_over_exam_defaults(): void
    {
        $teacher = $this->createTeacher();
        $studentA = $this->createStudent();
        $studentB = $this->createStudent();
        // Exam default: score is HIDDEN for everyone
        $data = $this->setupExam($teacher, [
            'show_score' => false,
        ]);
        $this->enrollStudent($studentA, $data['course']);
        $this->enrollStudent($studentB, $data['course']);

        $attA = StudentExam::create([
            'student_id' => $studentA->id,
            'exam_id' => $data['exam']->id,
            'score' => 18,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        $attB = StudentExam::create([
            'student_id' => $studentB->id,
            'exam_id' => $data['exam']->id,
            'score' => 15,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        // Teacher grants custom override to Student A: show_score = true
        $overrideRes = $this->actingAs($teacher)->putJson("/api/teacher/exams/{$data['exam']->id}/student-visibility/{$studentA->id}", [
            'show_score' => true,
            'show_student_answers' => true,
            'show_correct_answers' => true,
            'show_explanations' => true,
        ]);
        $overrideRes->assertStatus(200);

        // Student A views results -> sees their score (18)
        $resA = $this->actingAs($studentA)->getJson("/api/student/results");
        $resA->assertStatus(200);
        $itemA = collect($resA->json())->firstWhere('id', $attA->id);
        $this->assertEquals(18, $itemA['score']);
        $this->assertTrue($itemA['effective_visibility']['show_score']);

        // Student B views results -> score is HIDDEN (null) according to Exam default
        $resB = $this->actingAs($studentB)->getJson("/api/student/results");
        $resB->assertStatus(200);
        $itemB = collect($resB->json())->firstWhere('id', $attB->id);
        $this->assertTrue(!isset($itemB['score']) || $itemB['score'] === null);
        $this->assertFalse($itemB['effective_visibility']['show_score']);
    }

    public function test_resetting_override_restores_exam_default(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['show_score' => false]);
        $this->enrollStudent($student, $data['course']);

        $att = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 19,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        // Create override
        ExamStudentResultVisibility::create([
            'exam_id' => $data['exam']->id,
            'student_id' => $student->id,
            'show_score' => true,
            'show_student_answers' => true,
            'show_correct_answers' => true,
            'show_explanations' => true,
            'created_by' => $teacher->id,
        ]);

        // Reset override
        $delRes = $this->actingAs($teacher)->deleteJson("/api/teacher/exams/{$data['exam']->id}/student-visibility/{$student->id}");
        $delRes->assertStatus(200);

        // Student now sees exam default (score hidden)
        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);
        $item = collect($res->json())->firstWhere('id', $att->id);
        $this->assertTrue(!isset($item['score']) || $item['score'] === null);
    }

    public function test_bulk_visibility_override_applies_to_multiple_students(): void
    {
        $teacher = $this->createTeacher();
        $student1 = $this->createStudent();
        $student2 = $this->createStudent();
        $data = $this->setupExam($teacher);

        $bulkRes = $this->actingAs($teacher)->postJson("/api/teacher/exams/{$data['exam']->id}/bulk-student-visibility", [
            'student_ids' => [$student1->id, $student2->id],
            'action' => 'apply',
            'visibility' => [
                'show_score' => false,
                'show_student_answers' => false,
                'show_correct_answers' => false,
                'show_explanations' => false,
            ],
        ]);

        $bulkRes->assertStatus(200);
        $this->assertEquals(2, $bulkRes->json('affected_count'));

        $this->assertDatabaseHas('exam_student_result_visibilities', [
            'exam_id' => $data['exam']->id,
            'student_id' => $student1->id,
            'show_score' => false,
        ]);

        $this->assertDatabaseHas('exam_student_result_visibilities', [
            'exam_id' => $data['exam']->id,
            'student_id' => $student2->id,
            'show_score' => false,
        ]);
    }

    // =========================================================================
    // 4. TEACHER AUTHORIZATION & IDOR PROTECTION
    // =========================================================================

    public function test_unauthorized_teacher_cannot_modify_exam_visibility(): void
    {
        $teacherOwner = $this->createTeacher();
        $intruderTeacher = $this->createTeacher();
        $data = $this->setupExam($teacherOwner);

        $res = $this->actingAs($intruderTeacher)->putJson("/api/teacher/exams/{$data['exam']->id}/visibility", [
            'show_score' => false,
            'show_student_answers' => false,
            'show_correct_answers' => false,
            'show_explanations' => false,
        ]);

        $res->assertStatus(403);
    }

    public function test_admin_can_manage_visibility_for_any_exam(): void
    {
        $teacher = $this->createTeacher();
        $admin = $this->createAdmin();
        $data = $this->setupExam($teacher);

        $res = $this->actingAs($admin)->putJson("/api/admin/exams/{$data['exam']->id}/visibility", [
            'show_score' => false,
            'show_student_answers' => false,
            'show_correct_answers' => false,
            'show_explanations' => false,
        ]);

        $res->assertStatus(200);
        $this->assertDatabaseHas('exams', [
            'id' => $data['exam']->id,
            'show_score' => false,
        ]);
    }

    // =========================================================================
    // 5. ANTI-CHEAT SUSPENSION PRECEDENCE
    // =========================================================================

    public function test_anti_cheat_suspension_overrides_visibility_for_correct_answers(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        // Teacher visibility allows correct answers & explanations
        $data = $this->setupExam($teacher, [
            'show_score' => true,
            'show_student_answers' => true,
            'show_correct_answers' => true,
            'show_explanations' => true,
        ]);
        $this->enrollStudent($student, $data['course']);

        // Student attempt was terminated for cheating
        $att = StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'score' => 0,
            'status' => 'terminated_for_cheating',
            'terminated_for_cheating_at' => Carbon::now()->subMinutes(5),
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        $res = $this->actingAs($student)->getJson("/api/student/results");
        $res->assertStatus(200);

        $content = collect($res->json())->firstWhere('id', $att->id);
        $this->assertFalse($content['can_view_answers']);
        foreach ($content['exam']['questions'] as $q) {
            $this->assertTrue(!isset($q['correct_answer']) || $q['correct_answer'] === null);
        }
    }

    // =========================================================================
    // 6. VISIBILITY PARTICIPANTS & STUDENT COUNT ACCURACY TESTS
    // =========================================================================

    public function test_visibility_endpoint_returns_participating_students_with_attempts(): void
    {
        $teacher = $this->createTeacher();
        $student1 = $this->createStudent();
        $student2 = $this->createStudent();
        $data = $this->setupExam($teacher);
        $this->enrollStudent($student1, $data['course']);
        $this->enrollStudent($student2, $data['course']);

        // Student 1 has a graded attempt
        StudentExam::create([
            'student_id' => $student1->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 15,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(30),
            'submitted_at' => Carbon::now()->subMinutes(10),
            'graded_at' => Carbon::now()->subMinutes(5),
        ]);

        // Student 2 has a started attempt
        StudentExam::create([
            'student_id' => $student2->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => null,
            'status' => 'started',
            'started_at' => Carbon::now()->subMinutes(10),
        ]);

        $res = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $res->assertStatus(200);

        $json = $res->json();
        $this->assertArrayHasKey('students', $json);
        $this->assertArrayHasKey('stats', $json);
        $this->assertCount(2, $json['students']);
        $this->assertEquals(2, $json['stats']['total_students_with_attempts']);
        $this->assertEquals(2, $json['stats']['total_attempts']);

        $returnedStudentIds = collect($json['students'])->pluck('id')->all();
        $this->assertContains($student1->id, $returnedStudentIds);
        $this->assertContains($student2->id, $returnedStudentIds);

        $s1Data = collect($json['students'])->firstWhere('id', $student1->id);
        $this->assertEquals('graded', $s1Data['status']);
        $this->assertEquals(15, $s1Data['score']);

        $s2Data = collect($json['students'])->firstWhere('id', $student2->id);
        $this->assertEquals('started', $s2Data['status']);
    }

    public function test_visibility_endpoint_does_not_include_enrolled_students_without_attempts(): void
    {
        $teacher = $this->createTeacher();
        $studentWithAttempt = $this->createStudent();
        $studentEnrolledOnly1 = $this->createStudent();
        $studentEnrolledOnly2 = $this->createStudent();
        $data = $this->setupExam($teacher);

        // 3 enrolled students
        $this->enrollStudent($studentWithAttempt, $data['course']);
        $this->enrollStudent($studentEnrolledOnly1, $data['course']);
        $this->enrollStudent($studentEnrolledOnly2, $data['course']);

        // Only 1 student made an attempt
        StudentExam::create([
            'student_id' => $studentWithAttempt->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 10,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        $res = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $res->assertStatus(200);

        $json = $res->json();
        // Counter and students list must only have the student who attempted
        $this->assertCount(1, $json['students']);
        $this->assertEquals(1, $json['stats']['total_students_with_attempts']);
        $this->assertEquals($studentWithAttempt->id, $json['students'][0]['id']);
    }

    public function test_visibility_endpoint_returns_empty_when_exam_has_no_attempts_or_students(): void
    {
        $teacher = $this->createTeacher();
        $data = $this->setupExam($teacher);

        $res = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $res->assertStatus(200);

        $json = $res->json();
        $this->assertCount(0, $json['students']);
        $this->assertEquals(0, $json['stats']['total_students_with_attempts']);
        $this->assertEquals(0, $json['stats']['total_attempts']);
    }

    public function test_visibility_endpoint_loads_previously_saved_overrides(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['show_score' => true]);
        $this->enrollStudent($student, $data['course']);

        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 20,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        // Pre-saved override hiding score
        ExamStudentResultVisibility::create([
            'exam_id' => $data['exam']->id,
            'student_id' => $student->id,
            'show_score' => false,
            'show_student_answers' => true,
            'show_correct_answers' => false,
            'show_explanations' => false,
            'created_by' => $teacher->id,
        ]);

        $res = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $res->assertStatus(200);

        $json = $res->json();
        $this->assertCount(1, $json['students']);
        $st = $json['students'][0];
        $this->assertTrue($st['has_override']);
        $this->assertFalse($st['effective_visibility']['show_score']);
        $this->assertFalse($st['effective_visibility']['show_correct_answers']);
        $this->assertTrue($st['effective_visibility']['show_student_answers']);
    }

    public function test_saving_and_resetting_override_updates_and_reloads_properly(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['show_score' => true]);
        $this->enrollStudent($student, $data['course']);

        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 18,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(20),
            'submitted_at' => Carbon::now()->subMinutes(5),
        ]);

        // 1. Save student override
        $saveRes = $this->actingAs($teacher)->putJson("/api/teacher/exams/{$data['exam']->id}/student-visibility/{$student->id}", [
            'show_score' => false,
            'show_student_answers' => false,
            'show_correct_answers' => false,
            'show_explanations' => false,
        ]);
        $saveRes->assertStatus(200);

        // Verify visibility reloaded
        $reload1 = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $reload1->assertStatus(200);
        $st1 = $reload1->json('students.0');
        $this->assertNotNull($st1);
        $this->assertTrue($st1['has_override']);
        $this->assertFalse($st1['effective_visibility']['show_score']);

        // 2. Reset student override back to defaults
        $resetRes = $this->actingAs($teacher)->deleteJson("/api/teacher/exams/{$data['exam']->id}/student-visibility/{$student->id}");
        $resetRes->assertStatus(200);

        // Verify visibility reloaded after reset: student is still listed with defaults restored!
        $reload2 = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $reload2->assertStatus(200);
        $st2 = $reload2->json('students.0');
        $this->assertNotNull($st2);
        $this->assertFalse($st2['has_override']);
        $this->assertTrue($st2['effective_visibility']['show_score']); // Restored to exam default
    }

    public function test_multiple_attempts_by_same_student_groups_into_single_entry_with_latest_status_and_score(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher, ['max_attempts' => 2]);
        $this->enrollStudent($student, $data['course']);

        // Attempt 1 (older, score 5)
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 5,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(60),
            'submitted_at' => Carbon::now()->subMinutes(40),
            'graded_at' => Carbon::now()->subMinutes(35),
        ]);

        // Attempt 2 (newer, score 18)
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $data['exam']->id,
            'course_id' => $data['course']->id,
            'score' => 18,
            'status' => 'graded',
            'started_at' => Carbon::now()->subMinutes(30),
            'submitted_at' => Carbon::now()->subMinutes(10),
            'graded_at' => Carbon::now()->subMinutes(5),
        ]);

        $res = $this->actingAs($teacher)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $res->assertStatus(200);

        $json = $res->json();
        $this->assertCount(1, $json['students'], 'Should deduplicate by student_id to exactly 1 entry');
        $this->assertEquals(1, $json['stats']['total_students_with_attempts']);
        $this->assertEquals(2, $json['stats']['total_attempts'], 'Should count both attempts in total_attempts');

        $st = $json['students'][0];
        $this->assertEquals($student->id, $st['id']);
        $this->assertEquals(2, $st['attempts_count']);
        $this->assertEquals(18, $st['score'], 'Must reflect latest attempt score');
        $this->assertEquals('graded', $st['status'], 'Must reflect latest attempt status');
    }

    public function test_student_cannot_access_visibility_endpoint(): void
    {
        $teacher = $this->createTeacher();
        $student = $this->createStudent();
        $data = $this->setupExam($teacher);

        $resTeacherRoute = $this->actingAs($student)->getJson("/api/teacher/exams/{$data['exam']->id}/visibility");
        $resTeacherRoute->assertStatus(403);

        $resAdminRoute = $this->actingAs($student)->getJson("/api/admin/exams/{$data['exam']->id}/visibility");
        $resAdminRoute->assertStatus(403);
    }
}
