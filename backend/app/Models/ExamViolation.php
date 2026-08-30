<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ExamViolation extends Model
{
    use HasFactory;

    protected $table = 'exam_violations';

    protected $fillable = [
        'student_id',
        'exam_id',
        'student_exam_id',
        'violation_type',
        'time_remaining_seconds',
        'question_id',
        'question_number',
        'session_token',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'time_remaining_seconds' => 'integer',
        'question_number' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function studentExam()
    {
        return $this->belongsTo(StudentExam::class, 'student_exam_id');
    }
}
