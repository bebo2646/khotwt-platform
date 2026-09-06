<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Exam;
use App\Models\VideoProgress;
use App\Models\StudentExam;
use App\Models\StudentActivityLog;
use App\Models\StudentSession;
use App\Services\StudentActivityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class StudentActivityController extends Controller
{
    /**
     * Admin: List all student activity logs with pagination and multi-dimensional filters.
     */
    public function index(Request $request)
    {
        $query = StudentActivityLog::with([
            'student:id,name,email,phone,avatar,student_type,grades',
            'course:id,title,subject,cover_image',
            'bundle:id,title,subject,cover_image',
            'lesson:id,title',
            'video:id,title',
            'exam:id,title,type',
        ]);

        // Filter: Student
        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        // Filter: Search student name/phone/email or description
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('event_name', 'like', "%{$search}%")
                  ->orWhereHas('student', function ($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%");
                  });
            });
        }

        // Filter: Event Type or Group
        if ($request->filled('event_type') && $request->event_type !== 'all') {
            $eventType = $request->event_type;
            if ($eventType === 'auth') {
                $query->whereIn('event_type', ['login', 'logout', 'failed_login', 'session_started', 'session_ended']);
            } elseif ($eventType === 'course') {
                $query->whereIn('event_type', ['course_opened', 'bundle_opened', 'lesson_opened', 'pdf_opened']);
            } elseif ($eventType === 'video') {
                $query->where('event_type', 'like', 'video_%');
            } elseif ($eventType === 'assessment') {
                $query->where(function ($q) {
                    $q->where('event_type', 'like', 'exam_%')
                      ->orWhere('event_type', 'like', 'quiz_%')
                      ->orWhere('event_type', 'like', 'homework_%');
                });
            } elseif ($eventType === 'purchase') {
                $query->where(function ($q) {
                    $q->where('event_type', 'like', '%_purchased')
                      ->orWhere('event_type', 'purchase_failed');
                });
            } elseif ($eventType === 'security') {
                $query->where('event_type', 'anti_cheat_violation');
            } else {
                $query->where('event_type', $eventType);
            }
        }

        // Filter: Course / Bundle / Lesson / Exam
        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }
        if ($request->filled('bundle_id')) {
            $query->where('bundle_id', $request->bundle_id);
        }
        if ($request->filled('lesson_id')) {
            $query->where('lesson_id', $request->lesson_id);
        }
        if ($request->filled('exam_id')) {
            $query->where('exam_id', $request->exam_id);
        }

        // Filter: Date Range
        if ($request->filled('date_from')) {
            $query->where('occurred_at', '>=', Carbon::parse($request->date_from)->startOfDay());
        }
        if ($request->filled('date_to')) {
            $query->where('occurred_at', '<=', Carbon::parse($request->date_to)->endOfDay());
        }

        $perPage = min(100, max(1, (int)$request->input('per_page', 25)));
        $logs = $query->orderBy('occurred_at', 'desc')->paginate($perPage);

        return response()->json($logs);
    }

    /**
     * Admin: Global Activity Dashboard Aggregate Statistics.
     */
    public function stats(Request $request)
    {
        $today = Carbon::today();
        $threshold = Carbon::now()->subMinutes(StudentActivityService::ACTIVE_THRESHOLD_MINUTES);

        // 1. Active students right now (recent heartbeat / session touch)
        $activeNowCount = StudentSession::where('is_active', true)
            ->where('last_activity_at', '>=', $threshold)
            ->distinct('student_id')
            ->count('student_id');

        // 2. Students active today (either sessions or activity logs today)
        $studentsActiveToday = StudentActivityLog::where('occurred_at', '>=', $today)
            ->distinct('student_id')
            ->count('student_id');

        // 3. Sessions today
        $sessionsTodayCount = StudentSession::where('started_at', '>=', $today)->count();

        // 4. Lesson opens today
        $lessonOpensToday = StudentActivityLog::where('event_type', 'lesson_opened')
            ->where('occurred_at', '>=', $today)
            ->count();

        // 5. Video activity today (started, milestone, completed)
        $videoActivityToday = StudentActivityLog::where('event_type', 'like', 'video_%')
            ->where('occurred_at', '>=', $today)
            ->count();

        // 6. Assessment activity today (exams, quizzes, homework)
        $assessmentActivityToday = StudentActivityLog::where(function ($q) {
                $q->where('event_type', 'like', 'exam_%')
                  ->orWhere('event_type', 'like', 'quiz_%')
                  ->orWhere('event_type', 'like', 'homework_%');
            })
            ->where('occurred_at', '>=', $today)
            ->count();

        // 7. Total purchases today
        $purchasesToday = StudentActivityLog::where(function ($q) {
                $q->where('event_type', 'like', '%_purchased');
            })
            ->where('occurred_at', '>=', $today)
            ->count();

        // 8. Recent activities feed (latest 15 events)
        $recentFeed = StudentActivityLog::with([
                'student:id,name,email,phone,avatar',
                'course:id,title',
                'bundle:id,title',
                'lesson:id,title',
                'video:id,title',
                'exam:id,title,type',
            ])
            ->orderBy('occurred_at', 'desc')
            ->take(15)
            ->get();

        return response()->json([
            'stats' => [
                'active_students_now' => $activeNowCount,
                'students_active_today' => $studentsActiveToday,
                'total_sessions_today' => $sessionsTodayCount,
                'total_lesson_opens_today' => $lessonOpensToday,
                'total_video_activity_today' => $videoActivityToday,
                'total_assessment_activity_today' => $assessmentActivityToday,
                'total_purchases_today' => $purchasesToday,
            ],
            'recent_feed' => $recentFeed,
        ]);
    }

    /**
     * Admin: List student sessions (active and recent).
     */
    public function sessions(Request $request)
    {
        $query = StudentSession::with('student:id,name,email,phone,avatar,student_type');

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->filled('status')) {
            if ($request->status === 'active') {
                $threshold = Carbon::now()->subMinutes(StudentActivityService::ACTIVE_THRESHOLD_MINUTES);
                $query->where('is_active', true)->where('last_activity_at', '>=', $threshold);
            } elseif ($request->status === 'ended') {
                $query->where('is_active', false);
            }
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->whereHas('student', function ($sq) use ($search) {
                $sq->where('name', 'like', "%{$search}%")
                   ->orWhere('email', 'like', "%{$search}%")
                   ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $sessions = $query->orderBy('last_activity_at', 'desc')->paginate($perPage);

        return response()->json($sessions);
    }

    /**
     * Admin: Get detailed activity profile and timeline for a specific student.
     */
    public function studentActivity(Request $request, $studentId)
    {
        $student = User::where('id', $studentId)->where('role', 'student')->firstOrFail();
        $today = Carbon::today();
        $threshold = Carbon::now()->subMinutes(StudentActivityService::ACTIVE_THRESHOLD_MINUTES);

        // 1. Is the student currently online?
        $latestSession = StudentSession::where('student_id', $studentId)
            ->latest('last_activity_at')
            ->first();

        $isOnline = $latestSession 
            && $latestSession->is_active 
            && $latestSession->last_activity_at 
            && $latestSession->last_activity_at->gte($threshold);

        // 2. Last activity record
        $lastActivityLog = StudentActivityLog::where('student_id', $studentId)
            ->latest('occurred_at')
            ->first();

        $lastActiveDate = $lastActivityLog ? $lastActivityLog->occurred_at : ($latestSession ? $latestSession->last_activity_at : $student->last_activity);

        // 3. Today's metrics
        $todaySessionsDuration = (int) StudentSession::where('student_id', $studentId)
            ->whereDate('started_at', $today)
            ->sum('duration_seconds');

        $coursesAccessedToday = StudentActivityLog::where('student_id', $studentId)
            ->whereDate('occurred_at', $today)
            ->whereNotNull('course_id')
            ->distinct('course_id')
            ->count('course_id');

        $lessonsOpenedToday = StudentActivityLog::where('student_id', $studentId)
            ->where('event_type', 'lesson_opened')
            ->whereDate('occurred_at', $today)
            ->count();

        $videosWatchedToday = StudentActivityLog::where('student_id', $studentId)
            ->where('event_type', 'like', 'video_%')
            ->whereDate('occurred_at', $today)
            ->count();

        $assessmentsToday = StudentActivityLog::where('student_id', $studentId)
            ->where(function ($q) {
                $q->where('event_type', 'like', 'exam_%')
                  ->orWhere('event_type', 'like', 'quiz_%')
                  ->orWhere('event_type', 'like', 'homework_%');
            })
            ->whereDate('occurred_at', $today)
            ->count();

        // 4. Lifetime totals
        $totalSessions = StudentSession::where('student_id', $studentId)->count();
        $totalEvents = StudentActivityLog::where('student_id', $studentId)->count();
        
        $totalWatchSeconds = (int) VideoProgress::where('student_id', $studentId)->sum('watched_seconds');
        $completedLessons = VideoProgress::where('student_id', $studentId)->where('completed', true)->count();
        
        $distinctCourses = StudentActivityLog::where('student_id', $studentId)
            ->whereNotNull('course_id')
            ->distinct('course_id')
            ->count('course_id');

        $examAttempts = StudentExam::where('student_id', $studentId)->count();

        // 5. Paginated Chronological Activity Timeline
        $timelineQuery = StudentActivityLog::with([
            'course:id,title,subject,cover_image',
            'bundle:id,title,subject,cover_image',
            'lesson:id,title',
            'video:id,title',
            'exam:id,title,type',
        ])
        ->where('student_id', $studentId);

        if ($request->filled('event_type') && $request->event_type !== 'all') {
            $eventType = $request->event_type;
            if ($eventType === 'auth') {
                $timelineQuery->whereIn('event_type', ['login', 'logout', 'failed_login', 'session_started', 'session_ended']);
            } elseif ($eventType === 'course') {
                $timelineQuery->whereIn('event_type', ['course_opened', 'bundle_opened', 'lesson_opened', 'pdf_opened']);
            } elseif ($eventType === 'video') {
                $timelineQuery->where('event_type', 'like', 'video_%');
            } elseif ($eventType === 'assessment') {
                $timelineQuery->where(function ($q) {
                    $q->where('event_type', 'like', 'exam_%')
                      ->orWhere('event_type', 'like', 'quiz_%')
                      ->orWhere('event_type', 'like', 'homework_%');
                });
            } elseif ($eventType === 'purchase') {
                $timelineQuery->where(function ($q) {
                    $q->where('event_type', 'like', '%_purchased')
                      ->orWhere('event_type', 'purchase_failed');
                });
            } elseif ($eventType === 'security') {
                $timelineQuery->where('event_type', 'anti_cheat_violation');
            } else {
                $timelineQuery->where('event_type', $eventType);
            }
        }

        if ($request->filled('date_from')) {
            $timelineQuery->where('occurred_at', '>=', Carbon::parse($request->date_from)->startOfDay());
        }
        if ($request->filled('date_to')) {
            $timelineQuery->where('occurred_at', '<=', Carbon::parse($request->date_to)->endOfDay());
        }

        $perPage = min(100, max(1, (int)$request->input('per_page', 25)));
        $timeline = $timelineQuery->orderBy('occurred_at', 'desc')->paginate($perPage);

        return response()->json([
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'phone' => $student->phone,
                'parent_phone' => $student->parent_phone,
                'grade' => $student->grades ? ($student->grades[0] ?? null) : null,
                'student_type' => $student->student_type,
                'status' => $student->status,
                'avatar' => $student->avatar,
                'created_at' => $student->created_at?->toIso8601String(),
                'is_online' => $isOnline,
                'last_activity' => $lastActiveDate ? $lastActiveDate->diffForHumans() : 'لا يوجد نشاط مسجل',
                'last_activity_iso' => $lastActiveDate ? $lastActiveDate->toIso8601String() : null,
            ],
            'today' => [
                'session_duration_seconds' => $todaySessionsDuration,
                'session_duration_human' => StudentActivityService::formatDurationHuman($todaySessionsDuration),
                'courses_accessed' => $coursesAccessedToday,
                'lessons_opened' => $lessonsOpenedToday,
                'videos_watched' => $videosWatchedToday,
                'assessments_attempted' => $assessmentsToday,
            ],
            'lifetime' => [
                'total_sessions' => $totalSessions,
                'total_events' => $totalEvents,
                'total_watch_seconds' => $totalWatchSeconds,
                'total_watch_minutes' => round($totalWatchSeconds / 60, 1),
                'completed_lessons' => $completedLessons,
                'distinct_courses_accessed' => $distinctCourses,
                'exam_attempts' => $examAttempts,
            ],
            'timeline' => $timeline,
        ]);
    }

    /**
     * Student: Heartbeat endpoint to maintain active session presence.
     */
    public function heartbeat(Request $request)
    {
        $user = $request->user();
        if ($user && $user->role === 'student') {
            StudentActivityService::heartbeat($user, $request->input('session_token'), $request);
            return response()->json(['status' => 'ok', 'active' => true]);
        }
        return response()->json(['status' => 'ignored'], 200);
    }

    /**
     * Student: Log client-side actions (course view, bundle view, focus events).
     */
    public function logClientActivity(Request $request)
    {
        $request->validate([
            'event_type' => 'required|string|in:course_opened,bundle_opened,lesson_opened,pdf_opened,anti_cheat_violation,tab_switch,fullscreen_exit,focus_loss',
            'course_id' => 'nullable|integer',
            'bundle_id' => 'nullable|integer',
            'lesson_id' => 'nullable|integer',
            'exam_id' => 'nullable|integer',
            'metadata' => 'nullable|array',
        ]);

        $user = $request->user();
        if (!$user || $user->role !== 'student') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $eventType = $request->event_type;
        $context = [
            'course_id' => $request->course_id,
            'bundle_id' => $request->bundle_id,
            'lesson_id' => $request->lesson_id,
            'exam_id' => $request->exam_id,
        ];

        // Specific handlers
        if ($eventType === 'course_opened' && $request->course_id) {
            $course = Course::find($request->course_id);
            if ($course) {
                StudentActivityService::logCourseOpened($user, $course, $request->bundle_id, $request);
                return response()->json(['status' => 'logged']);
            }
        } elseif ($eventType === 'bundle_opened' && $request->bundle_id) {
            $bundle = Course::find($request->bundle_id);
            if ($bundle) {
                StudentActivityService::logCourseOpened($user, $bundle, $request->bundle_id, $request);
                return response()->json(['status' => 'logged']);
            }
        } elseif (in_array($eventType, ['anti_cheat_violation', 'tab_switch', 'fullscreen_exit', 'focus_loss']) && $request->exam_id) {
            $exam = Exam::find($request->exam_id);
            if ($exam) {
                StudentActivityService::logAntiCheat($user, $exam, $eventType, $request->metadata ?: [], $request);
                return response()->json(['status' => 'logged']);
            }
        }

        return response()->json(['status' => 'ok']);
    }
}
