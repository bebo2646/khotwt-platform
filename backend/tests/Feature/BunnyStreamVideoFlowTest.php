<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Services\BunnyStreamService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Mockery;

class BunnyStreamVideoFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private Course $course;
    private Unit $unit;
    private Lesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();

        $this->teacher = User::factory()->create([
            'role' => 'teacher',
            'name' => 'أ. خالد منصور',
            'phone' => '01012345678',
        ]);

        $this->course = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'كورس الفيزياء الحديثة',
            'grade' => 'الصف الثالث الثانوي',
            'subject' => 'فيزياء',
            'price' => 200,
            'status' => 'published',
        ]);

        $this->unit = Unit::create([
            'course_id' => $this->course->id,
            'title' => 'الوحدة الأولى',
        ]);

        $this->lesson = Lesson::create([
            'unit_id' => $this->unit->id,
            'title' => 'الدرس الأول: ظاهرة كومتون',
            'duration' => 0,
        ]);
    }

    public function test_conflicting_fields_flow_is_rejected_with_422()
    {
        $fakeVideo = UploadedFile::fake()->create('lecture.mp4', 1024, 'video/mp4');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'فيديو متضارب',
            'video_file' => $fakeVideo,
            'video_url' => 'https://youtube.com/watch?v=12345',
            'bunny_video_id' => '11111111-2222-3333-4444-555555555555',
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error_code' => 'CONFLICTING_VIDEO_FLOWS',
        ]);

        $this->assertDatabaseCount('videos', 0);
    }

    public function test_direct_video_upload_succeeds_and_creates_records_atomically()
    {
        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('isStorageLimitExceeded')->andReturn(false);
        $mockBunny->shouldReceive('recalculateStorage')->andReturn(null);
        $mockBunny->shouldReceive('createVideo')->once()->with('المحاضرة الأولى')->andReturn([
            'success' => true,
            'guid' => 'mock-guid-1234-5678',
            'status' => 200,
            'data' => ['guid' => 'mock-guid-1234-5678'],
            'error' => null,
        ]);
        $mockBunny->shouldReceive('uploadVideo')->once()->andReturn([
            'success' => true,
            'status' => 200,
            'error' => null,
        ]);
        $mockBunny->shouldReceive('getEmbedUrl')->with('mock-guid-1234-5678')->andReturn('https://iframe.mediadelivery.net/embed/766707/mock-guid-1234-5678');
        $mockBunny->shouldReceive('getThumbnailUrl')->with('mock-guid-1234-5678')->andReturn('https://vz-766707.b-cdn.net/mock-guid-1234-5678/thumbnail.jpg');

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $fakeVideo = UploadedFile::fake()->create('lecture.mp4', 5000, 'video/mp4');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'المحاضرة الأولى',
            'video_file' => $fakeVideo,
            'duration_seconds' => 720,
        ]);

        $response->assertStatus(201);
        $response->assertJson([
            'success' => true,
            'video' => [
                'title' => 'المحاضرة الأولى',
                'bunny_stream_id' => 'mock-guid-1234-5678',
                'duration_seconds' => 720,
            ],
        ]);

        // Ensure database was updated atomically
        $this->assertDatabaseHas('videos', [
            'lesson_id' => $this->lesson->id,
            'title' => 'المحاضرة الأولى',
            'bunny_stream_id' => 'mock-guid-1234-5678',
        ]);

        // Ensure lesson duration is updated in seconds
        $this->assertEquals(720, $this->lesson->fresh()->duration_seconds);
    }

    public function test_failed_bunny_creation_returns_real_error_and_creates_zero_db_records()
    {
        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('isStorageLimitExceeded')->andReturn(false);
        $mockBunny->shouldReceive('createVideo')->once()->andReturn([
            'success' => false,
            'status' => 401,
            'guid' => null,
            'error' => 'The API key provided is unauthorized or library ID is incorrect.',
            'bunny_message' => 'Unauthorized access to video library',
            'raw_body' => '{"statusCode":401,"message":"Unauthorized access to video library"}',
        ]);

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $fakeVideo = UploadedFile::fake()->create('lecture.mp4', 5000, 'video/mp4');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'المحاضرة الفاشلة',
            'video_file' => $fakeVideo,
        ]);

        $response->assertStatus(502);
        $response->assertJson([
            'error_code' => 'BUNNY_CREATION_FAILED',
            'status_code' => 401,
        ]);

        // Zero dirty database records
        $this->assertDatabaseCount('videos', 0);
        $this->assertEquals(0, $this->lesson->fresh()->duration_seconds ?? 0);
    }

    public function test_invalid_bunny_video_id_returns_422_and_does_not_save_record()
    {
        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('validateVideoExists')->once()->with('non-existent-guid-999')->andReturn([
            'success' => false,
            'exists' => false,
            'status' => 404,
            'data' => null,
            'error' => 'Video object not found on Bunny Stream library.',
        ]);

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'فيديو غير موجود',
            'bunny_video_id' => 'non-existent-guid-999',
            'duration_seconds' => 300,
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error_code' => 'BUNNY_VIDEO_NOT_FOUND',
        ]);

        $this->assertDatabaseCount('videos', 0);
    }

    public function test_valid_existing_bunny_video_id_succeeds()
    {
        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('validateVideoExists')->once()->with('valid-guid-123')->andReturn([
            'success' => true,
            'exists' => true,
            'status' => 200,
            'data' => [
                'guid' => 'valid-guid-123',
                'length' => 600,
                'status' => 4,
            ],
            'error' => null,
        ]);
        $mockBunny->shouldReceive('mapStatusCodeToString')->andReturn('finished');
        $mockBunny->shouldReceive('recalculateStorage')->andReturn(null);
        $mockBunny->shouldReceive('getEmbedUrl')->with('valid-guid-123')->andReturn('https://iframe.mediadelivery.net/embed/766707/valid-guid-123');
        $mockBunny->shouldReceive('getThumbnailUrl')->with('valid-guid-123')->andReturn('https://vz-766707.b-cdn.net/valid-guid-123/thumbnail.jpg');

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'فيديو بوني موجود مسبقاً',
            'bunny_video_id' => 'valid-guid-123',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('videos', [
            'lesson_id' => $this->lesson->id,
            'bunny_stream_id' => 'valid-guid-123',
            'duration_seconds' => 600,
        ]);
    }

    public function test_manual_video_url_flow_does_not_call_bunny_creation()
    {
        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'فيديو يوتيوب خارجي',
            'video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'duration_seconds' => 212,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('videos', [
            'lesson_id' => $this->lesson->id,
            'title' => 'فيديو يوتيوب خارجي',
            'bunny_embed_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'duration_seconds' => 212,
        ]);
    }

    public function test_duplicate_video_submission_is_rejected_with_422()
    {
        // First submission
        Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'المحاضرة الأولى',
            'bunny_stream_id' => 'guid-1111',
            'bunny_embed_url' => 'https://iframe.mediadelivery.net/embed/766707/guid-1111',
            'duration_seconds' => 300,
        ]);

        // Duplicate submission with same title
        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'المحاضرة الأولى',
            'video_url' => 'https://youtube.com/watch?v=different',
            'duration_seconds' => 300,
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error_code' => 'DUPLICATE_VIDEO_TITLE',
        ]);

        // Duplicate submission with same Bunny ID
        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('validateVideoExists')->andReturn(['success' => true, 'exists' => true, 'status' => 200, 'data' => []]);
        $mockBunny->shouldReceive('getEmbedUrl')->andReturn('https://iframe.mediadelivery.net/embed/766707/guid-1111');
        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $response2 = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'عنوان مختلف تماماً',
            'bunny_video_id' => 'guid-1111',
        ]);

        $response2->assertStatus(422);
        $response2->assertJson([
            'error_code' => 'DUPLICATE_BUNNY_VIDEO',
        ]);
    }

    public function test_bunny_credentials_never_exposed_in_api_response()
    {
        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('isStorageLimitExceeded')->andReturn(false);
        $mockBunny->shouldReceive('createVideo')->once()->andReturn([
            'success' => false,
            'status' => 500,
            'guid' => null,
            'error' => 'Server error while communicating with Bunny Stream.',
            'bunny_message' => 'Internal server error',
            'raw_body' => '{"statusCode":500}',
        ]);

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $fakeVideo = UploadedFile::fake()->create('lecture.mp4', 1024, 'video/mp4');

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson("/api/teacher/lessons/{$this->lesson->id}/video", [
            'title' => 'اختبار الأمان',
            'video_file' => $fakeVideo,
        ]);

        $content = $response->getContent();

        $this->assertStringNotContainsString(config('services.bunny.stream_api_key', 'test_key'), $content);
        $this->assertStringNotContainsString('AccessKey', $content);
        $this->assertStringNotContainsString('api_key', $content);
    }
}
