<?php

namespace App\Services;

use App\Models\User;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Video;
use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\StudentActivityLog;
use App\Models\StudentSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class StudentActivityService
{
    /**
     * Active threshold in minutes for considering a student online right now.
     */
    public const ACTIVE_THRESHOLD_MINUTES = 5;

    /**
     * Core logging method with bulletproof fail-safe error handling.
     */
    public static function log(
        User|int $student,
        string $eventType,
        string $eventName,
        ?string $description = null,
        array $context = [],
        ?array $metadata = null,
        ?Request $request = null
    ): ?StudentActivityLog {
        try {
            $studentId = $student instanceof User ? $student->id : (int)$student;
            
            // Only track students
            if ($student instanceof User && $student->role !== 'student') {
                return null;
            }

            if (!$studentId) {
                return null;
            }

            $req = $request ?: request();
            $ipAddress = $req ? $req->ip() : null;
            $userAgent = $req ? substr((string)$req->header('User-Agent'), 0, 500) : null;
            
            $sessionIdentifier = $context['session_identifier'] 
                ?? ($student instanceof User ? $student->current_session_token : null)
                ?? ($req ? $req->header('X-Session-Token') : null);

            // Clean metadata to guarantee no passwords, secrets or tokens are stored
            $safeMetadata = self::sanitizeMetadata($metadata);

            $activity = StudentActivityLog::create([
                'student_id' => $studentId,
                'event_type' => $eventType,
                'event_name' => $eventName,
                'description' => $description,
                'course_id' => $context['course_id'] ?? null,
                'bundle_id' => $context['bundle_id'] ?? null,
                'lesson_id' => $context['lesson_id'] ?? null,
                'video_id' => $context['video_id'] ?? null,
                'exam_id' => $context['exam_id'] ?? null,
                'attempt_id' => $context['attempt_id'] ?? null,
                'metadata' => $safeMetadata,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'session_identifier' => $sessionIdentifier,
                'occurred_at' => Carbon::now(),
            ]);

            // Keep active session updated
            self::touchSession($studentId, $sessionIdentifier, $req);

            return $activity;
        } catch (\Throwable $e) {
            // Fail-safe: NEVER break the primary business transaction
            Log::warning('StudentActivityService::log failed: ' . $e->getMessage(), [
                'event_type' => $eventType,
                'exception' => $e,
            ]);
            return null;
        }
    }

    /**
     * Start a new student session upon login or fresh auth session.
     */
    public static function startSession(User $student, ?Request $request = null): ?StudentSession
    {
        try {
            if ($student->role !== 'student') {
                return null;
            }

            $req = $request ?: request();
            $ipAddress = $req ? $req->ip() : null;
            $userAgent = $req ? (string)$req->header('User-Agent') : null;
            $sessionIdentifier = $student->current_session_token ?: (string) Str::uuid();

            // Close any previous open sessions for this student
            StudentSession::where('student_id', $student->id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'ended_at' => Carbon::now(),
                ]);

            $deviceType = self::detectDeviceType($userAgent);
            $browser = self::detectBrowser($userAgent);

            $session = StudentSession::create([
                'student_id' => $student->id,
                'session_identifier' => $sessionIdentifier,
                'ip_address' => $ipAddress,
                'user_agent' => substr((string)$userAgent, 0, 500),
                'device_type' => $deviceType,
                'browser' => $browser,
                'started_at' => Carbon::now(),
                'last_activity_at' => Carbon::now(),
                'ended_at' => null,
                'is_active' => true,
                'duration_seconds' => 0,
            ]);

            // Update user last activity
            $student->update(['last_activity' => Carbon::now()]);

            // Log session started & login events
            self::log(
                $student,
                'session_started',
                'بدء جلسة جديدة',
                'بدء جلسة استخدام جديدة على المنصة عبر ' . ($browser ?: 'متصفح الويب') . ' (' . ($deviceType ?: 'جهاز') . ')',
                ['session_identifier' => $sessionIdentifier],
                ['device' => $deviceType, 'browser' => $browser],
                $req
            );

            return $session;
        } catch (\Throwable $e) {
            Log::warning('StudentActivityService::startSession failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * End active session on explicit logout.
     */
    public static function endSession(User $student, ?Request $request = null): void
    {
        try {
            if ($student->role !== 'student') {
                return;
            }

            $req = $request ?: request();
            $now = Carbon::now();

            $activeSession = StudentSession::where('student_id', $student->id)
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
                    $student,
                    'session_ended',
                    'انتهاء الجلسة',
                    'تم تسجيل الخروج وإنهاء جلسة الاستخدام بنجاح (المدة: ' . self::formatDurationHuman($duration) . ')',
                    ['session_identifier' => $activeSession->session_identifier],
                    ['duration_seconds' => $duration],
                    $req
                );
            }

            self::log(
                $student,
                'logout',
                'تسجيل الخروج',
                'قام الطالب بتسجيل الخروج من المنصة',
                [],
                null,
                $req
            );
        } catch (\Throwable $e) {
            Log::warning('StudentActivityService::endSession failed: ' . $e->getMessage());
        }
    }

    /**
     * Record heartbeat / touch session activity.
     */
    public static function heartbeat(User $student, ?string $sessionIdentifier = null, ?Request $request = null): void
    {
        try {
            if ($student->role !== 'student') {
                return;
            }

            $req = $request ?: request();
            $token = $sessionIdentifier ?: $student->current_session_token ?: ($req ? $req->header('X-Session-Token') : null);

            self::touchSession($student->id, $token, $req);
            $student->update(['last_activity' => Carbon::now()]);
        } catch (\Throwable $e) {
            Log::warning('StudentActivityService::heartbeat failed: ' . $e->getMessage());
        }
    }

    /**
     * Internal helper to touch active session timestamp and calculate elapsed duration.
     */
    protected static function touchSession(int $studentId, ?string $sessionIdentifier = null, ?Request $request = null): void
    {
        try {
            $now = Carbon::now();
            $query = StudentSession::where('student_id', $studentId)->where('is_active', true);

            if ($sessionIdentifier) {
                $session = (clone $query)->where('session_identifier', $sessionIdentifier)->first();
            } else {
                $session = $query->latest('last_activity_at')->first();
            }

            if ($session) {
                $duration = $session->started_at ? $now->diffInSeconds($session->started_at) : 0;
                $session->update([
                    'last_activity_at' => $now,
                    'duration_seconds' => max(0, (int)$duration),
                ]);
            } else {
                // If no active session found (e.g. continuing from prior cookie), auto-create one
                $req = $request ?: request();
                $userAgent = $req ? (string)$req->header('User-Agent') : null;
                StudentSession::create([
                    'student_id' => $studentId,
                    'session_identifier' => $sessionIdentifier ?: (string) Str::uuid(),
                    'ip_address' => $req ? $req->ip() : null,
                    'user_agent' => substr((string)$userAgent, 0, 500),
                    'device_type' => self::detectDeviceType($userAgent),
                    'browser' => self::detectBrowser($userAgent),
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
    // HELPER LOGGERS FOR BUSINESS DOMAINS
    // =========================================================================

    public static function logLogin(User $student, ?Request $request = null): void
    {
        self::log(
            $student,
            'login',
            'تسجيل الدخول',
            'تسجيل دخول ناجح إلى المنصة',
            [],
            ['role' => 'student'],
            $request
        );
    }

    public static function logFailedLogin(string $identifier, string $reason, ?Request $request = null): void
    {
        try {
            $user = User::where('email', $identifier)->orWhere('phone', $identifier)->first();
            if ($user && $user->role === 'student') {
                self::log(
                    $user,
                    'failed_login',
                    'فشل تسجيل الدخول',
                    'محاولة تسجيل دخول فاشلة (' . $reason . ') للبريد/الهاتف: ' . $identifier,
                    [],
                    ['reason' => $reason, 'identifier' => $identifier],
                    $request
                );
            }
        } catch (\Throwable $e) {
            // Non-blocking
        }
    }

    public static function logCourseOpened(User $student, Course $course, ?int $bundleId = null, ?Request $request = null): void
    {
        $isBundle = (bool)$course->is_bundle;
        $eventType = $isBundle ? 'bundle_opened' : 'course_opened';
        $eventName = $isBundle ? 'فتح الباقة' : 'فتح الكورس';
        $desc = ($isBundle ? 'قام باستعراض الباقة: ' : 'قام بفتح واستعراض الكورس: ') . $course->title;

        if ($bundleId && $bundleId !== $course->id) {
            $bundle = Course::find($bundleId);
            if ($bundle) {
                $desc .= ' (من خلال باقة: ' . $bundle->title . ')';
            }
        }

        self::log(
            $student,
            $eventType,
            $eventName,
            $desc,
            [
                'course_id' => $isBundle ? null : $course->id,
                'bundle_id' => $bundleId ?: ($isBundle ? $course->id : null),
            ],
            [
                'title' => $course->title,
                'is_bundle' => $isBundle,
            ],
            $request
        );
    }

    public static function logLessonOpened(User $student, Lesson $lesson, ?int $courseId = null, ?int $bundleId = null, ?Request $request = null): void
    {
        $resolvedCourseId = $courseId ?: ($lesson->unit ? $lesson->unit->course_id : null);
        $courseTitle = null;
        if ($resolvedCourseId) {
            $course = Course::find($resolvedCourseId);
            $courseTitle = $course ? $course->title : null;
        }

        $desc = 'فتح المحاضرة / الدرس: ' . $lesson->title;
        if ($courseTitle) {
            $desc .= ' ضمن كورس ' . $courseTitle;
        }
        if ($bundleId) {
            $bundle = Course::find($bundleId);
            if ($bundle) {
                $desc .= ' (عبر باقة: ' . $bundle->title . ')';
            }
        }

        self::log(
            $student,
            'lesson_opened',
            'فتح المحاضرة',
            $desc,
            [
                'course_id' => $resolvedCourseId,
                'bundle_id' => $bundleId,
                'lesson_id' => $lesson->id,
            ],
            [
                'lesson_title' => $lesson->title,
                'unit_title' => $lesson->unit?->title,
                'course_title' => $courseTitle,
            ],
            $request
        );
    }

    public static function logVideoProgress(
        User $student,
        Video $video,
        float $percentage,
        int $watchedSeconds,
        bool $isCompleted,
        ?int $courseId = null,
        ?int $bundleId = null,
        ?Request $request = null
    ): void {
        $lesson = $video->lesson;
        $lessonId = $lesson ? $lesson->id : null;
        $resolvedCourseId = $courseId ?: ($lesson && $lesson->unit ? $lesson->unit->course_id : null);

        $context = [
            'course_id' => $resolvedCourseId,
            'bundle_id' => $bundleId,
            'lesson_id' => $lessonId,
            'video_id' => $video->id,
        ];

        $meta = [
            'video_title' => $video->title,
            'percentage' => round($percentage, 1),
            'watched_seconds' => $watchedSeconds,
            'duration_seconds' => $video->duration_seconds,
        ];

        // 1. Completion event
        if ($isCompleted) {
            // Only log completion once per session / video
            $alreadyLogged = StudentActivityLog::where('student_id', $student->id)
                ->where('video_id', $video->id)
                ->where('event_type', 'video_completed')
                ->where('occurred_at', '>=', Carbon::now()->subHours(2))
                ->exists();

            if (!$alreadyLogged) {
                self::log(
                    $student,
                    'video_completed',
                    'إكمال مشاهدة الفيديو',
                    'أكمل مشاهدة فيديو: ' . $video->title . ' (النسبة: ' . round($percentage, 1) . '%)',
                    $context,
                    $meta,
                    $request
                );
            }
            return;
        }

        // 2. Video milestones (25%, 50%, 75%)
        $milestone = null;
        if ($percentage >= 75.0) {
            $milestone = 75;
        } elseif ($percentage >= 50.0) {
            $milestone = 50;
        } elseif ($percentage >= 25.0) {
            $milestone = 25;
        }

        if ($milestone) {
            $eventType = "video_milestone_{$milestone}";
            $alreadyLogged = StudentActivityLog::where('student_id', $student->id)
                ->where('video_id', $video->id)
                ->where('event_type', $eventType)
                ->where('occurred_at', '>=', Carbon::now()->subHours(2))
                ->exists();

            if (!$alreadyLogged) {
                self::log(
                    $student,
                    $eventType,
                    "تقدم الفيديو {$milestone}%",
                    "وصل في مشاهدة فيديو [{$video->title}] إلى نسبة {$milestone}%",
                    $context,
                    $meta,
                    $request
                );
            }
        }
    }

    public static function logVideoStarted(
        User $student,
        Video $video,
        ?int $courseId = null,
        ?int $bundleId = null,
        ?Request $request = null
    ): void {
        $lesson = $video->lesson;
        $lessonId = $lesson ? $lesson->id : null;
        $resolvedCourseId = $courseId ?: ($lesson && $lesson->unit ? $lesson->unit->course_id : null);

        // Debounce: don't log video_started multiple times within 10 minutes for same video
        $recentStart = StudentActivityLog::where('student_id', $student->id)
            ->where('video_id', $video->id)
            ->where('event_type', 'video_started')
            ->where('occurred_at', '>=', Carbon::now()->subMinutes(10))
            ->exists();

        if ($recentStart) {
            return;
        }

        self::log(
            $student,
            'video_started',
            'بدء مشاهدة الفيديو',
            'بدأ تشغيل ومشاهدة فيديو: ' . $video->title,
            [
                'course_id' => $resolvedCourseId,
                'bundle_id' => $bundleId,
                'lesson_id' => $lessonId,
                'video_id' => $video->id,
            ],
            [
                'video_title' => $video->title,
                'duration_seconds' => $video->duration_seconds,
            ],
            $request
        );
    }

    public static function logPdfOpened(
        User $student,
        $pdf,
        ?int $courseId = null,
        ?int $bundleId = null,
        ?Request $request = null
    ): void {
        $lesson = is_object($pdf) && isset($pdf->lesson) ? $pdf->lesson : null;
        $lessonId = $lesson ? $lesson->id : (is_object($pdf) && isset($pdf->lesson_id) ? $pdf->lesson_id : null);
        $resolvedCourseId = $courseId ?: ($lesson && $lesson->unit ? $lesson->unit->course_id : null);
        $title = is_object($pdf) ? ($pdf->title ?? 'ملف دراسي') : (string)$pdf;
        $pdfId = is_object($pdf) ? ($pdf->id ?? null) : null;

        self::log(
            $student,
            'pdf_opened',
            'فتح ملف PDF / مذكرة',
            'قام بفتح واستعراض ملف: ' . $title,
            [
                'course_id' => $resolvedCourseId,
                'bundle_id' => $bundleId,
                'lesson_id' => $lessonId,
            ],
            [
                'pdf_id' => $pdfId,
                'pdf_title' => $title,
            ],
            $request
        );
    }

    public static function logExamEvent(
        User $student,
        Exam $exam,
        string $action, // 'started', 'submitted', 'viewed_results'
        ?StudentExam $attempt = null,
        array $meta = [],
        ?Request $request = null
    ): void {
        $type = $exam->type; // 'quiz', 'homework', 'monthly_exam' or 'exam'
        $typeArabic = match($type) {
            'quiz' => 'كويز / اختبار قصير',
            'homework' => 'واجب دراسي',
            default => 'امتحان',
        };

        $prefix = match($type) {
            'quiz' => 'quiz',
            'homework' => 'homework',
            default => 'exam',
        };

        $eventType = "{$prefix}_{$action}";
        $eventName = match($action) {
            'started' => "بدء {$typeArabic}",
            'submitted' => "تسليم {$typeArabic}",
            'viewed_results' => "عرض نتيجة {$typeArabic}",
            default => "{$typeArabic} ({$action})",
        };

        $lesson = $exam->lesson;
        $lessonId = $lesson ? $lesson->id : null;
        $courseId = $lesson && $lesson->unit ? $lesson->unit->course_id : ($attempt ? $attempt->course_id : null);

        $desc = match($action) {
            'started' => "بدأ في حل {$typeArabic}: [{$exam->title}]",
            'submitted' => "قام بتسليم {$typeArabic}: [{$exam->title}]" . ($attempt && $attempt->score !== null ? " (الدرجة: {$attempt->score}/{$exam->max_score})" : ''),
            'viewed_results' => "استعرض نتيجة {$typeArabic}: [{$exam->title}]",
            default => "تفاعل مع {$typeArabic}: [{$exam->title}]",
        };

        self::log(
            $student,
            $eventType,
            $eventName,
            $desc,
            [
                'course_id' => $courseId,
                'lesson_id' => $lessonId,
                'exam_id' => $exam->id,
                'attempt_id' => $attempt ? $attempt->id : null,
            ],
            array_merge([
                'exam_title' => $exam->title,
                'exam_type' => $type,
                'max_score' => $exam->max_score,
                'score' => $attempt ? $attempt->score : null,
                'status' => $attempt ? $attempt->status : null,
            ], $meta),
            $request
        );
    }

    public static function logWalletTopup(
        User|int $student,
        float $amount,
        string $method = 'recharge_code',
        ?string $reference = null,
        ?float $balanceBefore = null,
        ?float $balanceAfter = null,
        ?Request $request = null
    ): ?StudentActivityLog {
        $methodLabel = match($method) {
            'recharge_code' => 'كود شحن',
            'admin_manual' => 'إيداع إداري',
            'bank_transfer' => 'تحويل بنكي',
            default => $method,
        };

        $desc = "تم شحن المحفظة بنجاح بقيمة {$amount} ج.م (طريقة الشحن: {$methodLabel})";
        if ($balanceBefore !== null && $balanceAfter !== null) {
            $desc .= " (الرصيد: {$balanceBefore} ← {$balanceAfter} ج.م)";
        }

        return self::log(
            $student,
            'wallet_topup',
            'شحن المحفظة',
            $desc,
            [],
            [
                'amount' => $amount,
                'topup_method' => $method,
                'method_label' => $methodLabel,
                'reference' => $reference,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'status' => 'completed',
            ],
            $request
        );
    }

    public static function logWalletDebit(
        User|int $student,
        float $amount,
        string $reason,
        ?string $reference = null,
        ?float $balanceBefore = null,
        ?float $balanceAfter = null,
        ?Request $request = null
    ): ?StudentActivityLog {
        $desc = "خصم من المحفظة: {$amount} ج.م ({$reason})";
        if ($balanceBefore !== null && $balanceAfter !== null) {
            $desc .= " (الرصيد: {$balanceBefore} ← {$balanceAfter} ج.م)";
        }

        return self::log(
            $student,
            'wallet_debit',
            'خصم من المحفظة',
            $desc,
            [],
            [
                'amount' => $amount,
                'reason' => $reason,
                'reference' => $reference,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
            ],
            $request
        );
    }

    public static function logWalletCredit(
        User|int $student,
        float $amount,
        string $reason,
        ?string $reference = null,
        ?float $balanceBefore = null,
        ?float $balanceAfter = null,
        ?Request $request = null
    ): ?StudentActivityLog {
        $desc = "إيداع في المحفظة: {$amount} ج.م ({$reason})";
        if ($balanceBefore !== null && $balanceAfter !== null) {
            $desc .= " (الرصيد: {$balanceBefore} ← {$balanceAfter} ج.م)";
        }

        return self::log(
            $student,
            'wallet_credit',
            'إيداع في المحفظة',
            $desc,
            [],
            [
                'amount' => $amount,
                'reason' => $reason,
                'reference' => $reference,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
            ],
            $request
        );
    }

    public static function logPurchase(
        User|int $student,
        string $productType, // 'course', 'bundle', 'lesson', 'package', 'exam'
        $item,
        float $amount,
        string $method = 'wallet',
        array|\Illuminate\Http\Request $financialContext = [],
        ?\Illuminate\Http\Request $request = null
    ): ?StudentActivityLog {
        if ($financialContext instanceof \Illuminate\Http\Request) {
            $request = $financialContext;
            $financialContext = [];
        }
        $isBundle = $productType === 'bundle' || ($productType === 'course' && (bool)($item->is_bundle ?? false));
        $eventType = $isBundle ? 'bundle_purchased' : "{$productType}_purchased";
        
        $itemTitle = $item->title ?? ($item->name ?? 'عنصر');
        $eventName = $isBundle ? 'شراء باقة كورس' : match($productType) {
            'course' => 'شراء كورس',
            'lesson' => 'شراء محاضرة',
            'package' => 'شراء باقة محتوى',
            'exam' => 'شراء امتحان شهري',
            default => 'عملية شراء',
        };

        $desc = "تم شراء [{$itemTitle}] بنجاح بقيمة {$amount} ج.م (طريقة الدفع: {$method})";

        return self::log(
            $student,
            $eventType,
            $eventName,
            $desc,
            [
                'course_id' => ($productType === 'course' && !$isBundle) ? $item->id : null,
                'bundle_id' => $isBundle ? $item->id : null,
                'lesson_id' => $productType === 'lesson' ? $item->id : null,
                'exam_id' => $productType === 'exam' ? $item->id : null,
            ],
            array_merge([
                'product_type' => $isBundle ? 'bundle' : $productType,
                'product_id' => $item->id ?? null,
                'product_title' => $itemTitle,
                'amount' => $amount,
                'payment_method' => $method,
                'status' => 'completed',
            ], $financialContext),
            $request
        );
    }

    public static function logPurchaseFailed(
        User|int $student,
        string $productType,
        $item,
        string $reason,
        array $meta = [],
        ?Request $request = null
    ): ?StudentActivityLog {
        $itemTitle = $item->title ?? ($item->name ?? 'عنصر');

        return self::log(
            $student,
            'purchase_failed',
            'فشل عملية الشراء',
            "فشل شراء [{$itemTitle}] بسبب: {$reason}",
            [
                'course_id' => $productType === 'course' ? $item->id : null,
            ],
            array_merge([
                'product_type' => $productType,
                'product_title' => $itemTitle,
                'failure_reason' => $reason,
            ], $meta),
            $request
        );
    }

    public static function logSecurityEvent(
        User|int $student,
        string $eventType, // 'repeated_failed_logins', 'unauthorized_request', 'rate_limit_triggered', 'ip_blocked', 'suspicious_request'
        string $description,
        array $meta = [],
        ?Request $request = null
    ): ?StudentActivityLog {
        $eventName = match($eventType) {
            'repeated_failed_logins' => 'تكرار محاولات تسجيل دخول فاشلة',
            'unauthorized_request' => 'طلب غير مصرح به',
            'rate_limit_triggered' => 'تجاوز معدل الطلبات المسموح',
            'ip_blocked' => 'حظر عنوان IP',
            'suspicious_request' => 'نشاط أمني مشبوه',
            default => 'حدث أمني',
        };

        return self::log(
            $student,
            $eventType,
            $eventName,
            $description,
            [],
            $meta,
            $request
        );
    }

    public static function logAntiCheat(
        User $student,
        Exam $exam,
        string $violationType, // 'tab_switch_violation', 'fullscreen_exit', 'focus_loss', 'copy_paste_violation', 'terminated_for_cheating'
        array $meta = [],
        ?Request $request = null
    ): void {
        $violationLabel = match($violationType) {
            'tab_switch_violation' => 'تبديل التبويب أو مغادرة النافذة',
            'fullscreen_exit' => 'الخروج من وضع ملء الشاشة',
            'focus_loss' => 'فقدان تركيز شاشة الامتحان',
            'copy_paste_violation' => 'محاولة نسخ أو لصق أثناء الامتحان',
            'multiple_session_violation' => 'محاولة فتح الامتحان من جلسة أخرى',
            'terminated_for_cheating' => 'إنهاء الامتحان تلقائياً بسبب مخالفة قواعد النزاهة',
            default => 'مخالفة نظام المراقبة ومكافحة الغش',
        };

        $lesson = $exam->lesson;
        $lessonId = $lesson ? $lesson->id : null;
        $courseId = $lesson && $lesson->unit ? $lesson->unit->course_id : null;

        self::log(
            $student,
            'anti_cheat_violation',
            'مخالفة أمنية / مكافحة الغش',
            "رصد مخالفة [{$violationLabel}] أثناء أداء: {$exam->title}",
            [
                'course_id' => $courseId,
                'lesson_id' => $lessonId,
                'exam_id' => $exam->id,
            ],
            array_merge([
                'violation_type' => $violationType,
                'violation_label' => $violationLabel,
                'exam_title' => $exam->title,
            ], $meta),
            $request
        );
    }

    public static function logAccountEvent(
        User $student,
        string $eventType, // 'profile_updated', 'changed_password', etc.
        string $description,
        ?Request $request = null
    ): void {
        $eventName = match($eventType) {
            'profile_updated' => 'تحديث الملف الشخصي',
            'changed_password' => 'تغيير كلمة المرور',
            default => 'تحديث بيانات الحساب',
        };

        self::log(
            $student,
            $eventType,
            $eventName,
            $description,
            [],
            null,
            $request
        );
    }

    public static function logNotificationOpened(User $student, int $notificationId, ?Request $request = null): void
    {
        self::log(
            $student,
            'notification_opened',
            'فتح وقراءة إشعار',
            'قام الطالب بفتح واستعراض الإشعار رقم #' . $notificationId,
            [],
            ['notification_id' => $notificationId],
            $request
        );
    }

    // =========================================================================
    // UTILITY PARSERS
    // =========================================================================

    protected static function sanitizeMetadata(?array $meta): ?array
    {
        if (empty($meta)) {
            return null;
        }

        $forbidden = ['password', 'password_confirmation', 'token', 'auth_token', 'api_key', 'secret'];
        $clean = [];

        foreach ($meta as $key => $val) {
            if (in_array(strtolower($key), $forbidden)) {
                continue;
            }
            if (is_array($val)) {
                $clean[$key] = self::sanitizeMetadata($val);
            } else {
                $clean[$key] = $val;
            }
        }

        return $clean;
    }

    public static function detectDeviceType(?string $ua): string
    {
        if (!$ua) return 'desktop';
        $ua = strtolower($ua);
        if (str_contains($ua, 'tablet') || str_contains($ua, 'ipad')) {
            return 'tablet';
        }
        if (str_contains($ua, 'mobile') || str_contains($ua, 'android') || str_contains($ua, 'iphone')) {
            return 'mobile';
        }
        return 'desktop';
    }

    public static function detectBrowser(?string $ua): string
    {
        if (!$ua) return 'غير معروف';
        $ua = strtolower($ua);
        if (str_contains($ua, 'edg/')) return 'Edge';
        if (str_contains($ua, 'chrome')) return 'Chrome';
        if (str_contains($ua, 'firefox')) return 'Firefox';
        if (str_contains($ua, 'safari') && !str_contains($ua, 'chrome')) return 'Safari';
        if (str_contains($ua, 'opera') || str_contains($ua, 'opr/')) return 'Opera';
        return 'متصفح ويب';
    }

    public static function formatDurationHuman(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds} ثانية";
        }
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        if ($minutes < 60) {
            return "{$minutes} دقيقة" . ($remainingSeconds > 0 ? " و {$remainingSeconds} ث" : '');
        }
        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;
        return "{$hours} ساعة" . ($remainingMinutes > 0 ? " و {$remainingMinutes} دقيقة" : '');
    }
}
