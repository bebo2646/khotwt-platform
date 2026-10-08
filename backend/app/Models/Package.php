<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Package extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'teacher_id',
        'title',
        'price',
        'description',
        'cover_image',
        'package_thumbnail',
        'type',
        'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
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

    public function getCoverImageAttribute($value)
    {
        if (empty($value) || $value === 'null' || $value === 'undefined') {
            return null;
        }
        if (str_contains($value, '/storage/uploads/')) {
            return asset('storage/uploads/' . basename($value));
        }
        if (str_starts_with($value, 'uploads/')) {
            return asset('storage/' . $value);
        }
        return $value;
    }

    public function getPackageThumbnailAttribute($value)
    {
        if (empty($value) || $value === 'null' || $value === 'undefined') {
            return null;
        }
        if (str_contains($value, '/storage/uploads/')) {
            return asset('storage/uploads/' . basename($value));
        }
        if (str_starts_with($value, 'uploads/')) {
            return asset('storage/' . $value);
        }
        return $value;
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
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
