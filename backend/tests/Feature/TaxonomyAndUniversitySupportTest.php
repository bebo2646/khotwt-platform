<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Department;
use App\Models\AcademicStage;
use App\Models\AcademicGrade;
use App\Models\AcademicSubject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

class TaxonomyAndUniversitySupportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $teacher;
    private User $doctor;
    private User $schoolStudent;
    private User $uniStudent;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Create Super Admin
        $this->admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => true,
            'permissions' => ['settings.manage', 'teachers.manage', 'courses.manage'],
        ]);

        // 2. Create Active Subscription Plan & Settings for testing teacher subscriptions
        \Illuminate\Support\Facades\DB::table('subscription_settings')->insertOrIgnore([
            ['key' => 'discount_semi_annually', 'value' => '10.0', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'discount_annually', 'value' => '20.0', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 3. Find or Create School Stages & Grades
        $stageSecondary = AcademicStage::firstOrCreate(
            ['slug' => 'secondary'],
            [
                'name' => 'المرحلة الثانوية',
                'sector' => 'school',
                'order' => 1,
                'is_active' => true,
            ]
        );

        AcademicGrade::firstOrCreate(
            ['slug' => 'third_secondary'],
            [
                'stage_id' => $stageSecondary->id,
                'name' => 'الصف الثالث الثانوي',
                'short_code' => '3SEC',
                'level_type' => 'grade',
                'order' => 3,
                'is_active' => true,
            ]
        );

        // 4. Find or Create University Faculty & Bands
        $facultyCommerce = AcademicStage::firstOrCreate(
            ['slug' => 'commerce'],
            [
                'name' => 'كلية التجارة',
                'sector' => 'university',
                'order' => 10,
                'is_active' => true,
            ]
        );

        $bandOne = AcademicGrade::firstOrCreate(
            ['slug' => 'first_year_commerce'],
            [
                'stage_id' => $facultyCommerce->id,
                'name' => 'الفرقة الأولى',
                'short_code' => 'Y1',
                'level_type' => 'university_year',
                'order' => 1,
                'is_active' => true,
            ]
        );

        // 5. Create School Teacher & University Doctor
        $this->teacher = User::factory()->create([
            'name' => 'أستاذ محمد أحمد',
            'role' => 'teacher',
            'subject' => 'chemistry',
            'category' => 'school',
            'grades' => ['third_secondary'],
            'phone' => '01011112222',
            'status' => 'active',
        ]);

        $this->doctor = User::factory()->create([
            'name' => 'دكتور مصطفى كمال',
            'role' => 'teacher',
            'subject' => 'accounting',
            'category' => 'university',
            'grades' => ['first_year_commerce'],
            'phone' => '01033334444',
            'status' => 'active',
        ]);

        // 6. Create School and University Students
        $this->schoolStudent = User::factory()->create([
            'name' => 'طالب ثانوي',
            'role' => 'student',
            'grades' => ['third_secondary'],
            'status' => 'active',
        ]);

        $this->uniStudent = User::factory()->create([
            'name' => 'طالب جامعي',
            'role' => 'student',
            'grades' => ['first_year_commerce'],
            'status' => 'active',
        ]);
    }

    public function test_admin_can_crud_academic_subjects()
    {
        $faculty = AcademicStage::where('slug', 'commerce')->first();
        $band = AcademicGrade::where('slug', 'first_year_commerce')->first();

        // 1. Create Subject
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/academic-subjects', [
            'name' => 'المحاسبة المالية',
            'slug' => 'financial_accounting',
            'sector' => 'university',
            'stage_id' => $faculty->id,
            'grade_id' => $band->id,
            'is_active' => true,
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('academic_subjects', [
            'slug' => 'financial_accounting',
            'sector' => 'university',
            'stage_id' => $faculty->id,
            'grade_id' => $band->id,
        ]);

        $subjId = $res->json('subject.id');

        // 2. Update Subject
        $updateRes = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/academic-subjects/{$subjId}", [
            'name' => 'مبادئ المحاسبة المالية المتقدمة',
            'slug' => 'financial_accounting',
            'sector' => 'university',
            'stage_id' => $faculty->id,
            'grade_id' => $band->id,
            'is_active' => true,
        ]);

        $updateRes->assertStatus(200);
        $this->assertDatabaseHas('academic_subjects', [
            'id' => $subjId,
            'name' => 'مبادئ المحاسبة المالية المتقدمة',
        ]);

        // 3. Toggle Status
        $toggleRes = $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/academic-subjects/{$subjId}/toggle");
        $toggleRes->assertStatus(200);
        $this->assertDatabaseHas('academic_subjects', [
            'id' => $subjId,
            'is_active' => false,
        ]);

        // 4. Delete Subject (when not in use)
        $deleteRes = $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/admin/academic-subjects/{$subjId}");
        $deleteRes->assertStatus(200);
        $this->assertDatabaseMissing('academic_subjects', ['id' => $subjId]);
    }

    public function test_cannot_delete_subject_in_use_by_course()
    {
        $subject = AcademicSubject::create([
            'name' => 'إدارة أعمال',
            'slug' => 'business_admin',
            'sector' => 'university',
            'is_active' => true,
        ]);

        // Create course referencing this subject
        Course::create([
            'teacher_id' => $this->doctor->id,
            'title' => 'كورس إدارة الأعمال الحديثة',
            'description' => 'وصف تجريبي',
            'price' => 100,
            'grade' => 'first_year_commerce',
            'subject' => 'business_admin',
            'category' => 'university',
            'is_published' => true,
        ]);

        $res = $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/admin/academic-subjects/{$subject->id}");
        $res->assertStatus(422);
        $this->assertDatabaseHas('academic_subjects', ['id' => $subject->id]);
    }

    public function test_admin_can_create_university_doctor_and_school_teacher()
    {
        // 1. Create School Teacher
        $schoolRes = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'أحمد إبراهيم منصور',
            'phone' => '01099887766',
            'subject' => 'physics',
            'category' => 'school',
            'experience' => '8 سنوات تدريس',
            'grades' => ['third_secondary'],
            'teaching_mode' => 'online',
        ]);
        $schoolRes->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'phone' => '01099887766',
            'category' => 'school',
            'role' => 'teacher',
        ]);

        // 2. Create University Doctor
        $uniRes = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'دكتور عبد الرحمن السعيد',
            'phone' => '01122334455',
            'subject' => 'corporate_finance',
            'category' => 'university',
            'experience' => 'أستاذ دكتور بالجامعة',
            'grades' => ['first_year_commerce'],
            'teaching_mode' => 'both',
        ]);
        $uniRes->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'phone' => '01122334455',
            'category' => 'university',
            'role' => 'teacher',
        ]);
    }

    public function test_teacher_creation_rejects_inactive_or_invalid_grades()
    {
        $res = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'معلم ذو صف غير موجود',
            'phone' => '01511223344',
            'subject' => 'math',
            'category' => 'school',
            'experience' => '3 سنوات',
            'grades' => ['non_existent_grade_slug'],
            'teaching_mode' => 'online',
        ]);

        $res->assertStatus(422);
        $res->assertJsonFragment(['invalid_grades' => ['non_existent_grade_slug']]);
    }

    public function test_course_content_is_relationally_linked_without_filesystem_folders()
    {
        // 1. Create University Course
        $course = Course::create([
            'teacher_id' => $this->doctor->id,
            'title' => 'مبادئ المحاسبة 1',
            'description' => 'كورس الفرقة الأولى كلية التجارة',
            'price' => 50,
            'grade' => 'first_year_commerce',
            'subject' => 'accounting',
            'category' => 'university',
            'is_published' => true,
        ]);

        // 2. Add Unit
        $unit = Unit::create([
            'course_id' => $course->id,
            'title' => 'الوحدة الأولى: القوائم المالية',
            'order' => 1,
        ]);

        // 3. Add Lesson
        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'الدرس الأول: قائمة الدخل',
            'order' => 1,
        ]);

        // 4. Assert Relations
        $this->assertEquals($course->id, $unit->course_id);
        $this->assertEquals($unit->id, $lesson->unit_id);
        $this->assertEquals('first_year_commerce', $lesson->unit->course->grade);
        $this->assertEquals('university', $lesson->unit->course->category);

        // 5. Update course category or grade and ensure no content is orphaned
        $course->update(['grade' => 'first_year_commerce', 'category' => 'university']);
        $lesson->refresh();
        $this->assertEquals($unit->id, $lesson->unit_id);
        $this->assertEquals($course->id, $lesson->unit->course_id);
    }

    public function test_student_dashboard_recommends_correct_courses_and_filters_latest_7_days()
    {
        // Course 1: Created 2 days ago (within 7 days) -> should be in latest
        $recentCourse = Course::create([
            'teacher_id' => $this->doctor->id,
            'title' => 'كورس حديث جداً',
            'description' => 'منشور منذ يومين',
            'price' => 100,
            'grade' => 'first_year_commerce',
            'subject' => 'accounting',
            'category' => 'university',
            'is_published' => true,
            'created_at' => Carbon::now()->subDays(2),
        ]);

        // Course 2: Created 15 days ago -> should NOT be in latest, but in recommendations if grade matches
        $oldCourse = Course::create([
            'teacher_id' => $this->doctor->id,
            'title' => 'كورس قديم',
            'description' => 'منشور منذ 15 يوماً',
            'price' => 80,
            'grade' => 'first_year_commerce',
            'subject' => 'accounting',
            'category' => 'university',
            'is_published' => true,
        ]);
        \Illuminate\Support\Facades\DB::table('courses')->where('id', $oldCourse->id)->update([
            'created_at' => Carbon::now()->subDays(15),
            'last_content_updated_at' => Carbon::now()->subDays(15),
        ]);

        // Course 3: School Course for 3rd Secondary
        $schoolCourse = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'كيمياء الثانوية العامة',
            'description' => 'للصف الثالث الثانوي',
            'price' => 120,
            'grade' => 'third_secondary',
            'subject' => 'chemistry',
            'category' => 'school',
            'is_published' => true,
            'created_at' => Carbon::now()->subDays(1),
        ]);

        // Test University Student recommendations
        $uniResponse = $this->actingAs($this->uniStudent, 'sanctum')->getJson('/api/student/recommended-courses');
        $uniResponse->assertStatus(200);

        $uniLatest = collect($uniResponse->json('latest'));
        $uniRec = collect($uniResponse->json('recommended'));

        // Latest should contain recentCourse and schoolCourse, but NOT oldCourse
        $this->assertTrue($uniLatest->contains('id', $recentCourse->id));
        $this->assertTrue($uniLatest->contains('id', $schoolCourse->id));
        $this->assertFalse($uniLatest->contains('id', $oldCourse->id));

        // Recommendations for university student should contain both uni courses (matching their band)
        $this->assertTrue($uniRec->contains('id', $recentCourse->id));
        $this->assertTrue($uniRec->contains('id', $oldCourse->id));
        // Recommendations should NOT contain schoolCourse
        $this->assertFalse($uniRec->contains('id', $schoolCourse->id));
    }

    public function test_student_without_grade_gets_fallback_recommendations_safely()
    {
        $unassignedStudent = User::factory()->create([
            'name' => 'طالب جديد بدون صف',
            'role' => 'student',
            'grades' => [],
            'status' => 'active',
        ]);

        $response = $this->actingAs($unassignedStudent, 'sanctum')->getJson('/api/student/recommended-courses');
        $response->assertStatus(200);
        $this->assertIsArray($response->json('recommended'));
        $this->assertIsArray($response->json('latest'));
    }

    public function test_unauthorized_user_cannot_access_taxonomy_admin_endpoints()
    {
        // Student cannot access admin subjects
        $studentRes = $this->actingAs($this->schoolStudent, 'sanctum')->getJson('/api/admin/academic-subjects');
        $studentRes->assertStatus(403);

        // Teacher cannot create subjects
        $teacherRes = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/admin/academic-subjects', [
            'name' => 'مادة غير مصرح بها',
        ]);
        $teacherRes->assertStatus(403);
    }
}
