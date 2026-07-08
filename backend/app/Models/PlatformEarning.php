<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PlatformEarning extends Model
{
    use HasFactory;

    protected $table = 'platform_earnings';

    protected $fillable = [
        'teacher_id',
        'amount',
        'course_id',
        'package_id',
        'lesson_id',
        'purchase_code_id',
        'student_id',
        'source',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function package()
    {
        return $this->belongsTo(Package::class, 'package_id');
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class, 'lesson_id');
    }

    public function purchaseCode()
    {
        return $this->belongsTo(PurchaseCode::class, 'purchase_code_id');
    }
}
