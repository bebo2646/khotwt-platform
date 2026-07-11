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
        'view_limit_enabled',
        'max_views',
        'is_bundle',
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
        'view_limit_enabled' => 'boolean',
        'max_views' => 'integer',
        'is_bundle' => 'boolean',
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

    public function childCourses()
    {
        return $this->belongsToMany(Course::class, 'course_bundle_items', 'parent_id', 'child_id')->withTimestamps();
    }

    public function parentBundles()
    {
        return $this->belongsToMany(Course::class, 'course_bundle_items', 'child_id', 'parent_id')->withTimestamps();
    }

    public function getStudentViewLimitDetails($studentId)
    {
        $settings = PlatformSetting::first();
        $globalLimitEnabled = $settings ? (bool)$settings->view_limit_enabled : false;
        $globalDefaultLimit = $settings ? (int)$settings->default_max_views : 10;
        $configuredThreshold = $settings ? (int)$settings->video_threshold_seconds : 300;

        $limitEnabled = $this->view_limit_enabled !== null 
            ? (bool)$this->view_limit_enabled 
            : $globalLimitEnabled;

        if (!$limitEnabled) {
            return [
                'limit_enabled' => false,
                'base_limit' => 0,
                'extra_views' => 0,
                'total_allowed_views' => -1,
                'views_used' => 0,
                'remaining_views' => -1,
                'is_unlimited' => true,
                'is_blocked' => false,
                // Backward compatibility
                'max_views' => -1,
                'remaining' => -1,
                'exceeded' => false
            ];
        }

        $limitRecord = StudentCourseViewLimit::firstOrCreate([
            'student_id' => $studentId,
            'course_id' => $this->id,
        ], [
            'views_used' => 0,
            'max_views_override' => null,
            'extra_views' => 0,
        ]);

        $baseLimit = ($limitRecord && $limitRecord->max_views_override !== null)
            ? (int)$limitRecord->max_views_override
            : ($this->max_views !== null ? (int)$this->max_views : $globalDefaultLimit);

        if (($limitRecord && $limitRecord->max_views_override === -1) || $this->max_views === -1) {
            return [
                'limit_enabled' => true,
                'base_limit' => $baseLimit,
                'extra_views' => $limitRecord ? (int)$limitRecord->extra_views : 0,
                'total_allowed_views' => -1,
                'views_used' => 0,
                'remaining_views' => -1,
                'is_unlimited' => true,
                'is_blocked' => false,
                // Backward compatibility
                'max_views' => -1,
                'remaining' => -1,
                'exceeded' => false
            ];
        }

        $viewsUsed = $limitRecord ? (int)$limitRecord->views_used : 0;
        $extraViews = $limitRecord ? (int)$limitRecord->extra_views : 0;
        $maxAllowed = $baseLimit + $extraViews;
        $remaining = max(0, $maxAllowed - $viewsUsed);

        return [
            'limit_enabled' => true,
            'base_limit' => $baseLimit,
            'extra_views' => $extraViews,
            'total_allowed_views' => $maxAllowed,
            'views_used' => $viewsUsed,
            'remaining_views' => $remaining,
            'is_unlimited' => false,
            'is_blocked' => $viewsUsed >= $maxAllowed,
            // Backward compatibility
            'max_views' => $maxAllowed,
            'remaining' => $remaining,
            'exceeded' => $viewsUsed >= $maxAllowed
        ];
    }

    public function hasExceededViewLimitForStudent($studentId)
    {
        $details = $this->getStudentViewLimitDetails($studentId);
        return $details['is_blocked'];
    }
}
