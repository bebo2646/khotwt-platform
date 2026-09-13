<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\TeacherSession;
use App\Models\TeacherActivityLog;
use App\Models\StudentSession;
use App\Services\TeacherActivityService;
use App\Services\StudentActivityService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Carbon\Carbon;

class TeacherActivityTest extends TestCase
{
    use DatabaseTransactions;

    protected function createTeacher(): User
    {
        return User::create([
            'name' => 'Prof Teacher ' . uniqid(),
            'email' => 'teacher_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
        ]);
    }

    protected function createStudent(): User
    {
        return User::create([
            'name' => 'Student ' . uniqid(),
            'email' => 'student_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'student',
            'status' => 'active',
        ]);
    }

    protected function createAdmin(): User
    {
        return User::create([
            'name' => 'Super Admin ' . uniqid(),
            'email' => 'admin_' . uniqid() . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);
    }

    public function test_teacher_login_creates_active_session_and_activity_log(): void
    {
        $teacher = $this->createTeacher();

        $response = $this->postJson('/api/login', [
            'identifier' => $teacher->email,
            'password' => 'password123',
        ]);

        $response->assertStatus(200);

        // Verify active session was created
        $session = TeacherSession::where('teacher_id', $teacher->id)->first();
        $this->assertNotNull($session);
        $this->assertTrue($session->is_active);

        // Verify activity logs created
        $logs = TeacherActivityLog::where('teacher_id', $teacher->id)->get();
        $this->assertGreaterThanOrEqual(1, $logs->count());
        $this->assertTrue($logs->contains('event_type', 'teacher_login'));
    }

    public function test_teacher_heartbeat_updates_current_action_and_page(): void
    {
        $teacher = $this->createTeacher();

        $response = $this->actingAs($teacher, 'sanctum')->postJson('/api/teacher/activity/heartbeat', [
            'current_page' => 'إدارة الكورسات',
            'current_action' => 'بيعدل كورس: الفيزياء الحديثة',
        ]);

        $response->assertStatus(200);
        $this->assertTrue($response->json('success'));

        $session = TeacherSession::where('teacher_id', $teacher->id)->latest('last_activity_at')->first();
        $this->assertNotNull($session);
        $this->assertEquals('إدارة الكورسات', $session->current_page);
        $this->assertEquals('بيعدل كورس: الفيزياء الحديثة', $session->current_action);
    }

    public function test_platform_presence_returns_unified_breakdown(): void
    {
        $admin = $this->createAdmin();
        $teacher = $this->createTeacher();
        $student = $this->createStudent();

        // Start active teacher session
        TeacherSession::create([
            'teacher_id' => $teacher->id,
            'session_identifier' => 't-sess-' . uniqid(),
            'current_page' => 'إدارة الكورسات',
            'current_action' => 'بيعدل كورس',
            'started_at' => now(),
            'last_activity_at' => now(),
            'is_active' => true,
            'duration_seconds' => 60,
        ]);

        // Start active student session
        StudentSession::create([
            'student_id' => $student->id,
            'session_identifier' => 's-sess-' . uniqid(),
            'started_at' => now(),
            'last_activity_at' => now(),
            'is_active' => true,
            'duration_seconds' => 120,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/platform/presence');

        $response->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $response->json('teachers_online'));
        $this->assertGreaterThanOrEqual(1, $response->json('students_online'));
        $this->assertGreaterThanOrEqual(2, $response->json('total_online'));

        $activeTeachers = $response->json('active_teachers');
        $this->assertNotEmpty($activeTeachers);
        $found = collect($activeTeachers)->firstWhere('teacher_id', $teacher->id);
        $this->assertNotNull($found);
        $this->assertEquals('بيعدل كورس', $found['current_action']);
    }

    public function test_teacher_course_creation_logs_activity(): void
    {
        $teacher = $this->createTeacher();

        $response = $this->actingAs($teacher, 'sanctum')->postJson('/api/teacher/courses', [
            'title' => 'كورس الفيزياء التجريبي',
            'description' => 'شرح منهج الفيزياء',
            'price' => 250,
            'grade' => 'ثانوي',
            'subject' => 'physics',
        ]);

        $response->assertStatus(201);
        $courseId = $response->json('id');

        $log = TeacherActivityLog::where('teacher_id', $teacher->id)
            ->where('event_type', 'course_created')
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($courseId, $log->course_id);
    }

    public function test_teacher_logout_ends_active_session(): void
    {
        $teacher = $this->createTeacher();

        TeacherSession::create([
            'teacher_id' => $teacher->id,
            'session_identifier' => 't-sess-logout-' . uniqid(),
            'started_at' => now()->subMinutes(10),
            'last_activity_at' => now(),
            'is_active' => true,
            'duration_seconds' => 600,
        ]);

        $response = $this->actingAs($teacher, 'sanctum')->postJson('/api/logout');
        $response->assertStatus(200);

        $session = TeacherSession::where('teacher_id', $teacher->id)->latest('last_activity_at')->first();
        $this->assertFalse($session->is_active);
        $this->assertNotNull($session->ended_at);
    }

    public function test_stale_teacher_session_is_not_counted_as_active_now(): void
    {
        $admin = $this->createAdmin();
        $teacher = $this->createTeacher();

        // Session last active 15 minutes ago (threshold is 5 minutes)
        TeacherSession::create([
            'teacher_id' => $teacher->id,
            'session_identifier' => 't-sess-stale-' . uniqid(),
            'started_at' => now()->subMinutes(20),
            'last_activity_at' => now()->subMinutes(15),
            'is_active' => true,
            'duration_seconds' => 300,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/platform/presence');
        $response->assertStatus(200);

        $activeTeachers = $response->json('active_teachers');
        $found = collect($activeTeachers)->firstWhere('teacher_id', $teacher->id);
        $this->assertNull($found, 'Stale teacher session must NOT appear in active now list');
    }

    public function test_teacher_cannot_access_admin_monitoring_endpoints(): void
    {
        $teacher = $this->createTeacher();

        $response = $this->actingAs($teacher, 'sanctum')->getJson('/api/admin/teacher-activity');
        $response->assertStatus(403);

        $response2 = $this->actingAs($teacher, 'sanctum')->getJson('/api/admin/platform/presence');
        $response2->assertStatus(403);
    }

    public function test_admin_can_fetch_teacher_activity_profile_with_contract_shape(): void
    {
        $admin = $this->createAdmin();
        $teacher = $this->createTeacher();

        // Create some activities
        TeacherActivityLog::create([
            'teacher_id' => $teacher->id,
            'event_type' => 'course_created',
            'event_name' => 'إنشاء كورس جديد',
            'description' => 'قام المعلم بإنشاء كورس تجريبي',
            'occurred_at' => now(),
        ]);

        // Create a session
        TeacherSession::create([
            'teacher_id' => $teacher->id,
            'session_identifier' => 't-sess-contract-' . uniqid(),
            'current_page' => 'لوحة التحكم',
            'current_action' => 'يتصفح المنصة',
            'started_at' => now()->subMinutes(10),
            'last_activity_at' => now(),
            'is_active' => true,
            'duration_seconds' => 600,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/teachers/{$teacher->id}/activity");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'teacher' => [
                'id',
                'name',
                'email',
                'is_online',
            ],
            'summary' => [
                'total_actions',
                'today_actions',
                'total_sessions',
                'courses_count',
                'exams_count',
                'videos_count',
            ],
            'recent_activities',
            'recent_sessions',
            'timeline',
        ]);

        $this->assertEquals($teacher->id, $response->json('teacher.id'));
        $this->assertEquals($teacher->name, $response->json('teacher.name'));
        $this->assertIsArray($response->json('recent_activities'));
        $this->assertIsArray($response->json('recent_sessions'));
        $this->assertGreaterThanOrEqual(1, count($response->json('recent_activities')));
        $this->assertGreaterThanOrEqual(1, count($response->json('recent_sessions')));
        $this->assertGreaterThanOrEqual(1, $response->json('summary.total_actions'));
    }

    public function test_admin_receives_404_for_nonexistent_teacher_activity(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/teachers/999999/activity');
        $response->assertStatus(404);
        $response->assertJsonFragment(['message' => 'المعلم غير موجود']);
    }

    public function test_admin_receives_valid_arrays_when_teacher_has_no_prior_activity(): void
    {
        $admin = $this->createAdmin();
        $teacher = $this->createTeacher();

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/teachers/{$teacher->id}/activity");

        $response->assertStatus(200);
        $this->assertIsArray($response->json('recent_activities'));
        $this->assertIsArray($response->json('recent_sessions'));
        $this->assertEquals(0, count($response->json('recent_activities')));
        $this->assertEquals(0, count($response->json('recent_sessions')));
        $this->assertEquals(0, $response->json('summary.total_actions'));
    }
}
