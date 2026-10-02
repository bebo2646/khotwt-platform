<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Unit extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'title',
        'order',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function lessons()
    {
        return $this->hasMany(Lesson::class)->orderBy('order');
    }

    protected static function booted()
    {
        static::created(function ($unit) {
            Course::touchContent($unit->course_id);
        });
        static::updated(function ($unit) {
            Course::touchContent($unit->course_id);
        });
        static::deleted(function ($unit) {
            Course::touchContent($unit->course_id);
        });
    }
}
