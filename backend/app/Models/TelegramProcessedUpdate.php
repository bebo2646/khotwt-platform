<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Carbon\Carbon;

class TelegramProcessedUpdate extends Model
{
    use HasFactory;

    protected $table = 'telegram_processed_updates';

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_PROCESSED = 'processed';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'update_id',
        'chat_id',
        'telegram_user_id',
        'status',
        'payload',
        'attempts',
        'error_message',
        'processed_at',
    ];

    protected $casts = [
        'update_id' => 'integer',
        'chat_id' => 'integer',
        'telegram_user_id' => 'integer',
        'payload' => 'array',
        'attempts' => 'integer',
        'processed_at' => 'datetime',
    ];

    public function isProcessed(): bool
    {
        return $this->status === self::STATUS_PROCESSED;
    }

    public function isProcessing(): bool
    {
        return $this->status === self::STATUS_PROCESSING;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function markAsProcessing(): void
    {
        $this->update([
            'status' => self::STATUS_PROCESSING,
            'attempts' => $this->attempts + 1,
        ]);
    }

    public function markAsProcessed(): void
    {
        $this->update([
            'status' => self::STATUS_PROCESSED,
            'processed_at' => Carbon::now(),
            'error_message' => null,
        ]);
    }

    public function markAsFailed(string $error): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'error_message' => substr($error, 0, 1000),
        ]);
    }
}
