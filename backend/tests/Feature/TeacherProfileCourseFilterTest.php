<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class TeacherProfileCourseFilterTest extends TestCase
{
    use DatabaseTransactions;

    private User $teacher;
    private User $student;
    private Course $courseA;
    private Course $courseB;
    private Course $bundleCourse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'Teacher Filter Test',
            'email' => 'teacher_filter_' . rand(1000, 9999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'math',
            'grades' => ['first_secondary']
        ]);

        $this->student = User::create([
            'name' => 'Student Filter Test',
            'email' => 'student_filter_' . rand(1000, 9999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        $this->courseA = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Course A Standalone',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'math',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $this->courseB = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Course B Standalone',
            'price' => 150.00,
            'grade' => 'first_secondary',
            'subject' => 'math',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $this->bundleCourse = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Bundle Course AB',
            'price' => 200.00,
            'grade' => 'first_secondary',
            'subject' => 'math',
            'is_published' => true,
            'is_bundle' => true,
        ]);

        $this->bundleCourse->childCourses()->attach([$this->courseA->id, $this->courseB->id]);
    }

    public function test_guest_sees_all_courses_with_not_subscribed(): void
    {
        $response = $this->getJson("/api/teachers/{$this->teacher->id}");

        $response->assertStatus(200);
        $courses = $response->json('courses');
        $this->assertCount(3, $courses);

        foreach ($courses as $c) {
            $this->assertFalse((bool)$c['is_subscribed']);
        }
    }

    public function test_student_subscribed_to_course_a_has_is_subscribed_true_only_for_course_a(): void
    {
        // Enroll student in Course A
        Enrollment::create([
            'student_id' => $this->student->id,
            'course_id' => $this->courseA->id,
            'enrolled_at' => now(),
        ]);

        $response = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/teachers/{$this->teacher->id}");

        $response->assertStatus(200);
        $courses = collect($response->json('courses'));

        $courseARes = $courses->firstWhere('id', $this->courseA->id);
        $courseBRes = $courses->firstWhere('id', $this->courseB->id);
        $bundleRes = $courses->firstWhere('id', $this->bundleCourse->id);

        $this->assertTrue((bool)$courseARes['is_subscribed']);
        $this->assertFalse((bool)$courseBRes['is_subscribed']);
        // Crucial: Enrollment in child course A must NOT mark bundle as subscribed
        $this->assertFalse((bool)$bundleRes['is_subscribed']);
    }

    public function test_student_subscribed_to_bundle_does_not_mark_child_courses_as_directly_subscribed(): void
    {
        // Enroll student in Bundle
        Enrollment::create([
            'student_id' => $this->student->id,
            'course_id' => $this->bundleCourse->id,
            'enrolled_at' => now(),
        ]);

        $response = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/teachers/{$this->teacher->id}");

        $response->assertStatus(200);
        $courses = collect($response->json('courses'));

        $courseARes = $courses->firstWhere('id', $this->courseA->id);
        $courseBRes = $courses->firstWhere('id', $this->courseB->id);
        $bundleRes = $courses->firstWhere('id', $this->bundleCourse->id);

        $this->assertTrue((bool)$bundleRes['is_subscribed']);
        // Crucial: Enrollment in parent bundle must NOT mark individual child course as directly subscribed
        $this->assertFalse((bool)$courseARes['is_subscribed']);
        $this->assertFalse((bool)$courseBRes['is_subscribed']);
    }
}
