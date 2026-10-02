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
use App\Models\PlatformSetting;
use App\Models\StudentCourseViewLimit;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class VideoWatchProgressTest extends TestCase
{
    use DatabaseTransactions;

    private User $teacher;
    private User $student;
    private Course $course;
    private Unit $unit;
    private Lesson $lesson;
    private Video $video;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'Teacher Watch Test',
            'email' => 'teacher_watch_' . rand(1000, 9999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['first_secondary']
        ]);

        $this->student = User::create([
            'name' => 'Student Watch Test',
            'email' => 'student_watch_' . rand(1000, 9999) . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'student',
            'status' => 'active'
        ]);

        $this->course = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Physics Course',
            'price' => 100.00,
            'grade' => 'first_secondary',
            'subject' => 'physics',
            'is_published' => true,
            'is_bundle' => false,
            'view_limit_enabled' => true,
            'max_views' => 5
        ]);

        $this->unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1: Motion',
            'order' => 1
        ]);

        $this->lesson = Lesson::create([
            'unit_id' => $this->unit->id,
            'title' => 'Lesson 1: Speed and Velocity',
            'order' => 1
        ]);

        $this->video = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'Bunny Stream Video 1',
            'bunny_video_id' => '9e87fd72-c3e7-4548-9ca1-fc75da6de1ff',
            'bunny_stream_id' => '9e87fd72-c3e7-4548-9ca1-fc75da6de1ff',
            'bunny_embed_url' => 'https://iframe.mediadelivery.net/embed/766707/9e87fd72-c3e7-4548-9ca1-fc75da6de1ff',
            'duration_seconds' => 100
        ]);

        Enrollment::create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
            'enrolled_at' => now()
        ]);
    }

    public function test_initial_progress_records_0_percent_and_not_completed(): void
    {
        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 0,
                'watched_seconds' => 0,
                'watched_segments' => [],
                'duration_seconds' => 100,
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertEquals(0, $data['watched_seconds']);
        $this->assertEquals(0, (float)$data['watched_percentage']);
        $this->assertFalse((bool)$data['completed']);
        $this->assertEquals(0, $data['last_position_seconds']);
    }

    public function test_watch_progress_under_90_percent_remains_incomplete(): void
    {
        // 50% watch progress
        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 50,
                'watched_seconds' => 50,
                'watched_segments' => [
                    ['start' => 0, 'end' => 50]
                ],
                'duration_seconds' => 100,
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertEquals(50, $data['watched_seconds']);
        $this->assertEquals(50.0, (float)$data['watched_percentage']);
        $this->assertFalse((bool)$data['completed']);

        // 89% watch progress
        $response89 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 89,
                'watched_seconds' => 89,
                'watched_segments' => [
                    ['start' => 0, 'end' => 89]
                ],
                'duration_seconds' => 100,
            ]);

        $response89->assertStatus(200);
        $data89 = $response89->json();

        $this->assertEquals(89, $data89['watched_seconds']);
        $this->assertEquals(89.0, (float)$data89['watched_percentage']);
        $this->assertFalse((bool)$data89['completed']);
    }

    public function test_watch_progress_auto_completes_at_90_percent_and_persists(): void
    {
        // Reach 90%
        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 90,
                'watched_seconds' => 90,
                'watched_segments' => [
                    ['start' => 0, 'end' => 90]
                ],
                'duration_seconds' => 100,
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertEquals(90, $data['watched_seconds']);
        $this->assertEquals(90.0, (float)$data['watched_percentage']);
        $this->assertTrue((bool)$data['completed']);

        // Subsequent update at lower position retains completed = true
        $subsequent = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 10,
                'watched_seconds' => 90,
                'watched_segments' => [
                    ['start' => 0, 'end' => 90]
                ],
                'duration_seconds' => 100,
            ]);

        $subsequent->assertStatus(200);
        $subsequentData = $subsequent->json();
        $this->assertTrue((bool)$subsequentData['completed']);
        $this->assertEquals(90.0, (float)$subsequentData['watched_percentage']);
    }

    public function test_anti_cheat_seeking_forward_does_not_give_completion(): void
    {
        // Student jumps straight from 0 to 95s, but only watched 2 seconds
        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 95,
                'watched_seconds' => 2,
                'watched_segments' => [
                    ['start' => 0, 'end' => 1],
                    ['start' => 94, 'end' => 95],
                ],
                'duration_seconds' => 100,
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        // Unique watched seconds is 2 seconds out of 100
        $this->assertEquals(2, $data['watched_seconds']);
        $this->assertEquals(2.0, (float)$data['watched_percentage']);
        $this->assertFalse((bool)$data['completed']);
    }

    public function test_progress_persists_and_returns_in_lesson_details_on_refresh(): void
    {
        // Save 95% progress
        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 95,
                'watched_seconds' => 95,
                'watched_segments' => [
                    ['start' => 0, 'end' => 95]
                ],
                'duration_seconds' => 100,
            ])
            ->assertStatus(200);

        // Fetch lesson details (simulating page load / refresh)
        $lessonResponse = $this->actingAs($this->student, 'sanctum')
            ->getJson("/api/student/lessons/{$this->lesson->id}?course_id={$this->course->id}");

        $lessonResponse->assertStatus(200);
        $videos = $lessonResponse->json('videos');
        $this->assertNotEmpty($videos);

        $videoItem = collect($videos)->firstWhere('id', $this->video->id);
        $this->assertNotNull($videoItem);
        $this->assertEquals(95, $videoItem['progress']['watched_seconds']);
        $this->assertEquals(95.0, (float)$videoItem['progress']['watched_percentage']);
        $this->assertTrue((bool)$videoItem['progress']['completed']);
        $this->assertEquals(95, $videoItem['progress']['last_position_seconds']);
    }

    public function test_view_attempt_limit_only_increments_when_threshold_is_met(): void
    {
        // Set platform threshold to 50 seconds
        PlatformSetting::updateOrCreate([], [
            'video_threshold_seconds' => 50,
            'view_limit_enabled' => true,
            'default_max_views' => 5,
        ]);

        $sessionId = 'session_test_' . rand(1000, 9999);

        // 1. Student watches 20 seconds (below 50s threshold)
        $res1 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 20,
                'watched_seconds' => 20,
                'watched_segments' => [['start' => 0, 'end' => 20]],
                'session_id' => $sessionId,
                'session_watch_time' => 20,
                'duration_seconds' => 100,
            ]);

        $res1->assertStatus(200);
        $data1 = $res1->json();
        $this->assertEquals(0, $data1['views_used']);

        // 2. Student seeks forward to 80s, but session_watch_time is still only 25s
        $res2 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 80,
                'watched_seconds' => 25,
                'watched_segments' => [['start' => 0, 'end' => 20], ['start' => 75, 'end' => 80]],
                'session_id' => $sessionId,
                'session_watch_time' => 25,
                'duration_seconds' => 100,
            ]);

        $res2->assertStatus(200);
        $data2 = $res2->json();
        $this->assertEquals(0, $data2['views_used']);

        // 3. Student continuously watches until session_watch_time reaches 50s (threshold)
        $res3 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 90,
                'watched_seconds' => 50,
                'watched_segments' => [['start' => 0, 'end' => 50]],
                'session_id' => $sessionId,
                'session_watch_time' => 50,
                'duration_seconds' => 100,
            ]);

        $res3->assertStatus(200);
        $data3 = $res3->json();
        $this->assertEquals(1, $data3['views_used']);

        // 4. Continuing playback in same session does not double-count
        $res4 = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$this->video->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 95,
                'watched_seconds' => 55,
                'watched_segments' => [['start' => 0, 'end' => 55]],
                'session_id' => $sessionId,
                'session_watch_time' => 55,
                'skip_view_increment' => true,
                'duration_seconds' => 100,
            ]);

        $res4->assertStatus(200);
        $data4 = $res4->json();
        $this->assertEquals(1, $data4['views_used']);
    }

    public function test_duration_updates_from_request_if_missing_in_db(): void
    {
        // Video with 0 duration in DB
        $videoZero = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'Bunny Stream Video Zero Duration',
            'bunny_video_id' => '00000000-0000-0000-0000-000000000001',
            'duration_seconds' => 0
        ]);

        $response = $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/videos/{$videoZero->id}/progress", [
                'course_id' => $this->course->id,
                'last_position_seconds' => 39,
                'watched_seconds' => 39,
                'watched_segments' => [['start' => 0, 'end' => 39]],
                'duration_seconds' => 39,
            ]);

        $response->assertStatus(200);
        $data = $response->json();

        // Percentage should be 100% (39 / 39), NOT 13% (39 / 300)
        $this->assertEquals(100.0, (float)$data['watched_percentage']);
        $this->assertTrue((bool)$data['completed']);

        // Video record in DB should have duration updated to 39
        $this->assertEquals(39, $videoZero->fresh()->duration_seconds);
    }
}
