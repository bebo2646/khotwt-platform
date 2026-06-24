<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name', 
    'slug',
    'email', 
    'password', 
    'role', 
    'must_change_password', 
    'phone', 
    'parent_phone', 
    'bio', 
    'experience', 
    'avatar', 
    'subject', 
    'grades', 
    'status',
    'is_super',
    'is_super_admin',
    'permissions',
    'current_session_token',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    protected static function booted()
    {
        static::saving(function ($user) {
            if ($user->role === 'teacher' && (empty($user->slug) || $user->isDirty('name'))) {
                $slugName = str_replace('أ. ', '', $user->name);
                $slugName = str_replace('مستر ', '', $slugName);
                $slugName = str_replace('د/ ', '', $slugName);
                $slugName = str_replace('د. ', '', $slugName);
                
                $slug = self::makeArabicSlug($slugName);
                $originalSlug = $slug;
                $counter = 1;
                while (self::where('slug', $slug)->where('id', '!=', $user->id)->exists()) {
                    $slug = $originalSlug . '-' . $counter;
                    $counter++;
                }
                $user->slug = $slug;
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
            return 'teacher-' . \Illuminate\Support\Str::random(5);
        }
        return $text;
    }

    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'grades' => 'array',
            'is_super' => 'boolean',
            'is_super_admin' => 'boolean',
            'permissions' => 'array',
        ];
    }

    // Role helper methods
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->is_super_admin) {
            return true;
        }
        return is_array($this->permissions) && in_array($permission, $this->permissions);
    }

    public function isTeacher(): bool
    {
        return $this->role === 'teacher';
    }

    public function isStudent(): bool
    {
        return $this->role === 'student';
    }

    // Relationships
    public function wallet()
    {
        return $this->hasOne(Wallet::class, 'student_id');
    }

    public function courses()
    {
        return $this->hasMany(Course::class, 'teacher_id');
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    public function enrolledCourses()
    {
        return $this->belongsToMany(Course::class, 'enrollments', 'student_id', 'course_id');
    }

    public function studentExams()
    {
        return $this->hasMany(StudentExam::class, 'student_id');
    }

    public function videoProgresses()
    {
        return $this->hasMany(VideoProgress::class, 'student_id');
    }

    public function teacherSubscription()
    {
        return $this->hasOne(TeacherSubscription::class, 'teacher_id');
    }
}
