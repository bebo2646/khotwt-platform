<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Wallet;
use App\Models\TeacherSession;
use App\Models\StudentSession;
use App\Models\StudentActivityLog;
use App\Models\TeacherActivityLog;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class AdminPermissionsTest extends TestCase
{
    use DatabaseTransactions;

    protected function createSupervisor(array $permissions = []): User
    {
        return User::create([
            'name' => 'Supervisor ' . uniqid(),
            'email' => 'sup_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => false,
            'is_super' => false,
            'permissions' => $permissions,
            'status' => 'active',
        ]);
    }

    protected function createStudent(): User
    {
        $student = User::create([
            'name' => 'Student ' . uniqid(),
            'email' => 'std_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);

        $wallet = Wallet::create([
            'student_id' => $student->id,
            'balance' => 500.00,
        ]);

        \App\Models\WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'amount' => 500.00,
            'type' => 'recharge',
            'description' => 'Initial balance',
        ]);

        return $student;
    }

    protected function createTeacher(): User
    {
        return User::create([
            'name' => 'Teacher ' . uniqid(),
            'email' => 'tch_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
        ]);
    }

    public function test_user_permission_checks_and_umbrella_inheritance(): void
    {
        $supervisor = $this->createSupervisor(['student_activity.view']);
        $this->assertTrue($supervisor->hasPermission('student_activity.view'));
        $this->assertFalse($supervisor->hasPermission('student_activity.view_financial'));
        $this->assertFalse($supervisor->hasPermission('students.manage'));

        // Umbrella students.manage covers all student_activity.*
        $umbrellaStudentAdmin = $this->createSupervisor(['students.manage']);
        $this->assertTrue($umbrellaStudentAdmin->hasPermission('student_activity.view'));
        $this->assertTrue($umbrellaStudentAdmin->hasPermission('student_activity.view_financial'));
        $this->assertTrue($umbrellaStudentAdmin->hasPermission('student_activity.view_security'));
        $this->assertTrue($umbrellaStudentAdmin->hasPermission('student_activity.view_sessions'));

        // Umbrella teachers.manage covers all teacher_activity.*
        $umbrellaTeacherAdmin = $this->createSupervisor(['teachers.manage']);
        $this->assertTrue($umbrellaTeacherAdmin->hasPermission('teacher_activity.view'));
        $this->assertTrue($umbrellaTeacherAdmin->hasPermission('teacher_activity.view_financial'));
        $this->assertTrue($umbrellaTeacherAdmin->hasPermission('teacher_activity.view_sessions'));

        // Umbrella exams.manage covers monthly_exams.* and exam_security.*
        $umbrellaExamAdmin = $this->createSupervisor(['exams.manage']);
        $this->assertTrue($umbrellaExamAdmin->hasPermission('monthly_exams.view'));
        $this->assertTrue($umbrellaExamAdmin->hasPermission('monthly_exams.create'));
        $this->assertTrue($umbrellaExamAdmin->hasPermission('exam_security.view'));
        $this->assertTrue($umbrellaExamAdmin->hasPermission('exam_security.unlock_answers'));

        // Umbrella academic_year.initialize covers academic_year.reset
        $initAdmin = $this->createSupervisor(['academic_year.initialize']);
        $this->assertTrue($initAdmin->hasPermission('academic_year.reset'));

        // hasAnyPermission helper
        $this->assertTrue($supervisor->hasAnyPermission('teacher_activity.view', 'student_activity.view'));
        $this->assertFalse($supervisor->hasAnyPermission('teacher_activity.view', 'monthly_exams.view'));
    }

    public function test_student_activity_endpoint_permissions(): void
    {
        $unauthorized = $this->createSupervisor(['courses.view']);
        $response = $this->actingAs($unauthorized)->getJson('/api/admin/student-activity');
        $response->assertStatus(403);

        $authorized = $this->createSupervisor(['student_activity.view']);
        $response = $this->actingAs($authorized)->getJson('/api/admin/student-activity');
        $response->assertStatus(200);

        // Explicit category=financial requires student_activity.view_financial
        $response = $this->actingAs($authorized)->getJson('/api/admin/student-activity?category=financial');
        $response->assertStatus(403);

        // Grant student_activity.view_financial
        $financialSup = $this->createSupervisor(['student_activity.view', 'student_activity.view_financial']);
        $response = $this->actingAs($financialSup)->getJson('/api/admin/student-activity?category=financial');
        $response->assertStatus(200);
    }

    public function test_student_activity_profile_financial_data_masking(): void
    {
        $student = $this->createStudent();

        // Supervisor without financial permission
        $viewOnlySup = $this->createSupervisor(['student_activity.view']);
        $response = $this->actingAs($viewOnlySup)->getJson("/api/admin/students/{$student->id}/activity");
        $response->assertStatus(200);
        $this->assertNull($response->json('student.wallet_balance'));
        $this->assertEquals(0, $response->json('stats.money_spent'));

        // Supervisor with financial permission
        $financialSup = $this->createSupervisor(['student_activity.view', 'student_activity.view_financial']);
        $response = $this->actingAs($financialSup)->getJson("/api/admin/students/{$student->id}/activity");
        $response->assertStatus(200);
        $this->assertEquals(500, (float)$response->json('student.wallet_balance'));
    }

    public function test_student_activity_sessions_permission(): void
    {
        $unauthorized = $this->createSupervisor(['courses.view']);
        $response = $this->actingAs($unauthorized)->getJson('/api/admin/student-activity/sessions');
        $response->assertStatus(403);

        $authorized = $this->createSupervisor(['student_activity.view_sessions']);
        $response = $this->actingAs($authorized)->getJson('/api/admin/student-activity/sessions');
        $response->assertStatus(200);
    }

    public function test_teacher_activity_endpoint_permissions(): void
    {
        $unauthorized = $this->createSupervisor(['students.view']);
        $response = $this->actingAs($unauthorized)->getJson('/api/admin/teacher-activity');
        $response->assertStatus(403);

        $authorized = $this->createSupervisor(['teacher_activity.view']);
        $response = $this->actingAs($authorized)->getJson('/api/admin/teacher-activity');
        $response->assertStatus(200);

        // Explicit category=finance requires teacher_activity.view_financial
        $response = $this->actingAs($authorized)->getJson('/api/admin/teacher-activity?category=finance');
        $response->assertStatus(403);

        $financialSup = $this->createSupervisor(['teacher_activity.view', 'teacher_activity.view_financial']);
        $response = $this->actingAs($financialSup)->getJson('/api/admin/teacher-activity?category=finance');
        $response->assertStatus(200);

        // Sessions endpoint
        $response = $this->actingAs($unauthorized)->getJson('/api/admin/teacher-activity/sessions');
        $response->assertStatus(403);

        $sessionSup = $this->createSupervisor(['teacher_activity.view_sessions']);
        $response = $this->actingAs($sessionSup)->getJson('/api/admin/teacher-activity/sessions');
        $response->assertStatus(200);
    }

    public function test_platform_presence_endpoint_permissions(): void
    {
        $unauthorized = $this->createSupervisor(['courses.view']);
        $response = $this->actingAs($unauthorized)->getJson('/api/admin/platform/presence');
        $response->assertStatus(403);

        $authorized = $this->createSupervisor(['platform_presence.view']);
        $response = $this->actingAs($authorized)->getJson('/api/admin/platform/presence');
        $response->assertStatus(200);

        // Umbrella students.manage should also permit
        $umbrellaSup = $this->createSupervisor(['students.manage']);
        $response = $this->actingAs($umbrellaSup)->getJson('/api/admin/platform/presence');
        $response->assertStatus(200);
    }

    public function test_monthly_exams_and_exam_security_permissions(): void
    {
        $unauthorized = $this->createSupervisor(['courses.view']);
        $response = $this->actingAs($unauthorized)->getJson('/api/admin/monthly-exams');
        $response->assertStatus(403);

        $authorized = $this->createSupervisor(['monthly_exams.view']);
        $response = $this->actingAs($authorized)->getJson('/api/admin/monthly-exams');
        $response->assertStatus(200);

        // Unlock answers endpoint
        $response = $this->actingAs($authorized)->postJson('/api/admin/monthly-exams/attempts/999999/unlock-answers');
        $response->assertStatus(403);

        $unlockSup = $this->createSupervisor(['exam_security.unlock_answers']);
        // With unlock permission, authorization passes (reaches controller logic, returns 404 since attempt 999999 doesn't exist)
        $response = $this->actingAs($unlockSup)->postJson('/api/admin/monthly-exams/attempts/999999/unlock-answers');
        $this->assertNotEquals(403, $response->status());
    }

    public function test_academic_year_reset_authorization(): void
    {
        $unauthorized = $this->createSupervisor(['courses.view']);
        $response = $this->actingAs($unauthorized)->postJson('/api/admin/reset-year', [
            'confirmation' => 'RESET NEW ACADEMIC YEAR',
        ]);
        $response->assertStatus(403);

        // With academic_year.reset permission, route and controller authorization pass
        $resetSup = $this->createSupervisor(['academic_year.reset']);
        $response = $this->actingAs($resetSup)->postJson('/api/admin/reset-year', [
            'confirmation' => 'INVALID CONFIRMATION',
        ]);
        // 422 indicates permission passed and reached business validation
        $response->assertStatus(422);

        // With academic_year.initialize permission
        $initSup = $this->createSupervisor(['academic_year.initialize']);
        $response = $this->actingAs($initSup)->postJson('/api/admin/reset-year', [
            'confirmation' => 'INVALID CONFIRMATION',
        ]);
        $response->assertStatus(422);
    }

    public function test_teacher_activity_timeline_financial_event_filtering(): void
    {
        $teacher = $this->createTeacher();

        TeacherActivityLog::create([
            'teacher_id' => $teacher->id,
            'event_type' => 'course_revenue_earned',
            'event_name' => 'ربح دورة',
            'occurred_at' => now(),
        ]);

        TeacherActivityLog::create([
            'teacher_id' => $teacher->id,
            'event_type' => 'lesson_created',
            'event_name' => 'إنشاء درس',
            'occurred_at' => now(),
        ]);

        // Supervisor without financial permission
        $viewOnlySup = $this->createSupervisor(['teacher_activity.view']);
        $response = $this->actingAs($viewOnlySup)->getJson("/api/admin/teachers/{$teacher->id}/activity");
        $response->assertStatus(200);
        $timelineTypes = collect($response->json('timeline.data'))->pluck('event_type')->toArray();
        $this->assertNotContains('course_revenue_earned', $timelineTypes);
        $this->assertContains('lesson_created', $timelineTypes);

        // Supervisor with financial permission
        $financialSup = $this->createSupervisor(['teacher_activity.view', 'teacher_activity.view_financial']);
        $response = $this->actingAs($financialSup)->getJson("/api/admin/teachers/{$teacher->id}/activity");
        $response->assertStatus(200);
        $timelineTypes = collect($response->json('timeline.data'))->pluck('event_type')->toArray();
        $this->assertContains('course_revenue_earned', $timelineTypes);
        $this->assertContains('lesson_created', $timelineTypes);
    }

    public function test_student_security_events_permission(): void
    {
        $student = $this->createStudent();

        $unauthorized = $this->createSupervisor(['student_activity.view']);
        $response = $this->actingAs($unauthorized)->getJson("/api/admin/students/{$student->id}/security-events");
        $response->assertStatus(403);

        $authorized = $this->createSupervisor(['student_activity.view_security']);
        $response = $this->actingAs($authorized)->getJson("/api/admin/students/{$student->id}/security-events");
        $response->assertStatus(200);
    }

    public function test_super_admin_has_unrestricted_access(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin ' . uniqid(),
            'email' => 'super_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);

        $this->actingAs($superAdmin)->getJson('/api/admin/student-activity')->assertStatus(200);
        $this->actingAs($superAdmin)->getJson('/api/admin/teacher-activity')->assertStatus(200);
        $this->actingAs($superAdmin)->getJson('/api/admin/platform/presence')->assertStatus(200);
        $this->actingAs($superAdmin)->getJson('/api/admin/monthly-exams')->assertStatus(200);
    }
}
