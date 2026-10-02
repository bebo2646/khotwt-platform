<?php

namespace App\Jobs;

use App\Models\Video;
use App\Services\BunnyStreamService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PollBunnyVideoStatus implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $videoId;

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
     * Dispatch polling job safely without creating duplicate jobs for the same video.
     */
    public static function dispatchSafely(int $videoId): void
    {
        $cacheKey = "polling_bunny_video_{$videoId}";
        if (Cache::has($cacheKey)) {
            Log::info("PollBunnyVideoStatus: Polling already active for video ID {$videoId}, skipping duplicate dispatch.");
            return;
        }

        Cache::put($cacheKey, true, now()->addMinutes(30));
        static::dispatch($videoId);
    }

    /**
     * Execute the job.
     */
    public function handle(BunnyStreamService $bunnyService): void
    {
        $video = Video::with('lesson.unit.course')->find($this->videoId);
        if (!$video || empty($video->bunny_video_id)) {
            Log::warning("PollBunnyVideoStatus: Video with ID {$this->videoId} not found or bunny_video_id is empty.");
            Cache::forget("polling_bunny_video_{$this->videoId}");
            return;
        }

        // If the video is already ready/finished or failed, stop polling immediately
        if (in_array($video->bunny_status, ['ready', 'finished', 'failed'])) {
            Log::info("PollBunnyVideoStatus: Video ID {$video->id} is already in state '{$video->bunny_status}'. Stopping polling.");
            Cache::forget("polling_bunny_video_{$this->videoId}");
            return;
        }

        Log::info("PollBunnyVideoStatus: Polling status for video ID {$video->id} (Bunny GUID: {$video->bunny_video_id})");

        $syncResult = $bunnyService->syncVideoStatus($video);

        // If video reached a terminal state (ready or failed), stop polling immediately
        if (!empty($syncResult['is_ready']) || !empty($syncResult['is_failed'])) {
            Log::info("PollBunnyVideoStatus: Video ID {$video->id} reached terminal state '{$syncResult['status']}'. Polling finished.");
            Cache::forget("polling_bunny_video_{$this->videoId}");
            return;
        }

        // If it's still processing/queued/uploaded, release back to queue if supported
        Log::info("PollBunnyVideoStatus: Video ID {$video->id} is still processing on Bunny ('{$syncResult['status']}').");

        if ($this->canReleaseJob()) {
            try {
                $this->release(10);
            } catch (\BadMethodCallException $e) {
                Log::info("PollBunnyVideoStatus: release() not supported on current driver: " . $e->getMessage());
            } catch (\Throwable $t) {
                Log::warning("PollBunnyVideoStatus: release error: " . $t->getMessage());
            }
        } else {
            Log::info("PollBunnyVideoStatus: Sync queue or unreleaseable job detected. Polling iteration completed safely without release().");
        }
    }

    /**
     * Determine safely if the job can be released back to queue.
     */
    public function canReleaseJob(): bool
    {
        if (config('queue.default') === 'sync') {
            return false;
        }

        if (!$this->job || $this->job instanceof \Illuminate\Queue\Jobs\SyncJob) {
            return false;
        }

        if (method_exists($this->job, 'getConnectionName') && $this->job->getConnectionName() === 'sync') {
            return false;
        }

        return true;
    }
}
