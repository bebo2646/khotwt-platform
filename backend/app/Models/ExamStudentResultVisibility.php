<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ExamStudentResultVisibility extends Model
{
    use HasFactory;

    protected $table = 'exam_student_result_visibilities';

    protected $fillable = [
        'exam_id',
        'student_id',
        'show_score',
        'show_student_answers',
        'show_correct_answers',
        'show_explanations',
    ];

    protected $casts = [
        'show_score' => 'boolean',
        'show_student_answers' => 'boolean',
        'show_correct_answers' => 'boolean',
        'show_explanations' => 'boolean',
    ];

    public function exam()
    {
        return $this->belongsTo(Exam::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
