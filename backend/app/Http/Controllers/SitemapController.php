<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SitemapController extends Controller
{
    /**
     * Resolve the canonical public frontend host.
     */
    protected function getFrontendHost(Request $request): string
    {
        $configured = env('FRONTEND_URL', env('SITE_URL'));
        if (!empty($configured)) {
            return rtrim($configured, '/');
        }
        $host = $request->getSchemeAndHttpHost();
        if (str_contains($host, 'localhost') || str_contains($host, '127.0.0.1') || str_contains($host, 'railway.app')) {
            return 'https://khotwtak.com';
        }
        return rtrim($host, '/');
    }

    /**
     * Main Sitemap Index or Unified Sitemap
     */
    public function index(Request $request)
    {
        $host = $this->getFrontendHost($request);
        
        // Canonical public landing pages (Strictly excluding auth, admin, student, dashboard routes)
        $staticUrls = [
            ['loc' => '', 'freq' => 'daily', 'priority' => '1.0'],
            ['loc' => '/teachers', 'freq' => 'daily', 'priority' => '0.9'],
            ['loc' => '/courses', 'freq' => 'daily', 'priority' => '0.9'],
            ['loc' => '/monthly-exams', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/departments', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/chemistry', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/physics', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/arabic', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/grade-1-secondary', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/grade-2-secondary', 'freq' => 'weekly', 'priority' => '0.8'],
            ['loc' => '/grade-3-secondary', 'freq' => 'weekly', 'priority' => '0.8'],
        ];

        // Subject landing pages
        $subjects = ['chemistry', 'physics', 'integrated_science', 'biology', 'math', 'science', 'arabic', 'english'];
        foreach ($subjects as $subject) {
            $staticUrls[] = ['loc' => "/subject/{$subject}", 'freq' => 'weekly', 'priority' => '0.7'];
        }

        // Grade landing pages
        $grades = ['first-preparatory', 'second-preparatory', 'third-preparatory', 'first-secondary', 'second-secondary', 'third-secondary'];
        foreach ($grades as $grade) {
            $staticUrls[] = ['loc' => "/grade/{$grade}", 'freq' => 'weekly', 'priority' => '0.7'];
        }

        $teachers = User::where('role', 'teacher')->where('status', 'active')->get();
        $courses = Course::where('is_published', true)->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        
        // Static URLs
        foreach ($staticUrls as $item) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$host}{$item['loc']}</loc>\n";
            $xml .= "    <changefreq>{$item['freq']}</changefreq>\n";
            $xml .= "    <priority>{$item['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }

        // Active Teachers
        foreach ($teachers as $teacher) {
            $slug = rawurlencode($teacher->slug ?: 'teacher-' . $teacher->id);
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$host}/teacher/{$slug}</loc>\n";
            $xml .= "    <changefreq>weekly</changefreq>\n";
            $xml .= "    <priority>0.9</priority>\n";
            $xml .= "  </url>\n";
        }

        // Published Courses
        foreach ($courses as $course) {
            $slug = rawurlencode($course->slug ?: 'course-' . $course->id);
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$host}/course/{$slug}</loc>\n";
            $xml .= "    <changefreq>weekly</changefreq>\n";
            $xml .= "    <priority>0.9</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'text/xml; charset=utf-8');
    }

    /**
     * Teachers Sitemap
     */
    public function teachers(Request $request)
    {
        $host = $this->getFrontendHost($request);
        $teachers = User::where('role', 'teacher')->where('status', 'active')->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ($teachers as $teacher) {
            $slug = rawurlencode($teacher->slug ?: 'teacher-' . $teacher->id);
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$host}/teacher/{$slug}</loc>\n";
            $xml .= "    <changefreq>weekly</changefreq>\n";
            $xml .= "    <priority>0.9</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'text/xml; charset=utf-8');
    }

    /**
     * Courses Sitemap
     */
    public function courses(Request $request)
    {
        $host = $this->getFrontendHost($request);
        $courses = Course::where('is_published', true)->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        foreach ($courses as $course) {
            $slug = rawurlencode($course->slug ?: 'course-' . $course->id);
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$host}/course/{$slug}</loc>\n";
            $xml .= "    <changefreq>weekly</changefreq>\n";
            $xml .= "    <priority>0.9</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'text/xml; charset=utf-8');
    }

    /**
     * Dynamic robots.txt
     */
    public function robots(Request $request)
    {
        $host = $this->getFrontendHost($request);
        
        $content = "User-agent: *\n";
        $content .= "Allow: /\n";
        $content .= "Allow: /teachers\n";
        $content .= "Allow: /teachers/*\n";
        $content .= "Allow: /teacher/*\n";
        $content .= "Allow: /courses\n";
        $content .= "Allow: /courses/*\n";
        $content .= "Allow: /course/*\n";
        $content .= "Allow: /monthly-exams\n";
        $content .= "Allow: /departments\n";
        $content .= "Allow: /departments/*\n";
        $content .= "Allow: /subject/*\n";
        $content .= "Allow: /grade/*\n";
        $content .= "Allow: /chemistry\n";
        $content .= "Allow: /physics\n";
        $content .= "Allow: /arabic\n";
        $content .= "Allow: /grade-1-secondary\n";
        $content .= "Allow: /grade-2-secondary\n";
        $content .= "Allow: /grade-3-secondary\n";
        $content .= "Allow: /assets/*\n";
        $content .= "\n";
        $content .= "# Block private, dashboard, and administrative endpoints\n";
        $content .= "Disallow: /admin/\n";
        $content .= "Disallow: /admin/*\n";
        $content .= "Disallow: /student/\n";
        $content .= "Disallow: /student/*\n";
        $content .= "Disallow: /teacher/dashboard/\n";
        $content .= "Disallow: /teacher/dashboard/*\n";
        $content .= "Disallow: /teacher/subscription\n";
        $content .= "Disallow: /teacher/plans\n";
        $content .= "Disallow: /teacher/courses\n";
        $content .= "Disallow: /teacher/bundles\n";
        $content .= "Disallow: /teacher/students\n";
        $content .= "Disallow: /teacher/exams\n";
        $content .= "Disallow: /teacher/revenue\n";
        $content .= "Disallow: /teacher/monthly-exams\n";
        $content .= "Disallow: /teacher/videos\n";
        $content .= "Disallow: /monthly-exams/*/player\n";
        $content .= "Disallow: /monthly-exams/*/results\n";
        $content .= "Disallow: /api/\n";
        $content .= "Disallow: /api/*\n";
        $content .= "Disallow: /change-password\n";
        $content .= "Disallow: /rejected-account\n";
        $content .= "Disallow: /pending-approval\n";
        $content .= "\n";
        $content .= "Sitemap: {$host}/sitemap.xml\n";
        $content .= "Sitemap: {$host}/sitemap-teachers.xml\n";
        $content .= "Sitemap: {$host}/sitemap-courses.xml\n";

        return response($content, 200)->header('Content-Type', 'text/plain; charset=utf-8');
    }
}
