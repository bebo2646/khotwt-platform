<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\TeacherActivityLog;
use App\Models\TeacherSession;
use App\Models\StudentSession;
use App\Services\TeacherActivityService;
use App\Services\StudentActivityService;
use Carbon\Carbon;

class TeacherActivityController extends Controller
{
    /**
     * Teacher Heartbeat endpoint (called periodically from teacher client).
     */
    public function heartbeat(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'teacher') {
            return response()->json(['message' => 'غير مصرح.'], 403);
        }

        $currentPage = $request->input('current_page');
        $currentAction = $request->input('current_action');

        TeacherActivityService::heartbeat($user, $currentPage, $currentAction, null, $request);

        return response()->json([
            'success' => true,
            'timestamp' => Carbon::now()->toIso8601String(),
        ]);
    }

    /**
     * Unified Platform Presence endpoint (total people active now + breakdown).
     */
    public function platformPresence(Request $request)
    {
        $threshold = Carbon::now()->subMinutes(TeacherActivityService::ACTIVE_THRESHOLD_MINUTES);

        // 1. Authoritative active counts
        $studentsOnline = StudentSession::where('is_active', true)
            ->where('last_activity_at', '>=', $threshold)
            ->distinct('student_id')
            ->count('student_id');

        $teachersOnline = TeacherSession::where('is_active', true)
            ->where('last_activity_at', '>=', $threshold)
            ->distinct('teacher_id')
            ->count('teacher_id');

        $totalOnline = $studentsOnline + $teachersOnline;

        // 2. Active teachers list with real-time context
        $activeTeachers = TeacherSession::with('teacher:id,name,email,phone,avatar,subject')
            ->where('is_active', true)
            ->where('last_activity_at', '>=', $threshold)
            ->orderBy('last_activity_at', 'desc')
            ->get();

        // 3. Active students list preview (recent 20)
        $activeStudents = StudentSession::with('student:id,name,email,phone,avatar,student_type')
            ->where('is_active', true)
            ->where('last_activity_at', '>=', $threshold)
            ->orderBy('last_activity_at', 'desc')
            ->take(20)
            ->get();

        return response()->json([
            'threshold_minutes' => TeacherActivityService::ACTIVE_THRESHOLD_MINUTES,
            'total_online' => $totalOnline,
            'students_online' => $studentsOnline,
            'teachers_online' => $teachersOnline,
            'active_teachers' => $activeTeachers,
            'active_students' => $activeStudents,
        ]);
    }

    /**
     * Admin: List teacher activity logs with filtering and pagination.
     */
    public function index(Request $request)
    {
        $authUser = $request->user();
        $canViewFinancial = $authUser && ($authUser->is_super_admin || $authUser->is_super || $authUser->hasPermission('teacher_activity.view_financial') || $authUser->hasPermission('teachers.manage'));

        $requestedCategory = $request->input('category', $request->input('event_type'));
        if ($requestedCategory && in_array(strtolower(trim($requestedCategory)), ['finance', 'financial']) && !$canViewFinancial) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية لاستعراض السجلات المالية للمعلمين.'], 403);
        }

        $query = TeacherActivityLog::with([
            'teacher:id,name,email,phone,avatar,subject',
            'course:id,title',
            'unit:id,title',
            'lesson:id,title',
            'video:id,title',
            'exam:id,title,type',
        ]);

        if (!$canViewFinancial) {
            $query->where('event_type', 'not like', '%revenue%')
                  ->where('event_type', 'not like', '%payout%');
        }

        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->teacher_id);
        }

        $eventType = $request->input('event_type', $request->input('category'));
        if ($eventType) {
            if ($eventType === 'courses') {
                $query->where(function ($q) {
                    $q->where('event_type', 'like', 'course_%')
                      ->orWhere('event_type', 'like', 'bundle_%');
                });
            } elseif ($eventType === 'units') {
                $query->where('event_type', 'like', 'unit_%');
            } elseif ($eventType === 'lessons') {
                $query->where('event_type', 'like', 'lesson_%');
            } elseif ($eventType === 'videos') {
                $query->where('event_type', 'like', 'video_%');
            } elseif ($eventType === 'pdfs') {
                $query->where('event_type', 'like', 'pdf_%');
            } elseif ($eventType === 'exams') {
                $query->where(function ($q) {
                    $q->where('event_type', 'like', 'quiz_%')
                      ->orWhere('event_type', 'like', 'exam_%')
                      ->orWhere('event_type', 'like', 'monthly_exam_%');
                });
            } elseif ($eventType === 'finance') {
                $query->where(function ($q) {
                    $q->where('event_type', 'like', '%revenue%')
                      ->orWhere('event_type', 'like', '%subscription%')
                      ->orWhere('event_type', 'like', '%payout%');
                });
            } elseif ($eventType === 'auth') {
                $query->where(function ($q) {
                    $q->where('event_type', 'like', '%login%')
                      ->orWhere('event_type', 'like', '%session%')
                      ->orWhere('event_type', 'like', '%logout%');
                });
            } else {
                $query->where('event_type', $eventType);
            }
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('event_name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('teacher', function ($tq) use ($search) {
                      $tq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

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
     * Admin: Teacher Activity Dashboard Statistics.
     */
    public function stats(Request $request)
    {
        $today = Carbon::today();
        $threshold = Carbon::now()->subMinutes(TeacherActivityService::ACTIVE_THRESHOLD_MINUTES);

        // 1. Teachers active now
        $activeNowCount = TeacherSession::where('is_active', true)
            ->where('last_activity_at', '>=', $threshold)
            ->distinct('teacher_id')
            ->count('teacher_id');

        // 2. Teachers active today
        $teachersActiveToday = TeacherActivityLog::where('occurred_at', '>=', $today)
            ->distinct('teacher_id')
            ->count('teacher_id');

        // 3. Sessions today
        $sessionsTodayCount = TeacherSession::where('started_at', '>=', $today)->count();

        // 4. Content operations today
        $coursesManagedToday = TeacherActivityLog::where(function ($q) {
                $q->where('event_type', 'like', 'course_%')
                  ->orWhere('event_type', 'like', 'bundle_%');
            })
            ->where('occurred_at', '>=', $today)
            ->count();

        $lessonsManagedToday = TeacherActivityLog::where(function ($q) {
                $q->where('event_type', 'like', 'lesson_%')
                  ->orWhere('event_type', 'like', 'unit_%');
            })
            ->where('occurred_at', '>=', $today)
            ->count();

        $videosUploadedToday = TeacherActivityLog::where('event_type', 'video_uploaded')
            ->where('occurred_at', '>=', $today)
            ->count();

        $examsManagedToday = TeacherActivityLog::where(function ($q) {
                $q->where('event_type', 'like', 'quiz_%')
                  ->orWhere('event_type', 'like', 'exam_%')
                  ->orWhere('event_type', 'like', 'monthly_exam_%');
            })
            ->where('occurred_at', '>=', $today)
            ->count();

        // 5. Recent feed (latest 15 teacher events)
        $recentFeed = TeacherActivityLog::with([
                'teacher:id,name,email,phone,avatar,subject',
                'course:id,title',
                'unit:id,title',
                'lesson:id,title',
                'video:id,title',
                'exam:id,title,type',
            ])
            ->orderBy('occurred_at', 'desc')
            ->take(15)
            ->get();

        return response()->json([
            'stats' => [
                'active_teachers_now' => $activeNowCount,
                'teachers_active_today' => $teachersActiveToday,
                'total_sessions_today' => $sessionsTodayCount,
                'courses_managed_today' => $coursesManagedToday,
                'lessons_managed_today' => $lessonsManagedToday,
                'videos_uploaded_today' => $videosUploadedToday,
                'exams_managed_today' => $examsManagedToday,
            ],
            'recent_feed' => $recentFeed,
        ]);
    }

    /**
     * Admin: List teacher sessions (active and ended).
     */
    public function sessions(Request $request)
    {
        $query = TeacherSession::with('teacher:id,name,email,phone,avatar,subject');

        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->teacher_id);
        }

        if ($request->filled('status')) {
            if ($request->status === 'active') {
                $threshold = Carbon::now()->subMinutes(TeacherActivityService::ACTIVE_THRESHOLD_MINUTES);
                $query->where('is_active', true)->where('last_activity_at', '>=', $threshold);
            } elseif ($request->status === 'ended') {
                $threshold = Carbon::now()->subMinutes(TeacherActivityService::ACTIVE_THRESHOLD_MINUTES);
                $query->where(function ($q) use ($threshold) {
                    $q->where('is_active', false)
                      ->orWhere('last_activity_at', '<', $threshold);
                });
            }
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->whereHas('teacher', function ($tq) use ($search) {
                $tq->where('name', 'like', "%{$search}%")
                   ->orWhere('email', 'like', "%{$search}%")
                   ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $sessions = $query->orderBy('last_activity_at', 'desc')->paginate($perPage);

        return response()->json($sessions);
    }

    /**
     * Admin: Get detailed activity profile and timeline for a specific teacher.
     */
    public function teacherActivity(Request $request, $teacherId)
    {
        $teacher = User::where('id', $teacherId)->where('role', 'teacher')->first();
        if (!$teacher) {
            return response()->json(['message' => 'المعلم غير موجود'], 404);
        }

        $today = Carbon::today();
        $threshold = Carbon::now()->subMinutes(TeacherActivityService::ACTIVE_THRESHOLD_MINUTES);

        // 1. Is the teacher currently online?
        $latestSession = TeacherSession::where('teacher_id', $teacherId)
            ->latest('last_activity_at')
            ->first();

        $isOnline = $latestSession
            && $latestSession->is_active
            && $latestSession->last_activity_at
            && $latestSession->last_activity_at->gte($threshold);

        // 2. Last activity record
        $lastActivityLog = TeacherActivityLog::where('teacher_id', $teacherId)
            ->latest('occurred_at')
            ->first();

        // 3. Stats for this teacher
        $totalSessions = TeacherSession::where('teacher_id', $teacherId)->count();
        $totalCoursesManaged = TeacherActivityLog::where('teacher_id', $teacherId)
            ->where(function ($q) {
                $q->where('event_type', 'like', 'course_%')
                  ->orWhere('event_type', 'like', 'bundle_%');
            })->count();
        $totalLessonsCreated = TeacherActivityLog::where('teacher_id', $teacherId)
            ->where('event_type', 'lesson_created')->count();
        $totalVideosUploaded = TeacherActivityLog::where('teacher_id', $teacherId)
            ->where('event_type', 'video_uploaded')->count();
        $totalExamsCreated = TeacherActivityLog::where('teacher_id', $teacherId)
            ->where(function ($q) {
                $q->where('event_type', 'like', 'quiz_%')
                  ->orWhere('event_type', 'like', 'exam_%')
                  ->orWhere('event_type', 'like', 'monthly_exam_%');
            })->count();

        // 4. Activity timeline paginated
        $authUser = $request->user();
        $canViewFinancial = $authUser && ($authUser->is_super_admin || $authUser->is_super || $authUser->hasPermission('teacher_activity.view_financial') || $authUser->hasPermission('teachers.manage'));

        $perPage = min(50, max(1, (int)$request->input('per_page', 20)));
        $timelineQuery = TeacherActivityLog::with([
                'course:id,title',
                'unit:id,title',
                'lesson:id,title',
                'video:id,title',
                'exam:id,title,type',
            ])
            ->where('teacher_id', $teacherId);

        if (!$canViewFinancial) {
            $timelineQuery->where('event_type', 'not like', '%revenue%')
                          ->where('event_type', 'not like', '%payout%');
        }

        $timeline = $timelineQuery->orderBy('occurred_at', 'desc')->paginate($perPage);

        return response()->json([
            'teacher' => [
                'id' => $teacher->id,
                'name' => $teacher->name,
                'email' => $teacher->email,
                'phone' => $teacher->phone,
                'subject' => $teacher->subject,
                'avatar' => $teacher->avatar,
                'status' => $teacher->status,
                'is_online' => (bool)$isOnline,
                'last_activity' => $lastActivityLog ? $lastActivityLog->occurred_at->diffForHumans() : 'لا يوجد نشاط سابق',
                'last_activity_iso' => $lastActivityLog ? $lastActivityLog->occurred_at->toIso8601String() : null,
                'current_action' => $isOnline ? ($latestSession->current_action ?: 'متصل الآن') : 'غير متصل حالياً',
                'current_page' => $isOnline ? ($latestSession->current_page ?: 'لوحة التحكم') : null,
            ],
            'session' => $latestSession ? [
                'session_identifier' => $latestSession->session_identifier,
                'started_at' => $latestSession->started_at?->toIso8601String(),
                'last_activity_at' => $latestSession->last_activity_at?->toIso8601String(),
                'device_type' => $latestSession->device_type,
                'browser' => $latestSession->browser,
                'ip_address' => $latestSession->ip_address,
                'duration_seconds' => $latestSession->duration_seconds,
                'is_active' => (bool)$latestSession->is_active,
            ] : null,
            'summary' => [
                'total_sessions' => $totalSessions,
                'total_courses_managed' => $totalCoursesManaged,
                'total_lessons_created' => $totalLessonsCreated,
                'total_videos_uploaded' => $totalVideosUploaded,
                'total_exams_created' => $totalExamsCreated,
            ],
            'timeline' => $timeline,
        ]);
    }
}
