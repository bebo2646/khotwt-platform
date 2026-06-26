<?php

namespace App\Services;

use App\Models\User;
use App\Models\Video;
use App\Models\TeacherSubscription;
use App\Models\SubscriptionPlan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BunnyStreamService
{
    protected string $libraryId;
    protected string $apiKey;
    protected string $pullZone;

    public function __construct()
    {
        // Prioritize configuration, fallback to environment variables
        $this->libraryId = config('services.bunny.library_id') ?? '';
        $this->apiKey = config('services.bunny.api_key') ?? '';
        
        $pull = config('services.bunny.pull_zone') ?: config('services.bunny.cdn_hostname');
        $this->pullZone = $pull ?: '';
    }

    /**
     * Check if Bunny Stream is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->libraryId) && !empty($this->apiKey);
    }

    /**
     * Create a video placeholder on Bunny Stream.
     */
    public function createVideo(string $title): ?array
    {
        if (!$this->isConfigured()) {
            Log::error('Bunny Stream Service: Not configured.');
            return null;
        }

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'AccessKey' => $this->apiKey,
                'Content-Type' => 'application/json',
                'accept' => 'application/json',
            ])->post("https://video.bunnycdn.com/library/{$this->libraryId}/videos", [
                'title' => $title,
            ]);

            if ($response->successful()) {
                return $response->json(); // Returns array with 'guid', etc.
            }

            Log::error('Bunny Stream createVideo failed: ' . $response->body());
            return null;
        } catch (\Exception $e) {
            Log::error('Bunny Stream createVideo error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Upload video binary to the placeholder.
     */
    public function uploadVideo(string $videoId, string $filePath): bool
    {
        if (!$this->isConfigured()) {
            Log::error('Bunny Stream Service: Not configured.');
            return false;
        }

        if (!file_exists($filePath)) {
            Log::error("Bunny Stream Upload: File not found at {$filePath}");
            return false;
        }

        try {
            // Read file stream and put it to Bunny
            $fileStream = fopen($filePath, 'r');
            if (!$fileStream) {
                return false;
            }

            $response = Http::withoutVerifying()->withHeaders([
                'AccessKey' => $this->apiKey,
            ])->withBody($fileStream, 'video/mp4')
              ->put("https://video.bunnycdn.com/library/{$this->libraryId}/videos/{$videoId}");

            fclose($fileStream);

            if ($response->successful()) {
                return true;
            }

            Log::error('Bunny Stream uploadVideo failed: ' . $response->body());
            return false;
        } catch (\Exception $e) {
            Log::error('Bunny Stream uploadVideo error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Fetch video details from Bunny Stream.
     */
    public function getVideoDetails(string $videoId): ?array
    {
        if (!$this->isConfigured()) {
            return null;
        }

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'AccessKey' => $this->apiKey,
                'accept' => 'application/json',
            ])->get("https://video.bunnycdn.com/library/{$this->libraryId}/videos/{$videoId}");

            if ($response->successful()) {
                return $response->json();
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Bunny Stream getVideoDetails error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Delete video from Bunny Stream.
     */
    public function deleteVideo(string $videoId): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'AccessKey' => $this->apiKey,
                'accept' => 'application/json',
            ])->delete("https://video.bunnycdn.com/library/{$this->libraryId}/videos/{$videoId}");

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Bunny Stream deleteVideo error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Recalculate teacher storage usage and update limits.
     */
    public function recalculateStorage(int $teacherId): void
    {
        $teacher = User::where('id', $teacherId)->where('role', 'teacher')->first();
        if (!$teacher) {
            return;
        }

        // Sum local video sizes in bytes for this teacher
        // (including bunny_size_bytes or local storage_size)
        $totalBytes = Video::whereHas('lesson.unit.course', function ($q) use ($teacherId) {
            $q->where('teacher_id', $teacherId);
        })->sum(\Illuminate\Support\Facades\DB::raw('COALESCE(bunny_size_bytes, storage_size, 0)'));

        // Convert to GB
        $usedGb = round($totalBytes / (1024 * 1024 * 1024), 4);

        // Fetch subscription details to determine limit
        $subscription = TeacherSubscription::with('plan')->where('teacher_id', $teacherId)->first();
        $limitGb = 10.00; // default Starter plan limit

        if ($subscription) {
            // Retrieve plan storage
            if ($subscription->plan) {
                // Determine based on slug or video_storage_gb
                $planSlug = strtolower($subscription->plan->slug ?? '');
                $planLimit = match($planSlug) {
                    'starter' => 10.00,
                    'basic' => 25.00,
                    'pro' => 50.00,
                    'academy' => 100.00,
                    default => floatval($subscription->plan->video_storage_gb ?? $subscription->plan->max_storage_gb ?? 10.00)
                };
            } else {
                $planLimit = 10.00;
            }

            // Add any storage addon amounts
            $addonStorage = $subscription->addons()->where('type', 'storage')->sum('amount');
            $limitGb = $planLimit + $addonStorage;

            // Sync values to the TeacherSubscription model
            $subscription->update([
                'used_storage_bytes' => $totalBytes,
            ]);
        }

        // Update values in the users table for the teacher
        $teacher->update([
            'bunny_storage_used_gb' => $usedGb,
            'bunny_storage_limit_gb' => $limitGb,
        ]);
    }

    /**
     * Check if a teacher exceeds their storage limit.
     */
    public function isStorageLimitExceeded(int $teacherId, int $newFileSizeBytes = 0): bool
    {
        $teacher = User::where('id', $teacherId)->where('role', 'teacher')->first();
        if (!$teacher) {
            return true;
        }

        // Sync storage usage first
        $this->recalculateStorage($teacherId);
        $teacher->refresh();

        $currentUsedBytes = Video::whereHas('lesson.unit.course', function ($q) use ($teacherId) {
            $q->where('teacher_id', $teacherId);
        })->sum(\Illuminate\Support\Facades\DB::raw('COALESCE(bunny_size_bytes, storage_size, 0)'));

        $totalLimitBytes = $teacher->bunny_storage_limit_gb * 1024 * 1024 * 1024;

        return ($currentUsedBytes + $newFileSizeBytes) > $totalLimitBytes;
    }

    /**
     * Map Bunny Video Status Code (integer) to status string.
     */
    public function mapStatusCodeToString(int $status): string
    {
        return match ($status) {
            0 => 'queued',
            1 => 'processing',
            2 => 'processing', // Encoding/transcoding
            3 => 'finished',   // Transcoding finished
            4 => 'finished',   // Playable
            5 => 'failed',
            6 => 'queued',
            7 => 'uploaded',
            8 => 'failed',
            default => 'processing'
        };
    }
}

