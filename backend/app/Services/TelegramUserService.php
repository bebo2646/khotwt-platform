<?php

namespace App\Services;

use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\TeacherSubscription;
use App\Services\ExamResultVisibilityService;
use Carbon\Carbon;

class TelegramUserService
{
    protected ExamResultVisibilityService $visibilityService;

    public function __construct(?ExamResultVisibilityService $visibilityService = null)
    {
        $this->visibilityService = $visibilityService ?: app(ExamResultVisibilityService::class);
    }

    /**
     * Get formatted list of student's enrolled courses.
     */
    public function getStudentCoursesText(User $student): string
    {
        $enrollments = Enrollment::with(['course.teacher'])
            ->where('student_id', $student->id)
            ->latest()
            ->take(8)
            ->get();

        if ($enrollments->isEmpty()) {
            return "📚 <b>كورساتك المسجلة</b>\n\nأنت غير مسجل في أي كورس حالياً.\nتصفح المنصة واشترك في كورساتك المفضلة لتظهر لك هنا!";
        }

        $text = "📚 <b>كورساتك المسجلة على منصة خطوتك:</b>\n\n";
        foreach ($enrollments as $idx => $enrollment) {
            $course = $enrollment->course;
            if (!$course) continue;
            $num = $idx + 1;
            $teacherName = $course->teacher ? $course->teacher->name : 'معلم منصة خطوتك';
            $subject = $course->subject ?: 'مادة تعليمية';
            $text .= "{$num}. <b>{$course->title}</b>\n";
            $text .= "   👨‍🏫 {$teacherName} | 🏷 {$subject}\n\n";
        }

        $text .= "💡 اضغط على المنصة لمتابعة المشاهدة وحل التمارين.";
        return $text;
    }

    /**
     * Get formatted list of student's available exams.
     */
    public function getStudentExamsText(User $student): string
    {
        // Enrolled course IDs
        $courseIds = Enrollment::where('student_id', $student->id)
            ->whereNotNull('course_id')
            ->pluck('course_id');

        $exams = Exam::whereIn('course_id', $courseIds)
            ->where('is_published', true)
            ->latest()
            ->take(6)
            ->get();

        if ($exams->isEmpty()) {
            return "📝 <b>الامتحانات والواجبات</b>\n\nلا توجد امتحانات جديدة متاحة حالياً لكورساتك المسجلة.\nأحسنت! تابع دروسك بانتظام.";
        }

        $text = "📝 <b>أحدث الامتحانات المتاحة لكورساتك:</b>\n\n";
        foreach ($exams as $idx => $exam) {
            $num = $idx + 1;
            $duration = $exam->duration_minutes ? "{$exam->duration_minutes} دقيقة" : "غير محدد";
            $text .= "{$num}. <b>{$exam->title}</b>\n";
            $text .= "   ⏱ المدة: {$duration} | 📊 الدرجة الكلية: {$exam->total_score}\n\n";
        }

        return $text;
    }

    /**
     * Get formatted results of student's completed exams respecting visibility rules.
     */
    public function getStudentResultsText(User $student): string
    {
        $attempts = StudentExam::with(['exam.course'])
            ->where('student_id', $student->id)
            ->whereIn('status', ['submitted', 'graded'])
            ->latest()
            ->take(5)
            ->get();

        if ($attempts->isEmpty()) {
            return "📊 <b>تقارير ودرجات الامتحانات</b>\n\nلم تقم بأداء أي امتحانات بعد.\nابدأ بحل امتحانات كورساتك لتسجيل نتائجك وترتيبك هنا!";
        }

        $text = "📊 <b>نتائج أحدث امتحاناتك على المنصة:</b>\n\n";
        foreach ($attempts as $idx => $attempt) {
            $exam = $attempt->exam;
            if (!$exam) continue;

            $num = $idx + 1;
            $visibility = $this->visibilityService->resolveEffectiveVisibility($exam, $student->id);

            $text .= "{$num}. <b>{$exam->title}</b>\n";

            if ($visibility['show_score'] && $attempt->score !== null) {
                $score = $attempt->score;
                $max = $exam->total_score ?: $attempt->max_score;
                $percentage = $max > 0 ? round(($score / $max) * 100, 1) : 0;
                $text .= "   🎯 الدرجة: <b>{$score} / {$max}</b> ({$percentage}%)\n";
            } else {
                $text .= "   🔒 الدرجة: <i>قيد المراجعة / لم تُعلن بناءً على تعليمات المعلم</i>\n";
            }

            $date = $attempt->created_at ? $attempt->created_at->format('Y-m-d') : '';
            $text .= "   📅 التاريخ: {$date}\n\n";
        }

        return $text;
    }

    /**
     * Get teacher or university doctor statistics and subscription details.
     */
    public function getTeacherStatsText(User $teacher): string
    {
        $isDoctor = ($teacher->category === 'university');
        $titlePrefix = $isDoctor ? "دكتور" : "أستاذ";

        // Query active subscription
        $subscription = TeacherSubscription::with('plan')
            ->where('teacher_id', $teacher->id)
            ->where('status', 'active')
            ->first();

        $planName = $subscription && $subscription->plan ? $subscription->plan->name : 'الباقة القياسية';
        $expiresAt = $subscription && $subscription->ends_at ? $subscription->ends_at->format('Y-m-d') : 'مستمر';

        // Course count
        $coursesCount = Course::where('teacher_id', $teacher->id)->count();

        // Enrolled students
        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');
        $studentsCount = Enrollment::whereIn('course_id', $courseIds)
            ->distinct('student_id')
            ->count('student_id');

        // Storage calculation
        $storageUsed = round((float)($teacher->bunny_storage_used_gb ?? 0), 2);
        $storageLimit = round((float)($teacher->bunny_storage_limit_gb ?? 50), 2);
        $storageRemaining = max(0, round($storageLimit - $storageUsed, 2));
        $storagePercent = $storageLimit > 0 ? min(100, round(($storageUsed / $storageLimit) * 100, 1)) : 0;

        $text = "👨‍🏫 <b>لوحة خدمات الـ{$titlePrefix} ({$teacher->name}):</b>\n\n" .
            "📦 <b>الباقة الحالية:</b> {$planName}\n" .
            "📅 <b>تاريخ التجديد:</b> {$expiresAt}\n\n" .
            "📊 <b>إحصائيات المنصة:</b>\n" .
            "• عدد المقررات: <b>{$coursesCount}</b>\n" .
            "• إجمالي الطلاب: <b>{$studentsCount} طالب</b>\n\n" .
            "💾 <b>مساحة التخزين السحابي (Bunny CDN):</b>\n" .
            "• المستخدم: <b>{$storageUsed} GB</b> من أصل <b>{$storageLimit} GB</b> ({$storagePercent}%)\n" .
            "• المتبقي: <b>{$storageRemaining} GB</b>\n\n" .
            "💡 يمكنك رفع محاضراتك وإدارة الاشتراكات مباشرة من لوحة التحكم على المنصة.";

        return $text;
    }
}
