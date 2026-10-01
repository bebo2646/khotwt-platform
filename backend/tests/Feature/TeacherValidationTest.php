<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TeacherValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => true,
        ]);
    }

    public function test_admin_cannot_create_teacher_with_digits_in_name()
    {
        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'أحمد 123 محمد',
            'phone' => '01012345678',
            'subject' => 'فيزياء',
            'experience' => '5 سنوات',
            'teaching_mode' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);
        $this->assertDatabaseMissing('users', [
            'phone' => '01012345678',
        ]);
    }

    public function test_admin_cannot_create_teacher_with_short_or_invalid_phone()
    {
        // Test short phone "010"
        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'أحمد محمد علي',
            'phone' => '010',
            'subject' => 'فيزياء',
            'experience' => '5 سنوات',
            'teaching_mode' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['phone']);

        // Test non-Egyptian prefix "01912345678"
        $response2 = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'أحمد محمد علي',
            'phone' => '01912345678',
            'subject' => 'فيزياء',
            'experience' => '5 سنوات',
            'teaching_mode' => 'online',
        ]);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['phone']);
    }

    public function test_admin_can_create_teacher_with_valid_name_and_egyptian_phone()
    {
        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'أ. حسام الدين عبد الرحمن',
            'phone' => '01012345678',
            'subject' => 'كيمياء',
            'experience' => '8 سنوات',
            'teaching_mode' => 'online',
            'category' => 'school',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'name' => 'أ. حسام الدين عبد الرحمن',
            'phone' => '01012345678',
            'role' => 'teacher',
        ]);
    }

    public function test_admin_cannot_update_teacher_with_invalid_name_or_phone()
    {
        $teacher = User::factory()->create([
            'role' => 'teacher',
            'name' => 'محمود علي',
            'phone' => '01112345678',
        ]);

        // Invalid name with digits
        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/teachers/{$teacher->id}", [
            'name' => 'محمود 2026',
            'phone' => '01112345678',
            'subject' => 'رياضيات',
            'experience' => '3 سنوات',
            'status' => 'active',
            'teaching_mode' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);

        // Invalid phone "010"
        $response2 = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/teachers/{$teacher->id}", [
            'name' => 'محمود علي',
            'phone' => '010',
            'subject' => 'رياضيات',
            'experience' => '3 سنوات',
            'status' => 'active',
            'teaching_mode' => 'online',
        ]);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['phone']);
    }

    public function test_teacher_cannot_update_profile_with_digits_in_name()
    {
        $teacher = User::factory()->create([
            'role' => 'teacher',
            'name' => 'سارة حسن',
            'phone' => '01212345678',
            'teaching_mode' => 'online',
        ]);

        $response = $this->actingAs($teacher, 'sanctum')->postJson('/api/teacher/profile/update', [
            'name' => 'سارة 999',
            'phone' => '01212345678',
            'experience' => '5 سنوات',
            'teaching_mode' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);
    }

    public function test_student_registration_enforces_name_and_egyptian_phone_rules()
    {
        // Numbers in student name
        $response = $this->postJson('/api/register', [
            'name' => 'طالب 123',
            'email' => 'student_test1@test.com',
            'password' => 'password123',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grade' => 'الصف الثالث الثانوي',
            'student_type' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name']);

        // Invalid phone
        $response2 = $this->postJson('/api/register', [
            'name' => 'عمر خالد',
            'email' => 'student_test2@test.com',
            'password' => 'password123',
            'phone' => '010',
            'parent_phone' => '01112345678',
            'grade' => 'الصف الثالث الثانوي',
            'student_type' => 'online',
        ]);

        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['phone']);
    }
}
