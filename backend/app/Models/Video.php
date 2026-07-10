<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Video extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'title',
        'bunny_stream_id',
        'bunny_embed_url',
        'duration_seconds',
        'thumbnail_path',
        'resolution',
        'bunny_video_id',
        'bunny_thumbnail_url',
        'bunny_duration',
        'bunny_size_bytes',
        'bunny_status',
    ];

    protected $appends = ['duration_text'];

    public static function formatSecondsToWords($seconds)
    {
        $seconds = intval($seconds);
        if ($seconds <= 0) {
            return "0 seconds";
        }
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = $seconds % 60;

        $parts = [];
        if ($hours > 0) {
            $parts[] = $hours . " " . ($hours == 1 ? "hour" : "hours");
        }
        if ($minutes > 0) {
            $parts[] = $minutes . " " . ($minutes == 1 ? "minute" : "minutes");
        }
        if ($secs > 0 || empty($parts)) {
            $parts[] = $secs . " " . ($secs == 1 ? "second" : "seconds");
        }

        return implode(" ", $parts);
    }

    public function getDurationTextAttribute()
    {
        return self::formatSecondsToWords($this->duration_seconds);
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function progresses()
    {
        return $this->hasMany(VideoProgress::class);
    }
}
