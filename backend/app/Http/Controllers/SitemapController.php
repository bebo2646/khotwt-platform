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
     * Main Sitemap Index or Unified Sitemap
     */
    public function index(Request $request)
    {
        $host = $request->getSchemeAndHttpHost();
        
        $urls = [
            '',
            '/teachers',
            '/courses',
            '/login',
            '/register',
            '/chemistry',
            '/physics',
            '/arabic',
            '/grade-1-secondary',
            '/grade-2-secondary',
            '/grade-3-secondary',
        ];

        // Add subjects
        $subjects = ['chemistry', 'physics', 'integrated_science', 'biology', 'math', 'science', 'arabic', 'english'];
        foreach ($subjects as $subject) {
            $urls[] = "/subject/{$subject}";
        }

        // Add grades
        $grades = ['first-preparatory', 'second-preparatory', 'third-preparatory', 'first-secondary', 'second-secondary', 'third-secondary'];
        foreach ($grades as $grade) {
            $urls[] = "/grade/{$grade}";
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        
        // Static URLs
        foreach ($urls as $url) {
            $xml .= '<url>';
            $xml .= '<loc>' . $host . $url . '</loc>';
            $xml .= '<changefreq>daily</changefreq>';
            $xml .= '<priority>' . ($url === '' ? '1.0' : '0.8') . '</priority>';
            $xml .= '</url>';
        }

        // Reference the other sitemaps or dynamically include everything
        // For fast indexing, we also include the teachers and courses links directly in the main sitemap if it's small,
        // or let it be a sitemap index. Let's make it a unified urlset but also support separate sitemaps.
        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'text/xml');
    }

    /**
     * Teachers Sitemap
     */
    public function teachers(Request $request)
    {
        $host = $request->getSchemeAndHttpHost();
        $teachers = User::where('role', 'teacher')->where('status', 'active')->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        foreach ($teachers as $teacher) {
            $slug = $teacher->slug ?: 'teacher-' . $teacher->id;
            $xml .= '<url>';
            $xml .= '<loc>' . $host . '/teacher/' . $slug . '</loc>';
            $xml .= '<changefreq>weekly</changefreq>';
            $xml .= '<priority>0.9</priority>';
            $xml .= '</url>';
        }

        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'text/xml');
    }

    /**
     * Courses Sitemap
     */
    public function courses(Request $request)
    {
        $host = $request->getSchemeAndHttpHost();
        $courses = Course::where('is_published', true)->get();

        $xml = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        foreach ($courses as $course) {
            $slug = $course->slug ?: 'course-' . $course->id;
            $xml .= '<url>';
            $xml .= '<loc>' . $host . '/course/' . $slug . '</loc>';
            $xml .= '<changefreq>weekly</changefreq>';
            $xml .= '<priority>0.9</priority>';
            $xml .= '</url>';
        }

        $xml .= '</urlset>';

        return response($xml, 200)->header('Content-Type', 'text/xml');
    }

    /**
     * Dynamic robots.txt
     */
    public function robots(Request $request)
    {
        $host = $request->getSchemeAndHttpHost();
        
        $content = "User-agent: *\n";
        $content .= "Allow: /\n";
        $content .= "Allow: /teachers\n";
        $content .= "Allow: /teachers/*\n";
        $content .= "Allow: /teacher/*\n";
        $content .= "Allow: /courses\n";
        $content .= "Allow: /courses/*\n";
        $content .= "Allow: /course/*\n";
        $content .= "Allow: /subject/*\n";
        $content .= "Allow: /grade/*\n";
        $content .= "Allow: /chemistry\n";
        $content .= "Allow: /physics\n";
        $content .= "Allow: /arabic\n";
        $content .= "Allow: /grade-1-secondary\n";
        $content .= "Allow: /grade-2-secondary\n";
        $content .= "Allow: /grade-3-secondary\n";
        $content .= "\n";
        $content .= "Disallow: /admin/\n";
        $content .= "Disallow: /admin/*\n";
        $content .= "Disallow: /teacher/dashboard/\n";
        $content .= "Disallow: /teacher/dashboard/*\n";
        $content .= "Disallow: /student/\n";
        $content .= "Disallow: /student/*\n";
        $content .= "Disallow: /api/\n";
        $content .= "Disallow: /api/*\n";
        $content .= "\n";
        $content .= "Sitemap: {$host}/sitemap.xml\n";
        $content .= "Sitemap: {$host}/sitemap-teachers.xml\n";
        $content .= "Sitemap: {$host}/sitemap-courses.xml\n";

        return response($content, 200)->header('Content-Type', 'text/plain');
    }
}
