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
    'category',
    'grades', 
    'status',
    'is_super',
    'is_super_admin',
    'permissions',
    'current_session_token',
    'bunny_storage_used_gb',
    'bunny_storage_limit_gb',
    'teaching_mode',
    'rejection_reason',
    'student_type',
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
            'bunny_storage_used_gb' => 'float',
            'bunny_storage_limit_gb' => 'float',
        ];
    }

    // Role helper methods
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function getPermissionsAttribute($value)
    {
        if ($this->is_super_admin || $this->is_super) {
            $config = require base_path('config/permissions.php');
            return array_keys($config['permissions'] ?? []);
        }
        if (is_array($value)) {
            return $value;
        }
        $perms = json_decode($value, true);
        return is_array($perms) ? $perms : [];
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->is_super_admin || $this->is_super) {
            return true;
        }

        $userPerms = is_array($this->permissions) ? $this->permissions : [];

        if (in_array($permission, $userPerms)) {
            return true;
        }

        // Parent umbrella permissions inheritance
        if (str_starts_with($permission, 'student_activity.') && in_array('students.manage', $userPerms)) {
            return true;
        }
        if (str_starts_with($permission, 'teacher_activity.') && in_array('teachers.manage', $userPerms)) {
            return true;
        }
        if ($permission === 'platform_presence.view' && (in_array('teachers.manage', $userPerms) || in_array('students.manage', $userPerms))) {
            return true;
        }
        if (str_starts_with($permission, 'monthly_exams.') && in_array('exams.manage', $userPerms)) {
            return true;
        }
        if (str_starts_with($permission, 'exam_security.') && in_array('exams.manage', $userPerms)) {
            return true;
        }
        if ($permission === 'academic_year.reset' && in_array('academic_year.initialize', $userPerms)) {
            return true;
        }
        if ($permission === 'academic_year.initialize' && in_array('academic_year.reset', $userPerms)) {
            return true;
        }

        return false;
    }

    public function hasAnyPermission(array|string ...$permissions): bool
    {
        if ($this->is_super_admin || $this->is_super) {
            return true;
        }
        foreach ($permissions as $perm) {
            if (is_array($perm)) {
                foreach ($perm as $p) {
                    if ($this->hasPermission($p)) return true;
                }
            } elseif ($this->hasPermission($perm)) {
                return true;
            }
        }
        return false;
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

    public function getRemainingStorageGbAttribute()
    {
        if ($this->teacherSubscription) {
            return $this->teacherSubscription->remaining_storage_gb;
        }
        return max(0, ($this->bunny_storage_limit_gb ?? 0) - ($this->bunny_storage_used_gb ?? 0));
    }

    public function activityLogs()
    {
        return $this->hasMany(StudentActivityLog::class, 'student_id');
    }

    public function studentSessions()
    {
        return $this->hasMany(StudentSession::class, 'student_id');
    }
}
