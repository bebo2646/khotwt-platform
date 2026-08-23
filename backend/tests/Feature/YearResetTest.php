<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Support\Facades\DB;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class YearResetTest extends TestCase
{
    use DatabaseTransactions;
    // Do not refresh database if we want to run in current SQLite/Postgres container,
    // or let's use a transaction to roll back changes.
    
    public function test_year_reset_requires_authentication(): void
    {
        $response = $this->postJson('/api/admin/reset-year');
        $response->assertStatus(401);
    }

    public function test_year_reset_requires_admin_role(): void
    {
        // Create a student user
        $student = User::factory()->create([
            'role' => 'student',
            'status' => 'active'
        ]);

        $response = $this->actingAs($student)
                         ->postJson('/api/admin/reset-year');

        $response->assertStatus(403);
    }

    public function test_year_reset_clears_subscriptions_but_keeps_content(): void
    {
        $admin = User::create([
            'name' => 'Admin Test',
            'email' => 'admin_test_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        // Find or create a teacher, student, course
        $teacher = User::where('role', 'teacher')->first();
        if (!$teacher) {
            $teacher = User::create([
                'name' => 'Teacher Test',
                'email' => 'teacher_test_' . rand(100, 999) . '@test.com',
                'password' => bcrypt('password'),
                'role' => 'teacher',
                'status' => 'active',
                'subject' => 'chemistry',
                'grades' => ['first_secondary']
            ]);
        }

        $student = User::where('role', 'student')->first();
        if (!$student) {
            $student = User::create([
                'name' => 'Student Test',
                'email' => 'student_test_' . rand(100, 999) . '@test.com',
                'password' => bcrypt('password'),
                'role' => 'student',
                'status' => 'active'
            ]);
        }

        $course = Course::first();
        if (!$course) {
            $course = Course::create([
                'teacher_id' => $teacher->id,
                'title' => 'Course Test',
                'price' => 100.00,
                'grade' => 'first_secondary',
                'subject' => 'chemistry',
                'is_published' => true
            ]);
        }

        // Insert a dummy enrollment
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'enrolled_at' => now()
        ]);

        // Run Year Reset
        $response = $this->actingAs($admin)
                         ->postJson('/api/admin/reset-year', [
                             'confirmation' => \App\Services\AcademicYearResetService::REQUIRED_CONFIRMATION,
                         ]);

        $response->assertStatus(200)
                 ->assertJsonStructure(['message']);

        // Verify enrollments are gone
        $this->assertEquals(0, Enrollment::count());

        // Verify video progresses are gone
        $this->assertEquals(0, DB::table('video_progresses')->count());

        // Verify critical entities are kept
        $this->assertGreaterThan(0, User::where('role', 'admin')->count());
        $this->assertGreaterThan(0, User::where('role', 'teacher')->count());
        $this->assertEquals(0, User::where('role', 'student')->count());
        $this->assertGreaterThan(0, Course::count());
    }
}
