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
use App\Models\TeacherSubscription;
use App\Models\SubscriptionPlan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class WordImportAndQuestionImageTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private User $student;
    private Course $course;
    private Unit $unit;
    private Lesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();

        $plan = SubscriptionPlan::firstOrCreate(
            ['name' => 'Starter'],
            [
                'price' => 0,
                'billing_period' => 'monthly',
                'duration_days' => 30,
                'max_courses' => 5,
                'max_students' => 50,
                'storage_limit_gb' => 10,
                'features' => json_encode(['basic_analytics']),
                'is_active' => true,
            ]
        );

        $this->teacher = User::factory()->create([
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
        ]);

        TeacherSubscription::create([
            'teacher_id' => $this->teacher->id,
            'plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => 'Active',
            'billing_period' => 'monthly',
        ]);

        $this->student = User::factory()->create([
            'role' => 'student',
            'status' => 'active',
        ]);

        $this->course = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'كورس الكيمياء المتقدمة',
            'description' => 'شرح كامل',
            'price' => 0,
            'grade' => 'third_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
        ]);

        $this->unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'الوحدة الأولى',
        ]);

        $this->lesson = Lesson::create([
            'unit_id' => $this->unit->id,
            'title' => 'الدرس الأول',
        ]);
    }

    public function test_teacher_can_upload_and_delete_exam_image()
    {
        Storage::fake('public');

        $image = UploadedFile::fake()->image('diagram.png', 400, 300);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/upload-image', [
            'image' => $image,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['url', 'path']);

        $path = $response->json('path');
        Storage::disk('public')->assertExists($path);

        // Delete the image
        $delResponse = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/delete-image', [
            'path' => $path,
        ]);

        $delResponse->assertStatus(200);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_create_and_update_exam_with_question_and_choice_images()
    {
        $payload = [
            'title' => 'امتحان كيمياء تجريبي',
            'type' => 'quiz',
            'max_score' => 20,
            'questions' => [
                [
                    'text' => 'ما هو ناتج التفاعل في الصورة؟',
                    'image_url' => 'https://platform.com/storage/exams/q1.png',
                    'type' => 'mcq',
                    'options' => [
                        ['text' => 'المركب أ', 'image_url' => 'https://platform.com/storage/exams/opt_a.png'],
                        ['text' => '', 'image_url' => 'https://platform.com/storage/exams/opt_b.png'], // image-only choice!
                        ['text' => 'المركب ج', 'image_url' => null],
                        ['text' => 'المركب د', 'image_url' => null],
                    ],
                    'correct_answer' => 'https://platform.com/storage/exams/opt_b.png', // image-only correct answer
                    'score' => 10,
                ],
            ],
        ];

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/exam", $payload);
        $response->assertSuccessful();

        $exam = Exam::where('lesson_id', $this->lesson->id)->first();
        $this->assertNotNull($exam);

        $question = $exam->questions()->first();
        $this->assertNotNull($question);
        $this->assertEquals('https://platform.com/storage/exams/q1.png', $question->image_url);
        $this->assertCount(4, $question->options);
        $this->assertEquals('https://platform.com/storage/exams/opt_b.png', $question->options[1]['image_url']);

        // Check isAnswerCorrect on image-only choice
        $this->assertTrue($question->isAnswerCorrect('https://platform.com/storage/exams/opt_b.png'));
        $this->assertTrue($question->isAnswerCorrect('1')); // index-based matching
        $this->assertFalse($question->isAnswerCorrect('المركب أ'));
    }

    public function test_import_word_rejects_legacy_doc_format()
    {
        $file = UploadedFile::fake()->create('questions.doc', 50, 'application/msword');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/import-word', [
            'file' => $file,
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('.docx', $response->json('message'));
    }

    public function test_import_word_parses_docx_with_questions_choices_and_images()
    {
        Storage::fake('public');

        // Create a real temporary .docx in memory
        $tempPath = tempnam(sys_get_temp_dir(), 'docx_test');
        $zip = new ZipArchive();
        $zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        // Fake image
        $fakeImgData = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        $zip->addFromString('word/media/image1.png', $fakeImgData);

        // Document rels
        $relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>';
        $zip->addFromString('word/_rels/document.xml.rels', $relsXml);

        // Document XML with 2 questions: one with Arabic numbering and one with English
        $docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>س1: ما هو الاسم الشائع لمركب كربونات الصوديوم؟ [5 درجات]</w:t></w:r>
      <w:drawing><a:blip r:embed="rId5"/></w:drawing>
    </w:p>
    <w:p><w:r><w:t>أ) صودا الغسيل</w:t></w:r></w:p>
    <w:p><w:r><w:t>ب) ملح الطعام</w:t></w:r></w:p>
    <w:p><w:r><w:t>ج) ماء النار</w:t></w:r></w:p>
    <w:p><w:r><w:t>د) الصودا الكاوية</w:t></w:r></w:p>
    <w:p><w:r><w:t>الإجابة الصحيحة: أ</w:t></w:r></w:p>

    <w:p>
      <w:r><w:t>2. الغاز الذي يشتعل بفرقعة هو غاز الهيدروجين (صح أم خطأ)</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>الإجابة الصحيحة: صح</w:t></w:r></w:p>
  </w:body>
</w:document>';
        $zip->addFromString('word/document.xml', $docXml);
        $zip->close();

        $uploadedDocx = new UploadedFile($tempPath, 'questions.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/import-word', [
            'file' => $uploadedDocx,
        ]);

        $response->assertStatus(200);
        $questions = $response->json();

        $this->assertCount(2, $questions);

        // Check Q1
        $this->assertEquals('ما هو الاسم الشائع لمركب كربونات الصوديوم؟', $questions[0]['text']);
        $this->assertNotEmpty($questions[0]['image_url']);
        $this->assertEquals('mcq', $questions[0]['type']);
        $this->assertCount(4, $questions[0]['options']);
        $this->assertEquals('صودا الغسيل', $questions[0]['correct_answer']);
        $this->assertEquals(5, $questions[0]['score']);

        @unlink($tempPath);
    }

    public function test_student_submits_choice_with_image_and_is_graded_accurately()
    {
        $exam = Exam::create([
            'lesson_id' => $this->lesson->id,
            'course_id' => $this->course->id,
            'teacher_id' => $this->teacher->id,
            'title' => 'امتحان رسومات وأشكال',
            'type' => 'quiz',
            'max_score' => 10,
            'passing_score' => 5,
        ]);

        $q = Question::create([
            'exam_id' => $exam->id,
            'text' => 'أي من الأشكال التالية يمثل البنزين العطري؟',
            'image_url' => 'https://platform.com/storage/exams/benzene_ref.png',
            'type' => 'mcq',
            'options' => [
                ['text' => 'الشكل الأول', 'image_url' => 'https://platform.com/storage/exams/shape1.png'],
                ['text' => '', 'image_url' => 'https://platform.com/storage/exams/benzene.png'], // image-only choice
                ['text' => 'الشكل الثالث', 'image_url' => null],
            ],
            'correct_answer' => 'https://platform.com/storage/exams/benzene.png',
            'score' => 10,
        ]);

        // Student starts exam
        $enrollment = \App\Models\Enrollment::create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
        ]);

        $startRes = $this->actingAs($this->student, 'sanctum')->postJson("/api/exams/{$exam->id}/start");
        $startRes->assertSuccessful();

        $attemptId = $startRes->json('attempt_id') ?: $startRes->json('id');
        $this->assertNotEmpty($attemptId);

        // Verify question in start response contains image_url
        $returnedQuestions = $startRes->json('questions');
        $this->assertEquals('https://platform.com/storage/exams/benzene_ref.png', $returnedQuestions[0]['image_url']);

        // Student submits answer selecting the image-only option
        $submitRes = $this->actingAs($this->student, 'sanctum')->postJson("/api/exams/{$exam->id}/submit", [
            'attempt_id' => $attemptId,
            'answers' => [
                $q->id => 'https://platform.com/storage/exams/benzene.png',
            ],
        ]);

        $submitRes->assertSuccessful();

        // Check attempt score
        $attempt = StudentExam::find($attemptId);
        $this->assertNotNull($attempt);
        $this->assertEquals('graded', $attempt->status);
        $this->assertEquals(10, $attempt->score);

        $studentAnswer = \App\Models\StudentAnswer::where('student_exam_id', $attemptId)->where('question_id', $q->id)->first();
        $this->assertNotNull($studentAnswer);
        $this->assertTrue((bool)$studentAnswer->is_correct);
        $this->assertEquals(10, $studentAnswer->score);
    }

    public function test_legacy_question_grading_supports_text_index_and_letter()
    {
        $exam = Exam::create([
            'lesson_id' => $this->lesson->id,
            'course_id' => $this->course->id,
            'teacher_id' => $this->teacher->id,
            'title' => 'امتحان أسئلة نصية قديمة',
            'type' => 'quiz',
            'max_score' => 10,
        ]);

        // Question 1: Legacy text-only string options
        $q1 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'ما هي عاصمة مصر؟',
            'type' => 'mcq',
            'options' => ['القاهرة', 'الرياض', 'دمشق', 'عمان'],
            'correct_answer' => 'القاهرة',
            'score' => 5,
        ]);

        $this->assertTrue($q1->isAnswerCorrect('القاهرة'));
        $this->assertTrue($q1->isAnswerCorrect('0')); // 0-based index
        $this->assertTrue($q1->isAnswerCorrect('أ')); // Arabic letter
        $this->assertTrue($q1->isAnswerCorrect('a')); // English letter
        $this->assertFalse($q1->isAnswerCorrect('الرياض'));
        $this->assertFalse($q1->isAnswerCorrect('1'));
        $this->assertFalse($q1->isAnswerCorrect('ب'));

        // Question 2: Mixed text and image options
        $q2 = Question::create([
            'exam_id' => $exam->id,
            'text' => 'اختر العنصر الصحيح:',
            'type' => 'mcq',
            'options' => [
                ['text' => 'حديد', 'image_url' => 'https://platform.com/storage/exams/fe.png'],
                ['text' => 'نحاس', 'image_url' => 'https://platform.com/storage/exams/cu.png'],
            ],
            'correct_answer' => 'حديد',
            'score' => 5,
        ]);

        // Student answers with text, image URL, index, or letter
        $this->assertTrue($q2->isAnswerCorrect('حديد'));
        $this->assertTrue($q2->isAnswerCorrect('https://platform.com/storage/exams/fe.png'));
        $this->assertTrue($q2->isAnswerCorrect('0'));
        $this->assertTrue($q2->isAnswerCorrect('أ'));
        $this->assertFalse($q2->isAnswerCorrect('نحاس'));
        $this->assertFalse($q2->isAnswerCorrect('https://platform.com/storage/exams/cu.png'));
    }

    public function test_teacher_cannot_delete_another_teachers_exam_image()
    {
        Storage::fake('public');

        $otherTeacher = User::factory()->create([
            'role' => 'teacher',
            'status' => 'active',
        ]);

        // Image uploaded into other teacher's isolated folder
        $otherPath = "exams/teacher_{$otherTeacher->id}/secret_diagram.png";
        Storage::disk('public')->put($otherPath, 'fake-image-bytes');

        // Current teacher attempts to delete it
        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/delete-image', [
            'path' => $otherPath,
        ]);

        $response->assertStatus(403);
        Storage::disk('public')->assertExists($otherPath);
    }

    public function test_cannot_delete_image_used_by_another_teachers_question()
    {
        Storage::fake('public');

        $otherTeacher = User::factory()->create([
            'role' => 'teacher',
            'status' => 'active',
        ]);

        $otherCourse = Course::create([
            'teacher_id' => $otherTeacher->id,
            'title' => 'كورس مدرس آخر',
            'price' => 0,
            'grade' => 'third_secondary',
            'subject' => 'chemistry',
        ]);

        $otherExam = Exam::create([
            'course_id' => $otherCourse->id,
            'teacher_id' => $otherTeacher->id,
            'title' => 'امتحان مدرس آخر',
            'type' => 'monthly_exam',
            'max_score' => 10,
        ]);

        $imagePath = 'exams/shared_image_test.png';
        Storage::disk('public')->put($imagePath, 'fake-bytes');

        Question::create([
            'exam_id' => $otherExam->id,
            'text' => 'سؤال يخص معلماً آخر',
            'image_url' => asset('storage/' . $imagePath),
            'type' => 'essay',
            'options' => [],
            'correct_answer' => '',
            'score' => 5,
        ]);

        // Current teacher attempts to delete the shared/other teacher's in-use image
        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/delete-image', [
            'path' => $imagePath,
        ]);

        $response->assertStatus(403);
        Storage::disk('public')->assertExists($imagePath);
    }

    public function test_delete_image_rejects_path_traversal()
    {
        Storage::fake('public');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/delete-image', [
            'path' => 'exams/../../etc/passwd',
        ]);

        $response->assertStatus(400);
    }

    public function test_import_word_rejects_corrupted_file()
    {
        $corruptFile = UploadedFile::fake()->create('corrupted.docx', 10, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/exams/import-word', [
            'file' => $corruptFile,
        ]);

        $response->assertStatus(422);
        $this->assertNotEmpty($response->json('message'));
    }
}
