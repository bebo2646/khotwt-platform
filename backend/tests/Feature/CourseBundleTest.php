<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Enrollment;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;

class CourseBundleTest extends TestCase
{
    use DatabaseTransactions;

    private $teacher;
    private $course1;
    private $course2;
    private $bundleCourse;
    private $lesson1;
    private $lesson2;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Create Teacher
        $this->teacher = User::create([
            'name' => 'Teacher Bundle Test',
            'email' => 'teacher_bundle_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary']
        ]);

        $plan = \App\Models\SubscriptionPlan::firstOrCreate(['name' => 'Starter'], [
            'price' => 0,
            'max_students' => 1000,
            'max_storage_bytes' => 1000000000,
            'max_courses' => 100,
            'max_codes' => 1000,
        ]);

        \App\Models\TeacherSubscription::create([
            'teacher_id' => $this->teacher->id,
            'plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(365)->toDateString(),
            'status' => 'Active',
            'used_storage_bytes' => 0,
            'used_codes' => 0,
            'billing_period' => 'monthly',
        ]);

        // 2. Create Course 1 (50 EGP)
        $this->course1 = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Course 1 Standalone',
            'price' => 50.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $unit1 = Unit::create([
            'course_id' => $this->course1->id,
            'title' => 'Unit 1 of Course 1',
            'order' => 1,
        ]);

        $this->lesson1 = Lesson::create([
            'unit_id' => $unit1->id,
            'title' => 'Lesson 1',
            'order' => 1,
        ]);

        Video::create([
            'lesson_id' => $this->lesson1->id,
            'title' => 'Video 1',
            'video_url' => 'https://example.com/video1.mp4',
            'duration_seconds' => 600,
        ]);

        // 3. Create Course 2 (50 EGP)
        $this->course2 = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Course 2 Standalone',
            'price' => 50.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $unit2 = Unit::create([
            'course_id' => $this->course2->id,
            'title' => 'Unit 1 of Course 2',
            'order' => 1,
        ]);

        $this->lesson2 = Lesson::create([
            'unit_id' => $unit2->id,
            'title' => 'Lesson 2',
            'order' => 1,
        ]);

        Video::create([
            'lesson_id' => $this->lesson2->id,
            'title' => 'Video 2',
            'video_url' => 'https://example.com/video2.mp4',
            'duration_seconds' => 700,
        ]);

        // 4. Create Bundle: Course 1 + Course 2 (80 EGP)
        $this->bundleCourse = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Bundle: Course 1 + Course 2',
            'price' => 80.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => true,
        ]);

        DB::table('course_bundle_items')->insert([
            ['parent_id' => $this->bundleCourse->id, 'child_id' => $this->course1->id, 'created_at' => now(), 'updated_at' => now()],
            ['parent_id' => $this->bundleCourse->id, 'child_id' => $this->course2->id, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function test_catalog_shows_bundle_with_aggregated_counts_and_savings(): void
    {
        $response = $this->getJson('/api/courses');
        $response->assertStatus(200);

        $courses = collect($response->json());
        $bundleItem = $courses->firstWhere('id', $this->bundleCourse->id);

        $this->assertNotNull($bundleItem, 'Bundle course should be present in public catalog');
        $this->assertEquals(80.00, (float)$bundleItem['final_price']);
        $this->assertEquals(2, $bundleItem['units_count'], 'Bundle units count should be aggregated from children');
        $this->assertEquals(2, $bundleItem['lessons_count'], 'Bundle lessons count should be aggregated from children');
        $this->assertEquals(100.00, (float)$bundleItem['bundle_original_price'], 'Original price should be 50 + 50 = 100');
        $this->assertEquals(20.00, (float)$bundleItem['bundle_savings'], 'Savings should be 100 - 80 = 20');
    }

    public function test_purchasing_bundle_creates_single_bundle_enrollment_and_keeps_standalone_courses_unpurchased(): void
    {
        $student = User::create([
            'name' => 'Student Bundle Buyer',
            'email' => 'student_bundle_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        $wallet = Wallet::create([
            'student_id' => $student->id,
        ]);
        \App\Models\WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'type' => 'recharge',
            'amount' => 100.00,
            'description' => 'Test recharge',
        ]);

        // Student purchases the Bundle
        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/courses/{$this->bundleCourse->id}/subscribe", [
                'payment_method' => 'wallet'
            ]);

        $response->assertStatus(200);

        // Check enrollment in database
        $studentEnrollments = Enrollment::where('student_id', $student->id)->get();
        $this->assertCount(1, $studentEnrollments, 'Exactly ONE enrollment record should exist for the student');
        $this->assertEquals($this->bundleCourse->id, $studentEnrollments->first()->course_id, 'Enrollment must be for the bundle course');

        // Check Course 1 standalone page - MUST BE LOCKED
        $c1Response = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$this->course1->id}");
        $c1Response->assertStatus(200);
        $this->assertFalse($c1Response->json('is_enrolled'), 'Student should NOT be enrolled in standalone Course 1');
        $c1Units = $c1Response->json('units');
        $this->assertTrue($c1Units[0]['lessons'][0]['is_locked'], 'Course 1 lessons must remain locked on standalone course page');

        // Check Course 2 standalone page - MUST BE LOCKED
        $c2Response = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$this->course2->id}");
        $c2Response->assertStatus(200);
        $this->assertFalse($c2Response->json('is_enrolled'), 'Student should NOT be enrolled in standalone Course 2');

        // Check Bundle page - MUST BE ENROLLED AND UNLOCKED
        $bundleResponse = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$this->bundleCourse->id}");
        $bundleResponse->assertStatus(200);
        $this->assertTrue($bundleResponse->json('is_enrolled'), 'Student MUST be enrolled in the bundle course');
        $bundleUnits = $bundleResponse->json('units');
        $this->assertFalse($bundleUnits[0]['lessons'][0]['is_locked'], 'Lessons must be accessible under the bundle course');

        // Accessing lesson directly WITH bundle context -> GRANTED
        $lessonDetailBundle = $this->actingAs($student, 'sanctum')
            ->getJson("/api/student/lessons/{$this->lesson1->id}?course_id={$this->bundleCourse->id}");
        $lessonDetailBundle->assertStatus(200);

        // Accessing lesson directly WITHOUT bundle context (standalone) -> 403 FORBIDDEN
        $lessonDetailStandalone = $this->actingAs($student, 'sanctum')
            ->getJson("/api/student/lessons/{$this->lesson1->id}?course_id={$this->course1->id}");
        $lessonDetailStandalone->assertStatus(403);
    }

    public function test_purchasing_single_course_only_unlocks_that_course(): void
    {
        $student = User::create([
            'name' => 'Student Single Buyer',
            'email' => 'student_single_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        $wallet = Wallet::create([
            'student_id' => $student->id,
        ]);
        \App\Models\WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'type' => 'recharge',
            'amount' => 100.00,
            'description' => 'Test recharge',
        ]);

        // Student purchases Course 1 only
        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/courses/{$this->course1->id}/subscribe", [
                'payment_method' => 'wallet'
            ]);
        $response->assertStatus(200);

        // Course 1 is enrolled and unlocked
        $c1Response = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$this->course1->id}");
        $c1Response->assertStatus(200);
        $this->assertTrue($c1Response->json('is_enrolled'));

        // Course 2 is NOT enrolled and locked
        $c2Response = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$this->course2->id}");
        $c2Response->assertStatus(200);
        $this->assertFalse($c2Response->json('is_enrolled'));

        // Bundle is NOT enrolled and locked
        $bundleResponse = $this->actingAs($student, 'sanctum')->getJson("/api/courses/{$this->bundleCourse->id}");
        $bundleResponse->assertStatus(200);
        $this->assertFalse($bundleResponse->json('is_enrolled'));
    }

    public function test_enrolled_courses_endpoint_returns_bundle_metadata(): void
    {
        $student = User::create([
            'name' => 'Student Enrolled Tester',
            'email' => 'student_enrolled_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $this->bundleCourse->id,
            'enrolled_at' => now(),
        ]);

        $response = $this->actingAs($student, 'sanctum')->getJson('/api/student/courses');
        $response->assertStatus(200);

        $enrolled = $response->json();
        $this->assertCount(1, $enrolled);
        $this->assertEquals('bundle', $enrolled[0]['product_type']);
        $this->assertTrue($enrolled[0]['is_bundle']);
        $this->assertEquals($this->bundleCourse->id, $enrolled[0]['course']['id']);
    }

    public function test_bundle_appears_in_catalog_when_filtering_by_child_grade(): void
    {
        // Bundle has grade = 'باقة مجمعة', but children have grade = 'first_secondary'
        $this->bundleCourse->update(['grade' => 'باقة مجمعة']);

        $response = $this->getJson('/api/courses?grade=first_secondary');
        $response->assertStatus(200);

        $courses = collect($response->json());
        $bundleItem = $courses->firstWhere('id', $this->bundleCourse->id);
        $this->assertNotNull($bundleItem, 'Bundle course must appear when filtering by its children grade');
    }
}
