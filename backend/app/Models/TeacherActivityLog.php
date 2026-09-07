<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TeacherActivityLog extends Model
{
    use HasFactory;

    protected $table = 'teacher_activity_logs';

    protected $fillable = [
        'teacher_id',
        'event_type',
        'event_name',
        'description',
        'course_id',
        'unit_id',
        'lesson_id',
        'video_id',
        'exam_id',
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

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class, 'unit_id');
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
}
