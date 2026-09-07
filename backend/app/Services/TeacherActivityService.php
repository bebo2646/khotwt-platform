<?php

namespace App\Services;

use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Exam;
use App\Models\TeacherActivityLog;
use App\Models\TeacherSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TeacherActivityService
{
    /**
     * Unified active threshold across the entire platform.
     */
    public const ACTIVE_THRESHOLD_MINUTES = StudentActivityService::ACTIVE_THRESHOLD_MINUTES;

    /**
     * Core logging method with bulletproof fail-safe error handling.
     */
    public static function log(
        User|int $teacher,
        string $eventType,
        string $eventName,
        ?string $description = null,
        array $context = [],
        ?array $metadata = null,
        ?Request $request = null
    ): ?TeacherActivityLog {
        try {
            $teacherId = $teacher instanceof User ? $teacher->id : (int)$teacher;

            // Only track teachers
            if ($teacher instanceof User && $teacher->role !== 'teacher') {
                return null;
            }

            if (!$teacherId) {
                return null;
            }

            $req = $request ?: request();
            $ipAddress = $req ? $req->ip() : null;
            $userAgent = $req ? substr((string)$req->header('User-Agent'), 0, 500) : null;

            $sessionIdentifier = $context['session_identifier']
                ?? ($teacher instanceof User ? $teacher->current_session_token : null)
                ?? ($req ? $req->header('X-Session-Token') : null);

            // Clean metadata to guarantee no passwords, secrets or tokens are stored
            $safeMetadata = self::sanitizeMetadata($metadata);

            $activity = TeacherActivityLog::create([
                'teacher_id' => $teacherId,
                'event_type' => $eventType,
                'event_name' => $eventName,
                'description' => $description,
                'course_id' => $context['course_id'] ?? null,
                'unit_id' => $context['unit_id'] ?? null,
                'lesson_id' => $context['lesson_id'] ?? null,
                'video_id' => $context['video_id'] ?? null,
                'exam_id' => $context['exam_id'] ?? null,
                'metadata' => $safeMetadata,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'session_identifier' => $sessionIdentifier,
                'occurred_at' => Carbon::now(),
            ]);

            // Keep active session updated with current action
            $currentAction = $context['current_action'] ?? $eventName;
            $currentPage = $context['current_page'] ?? null;
            self::touchSession($teacherId, $sessionIdentifier, $currentAction, $currentPage, $req);

            return $activity;
        } catch (\Throwable $e) {
            // Fail-safe: NEVER break the primary business transaction
            Log::warning('TeacherActivityService::log failed: ' . $e->getMessage(), [
                'event_type' => $eventType,
                'exception' => $e,
            ]);
            return null;
        }
    }

    /**
     * Start a new teacher session upon login or fresh auth session.
     */
    public static function startSession(User $teacher, ?Request $request = null): ?TeacherSession
    {
        try {
            if ($teacher->role !== 'teacher') {
                return null;
            }

            $req = $request ?: request();
            $ipAddress = $req ? $req->ip() : null;
            $userAgent = $req ? (string)$req->header('User-Agent') : null;
            $sessionIdentifier = $teacher->current_session_token ?: (string) Str::uuid();

            // Close any previous open sessions for this teacher
            TeacherSession::where('teacher_id', $teacher->id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'ended_at' => Carbon::now(),
                ]);

            $deviceType = StudentActivityService::detectDeviceType($userAgent);
            $browser = StudentActivityService::detectBrowser($userAgent);

            $session = TeacherSession::create([
                'teacher_id' => $teacher->id,
                'session_identifier' => $sessionIdentifier,
                'ip_address' => $ipAddress,
                'user_agent' => substr((string)$userAgent, 0, 500),
                'device_type' => $deviceType,
                'browser' => $browser,
                'current_page' => 'لوحة التحكم',
                'current_action' => 'في لوحة التحكم',
                'started_at' => Carbon::now(),
                'last_activity_at' => Carbon::now(),
                'ended_at' => null,
                'is_active' => true,
                'duration_seconds' => 0,
            ]);

            // Update user last activity
            $teacher->update(['last_activity' => Carbon::now()]);

            // Log session started & login events
            self::log(
                $teacher,
                'teacher_session_started',
                'بدء جلسة عمل جديدة',
                'بدء جلسة إدارة جديدة للمعلم عبر ' . ($browser ?: 'متصفح الويب') . ' (' . ($deviceType ?: 'جهاز') . ')',
                [
                    'session_identifier' => $sessionIdentifier,
                    'current_page' => 'لوحة التحكم',
                    'current_action' => 'في لوحة التحكم',
                ],
                ['device' => $deviceType, 'browser' => $browser],
                $req
            );

            return $session;
        } catch (\Throwable $e) {
            Log::warning('TeacherActivityService::startSession failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * End active session on explicit logout.
     */
    public static function endSession(User $teacher, ?Request $request = null): void
    {
        try {
            if ($teacher->role !== 'teacher') {
                return;
            }

            $req = $request ?: request();
            $now = Carbon::now();

            $activeSession = TeacherSession::where('teacher_id', $teacher->id)
                ->where('is_active', true)
                ->latest('last_activity_at')
                ->first();

            if ($activeSession) {
                $duration = $activeSession->started_at ? $now->diffInSeconds($activeSession->started_at) : 0;
                $activeSession->update([
                    'is_active' => false,
                    'ended_at' => $now,
                    'duration_seconds' => max(0, (int)$duration),
                ]);

                self::log(
                    $teacher,
                    'teacher_session_ended',
                    'انتهاء جلسة العمل',
                    'تم تسجيل الخروج وإنهاء جلسة المعلم (المدة: ' . StudentActivityService::formatDurationHuman($duration) . ')',
                    ['session_identifier' => $activeSession->session_identifier],
                    ['duration_seconds' => $duration],
                    $req
                );
            }

            self::log(
                $teacher,
                'teacher_logout',
                'تسجيل الخروج',
                'قام المعلم بتسجيل الخروج من المنصة',
                [],
                null,
                $req
            );
        } catch (\Throwable $e) {
            Log::warning('TeacherActivityService::endSession failed: ' . $e->getMessage());
        }
    }

    /**
     * Record heartbeat / touch session activity.
     */
    public static function heartbeat(
        User $teacher,
        ?string $currentPage = null,
        ?string $currentAction = null,
        ?string $sessionIdentifier = null,
        ?Request $request = null
    ): void {
        try {
            if ($teacher->role !== 'teacher') {
                return;
            }

            $req = $request ?: request();
            $token = $sessionIdentifier ?: $teacher->current_session_token ?: ($req ? $req->header('X-Session-Token') : null);

            self::touchSession($teacher->id, $token, $currentAction, $currentPage, $req);
            $teacher->update(['last_activity' => Carbon::now()]);
        } catch (\Throwable $e) {
            Log::warning('TeacherActivityService::heartbeat failed: ' . $e->getMessage());
        }
    }

    /**
     * Internal helper to touch active session timestamp, current page/action, and elapsed duration.
     */
    public static function touchSession(
        int $teacherId,
        ?string $sessionIdentifier = null,
        ?string $currentAction = null,
        ?string $currentPage = null,
        ?Request $request = null
    ): void {
        try {
            $now = Carbon::now();
            $query = TeacherSession::where('teacher_id', $teacherId)->where('is_active', true);

            if ($sessionIdentifier) {
                $session = (clone $query)->where('session_identifier', $sessionIdentifier)->first();
            } else {
                $session = $query->latest('last_activity_at')->first();
            }

            $updateData = [
                'last_activity_at' => $now,
            ];

            if ($currentAction) {
                $updateData['current_action'] = $currentAction;
            }
            if ($currentPage) {
                $updateData['current_page'] = $currentPage;
            }

            if ($session) {
                $duration = $session->started_at ? $now->diffInSeconds($session->started_at) : 0;
                $updateData['duration_seconds'] = max(0, (int)$duration);
                $session->update($updateData);
            } else {
                // If no active session found, auto-create one
                $req = $request ?: request();
                $userAgent = $req ? (string)$req->header('User-Agent') : null;
                TeacherSession::create([
                    'teacher_id' => $teacherId,
                    'session_identifier' => $sessionIdentifier ?: (string) Str::uuid(),
                    'ip_address' => $req ? $req->ip() : null,
                    'user_agent' => substr((string)$userAgent, 0, 500),
                    'device_type' => StudentActivityService::detectDeviceType($userAgent),
                    'browser' => StudentActivityService::detectBrowser($userAgent),
                    'current_page' => $currentPage ?: 'لوحة التحكم',
                    'current_action' => $currentAction ?: 'متصل الآن',
                    'started_at' => $now,
                    'last_activity_at' => $now,
                    'is_active' => true,
                    'duration_seconds' => 0,
                ]);
            }
        } catch (\Throwable $e) {
            // Non-blocking
        }
    }

    // =========================================================================
    // HELPER LOGGERS FOR DOMAIN EVENTS
    // =========================================================================

    public static function logLogin(User $teacher, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'teacher_login',
            'تسجيل الدخول',
            'تسجيل دخول ناجح للمعلم إلى لوحة التحكم',
            ['current_page' => 'لوحة التحكم', 'current_action' => 'تسجيل الدخول'],
            ['role' => 'teacher'],
            $request
        );
    }

    public static function logCourseCreated(User $teacher, Course $course, ?Request $request = null): void
    {
        $isBundle = (bool)$course->is_bundle;
        $name = $isBundle ? 'إنشاء باقة جديدة' : 'إنشاء كورس جديد';
        $desc = ($isBundle ? 'قام بإنشاء باقة جديدة: ' : 'قام بإنشاء كورس جديد: ') . $course->title;

        self::log(
            $teacher,
            $isBundle ? 'bundle_created' : 'course_created',
            $name,
            $desc,
            [
                'course_id' => $course->id,
                'current_action' => 'أنشأ كورس: ' . $course->title,
                'current_page' => 'إدارة الكورسات',
            ],
            ['price' => $course->price, 'subject' => $course->subject, 'grade' => $course->grade],
            $request
        );
    }

    public static function logCourseUpdated(User $teacher, Course $course, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'course_updated',
            'تعديل كورس',
            'قام بتعديل بيانات الكورس: ' . $course->title,
            [
                'course_id' => $course->id,
                'current_action' => 'بيعدل كورس: ' . $course->title,
                'current_page' => 'إدارة الكورسات',
            ],
            ['title' => $course->title, 'price' => $course->price],
            $request
        );
    }

    public static function logCourseDeleted(User $teacher, int $courseId, string $courseTitle, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'course_deleted',
            'حذف كورس',
            'قام بحذف الكورس: ' . $courseTitle,
            [
                'course_id' => null,
                'current_action' => 'حذف كورس: ' . $courseTitle,
                'current_page' => 'إدارة الكورسات',
            ],
            ['deleted_course_id' => $courseId, 'title' => $courseTitle],
            $request
        );
    }

    public static function logUnitCreated(User $teacher, Unit $unit, Course $course, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'unit_created',
            'إضافة وحدة جديدة',
            'قام بإضافة وحدة جديدة: "' . $unit->title . '" ضمن كورس ' . $course->title,
            [
                'course_id' => $course->id,
                'unit_id' => $unit->id,
                'current_action' => 'بيضيف وحدة في: ' . $course->title,
                'current_page' => 'إدارة الكورس',
            ],
            ['unit_title' => $unit->title, 'course_title' => $course->title],
            $request
        );
    }

    public static function logUnitUpdated(User $teacher, Unit $unit, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'unit_updated',
            'تعديل وحدة',
            'قام بتعديل بيانات الوحدة: ' . $unit->title,
            [
                'course_id' => $unit->course_id,
                'unit_id' => $unit->id,
                'current_action' => 'بيعدل وحدة: ' . $unit->title,
                'current_page' => 'إدارة الكورس',
            ],
            ['unit_title' => $unit->title],
            $request
        );
    }

    public static function logUnitDeleted(User $teacher, int $unitId, string $unitTitle, ?int $courseId = null, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'unit_deleted',
            'حذف وحدة',
            'قام بحذف الوحدة: ' . $unitTitle,
            [
                'course_id' => $courseId,
                'current_action' => 'حذف وحدة: ' . $unitTitle,
                'current_page' => 'إدارة الكورس',
            ],
            ['deleted_unit_id' => $unitId, 'unit_title' => $unitTitle],
            $request
        );
    }

    public static function logLessonCreated(User $teacher, Lesson $lesson, ?Course $course = null, ?Request $request = null): void
    {
        $courseTitle = $course ? $course->title : ($lesson->unit?->course?->title);
        $courseId = $course ? $course->id : ($lesson->unit?->course_id);

        self::log(
            $teacher,
            'lesson_created',
            'إضافة محاضرة جديدة',
            'قام بإضافة درس/محاضرة: "' . $lesson->title . '"' . ($courseTitle ? ' في كورس ' . $courseTitle : ''),
            [
                'course_id' => $courseId,
                'unit_id' => $lesson->unit_id,
                'lesson_id' => $lesson->id,
                'current_action' => 'بيضيف محاضرة: ' . $lesson->title,
                'current_page' => 'إدارة المحتوى',
            ],
            ['lesson_title' => $lesson->title, 'course_title' => $courseTitle],
            $request
        );
    }

    public static function logLessonUpdated(User $teacher, Lesson $lesson, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'lesson_updated',
            'تعديل محاضرة',
            'قام بتعديل المحاضرة: ' . $lesson->title,
            [
                'course_id' => $lesson->unit?->course_id,
                'unit_id' => $lesson->unit_id,
                'lesson_id' => $lesson->id,
                'current_action' => 'بيعدل محاضرة: ' . $lesson->title,
                'current_page' => 'إدارة المحتوى',
            ],
            ['lesson_title' => $lesson->title],
            $request
        );
    }

    public static function logLessonDeleted(User $teacher, int $lessonId, string $lessonTitle, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'lesson_deleted',
            'حذف محاضرة',
            'قام بحذف المحاضرة: ' . $lessonTitle,
            [
                'current_action' => 'حذف محاضرة: ' . $lessonTitle,
                'current_page' => 'إدارة المحتوى',
            ],
            ['deleted_lesson_id' => $lessonId, 'lesson_title' => $lessonTitle],
            $request
        );
    }

    public static function logVideoUploaded(User $teacher, Video $video, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'video_uploaded',
            'رفع فيديو جديد',
            'قام برفع فيديو جديد: "' . $video->title . '" بنجاح على سيرفر الفيديو',
            [
                'lesson_id' => $video->lesson_id,
                'video_id' => $video->id,
                'current_action' => 'رفع فيديو: ' . $video->title,
                'current_page' => 'إدارة الفيديوهات',
            ],
            [
                'video_title' => $video->title,
                'duration_seconds' => $video->duration_seconds,
            ],
            $request
        );
    }

    public static function logVideoUpdated(User $teacher, Video $video, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'video_updated',
            'تعديل فيديو',
            'قام بتعديل بيانات الفيديو: ' . $video->title,
            [
                'lesson_id' => $video->lesson_id,
                'video_id' => $video->id,
                'current_action' => 'بيعدل فيديو: ' . $video->title,
                'current_page' => 'إدارة الفيديوهات',
            ],
            ['video_title' => $video->title],
            $request
        );
    }

    public static function logVideoDeleted(User $teacher, int $videoId, string $videoTitle, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'video_deleted',
            'حذف فيديو',
            'قام بحذف الفيديو: ' . $videoTitle,
            [
                'current_action' => 'حذف فيديو: ' . $videoTitle,
                'current_page' => 'إدارة الفيديوهات',
            ],
            ['deleted_video_id' => $videoId, 'video_title' => $videoTitle],
            $request
        );
    }

    public static function logVideoReplaced(User $teacher, Video $video, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'video_replaced',
            'استبدال ملف فيديو',
            'قام باستبدال ملف الفيديو: ' . $video->title,
            [
                'lesson_id' => $video->lesson_id,
                'video_id' => $video->id,
                'current_action' => 'استبدال فيديو: ' . $video->title,
                'current_page' => 'إدارة الفيديوهات',
            ],
            ['video_title' => $video->title],
            $request
        );
    }

    public static function logPdfUploaded(User $teacher, $pdf, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'pdf_uploaded',
            'رفع مذكرة / ملف PDF',
            'قام برفع ملف PDF جديد: "' . $pdf->title . '"',
            [
                'lesson_id' => $pdf->lesson_id,
                'current_action' => 'رفع PDF: ' . $pdf->title,
                'current_page' => 'إدارة المذكرات',
            ],
            ['pdf_title' => $pdf->title],
            $request
        );
    }

    public static function logPdfUpdated(User $teacher, $pdf, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'pdf_updated',
            'تعديل ملف PDF',
            'قام بتعديل ملف PDF: ' . $pdf->title,
            [
                'lesson_id' => $pdf->lesson_id,
                'current_action' => 'بيعدل PDF: ' . $pdf->title,
                'current_page' => 'إدارة المذكرات',
            ],
            ['pdf_title' => $pdf->title],
            $request
        );
    }

    public static function logPdfDeleted(User $teacher, int $pdfId, string $pdfTitle, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'pdf_deleted',
            'حذف ملف PDF',
            'قام بحذف ملف PDF: ' . $pdfTitle,
            [
                'current_action' => 'حذف PDF: ' . $pdfTitle,
                'current_page' => 'إدارة المذكرات',
            ],
            ['deleted_pdf_id' => $pdfId, 'pdf_title' => $pdfTitle],
            $request
        );
    }

    public static function logExamCreated(User $teacher, Exam $exam, ?Request $request = null): void
    {
        $isMonthly = (bool)$exam->is_standalone_monthly;
        $eventName = $isMonthly ? 'إنشاء امتحان شهري' : 'إنشاء اختبار درس';
        $desc = ($isMonthly ? 'قام بإنشاء امتحان شهري جديد: ' : 'قام بإنشاء اختبار جديد: ') . $exam->title;

        self::log(
            $teacher,
            $isMonthly ? 'monthly_exam_created' : 'quiz_created',
            $eventName,
            $desc,
            [
                'exam_id' => $exam->id,
                'lesson_id' => $exam->lesson_id,
                'current_action' => ($isMonthly ? 'ينشئ امتحاناً شهرياً: ' : 'ينشئ اختباراً: ') . $exam->title,
                'current_page' => 'إدارة الامتحانات',
            ],
            [
                'exam_title' => $exam->title,
                'type' => $exam->type,
                'is_monthly' => $isMonthly,
                'price' => $exam->price,
            ],
            $request
        );
    }

    public static function logExamUpdated(User $teacher, Exam $exam, ?Request $request = null): void
    {
        $isMonthly = (bool)$exam->is_standalone_monthly;
        $eventName = $isMonthly ? 'تعديل امتحان شهري' : 'تعديل اختبار';
        $desc = ($isMonthly ? 'قام بتعديل الامتحان الشهري: ' : 'قام بتعديل الاختبار: ') . $exam->title;

        self::log(
            $teacher,
            $isMonthly ? 'monthly_exam_updated' : 'quiz_updated',
            $eventName,
            $desc,
            [
                'exam_id' => $exam->id,
                'lesson_id' => $exam->lesson_id,
                'current_action' => 'بيعدل امتحان: ' . $exam->title,
                'current_page' => 'إدارة الامتحانات',
            ],
            ['exam_title' => $exam->title],
            $request
        );
    }

    public static function logExamDeleted(User $teacher, int $examId, string $examTitle, bool $isMonthly = false, ?Request $request = null): void
    {
        self::log(
            $teacher,
            $isMonthly ? 'monthly_exam_deleted' : 'quiz_deleted',
            $isMonthly ? 'حذف امتحان شهري' : 'حذف اختبار',
            ($isMonthly ? 'قام بحذف الامتحان الشهري: ' : 'قام بحذف الاختبار: ') . $examTitle,
            [
                'current_action' => 'حذف امتحان: ' . $examTitle,
                'current_page' => 'إدارة الامتحانات',
            ],
            ['deleted_exam_id' => $examId, 'exam_title' => $examTitle],
            $request
        );
    }

    public static function logExamAnswersUnlocked(User $teacher, Exam $exam, User $student, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'exam_answers_unlocked',
            'إلغاء حظر / فتح إجابات طالب',
            'قام بفتح وإتاحة مراجعة الإجابات للطالب: ' . $student->name . ' في امتحان: ' . $exam->title,
            [
                'exam_id' => $exam->id,
                'current_action' => 'فتح إجابات الطالب: ' . $student->name,
                'current_page' => 'مراجعة النتائج',
            ],
            ['student_id' => $student->id, 'student_name' => $student->name, 'exam_title' => $exam->title],
            $request
        );
    }

    public static function logStudentAttemptGraded(User $teacher, $attempt, ?Request $request = null): void
    {
        $studentName = $attempt->student?->name ?? ('طالب #' . $attempt->student_id);
        $examTitle = $attempt->exam?->title ?? '';

        self::log(
            $teacher,
            'student_attempt_graded',
            'تصحيح إجابات طالب',
            'قام بتصحيح وتحديد درجة الطالب: ' . $studentName . ' في امتحان: ' . $examTitle,
            [
                'exam_id' => $attempt->exam_id,
                'current_action' => 'بيصحح امتحان للطالب: ' . $studentName,
                'current_page' => 'مراجعة النتائج',
            ],
            ['attempt_id' => $attempt->id, 'score' => $attempt->score],
            $request
        );
    }

    public static function logRevenueReportViewed(User $teacher, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'revenue_report_viewed',
            'استعراض تقرير الأرباح',
            'قام باستعراض تقرير الأرباح والمبيعات الخاص به',
            [
                'current_action' => 'بيفتح تقرير الأرباح والمبيعات',
                'current_page' => 'تقرير الأرباح',
            ],
            null,
            $request
        );
    }

    public static function logSubscriptionViewed(User $teacher, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'subscription_viewed',
            'استعراض تفاصيل الاشتراك',
            'قام باستعراض باقة اشتراكه وموارده المتاحة',
            [
                'current_action' => 'بيدير اشتراك المنصة',
                'current_page' => 'الاشتراك',
            ],
            null,
            $request
        );
    }

    public static function logStorageStatsViewed(User $teacher, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'storage_stats_viewed',
            'استعراض استهلاك التخزين',
            'قام باستعراض إحصائيات استهلاك مساحة التخزين الخاصة بفيديوهاته',
            [
                'current_action' => 'بيراجع مساحة التخزين',
                'current_page' => 'مساحة التخزين',
            ],
            null,
            $request
        );
    }

    public static function logStudentsListViewed(User $teacher, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'students_list_viewed',
            'استعراض قائمة الطلاب',
            'قام باستعراض قائمة المشتركين والطلاب في كورساته',
            [
                'current_action' => 'بيراجع قائمة المشتركين',
                'current_page' => 'الطلاب المشتركون',
            ],
            null,
            $request
        );
    }

    public static function logStudentAnalyticsViewed(User $teacher, User $student, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'student_analytics_viewed',
            'استعراض تحليلات طالب',
            'قام بفتح واستعراض سجل وأداء الطالب: ' . $student->name,
            [
                'current_action' => 'بيراجع تقرير الطالب: ' . $student->name,
                'current_page' => 'تحليلات الطلاب',
            ],
            ['student_id' => $student->id, 'student_name' => $student->name],
            $request
        );
    }

    public static function logProfileUpdated(User $teacher, ?Request $request = null): void
    {
        self::log(
            $teacher,
            'teacher_profile_updated',
            'تحديث الملف الشخصي',
            'قام بتحديث بيانات الملف الشخصي',
            [
                'current_action' => 'يعدل بيانات الملف الشخصي',
                'current_page' => 'الملف الشخصي',
            ],
            null,
            $request
        );
    }

    /**
     * Strip private secrets, passwords, tokens and cards from metadata.
     */
    public static function sanitizeMetadata(?array $metadata): ?array
    {
        if (empty($metadata)) {
            return null;
        }

        $blacklistedKeys = [
            'password',
            'password_confirmation',
            'token',
            'access_token',
            'api_key',
            'secret',
            'card_number',
            'cvv',
            'authorization',
        ];

        $clean = [];
        foreach ($metadata as $k => $v) {
            $lowerKey = strtolower((string)$k);
            if (in_array($lowerKey, $blacklistedKeys)) {
                continue;
            }
            if (is_array($v)) {
                $clean[$k] = self::sanitizeMetadata($v);
            } else {
                $clean[$k] = $v;
            }
        }

        return $clean;
    }
}
