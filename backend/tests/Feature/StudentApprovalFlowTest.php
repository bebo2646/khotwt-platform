<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\PlatformSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentApprovalFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Setup default platform settings
        PlatformSetting::truncate();
        PlatformSetting::create([
            'require_student_approval' => true,
        ]);
    }

    public function test_a_newly_registered_student_is_pending_and_has_no_session()
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
        $response->assertJsonPath('status', 'pending');
        $response->assertJsonMissing(['token']);

        $user = User::where('email', 'student@test.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('pending', $user->status);
    }

    public function test_a_pending_student_cannot_log_in()
    {
        $student = User::create([
            'name' => 'Pending Student',
            'email' => 'pending@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'status' => 'pending',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'pending@test.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
        $response->assertJsonPath('status', 'pending');
    }

    public function test_a_rejected_student_receives_rejection_reason_on_login()
    {
        $student = User::create([
            'name' => 'Rejected Student',
            'email' => 'rejected@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'status' => 'rejected',
            'rejection_reason' => 'رقم ولي الأمر غير صحيح',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'rejected@test.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
        $response->assertJsonPath('status', 'rejected');
        $response->assertJsonPath('rejection_reason', 'رقم ولي الأمر غير صحيح');
    }

    public function test_a_rejected_student_account_can_be_auto_deleted()
    {
        $student = User::create([
            'name' => 'Rejected Student',
            'email' => 'rejected@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'phone' => '01012345678',
            'parent_phone' => '01112345678',
            'status' => 'rejected',
        ]);

        Wallet::create([
            'student_id' => $student->id,
            'balance' => 0.00,
        ]);

        $response = $this->postJson('/api/auth/delete-rejected-account', [
            'email' => 'rejected@test.com',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseMissing('users', ['id' => $student->id]);
        $this->assertDatabaseMissing('wallets', ['student_id' => $student->id]);
    }

    public function test_admin_and_teacher_are_unaffected_by_approval_mode()
    {
        $teacher = User::create([
            'name' => 'Teacher User',
            'email' => 'teacher@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'pending', // even if status is set to pending
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'teacher@test.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['token', 'user']);
    }
}
