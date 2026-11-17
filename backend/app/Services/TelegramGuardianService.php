<?php

namespace App\Services;

use App\Models\TelegramUser;
use App\Models\GuardianStudentRelation;
use App\Models\User;
use App\Models\StudentExam;
use App\Services\ExamResultVisibilityService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class TelegramGuardianService
{
    protected ?TelegramService $telegramService;
    protected ?ExamResultVisibilityService $visibilityService;

    public function __construct(
        ?TelegramService $telegramService = null,
        ?ExamResultVisibilityService $visibilityService = null
    ) {
        $this->telegramService = $telegramService;
        $this->visibilityService = $visibilityService;
    }

    protected function getTelegramService(): TelegramService
    {
        return $this->telegramService ?: app(TelegramService::class);
    }

    protected function getVisibilityService(): ExamResultVisibilityService
    {
        return $this->visibilityService ?: app(ExamResultVisibilityService::class);
    }

    /**
     * Link a guardian Telegram user to students whose parent_phone matches the verified contact.
     */
    public function linkGuardianByParentPhone(TelegramUser $guardianUser, string $phone): array
    {
        $variants = TelegramPhoneService::getSearchVariants($phone);

        $students = User::where('role', 'student')
            ->where(function ($q) use ($variants) {
                $q->whereIn('parent_phone', $variants);
            })
            ->get();

        if ($students->isEmpty()) {
            return [
                'success' => false,
                'count' => 0,
                'students' => collect(),
                'message' => 'لم يتم العثور على أي حساب طالب مسجل به رقم هاتف ولي الأمر هذا كـ parent_phone على المنصة.',
            ];
        }

        return DB::transaction(function () use ($guardianUser, $students, $phone) {
            $linkedStudents = collect();

            foreach ($students as $student) {
                GuardianStudentRelation::updateOrCreate(
                    [
                        'guardian_telegram_account_id' => $guardianUser->id,
                        'student_user_id' => $student->id,
                    ],
                    [
                        'verified_phone' => $phone,
                        'status' => 'active',
                        'linked_at' => Carbon::now(),
                    ]
                );
                $linkedStudents->push($student);
            }

            if ($guardianUser->role === 'guest' || $guardianUser->role === 'guardian') {
                $guardianUser->update([
                    'role' => 'guardian',
                    'phone' => $phone,
                ]);
            }

            return [
                'success' => true,
                'count' => $linkedStudents->count(),
                'students' => $linkedStudents,
                'message' => 'تم ربط حساب ولي الأمر بالطلاب بنجاح.',
            ];
        });
    }

    /**
     * Get all active students linked to this guardian.
     */
    public function getLinkedStudents(TelegramUser $guardianUser): Collection
    {
        $studentIds = GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('status', 'active')
            ->pluck('student_user_id');

        return User::whereIn('id', $studentIds)->get();
    }

    /**
     * Check if a guardian is actively authorized to view data for a specific student.
     */
    public function canAccessStudent(TelegramUser $guardianUser, int $studentId): bool
    {
        return GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('student_user_id', $studentId)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * Unlink a guardian from a specific student independently.
     */
    public function unlinkStudent(TelegramUser $guardianUser, int $studentId): bool
    {
        $relation = GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('student_user_id', $studentId)
            ->first();

        if (!$relation) {
            return false;
        }

        $relation->update(['status' => 'revoked']);

        $hasRemainingActive = GuardianStudentRelation::where('guardian_telegram_account_id', $guardianUser->id)
            ->where('status', 'active')
            ->exists();

        if (!$hasRemainingActive && $guardianUser->role === 'guardian') {
            $guardianUser->update(['role' => 'guest']);
        }

        return true;
    }

    /**
     * Generate weekly performance report for a specific student.
     */
    public function getStudentWeeklyReportText(TelegramUser $guardianUser, int $studentId): string
    {
        if (!$this->canAccessStudent($guardianUser, $studentId)) {
            return "⚠️ غير مصرح لك بالوصول لبيانات هذا الطالب.";
        }

        $student = User::find($studentId);
        if (!$student) {
            return "❌ الطالب غير موجود.";
        }

        $oneWeekAgo = Carbon::now()->subDays(7);

        // Exams in past 7 days
        $recentExams = StudentExam::with('exam')
            ->where('student_id', $studentId)
            ->where('created_at', '>=', $oneWeekAgo)
            ->latest()
            ->get();

        $text = "📊 <b>التقرير الأسبوعي لأداء الطالب: {$student->name}</b>\n";
        $text .= "الصف الدراسي: <b>" . ($student->grade ?: 'العام الحالي') . "</b>\n";
        $text .= "الفترة: آخر 7 أيام\n\n";

        if ($recentExams->isEmpty()) {
            $text .= "ℹ️ لم يقم الطالب بأداء أي امتحانات خلال الأسبوع الماضي.\n";
        } else {
            $text .= "📝 <b>الامتحانات المكتملة:</b>\n";
            $visibilityService = $this->getVisibilityService();

            foreach ($recentExams as $idx => $attempt) {
                $num = $idx + 1;
                $exam = $attempt->exam;
                $examTitle = $exam ? $exam->title : 'امتحان';
                
                $vis = $exam ? $visibilityService->resolveEffectiveVisibility($exam, $studentId) : ['show_score' => true];
                
                if ($vis['show_score'] && $attempt->score !== null) {
                    $max = $exam ? $exam->total_score : $attempt->max_score;
                    $scoreStr = "{$attempt->score} / {$max}";
                } else {
                    $scoreStr = "قيد التصحيح";
                }

                $text .= "{$num}. {$examTitle} — الدرجة: <b>{$scoreStr}</b>\n";
            }
        }

        $text .= "\n🌟 استمر في تشجيع أبنائك لمواصلة التفوق الدراسي على منصة خطوتك.";
        return $text;
    }

    /**
     * Send immediate notification to guardian when a student finishes an exam.
     */
    public function notifyGuardianExamFinished(StudentExam $studentExam): void
    {
        $studentId = $studentExam->student_id;
        $student = User::find($studentId);
        if (!$student) return;

        // Find active guardian relations with notifications enabled
        $relations = GuardianStudentRelation::with('guardianTelegram')
            ->where('student_user_id', $studentId)
            ->where('status', 'active')
            ->where('notifications_enabled', true)
            ->get();

        if ($relations->isEmpty()) return;

        $exam = $studentExam->exam;
        $examTitle = $exam ? $exam->title : 'امتحان';
        
        $vis = $exam ? $this->getVisibilityService()->resolveEffectiveVisibility($exam, $studentId) : ['show_score' => true];

        if ($vis['show_score'] && $studentExam->score !== null) {
            $max = $exam ? $exam->total_score : $studentExam->max_score;
            $scoreText = "🎯 الدرجة المحققة: <b>{$studentExam->score} / {$max}</b>";
        } else {
            $scoreText = "🔒 النتيجة قيد المراجعة والاعتماد من قِبل المعلم.";
        }

        $msg = "🔔 <b>إشعار ولي الأمر — منصة خطوتك</b>\n\n" .
            "قام الطالب <b>{$student->name}</b> للتو بإنهاء:\n" .
            "📝 <b>{$examTitle}</b>\n" .
            "{$scoreText}\n" .
            "📅 الوقت: " . Carbon::now()->format('Y-m-d H:i') . "\n\n" .
            "نتمنى له دوام التوفيق والنجاح! 🌟";

        $tgService = $this->getTelegramService();
        foreach ($relations as $rel) {
            $guardianTg = $rel->guardianTelegram;
            if ($guardianTg && $guardianTg->telegram_chat_id) {
                try {
                    $tgService->sendMessage($guardianTg->telegram_chat_id, $msg);
                } catch (\Exception $e) {
                    Log::warning("Failed to send guardian exam notification: " . $e->getMessage());
                }
            }
        }
    }
}
