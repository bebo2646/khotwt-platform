<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VideoProgress extends Model
{
    use HasFactory;

    protected $table = 'video_progresses';

    protected $fillable = [
        'student_id',
        'video_id',
        'course_id',
        'package_id',
        'lesson_id',
        'watched_seconds',
        'watched_percentage',
        'completed',
        'last_position_seconds',
        'views_count',
        'watched_segments',
    ];

    protected $casts = [
        'watched_percentage' => 'decimal:2',
        'completed' => 'boolean',
        'watched_segments' => 'array',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function video()
    {
        return $this->belongsTo(Video::class);
    }
}
