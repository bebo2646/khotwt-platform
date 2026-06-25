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

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function progresses()
    {
        return $this->hasMany(VideoProgress::class);
    }
}
