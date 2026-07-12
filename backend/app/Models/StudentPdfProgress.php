<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StudentPdfProgress extends Model
{
    use HasFactory;

    protected $table = 'student_pdf_progresses';

    protected $fillable = [
        'student_id',
        'pdf_id',
        'course_id',
        'package_id',
        'lesson_id',
        'open_count',
        'last_opened_at',
    ];

    protected $casts = [
        'last_opened_at' => 'datetime',
        'open_count' => 'integer',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function pdf()
    {
        return $this->belongsTo(Pdf::class);
    }
}
