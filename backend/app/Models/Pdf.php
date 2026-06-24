<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Pdf extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'title',
        'file_path',
        'page_count',
        'file_size',
        'preview_path',
    ];

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }
}
