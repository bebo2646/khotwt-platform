<?php

namespace App\Services;

use App\Models\Video;
use App\Models\User;
use App\Models\TeacherSubscription;

class StorageService
{
    protected $bunnyStream;
    protected $bunnySync;

    public function __construct(BunnyStreamService $bunnyStream, BunnySubscriptionService $bunnySync)
    {
        $this->bunnyStream = $bunnyStream;
        $this->bunnySync = $bunnySync;
    }

    /**
     * Sync storage sizes from Bunny CDN for all or specific teacher.
     */
    public function syncStorage(int $teacherId = null)
    {
        return $this->bunnySync->syncStorageAndCodes($teacherId);
    }

    /**
     * Recalculate teacher storage usage.
     */
    public function recalculateStorage(int $teacherId)
    {
        $this->bunnyStream->recalculateStorage($teacherId);
    }

    /**
     * Check if teacher has storage capacity.
     */
    public function hasCapacity(int $teacherId, int $newFileSizeBytes = 0): bool
    {
        return !$this->bunnyStream->isStorageLimitExceeded($teacherId, $newFileSizeBytes);
    }

    /**
     * Delete video from server and local storage.
     */
    public function deleteVideo(string $bunnyId)
    {
        $this->bunnyStream->deleteVideo($bunnyId);
        Video::where('bunny_stream_id', $bunnyId)->delete();
    }
}
