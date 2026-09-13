<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Question;
use App\Models\StudentExam;
use App\Models\StudentAnswer;
use App\Models\ExamViolation;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class MonthlyExamReviewAndUnlockTest extends TestCase
{
    use DatabaseTransactions;

    private $teacher;
    private $otherTeacher;
    private $admin;
    private $student1;
    private $student2;
    private $monthlyExam;
    private $attempt1;
    private $attempt2;

    protected function setUp(): void
    {
        parent::setUp();

        $plan = SubscriptionPlan::firstOrCreate(['name' => 'Starter'], [
            'price' => 0,
            'max_students' => 1000,
            'max_storage_bytes' => 1000000000,
            'max_courses' => 100,
            'max_codes' => 1000,
        ]);

        $this->teacher = User::create([
            'name' => 'Primary Teacher',
            'email' => 'teacher_prim_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'phone' => '01000000001',
        ]);

        TeacherSubscription::create([
            'teacher_id' => $this->teacher->id,
            'plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(365)->toDateString(),
            'status' => 'Active',
            'used_storage_bytes' => 0,
            'used_codes' => 0,
            'billing_period' => 'monthly',
        ]);

        $this->otherTeacher = User::create([
            'name' => 'Other Teacher',
            'email' => 'teacher_other_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'phone' => '01000000002',
        ]);

        TeacherSubscription::create([
            'teacher_id' => $this->otherTeacher->id,
            'plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(365)->toDateString(),
            'status' => 'Active',
            'used_storage_bytes' => 0,
            'used_codes' => 0,
            'billing_period' => 'monthly',
        ]);

        $this->admin = User::create([
            'name' => 'Super Admin',
            'email' => 'admin_super_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'status' => 'active',
            'is_super_admin' => true,
            'is_super' => true,
        ]);

        $this->student1 = User::create([
            'name' => 'Student Normal',
            'email' => 'student_norm_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active',
            'phone' => '01200000001',
        ]);

        $this->student2 = User::create([
            'name' => 'Student Cheater',
            'email' => 'student_cheat_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active',
            'phone' => '01200000002',
        ]);

        // Standalone monthly exam without course or lesson
        $this->monthlyExam = Exam::create([
            'title' => 'امتحان الفيزياء الشهري المستقل',
            'description' => 'امتحان شامل لشهر أكتوبر',
            'type' => 'monthly_exam',
            'month' => 'شهر أكتوبر',
            'stage' => 'المرحلة الثانوية',
            'grade' => 'third_secondary',
            'subject' => 'الفيزياء',
            'teacher_id' => $this->teacher->id,
            'course_id' => null,
            'lesson_id' => null,
            'time_limit_minutes' => 60,
            'max_score' => 30,
            'passing_score' => 15,
            'price' => 0,
            'is_paid' => false,
            'is_published' => true,
            'is_active' => true,
            'allowed_violations' => 3,
        ]);

        $q1 = Question::create([
            'exam_id' => $this->monthlyExam->id,
            'text' => 'ما هي وحدة قياس القوة؟',
            'type' => 'mcq',
            'options' => ['نيوتن', 'جول', 'واط', 'أمبير'],
            'correct_answer' => 'نيوتن',
            'score' => 10,
        ]);

        $q2 = Question::create([
            'exam_id' => $this->monthlyExam->id,
            'text' => 'ما هي وحدة قياس الطاقة؟',
            'type' => 'mcq',
            'options' => ['فولت', 'جول', 'نيوتن', 'باسكال'],
            'correct_answer' => 'جول',
            'score' => 10,
        ]);

        $q3 = Question::create([
            'exam_id' => $this->monthlyExam->id,
            'text' => 'السرعة هي كمية قياسية متجهة.',
            'type' => 'true_false',
            'options' => ['صواب', 'خطأ'],
            'correct_answer' => 'صواب',
            'score' => 10,
        ]);

        // Student 1: Normal submitted attempt
        // Answered Q1 correctly, Q2 incorrectly, Q3 UNANSWERED
        $this->attempt1 = StudentExam::create([
            'student_id' => $this->student1->id,
            'exam_id' => $this->monthlyExam->id,
            'course_id' => null,
            'lesson_id' => null,
            'status' => 'graded',
            'score' => 10,
            'started_at' => now()->subMinutes(40),
            'submitted_at' => now()->subMinutes(10),
            'duration_minutes' => 60,
            'cheat_violations_count' => 0,
            'violation_count' => 0,
        ]);

        StudentAnswer::create([
            'student_exam_id' => $this->attempt1->id,
            'question_id' => $q1->id,
            'answer_text' => 'نيوتن',
            'is_correct' => true,
            'score' => 10,
        ]);

        StudentAnswer::create([
            'student_exam_id' => $this->attempt1->id,
            'question_id' => $q2->id,
            'answer_text' => 'فولت',
            'is_correct' => false,
            'score' => 0,
        ]);
        // Q3 is not in student_answers (unanswered)

        // Student 2: Cheating-terminated attempt
        $this->attempt2 = StudentExam::create([
            'student_id' => $this->student2->id,
            'exam_id' => $this->monthlyExam->id,
            'course_id' => null,
            'lesson_id' => null,
            'status' => 'terminated_for_cheating',
            'score' => 0,
            'started_at' => now()->subMinutes(25),
            'submitted_at' => now()->subMinutes(5),
            'terminated_for_cheating_at' => now()->subMinutes(5),
            'submission_reason' => 'cheat_violations_limit_exceeded',
            'auto_submitted' => true,
            'duration_minutes' => 60,
            'cheat_violations_count' => 3,
            'violation_count' => 3,
        ]);

        ExamViolation::create([
            'student_id' => $this->student2->id,
            'exam_id' => $this->monthlyExam->id,
            'student_exam_id' => $this->attempt2->id,
            'violation_type' => 'tab_switch',
            'time_remaining_seconds' => 1800,
            'metadata' => ['event' => 'window_blur'],
        ]);
    }

    /**
     * Test teacher lists attempts for their standalone monthly exam.
     */
    public function test_teacher_can_list_monthly_exam_attempts()
    {
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/monthly-exams/{$this->monthlyExam->id}/attempts");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'exam' => ['id', 'title', 'max_score'],
                'attempts' => [
                    '*' => [
                        'id',
                        'student_id',
                        'score',
                        'status',
                        'is_terminated_for_cheating',
                        'can_view_answers',
                        'student' => ['id', 'name', 'email', 'phone']
                    ]
                ]
            ]);

        $attempts = $response->json('attempts');
        $this->assertCount(2, $attempts);

        // Verify normal attempt details in list
        $norm = collect($attempts)->firstWhere('id', $this->attempt1->id);
        $this->assertNotNull($norm);
        $this->assertEquals(10, $norm['score']);
        $this->assertEquals('graded', $norm['status']);
        $this->assertFalse($norm['is_terminated_for_cheating']);

        // Verify cheating attempt in list
        $cheat = collect($attempts)->firstWhere('id', $this->attempt2->id);
        $this->assertNotNull($cheat);
        $this->assertEquals(0, $cheat['score']);
        $this->assertEquals('terminated_for_cheating', $cheat['status']);
        $this->assertTrue($cheat['is_terminated_for_cheating']);
        $this->assertFalse($cheat['can_view_answers']);
    }

    /**
     * Test other teacher cannot list attempts for another teacher's monthly exam.
     */
    public function test_other_teacher_cannot_list_monthly_exam_attempts()
    {
        $response = $this->actingAs($this->otherTeacher, 'sanctum')
            ->getJson("/api/teacher/monthly-exams/{$this->monthlyExam->id}/attempts");

        $response->assertStatus(404); // Scoped query with where('teacher_id', $user->id) throws 404
    }

    /**
     * Test student cannot access teacher attempts listing.
     */
    public function test_student_cannot_access_teacher_attempts_listing()
    {
        $response = $this->actingAs($this->student1, 'sanctum')
            ->getJson("/api/teacher/monthly-exams/{$this->monthlyExam->id}/attempts");

        $response->assertStatus(403);
    }

    /**
     * Test teacher can view detailed attempt review including unanswered questions.
     */
    public function test_teacher_can_view_attempt_details_with_unanswered_questions()
    {
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/monthly-exams/{$this->monthlyExam->id}/attempts/{$this->attempt1->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'exam' => ['id', 'title', 'max_score'],
                'student' => ['id', 'name', 'email', 'phone'],
                'attempt' => ['id', 'status', 'score', 'max_score', 'percentage'],
                'questions' => [
                    '*' => [
                        'id',
                        'text',
                        'type',
                        'options',
                        'correct_answer',
                        'score',
                        'is_answered',
                        'student_answer',
                        'is_correct',
                        'score_awarded'
                    ]
                ]
            ]);

        $questions = $response->json('questions');
        $this->assertCount(3, $questions);

        // Q1 was answered correctly
        $q1 = collect($questions)->firstWhere('text', 'ما هي وحدة قياس القوة؟');
        $this->assertTrue($q1['is_answered']);
        $this->assertEquals('نيوتن', $q1['student_answer']);
        $this->assertTrue($q1['is_correct']);
        $this->assertEquals(10, $q1['score_awarded']);

        // Q2 was answered incorrectly
        $q2 = collect($questions)->firstWhere('text', 'ما هي وحدة قياس الطاقة؟');
        $this->assertTrue($q2['is_answered']);
        $this->assertEquals('فولت', $q2['student_answer']);
        $this->assertFalse($q2['is_correct']);
        $this->assertEquals(0, $q2['score_awarded']);

        // Q3 was unanswered
        $q3 = collect($questions)->firstWhere('text', 'السرعة هي كمية قياسية متجهة.');
        $this->assertFalse($q3['is_answered']);
        $this->assertNull($q3['student_answer']);
        $this->assertFalse($q3['is_correct']);
        $this->assertEquals(0, $q3['score_awarded']);
    }

    /**
     * Test cheating-terminated student cannot see answers before unlock.
     */
    public function test_cheating_student_cannot_view_answers_before_unlock()
    {
        $response = $this->actingAs($this->student2, 'sanctum')
            ->getJson("/api/monthly-exams/{$this->monthlyExam->id}/results");

        $response->assertStatus(200);
        $this->assertFalse($response->json('can_view_answers'));
        $this->assertTrue($response->json('is_terminated_for_cheating'));

        // Answers and questions in attempt must NOT contain correct_answer or explanation
        $attempt = $response->json('attempt');
        foreach ($attempt['exam']['questions'] as $q) {
            $this->assertArrayNotHasKey('correct_answer', $q);
            $this->assertArrayNotHasKey('explanation', $q);
        }
    }

    /**
     * Test teacher unlocks answers for a cheating-terminated attempt.
     */
    public function test_teacher_can_unlock_answers_and_student_sees_them()
    {
        // Teacher unlocks
        $unlockRes = $this->actingAs($this->teacher, 'sanctum')
            ->postJson("/api/teacher/monthly-exams/attempts/{$this->attempt2->id}/unlock-answers");

        $unlockRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'تم فتح عرض نموذج الإجابات للطالب بنجاح.',
            ]);

        $this->attempt2->refresh();
        $this->assertNotNull($this->attempt2->answers_unlocked_at);
        $this->assertEquals($this->teacher->id, $this->attempt2->answers_unlocked_by);
        $this->assertTrue($this->attempt2->canViewAnswers());

        // Now student opens results and answers ARE visible
        $studentRes = $this->actingAs($this->student2, 'sanctum')
            ->getJson("/api/monthly-exams/{$this->monthlyExam->id}/results");

        $studentRes->assertStatus(200);
        $this->assertTrue($studentRes->json('can_view_answers'));
        $questions = $studentRes->json('attempt.exam.questions');
        $this->assertNotEmpty($questions);
        $this->assertNotNull($questions[0]['correct_answer']);
    }

    /**
     * Test admin can view attempts and unlock answers.
     */
    public function test_admin_can_view_attempts_and_unlock_answers()
    {
        // Admin views attempts
        $attemptsRes = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/monthly-exams/{$this->monthlyExam->id}/attempts");

        $attemptsRes->assertStatus(200);
        $this->assertCount(2, $attemptsRes->json('attempts'));

        // Admin views attempt details
        $detailsRes = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/admin/monthly-exams/{$this->monthlyExam->id}/attempts/{$this->attempt2->id}");

        $detailsRes->assertStatus(200);
        $this->assertEquals($this->attempt2->id, $detailsRes->json('attempt.id'));

        // Admin unlocks answers using admin endpoint
        $unlockRes = $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/admin/monthly-exams/{$this->monthlyExam->id}/attempts/{$this->attempt2->id}/unlock-answers");

        $unlockRes->assertStatus(200);
        $this->attempt2->refresh();
        $this->assertNotNull($this->attempt2->answers_unlocked_at);
        $this->assertEquals($this->admin->id, $this->attempt2->answers_unlocked_by);
    }

    /**
     * Test standalone monthly exam does not crash TeacherController@examAttempts.
     */
    public function test_standalone_monthly_exam_does_not_crash_teacher_exam_attempts()
    {
        $response = $this->actingAs($this->teacher, 'sanctum')
            ->getJson("/api/teacher/exams/{$this->monthlyExam->id}/attempts");

        $response->assertStatus(200);
        $this->assertCount(2, $response->json());
    }
}
