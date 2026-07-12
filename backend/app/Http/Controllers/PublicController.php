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
            ->withCount(['courses as published_courses_count' => function ($query) {
                $query->where('is_published', true);
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
                    $query->where(function ($sq) use ($subject) {
                        $sq->where('subject', $subject)
                           ->orWhere('subject', 'LIKE', $subject . ',%')
                           ->orWhere('subject', 'LIKE', '%,' . $subject)
                           ->orWhere('subject', 'LIKE', '%,' . $subject . ',%');
                    })->whereJsonContains('grades', $grade);
                });
            })
            ->withCount(['courses as published_courses_count' => function ($query) {
                $query->where('is_published', true);
            }])
            ->get();

        return response()->json($teachers);
    }

    /**
     * Get teachers list.
     */
    public function teachers(Request $request)
    {
        $teachingMode = $request->input('teaching_mode');
        $cacheKey = 'public_teachers_list_' . ($teachingMode ?: 'all');

        $teachers = \Cache::remember($cacheKey, 300, function() use ($teachingMode) {
            $query = User::where('role', 'teacher')
                ->where('status', 'active');

            if ($teachingMode) {
                if ($teachingMode === 'online') {
                    $query->whereIn('teaching_mode', ['online', 'both']);
                } elseif ($teachingMode === 'center') {
                    $query->whereIn('teaching_mode', ['center', 'both']);
                } elseif ($teachingMode === 'both') {
                    $query->where('teaching_mode', 'both');
                }
            }

            return $query->withCount(['courses as students_count' => function ($query) {
                    $query->join('enrollments', 'courses.id', '=', 'enrollments.course_id');
                }])
                ->withCount(['courses as published_courses_count' => function ($query) {
                    $query->where('is_published', true);
                }])
                ->get();
        });

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
            ->withCount(['courses as published_courses_count' => function ($query) {
                $query->where('is_published', true);
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
                ->withCount(['courses as published_courses_count' => function ($query) {
                    $query->where('is_published', true);
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

        if ($request->has('availability') && $request->availability) {
            $query->where('availability', $request->availability);
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
        if (str_starts_with($id, 'bundle-')) {
            $packageId = str_replace('bundle-', '', $id);
            $package = \App\Models\Package::with(['lessons.unit.course', 'teacher'])->findOrFail($packageId);

            $course = (object) [
                'id' => 'bundle-' . $package->id,
                'title' => $package->title,
                'description' => $package->description,
                'cover_image' => $package->package_thumbnail ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
                'teacher_id' => $package->teacher_id,
                'teacher' => $package->teacher,
                'is_published' => true,
            ];

            // Group lessons by unit
            $lessons = $package->lessons()->with(['videos', 'pdfs', 'exams'])->get();
            $units = $lessons->groupBy('unit_id')->map(function ($unitLessons) {
                $firstLesson = $unitLessons->first();
                $originalUnit = $firstLesson->unit;
                return [
                    'id' => $originalUnit->id,
                    'title' => $originalUnit->title . ' (' . $originalUnit->course->title . ')',
                    'course_id' => $originalUnit->course_id,
                    'lessons' => $unitLessons->map(function ($l) {
                        return [
                            'id' => $l->id,
                            'title' => $l->title,
                            'description' => $l->description,
                            'price' => $l->price,
                            'videos' => $l->videos,
                            'pdfs' => $l->pdfs,
                            'exams' => $l->exams,
                        ];
                    }),
                ];
            })->values();

            $isEnrolled = false;
            $user = Auth::guard('sanctum')->user();
            if ($user) {
                if ($user->isAdmin() || ($user->isTeacher() && $package->teacher_id === $user->id)) {
                    $isEnrolled = true;
                } elseif ($user->isStudent()) {
                    $isEnrolled = Enrollment::where('student_id', $user->id)
                        ->where('package_id', $package->id)
                        ->exists();
                }
            }

            return response()->json([
                'course' => $course,
                'units' => $units,
                'packages' => [],
                'is_enrolled' => $isEnrolled,
                'last_watched' => null,
                'availability_message' => null,
                'view_limit_exceeded' => false,
            ]);
        }

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

        if ($course->is_bundle) {
            $childCourses = $course->childCourses()
                ->with(['units' => function ($q) {
                    $q->orderBy('order')->with(['lessons' => function ($l) {
                        $l->orderBy('order')->with(['videos', 'pdfs', 'exams']);
                    }]);
                }])
                ->get();

            $isEnrolled = false;
            $user = \Illuminate\Support\Facades\Auth::guard('sanctum')->user();
            if ($user) {
                if ($user->isAdmin() || ($user->isTeacher() && $course->teacher_id === $user->id)) {
                    $isEnrolled = true;
                } elseif ($user->isStudent()) {
                    $isEnrolled = \App\Services\StudentAccessService::hasAccess($user->id, $course->id);
                }
            }

            $isStudent = $user && $user->isStudent();
            $viewLimitExceeded = false;
            $viewLimitDetails = null;
            if ($user && $user->isStudent() && $isEnrolled) {
                if ($course->hasExceededViewLimitForStudent($user->id)) {
                    $viewLimitExceeded = true;
                }
                $viewLimitDetails = $course->getStudentViewLimitDetails($user->id);
            }

            // Fetch progresses if student
            $videoProgresses = [];
            $pdfProgresses = [];
            $examAttempts = [];
            if ($user && $user->isStudent()) {
                $childIds = \DB::table('course_bundle_items')->where('parent_id', $course->id)->pluck('child_id')->toArray();
                $lessonIds = \App\Models\Lesson::whereIn('unit_id', function ($q) use ($childIds) {
                    $q->select('id')->from('units')->whereIn('course_id', $childIds);
                })->pluck('id');

                $videoIds = \App\Models\Video::whereIn('lesson_id', $lessonIds)->pluck('id');
                $pdfIds = \App\Models\Pdf::whereIn('lesson_id', $lessonIds)->pluck('id');
                $examIds = \App\Models\Exam::whereIn('lesson_id', $lessonIds)->pluck('id');

                $videoProgresses = \App\Models\VideoProgress::where('student_id', $user->id)
                    ->where('course_id', $course->id)
                    ->whereIn('video_id', $videoIds)
                    ->get()
                    ->keyBy('video_id');

                $pdfProgresses = \App\Models\StudentPdfProgress::where('student_id', $user->id)
                    ->where('course_id', $course->id)
                    ->whereIn('pdf_id', $pdfIds)
                    ->get()
                    ->keyBy('pdf_id');

                $examAttempts = \App\Models\StudentExam::where('student_id', $user->id)
                    ->where('course_id', $course->id)
                    ->whereIn('exam_id', $examIds)
                    ->get()
                    ->groupBy('exam_id');
            }

            $bundleId = $course->id;
            $formatUnits = function ($units) use ($isEnrolled, $course, $isStudent, $videoProgresses, $pdfProgresses, $examAttempts, $viewLimitDetails, $viewLimitExceeded, $bundleId, $user) {
                return $units->map(function ($unit) use ($isEnrolled, $course, $isStudent, $videoProgresses, $pdfProgresses, $examAttempts, $viewLimitDetails, $viewLimitExceeded, $bundleId, $user) {
                    return [
                        'id' => $unit->id,
                        'title' => $unit->title,
                        'order' => $unit->order,
                        'child_course_id' => $unit->child_course_id ?? null,
                        'child_course_title' => $unit->child_course_title ?? null,
                        'lessons' => $unit->lessons->map(function ($lesson) use ($isEnrolled, $course, $isStudent, $videoProgresses, $pdfProgresses, $examAttempts, $viewLimitDetails, $viewLimitExceeded, $bundleId, $user) {
                            $matchingPackageId = null;
                            $hasLessonAccess = $isEnrolled;
                            $ownsCourse = $isEnrolled;
                            $ownsLessonDirect = false;

                            $lessonData = [
                                'id' => $lesson->id,
                                'title' => $lesson->title,
                                'description' => $lesson->description,
                                'order' => $lesson->order,
                                'owns_course' => $ownsCourse,
                                'owns_lesson_direct' => $ownsLessonDirect,
                                'matching_package_id' => $matchingPackageId,
                                'package_id' => null,
                                'course_id' => $bundleId,
                            ];

                            $isLocked = !$hasLessonAccess;
                            $lessonData['is_locked'] = $isLocked;

                            $lessonData['videos_count'] = $lesson->videos->count();
                            $lessonData['pdfs_count'] = $lesson->pdfs->count();
                            $lessonData['exams_count'] = $lesson->exams->count();

                            $secured = $hasLessonAccess && !$isLocked && !$viewLimitExceeded;

                            $lessonData['videos'] = $lesson->videos->map(function ($video) use ($secured, $course, $isStudent, $videoProgresses, $lesson, $user) {
                                $videoSecured = $secured && !($course->availability === 'center' && $isStudent);
                                
                                $progress = isset($videoProgresses[$video->id]) ? $videoProgresses[$video->id] : null;
                                
                                // Fetch the actual course of the lesson for view limit tracking!
                                $physicalCourse = $lesson->unit->course;
                                $physicalLimitDetails = $user ? $physicalCourse->getStudentViewLimitDetails($user->id) : null;

                                $viewsUsed = $physicalLimitDetails ? (int)$physicalLimitDetails['views_used'] : 0;
                                $watchedSeconds = $progress ? (int)$progress->watched_seconds : 0;
                                $watchedPercentage = $progress ? (float)$progress->watched_percentage : 0.00;
                                $completed = $progress ? (bool)$progress->completed : false;
                                $lastPosition = $progress ? (int)$progress->last_position_seconds : 0;
                                $lastWatchedAt = $progress && $progress->updated_at ? $progress->updated_at->toIso8601String() : null;

                                $limitEnabled = $physicalLimitDetails && $physicalLimitDetails['limit_enabled'];
                                $totalAllowed = $limitEnabled ? (int)$physicalLimitDetails['total_allowed_views'] : -1;
                                $viewsRemaining = $limitEnabled ? (int)$physicalLimitDetails['remaining_views'] : -1;

                                if ($completed) {
                                    $status = 'completed';
                                } elseif ($watchedPercentage > 0) {
                                    $status = 'in_progress';
                                } else {
                                    $status = 'not_started';
                                }

                                return [
                                    'id' => $video->id,
                                    'title' => $video->title,
                                    'duration_seconds' => $video->duration_seconds,
                                    'duration_text' => $video->duration_text,
                                    'is_locked' => !$videoSecured,
                                    'video_url' => $videoSecured ? $video->video_url : null,
                                    'bunny_id' => $videoSecured ? $video->bunny_id : null,
                                    'progress' => [
                                        'views_used' => $viewsUsed,
                                        'watched_seconds' => $watchedSeconds,
                                        'watched_percentage' => $watchedPercentage,
                                        'completed' => $completed,
                                        'last_position_seconds' => $lastPosition,
                                        'last_watched_at' => $lastWatchedAt,
                                        'views_allowed' => $totalAllowed,
                                        'views_remaining' => $viewsRemaining,
                                        'status' => $status,
                                    ]
                                ];
                            });

                            $lessonData['pdfs'] = $lesson->pdfs->map(function ($pdf) use ($secured, $pdfProgresses) {
                                $progress = isset($pdfProgresses[$pdf->id]) ? $pdfProgresses[$pdf->id] : null;
                                $openCount = $progress ? (int)$progress->open_count : 0;
                                $lastOpenedAt = $progress && $progress->updated_at ? $progress->updated_at->toIso8601String() : null;

                                return [
                                    'id' => $pdf->id,
                                    'title' => $pdf->title,
                                    'file_path' => $secured ? $pdf->file_path : null,
                                    'file_size' => $pdf->file_size,
                                    'page_count' => $pdf->page_count,
                                    'is_locked' => !$secured,
                                    'progress' => [
                                        'open_count' => $openCount,
                                        'last_opened_at' => $lastOpenedAt,
                                        'status' => $openCount > 0 ? 'completed' : 'not_started',
                                    ]
                                ];
                            });

                            $lessonData['exams'] = $lesson->exams->map(function ($exam) use ($secured, $examAttempts) {
                                $attempts = isset($examAttempts[$exam->id]) ? $examAttempts[$exam->id] : collect();
                                $completedAttempt = $attempts->where('status', 'completed')->first();
                                $inProgressAttempt = $attempts->where('status', 'started')->first();

                                $status = 'not_started';
                                $score = null;
                                if ($completedAttempt) {
                                    $status = 'completed';
                                    $score = $completedAttempt->score;
                                } elseif ($inProgressAttempt) {
                                    $status = 'in_progress';
                                }

                                return [
                                    'id' => $exam->id,
                                    'title' => $exam->title,
                                    'type' => $exam->type,
                                    'duration_minutes' => $exam->duration_minutes,
                                    'is_locked' => !$secured,
                                    'progress' => [
                                        'status' => $status,
                                        'score' => $score,
                                        'attempts_count' => $attempts->count(),
                                    ]
                                ];
                            });

                            return $lessonData;
                        })
                    ];
                });
            };

            $flatUnits = collect();
            foreach ($childCourses as $child) {
                foreach ($child->units as $unit) {
                    $unit->child_course_id = $child->id;
                    $unit->child_course_title = $child->title;
                    $flatUnits->push($unit);
                }
            }

            return response()->json([
                'course' => $course,
                'child_courses' => $childCourses,
                'units' => $formatUnits($flatUnits),
                'packages' => [],
                'is_enrolled' => $isEnrolled,
                'last_watched' => null,
                'availability_message' => null,
                'view_limit_exceeded' => $viewLimitExceeded,
                'view_limit_details' => $viewLimitDetails,
            ]);
        }

        $courseId = $course->id;

        $packageId = $request->input('package_id');
        $requestLessonId = $request->input('lesson_id');

        $unitsQuery = \App\Models\Unit::where('course_id', $courseId)
            ->orderBy('order');

        if ($packageId) {
            $packageLessonIds = \DB::table('package_lessons')
                ->where('package_id', $packageId)
                ->pluck('lesson_id')
                ->toArray();

            $unitsQuery->with(['lessons' => function ($query) use ($packageLessonIds) {
                $query->whereIn('id', $packageLessonIds)->orderBy('order');
            }]);
        } elseif ($requestLessonId) {
            $unitsQuery->with(['lessons' => function ($query) use ($requestLessonId) {
                $query->where('id', $requestLessonId)->orderBy('order');
            }]);
        } else {
            $unitsQuery->with(['lessons' => function ($query) {
                $query->orderBy('order');
            }]);
        }

        $units = $unitsQuery->get();

        if ($packageId || $requestLessonId) {
            $units = $units->filter(function ($unit) {
                return $unit->lessons->count() > 0;
            })->values();
        }

        $packages = \App\Models\Package::where('course_id', $courseId)->with('lessons')->withCount('enrollments')->get();

        // Check if student is enrolled (Sanctum auth token might be passed)
        $isEnrolled = false;
        $user = Auth::guard('sanctum')->user();
        $lastWatchedVideo = null;
        $isStudent = true;

        $viewLimitExceeded = false;
        if ($user) {
            if ($user->isAdmin() || ($user->isTeacher() && $course->teacher_id === $user->id)) {
                $isEnrolled = true;
                $isStudent = false;
            } elseif ($user->isStudent()) {
                $isStudent = true;
                
                // Direct course enrollment
                $courseEnroll = \App\Models\Enrollment::where('student_id', $user->id)
                    ->where('course_id', $courseId)
                    ->whereNull('package_id')
                    ->whereNull('lesson_id')
                    ->exists();

                // Direct package enrollment (if package is active)
                $packageEnroll = false;
                if ($packageId) {
                    $packageEnroll = \App\Models\Enrollment::where('student_id', $user->id)
                        ->where('package_id', $packageId)
                        ->exists();
                } else {
                    $allCoursePackageIds = \App\Models\Package::where('course_id', $courseId)->pluck('id');
                    $packageEnroll = \App\Models\Enrollment::where('student_id', $user->id)
                        ->whereIn('package_id', $allCoursePackageIds)
                        ->exists();
                }

                // Direct lesson enrollment (if lesson is active)
                $lessonEnroll = false;
                if ($requestLessonId) {
                    $lessonEnroll = \App\Models\Enrollment::where('student_id', $user->id)
                        ->where('lesson_id', $requestLessonId)
                        ->exists();
                } else {
                    $allCourseLessonIds = \App\Models\Lesson::whereHas('unit', function($q) use ($courseId) {
                        $q->where('course_id', $courseId);
                    })->pluck('id');
                    $lessonEnroll = \App\Models\Enrollment::where('student_id', $user->id)
                        ->whereIn('lesson_id', $allCourseLessonIds)
                        ->exists();
                }

                $isEnrolled = $courseEnroll || $packageEnroll || $lessonEnroll;

                if ($isEnrolled) {
                    $context = \App\Services\StudentAccessService::resolveProgressContext($user->id, $courseId, $packageId, $requestLessonId);
                    $contextCourseId = $context['course_id'];
                    $contextPackageId = $context['package_id'];
                    $contextLessonId = $context['lesson_id'];

                    $contextCourse = \App\Models\Course::find($contextCourseId);
                    if ($contextCourse && $contextCourse->hasExceededViewLimitForStudent($user->id)) {
                        $viewLimitExceeded = true;
                    }

                    // Find last watched video position for "متابعة المشاهدة"
                    $lastWatched = VideoProgress::where('student_id', $user->id)
                        ->where('course_id', $contextCourseId)
                        ->where('package_id', $contextPackageId)
                        ->where('lesson_id', $contextLessonId)
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

        $availabilityMessage = null;
        if ($course->availability === 'center' && $isStudent) {
            $availabilityMessage = 'هذا الكورس مخصص لطلاب السنتر.';
        }

        $videoProgresses = [];
        $pdfProgresses = [];
        $examAttempts = [];
        $viewLimitDetails = null;

        if ($user && $user->isStudent()) {
            $courseIdParam = $request->input('course_id') ?: $request->query('course_id');
            $contextCourseId = $courseIdParam ?: $courseId;

            // Find all videos, pdfs, and exams in this course
            $lessonIds = \App\Models\Lesson::whereHas('unit', function ($q) use ($courseId) {
                $q->where('course_id', $courseId);
            })->pluck('id');

            $videoIds = \App\Models\Video::whereIn('lesson_id', $lessonIds)->pluck('id');
            $pdfIds = \App\Models\Pdf::whereIn('lesson_id', $lessonIds)->pluck('id');
            $examIds = \App\Models\Exam::whereIn('lesson_id', $lessonIds)->pluck('id');

            $videoProgresses = \App\Models\VideoProgress::where('student_id', $user->id)
                ->where('course_id', $contextCourseId)
                ->where('package_id', $packageId)
                ->whereIn('video_id', $videoIds)
                ->get()
                ->keyBy('video_id');

            $pdfProgresses = \App\Models\StudentPdfProgress::where('student_id', $user->id)
                ->where('course_id', $contextCourseId)
                ->where('package_id', $packageId)
                ->whereIn('pdf_id', $pdfIds)
                ->get()
                ->keyBy('pdf_id');

            $examAttempts = \App\Models\StudentExam::where('student_id', $user->id)
                ->where('course_id', $contextCourseId)
                ->where('package_id', $packageId)
                ->whereIn('exam_id', $examIds)
                ->get()
                ->groupBy('exam_id');

            if ($isEnrolled) {
                $contextCourse = \App\Models\Course::find($contextCourseId);
                if ($contextCourse) {
                    $viewLimitDetails = $contextCourse->getStudentViewLimitDetails($user->id);
                }
            }
        }

        // Clean lesson data if NOT enrolled or if view limit is exceeded
        $unitsFormatted = $units->map(function ($unit) use ($isEnrolled, $course, $isStudent, $viewLimitExceeded, $videoProgresses, $pdfProgresses, $examAttempts, $viewLimitDetails, $courseId, $packageId, $requestLessonId) {
            return [
                'id' => $unit->id,
                'title' => $unit->title,
                'order' => $unit->order,
                'lessons' => $unit->lessons->map(function ($lesson) use ($isEnrolled, $course, $isStudent, $viewLimitExceeded, $videoProgresses, $pdfProgresses, $examAttempts, $viewLimitDetails, $courseId, $packageId, $requestLessonId) {
                    $matchingPackageId = null;
                    $hasLessonAccess = false;
                    $ownsCourse = false;
                    $ownsLessonDirect = false;

                    $user = \Illuminate\Support\Facades\Auth::guard('sanctum')->user();
                    
                    if ($user && $user->isStudent()) {
                        $hasLessonAccess = \App\Services\StudentAccessService::hasAccess($user->id, $courseId, $packageId, $lesson->id);
                        $ownsCourse = \App\Services\StudentAccessService::hasAccess($user->id, $courseId);

                        if (!$ownsCourse) {
                            $ownsLessonDirect = Enrollment::where('student_id', $user->id)
                                ->where('lesson_id', $lesson->id)
                                ->exists();

                            if (!$ownsLessonDirect) {
                                $ownedPackageEnrollment = Enrollment::where('student_id', $user->id)
                                    ->whereNotNull('package_id')
                                    ->whereIn('package_id', function($subQuery) use ($lesson) {
                                        $subQuery->select('package_id')
                                            ->from('package_lessons')
                                            ->where('lesson_id', $lesson->id);
                                    })
                                    ->first();

                                if ($ownedPackageEnrollment) {
                                    $matchingPackageId = $ownedPackageEnrollment->package_id;
                                }
                            }
                        }
                    } elseif ($user && ($user->isAdmin() || ($user->isTeacher() && $course->teacher_id === $user->id))) {
                        $hasLessonAccess = true;
                        $ownsCourse = true;
                    }

                    $lessonData = [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'description' => $lesson->description,
                        'order' => $lesson->order,
                        'owns_course' => $ownsCourse,
                        'owns_lesson_direct' => $ownsLessonDirect,
                        'matching_package_id' => $matchingPackageId,
                        'package_id' => $packageId ? (int)$packageId : $matchingPackageId,
                        'course_id' => $courseId,
                    ];

                    $isLocked = false;
                    if ($user && $user->isStudent()) {
                        // Locked if previous lesson is not completed (only in Course context)
                        $isLocked = !$hasLessonAccess || ($ownsCourse && $lesson->isLockedForStudent($user->id));
                    } else {
                        $isLocked = !$hasLessonAccess;
                    }
                    $lessonData['is_locked'] = $isLocked;

                    // Attach content counts to visitor
                    $lessonData['videos_count'] = $lesson->videos->count();
                    $lessonData['pdfs_count'] = $lesson->pdfs->count();
                    $lessonData['exams_count'] = $lesson->exams->count();

                    $secured = $hasLessonAccess && !$isLocked && !$viewLimitExceeded;

                    $lessonData['videos'] = $lesson->videos->map(function ($video) use ($secured, $course, $isStudent, $videoProgresses, $viewLimitDetails) {
                        $videoSecured = $secured && !($course->availability === 'center' && $isStudent);
                        
                        $progress = isset($videoProgresses[$video->id]) ? $videoProgresses[$video->id] : null;
                        
                        $viewsUsed = $viewLimitDetails ? (int)$viewLimitDetails['views_used'] : 0;
                        $watchedSeconds = $progress ? (int)$progress->watched_seconds : 0;
                        $watchedPercentage = $progress ? (float)$progress->watched_percentage : 0.00;
                        $completed = $progress ? (bool)$progress->completed : false;
                        $lastPosition = $progress ? (int)$progress->last_position_seconds : 0;
                        $lastWatchedAt = $progress && $progress->updated_at ? $progress->updated_at->toIso8601String() : null;

                        // Allowed views
                        $limitEnabled = $viewLimitDetails && $viewLimitDetails['limit_enabled'];
                        $totalAllowed = $limitEnabled ? (int)$viewLimitDetails['total_allowed_views'] : -1;
                        $viewsRemaining = $limitEnabled ? (int)$viewLimitDetails['remaining_views'] : -1;

                        // Determine status
                        if ($completed) {
                            $status = 'completed'; // مكتمل
                        } elseif ($watchedPercentage > 0) {
                            $status = 'in_progress'; // قيد المشاهدة
                        } else {
                            $status = 'not_started'; // لم يبدأ
                        }

                        return [
                            'id' => $video->id,
                            'title' => $video->title,
                            'duration_seconds' => $video->duration_seconds,
                            'duration_text' => $video->duration_text,
                            'is_locked' => !$videoSecured,
                            'video_url' => $videoSecured ? $video->video_url : null,
                            'bunny_id' => $videoSecured ? $video->bunny_id : null,
                            'progress' => [
                                'views_used' => $viewsUsed,
                                'watched_seconds' => $watchedSeconds,
                                'watched_percentage' => $watchedPercentage,
                                'completed' => $completed,
                                'last_position_seconds' => $lastPosition,
                                'last_watched_at' => $lastWatchedAt,
                                'views_allowed' => $totalAllowed,
                                'views_remaining' => $viewsRemaining,
                                'status' => $status,
                            ]
                        ];
                    });

                    $lessonData['pdfs'] = $lesson->pdfs->map(function ($pdf) use ($secured, $pdfProgresses) {
                        $progress = isset($pdfProgresses[$pdf->id]) ? $pdfProgresses[$pdf->id] : null;
                        
                        $openCount = $progress ? (int)$progress->open_count : 0;
                        $lastOpenedAt = $progress && $progress->last_opened_at ? $progress->last_opened_at->toIso8601String() : null;
                        
                        $status = $openCount > 0 ? 'completed' : 'not_started';

                        return [
                            'id' => $pdf->id,
                            'title' => $pdf->title,
                            'page_count' => $pdf->page_count,
                            'file_size' => $pdf->file_size,
                            'is_locked' => !$secured,
                            'file_path' => $secured ? $pdf->file_path : null,
                            'progress' => [
                                'open_count' => $openCount,
                                'last_opened_at' => $lastOpenedAt,
                                'status' => $status,
                            ]
                        ];
                    });

                    $lessonData['exams'] = $lesson->exams->map(function ($exam) use ($secured, $examAttempts) {
                        $attempts = isset($examAttempts[$exam->id]) ? $examAttempts[$exam->id] : collect([]);
                        
                        $attemptsUsed = $attempts->count();
                        $maxAttempts = $exam->max_attempts ?: 1;
                        $attemptsRemaining = max(0, $maxAttempts - $attemptsUsed);

                        $lastAttempt = $attempts->sortByDesc('created_at')->first();
                        $lastStatus = $lastAttempt ? $lastAttempt->status : null; // started, submitted, graded
                        
                        // Calculate highest score or last attempt score
                        $score = $lastAttempt ? $lastAttempt->score : null;
                        
                        $isHomework = $exam->type === 'homework';
                        
                        // Check if deadline has passed
                        $deadlinePassed = false;
                        if ($exam->close_date) {
                            $closeDateTime = \Carbon\Carbon::parse($exam->close_date->format('Y-m-d') . ' ' . ($exam->close_time ?: '23:59:59'));
                            if (\Carbon\Carbon::now()->gt($closeDateTime)) {
                                $deadlinePassed = true;
                            }
                        }
                        if ($exam->submission_deadline && \Carbon\Carbon::now()->gt($exam->submission_deadline)) {
                            $deadlinePassed = true;
                        }

                        // Determine status
                        if ($attemptsUsed === 0) {
                            if ($deadlinePassed) {
                                $status = 'expired'; // انتهى الموعد
                            } else {
                                $status = 'not_started'; // لم يبدأ
                            }
                        } else {
                            if ($lastStatus === 'graded') {
                                $status = 'graded'; // تم التصحيح / تمت المراجعة
                            } elseif ($lastStatus === 'submitted') {
                                $status = 'submitted'; // تم التسليم / قيد التصحيح
                            } elseif ($lastStatus === 'started') {
                                if ($deadlinePassed) {
                                    $status = 'expired'; // انتهى الموعد
                                } else {
                                    $status = 'in_progress'; // جاري الحل
                                }
                            } else {
                                $status = 'not_started';
                            }
                        }

                        return [
                            'id' => $exam->id,
                            'title' => $exam->title,
                            'type' => $exam->type,
                            'homework_type' => $exam->homework_type ?: 'normal',
                            'is_locked' => !$secured,
                            'time_limit_minutes' => $secured ? $exam->time_limit_minutes : null,
                            'questions_count' => $secured ? $exam->questions()->count() : 0,
                            'max_score' => $exam->max_score,
                            'passing_score' => $exam->passing_score,
                            'max_attempts' => $exam->max_attempts,
                            'open_date' => $exam->open_date ? $exam->open_date->toDateString() : ($exam->start_date ? $exam->start_date->toDateString() : null),
                            'close_date' => $exam->close_date ? $exam->close_date->toDateString() : ($exam->end_date ? $exam->end_date->toDateString() : null),
                            'progress' => [
                                'attempts_used' => $attemptsUsed,
                                'attempts_remaining' => $attemptsRemaining,
                                'last_attempt_status' => $lastStatus,
                                'score' => $score,
                                'status' => $status,
                            ]
                        ];
                    });

                    return $lessonData;
                }),
            ];
        });

        $viewLimitDetails = null;
        if ($user && $user->isStudent() && $isEnrolled) {
            $viewLimitDetails = $course->getStudentViewLimitDetails($user->id);
        }

        return response()->json([
            'course' => $course,
            'units' => $unitsFormatted,
            'packages' => $packages,
            'is_enrolled' => $isEnrolled,
            'last_watched' => $lastWatchedVideo,
            'availability_message' => $availabilityMessage,
            'view_limit_exceeded' => $viewLimitExceeded,
            'view_limit_message' => $viewLimitExceeded ? 'لقد انتهى عدد مرات مشاهدة هذا الكورس. يرجى شراء كود جديد لاستعادة الوصول.' : null,
            'view_limit_details' => $viewLimitDetails,
        ]);
    }

    /**
     * Get system configuration status.
     */
    public function config()
    {
        $libraryId = config('services.bunny.library_id');
        $apiKey = config('services.bunny.api_key');
        $isConfigured = !empty($libraryId) && !empty($apiKey);
        $settings = \App\Models\PlatformSetting::first();

        return response()->json([
            'development_mode' => filter_var(env('DEVELOPMENT_MODE', false), FILTER_VALIDATE_BOOLEAN),
            'bunny_stream_configured' => $isConfigured,
            'bunny_enabled' => $isConfigured,
            'maintenance' => $settings ? (bool)$settings->maintenance_mode : false,
            'maintenance_message' => $settings ? $settings->maintenance_message : null,
            'maintenance_eta' => $settings ? $settings->maintenance_eta : null,
        ]);
    }
}

