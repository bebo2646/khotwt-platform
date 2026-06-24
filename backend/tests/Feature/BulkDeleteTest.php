<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\PurchaseCode;
use App\Models\AdminActivityLog;
use Illuminate\Support\Facades\DB;

use Illuminate\Foundation\Testing\DatabaseTransactions;

class BulkDeleteTest extends TestCase
{
    use DatabaseTransactions;
    public function test_bulk_delete_requires_authentication(): void
    {
        $this->postJson('/api/admin/bulk/students')->assertStatus(401);
        $this->postJson('/api/admin/bulk/teachers')->assertStatus(401);
        $this->postJson('/api/admin/bulk/codes')->assertStatus(401);
    }

    public function test_bulk_delete_requires_super_admin(): void
    {
        // Standard admin but NOT super
        $secondaryAdmin = User::create([
            'name' => 'Secondary Admin',
            'email' => 'sec_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => false,
            'is_super_admin' => false,
            'status' => 'active'
        ]);

        $this->actingAs($secondaryAdmin)->postJson('/api/admin/bulk/students')->assertStatus(403);
        $this->actingAs($secondaryAdmin)->postJson('/api/admin/bulk/teachers')->assertStatus(403);
        $this->actingAs($secondaryAdmin)->postJson('/api/admin/bulk/codes')->assertStatus(403);
    }

    public function test_bulk_delete_students_success(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $initialCount = User::where('role', 'student')->count();

        $student = User::create([
            'name' => 'Student Test',
            'email' => 'student_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        // Create a teacher and course to verify they are NOT deleted
        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
            'grades' => ['first_preparatory']
        ]);

        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course Title',
            'price' => 50.00,
            'grade' => 'first_preparatory',
            'subject' => 'Math'
        ]);

        // Enroll the student
        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'enrolled_at' => now()
        ]);

        $expectedCount = $initialCount + 1;

        $this->actingAs($superAdmin)
             ->postJson('/api/admin/bulk/students')
             ->assertStatus(200)
             ->assertJsonStructure(['message', 'deleted_count']);

        // Assert student user is deleted
        $this->assertNull(User::find($student->id));
        // Assert enrollment is deleted
        $this->assertEquals(0, Enrollment::where('student_id', $student->id)->count());
        // Assert teacher user is NOT deleted
        $this->assertNotNull(User::find($teacher->id));
        // Assert course is NOT deleted
        $this->assertNotNull(Course::find($course->id));

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => 'Deleted Students',
            'deleted_count' => $expectedCount,
        ]);
    }

    public function test_bulk_delete_teachers_fails_if_courses_exist(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
            'grades' => ['first_preparatory']
        ]);

        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course Title',
            'price' => 50.00,
            'grade' => 'first_preparatory',
            'subject' => 'Math'
        ]);

        // Trying to delete teachers must fail since courses exist
        $response = $this->actingAs($superAdmin)
                         ->postJson('/api/admin/bulk/teachers');

        $response->assertStatus(422)
                 ->assertJsonFragment(['error_type' => 'courses_exist']);

        // Assert teacher is NOT deleted
        $this->assertNotNull(User::find($teacher->id));
    }

    public function test_bulk_delete_teachers_success_if_no_courses(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
            'grades' => ['first_preparatory']
        ]);

        // Clean up any other courses just in case
        Course::query()->delete();

        $response = $this->actingAs($superAdmin)
                         ->postJson('/api/admin/bulk/teachers');

        $response->assertStatus(200);

        // Assert teacher is deleted
        $this->assertNull(User::find($teacher->id));

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => 'Deleted Teachers',
        ]);
    }

    public function test_bulk_delete_codes_success(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        PurchaseCode::create([
            'code' => 'TESTCODE1',
            'type' => 'wallet',
            'amount' => 50.00,
            'is_redeemed' => false,
        ]);

        PurchaseCode::create([
            'code' => 'TESTCODE2',
            'type' => 'wallet',
            'amount' => 100.00,
            'is_redeemed' => true,
        ]);

        $response = $this->actingAs($superAdmin)
                         ->postJson('/api/admin/bulk/codes');

        $response->assertStatus(200);

        $this->assertEquals(0, PurchaseCode::count());

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => 'Deleted Codes',
        ]);
    }

    public function test_admin_delete_course_success(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
            'grades' => ['first_preparatory']
        ]);

        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course Title',
            'price' => 50.00,
            'grade' => 'first_preparatory',
            'subject' => 'Math'
        ]);

        $response = $this->actingAs($superAdmin)
                         ->deleteJson("/api/admin/courses/{$course->id}");

        $response->assertStatus(200);
        $this->assertNull(Course::find($course->id));

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => 'Deleted Course: Course Title',
            'deleted_count' => 1,
        ]);
    }

    public function test_admin_delete_course_fails_for_restricted_admin_without_permission(): void
    {
        $restrictedAdmin = User::create([
            'name' => 'Restricted Admin',
            'email' => 'rest_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => false,
            'is_super_admin' => false,
            'permissions' => ['students.manage'], // no courses.manage permission
            'status' => 'active'
        ]);

        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
            'grades' => ['first_preparatory']
        ]);

        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course Title',
            'price' => 50.00,
            'grade' => 'first_preparatory',
            'subject' => 'Math'
        ]);

        $response = $this->actingAs($restrictedAdmin)
                         ->deleteJson("/api/admin/courses/{$course->id}");

        $response->assertStatus(403);
        $this->assertNotNull(Course::find($course->id));
    }

    public function test_admin_delete_admin_success(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $subAdmin = User::create([
            'name' => 'Sub Admin Delete',
            'email' => 'sub_admin_del_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => false,
            'is_super_admin' => false,
            'permissions' => ['students.manage'],
            'status' => 'active'
        ]);

        $response = $this->actingAs($superAdmin)
                         ->deleteJson("/api/admin/manage/{$subAdmin->id}");

        $response->assertStatus(200);
        $this->assertNull(User::find($subAdmin->id));

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => "Deleted Admin: {$subAdmin->email}",
            'deleted_count' => 1,
        ]);
    }

    public function test_admin_delete_student_success(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $student = User::create([
            'name' => 'Student Del Test',
            'email' => 'student_del_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        $response = $this->actingAs($superAdmin)
                         ->deleteJson("/api/admin/students/{$student->id}");

        $response->assertStatus(200);
        $this->assertNull(User::find($student->id));

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => "Deleted Student: {$student->email}",
            'deleted_count' => 1,
        ]);
    }

    public function test_admin_delete_teacher_success(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'super_admin_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_super' => true,
            'is_super_admin' => true,
            'status' => 'active'
        ]);

        $teacher = User::create([
            'name' => 'Teacher Del Test',
            'email' => 'teacher_del_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'Math',
            'grades' => ['first_preparatory']
        ]);

        $response = $this->actingAs($superAdmin)
                         ->deleteJson("/api/admin/teachers/{$teacher->id}");

        $response->assertStatus(200);
        $this->assertNull(User::find($teacher->id));

        // Assert audit log exists
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_name' => 'Super Admin',
            'action_type' => "Deleted Teacher: {$teacher->email}",
            'deleted_count' => 1,
        ]);
    }
}
