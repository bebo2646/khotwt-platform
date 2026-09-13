<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Exam;
use App\Models\StudentExam;

class ExamResultsSafeRenderingTest extends TestCase
{
    use RefreshDatabase;

    public function test_exam_results_endpoint_handles_course_exams_and_standalone_exams_safely()
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $student = User::factory()->create(['role' => 'student']);

        // 1. Course exam with lesson, unit, course
        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'الكورس التأسيس في الرياضيات',
            'price' => 50,
            'status' => 'published',
            'subject' => 'Math',
            'grade' => '3',
        ]);
        $unit = Unit::create(['course_id' => $course->id, 'title' => 'الحصه الاولي', 'order' => 1]);
        $lesson = Lesson::create(['unit_id' => $unit->id, 'title' => 'الدرس الاول', 'order' => 1]);
        $exam15 = Exam::create([
            'teacher_id' => $teacher->id,
            'lesson_id' => $lesson->id,
            'title' => 'اتستت',
            'type' => 'quiz',
            'max_score' => 10,
            'is_published' => true,
            'is_active' => true,
        ]);

        // Attempt for Exam 15
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $exam15->id,
            'course_id' => $course->id,
            'lesson_id' => $lesson->id,
            'status' => 'submitted',
            'score' => 1,
            'started_at' => now()->subMinutes(10),
            'submitted_at' => now(),
        ]);

        // 2. Standalone exam with NO lesson (lesson_id = null)
        $exam16 = Exam::create([
            'teacher_id' => $teacher->id,
            'lesson_id' => null,
            'title' => 'امتحان تيست',
            'type' => 'monthly_exam',
            'max_score' => 20,
            'is_published' => true,
            'is_active' => true,
        ]);

        // Attempt for Exam 16
        StudentExam::create([
            'student_id' => $student->id,
            'exam_id' => $exam16->id,
            'status' => 'submitted',
            'score' => null,
            'started_at' => now()->subMinutes(20),
            'submitted_at' => now(),
        ]);

        // Call API endpoint
        $response = $this->actingAs($student)->getJson('/api/student/results');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertCount(2, $data);

        // Verify Attempt 1 has lesson/unit/course
        $attempt1 = collect($data)->firstWhere('exam_id', $exam15->id);
        $this->assertNotNull($attempt1);
        $this->assertEquals('اتستت', $attempt1['exam']['title']);
        $this->assertEquals('الكورس التأسيس في الرياضيات', $attempt1['exam']['lesson']['unit']['course']['title']);

        // Verify Attempt 2 has null lesson
        $attempt2 = collect($data)->firstWhere('exam_id', $exam16->id);
        $this->assertNotNull($attempt2);
        $this->assertEquals('امتحان تيست', $attempt2['exam']['title']);
        $this->assertNull($attempt2['exam']['lesson']);
    }
}
