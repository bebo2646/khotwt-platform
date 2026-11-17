<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelegramUser extends Model
{
    use HasFactory;

    protected $table = 'telegram_users';

    protected $fillable = [
        'user_id',
        'telegram_user_id', // External Telegram User ID (e.g. 5839201948)
        'telegram_chat_id', // External Telegram Private Chat ID (User Bot)
        'admin_chat_id',    // External Telegram Private Chat ID (Admin Bot)
        'telegram_username',
        'first_name',
        'last_name',
        'phone',
        'role',
        'is_linked',
        'linked_at',
        'last_interaction_at',
        'marketing_opt_in',
        'notifications_enabled',
        'current_conversation_state',
        'state_payload',
        'admin_conversation_state',
        'admin_state_payload',
        'admin_last_interaction_at',
    ];

    protected $casts = [
        'telegram_user_id' => 'integer',
        'telegram_chat_id' => 'integer',
        'admin_chat_id' => 'integer',
        'is_linked' => 'boolean',
        'linked_at' => 'datetime',
        'last_interaction_at' => 'datetime',
        'admin_last_interaction_at' => 'datetime',
        'marketing_opt_in' => 'boolean',
        'notifications_enabled' => 'boolean',
        'state_payload' => 'array',
        'admin_state_payload' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function guardianRelations(): HasMany
    {
        return $this->hasMany(GuardianStudentRelation::class, 'guardian_telegram_account_id');
    }

    public function campaignDeliveries(): HasMany
    {
        return $this->hasMany(CampaignDelivery::class, 'telegram_account_id');
    }

    public function isGuardian(): bool
    {
        return $this->role === 'guardian' || $this->guardianRelations()->exists();
    }

    public function isTeacher(): bool
    {
        return $this->user && $this->user->isTeacher();
    }

    public function isStudent(): bool
    {
        return $this->user && $this->user->isStudent();
    }
}
