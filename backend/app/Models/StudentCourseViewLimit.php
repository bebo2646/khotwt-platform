<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentCourseViewLimit extends Model
{
    protected $table = 'student_course_view_limits';

    protected $fillable = [
        'student_id',
        'course_id',
        'views_used',
        'max_views_override',
        'extra_views',
    ];

    protected $casts = [
        'views_used' => 'integer',
        'max_views_override' => 'integer',
        'extra_views' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }
}
