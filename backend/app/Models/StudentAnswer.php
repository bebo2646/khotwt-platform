<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StudentAnswer extends Model
{
    use HasFactory;

    protected $table = 'student_answers';

    protected $fillable = [
        'student_exam_id',
        'question_id',
        'answer_text',
        'is_correct',
        'score',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
    ];

    public function attempt()
    {
        return $this->belongsTo(StudentExam::class, 'student_exam_id');
    }

    public function question()
    {
        return $this->belongsTo(Question::class);
    }
}
