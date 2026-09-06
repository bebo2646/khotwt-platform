<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StudentActivityLog extends Model
{
    use HasFactory;

    protected $table = 'student_activity_logs';

    protected $fillable = [
        'student_id',
        'event_type',
        'event_name',
        'description',
        'course_id',
        'bundle_id',
        'lesson_id',
        'video_id',
        'exam_id',
        'attempt_id',
        'metadata',
        'ip_address',
        'user_agent',
        'session_identifier',
        'occurred_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function bundle()
    {
        return $this->belongsTo(Course::class, 'bundle_id');
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class, 'lesson_id');
    }

    public function video()
    {
        return $this->belongsTo(Video::class, 'video_id');
    }

    public function exam()
    {
        return $this->belongsTo(Exam::class, 'exam_id');
    }

    public function attempt()
    {
        return $this->belongsTo(StudentExam::class, 'attempt_id');
    }
}
