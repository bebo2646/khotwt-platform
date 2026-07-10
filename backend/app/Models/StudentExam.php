<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StudentExam extends Model
{
    use HasFactory;

    protected $table = 'student_exams';

    protected $fillable = [
        'student_id',
        'exam_id',
        'score',
        'status', // started, submitted, graded
        'teacher_feedback',
        'submitted_at',
        'graded_at',
        'violation_count',
        'violation_timestamps',
        'is_suspicious',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'graded_at' => 'datetime',
        'violation_timestamps' => 'array',
        'is_suspicious' => 'boolean',
        'shuffle_mapping' => 'array',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
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
