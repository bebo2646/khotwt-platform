<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Enrollment;
use App\Models\VideoProgress;
use App\Models\StudentCourseViewLimit;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class StandaloneCourseViewLimitTest extends TestCase
{
    use DatabaseTransactions;

    public function test_standalone_course_does_not_inherit_bundle_view_history(): void
    {
        // 1. Create a Teacher
        $teacher = User::create([
            'name' => 'Teacher Test',
            'email' => 'teacher_test_limit_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary']
        ]);

        // 2. Create a Student
        $student = User::create([
            'name' => 'Student Test',
            'email' => 'student_test_limit_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        // 3. Create standalone Course #1
        $course1 = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course 1 Standalone',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => false,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // 4. Create Bundle Course
        $bundleCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Bundle Course',
            'price' => 250.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => true,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // Link Course #1 to Bundle
        $bundleCourse->childCourses()->attach($course1->id);

        // 5. Create Unit, Lesson, and Video in Course #1
        $unit = Unit::create([
            'course_id' => $course1->id,
            'title' => 'Unit 1',
            'order' => 1
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson 1',
            'order' => 1
        ]);

        $video = Video::create([
            'lesson_id' => $lesson->id,
            'title' => 'Video 1',
            'bunny_stream_id' => 'bunny_123',
            'duration_seconds' => 100
        ]);

        // 6. Setup enrollments
        // Enrolled in Course #1 standalone
        $standaloneEnrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course1->id,
            'enrolled_at' => now()
        ]);

        // Enrolled in Bundle
        $bundleEnrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $bundleCourse->id,
            'enrolled_at' => now()
        ]);

        // 7. Record view history under the Bundle context
        VideoProgress::create([
            'student_id' => $student->id,
            'video_id' => $video->id,
            'course_id' => $bundleCourse->id,
            'package_id' => null,
            'lesson_id' => $lesson->id,
            'watched_seconds' => 95,
            'watched_percentage' => 95.0,
            'completed' => true,
            'views_count' => 1,
            'watched_segments' => []
        ]);

        StudentCourseViewLimit::create([
            'student_id' => $student->id,
            'course_id' => $bundleCourse->id,
            'views_used' => 1
        ]);

        // 8. Assert Course #1 detail page does NOT inherit view history
        $response = $this->actingAs($student)
             ->getJson("/api/courses/{$course1->id}");

        $response->assertStatus(200);
        $data = $response->json();

        // Check view limit details for Course #1
        $this->assertEquals(0, $data['view_limit_details']['views_used']);
        $this->assertEquals(3, $data['view_limit_details']['remaining_views']);

        // Check video-specific views
        $videos = $data['units'][0]['lessons'][0]['videos'];
        $this->assertEquals(0, $videos[0]['progress']['views_used']);
        $this->assertEquals(3, $videos[0]['progress']['views_remaining']);
    }

    public function test_playback_progress_updates_correct_context(): void
    {
        // 1. Create a Teacher
        $teacher = User::create([
            'name' => 'Teacher Test 2',
            'email' => 'teacher_test_limit2_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary']
        ]);

        // 2. Create a Student
        $student = User::create([
            'name' => 'Student Test 2',
            'email' => 'student_test_limit2_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        // 3. Create standalone Course #1
        $course1 = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course 1 Standalone 2',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => false,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // 4. Create Bundle Course
        $bundleCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Bundle Course 2',
            'price' => 250.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => true,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // Link Course #1 to Bundle
        $bundleCourse->childCourses()->attach($course1->id);

        // 5. Create Unit, Lesson, and Video in Course #1
        $unit = Unit::create([
            'course_id' => $course1->id,
            'title' => 'Unit 1',
            'order' => 1
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson 1',
            'order' => 1
        ]);

        $video = Video::create([
            'lesson_id' => $lesson->id,
            'title' => 'Video 1',
            'bunny_stream_id' => 'bunny_123',
            'duration_seconds' => 1000
        ]);

        // 6. Setup enrollment (Bundle enrollment ONLY at first)
        $bundleEnrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $bundleCourse->id,
            'enrolled_at' => now()
        ]);

        // 7. Update progress under the Bundle context (simulate watching video in bundle)
        // Set up video threshold configuration (say 300 seconds)
        \App\Models\PlatformSetting::updateOrCreate([], [
            'view_limit_enabled' => true,
            'default_max_views' => 3,
            'video_threshold_seconds' => 300,
        ]);

        // Post progress under bundle context by passing course_id = BundleCourseId
        $response = $this->actingAs($student)
             ->postJson("/api/videos/{$video->id}/progress", [
                 'watched_seconds' => 400,
                 'last_position_seconds' => 400,
                 'watched_segments' => [[0, 400]],
                 'session_id' => 'bundle_session_1',
                 'session_watch_time' => 400,
                 'course_id' => $bundleCourse->id
             ]);

        $response->assertStatus(200);

        // Assert progress record was created under the bundle course ID
        $bundleProgress = VideoProgress::where('student_id', $student->id)
            ->where('video_id', $video->id)
            ->where('course_id', $bundleCourse->id)
            ->first();
        $this->assertNotNull($bundleProgress);
        $this->assertEquals(1, $bundleProgress->views_count);

        // Assert views_used was incremented on bundle limit record
        $bundleLimit = StudentCourseViewLimit::where('student_id', $student->id)
            ->where('course_id', $bundleCourse->id)
            ->first();
        $this->assertNotNull($bundleLimit);
        $this->assertEquals(1, $bundleLimit->views_used);

        // 8. Now purchase Standalone Course #1
        $standaloneEnrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course1->id,
            'enrolled_at' => now()
        ]);

        // Assert standalone course #1 page does NOT inherit view history
        $responseCourse1 = $this->actingAs($student)
             ->getJson("/api/courses/{$course1->id}");

        $responseCourse1->assertStatus(200);
        $dataCourse1 = $responseCourse1->json();

        // Check view limit details for Course #1 (should be 0 views used!)
        $this->assertEquals(0, $dataCourse1['view_limit_details']['views_used']);
        $this->assertEquals(3, $dataCourse1['view_limit_details']['remaining_views']);

        // Check video-specific views (should be 0 views used!)
        $videosCourse1 = $dataCourse1['units'][0]['lessons'][0]['videos'];
        $this->assertEquals(0, $videosCourse1[0]['progress']['views_used']);
        $this->assertEquals(3, $videosCourse1[0]['progress']['views_remaining']);

        // 9. Now update progress under standalone context by passing course_id = Course1Id
        $response2 = $this->actingAs($student)
             ->postJson("/api/videos/{$video->id}/progress", [
                 'watched_seconds' => 500,
                 'last_position_seconds' => 500,
                 'watched_segments' => [[0, 500]],
                 'session_id' => 'standalone_session_1',
                 'session_watch_time' => 500,
                 'course_id' => $course1->id
             ]);

        $response2->assertStatus(200);

        // Assert progress record was created under the standalone course ID separately
        $standaloneProgress = VideoProgress::where('student_id', $student->id)
            ->where('video_id', $video->id)
            ->where('course_id', $course1->id)
            ->first();
        $this->assertNotNull($standaloneProgress);
        $this->assertEquals(1, $standaloneProgress->views_count);

        // Assert views_used was incremented on standalone limit record
        $standaloneLimit = StudentCourseViewLimit::where('student_id', $student->id)
            ->where('course_id', $course1->id)
            ->first();
        $this->assertNotNull($standaloneLimit);
        $this->assertEquals(1, $standaloneLimit->views_used);

        // Assert bundle progress and limit remain separate and unchanged
        $bundleProgressAfter = VideoProgress::where('student_id', $student->id)
            ->where('video_id', $video->id)
            ->where('course_id', $bundleCourse->id)
            ->first();
        $this->assertEquals(1, $bundleProgressAfter->views_count);
        
        $bundleLimitAfter = StudentCourseViewLimit::where('student_id', $student->id)
            ->where('course_id', $bundleCourse->id)
            ->first();
        $this->assertEquals(1, $bundleLimitAfter->views_used);
    }

    public function test_dashboard_isolates_progress_and_continue_learning_under_both_enrollments(): void
    {
        // 1. Create a Teacher
        $teacher = User::create([
            'name' => 'Teacher Test 3',
            'email' => 'teacher_test_limit3_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary']
        ]);

        // 2. Create a Student
        $student = User::create([
            'name' => 'Student Test 3',
            'email' => 'student_test_limit3_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        // 3. Create standalone Course #1
        $course1 = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course 1 Standalone 3',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => false,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // 4. Create Bundle Course
        $bundleCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Bundle Course 3',
            'price' => 250.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => true,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // Link Course #1 to Bundle
        $bundleCourse->childCourses()->attach($course1->id);

        // 5. Create Unit, Lesson, and Video in Course #1
        $unit = Unit::create([
            'course_id' => $course1->id,
            'title' => 'Unit 1',
            'order' => 1
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson 1',
            'order' => 1
        ]);

        $video = Video::create([
            'lesson_id' => $lesson->id,
            'title' => 'Video 1',
            'bunny_stream_id' => 'bunny_123',
            'duration_seconds' => 1000
        ]);

        // 6. Setup enrollments (both Standalone and Bundle)
        $standaloneEnrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course1->id,
            'enrolled_at' => now()
        ]);

        $bundleEnrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $bundleCourse->id,
            'enrolled_at' => now()
        ]);

        // 7. Create progress for standalone (e.g. 10% progress)
        $standaloneProgress = VideoProgress::create([
            'student_id' => $student->id,
            'video_id' => $video->id,
            'course_id' => $course1->id,
            'package_id' => null,
            'lesson_id' => $lesson->id,
            'watched_seconds' => 100,
            'watched_percentage' => 10.0,
            'completed' => false,
            'views_count' => 1,
            'watched_segments' => []
        ]);
        $standaloneProgress->updated_at = now()->subMinutes(10);
        $standaloneProgress->save();

        // 8. Create progress for bundle (e.g. 90% progress, updated more recently)
        $bundleProgress = VideoProgress::create([
            'student_id' => $student->id,
            'video_id' => $video->id,
            'course_id' => $bundleCourse->id,
            'package_id' => null,
            'lesson_id' => $lesson->id,
            'watched_seconds' => 900,
            'watched_percentage' => 90.0,
            'completed' => true,
            'views_count' => 1,
            'watched_segments' => []
        ]);
        $bundleProgress->updated_at = now();
        $bundleProgress->save();

        // 9. Fetch student dashboard
        $response = $this->actingAs($student)
             ->getJson("/api/student/dashboard");

        $response->assertStatus(200);
        $data = $response->json();

        // Verify we have both courses on the dashboard
        $courses = $data['courses'];
        $this->assertCount(2, $courses);

        $standaloneItem = collect($courses)->firstWhere('id', $course1->id);
        $bundleItem = collect($courses)->firstWhere('id', $bundleCourse->id);

        $this->assertNotNull($standaloneItem);
        $this->assertNotNull($bundleItem);

        // Verify isolated progress values
        $this->assertEquals(10, $standaloneItem['progress_percentage']);
        $this->assertEquals(90, $bundleItem['progress_percentage']);

        // Verify continue learning returns cards for both enrollments
        $lastWatchedList = $data['last_watched'];
        $this->assertIsArray($lastWatchedList);
        $this->assertCount(2, $lastWatchedList);

        $standaloneWatched = collect($lastWatchedList)->firstWhere('course_id', $course1->id);
        $bundleWatched = collect($lastWatchedList)->firstWhere('course_id', $bundleCourse->id);

        $this->assertNotNull($standaloneWatched);
        $this->assertNotNull($bundleWatched);
        $this->assertEquals(10, $standaloneWatched['progress_percentage']);
        $this->assertEquals(90, $bundleWatched['progress_percentage']);
    }

    public function test_teacher_can_view_bundle_course_detail_without_error(): void
    {
        // 1. Create a Teacher
        $teacher = User::create([
            'name' => 'Teacher Test Bundle',
            'email' => 'teacher_bundle_test_' . rand(100, 999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'grades' => ['first_secondary']
        ]);

        // 2. Create standalone Course #1
        $course1 = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Course 1 Standalone',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => false,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // 3. Create Bundle Course
        $bundleCourse = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'Bundle Course',
            'price' => 250.00,
            'grade' => 'first_secondary',
            'subject' => 'chemistry',
            'is_published' => true,
            'is_bundle' => true,
            'view_limit_enabled' => true,
            'max_views' => 3
        ]);

        // Link Course #1 to Bundle
        $bundleCourse->childCourses()->attach($course1->id);

        // 4. Create Unit, Lesson, and Video in Course #1
        $unit = Unit::create([
            'course_id' => $course1->id,
            'title' => 'Unit 1',
            'order' => 1
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unit->id,
            'title' => 'Lesson 1',
            'order' => 1
        ]);

        $video = Video::create([
            'lesson_id' => $lesson->id,
            'title' => 'Video 1',
            'bunny_stream_id' => 'bunny_123',
            'duration_seconds' => 100
        ]);

        // 5. Assert Teacher can load the Bundle Course detail page
        $response = $this->actingAs($teacher)
             ->getJson("/api/courses/{$bundleCourse->id}");

        $response->assertStatus(200);
        $data = $response->json();
        
        $this->assertEquals($bundleCourse->id, $data['course']['id']);
    }
}
