<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\PlatformSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class SecurityImprovementsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Setup default platform settings
        PlatformSetting::truncate();
        PlatformSetting::create([
            'require_student_approval' => false, // Active immediately for test ease
        ]);
        
        // Ensure cache rate limits are cleared before each test
        RateLimiter::clear('login_attempts:student@test.com|127.0.0.1');
    }

    /**
     * Test registration fails if student and parent phone numbers are identical.
     */
    public function test_registration_fails_if_phone_numbers_are_identical()
    {
        // 1. Exact match
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'student@test.com',
            'phone' => '01012345678',
            'parent_phone' => '01012345678',
            'grade' => 'first_secondary',
            'password' => 'password123',
            'student_type' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['parent_phone']);
        $response->assertJsonPath('errors.parent_phone.0', "The student's phone number cannot be the same as the parent's phone number.");

        // 2. Normalized match (dashes vs country code)
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'student2@test.com',
            'phone' => '+20 10-1234-5678',
            'parent_phone' => '00201012345678',
            'grade' => 'first_secondary',
            'password' => 'password123',
            'student_type' => 'online',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['parent_phone']);
        $response->assertJsonPath('errors.parent_phone.0', "The student's phone number cannot be the same as the parent's phone number.");

        // 3. Different numbers succeed
        $response = $this->postJson('/api/register', [
            'name' => 'Test Student',
            'email' => 'student3@test.com',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'grade' => 'first_secondary',
            'password' => 'password123',
            'student_type' => 'online',
        ]);

        $response->assertStatus(201);
    }

    /**
     * Test login rate limiting tracks failures and blocks user for 30 minutes after 10 consecutive failures.
     */
    public function test_login_rate_limiting_lockout_and_reset()
    {
        $user = User::create([
            'name' => 'Test User',
            'email' => 'student@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'status' => 'active',
        ]);

        // Attempt login 10 times with incorrect password
        for ($i = 0; $i < 10; $i++) {
            $response = $this->postJson('/api/login', [
                'email' => 'student@test.com',
                'password' => 'wrongpassword',
            ]);

            $response->assertStatus(422);
            $response->assertJsonValidationErrors(['password']);
            $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
        }

        // The 11th attempt should be blocked with rate limiting message
        $response = $this->postJson('/api/login', [
            'email' => 'student@test.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        $response->assertJsonPath('errors.email.0', 'محاولات تسجيل دخول كثيرة جداً. يرجى المحاولة بعد 30 دقيقة.');

        // Time travel 31 minutes into the future
        $this->travel(31)->minutes();

        // Attempts should now be allowed again. Let's log in with CORRECT password.
        $response = $this->postJson('/api/login', [
            'email' => 'student@test.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['token', 'user']);

        // Check that failed attempt counter has been reset on successful login
        // If we fail again now, it should say wrong password, NOT too many attempts
        $response = $this->postJson('/api/login', [
            'email' => 'student@test.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
        $response->assertJsonPath('errors.password.0', 'كلمة المرور غير صحيحة');
    }
}
