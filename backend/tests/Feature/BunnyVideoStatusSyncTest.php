<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Jobs\PollBunnyVideoStatus;
use App\Services\BunnyStreamService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Mockery;

class BunnyVideoStatusSyncTest extends TestCase
{
    use DatabaseTransactions;

    private User $teacher;
    private Course $course;
    private Unit $unit;
    private Lesson $lesson;
    private Video $video;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'Teacher Sync Test',
            'email' => 'teacher_sync_' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'physics',
            'grades' => ['third_secondary'],
            'must_change_password' => false,
        ]);

        $this->course = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'Physics Status Sync Test Course',
            'grade' => 'third_secondary',
            'subject' => 'physics',
            'price' => 150,
            'is_published' => true,
        ]);

        $this->unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'Unit 1',
            'order' => 1,
        ]);

        $this->lesson = Lesson::create([
            'unit_id' => $this->unit->id,
            'title' => 'Lesson 1',
            'order' => 1,
        ]);

        $this->video = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'Test Physics Video',
            'bunny_video_id' => 'guid-test-status-123',
            'bunny_stream_id' => 'guid-test-status-123',
            'bunny_status' => 'queued',
            'duration_seconds' => 0,
            'bunny_size_bytes' => 0,
        ]);
    }

    public function test_processing_video()
    {
        $mockService = Mockery::mock(BunnyStreamService::class)->makePartial();
        $mockService->shouldReceive('isConfigured')->andReturn(true);
        $mockService->shouldReceive('getVideoDetails')
            ->with('guid-test-status-123')
            ->andReturn([
                'status' => 2, // Processing
                'encodeProgress' => 45,
                'availableResolutions' => '',
                'length' => 0,
                'storageSize' => 1048576,
            ]);

        $res = $mockService->syncVideoStatus($this->video);

        $this->assertEquals('processing', $res['status']);
        $this->assertFalse($res['is_ready']);
        $this->assertFalse($res['is_failed']);

        $this->video->refresh();
        $this->assertEquals('processing', $this->video->bunny_status);
    }

    public function test_ready_video()
    {
        $mockService = Mockery::mock(BunnyStreamService::class)->makePartial();
        $mockService->shouldReceive('isConfigured')->andReturn(true);
        $mockService->shouldReceive('getVideoDetails')
            ->with('guid-test-status-123')
            ->andReturn([
                'status' => 4, // Finished
                'encodeProgress' => 100,
                'availableResolutions' => '360p,720p,1080p',
                'length' => 120,
                'storageSize' => 52428800,
            ]);

        $res = $mockService->syncVideoStatus($this->video);

        $this->assertEquals('ready', $res['status']);
        $this->assertTrue($res['is_ready']);
        $this->assertFalse($res['is_failed']);

        $this->video->refresh();
        $this->assertEquals('ready', $this->video->bunny_status);
        $this->assertEquals(120, $this->video->duration_seconds);
        $this->assertEquals(52428800, $this->video->bunny_size_bytes);
    }

    public function test_failed_video()
    {
        $mockService = Mockery::mock(BunnyStreamService::class)->makePartial();
        $mockService->shouldReceive('isConfigured')->andReturn(true);
        $mockService->shouldReceive('getVideoDetails')
            ->with('guid-test-status-123')
            ->andReturn([
                'status' => 5, // Error
                'encodeProgress' => 0,
                'availableResolutions' => '',
                'length' => 0,
                'storageSize' => 0,
            ]);

        $res = $mockService->syncVideoStatus($this->video);

        $this->assertEquals('failed', $res['status']);
        $this->assertFalse($res['is_ready']);
        $this->assertTrue($res['is_failed']);

        $this->video->refresh();
        $this->assertEquals('failed', $this->video->bunny_status);
    }

    public function test_already_playable_video_when_status_is_transcoding()
    {
        $mockService = Mockery::mock(BunnyStreamService::class)->makePartial();
        $mockService->shouldReceive('isConfigured')->andReturn(true);
        // Status is 3 (Transcoding), but resolutions are ready and length is > 0
        $mockService->shouldReceive('getVideoDetails')
            ->with('guid-test-status-123')
            ->andReturn([
                'status' => 3,
                'encodeProgress' => 85,
                'availableResolutions' => '360p,720p',
                'length' => 95,
                'storageSize' => 40000000,
            ]);

        $res = $mockService->syncVideoStatus($this->video);

        $this->assertEquals('ready', $res['status']);
        $this->assertTrue($res['is_ready']);

        $this->video->refresh();
        $this->assertEquals('ready', $this->video->bunny_status);
        $this->assertEquals(95, $this->video->duration_seconds);
    }

    public function test_already_playable_via_player_url_check()
    {
        $mockService = Mockery::mock(BunnyStreamService::class)->makePartial();
        $mockService->shouldReceive('isConfigured')->andReturn(true);
        // Status is 2, no resolutions, but player URL is playable
        $mockService->shouldReceive('getVideoDetails')
            ->with('guid-test-status-123')
            ->andReturn([
                'status' => 2,
                'encodeProgress' => 50,
                'availableResolutions' => '',
                'length' => 60,
                'storageSize' => 20000000,
            ]);
        $mockService->shouldReceive('isPlayerUrlPlayable')
            ->with('guid-test-status-123')
            ->andReturn(true);

        $res = $mockService->syncVideoStatus($this->video);

        $this->assertEquals('ready', $res['status']);
        $this->assertTrue($res['is_ready']);
    }

    public function test_sync_queue_does_not_call_release()
    {
        Config::set('queue.default', 'sync');

        $mockService = Mockery::mock(BunnyStreamService::class);
        $mockService->shouldReceive('syncVideoStatus')
            ->once()
            ->andReturn([
                'success' => true,
                'status' => 'processing',
                'is_ready' => false,
                'is_failed' => false,
            ]);

        $job = new PollBunnyVideoStatus($this->video->id);

        // Should not throw BadMethodCallException
        $job->handle($mockService);

        $this->assertFalse($job->canReleaseJob());
    }

    public function test_non_sync_queue_releases_when_processing()
    {
        Config::set('queue.default', 'database');

        $job = Mockery::mock(PollBunnyVideoStatus::class, [$this->video->id])->makePartial();
        $job->shouldReceive('canReleaseJob')->andReturn(true);
        $job->shouldReceive('release')->with(10)->once();

        $mockService = Mockery::mock(BunnyStreamService::class);
        $mockService->shouldReceive('syncVideoStatus')
            ->once()
            ->andReturn([
                'success' => true,
                'status' => 'processing',
                'is_ready' => false,
                'is_failed' => false,
            ]);

        $job->handle($mockService);
        $this->assertTrue(true);
    }

    public function test_polling_stops_after_ready()
    {
        Config::set('queue.default', 'database');

        Cache::put("polling_bunny_video_{$this->video->id}", true, 300);

        $job = Mockery::mock(PollBunnyVideoStatus::class, [$this->video->id])->makePartial();
        $job->shouldNotReceive('release');

        $mockService = Mockery::mock(BunnyStreamService::class);
        $mockService->shouldReceive('syncVideoStatus')
            ->once()
            ->andReturn([
                'success' => true,
                'status' => 'ready',
                'is_ready' => true,
                'is_failed' => false,
            ]);

        $job->handle($mockService);

        $this->assertFalse(Cache::has("polling_bunny_video_{$this->video->id}"));
    }

    public function test_polling_does_not_delete_a_valid_processing_video()
    {
        $mockService = Mockery::mock(BunnyStreamService::class);
        $mockService->shouldReceive('syncVideoStatus')
            ->andReturn([
                'success' => true,
                'status' => 'processing',
                'is_ready' => false,
                'is_failed' => false,
            ]);

        $job = new PollBunnyVideoStatus($this->video->id);
        $job->handle($mockService);

        // Video must still exist in the database!
        $this->assertDatabaseHas('videos', [
            'id' => $this->video->id,
            'bunny_video_id' => 'guid-test-status-123',
        ]);
    }

    public function test_video_status_endpoint()
    {
        $mockService = Mockery::mock(BunnyStreamService::class);
        $this->app->instance(BunnyStreamService::class, $mockService);

        $mockService->shouldReceive('isConfigured')->andReturn(true);
        $mockService->shouldReceive('syncVideoStatus')
            ->once()
            ->andReturnUsing(function ($video) {
                $video->update(['bunny_status' => 'ready', 'duration_seconds' => 39]);
                return [
                    'success' => true,
                    'status' => 'ready',
                    'is_ready' => true,
                    'is_failed' => false,
                ];
            });

        $token = $this->teacher->createToken('test')->plainTextToken;
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson("/api/videos/{$this->video->id}/status");

        $response->assertStatus(200);
        $response->assertJson([
            'id' => $this->video->id,
            'bunny_status' => 'ready',
            'is_ready' => true,
            'is_processing' => false,
            'is_failed' => false,
        ]);
    }
}
