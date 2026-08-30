<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Exam extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'course_id',
        'teacher_id',
        'title',
        'description',
        'type', // quiz, homework, monthly_exam
        'homework_type', // normal, bubble_sheet
        'stage',
        'grade',
        'subject',
        'category',
        'month',
        'time_limit_minutes',
        'max_score',
        'start_date',
        'start_time',
        'end_date',
        'end_time',
        'max_attempts',
        'passing_score',
        'enable_schedule',
        'open_date',
        'open_time',
        'close_date',
        'close_time',
        'submission_deadline',
        'allowed_violations',
        'auto_submit_on_violation',
        'enable_fullscreen',
        'enable_anti_tab_switching',
        'enable_copy_protection',
        'is_paid',
        'price',
        'is_active',
        'is_published',
        'included_in_course',
        'randomize_questions',
        'randomize_options',
        'use_question_bank',
        'questions_per_attempt',
        'show_result_immediately',
        'show_answers_after_submission',
    ];

    protected $casts = [
        'auto_submit_on_violation' => 'boolean',
        'enable_fullscreen' => 'boolean',
        'enable_anti_tab_switching' => 'boolean',
        'enable_copy_protection' => 'boolean',
        'enable_schedule' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'open_date' => 'date',
        'close_date' => 'date',
        'submission_deadline' => 'datetime',
        'is_paid' => 'boolean',
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'is_published' => 'boolean',
        'included_in_course' => 'boolean',
        'randomize_questions' => 'boolean',
        'randomize_options' => 'boolean',
        'use_question_bank' => 'boolean',
        'show_result_immediately' => 'boolean',
        'show_answers_after_submission' => 'boolean',
    ];

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function questions()
    {
        return $this->hasMany(Question::class);
    }

    public function attempts()
    {
        return $this->hasMany(StudentExam::class);
    }

    public function purchases()
    {
        return $this->hasMany(ExamPurchase::class);
    }

    public function violations()
    {
        return $this->hasMany(ExamViolation::class);
    }
}
