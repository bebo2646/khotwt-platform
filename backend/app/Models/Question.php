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
}
