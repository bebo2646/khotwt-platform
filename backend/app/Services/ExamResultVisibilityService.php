<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\ExamStudentResultVisibility;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ExamResultVisibilityService
{
    /**
     * Resolve the effective visibility settings for a specific student on an exam.
     * Hierarchy: Student Override > Exam Default Settings.
     *
     * @param Exam $exam
     * @param int $studentId
     * @return array
     */
    public function resolveEffectiveVisibility(Exam $exam, int $studentId): array
    {
        $override = ExamStudentResultVisibility::where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->first();

        $showScore = $override && $override->show_score !== null
            ? (bool)$override->show_score
            : (bool)($exam->show_score ?? true);

        $showStudentAnswers = $override && $override->show_student_answers !== null
            ? (bool)$override->show_student_answers
            : (bool)($exam->show_student_answers ?? true);

        $showCorrectAnswers = $override && $override->show_correct_answers !== null
            ? (bool)$override->show_correct_answers
            : (bool)($exam->show_correct_answers ?? true);

        $showExplanations = $override && $override->show_explanations !== null
            ? (bool)$override->show_explanations
            : (bool)($exam->show_explanations ?? true);

        return [
            'show_score' => $showScore,
            'show_student_answers' => $showStudentAnswers,
            'show_correct_answers' => $showCorrectAnswers,
            'show_explanations' => $showExplanations,
            'has_override' => $override !== null && (
                $override->show_score !== null ||
                $override->show_student_answers !== null ||
                $override->show_correct_answers !== null ||
                $override->show_explanations !== null
            ),
            'override' => $override ? [
                'show_score' => $override->show_score,
                'show_student_answers' => $override->show_student_answers,
                'show_correct_answers' => $override->show_correct_answers,
                'show_explanations' => $override->show_explanations,
            ] : null,
            'exam_defaults' => [
                'show_score' => (bool)($exam->show_score ?? true),
                'show_student_answers' => (bool)($exam->show_student_answers ?? true),
                'show_correct_answers' => (bool)($exam->show_correct_answers ?? true),
                'show_explanations' => (bool)($exam->show_explanations ?? true),
            ],
        ];
    }

    /**
     * Sanitize an attempt Eloquent model according to effective visibility settings.
     * Strips or nulls sensitive data from models and nested relations.
     *
     * @param StudentExam $attempt
     * @param array|null $visibility
     * @return StudentExam
     */
    public function sanitizeAttempt(StudentExam $attempt, ?array $visibility = null): StudentExam
    {
        if (!$attempt->relationLoaded('exam') && $attempt->exam_id) {
            $attempt->load('exam');
        }

        $exam = $attempt->exam;
        if (!$exam) {
            return $attempt;
        }

        if ($visibility === null) {
            $visibility = $this->resolveEffectiveVisibility($exam, (int)$attempt->student_id);
        }

        $canViewAnswers = $attempt->canViewAnswers();

        // 1. Enforce score visibility
        if (!$visibility['show_score']) {
            $attempt->score = null;
            $attempt->rank = null;
            $attempt->total_participants = null;
            $attempt->makeHidden(['score', 'rank', 'total_participants']);

            if ($attempt->relationLoaded('answers') && $attempt->answers) {
                foreach ($attempt->answers as $ans) {
                    $ans->score = null;
                    $ans->makeHidden(['score']);
                }
            }
        }

        // 2. Enforce student submitted answers visibility
        if (!$visibility['show_student_answers']) {
            if ($attempt->relationLoaded('answers') && $attempt->answers) {
                foreach ($attempt->answers as $ans) {
                    $ans->answer_text = null;
                    $ans->is_correct = null;
                    $ans->score = null;
                    $ans->makeHidden(['answer_text', 'is_correct', 'score']);
                }
            }
        }

        // 3. Enforce correct answers visibility (Anti-cheat restriction overrides if canViewAnswers is false)
        if (!$visibility['show_correct_answers'] || !$canViewAnswers) {
            if ($exam->relationLoaded('questions') && $exam->questions) {
                $exam->questions->makeHidden(['correct_answer']);
                foreach ($exam->questions as $q) {
                    $q->correct_answer = null;
                }
            }
            if ($attempt->relationLoaded('answers') && $attempt->answers) {
                foreach ($attempt->answers as $ans) {
                    if ($ans->relationLoaded('question') && $ans->question) {
                        $ans->question->makeHidden(['correct_answer']);
                        $ans->question->correct_answer = null;
                    }
                }
            }
        }

        // 4. Enforce explanations visibility (Anti-cheat restriction overrides if canViewAnswers is false)
        if (!$visibility['show_explanations'] || !$canViewAnswers) {
            if ($exam->relationLoaded('questions') && $exam->questions) {
                $exam->questions->makeHidden(['explanation']);
                foreach ($exam->questions as $q) {
                    $q->explanation = null;
                }
            }
            if ($attempt->relationLoaded('answers') && $attempt->answers) {
                foreach ($attempt->answers as $ans) {
                    if ($ans->relationLoaded('question') && $ans->question) {
                        $ans->question->makeHidden(['explanation']);
                        $ans->question->explanation = null;
                    }
                }
            }
        }

        // Attach safe visibility metadata to attempt
        $attempt->result_visibility = [
            'show_score' => $visibility['show_score'],
            'show_student_answers' => $visibility['show_student_answers'],
            'show_correct_answers' => $visibility['show_correct_answers'] && $canViewAnswers,
            'show_explanations' => $visibility['show_explanations'] && $canViewAnswers,
        ];
        $attempt->effective_visibility = $attempt->result_visibility;

        return $attempt;
    }

    /**
     * Set default visibility settings on the exam.
     *
     * @param Exam $exam
     * @param array $settings
     * @return Exam
     */
    public function setExamDefaults(Exam $exam, array $settings): Exam
    {
        $payload = [];
        if (array_key_exists('show_score', $settings)) {
            $payload['show_score'] = (bool)$settings['show_score'];
        }
        if (array_key_exists('show_student_answers', $settings)) {
            $payload['show_student_answers'] = (bool)$settings['show_student_answers'];
        }
        if (array_key_exists('show_correct_answers', $settings)) {
            $payload['show_correct_answers'] = (bool)$settings['show_correct_answers'];
        }
        if (array_key_exists('show_explanations', $settings)) {
            $payload['show_explanations'] = (bool)$settings['show_explanations'];
        }

        $exam->update($payload);
        return $exam;
    }

    /**
     * Set or update student-specific visibility override.
     *
     * @param Exam $exam
     * @param int $studentId
     * @param array $settings
     * @return ExamStudentResultVisibility
     */
    public function setStudentOverride(Exam $exam, int $studentId, array $settings): ExamStudentResultVisibility
    {
        $override = ExamStudentResultVisibility::firstOrNew([
            'exam_id' => $exam->id,
            'student_id' => $studentId,
        ]);

        foreach (['show_score', 'show_student_answers', 'show_correct_answers', 'show_explanations'] as $key) {
            if (array_key_exists($key, $settings)) {
                $val = $settings[$key];
                $override->{$key} = $val === null ? null : (bool)$val;
            }
        }

        $override->save();
        return $override;
    }

    /**
     * Reset student-specific visibility override back to exam defaults.
     *
     * @param Exam $exam
     * @param int $studentId
     * @return bool
     */
    public function resetStudentOverride(Exam $exam, int $studentId): bool
    {
        return (bool)ExamStudentResultVisibility::where('exam_id', $exam->id)
            ->where('student_id', $studentId)
            ->delete();
    }

    /**
     * Bulk apply visibility settings or reset to exam defaults for multiple students.
     *
     * @param Exam $exam
     * @param array $studentIds
     * @param array|null $settings If null or empty, resets overrides to default
     * @return int Count of affected students
     */
    public function bulkSetStudentOverrides(Exam $exam, array $studentIds, ?array $settings = null): int
    {
        if (empty($studentIds)) {
            return 0;
        }

        return DB::transaction(function () use ($exam, $studentIds, $settings) {
            $count = 0;
            if ($settings === null || ($settings['reset_to_default'] ?? false)) {
                // Bulk reset
                return ExamStudentResultVisibility::where('exam_id', $exam->id)
                    ->whereIn('student_id', $studentIds)
                    ->delete();
            }

            foreach ($studentIds as $studentId) {
                $this->setStudentOverride($exam, (int)$studentId, $settings);
                $count++;
            }
            return $count;
        });
    }

    /**
     * Get all overrides for an exam keyed by student_id.
     *
     * @param Exam $exam
     * @return Collection
     */
    public function getOverridesForExam(Exam $exam): Collection
    {
        return ExamStudentResultVisibility::where('exam_id', $exam->id)
            ->get()
            ->keyBy('student_id');
    }
}
