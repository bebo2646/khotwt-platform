<?php

namespace App\Jobs;

use App\Models\Video;
use App\Services\BunnyStreamService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PollBunnyVideoStatus implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected int $videoId;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 60; // Up to 60 times

    /**
     * Create a new job instance.
     */
    public function __construct(int $videoId)
    {
        $this->videoId = $videoId;
    }

    /**
     * Execute the job.
     */
    public function handle(BunnyStreamService $bunnyService): void
    {
        $video = Video::with('lesson.unit.course')->find($this->videoId);
        if (!$video || empty($video->bunny_video_id)) {
            Log::warning("PollBunnyVideoStatus: Video with ID {$this->videoId} or bunny_video_id is empty.");
            return;
        }

        Log::info("PollBunnyVideoStatus: Polling status for video ID {$video->id} (Bunny GUID: {$video->bunny_video_id})");

        $details = $bunnyService->getVideoDetails($video->bunny_video_id);
        if (!$details) {
            Log::warning("PollBunnyVideoStatus: Failed to fetch details for Bunny video: {$video->bunny_video_id}. Re-releasing...");
            $this->release(15);
            return;
        }

        $statusCode = intval($details['status'] ?? 0);
        $statusString = $bunnyService->mapStatusCodeToString($statusCode);
        $duration = intval($details['length'] ?? 0);
        $sizeBytes = intval($details['storageSize'] ?? 0);

        $libraryId = config('services.bunny.library_id') ?? '';
        $cdnHost = config('services.bunny.cdn_hostname');
        $pullZone = config('services.bunny.pull_zone');
        $domain = !empty($cdnHost) ? $cdnHost : (!empty($pullZone) ? $pullZone : 'iframe.mediadelivery.net');

        $embedUrl = "https://iframe.mediadelivery.net/embed/{$libraryId}/{$video->bunny_video_id}";
        $thumbnailUrl = "https://{$domain}/play/{$libraryId}/{$video->bunny_video_id}/thumbnail.jpg";

        // Update the video attributes
        $video->update([
            'bunny_status' => $statusString,
            'bunny_duration' => $duration,
            'bunny_size_bytes' => $sizeBytes,
            'bunny_thumbnail_url' => $thumbnailUrl,
            'bunny_embed_url' => $embedUrl,
            // Sync with existing attributes
            'duration_seconds' => $duration > 0 ? $duration : $video->duration_seconds,
            'thumbnail_path' => $thumbnailUrl,
            'bunny_stream_id' => $video->bunny_video_id, // ensure they are matched
        ]);

        // Recalculate storage for the teacher
        $course = $video->lesson->unit->course ?? null;
        if ($course && $course->teacher_id) {
            $bunnyService->recalculateStorage($course->teacher_id);
        }

        // If it's still encoding or queued, re-release the job back to the queue
        if (in_array($statusString, ['queued', 'processing', 'uploaded'])) {
            $this->release(15);
        }
    }
}
