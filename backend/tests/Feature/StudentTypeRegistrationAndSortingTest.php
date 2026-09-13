<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Course;
use App\Models\PlatformSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentTypeRegistrationAndSortingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Setup default platform settings
        PlatformSetting::truncate();
        PlatformSetting::create([
            'require_student_approval' => false,
        ]);
    }

    public function test_student_registration_requires_student_type()
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'student@test.com',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grade' => 'first_secondary',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['student_type']);
    }

    public function test_student_registration_with_online_type_works()
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'student@test.com',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grade' => 'first_secondary',
            'password' => 'password123',
            'student_type' => 'online',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'student@test.com',
            'student_type' => 'online',
        ]);
    }

    public function test_student_registration_with_center_type_works()
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'student@test.com',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grade' => 'first_secondary',
            'password' => 'password123',
            'student_type' => 'center',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'student@test.com',
            'student_type' => 'center',
        ]);
    }

    public function test_online_students_see_online_courses_first()
    {
        $teacher = User::create([
            'name' => 'Teacher User',
            'email' => 'teacher@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
        ]);

        $onlineCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Online Course',
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'availability' => 'online',
            'is_published' => true,
        ]);
        $onlineCourse->update(['created_at' => now()->subMinutes(10)]);

        $centerCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Center Course',
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'availability' => 'center',
            'is_published' => true,
        ]);
        $centerCourse->update(['created_at' => now()]);

        $student = User::create([
            'name' => 'Online Student',
            'email' => 'student@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grades' => ['first_secondary'],
            'student_type' => 'online',
            'status' => 'active',
        ]);

        $response = $this->actingAs($student)->getJson('/api/courses?teacher_id=' . $teacher->id);

        $response->assertStatus(200);
        $courses = $response->json();
        $this->assertCount(2, $courses);
        $this->assertEquals('Online Course', $courses[0]['title']);
        $this->assertEquals('Center Course', $courses[1]['title']);
    }

    public function test_center_students_see_center_courses_first()
    {
        $teacher = User::create([
            'name' => 'Teacher User',
            'email' => 'teacher@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
        ]);

        $centerCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Center Course',
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'availability' => 'center',
            'is_published' => true,
        ]);
        $centerCourse->update(['created_at' => now()->subMinutes(10)]);

        $onlineCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Online Course',
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'availability' => 'online',
            'is_published' => true,
        ]);
        $onlineCourse->update(['created_at' => now()]);

        $student = User::create([
            'name' => 'Center Student',
            'email' => 'student@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grades' => ['first_secondary'],
            'student_type' => 'center',
            'status' => 'active',
        ]);

        $response = $this->actingAs($student)->getJson('/api/courses?teacher_id=' . $teacher->id);

        $response->assertStatus(200);
        $courses = $response->json();
        $this->assertCount(2, $courses);
        $this->assertEquals('Center Course', $courses[0]['title']);
        $this->assertEquals('Online Course', $courses[1]['title']);
    }
}
