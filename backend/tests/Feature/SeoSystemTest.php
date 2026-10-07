<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class SeoSystemTest extends TestCase
{
    use DatabaseTransactions;

    private User $teacher;
    private Course $publishedCourse;
    private Course $unpublishedCourse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = User::create([
            'name' => 'مستر جمعة العيادي',
            'slug' => 'جمعه-العيادي',
            'email' => 'teacher_seo_' . rand(10000, 99999) . '@test.com',
            'password' => bcrypt('password123'),
            'role' => 'teacher',
            'status' => 'active',
            'subject' => 'math',
            'bio' => 'مدرس الرياضيات للثانوية العامة',
            'grades' => ['third_secondary'],
            'phone' => '01012345678',
            'wallet_balance' => 5000.00,
        ]);

        $this->publishedCourse = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'كورس الرياضيات للثانوية العامة',
            'slug' => 'كورس-الرياضيات-للثانوية-العامة',
            'description' => 'شرح تفصيلي للمنهج كاملاً مع حل تمارين مكثفة',
            'price' => 200.00,
            'grade' => 'third_secondary',
            'subject' => 'math',
            'is_published' => true,
            'is_bundle' => false,
        ]);

        $this->unpublishedCourse = Course::create([
            'teacher_id' => $this->teacher->id,
            'title' => 'كورس سري غير منشور',
            'slug' => 'كورس-سري-غير-منشور',
            'description' => 'هذا الكورس لا يجب أن يظهر في الـ SEO',
            'price' => 500.00,
            'grade' => 'third_secondary',
            'subject' => 'math',
            'is_published' => false,
            'is_bundle' => false,
        ]);
    }

    /**
     * Test public teacher resolution with various formats
     */
    public function test_teacher_resolution_by_id_and_arabic_variants_and_slugs(): void
    {
        // 1. Numeric ID
        $responseId = $this->getJson('/api/teachers/' . $this->teacher->id);
        $responseId->assertStatus(200)
            ->assertJsonPath('teacher.id', $this->teacher->id);

        // 2. Exact slug (جمعه-العيادي)
        $responseSlug = $this->getJson('/api/teachers/' . urlencode($this->teacher->slug));
        $responseSlug->assertStatus(200)
            ->assertJsonPath('teacher.id', $this->teacher->id);

        // 3. Arabic Teh/Heh variant (جمعة-العيادي)
        $responseTeh = $this->getJson('/api/teachers/' . urlencode('جمعة-العيادي'));
        $responseTeh->assertStatus(200)
            ->assertJsonPath('teacher.id', $this->teacher->id);

        // 4. Name with generic prefix stripped (مستر-جمعة-العيادي)
        $responsePrefix = $this->getJson('/api/teachers/' . urlencode('مستر-جمعة-العيادي'));
        $responsePrefix->assertStatus(200)
            ->assertJsonPath('teacher.id', $this->teacher->id);

        // 5. Transliterated alias (jomaa-aleyady)
        $responseTranslit = $this->getJson('/api/teachers/jomaa-aleyady');
        $responseTranslit->assertStatus(200)
            ->assertJsonPath('teacher.id', $this->teacher->id);
    }

    /**
     * Test public course resolution with slug and ID
     */
    public function test_course_resolution_by_slug_and_id(): void
    {
        // By ID
        $responseId = $this->getJson('/api/courses/' . $this->publishedCourse->id);
        $responseId->assertStatus(200)
            ->assertJsonPath('course.id', $this->publishedCourse->id);

        // By slug
        $responseSlug = $this->getJson('/api/courses/' . urlencode($this->publishedCourse->slug));
        $responseSlug->assertStatus(200)
            ->assertJsonPath('course.id', $this->publishedCourse->id);
    }

    /**
     * Test security: unpublished courses are rejected on public endpoint
     */
    public function test_unpublished_course_not_accessible_publicly(): void
    {
        $response = $this->getJson('/api/courses/' . $this->unpublishedCourse->id);
        $response->assertStatus(404);
    }

    /**
     * Test security boundary: sensitive teacher fields are stripped
     */
    public function test_public_teacher_does_not_leak_private_data(): void
    {
        $response = $this->getJson('/api/teachers/' . $this->teacher->id);
        $response->assertStatus(200);

        $json = $response->json();
        $this->assertArrayNotHasKey('password', $json['teacher']);
        $this->assertArrayNotHasKey('wallet_balance', $json['teacher']);
        $this->assertArrayNotHasKey('phone', $json['teacher']);
        // Only public courses should be in courses list
        $courses = $json['courses'];
        $courseIds = collect($courses)->pluck('id')->all();
        $this->assertContains($this->publishedCourse->id, $courseIds);
        $this->assertNotContains($this->unpublishedCourse->id, $courseIds);
    }

    /**
     * Test sitemaps do not contain private routes or unpublished courses
     */
    public function test_sitemaps_content_and_security(): void
    {
        // General sitemap
        $resSitemap = $this->get('/sitemap.xml');
        $resSitemap->assertStatus(200);
        $content = $resSitemap->getContent();

        $this->assertStringNotContainsString('/login', $content);
        $this->assertStringNotContainsString('/register', $content);
        $this->assertStringNotContainsString('/admin', $content);
        $this->assertStringNotContainsString('/student', $content);
        $this->assertStringNotContainsString('/api/', $content);
        $this->assertStringNotContainsString('كورس-سري-غير-منشور', $content);

        // Courses sitemap
        $resCoursesSitemap = $this->get('/sitemap-courses.xml');
        $resCoursesSitemap->assertStatus(200);
        $coursesContent = $resCoursesSitemap->getContent();
        $this->assertStringNotContainsString('كورس-سري-غير-منشور', $coursesContent);

        // Teachers sitemap
        $resTeachersSitemap = $this->get('/sitemap-teachers.xml');
        $resTeachersSitemap->assertStatus(200);
        $teachersContent = $resTeachersSitemap->getContent();
        $this->assertStringContainsString('/teacher/', $teachersContent);
    }

    /**
     * Test robots.txt allows public content and disallows private content
     */
    public function test_robots_txt_directives(): void
    {
        $resRobots = $this->get('/robots.txt');
        $resRobots->assertStatus(200);
        $content = $resRobots->getContent();

        $this->assertStringContainsString('Allow: /', $content);
        $this->assertStringContainsString('Allow: /assets/*', $content);
        $this->assertStringContainsString('Allow: /teachers', $content);
        $this->assertStringContainsString('Allow: /courses', $content);

        $this->assertStringContainsString('Disallow: /admin/*', $content);
        $this->assertStringContainsString('Disallow: /student/*', $content);
        $this->assertStringContainsString('Disallow: /api/*', $content);
        $this->assertStringContainsString('Disallow: /teacher/dashboard', $content);

        $this->assertStringContainsString('Sitemap: https://khotwtak.com/sitemap.xml', $content);
    }
}
