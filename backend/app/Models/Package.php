<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Package extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'title',
        'price',
        'description',
        'cover_image',
        'package_thumbnail',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    protected $appends = [
        'lessons_count',
        'original_lessons_total',
        'discount',
    ];

    public function getLessonsCountAttribute()
    {
        return $this->lessons()->count();
    }

    public function getOriginalLessonsTotalAttribute()
    {
        return (float) $this->lessons()->sum('price');
    }

    public function getDiscountAttribute()
    {
        $original = $this->getOriginalLessonsTotalAttribute();
        $price = (float) $this->price;
        return max(0, $original - $price);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function lessons()
    {
        return $this->belongsToMany(Lesson::class, 'package_lessons');
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }
}
