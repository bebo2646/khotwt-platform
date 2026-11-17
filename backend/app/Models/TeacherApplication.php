<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherApplication extends Model
{
    protected $table = 'teacher_applications';

    protected $fillable = [
        'telegram_user_id',
        'name',
        'phone',
        'email',
        'subject',
        'grades',
        'center_details',
        'status', // pending, approved, rejected
        'rejection_reason',
        'created_user_id',
        'reviewed_by_telegram_id',
        'reviewed_at',
    ];

    protected $casts = [
        'grades' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public function createdUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_user_id');
    }

    public function telegramUser(): BelongsTo
    {
        return $this->belongsTo(TelegramUser::class, 'telegram_user_id', 'telegram_user_id');
    }
}
