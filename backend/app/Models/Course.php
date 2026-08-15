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
        'category',
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

    protected $appends = ['final_price', 'units_count', 'lessons_count'];

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
        $isEmpty = empty($value) || $value === 'null' || $value === 'undefined';

        if (($this->is_bundle || $this->is_bundle === 1 || $this->is_bundle === '1') && $isEmpty) {
            $firstChild = $this->childCourses()->first();
            if ($firstChild) {
                return $firstChild->cover_image;
            }
        }

        if ($isEmpty || $value === 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500') {
            $firstVideo = \App\Models\Video::whereHas('lesson.unit', function ($query) {
                $query->where('course_id', $this->id);
            })->whereNotNull('thumbnail_path')->where('thumbnail_path', '!=', '')->first();
            
            if ($firstVideo) {
                return $firstVideo->thumbnail_path;
            }
        }
        return $isEmpty ? 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500' : $value;
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
        // 1. Resolve context course (if student is enrolled via a bundle, use the bundle course)
        $contextCourse = $this;
        
        // Prioritize direct/standalone enrollment for this course
        $enrollment = \App\Models\Enrollment::where('student_id', $studentId)
            ->where('course_id', $this->id)
            ->first();

        if (!$enrollment) {
            // Fall back to bundle enrollment
            $enrollment = \App\Models\Enrollment::where('student_id', $studentId)
                ->where(function ($q) {
                    // Or if enrolled via a bundle package
                    $q->whereIn('package_id', function ($pq) {
                        $pq->select('id')->from('packages')->where('type', 'bundle')->whereIn('id', function($cbi) {
                            $cbi->select('parent_id')->from('course_bundle_items')->where('child_id', $this->id);
                        });
                    })
                    // Or if enrolled via bundle course directly
                    ->orWhereIn('course_id', function ($cq) {
                        $cq->select('parent_id')->from('course_bundle_items')->where('child_id', $this->id);
                    });
                })
                ->first();
        }

        if ($enrollment) {
            if ($enrollment->package && $enrollment->package->type === 'bundle' && $enrollment->package->course) {
                $contextCourse = $enrollment->package->course;
            } elseif ($enrollment->course && $enrollment->course->is_bundle) {
                $contextCourse = $enrollment->course;
            }
        }

        $settings = PlatformSetting::first();
        $globalLimitEnabled = $settings ? (bool)$settings->view_limit_enabled : false;
        $globalDefaultLimit = $settings ? (int)$settings->default_max_views : 10;
        $configuredThreshold = $settings ? (int)$settings->video_threshold_seconds : 300;

        $limitEnabled = $contextCourse->view_limit_enabled !== null 
            ? (bool)$contextCourse->view_limit_enabled 
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
                'exceeded' => false,
                'context_course_id' => $contextCourse->id,
                'context_package_id' => $enrollment ? $enrollment->package_id : null,
            ];
        }

        $limitRecord = StudentCourseViewLimit::firstOrCreate([
            'student_id' => $studentId,
            'course_id' => $contextCourse->id,
        ], [
            'views_used' => 0,
            'max_views_override' => null,
            'extra_views' => 0,
        ]);

        $baseLimit = ($limitRecord && $limitRecord->max_views_override !== null)
            ? (int)$limitRecord->max_views_override
            : ($contextCourse->max_views !== null ? (int)$contextCourse->max_views : $globalDefaultLimit);

        $isUnlimited = (($limitRecord && $limitRecord->max_views_override === -1) || $contextCourse->max_views === -1);

        // Gather all video IDs for this course/bundle
        $videoIds = [];
        if ($contextCourse->is_bundle || $contextCourse->is_bundle === 1 || $contextCourse->is_bundle === '1') {
            $childIds = \DB::table('course_bundle_items')->where('parent_id', $contextCourse->id)->pluck('child_id')->toArray();
            $videoIds = \App\Models\Video::whereIn('lesson_id', function($q) use ($childIds) {
                $q->select('id')->from('lessons')->whereIn('unit_id', function($uq) use ($childIds) {
                    $uq->select('id')->from('units')->whereIn('course_id', $childIds);
                });
            })->pluck('id')->toArray();
        } else {
            $videoIds = \App\Models\Video::whereIn('lesson_id', function($q) {
                $q->select('id')->from('lessons')->whereIn('unit_id', function($uq) {
                    $uq->select('id')->from('units')->where('course_id', $this->id);
                });
            })->pluck('id')->toArray();
        }

        $videoCount = count($videoIds);
        $extraViews = $limitRecord ? (int)$limitRecord->extra_views : 0;

        if ($isUnlimited) {
            return [
                'limit_enabled' => true,
                'base_limit' => $baseLimit,
                'extra_views' => $extraViews,
                'total_allowed_views' => -1,
                'views_used' => 0,
                'remaining_views' => -1,
                'is_unlimited' => true,
                'is_blocked' => false,
                'max_views' => -1,
                'remaining' => -1,
                'exceeded' => false,
                'context_course_id' => $contextCourse->id,
                'context_package_id' => $enrollment ? $enrollment->package_id : null,
            ];
        }

        // Aggregate across all videos in the course
        $maxAllowedPerVideo = $baseLimit + $extraViews;
        $totalAllowedCourse = $videoCount * $maxAllowedPerVideo;
        
        $viewsUsedQuery = \App\Models\VideoProgress::where('student_id', $studentId)
            ->whereIn('video_id', $videoIds)
            ->where('course_id', $contextCourse->id);

        if ($enrollment && $enrollment->package_id) {
            $viewsUsedQuery->where('package_id', $enrollment->package_id);
        } else {
            $viewsUsedQuery->whereNull('package_id');
        }

        $viewsUsedCourse = $viewsUsedQuery->sum('views_count');

        $remaining = max(0, $totalAllowedCourse - $viewsUsedCourse);
        $isBlocked = ($totalAllowedCourse > 0) && ($viewsUsedCourse >= $totalAllowedCourse);

        return [
            'limit_enabled' => true,
            'base_limit' => $baseLimit,
            'extra_views' => $extraViews,
            'total_allowed_views' => $totalAllowedCourse,
            'views_used' => $viewsUsedCourse,
            'remaining_views' => $remaining,
            'is_unlimited' => false,
            'is_blocked' => $isBlocked,
            // Backward compatibility
            'max_views' => $totalAllowedCourse,
            'remaining' => $remaining,
            'exceeded' => $isBlocked,
            'context_course_id' => $contextCourse->id,
            'context_package_id' => $enrollment ? $enrollment->package_id : null,
        ];
    }

    public function hasExceededViewLimitForStudent($studentId)
    {
        $details = $this->getStudentViewLimitDetails($studentId);
        return $details['is_blocked'];
    }

    public function getUnitsCountAttribute()
    {
        if (array_key_exists('units_count', $this->attributes) && $this->attributes['units_count'] !== null) {
            return (int)$this->attributes['units_count'];
        }
        if ($this->is_bundle || $this->is_bundle === 1 || $this->is_bundle === '1') {
            return $this->relationLoaded('childCourses')
                ? $this->childCourses->reduce(function ($carry, $child) { return $carry + $child->units_count; }, 0)
                : $this->childCourses()->get()->reduce(function ($carry, $child) { return $carry + $child->units_count; }, 0);
        }
        if ($this->relationLoaded('units')) {
            return $this->units->count();
        }
        return $this->units()->count();
    }

    public function getLessonsCountAttribute()
    {
        if (array_key_exists('lessons_count', $this->attributes) && $this->attributes['lessons_count'] !== null) {
            return (int)$this->attributes['lessons_count'];
        }
        if ($this->is_bundle || $this->is_bundle === 1 || $this->is_bundle === '1') {
            return $this->relationLoaded('childCourses')
                ? $this->childCourses->reduce(function ($carry, $child) { return $carry + $child->lessons_count; }, 0)
                : $this->childCourses()->get()->reduce(function ($carry, $child) { return $carry + $child->lessons_count; }, 0);
        }
        if ($this->relationLoaded('lessons')) {
            return $this->lessons->count();
        }
        return $this->lessons()->count();
    }

    public function getPdfsCountAttribute()
    {
        if (array_key_exists('pdfs_count', $this->attributes) && $this->attributes['pdfs_count'] !== null) {
            return (int)$this->attributes['pdfs_count'];
        }
        if ($this->is_bundle || $this->is_bundle === 1 || $this->is_bundle === '1') {
            return $this->relationLoaded('childCourses')
                ? $this->childCourses->reduce(function ($carry, $child) { return $carry + $child->pdfs_count; }, 0)
                : $this->childCourses()->get()->reduce(function ($carry, $child) { return $carry + $child->pdfs_count; }, 0);
        }
        return \App\Models\Pdf::whereIn('lesson_id', function ($query) {
            $query->select('id')->from('lessons')->whereIn('unit_id', function ($sub) {
                $sub->select('id')->from('units')->where('course_id', $this->id);
            });
        })->count();
    }

    public function getExamsCountAttribute()
    {
        if (array_key_exists('exams_count', $this->attributes) && $this->attributes['exams_count'] !== null) {
            return (int)$this->attributes['exams_count'];
        }
        if ($this->is_bundle || $this->is_bundle === 1 || $this->is_bundle === '1') {
            return $this->relationLoaded('childCourses')
                ? $this->childCourses->reduce(function ($carry, $child) { return $carry + $child->exams_count; }, 0)
                : $this->childCourses()->get()->reduce(function ($carry, $child) { return $carry + $child->exams_count; }, 0);
        }
        return \App\Models\Exam::whereIn('lesson_id', function ($query) {
            $query->select('id')->from('lessons')->whereIn('unit_id', function ($sub) {
                $sub->select('id')->from('units')->where('course_id', $this->id);
            });
        })->count();
    }

    public function getVideosCountAttribute()
    {
        if (array_key_exists('videos_count', $this->attributes) && $this->attributes['videos_count'] !== null) {
            return (int)$this->attributes['videos_count'];
        }
        if ($this->is_bundle || $this->is_bundle === 1 || $this->is_bundle === '1') {
            return $this->relationLoaded('childCourses')
                ? $this->childCourses->reduce(function ($carry, $child) { return $carry + $child->videos_count; }, 0)
                : $this->childCourses()->get()->reduce(function ($carry, $child) { return $carry + $child->videos_count; }, 0);
        }
        return \App\Models\Video::whereIn('lesson_id', function ($query) {
            $query->select('id')->from('lessons')->whereIn('unit_id', function ($sub) {
                $sub->select('id')->from('units')->where('course_id', $this->id);
            });
        })->count();
    }
}
