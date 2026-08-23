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
     * Scenario A: Completely nonexistent account + any password
     * Expected: "هذا الحساب غير موجود"
     */
    public function test_nonexistent_account_returns_account_does_not_exist_error(): void
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
     * Scenario B: Existing student account + wrong password
     * Expected: "كلمة المرور غير صحيحة"
     */
    public function test_existing_student_with_wrong_password_returns_incorrect_password_error(): void
    {
        $student = User::create([
            'name' => 'Student Test',
            'email' => 'student_' . uniqid() . '@test.com',
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
     * Scenario C: Existing student account + correct password
     * Expected: Successful login exactly as before.
     */
    public function test_existing_student_with_correct_password_logs_in_successfully(): void
    {
        $student = User::create([
            'name' => 'Student Test',
            'email' => 'student_' . uniqid() . '@test.com',
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
     * Scenario D: Existing teacher account + wrong password
     * Expected: "كلمة المرور غير صحيحة"
     */
    public function test_existing_teacher_with_wrong_password_returns_incorrect_password_error(): void
    {
        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_' . uniqid() . '@test.com',
            'password' => bcrypt('teacher_secret_123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['first_secondary'],
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $teacher->email,
            'password' => 'incorrect_teacher_pass',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
        $response->assertJsonPath('message', 'كلمة المرور غير صحيحة');
    }

    /**
     * Scenario E: Existing admin account + wrong password
     * Expected: "كلمة المرور غير صحيحة"
     */
    public function test_existing_admin_with_wrong_password_returns_incorrect_password_error(): void
    {
        $admin = User::create([
            'name' => 'Admin Test',
            'email' => 'admin_' . uniqid() . '@test.com',
            'password' => bcrypt('admin_master_123'),
            'role' => 'admin',
            'status' => 'active',
            'is_super_admin' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'incorrect_admin_pass',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
        $response->assertJsonPath('message', 'كلمة المرور غير صحيحة');
    }

    /**
     * Scenario F: Existing teacher & admin successful logins
     */
    public function test_teacher_and_admin_with_correct_password_log_in_successfully(): void
    {
        $teacher = User::create([
            'name' => 'Teacher Test 2',
            'email' => 'teacher2_' . uniqid() . '@test.com',
            'password' => bcrypt('teacher_pass_456'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary'],
        ]);

        $admin = User::create([
            'name' => 'Admin Test 2',
            'email' => 'admin2_' . uniqid() . '@test.com',
            'password' => bcrypt('admin_pass_456'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $teacherResponse = $this->postJson('/api/login', [
            'email' => $teacher->email,
            'password' => 'teacher_pass_456',
        ]);
        $teacherResponse->assertStatus(200);
        $this->assertEquals('teacher', $teacherResponse->json('user.role'));

        $adminResponse = $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'admin_pass_456',
        ]);
        $adminResponse->assertStatus(200);
        $this->assertEquals('admin', $adminResponse->json('user.role'));
    }

    /**
     * Scenario G: Case-insensitive email and phone matching with wrong vs correct password
     */
    public function test_case_insensitive_email_and_phone_login_error_distinction(): void
    {
        $user = User::create([
            'name' => 'Case Test User',
            'email' => 'mixed_case_' . uniqid() . '@Test.Com',
            'phone' => '01099887766',
            'password' => bcrypt('my_secure_pass'),
            'role' => 'student',
            'status' => 'active',
        ]);

        // 1. Lowercase email with wrong password -> "كلمة المرور غير صحيحة"
        $response = $this->postJson('/api/login', [
            'email' => strtolower($user->email),
            'password' => 'wrong_pass',
        ]);
        $response->assertStatus(422);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');

        // 2. Phone number with wrong password -> "كلمة المرور غير صحيحة"
        $response = $this->postJson('/api/login', [
            'email' => '01099887766',
            'password' => 'wrong_pass',
        ]);
        $response->assertStatus(422);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');

        // 3. Phone number with correct password -> 200 OK
        $response = $this->postJson('/api/login', [
            'email' => '01099887766',
            'password' => 'my_secure_pass',
        ]);
        $response->assertStatus(200);
        $this->assertEquals($user->id, $response->json('user.id'));
    }
}
