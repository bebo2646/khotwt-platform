<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\RateLimiter;

class LoginErrorHandlingTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('login_attempts:nonexistent@test.com|127.0.0.1');
    }

    /**
     * Scenario 1: Completely nonexistent email + any password
     * Expected: HTTP 422 with "هذا الحساب غير موجود"
     */
    public function test_nonexistent_email_returns_account_does_not_exist_error(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'completely_nonexistent_' . uniqid() . '@test.com',
            'password' => 'somepassword123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        $response->assertJsonPath('errors.email.0', 'هذا الحساب غير موجود');
        $response->assertJsonPath('message', 'هذا الحساب غير موجود');
    }

    /**
     * Scenario 2: Existing student account + wrong password (using email)
     * Expected: HTTP 422 with "كلمة المرور غير صحيحة"
     */
    public function test_existing_student_with_wrong_password_using_email_returns_incorrect_password(): void
    {
        $student = User::create([
            'name' => 'Student Test',
            'email' => 'student_' . uniqid() . '@test.com',
            'phone' => '01151970493',
            'password' => bcrypt('correct_password_123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $student->email,
            'password' => 'wrong_password_xyz',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
        $response->assertJsonPath('message', 'كلمة المرور غير صحيحة');
    }

    /**
     * Scenario 3: Existing student account + correct password (using email)
     * Expected: HTTP 200 Successful login
     */
    public function test_student_login_using_email_success(): void
    {
        $student = User::create([
            'name' => 'Student Test',
            'email' => 'student_' . uniqid() . '@test.com',
            'phone' => '01151970493',
            'password' => bcrypt('correct_password_123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $student->email,
            'password' => 'correct_password_123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'token',
            'user' => ['id', 'name', 'email', 'role'],
            'session_token',
        ]);
        $this->assertEquals($student->id, $response->json('user.id'));
    }

    /**
     * Scenario 4: Phone number entered into email field
     * Expected: HTTP 422 with "The email field must be a valid email address."
     */
    public function test_phone_number_in_email_field_returns_valid_email_validation_error(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => '01151970493',
            'password' => 'anypassword',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        $this->assertEquals('The email field must be a valid email address.', $response->json('errors.email.0'));
    }

    /**
     * Scenario 5: Empty email field
     * Expected: HTTP 422 with "The email field is required."
     */
    public function test_empty_email_returns_required_validation_error(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => '',
            'password' => 'somepass',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        $this->assertEquals('The email field is required.', $response->json('errors.email.0'));
    }

    /**
     * Scenario 6: Invalid email format
     * Expected: HTTP 422 with "The email field must be a valid email address."
     */
    public function test_invalid_email_format_returns_validation_error(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'not-an-email',
            'password' => 'somepass',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        $this->assertEquals('The email field must be a valid email address.', $response->json('errors.email.0'));
    }

    /**
     * Scenario 7: Teacher and Admin login using email
     * Expected: HTTP 200 Successful login
     */
    public function test_teacher_and_admin_login_using_email_success(): void
    {
        $teacher = User::create([
            'name' => 'Teacher Test Email',
            'email' => 'teacher_email_' . uniqid() . '@test.com',
            'password' => bcrypt('teacher_pass_456'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary'],
        ]);

        $admin = User::create([
            'name' => 'Admin Test Email',
            'email' => 'admin_email_' . uniqid() . '@test.com',
            'password' => bcrypt('admin_pass_456'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        // Teacher by email
        $teacherResponse = $this->postJson('/api/login', [
            'email' => $teacher->email,
            'password' => 'teacher_pass_456',
        ]);
        $teacherResponse->assertStatus(200);
        $this->assertEquals('teacher', $teacherResponse->json('user.role'));

        // Admin by email
        $adminResponse = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'admin_pass_456',
        ]);
        $adminResponse->assertStatus(200);
        $this->assertEquals('admin', $adminResponse->json('user.role'));
    }
}
