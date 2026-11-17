<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuardianStudentRelation extends Model
{
    use HasFactory;

    protected $table = 'guardian_student_relations';

    protected $fillable = [
        'guardian_telegram_account_id', // References telegram_users.id (internal DB ID)
        'student_user_id',             // References users.id (student)
        'verified_phone',              // Phone verified via Telegram Contact
        'status',                      // active, suspended, revoked
        'notifications_enabled',
        'weekly_report_enabled',
        'linked_at',
    ];

    protected $casts = [
        'notifications_enabled' => 'boolean',
        'weekly_report_enabled' => 'boolean',
        'linked_at' => 'datetime',
    ];

    public function guardianTelegram(): BelongsTo
    {
        return $this->belongsTo(TelegramUser::class, 'guardian_telegram_account_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
