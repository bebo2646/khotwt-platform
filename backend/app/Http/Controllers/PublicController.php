<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\VideoProgress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PublicController extends Controller
{
    /**
     * Get home page statistics and lists.
     */
    public function home()
    {
        // Database statistics
        $teachersCount = User::where('role', 'teacher')->where('status', 'active')->count();
        $coursesCount = Course::where('is_published', true)->count();
        $studentsCount = User::where('role', 'student')->count();

        // Featured published courses (up to 6)
        $featuredCourses = Course::with('teacher')
            ->where('is_published', true)
            ->latest()
            ->take(6)
            ->get();

        // Popular teachers (based on student enrollment counts)
        $popularTeachers = User::where('role', 'teacher')
            ->where('status', 'active')
            ->withCount(['courses as students_count' => function ($query) {
                $query->join('enrollments', 'courses.id', '=', 'enrollments.course_id');
            }])
            ->orderBy('students_count', 'desc')
            ->take(4)
            ->get();

        return response()->json([
            'stats' => [
                'teachers_count' => $teachersCount,
                'courses_count' => $coursesCount,
                'students_count' => $studentsCount,
            ],
            'featured_courses' => $featuredCourses,
            'popular_teachers' => $popularTeachers,
        ]);
    }

    /**
     * AJAX Cascading Filter 1: Get subjects for a grade based on published courses.
     */
    public function filterSubjects(Request $request)
    {
        $request->validate(['grade' => 'required|string']);
        $grade = $request->grade;

        $subjects = Course::where('grade', $grade)
            ->where('is_published', true)
            ->distinct()
            ->pluck('subject');

        return response()->json($subjects);
    }

    /**
     * AJAX Cascading Filter 2: Get teachers teaching a subject in a grade.
     */
    public function filterTeachers(Request $request)
    {
        $request->validate([
            'grade' => 'required|string',
            'subject' => 'required|string'
        ]);

        $grade = $request->grade;
        $subject = $request->subject;

        $teachers = User::where('role', 'teacher')
            ->where('status', 'active')
            ->where(function ($q) use ($grade, $subject) {
                // Either matching course criteria
                $q->whereHas('courses', function ($query) use ($grade, $subject) {
                    $query->where('grade', $grade)
                        ->where('subject', $subject)
                        ->where('is_published', true);
                })
                // Or matching explicit profile subject & grade fields
                ->orWhere(function ($query) use ($grade, $subject) {
                    $query->where('subject', $subject)
                        ->whereJsonContains('grades', $grade);
                });
            })
            ->get();

        return response()->json($teachers);
    }

    /**
     * Get teachers list.
     */
    public function teachers()
    {
        $teachers = User::where('role', 'teacher')
            ->where('status', 'active')
            ->withCount(['courses as students_count' => function ($query) {
                $query->join('enrollments', 'courses.id', '=', 'enrollments.course_id');
            }])
            ->get();

        return response()->json($teachers);
    }

    /**
     * Get a specific teacher's profile.
     */
    public function teacherProfile($id)
    {
        $query = User::where('role', 'teacher')
            ->where('status', 'active');

        if (is_numeric($id)) {
            $query->where('id', $id);
        } else {
            $slug = strtolower(urldecode($id));
            $query->where(function($q) use ($slug) {
                $q->where('slug', $slug)
                  ->orWhere('name', 'like', '%' . str_replace('-', ' ', $slug) . '%');
            });
        }

        $teacher = $query->withCount(['courses as students_count' => function ($query) {
                $query->join('enrollments', 'courses.id', '=', 'enrollments.course_id');
            }])
            ->first();

        // Fallback search if not found
        if (!$teacher && !is_numeric($id)) {
            $parts = explode('-', str_replace('_', '-', urldecode($id)));
            $teacher = User::where('role', 'teacher')
                ->where('status', 'active')
                ->where(function($q) use ($parts) {
                    foreach ($parts as $part) {
                        if (strlen($part) > 2) {
                            $q->orWhere('name', 'like', '%' . $part . '%');
                        }
                    }
                })
                ->withCount(['courses as students_count' => function ($query) {
                    $query->join('enrollments', 'courses.id', '=', 'enrollments.course_id');
                }])
                ->first();
        }

        if (!$teacher) {
            abort(404, 'Teacher not found');
        }

        $teacherId = $teacher->id;

        $courses = Course::where('teacher_id', $teacherId)
            ->where('is_published', true)
            ->get();

        // Get monthly packages created by this teacher
        $packages = \App\Models\Package::whereHas('course', function ($q) use ($teacherId) {
            $q->where('teacher_id', $teacherId);
        })->with(['lessons', 'course'])->withCount('enrollments')->get();

        return response()->json([
            'teacher' => $teacher,
            'courses' => $courses,
            'packages' => $packages,
            'statistics' => [
                'courses_count' => $courses->count(),
                'students_count' => $teacher->students_count,
            ]
        ]);
    }

    /**
     * Browse all courses with search/filtering.
     */
    public function courses(Request $request)
    {
        $query = Course::with('teacher')->withCount('lessons')->where('is_published', true);

        if ($request->has('grade') && $request->grade) {
            $query->where('grade', $request->grade);
        }

        if ($request->has('subject') && $request->subject) {
            $query->where('subject', $request->subject);
        }

        if ($request->has('teacher_id') && $request->teacher_id) {
            $query->where('teacher_id', $request->teacher_id);
        }

        if ($request->has('search') && $request->search) {
            $query->where('title', 'ilike', '%' . $request->search . '%');
        }

        $courses = $query->latest()->get();

        return response()->json($courses);
    }

    /**
     * Browse all packages with search/filtering.
     */
    public function packages(Request $request)
    {
        $query = \App\Models\Package::with(['course.teacher', 'lessons'])
            ->withCount('enrollments');

        // Apply filters through the associated course
        $query->whereHas('course', function ($q) use ($request) {
            $q->where('is_published', true);

            if ($request->has('grade') && $request->grade) {
                $q->where('grade', $request->grade);
            }

            if ($request->has('subject') && $request->subject) {
                $q->where('subject', $request->subject);
            }

            if ($request->has('teacher_id') && $request->teacher_id) {
                $q->where('teacher_id', $request->teacher_id);
            }
        });

        if ($request->has('search') && $request->search) {
            $query->where('title', 'ilike', '%' . $request->search . '%');
        }

        $packages = $query->latest()->get();

        return response()->json($packages);
    }

    /**
     * View a course detail (Accordion layout structure).
     */
    public function courseDetail($id, Request $request)
    {
        $query = Course::with('teacher')->where('is_published', true);
        if (is_numeric($id)) {
            $query->where('id', $id);
        } else {
            $slug = strtolower(urldecode($id));
            $query->where('slug', $slug);
        }
        $course = $query->first();

        if (!$course) {
            $slug = strtolower(urldecode($id));
            $course = Course::with('teacher')
                ->where('is_published', true)
                ->where('title', 'like', '%' . str_replace('-', ' ', $slug) . '%')
                ->first();
        }

        if (!$course) {
            abort(404, 'Course not found');
        }

        $courseId = $course->id;

        // Standard hierarchy: Course -> Units -> Lessons
        $units = \App\Models\Unit::where('course_id', $courseId)
            ->with(['lessons' => function ($query) {
                $query->orderBy('order');
            }])
            ->orderBy('order')
            ->get();

        $packages = \App\Models\Package::where('course_id', $courseId)->with('lessons')->withCount('enrollments')->get();

        // Check if student is enrolled (Sanctum auth token might be passed)
        $isEnrolled = false;
        $user = Auth::guard('sanctum')->user();
        $lastWatchedVideo = null;

        if ($user) {
            if ($user->isAdmin() || ($user->isTeacher() && $course->teacher_id === $user->id)) {
                $isEnrolled = true;
            } elseif ($user->isStudent()) {
                $isEnrolled = Enrollment::where('student_id', $user->id)
                    ->where('course_id', $courseId)
                    ->exists();

                if ($isEnrolled) {
                    // Find last watched video position for "متابعة المشاهدة"
                    $lastWatched = VideoProgress::where('student_id', $user->id)
                        ->whereHas('video.lesson.unit', function ($q) use ($courseId) {
                            $q->where('course_id', $courseId);
                        })
                        ->orderBy('updated_at', 'desc')
                        ->first();

                    if ($lastWatched) {
                        $lastWatched->load('video.lesson');
                        $lastWatchedVideo = [
                            'video_id' => $lastWatched->video_id,
                            'video_title' => $lastWatched->video->title,
                            'lesson_title' => $lastWatched->video->lesson->title,
                            'last_position_seconds' => $lastWatched->last_position_seconds,
                            'formatted_time' => sprintf('%02d:%02d', ($lastWatched->last_position_seconds / 60), ($lastWatched->last_position_seconds % 60)),
                        ];
                    }
                }
            }
        }

        // Clean lesson data if NOT enrolled (hide actual video links and file paths)
        // Keep structure so visitors can see curriculum list
        $unitsFormatted = $units->map(function ($unit) use ($isEnrolled) {
            return [
                'id' => $unit->id,
                'title' => $unit->title,
                'order' => $unit->order,
                'lessons' => $unit->lessons->map(function ($lesson) use ($isEnrolled) {
                    $lessonData = [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'description' => $lesson->description,
                        'order' => $lesson->order,
                    ];

                    $isLocked = false;
                    $user = \Illuminate\Support\Facades\Auth::guard('sanctum')->user();
                    if ($user && $user->isStudent()) {
                        $isLocked = $lesson->isLockedForStudent($user->id);
                    }
                    $lessonData['is_locked'] = $isLocked;

                    // Attach content counts to visitor
                    $lessonData['videos_count'] = $lesson->videos()->count();
                    $lessonData['pdfs_count'] = $lesson->pdfs()->count();
                    $lessonData['exams_count'] = $lesson->exams()->count();

                    if ($isEnrolled && !$isLocked) {
                        // Include full details
                        $lessonData['videos'] = $lesson->videos;
                        $lessonData['pdfs'] = $lesson->pdfs;
                        $lessonData['exams'] = $lesson->exams;
                    }

                    return $lessonData;
                }),
            ];
        });

        return response()->json([
            'course' => $course,
            'units' => $unitsFormatted,
            'packages' => $packages,
            'is_enrolled' => $isEnrolled,
            'last_watched' => $lastWatchedVideo,
        ]);
    }

    /**
     * Get system configuration status.
     */
    public function config()
    {
        return response()->json([
            'development_mode' => filter_var(env('DEVELOPMENT_MODE', false), FILTER_VALIDATE_BOOLEAN),
            'bunny_stream_configured' => !empty(config('services.bunny.library_id')),
        ]);
    }
}

