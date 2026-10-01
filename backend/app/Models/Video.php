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
            return "0 ثانية";
        }
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = $seconds % 60;

        $parts = [];
        if ($hours > 0) {
            $parts[] = $hours . " ساعة";
        }
        if ($minutes > 0) {
            $parts[] = $minutes . " دقيقة";
        }
        if ($secs > 0 || empty($parts)) {
            $parts[] = $secs . " ثانية";
        }

        return implode(" و ", $parts);
    }

    public function getDurationTextAttribute()
    {
        return self::formatSecondsToWords($this->duration_seconds);
    }

    public function getBunnyEmbedUrlAttribute($value)
    {
        $videoId = $this->bunny_stream_id ?: $this->bunny_video_id;
        if (!empty($videoId)) {
            $libraryId = config('services.bunny.library_id') ?: config('services.bunny.stream_library_id', env('BUNNY_STREAM_LIBRARY_ID', '766707'));
            return "https://iframe.mediadelivery.net/embed/{$libraryId}/{$videoId}";
        }

        if (!empty($value) && str_contains($value, 'player.mediadelivery.net/play/')) {
            return str_replace('player.mediadelivery.net/play/', 'iframe.mediadelivery.net/embed/', $value);
        }

        return $value;
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
