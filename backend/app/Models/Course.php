<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'teacher_id',
        'title',
        'slug',
        'description',
        'cover_image',
        'price',
        'grade',
        'subject',
        'is_published',
        'enable_discount',
        'discount_type',
        'discount_value',
        'availability',
    ];

    protected static function booted()
    {
        static::saving(function ($course) {
            if (empty($course->slug) || $course->isDirty('title')) {
                $slug = self::makeArabicSlug($course->title);
                $originalSlug = $slug;
                $counter = 1;
                while (self::where('slug', $slug)->where('id', '!=', $course->id)->exists()) {
                    $slug = $originalSlug . '-' . $counter;
                    $counter++;
                }
                $course->slug = $slug;
            }
        });
    }

    private static function makeArabicSlug(string $string): string
    {
        $text = preg_replace('~[^\pL\d]+~u', '-', $string);
        $text = preg_replace('~[^-\w\pL\d]+~u', '', $text);
        $text = trim($text, '-');
        $text = preg_replace('~-+~', '-', $text);
        $text = mb_strtolower($text, 'UTF-8');
        if (empty($text)) {
            return 'course-' . \Illuminate\Support\Str::random(5);
        }
        return $text;
    }

    protected $casts = [
        'price' => 'decimal:2',
        'is_published' => 'boolean',
        'enable_discount' => 'boolean',
        'discount_value' => 'decimal:2',
    ];

    protected $appends = ['final_price'];

    public function getFinalPriceAttribute()
    {
        if ($this->enable_discount) {
            if ($this->discount_type === 'percentage') {
                return round($this->price * (1 - ($this->discount_value / 100)), 2);
            } elseif ($this->discount_type === 'fixed') {
                return max(0.00, round($this->price - $this->discount_value, 2));
            }
        }
        return $this->price;
    }

    public function getCoverImageAttribute($value)
    {
        if (empty($value) || $value === 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500') {
            $firstVideo = \App\Models\Video::whereHas('lesson.unit', function ($query) {
                $query->where('course_id', $this->id);
            })->whereNotNull('thumbnail_path')->where('thumbnail_path', '!=', '')->first();
            
            if ($firstVideo) {
                return $firstVideo->thumbnail_path;
            }
        }
        return $value ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500';
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function units()
    {
        return $this->hasMany(Unit::class)->orderBy('order');
    }

    public function packages()
    {
        return $this->hasMany(Package::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function students()
    {
        return $this->belongsToMany(User::class, 'enrollments', 'course_id', 'student_id');
    }

    public function purchaseCodes()
    {
        return $this->hasMany(PurchaseCode::class);
    }

    public function lessons()
    {
        return $this->hasManyThrough(Lesson::class, Unit::class);
    }
}
