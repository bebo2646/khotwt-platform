<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Exam;
use App\Models\User;
use App\Services\ExamResultVisibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExamVisibilityController extends Controller
{
    protected ExamResultVisibilityService $visibilityService;

    public function __construct(ExamResultVisibilityService $visibilityService)
    {
        $this->visibilityService = $visibilityService;
    }

    /**
     * Authorize that the current user owns this exam (as course teacher or monthly exam owner) or is admin.
     */
    protected function authorizeExamTeacher(Request $request, Exam $exam): void
    {
        $user = $request->user();

        if ($user->isAdmin() || $user->is_super_admin || $user->is_super) {
            return;
        }

        if ($exam->lesson_id && $exam->lesson && $exam->lesson->unit) {
            $courseId = $exam->lesson->unit->course_id;
            $course = Course::findOrFail($courseId);
            if ($course->teacher_id !== $user->id) {
                abort(403, 'غير مصرح لك بالتحكم في إعدادات هذا الامتحان.');
            }
        } elseif ($exam->course_id) {
            $course = Course::findOrFail($exam->course_id);
            if ($course->teacher_id !== $user->id) {
                abort(403, 'غير مصرح لك بالتحكم في إعدادات هذا الامتحان.');
            }
        } else {
            if ($exam->teacher_id !== $user->id) {
                abort(403, 'غير مصرح لك بالتحكم في إعدادات هذا الامتحان.');
            }
        }
    }

    /**
     * Get visibility defaults and all student overrides for an exam.
     */
    public function getVisibility(Request $request, $examId)
    {
        $exam = Exam::with(['lesson.unit'])->findOrFail($examId);
        $this->authorizeExamTeacher($request, $exam);

        $overrides = $this->visibilityService->getOverridesForExam($exam)->load('student:id,name,email,phone');

        return response()->json([
            'exam_id' => $exam->id,
            'title' => $exam->title,
            'defaults' => [
                'show_score' => (bool)($exam->show_score ?? true),
                'show_student_answers' => (bool)($exam->show_student_answers ?? true),
                'show_correct_answers' => (bool)($exam->show_correct_answers ?? true),
                'show_explanations' => (bool)($exam->show_explanations ?? true),
            ],
            'overrides' => $overrides->values(),
        ]);
    }

    /**
     * Update default visibility settings for the whole exam.
     */
    public function updateExamDefaults(Request $request, $examId)
    {
        $exam = Exam::with(['lesson.unit'])->findOrFail($examId);
        $this->authorizeExamTeacher($request, $exam);

        $request->validate([
            'show_score' => 'sometimes|boolean',
            'show_student_answers' => 'sometimes|boolean',
            'show_correct_answers' => 'sometimes|boolean',
            'show_explanations' => 'sometimes|boolean',
        ]);

        $this->visibilityService->setExamDefaults($exam, $request->only([
            'show_score',
            'show_student_answers',
            'show_correct_answers',
            'show_explanations',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الإعدادات الافتراضية لظهور نتائج الامتحان بنجاح.',
            'defaults' => [
                'show_score' => (bool)$exam->show_score,
                'show_student_answers' => (bool)$exam->show_student_answers,
                'show_correct_answers' => (bool)$exam->show_correct_answers,
                'show_explanations' => (bool)$exam->show_explanations,
            ],
        ]);
    }

    /**
     * Set or update visibility override for a single student.
     */
    public function setStudentOverride(Request $request, $examId, $studentId)
    {
        $exam = Exam::with(['lesson.unit'])->findOrFail($examId);
        $this->authorizeExamTeacher($request, $exam);

        $student = User::findOrFail($studentId);

        $request->validate([
            'show_score' => 'nullable|boolean',
            'show_student_answers' => 'nullable|boolean',
            'show_correct_answers' => 'nullable|boolean',
            'show_explanations' => 'nullable|boolean',
        ]);

        $override = $this->visibilityService->setStudentOverride(
            $exam,
            (int)$studentId,
            $request->only(['show_score', 'show_student_answers', 'show_correct_answers', 'show_explanations'])
        );

        $effective = $this->visibilityService->resolveEffectiveVisibility($exam, (int)$studentId);

        return response()->json([
            'success' => true,
            'message' => 'تم تعيين تخصيص ظهور النتيجة للطالب بنجاح.',
            'override' => $override,
            'effective_visibility' => $effective,
        ]);
    }

    /**
     * Reset single student override back to exam defaults.
     */
    public function resetStudentOverride(Request $request, $examId, $studentId)
    {
        $exam = Exam::with(['lesson.unit'])->findOrFail($examId);
        $this->authorizeExamTeacher($request, $exam);

        $this->visibilityService->resetStudentOverride($exam, (int)$studentId);
        $effective = $this->visibilityService->resolveEffectiveVisibility($exam, (int)$studentId);

        return response()->json([
            'success' => true,
            'message' => 'تمت استعادة الإعدادات الافتراضية لنتيجة الطالب بنجاح.',
            'effective_visibility' => $effective,
        ]);
    }

    /**
     * Bulk apply visibility settings or reset to defaults for multiple students.
     */
    public function bulkSetStudentOverrides(Request $request, $examId)
    {
        $exam = Exam::with(['lesson.unit'])->findOrFail($examId);
        $this->authorizeExamTeacher($request, $exam);

        $request->validate([
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'integer|exists:users,id',
            'reset_to_default' => 'sometimes|boolean',
            'show_score' => 'nullable|boolean',
            'show_student_answers' => 'nullable|boolean',
            'show_correct_answers' => 'nullable|boolean',
            'show_explanations' => 'nullable|boolean',
        ]);

        $reset = (bool)$request->input('reset_to_default', false) || $request->input('action') === 'reset';
        
        $source = is_array($request->input('visibility')) ? $request->input('visibility') : $request->all();
        $settings = $reset ? null : [
            'show_score' => isset($source['show_score']) ? (bool)$source['show_score'] : null,
            'show_student_answers' => isset($source['show_student_answers']) ? (bool)$source['show_student_answers'] : null,
            'show_correct_answers' => isset($source['show_correct_answers']) ? (bool)$source['show_correct_answers'] : null,
            'show_explanations' => isset($source['show_explanations']) ? (bool)$source['show_explanations'] : null,
        ];

        $affectedCount = $this->visibilityService->bulkSetStudentOverrides(
            $exam,
            $request->student_ids,
            $settings
        );

        return response()->json([
            'success' => true,
            'message' => $reset
                ? "تمت إعادة تعيين ظهور النتيجة إلى الافتراضي لعدد {$affectedCount} طالب."
                : "تم تطبيق إعدادات الرؤية بنجاح على {$affectedCount} طالب.",
            'affected_count' => $affectedCount,
        ]);
    }
}
