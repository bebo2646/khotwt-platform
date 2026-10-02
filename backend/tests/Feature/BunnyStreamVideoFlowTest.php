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

    public function test_generate_signed_upload_rejects_duplicate_video_title()
    {
        Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'فيديو كوانتم مكرر',
            'duration_seconds' => 300,
        ]);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/videos/signed-upload', [
            'lesson_id' => $this->lesson->id,
            'title' => 'فيديو كوانتم مكرر',
            'file_size' => 1024 * 1024 * 10,
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'error_code' => 'DUPLICATE_VIDEO_TITLE',
        ]);
    }

    public function test_generate_signed_upload_success_creates_placeholder_and_tus_credentials()
    {
        config(['services.bunny.library_id' => '766707']);
        config(['services.bunny.api_key' => 'mock-api-key']);

        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('isStorageLimitExceeded')->andReturn(false);
        $mockBunny->shouldReceive('recalculateStorage')->andReturn(null);
        $mockBunny->shouldReceive('createVideo')->once()->with('شرح نموذج بور الذري')->andReturn([
            'success' => true,
            'video_id' => 'bunny-guid-9999-8888',
            'guid' => 'bunny-guid-9999-8888',
            'status' => 200,
        ]);
        $mockBunny->shouldReceive('getEmbedUrl')->with('bunny-guid-9999-8888')->andReturn('https://iframe.mediadelivery.net/embed/766707/bunny-guid-9999-8888');
        $mockBunny->shouldReceive('getThumbnailUrl')->with('bunny-guid-9999-8888')->andReturn('https://vz-766707.b-cdn.net/bunny-guid-9999-8888/thumbnail.jpg');

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/videos/signed-upload', [
            'lesson_id' => $this->lesson->id,
            'title' => 'شرح نموذج بور الذري',
            'file_size' => 1024 * 1024 * 50,
            'duration_seconds' => 600,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'video_id',
            'library_id',
            'signature',
            'expiration_time',
            'embed_url',
            'video',
        ]);

        $this->assertEquals('bunny-guid-9999-8888', $response->json('video_id'));
        $this->assertEquals('766707', $response->json('library_id'));

        $this->assertDatabaseHas('videos', [
            'lesson_id' => $this->lesson->id,
            'title' => 'شرح نموذج بور الذري',
            'bunny_video_id' => 'bunny-guid-9999-8888',
            'bunny_status' => 'queued',
            'duration_seconds' => 600,
        ]);
    }

    public function test_signed_upload_rejects_when_storage_quota_exceeded_before_bunny_creation()
    {
        // Teacher has 10 GB limit, upload attempt is 20 GB
        $this->teacher->update([
            'bunny_storage_limit_gb' => 10.0,
            'bunny_storage_used_gb' => 0.0,
        ]);

        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('recalculateStorage')->andReturn(null);
        $mockBunny->shouldReceive('isStorageLimitExceeded')->andReturn(true);
        // CRITICAL ASSERTION: createVideo MUST NEVER be called if quota is exceeded!
        $mockBunny->shouldNotReceive('createVideo');

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        // Try to upload a 20 GB video when limit is 10 GB
        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/videos/signed-upload', [
            'lesson_id' => $this->lesson->id,
            'title' => 'فيديو يتجاوز الباقة',
            'file_size' => 20 * 1024 * 1024 * 1024,
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'error_code' => 'STORAGE_LIMIT_EXCEEDED',
            'message' => 'مساحتك التخزينية المتبقية لا تكفي لرفع هذا الفيديو.',
        ]);

        // CRITICAL: ZERO video records created in database
        $this->assertDatabaseMissing('videos', [
            'title' => 'فيديو يتجاوز الباقة',
        ]);
    }

    public function test_finalize_upload_updates_video_status_and_recalculates_storage()
    {
        $video = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'فيديو تم رفعه',
            'bunny_video_id' => 'test-bunny-guid-1234',
            'bunny_status' => 'queued',
            'duration_seconds' => 0,
        ]);

        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('getVideo')->once()->with('test-bunny-guid-1234')->andReturn([
            'success' => true,
            'data' => [
                'status' => 3, // Finished/encoded in Bunny
                'length' => 450,
                'storageSize' => 52428800,
            ],
        ]);
        $mockBunny->shouldReceive('mapStatusCodeToString')->with(3)->andReturn('finished');
        $mockBunny->shouldReceive('recalculateStorage')->once()->with($this->teacher->id)->andReturn(null);

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/videos/finalize-upload', [
            'video_id' => $video->id,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);

        $video->refresh();
        $this->assertEquals('finished', $video->bunny_status);
        $this->assertEquals(450, $video->duration_seconds);
        $this->assertEquals(52428800, $video->bunny_size_bytes);
    }

    public function test_cancel_upload_cleans_up_bunny_and_local_record()
    {
        $video = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'فيديو ملغى',
            'bunny_video_id' => 'cancel-bunny-guid-5555',
            'bunny_status' => 'queued',
            'duration_seconds' => 0,
        ]);

        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('deleteVideo')->once()->with('cancel-bunny-guid-5555')->andReturn(true);
        $mockBunny->shouldReceive('recalculateStorage')->once()->with($this->teacher->id)->andReturn(null);

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/videos/cancel-upload', [
            'video_id' => $video->id,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);

        $this->assertDatabaseMissing('videos', [
            'id' => $video->id,
        ]);
    }

    public function test_retry_after_failed_or_draft_upload_cleans_up_and_allows_reupload()
    {
        config(['services.bunny.library_id' => '766707']);
        config(['services.bunny.api_key' => 'mock-api-key']);

        // Previous failed/draft video with 0 duration
        $draftVideo = Video::create([
            'lesson_id' => $this->lesson->id,
            'title' => 'محاضرة فيزياء 1',
            'bunny_video_id' => 'old-abandoned-guid-0000',
            'bunny_status' => 'queued',
            'duration_seconds' => 0,
            'bunny_duration' => 0,
        ]);

        $mockBunny = Mockery::mock(BunnyStreamService::class);
        $mockBunny->shouldReceive('isConfigured')->andReturn(true);
        $mockBunny->shouldReceive('isStorageLimitExceeded')->andReturn(false);
        $mockBunny->shouldReceive('recalculateStorage')->andReturn(null);
        // Deletes the old abandoned Bunny video
        $mockBunny->shouldReceive('deleteVideo')->once()->with('old-abandoned-guid-0000')->andReturn(true);
        // Creates the new Bunny video
        $mockBunny->shouldReceive('createVideo')->once()->with('محاضرة فيزياء 1')->andReturn([
            'success' => true,
            'video_id' => 'new-fresh-guid-1111',
            'guid' => 'new-fresh-guid-1111',
            'status' => 200,
        ]);
        $mockBunny->shouldReceive('getEmbedUrl')->with('new-fresh-guid-1111')->andReturn('https://iframe.mediadelivery.net/embed/766707/new-fresh-guid-1111');
        $mockBunny->shouldReceive('getThumbnailUrl')->with('new-fresh-guid-1111')->andReturn('https://vz-766707.b-cdn.net/new-fresh-guid-1111/thumbnail.jpg');

        $this->app->instance(BunnyStreamService::class, $mockBunny);

        // Retry the exact same title
        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/videos/signed-upload', [
            'lesson_id' => $this->lesson->id,
            'title' => 'محاضرة فيزياء 1',
            'file_size' => 1024 * 1024 * 50,
            'retry' => true,
        ]);

        $response->assertStatus(200);
        $this->assertEquals('new-fresh-guid-1111', $response->json('video_id'));

        // Old draft record is gone
        $this->assertDatabaseMissing('videos', [
            'id' => $draftVideo->id,
        ]);

        // New record exists
        $this->assertDatabaseHas('videos', [
            'lesson_id' => $this->lesson->id,
            'title' => 'محاضرة فيزياء 1',
            'bunny_video_id' => 'new-fresh-guid-1111',
        ]);
    }
}
