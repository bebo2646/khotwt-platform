<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;

class PublicStatisticsTest extends TestCase
{
    public function test_home_endpoint_returns_dynamic_statistics(): void
    {
        $response = $this->getJson('/api/home');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'stats' => [
                'teachers_count',
                'courses_count',
                'lessons_count',
                'courses_and_lessons_count',
                'students_count',
            ],
            'featured_courses',
            'popular_teachers',
        ]);

        $stats = $response->json('stats');
        $this->assertIsInt($stats['teachers_count']);
        $this->assertIsInt($stats['courses_count']);
        $this->assertIsInt($stats['lessons_count']);
        $this->assertIsInt($stats['courses_and_lessons_count']);
        $this->assertIsInt($stats['students_count']);
        $this->assertEquals($stats['courses_count'] + $stats['lessons_count'], $stats['courses_and_lessons_count']);
    }

    public function test_public_statistics_endpoint_returns_identical_accurate_metrics(): void
    {
        $homeResponse = $this->getJson('/api/home');
        $statsResponse = $this->getJson('/api/public/statistics');

        $homeResponse->assertStatus(200);
        $statsResponse->assertStatus(200);

        $homeStats = $homeResponse->json('stats');
        $statsData = $statsResponse->json();

        $this->assertEquals($homeStats['teachers_count'], $statsData['teachers_count']);
        $this->assertEquals($homeStats['courses_count'], $statsData['courses_count']);
        $this->assertEquals($homeStats['lessons_count'], $statsData['lessons_count']);
        $this->assertEquals($homeStats['courses_and_lessons_count'], $statsData['courses_and_lessons_count']);
        $this->assertEquals($homeStats['students_count'], $statsData['students_count']);
    }

    public function test_statistics_respect_active_and_published_scopes(): void
    {
        $activeTeachers = User::where('role', 'teacher')->where('status', 'active')->count();
        $activeStudents = User::where('role', 'student')->where('status', 'active')->count();
        $publishedCourses = Course::where('is_published', true)->count();
        $publishedLessons = Lesson::whereHas('unit.course', function ($q) {
            $q->where('is_published', true);
        })->count();

        $response = $this->getJson('/api/public/statistics');

        $response->assertStatus(200);
        $response->assertJson([
            'teachers_count' => $activeTeachers,
            'students_count' => $activeStudents,
            'courses_count' => $publishedCourses,
            'lessons_count' => $publishedLessons,
            'courses_and_lessons_count' => $publishedCourses + $publishedLessons,
        ]);
    }
}
