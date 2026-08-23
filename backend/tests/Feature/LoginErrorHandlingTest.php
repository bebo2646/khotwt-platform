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
     * Scenario A: Completely nonexistent email + any password
     * Expected: "هذا الحساب غير موجود"
     */
    public function test_nonexistent_email_returns_account_does_not_exist_error(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => 'completely_nonexistent_' . uniqid() . '@test.com',
            'password' => 'somepassword123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['identifier']);
        $response->assertJsonPath('errors.identifier.0', 'هذا الحساب غير موجود');
        $response->assertJsonPath('message', 'هذا الحساب غير موجود');
    }

    /**
     * Scenario F: Completely nonexistent student number / phone + any password
     * Expected: "هذا الحساب غير موجود"
     */
    public function test_nonexistent_student_number_returns_account_does_not_exist_error(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => '01199998888',
            'password' => 'somepassword123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['identifier']);
        $response->assertJsonPath('errors.identifier.0', 'هذا الحساب غير موجود');
        $response->assertJsonPath('message', 'هذا الحساب غير موجود');
    }

    /**
     * Scenario B: Existing student account + wrong password (using email)
     * Expected: "كلمة المرور غير صحيحة"
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
            'identifier' => $student->email,
            'password' => 'wrong_password_xyz',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
        $response->assertJsonPath('message', 'كلمة المرور غير صحيحة');
    }

    /**
     * Scenario D: Existing student account + wrong password (using student number / phone)
     * Expected: "كلمة المرور غير صحيحة"
     */
    public function test_existing_student_with_wrong_password_using_student_number_returns_incorrect_password(): void
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
            'identifier' => '01151970493',
            'password' => 'wrong_password_xyz',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
        $response->assertJsonPath('message', 'كلمة المرور غير صحيحة');
    }

    /**
     * Scenario A/C: Existing student account + correct password (using email)
     * Expected: Successful login
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
            'identifier' => $student->email,
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
     * Scenario B: Student logs in using registered student number (phone) + correct password
     * Expected: Successful login
     */
    public function test_student_login_using_student_number_success(): void
    {
        $student = User::create([
            'name' => 'Student Test Number',
            'email' => 'student_num_' . uniqid() . '@test.com',
            'phone' => '01151970493',
            'password' => bcrypt('correct_password_123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/login', [
            'identifier' => '01151970493',
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
     * Scenario G: Existing teacher & admin successful logins using identifier
     */
    public function test_teacher_and_admin_login_using_identifier_success(): void
    {
        $teacher = User::create([
            'name' => 'Teacher Test 2',
            'email' => 'teacher2_' . uniqid() . '@test.com',
            'phone' => '01222334455',
            'password' => bcrypt('teacher_pass_456'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary'],
        ]);

        $admin = User::create([
            'name' => 'Admin Test 2',
            'email' => 'admin2_' . uniqid() . '@test.com',
            'phone' => '01299887766',
            'password' => bcrypt('admin_pass_456'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        // Teacher by email
        $teacherResponse = $this->postJson('/api/login', [
            'identifier' => $teacher->email,
            'password' => 'teacher_pass_456',
        ]);
        $teacherResponse->assertStatus(200);
        $this->assertEquals('teacher', $teacherResponse->json('user.role'));

        // Admin by phone/identifier
        $adminResponse = $this->postJson('/api/login', [
            'identifier' => '01299887766',
            'password' => 'admin_pass_456',
        ]);
        $adminResponse->assertStatus(200);
        $this->assertEquals('admin', $adminResponse->json('user.role'));
    }

    /**
     * Scenario H: Empty identifier validation error
     */
    public function test_empty_identifier_returns_validation_error(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => '',
            'password' => 'somepass',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['identifier']);
        $this->assertEquals('يرجى إدخال البريد الإلكتروني أو رقم الطالب.', $response->json('errors.identifier.0'));
    }

    /**
     * Scenario I: Backward compatibility - sending email key works identically
     */
    public function test_legacy_email_payload_key_works(): void
    {
        $student = User::create([
            'name' => 'Legacy Student',
            'email' => 'legacy_' . uniqid() . '@test.com',
            'password' => bcrypt('legacy_pass_123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $student->email,
            'password' => 'legacy_pass_123',
        ]);

        $response->assertStatus(200);
        $this->assertEquals($student->id, $response->json('user.id'));
    }

    /**
     * Scenario J: Student number sent in legacy 'email' field does NOT trigger email format validation error
     */
    public function test_student_number_sent_in_email_field_does_not_trigger_email_validation_error(): void
    {
        $student = User::create([
            'name' => 'Student Phone In Email Field',
            'email' => 'student_phone_' . uniqid() . '@test.com',
            'phone' => '01151970493',
            'password' => bcrypt('phone_pass_123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => '01151970493',
            'password' => 'phone_pass_123',
        ]);

        $response->assertStatus(200);
        $this->assertEquals($student->id, $response->json('user.id'));
    }

    /**
     * Scenario K: Student number containing only digits does not trigger "valid email address" error even for nonexistent
     */
    public function test_nonexistent_student_number_does_not_trigger_email_validation_error(): void
    {
        $response = $this->postJson('/api/login', [
            'identifier' => '01151970493',
            'password' => 'anypassword',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['identifier']);
        $this->assertEquals('هذا الحساب غير موجود', $response->json('errors.identifier.0'));
        $this->assertNotEquals('The email field must be a valid email address.', $response->json('errors.identifier.0'));
    }
}
