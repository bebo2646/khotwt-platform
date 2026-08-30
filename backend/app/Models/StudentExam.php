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
        'course_id',
        'package_id',
        'lesson_id',
        'score',
        'status', // started, submitted, graded, terminated_for_cheating
        'teacher_feedback',
        'submitted_at',
        'graded_at',
        'violation_count',
        'violation_timestamps',
        'is_suspicious',
        'shuffle_mapping',
        'session_token',
        'started_at',
        'expires_at',
        'last_heartbeat_at',
        'duration_minutes',
        'auto_submitted',
        'submission_reason',
        'cheat_violations_count',
        'terminated_for_cheating_at',
        'answers_unlocked_at',
        'answers_unlocked_by',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'graded_at' => 'datetime',
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_heartbeat_at' => 'datetime',
        'terminated_for_cheating_at' => 'datetime',
        'answers_unlocked_at' => 'datetime',
        'violation_timestamps' => 'array',
        'is_suspicious' => 'boolean',
        'auto_submitted' => 'boolean',
        'shuffle_mapping' => 'array',
        'score' => 'integer',
        'violation_count' => 'integer',
        'cheat_violations_count' => 'integer',
        'duration_minutes' => 'integer',
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
        return $this->hasMany(StudentAnswer::class, 'student_exam_id');
    }

    public function violations()
    {
        return $this->hasMany(ExamViolation::class, 'student_exam_id');
    }

    public function unlockedBy()
    {
        return $this->belongsTo(User::class, 'answers_unlocked_by');
    }

    public function isTerminatedForCheating(): bool
    {
        return $this->status === 'terminated_for_cheating' || !empty($this->terminated_for_cheating_at);
    }

    public function canViewAnswers(): bool
    {
        if (!$this->isTerminatedForCheating()) {
            return true;
        }

        return !empty($this->answers_unlocked_at);
    }
}
