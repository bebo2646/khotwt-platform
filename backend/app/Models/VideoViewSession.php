<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VideoViewSession extends Model
{
    protected $table = 'video_view_sessions';

    protected $fillable = [
        'session_id',
        'student_id',
        'video_id',
        'course_id',
        'watch_time',
        'counted',
    ];

    protected $casts = [
        'watch_time' => 'integer',
        'counted' => 'boolean',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function video()
    {
        return $this->belongsTo(Video::class, 'video_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }
}
