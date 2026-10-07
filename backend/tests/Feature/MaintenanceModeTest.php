<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\PlatformSetting;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class MaintenanceModeTest extends TestCase
{
    use DatabaseTransactions;

    private User $superAdmin;
    private User $regularAdmin;
    private User $teacher;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::create([
            'name' => 'Super Admin Test',
            'email' => 'superadmin_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'is_super' => true,
            'status' => 'active',
        ]);

        $this->regularAdmin = User::create([
            'name' => 'Regular Admin Test',
            'email' => 'regadmin_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => false,
            'is_super' => false,
            'permissions' => ['settings.manage', 'dashboard.view'],
            'status' => 'active',
        ]);

        $this->teacher = User::create([
            'name' => 'Teacher Maintenance Test',
            'email' => 'teacher_maint_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['first_secondary'],
        ]);

        $this->student = User::create([
            'name' => 'Student Maintenance Test',
            'email' => 'student_maint_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
            'phone' => '010' . rand(10000000, 99999999),
            'parent_phone' => '011' . rand(10000000, 99999999),
            'student_type' => 'online',
            'grades' => ['first_secondary'],
        ]);
    }

    private function setMaintenance(bool $enabled, string $msg = 'صيانة دورية', string $eta = 'ساعة واحدة')
    {
        $setting = PlatformSetting::first();
        if (!$setting) {
            $setting = new PlatformSetting();
        }
        $setting->maintenance_mode = $enabled;
        $setting->maintenance_message = $msg;
        $setting->maintenance_eta = $eta;
        $setting->save();
    }

    public function test_config_endpoint_reports_maintenance_status(): void
    {
        $this->setMaintenance(true, 'تحديثات هامة', '30 دقيقة');

        $res = $this->getJson('/api/config');
        $res->assertStatus(200);
        $res->assertJson([
            'maintenance' => true,
            'maintenance_message' => 'تحديثات هامة',
            'maintenance_eta' => '30 دقيقة',
        ]);

        $this->setMaintenance(false);
        $resOff = $this->getJson('/api/config');
        $resOff->assertStatus(200);
        $resOff->assertJson([
            'maintenance' => false,
        ]);
    }

    public function test_student_and_teacher_are_blocked_during_maintenance(): void
    {
        $this->setMaintenance(true);

        // Authenticated student request
        $studentRes = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/dashboard');
        $studentRes->assertStatus(503);
        $studentRes->assertJson([
            'maintenance' => true,
        ]);

        // Authenticated teacher request
        $teacherRes = $this->actingAs($this->teacher, 'sanctum')
            ->getJson('/api/teacher/dashboard');
        $teacherRes->assertStatus(503);
        $teacherRes->assertJson([
            'maintenance' => true,
        ]);
    }

    public function test_regular_admin_and_super_admin_bypass_maintenance_mode(): void
    {
        $this->setMaintenance(true);

        // Super Admin request
        $superRes = $this->actingAs($this->superAdmin, 'sanctum')
            ->getJson('/api/admin/dashboard');
        $superRes->assertStatus(200);

        // Regular Admin request
        $adminRes = $this->actingAs($this->regularAdmin, 'sanctum')
            ->getJson('/api/admin/dashboard');
        $adminRes->assertStatus(200);
    }

    public function test_student_and_teacher_login_blocked_during_maintenance(): void
    {
        $this->setMaintenance(true);

        // Student Login
        $studentLogin = $this->postJson('/api/login', [
            'identifier' => $this->student->email,
            'password' => 'password123',
        ]);
        $studentLogin->assertStatus(503);
        $studentLogin->assertJson([
            'maintenance' => true,
        ]);

        // Teacher Login
        $teacherLogin = $this->postJson('/api/login', [
            'identifier' => $this->teacher->email,
            'password' => 'password123',
        ]);
        $teacherLogin->assertStatus(503);
        $teacherLogin->assertJson([
            'maintenance' => true,
        ]);
    }

    public function test_admin_can_login_during_maintenance(): void
    {
        $this->setMaintenance(true);

        // Admin login succeeds
        $adminLogin = $this->postJson('/api/login', [
            'identifier' => $this->regularAdmin->email,
            'password' => 'password123',
        ]);
        $adminLogin->assertStatus(200);
        $adminLogin->assertJsonStructure(['user', 'token']);
    }

    public function test_student_registration_blocked_during_maintenance(): void
    {
        $this->setMaintenance(true);

        $regRes = $this->postJson('/api/register', [
            'name' => 'New Student Maint',
            'email' => 'new_student_' . uniqid() . '@test.com',
            'password' => 'password123',
            'phone' => '010' . rand(10000000, 99999999),
            'parent_phone' => '011' . rand(10000000, 99999999),
            'grade' => 'first_secondary',
            'student_type' => 'online',
        ]);

        $regRes->assertStatus(503);
        $regRes->assertJson([
            'maintenance' => true,
        ]);
    }

    public function test_super_admin_can_toggle_maintenance_settings(): void
    {
        $this->setMaintenance(false);

        $toggleOn = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/admin/maintenance-settings', [
                'maintenance_mode' => true,
                'maintenance_message' => 'إغلاق مؤقت للصيانة الفنية',
                'maintenance_eta' => 'ساعتان',
            ]);

        $toggleOn->assertStatus(200);

        $setting = PlatformSetting::first();
        $this->assertTrue((bool)$setting->maintenance_mode);
        $this->assertEquals('إغلاق مؤقت للصيانة الفنية', $setting->maintenance_message);

        $toggleOff = $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/admin/maintenance-settings', [
                'maintenance_mode' => false,
                'maintenance_message' => '',
                'maintenance_eta' => '',
            ]);

        $toggleOff->assertStatus(200);
        $setting->refresh();
        $this->assertFalse((bool)$setting->maintenance_mode);
    }
}
