<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Package;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class PersistentMediaStorageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $teacher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'is_super_admin' => true,
        ]);

        $this->teacher = User::factory()->create([
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'chemistry',
            'experience' => '5 years',
        ]);
    }

    public function test_1_upload_test_teacher_image_stores_on_public_disk_and_returns_valid_url()
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('teacher_avatar.jpg', 300, 300);

        $response = $this->actingAs($this->admin, 'sanctum')->postJson('/api/upload', [
            'file' => $file,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['url', 'path']);

        $path = $response->json('path');
        $url = $response->json('url');

        $this->assertNotEmpty($path);
        $this->assertNotEmpty($url);
        Storage::disk('public')->assertExists($path);
        $this->assertStringContainsString('storage/' . $path, $url);
    }

    public function test_2_upload_test_course_cover_stores_on_public_disk_and_returns_valid_url()
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('course_cover.png', 1280, 720);

        $response = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/upload', [
            'file' => $file,
        ]);

        $response->assertStatus(200);
        $path = $response->json('path');
        $url = $response->json('url');

        Storage::disk('public')->assertExists($path);
        $this->assertStringContainsString('storage/' . $path, $url);
    }

    public function test_3_updating_teacher_without_new_avatar_preserves_existing_avatar()
    {
        $existingAvatar = 'https://khotwtak.com/storage/uploads/custom_teacher_avatar.png';
        $teacher = User::factory()->create([
            'role' => 'teacher',
            'name' => 'أحمد محمود',
            'phone' => '01012345678',
            'avatar' => $existingAvatar,
            'status' => 'active',
            'subject' => 'فيزياء',
            'experience' => '5 سنوات',
        ]);

        // Admin updates teacher name and bio without uploading or passing a new avatar
        $response = $this->actingAs($this->admin, 'sanctum')->putJson("/api/admin/teachers/{$teacher->id}", [
            'name' => 'أحمد محمود المعدل',
            'phone' => '01012345678',
            'subject' => 'فيزياء',
            'status' => 'active',
            'experience' => '5 سنوات',
            'bio' => 'سيرة ذاتية جديدة',
            // avatar omitted or null
        ]);

        $response->assertStatus(200);
        $teacher->refresh();

        $this->assertEquals('أحمد محمود المعدل', $teacher->name);
        $this->assertEquals($existingAvatar, $teacher->getRawOriginal('avatar'), 'Original avatar must be preserved when not updated');
    }

    public function test_4_updating_course_without_new_cover_preserves_existing_cover()
    {
        $existingCover = 'https://khotwtak.com/storage/uploads/custom_course_cover.png';
        $course = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'كورس الكيمياء المتقدم',
            'description' => 'وصف أصلي',
            'cover_image' => $existingCover,
            'price' => 200,
            'subject' => 'chemistry',
            'grade' => 'third_secondary',
            'category' => 'school',
        ]);

        // Teacher updates course title and price without uploading a new cover
        $response = $this->actingAs($this->teacher, 'sanctum')->putJson("/api/teacher/courses/{$course->id}", [
            'title' => 'كورس الكيمياء المحدث',
            'description' => 'وصف محدث',
            'price' => 250,
            'subject' => 'chemistry',
            'grade' => 'third_secondary',
            // cover_image omitted
        ]);

        $response->assertStatus(200);
        $course->refresh();

        $this->assertEquals('كورس الكيمياء المحدث', $course->title);
        $this->assertEquals($existingCover, $course->getRawOriginal('cover_image'), 'Original cover image must be preserved when not updated');
    }

    public function test_5_fallback_images_do_not_overwrite_database_values()
    {
        // 1. Course created with unsplash fallback sent from frontend
        $responseCourse = $this->actingAs($this->teacher, 'sanctum')->postJson('/api/teacher/courses', [
            'title' => 'كورس بدون صورة',
            'description' => 'كورس جديد بدون رفع غلاف',
            'price' => 100,
            'subject' => 'math',
            'grade' => 'first_secondary',
            'cover_image' => 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
        ]);

        $responseCourse->assertStatus(201);
        $courseId = $responseCourse->json('id');
        $course = Course::findOrFail($courseId);

        // Raw database column MUST be null, not hardcoded unsplash
        $this->assertNull($course->getRawOriginal('cover_image'), 'Raw database value must be null when fallback unsplash is supplied');
        // But the accessor safely returns the fallback for rendering
        $this->assertEquals('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500', $course->cover_image);

        // 2. Course updated with unsplash fallback does not turn null into hardcoded string
        $updateResponse = $this->actingAs($this->teacher, 'sanctum')->putJson("/api/teacher/courses/{$course->id}", [
            'title' => 'كورس بدون صورة معدل',
            'description' => 'تعديل',
            'price' => 150,
            'subject' => 'math',
            'grade' => 'first_secondary',
            'cover_image' => 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
        ]);

        $updateResponse->assertStatus(200);
        $course->refresh();
        $this->assertNull($course->getRawOriginal('cover_image'), 'Raw database value must remain null after update with fallback');

        // 3. Teacher created with unsplash or dicebear fallback
        $responseTeacher = $this->actingAs($this->admin, 'sanctum')->postJson('/api/admin/teachers', [
            'name' => 'معلم تجريبي بدون صورة',
            'phone' => '01099887766',
            'subject' => 'فيزياء',
            'experience' => '3 سنوات',
            'avatar' => 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        ]);

        $responseTeacher->assertStatus(201);
        $teacherId = $responseTeacher->json('teacher.id');
        $teacher = User::findOrFail($teacherId);

        $this->assertNull($teacher->getRawOriginal('avatar'), 'Raw database value must be null for teacher fallback avatar');
    }

    public function test_6_legacy_railway_and_relative_urls_dynamically_normalize_to_current_app_url()
    {
        $legacyRailwayUrl = 'https://khotwt-platform-production.up.railway.app/storage/uploads/GeLxTVUzQneFlNhqrZ25aceJubhBTSWtn6i4fN7o.png';
        
        $teacher = User::factory()->create([
            'role' => 'teacher',
            'avatar' => $legacyRailwayUrl,
        ]);

        $course = Course::create([
            'teacher_id' => $teacher->id,
            'title' => 'كورس موروث',
            'cover_image' => $legacyRailwayUrl,
            'price' => 100,
            'subject' => 'chemistry',
            'grade' => 'third_secondary',
            'category' => 'school',
        ]);

        $package = Package::create([
            'teacher_id' => $teacher->id,
            'course_id' => $course->id,
            'title' => 'باقة تجريبية',
            'price' => 100,
            'type' => 'bundle',
            'cover_image' => $legacyRailwayUrl,
            'package_thumbnail' => $legacyRailwayUrl,
        ]);

        // Test User accessor
        $expectedUrl = asset('storage/uploads/GeLxTVUzQneFlNhqrZ25aceJubhBTSWtn6i4fN7o.png');
        $this->assertEquals($expectedUrl, $teacher->avatar);

        // Test Course accessor
        $this->assertEquals($expectedUrl, $course->cover_image);

        // Test Package accessors
        $this->assertEquals($expectedUrl, $package->cover_image);
        $this->assertEquals($expectedUrl, $package->package_thumbnail);
    }
}
