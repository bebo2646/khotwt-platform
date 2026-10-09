<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Question extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_id',
        'text',
        'image_url',
        'type', // mcq, true_false, essay
        'options', // For mcq: array
        'correct_answer',
        'score',
    ];

    protected $casts = [
        'options' => 'array',
    ];

    protected static function booted()
    {
        static::created(function ($question) {
            $exam = $question->exam ?: Exam::find($question->exam_id);
            $courseId = $exam?->course_id ?: ($exam?->lesson?->unit?->course_id ?: Lesson::find($exam?->lesson_id)?->unit?->course_id);
            Course::touchContent($courseId);
        });
        static::updated(function ($question) {
            $exam = $question->exam ?: Exam::find($question->exam_id);
            $courseId = $exam?->course_id ?: ($exam?->lesson?->unit?->course_id ?: Lesson::find($exam?->lesson_id)?->unit?->course_id);
            Course::touchContent($courseId);
        });
        static::deleted(function ($question) {
            $exam = $question->exam ?: Exam::find($question->exam_id);
            $courseId = $exam?->course_id ?: ($exam?->lesson?->unit?->course_id ?: Lesson::find($exam?->lesson_id)?->unit?->course_id);
            Course::touchContent($courseId);
        });
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function answers()
    {
        return $this->hasMany(StudentAnswer::class);
    }

    /**
     * Determine if a submitted answer matches the correct answer.
     * Supports plain string answers, structured options with text and/or images, and index/letter-based matching.
     */
    public function isAnswerCorrect(?string $submittedAnswer): bool
    {
        if ($submittedAnswer === null || trim($submittedAnswer) === '') {
            return false;
        }

        $submitted = trim(mb_strtolower($submittedAnswer));
        $correct = trim(mb_strtolower((string)$this->correct_answer));

        if ($submitted === $correct) {
            return true;
        }

        $options = $this->options;
        if (is_string($options)) {
            $options = json_decode($options, true) ?: [];
        }

        if (is_array($options) && !empty($options)) {
            $letterMap = [
                'أ' => 0, 'ا' => 0, 'إ' => 0, 'آ' => 0, 'a' => 0,
                'ب' => 1, 'b' => 1,
                'ج' => 2, 'c' => 2,
                'د' => 3, 'd' => 3,
                'هـ' => 4, 'ه' => 4, 'e' => 4,
            ];

            // 1. Resolve which option index represents the correct answer
            $correctIndex = null;
            if (isset($letterMap[$correct])) {
                $correctIndex = $letterMap[$correct];
            } elseif (is_numeric($correct) && isset($options[(int)$correct])) {
                $correctIndex = (int)$correct;
            }

            if ($correctIndex === null) {
                foreach ($options as $idx => $opt) {
                    $optText = is_array($opt) ? trim(mb_strtolower($opt['text'] ?? '')) : trim(mb_strtolower((string)$opt));
                    $optImg = is_array($opt) ? trim($opt['image_url'] ?? '') : '';
                    $optId = is_array($opt) ? trim((string)($opt['id'] ?? '')) : '';

                    if (($optText !== '' && $correct === $optText) ||
                        ($optImg !== '' && $correct === mb_strtolower($optImg)) ||
                        ($optId !== '' && $correct === mb_strtolower($optId)) ||
                        ((string)$idx === $correct)) {
                        $correctIndex = $idx;
                        break;
                    }
                }
            }

            // 2. Resolve which option index the submitted answer represents
            $submittedIndex = null;
            if (isset($letterMap[$submitted])) {
                $submittedIndex = $letterMap[$submitted];
            } elseif (preg_match('/^option_(\d+)$/i', $submitted, $optM) && isset($options[(int)$optM[1]])) {
                $submittedIndex = (int)$optM[1];
            } elseif (is_numeric($submitted) && isset($options[(int)$submitted])) {
                $submittedIndex = (int)$submitted;
            }

            if ($submittedIndex === null) {
                foreach ($options as $idx => $opt) {
                    $optText = is_array($opt) ? trim(mb_strtolower($opt['text'] ?? '')) : trim(mb_strtolower((string)$opt));
                    $optImg = is_array($opt) ? trim($opt['image_url'] ?? '') : '';
                    $optId = is_array($opt) ? trim((string)($opt['id'] ?? '')) : '';

                    if (($optText !== '' && $submitted === $optText) ||
                        ($optImg !== '' && $submitted === mb_strtolower($optImg)) ||
                        ($optId !== '' && $submitted === mb_strtolower($optId)) ||
                        ((string)$idx === $submitted)) {
                        $submittedIndex = $idx;
                        break;
                    }
                }
            }

            // 3. Compare indices if both resolved to valid option slots
            if ($correctIndex !== null && $submittedIndex !== null) {
                return $correctIndex === $submittedIndex;
            }

            // 4. Fallback: match submitted against the resolved correct option object
            if ($correctIndex !== null && isset($options[$correctIndex])) {
                $matchedOpt = $options[$correctIndex];
                $optText = is_array($matchedOpt) ? trim(mb_strtolower($matchedOpt['text'] ?? '')) : trim(mb_strtolower((string)$matchedOpt));
                $optImg = is_array($matchedOpt) ? trim($matchedOpt['image_url'] ?? '') : '';

                if (($optText !== '' && $submitted === $optText) ||
                    ($optImg !== '' && $submitted === mb_strtolower($optImg))) {
                    return true;
                }
            }
        }

        return false;
    }
}
