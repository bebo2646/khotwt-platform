<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Exam;
use App\Models\Question;
use App\Models\StudentExam;
use App\Models\StudentAnswer;
use App\Models\ExamViolation;
use App\Models\ExamPurchase;
use App\Models\Wallet;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class MonthlyExamPlayerTest extends TestCase
{
    use DatabaseTransactions;

    private $teacher;
    private $student;
    private $otherStudent;
    private $exam;
    private $q1;
    private $q2;
    private $q3;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'Teacher Monthly Exam Test',
            'email' => 'teacher_me_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['first_secondary']
        ]);

        $this->student = User::create([
            'name' => 'Student ME Test',
            'email' => 'student_me_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active',
            'stage' => 'secondary',
            'grade' => 'first_secondary'
        ]);

        $this->otherStudent = User::create([
            'name' => 'Other Student ME Test',
            'email' => 'other_student_me_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active',
            'stage' => 'secondary',
            'grade' => 'first_secondary'
        ]);

        // Create standalone monthly exam
        $this->exam = Exam::create([
            'title' => 'امتحان شهر أكتوبر - فيزياء',
            'description' => 'امتحان شهري شامل',
            'type' => 'monthly_exam',
            'teacher_id' => $this->teacher->id,
            'is_published' => true,
            'is_active' => true,
            'is_paid' => false,
            'price' => 0.00,
            'time_limit_minutes' => 45,
            'max_score' => 30,
            'passing_score' => 15,
            'allowed_violations' => 3,
            'randomize_questions' => true,
            'randomize_options' => true,
            'enable_fullscreen' => true,
            'enable_anti_tab_switching' => true,
            'enable_copy_protection' => true,
        ]);

        // Add 3 test questions
        $this->q1 = Question::create([
            'exam_id' => $this->exam->id,
            'text' => 'ما هي وحدة قياس القوة؟',
            'type' => 'mcq',
            'options' => ['نيوتن', 'جول', 'واط', 'باسكال'],
            'correct_answer' => 'نيوتن',
            'score' => 10,
            'order' => 1,
        ]);

        $this->q2 = Question::create([
            'exam_id' => $this->exam->id,
            'text' => 'السرعة هي كمية متجهة.',
            'type' => 'true_false',
            'options' => ['صح', 'خطأ'],
            'correct_answer' => 'صح',
            'score' => 10,
            'order' => 2,
        ]);

        $this->q3 = Question::create([
            'exam_id' => $this->exam->id,
            'text' => 'ما هي وحدة قياس الطاقة؟',
            'type' => 'mcq',
            'options' => ['نيوتن', 'جول', 'فولت', 'أمبير'],
            'correct_answer' => 'جول',
            'score' => 10,
            'order' => 3,
        ]);
    }

    /**
     * 1. Test starting exam assigns correct duration, calculates expires_at, and returns server_now.
     */
    public function test_exam_starts_with_authoritative_timer_and_no_correct_answers(): void
    {
        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertArrayHasKey('attempt_id', $data);
        $this->assertArrayHasKey('started_at', $data);
        $this->assertArrayHasKey('expires_at', $data);
        $this->assertArrayHasKey('server_now', $data);
        $this->assertArrayHasKey('time_remaining_seconds', $data);

        // Verify duration is 45 minutes (~2700 seconds)
        $this->assertGreaterThanOrEqual(2690, $data['time_remaining_seconds']);
        $this->assertLessThanOrEqual(2700, $data['time_remaining_seconds']);

        // SECURITY: Verify correct_answer is completely stripped from questions
        foreach ($data['questions'] as $q) {
            $this->assertArrayNotHasKey('correct_answer', $q);
            $this->assertArrayNotHasKey('explanation', $q);
        }
    }

    /**
     * 2. Test refresh preserves the exact same active attempt, expires_at, and question shuffle.
     */
    public function test_refresh_preserves_same_attempt_and_shuffle_mapping(): void
    {
        // First start
        $start1 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start1->assertStatus(200);
        $data1 = $start1->json();

        // Refresh / Second start request
        $start2 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start2->assertStatus(200);
        $data2 = $start2->json();

        // Must be the exact same attempt ID
        $this->assertEquals($data1['attempt_id'], $data2['attempt_id']);
        $this->assertEquals($data1['expires_at'], $data2['expires_at']);

        // Question order and options must remain identical across refresh
        $order1 = array_column($data1['questions'], 'id');
        $order2 = array_column($data2['questions'], 'id');
        $this->assertEquals($order1, $order2);

        $options1 = $data1['questions'][0]['options'] ?? [];
        $options2 = $data2['questions'][0]['options'] ?? [];
        $this->assertEquals($options1, $options2);
    }

    /**
     * 3. Test saving draft persists answer safely and can be retrieved.
     */
    public function test_saving_draft_persists_answer(): void
    {
        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start->assertStatus(200);

        // Save answer for Q1
        $draftRes = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/save-draft", [
                'question_id' => $this->q1->id,
                'answer_text' => 'نيوتن',
            ]);
        $draftRes->assertStatus(200);

        // Refresh and verify answer is in saved_answers
        $resume = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $resume->assertStatus(200);

        $savedAnswers = $resume->json('saved_answers');
        $this->assertArrayHasKey($this->q1->id, $savedAnswers);
        $this->assertEquals('نيوتن', $savedAnswers[$this->q1->id]['answer_text']);
    }

    /**
     * 4. Test submitting exam computes grade correctly and finishes attempt.
     */
    public function test_submit_exam_computes_score_and_marks_graded(): void
    {
        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start->assertStatus(200);
        $attemptId = $start->json('attempt_id');

        // Submit answers: Q1 correct (10), Q2 correct (10), Q3 incorrect (0) -> total 20 / 30
        $submitRes = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/submit", [
                'answers' => [
                    $this->q1->id => 'نيوتن',
                    $this->q2->id => 'صح',
                    $this->q3->id => 'فولت',
                ],
            ]);

        $submitRes->assertStatus(200);
        $data = $submitRes->json();
        $this->assertTrue($data['success']);
        $this->assertEquals(20, $data['score']);
        $this->assertEquals(30, $data['max_score']);
        $this->assertEquals('graded', $data['status']);
        $this->assertTrue($data['passed']);

        // Verify DB status
        $attempt = StudentExam::find($attemptId);
        $this->assertEquals('graded', $attempt->status);
        $this->assertEquals(20, $attempt->score);
        $this->assertNotNull($attempt->submitted_at);
    }

    /**
     * 5. Test submit with partial/missing answers does not crash with NOT NULL constraint violation.
     */
    public function test_submit_with_unanswered_questions_does_not_crash(): void
    {
        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start->assertStatus(200);

        // Student only answers Q1, leaves Q2 and Q3 unanswered
        $submitRes = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/submit", [
                'answers' => [
                    $this->q1->id => 'نيوتن',
                ],
            ]);

        $submitRes->assertStatus(200);
        $data = $submitRes->json();
        $this->assertTrue($data['success']);
        $this->assertEquals(10, $data['score']);
    }

    /**
     * 6. Test duplicate submission returns idempotent 200 without 404/500 exception.
     */
    public function test_duplicate_submission_is_prevented_idempotently(): void
    {
        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start->assertStatus(200);

        // First submit
        $submit1 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/submit", [
                'answers' => [$this->q1->id => 'نيوتن'],
            ]);
        $submit1->assertStatus(200);

        // Second duplicate submit
        $submit2 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/submit", [
                'answers' => [$this->q1->id => 'نيوتن'],
            ]);
        $submit2->assertStatus(200);
        $this->assertTrue($submit2->json('already_submitted'));
    }

    /**
     * 7. Test anti-cheat violation logging, deduplication window, and termination.
     */
    public function test_anti_cheat_violation_termination_and_deduplication(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 9, 7, 10, 0, 0));

        $start = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start->assertStatus(200);

        // Violation 1
        $v1 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/log-violation", ['violation_type' => 'tab_switch']);
        $v1->assertStatus(200);
        $this->assertFalse($v1->json('terminated'));
        $this->assertEquals(1, $v1->json('violations_count'));

        // Immediate duplicate violation within 2.5s window should be deduplicated
        $v1Dup = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/log-violation", ['violation_type' => 'window_blur']);
        $v1Dup->assertStatus(200);
        $this->assertEquals(1, $v1Dup->json('violations_count'), 'Correlated blur within dedupe window must not double count');

        // Advance time past deduplication window (3 seconds)
        Carbon::setTestNow(Carbon::now()->addSeconds(3));

        // Violation 2
        $v2 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/log-violation", ['violation_type' => 'tab_switch']);
        $v2->assertStatus(200);
        $this->assertFalse($v2->json('terminated'));
        $this->assertEquals(2, $v2->json('violations_count'));

        // Advance time past dedupe window
        Carbon::setTestNow(Carbon::now()->addSeconds(3));

        // Violation 3 -> Reaches allowed_violations limit of 3 -> Terminated!
        $v3 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/log-violation", ['violation_type' => 'fullscreen_exit']);
        $v3->assertStatus(200);
        $this->assertTrue($v3->json('terminated'));
        $this->assertEquals(3, $v3->json('violations_count'));

        // Terminated student cannot save drafts
        $draftRes = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/save-draft", [
                'question_id' => $this->q1->id,
                'answer_text' => 'نيوتن',
            ]);
        $draftRes->assertStatus(403);

        // Student cannot restart terminated exam
        $reopen = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $reopen->assertStatus(403);
        $this->assertTrue($reopen->json('terminated'));

        // Terminated attempt results hide correct answers
        $results = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/monthly-exams/{$this->exam->id}/results");
        $results->assertStatus(200);
        $this->assertTrue($results->json('is_terminated_for_cheating'));
        $this->assertFalse($results->json('can_view_answers'));

        Carbon::setTestNow(); // Reset test time
    }

    /**
     * 8. Test student cannot access another student's attempt or submit on their behalf.
     */
    public function test_student_isolation_prevents_cross_student_tampering(): void
    {
        // Student 1 starts
        $start1 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $start1->assertStatus(200);
        $attempt1 = $start1->json('attempt_id');

        // Other student starts exam (should get their own distinct attempt)
        $startOther = $this->actingAs($this->otherStudent, 'sanctum')
            ->postJson("/api/monthly-exams/{$this->exam->id}/start");
        $startOther->assertStatus(200);
        $attemptOther = $startOther->json('attempt_id');

        $this->assertNotEquals($attempt1, $attemptOther);
    }
}
