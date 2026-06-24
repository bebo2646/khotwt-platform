<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Exam extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'title',
        'type', // quiz, homework, monthly_exam
        'time_limit_minutes',
        'max_score',
        'start_date',
        'start_time',
        'end_date',
        'end_time',
        'max_attempts',
        'passing_score',
        'open_date',
        'close_date',
        'submission_deadline',
        'allowed_violations',
        'auto_submit_on_violation',
        'enable_fullscreen',
        'enable_anti_tab_switching',
        'enable_copy_protection',
        'is_paid',
        'price',
    ];

    protected $casts = [
        'auto_submit_on_violation' => 'boolean',
        'enable_fullscreen' => 'boolean',
        'enable_anti_tab_switching' => 'boolean',
        'enable_copy_protection' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'open_date' => 'date',
        'close_date' => 'date',
        'submission_deadline' => 'datetime',
        'is_paid' => 'boolean',
        'price' => 'decimal:2',
    ];

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function questions()
    {
        return $this->hasMany(Question::class);
    }

    public function attempts()
    {
        return $this->hasMany(StudentExam::class);
    }
}
