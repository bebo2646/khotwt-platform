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

    protected static function booted()
    {
        static::created(function ($video) {
            $courseId = $video->lesson?->unit?->course_id ?: Lesson::find($video->lesson_id)?->unit?->course_id;
            Course::touchContent($courseId);
        });
        static::updated(function ($video) {
            if ($video->wasChanged(['title', 'thumbnail_path', 'duration_seconds', 'lesson_id', 'bunny_video_id', 'bunny_stream_id'])) {
                $courseId = $video->lesson?->unit?->course_id ?: Lesson::find($video->lesson_id)?->unit?->course_id;
                Course::touchContent($courseId);
            }
        });
        static::deleted(function ($video) {
            $courseId = $video->lesson?->unit?->course_id ?: Lesson::find($video->lesson_id)?->unit?->course_id;
            Course::touchContent($courseId);
        });
    }

    protected $appends = [
        'duration_text',
        'bunny_embed_url',
        'bunny_id',
        'video_url',
    ];

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

    public function getBunnyIdAttribute()
    {
        return $this->bunny_stream_id ?: $this->bunny_video_id;
    }

    public function getVideoUrlAttribute($value)
    {
        return $value ?: $this->bunny_embed_url;
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
