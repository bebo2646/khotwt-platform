<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Exam;
use App\Models\Question;
use App\Models\ExamPurchase;
use App\Models\Enrollment;
use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class AssessmentArchitectureSeparationTest extends TestCase
{
    use DatabaseTransactions;

    private $teacher;
    private $student;
    private $course;
    private $unit;
    private $lesson;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'Teacher Assessment Test',
            'email' => 'teacher_assessment_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary']
        ]);

        $plan = SubscriptionPlan::firstOrCreate(['name' => 'Starter'], [
            'price' => 0,
            'max_students' => 1000,
            'max_storage_bytes' => 1000000000,
            'max_courses' => 100,
            'max_codes' => 1000,
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

        $this->student = User::create([
            'name' => 'Student Assessment Test',
            'email' => 'student_assessment_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active',
            'stage' => 'secondary',
            'grade' => 'first_secondary'
        ]);

        $this->course = Course::create([
            'title' => 'Test Course For Assessments',
            'teacher_id' => $this->teacher->id,
            'subject' => 'chemistry',
            'grade' => 'first_secondary',
            'price' => 150.00,
            'is_published' => true
        ]);

        $this->unit = Unit::create([
            'title' => 'Test Unit 1',
            'course_id' => $this->course->id,
            'order' => 1
        ]);

        $this->lesson = Lesson::create([
            'title' => 'Test Lesson 1',
            'unit_id' => $this->unit->id,
            'order' => 1,
            'is_free' => false
        ]);
    }

    /**
     * Test creating a standalone monthly exam with questions.
     * Must have course_id = null and lesson_id = null.
     */
    public function test_create_standalone_monthly_exam_with_questions()
    {
        $response = $this->actingAs($this->teacher)->postJson('/api/teacher/monthly-exams', [
            'title' => 'امتحان شهر أكتوبر التجريبي',
            'month' => 'أكتوبر',
            'stage' => 'المرحلة الثانوية',
            'grade' => 'الصف الأول الثانوي',
            'subject' => 'الكيمياء',
            'price' => 45.00,
            'is_paid' => true,
            'time_limit_minutes' => 60,
            'max_score' => 10,
            'is_active' => true,
            'description' => 'امتحان شامل على الباب الأول',
            'questions' => [
                [
                    'text' => 'ما هو الرمز الكيميائي للماء؟',
                    'type' => 'mcq',
                    'options' => ['H2O', 'CO2', 'NaCl', 'O2'],
                    'correct_answer' => 'H2O',
                    'score' => 5
                ],
                [
                    'text' => 'الغاز الضروري لتنفس الكائنات الحية هو الأكسجين.',
                    'type' => 'true_false',
                    'options' => ['صواب', 'خطأ'],
                    'correct_answer' => 'صواب',
                    'score' => 5
                ]
            ]
        ]);

        $response->assertStatus(201);
        $data = $response->json('exam');

        $this->assertNotNull($data['id']);
        $this->assertEquals('امتحان شهر أكتوبر التجريبي', $data['title']);
        $this->assertEquals(45.00, (float)$data['price']);
        $this->assertNull($data['course_id']);
        $this->assertNull($data['lesson_id']);
        $this->assertCount(2, $data['questions']);

        // Assert database values directly
        $examInDb = Exam::find($data['id']);
        $this->assertNotNull($examInDb);
        $this->assertNull($examInDb->course_id, 'Standalone monthly exam must have NULL course_id');
        $this->assertNull($examInDb->lesson_id, 'Standalone monthly exam must have NULL lesson_id');
        $this->assertEquals($this->teacher->id, $examInDb->teacher_id);
        $this->assertEquals(2, $examInDb->questions()->count());
    }

    /**
     * Test updating a standalone monthly exam and syncing questions.
     */
    public function test_update_standalone_monthly_exam_syncs_questions()
    {
        $exam = Exam::create([
            'title' => 'امتحان قديم',
            'month' => 'نوفمبر',
            'stage' => 'المرحلة الثانوية',
            'grade' => 'الصف الأول الثانوي',
            'subject' => 'الكيمياء',
            'price' => 30.00,
            'type' => 'monthly_exam',
            'course_id' => null,
            'lesson_id' => null,
            'teacher_id' => $this->teacher->id,
            'is_active' => true,
            'time_limit_minutes' => 45,
            'max_score' => 10,
        ]);

        $response = $this->actingAs($this->teacher)->putJson("/api/teacher/monthly-exams/{$exam->id}", [
            'title' => 'امتحان نوفمبر المحدث',
            'month' => 'نوفمبر',
            'stage' => 'المرحلة الثانوية',
            'grade' => 'الصف الأول الثانوي',
            'subject' => 'الكيمياء',
            'price' => 55.00,
            'is_paid' => true,
            'time_limit_minutes' => 50,
            'max_score' => 10,
            'is_active' => true,
            'questions' => [
                [
                    'text' => 'سؤال محدث 1',
                    'type' => 'mcq',
                    'options' => ['أ', 'ب', 'ج', 'د'],
                    'correct_answer' => 'أ',
                    'score' => 10
                ]
            ]
        ]);

        $response->assertStatus(200);
        $exam->refresh();
        $this->assertEquals('امتحان نوفمبر المحدث', $exam->title);
        $this->assertEquals(55.00, (float)$exam->price);
        $this->assertNull($exam->course_id);
        $this->assertNull($exam->lesson_id);
        $this->assertEquals(1, $exam->questions()->count());
    }

    /**
     * Test that attempting to attach a monthly_exam to a lesson endpoint is rejected with 422.
     */
    public function test_cannot_attach_monthly_exam_to_course_lesson()
    {
        $response = $this->actingAs($this->teacher)->postJson("/api/teacher/lessons/{$this->lesson->id}/exam", [
            'title' => 'امتحان شهري ملحق بدرس خطأ',
            'type' => 'monthly_exam',
            'time_limit_minutes' => 60,
            'max_score' => 10,
            'questions' => []
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('الامتحانات الشهرية مستقلة', $response->json('message'));
    }

    /**
     * Test that course quiz creation links properly to course and lesson.
     */
    public function test_create_course_quiz_attaches_to_course_and_lesson()
    {
        $response = $this->actingAs($this->teacher)->postJson("/api/teacher/lessons/{$this->lesson->id}/exam", [
            'title' => 'كويز المحاضرة الأولى',
            'type' => 'quiz',
            'time_limit_minutes' => 15,
            'max_score' => 2,
            'is_paid' => false,
            'price' => 0,
            'questions' => [
                [
                    'text' => 'سؤال سريع في الكويز؟',
                    'type' => 'mcq',
                    'options' => ['1', '2'],
                    'correct_answer' => '1',
                    'score' => 2
                ]
            ]
        ]);

        $response->assertStatus(201);
        $examId = $response->json('id');
        $quiz = Exam::find($examId);

        $this->assertNotNull($quiz);
        $this->assertEquals($this->lesson->id, $quiz->lesson_id);
        $this->assertEquals($this->course->id, $quiz->course_id);
        $this->assertEquals('quiz', $quiz->type);
    }

    /**
     * Test fetching a standalone monthly exam via teacher getExam and adminShow.
     * Ensures getExam handles null lesson gracefully without throwing property of non-object error.
     */
    public function test_fetch_standalone_monthly_exam_gracefully()
    {
        $exam = Exam::create([
            'title' => 'امتحان ديسمبر المستقل',
            'month' => 'ديسمبر',
            'stage' => 'المرحلة الثانوية',
            'grade' => 'الصف الأول الثانوي',
            'subject' => 'الكيمياء',
            'price' => 40.00,
            'type' => 'monthly_exam',
            'course_id' => null,
            'lesson_id' => null,
            'teacher_id' => $this->teacher->id,
            'is_active' => true,
            'time_limit_minutes' => 60,
            'max_score' => 10,
        ]);

        // Test MonthlyExamsController@adminShow
        $response1 = $this->actingAs($this->teacher)->getJson("/api/teacher/monthly-exams/{$exam->id}");
        $response1->assertStatus(200);
        $this->assertEquals($exam->id, $response1->json('id'));

        // Test TeacherController@getExam
        $response2 = $this->actingAs($this->teacher)->getJson("/api/teacher/exams/{$exam->id}");
        $response2->assertStatus(200);
        $this->assertEquals($exam->id, $response2->json('id'));
    }

    /**
     * Test pricing and access separation between courses and standalone monthly exams.
     */
    public function test_course_enrollment_does_not_unlock_standalone_monthly_exam()
    {
        $monthlyExam = Exam::create([
            'title' => 'امتحان يناير الشامل',
            'month' => 'يناير',
            'stage' => 'المرحلة الثانوية',
            'grade' => 'الصف الأول الثانوي',
            'subject' => 'الكيمياء',
            'price' => 50.00,
            'is_paid' => true,
            'type' => 'monthly_exam',
            'course_id' => null,
            'lesson_id' => null,
            'teacher_id' => $this->teacher->id,
            'is_active' => true,
            'time_limit_minutes' => 60,
            'max_score' => 10,
        ]);

        // Student enrolls in the course
        Enrollment::create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
            'enrolled_at' => now(),
            'status' => 'active'
        ]);

        // Student accesses monthly exams list
        $response = $this->actingAs($this->student, 'sanctum')->getJson('/api/monthly-exams');
        $response->assertStatus(200);

        $examData = collect($response->json())->firstWhere('id', $monthlyExam->id);
        $this->assertNotNull($examData);
        // Student should NOT have unlocked the monthly exam merely by enrolling in the course
        $this->assertFalse($examData['is_purchased'], 'Enrolling in a course must NOT unlock standalone monthly exams');

        // Now student explicitly purchases the monthly exam
        ExamPurchase::create([
            'student_id' => $this->student->id,
            'exam_id' => $monthlyExam->id,
            'purchased_at' => now()
        ]);

        $responseAfterPurchase = $this->actingAs($this->student, 'sanctum')->getJson('/api/monthly-exams');
        $examDataAfter = collect($responseAfterPurchase->json())->firstWhere('id', $monthlyExam->id);
        $this->assertTrue($examDataAfter['is_purchased'], 'Student has unlocked standalone monthly exam after explicit purchase');
    }
}
