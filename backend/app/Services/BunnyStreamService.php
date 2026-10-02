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
    protected string $libraryId = '';
    protected string $apiKey = '';
    protected string $pullZone = '';

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

    public function getLibraryId(): string
    {
        return $this->libraryId;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    /**
     * Get safe runtime diagnostic info without exposing secrets.
     */
    public function getSafeDiagnostics(): array
    {
        return [
            'library_id' => $this->libraryId,
            'api_key_present' => !empty($this->apiKey),
            'api_key_length' => strlen($this->apiKey),
            'cdn_hostname' => config('services.bunny.cdn_hostname') ?: $this->pullZone,
            'app_env' => config('app.env', 'production'),
        ];
    }

    public function getEmbedUrl(string $videoId): string
    {
        return "https://iframe.mediadelivery.net/embed/{$this->libraryId}/{$videoId}";
    }

    public function getThumbnailUrl(string $videoId): string
    {
        $cdnHost = config('services.bunny.cdn_hostname');
        $pullZone = config('services.bunny.pull_zone') ?: $this->pullZone;
        $domain = !empty($cdnHost) ? $cdnHost : (!empty($pullZone) ? $pullZone : 'iframe.mediadelivery.net');
        if (!str_contains($domain, '.')) {
            $domain = "{$domain}.b-cdn.net";
        }
        return "https://{$domain}/{$videoId}/thumbnail.jpg";
    }

    /**
     * Sanitize strings to ensure API keys and secrets are never leaked.
     */
    public function sanitizeErrorMessage(?string $message): string
    {
        if (empty($message)) {
            return '';
        }
        $toRedact = array_filter([
            $this->apiKey,
            config('services.bunny.api_key'),
            config('services.bunny.webhook_secret'),
        ]);
        if (!empty($toRedact)) {
            $message = str_replace($toRedact, '[REDACTED]', $message);
        }
        return $message;
    }

    /**
     * Parse error response from Bunny API, log details, and generate sanitized error message.
     */
    public function parseBunnyErrorResponse($response, string $context): array
    {
        $status = $response->status();
        $rawBody = $response->body();
        $data = $response->json();

        $bunnyMessage = null;
        if (is_array($data)) {
            $bunnyMessage = $data['Message'] ?? $data['message'] ?? $data['error'] ?? null;
        }
        if (!$bunnyMessage && !empty($rawBody)) {
            $bunnyMessage = mb_substr(strip_tags($rawBody), 0, 255);
        }
        if (!$bunnyMessage) {
            $bunnyMessage = "HTTP {$status}";
        }

        $sanitizedBunnyMessage = $this->sanitizeErrorMessage((string)$bunnyMessage);
        $sanitizedBody = $this->sanitizeErrorMessage($rawBody);

        Log::error("Bunny Stream API error during [{$context}]: HTTP {$status}", [
            'status' => $status,
            'response_body' => $sanitizedBody,
            'bunny_message' => $sanitizedBunnyMessage,
        ]);

        $friendlyMessage = match ($status) {
            401 => "فشل التحقق من صلاحية مفتاح Bunny Stream (رمز 401): {$sanitizedBunnyMessage}",
            404 => "الفيديو غير موجود في مكتبة Bunny Stream (رمز 404): {$sanitizedBunnyMessage}",
            400 => "طلب غير صالح إلى Bunny Stream (رمز 400): {$sanitizedBunnyMessage}",
            default => "خطأ في الاتصال بـ Bunny Stream (رمز {$status}): {$sanitizedBunnyMessage}",
        };

        return [
            'status' => $status,
            'raw_body' => $sanitizedBody,
            'bunny_message' => $sanitizedBunnyMessage,
            'sanitized_message' => $friendlyMessage,
        ];
    }

    /**
     * Create a video placeholder on Bunny Stream.
     * Returns structured result array.
     */
    public function createVideo(string $title): array
    {
        if (!$this->isConfigured()) {
            Log::error('Bunny Stream Service createVideo: Not configured.');
            return [
                'success' => false,
                'status' => 400,
                'error' => 'خدمة Bunny Stream غير مهيأة على الخادم.',
                'raw_body' => null,
                'bunny_message' => 'Bunny Stream is not configured on the server.',
            ];
        }

        try {
            $response = Http::withoutVerifying()
                ->timeout(60)
                ->connectTimeout(15)
                ->withHeaders([
                    'AccessKey' => $this->apiKey,
                    'Content-Type' => 'application/json',
                    'accept' => 'application/json',
                ])->post("https://video.bunnycdn.com/library/{$this->libraryId}/videos", [
                    'title' => $title,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'success' => true,
                    'video_id' => $data['guid'] ?? null,
                    'guid' => $data['guid'] ?? null,
                    'data' => $data,
                    'status' => $response->status(),
                ];
            }

            $parsed = $this->parseBunnyErrorResponse($response, 'createVideo');
            return [
                'success' => false,
                'video_id' => null,
                'guid' => null,
                'status' => $parsed['status'],
                'error' => $parsed['sanitized_message'],
                'raw_body' => $parsed['raw_body'],
                'bunny_message' => $parsed['bunny_message'],
            ];
        } catch (\Exception $e) {
            $sanitizedMsg = $this->sanitizeErrorMessage($e->getMessage());
            Log::error('Bunny Stream createVideo exception: ' . $sanitizedMsg);
            return [
                'success' => false,
                'video_id' => null,
                'guid' => null,
                'status' => 500,
                'error' => "استثناء أثناء إنشاء الفيديو على Bunny Stream: {$sanitizedMsg}",
                'raw_body' => null,
                'bunny_message' => $sanitizedMsg,
            ];
        }
    }

    /**
     * Upload video binary to the placeholder.
     * Returns structured result array.
     */
    public function uploadVideo(string $videoId, string $filePath, string $mimeType = 'application/octet-stream'): array
    {
        if (!$this->isConfigured()) {
            Log::error('Bunny Stream Service uploadVideo: Not configured.');
            return [
                'success' => false,
                'status' => 400,
                'error' => 'خدمة Bunny Stream غير مهيأة على الخادم.',
                'raw_body' => null,
                'bunny_message' => 'Bunny Stream is not configured on the server.',
            ];
        }

        if (!file_exists($filePath)) {
            Log::error("Bunny Stream Upload: File not found at {$filePath}");
            return [
                'success' => false,
                'status' => 404,
                'error' => 'لم يتم العثور على ملف الفيديو للرفع.',
                'raw_body' => null,
                'bunny_message' => 'Local video file not found.',
            ];
        }

        try {
            $fileStream = fopen($filePath, 'r');
            if (!$fileStream) {
                return [
                    'success' => false,
                    'status' => 500,
                    'error' => 'تعذر فتح ملف الفيديو للقراءة.',
                    'raw_body' => null,
                    'bunny_message' => 'Could not open file stream for reading.',
                ];
            }

            $response = Http::withoutVerifying()
                ->timeout(3600)
                ->connectTimeout(30)
                ->withHeaders([
                    'AccessKey' => $this->apiKey,
                    'Content-Type' => $mimeType ?: 'application/octet-stream',
                ])->withBody($fileStream, $mimeType ?: 'application/octet-stream')
                  ->put("https://video.bunnycdn.com/library/{$this->libraryId}/videos/{$videoId}");

            if (is_resource($fileStream)) {
                fclose($fileStream);
            }

            if ($response->successful()) {
                return [
                    'success' => true,
                    'status' => $response->status(),
                    'data' => $response->json(),
                ];
            }

            $parsed = $this->parseBunnyErrorResponse($response, 'uploadVideo');
            return [
                'success' => false,
                'status' => $parsed['status'],
                'error' => $parsed['sanitized_message'],
                'raw_body' => $parsed['raw_body'],
                'bunny_message' => $parsed['bunny_message'],
            ];
        } catch (\Exception $e) {
            $sanitizedMsg = $this->sanitizeErrorMessage($e->getMessage());
            Log::error('Bunny Stream uploadVideo exception: ' . $sanitizedMsg);
            return [
                'success' => false,
                'status' => 500,
                'error' => "استثناء أثناء رفع الفيديو إلى Bunny Stream: {$sanitizedMsg}",
                'raw_body' => null,
                'bunny_message' => $sanitizedMsg,
            ];
        }
    }

    /**
     * Validate whether a video actually exists in the configured Bunny Library.
     * Returns structured result array with video details if found.
     */
    public function validateVideoExists(string $videoId): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'exists' => false,
                'status' => 400,
                'error' => 'خدمة Bunny Stream غير مهيأة على الخادم.',
                'raw_body' => null,
                'bunny_message' => 'Bunny Stream is not configured.',
                'data' => null,
            ];
        }

        try {
            $response = Http::withoutVerifying()
                ->timeout(30)
                ->connectTimeout(10)
                ->withHeaders([
                    'AccessKey' => $this->apiKey,
                    'accept' => 'application/json',
                ])->get("https://video.bunnycdn.com/library/{$this->libraryId}/videos/{$videoId}");

            if ($response->status() === 200) {
                return [
                    'success' => true,
                    'exists' => true,
                    'status' => 200,
                    'data' => $response->json(),
                    'error' => null,
                ];
            }

            if ($response->status() === 404) {
                Log::warning("Bunny Stream validateVideoExists: Video {$videoId} not found in library {$this->libraryId} (HTTP 404).");
                return [
                    'success' => false,
                    'exists' => false,
                    'status' => 404,
                    'error' => "الفيديو المحدد ({$videoId}) غير موجود في مكتبة Bunny Stream المعتمدة.",
                    'raw_body' => $response->body(),
                    'bunny_message' => 'Video not found in library.',
                    'data' => null,
                ];
            }

            $parsed = $this->parseBunnyErrorResponse($response, 'validateVideoExists');
            return [
                'success' => false,
                'exists' => false,
                'status' => $parsed['status'],
                'error' => $parsed['sanitized_message'],
                'raw_body' => $parsed['raw_body'],
                'bunny_message' => $parsed['bunny_message'],
                'data' => null,
            ];
        } catch (\Exception $e) {
            $sanitizedMsg = $this->sanitizeErrorMessage($e->getMessage());
            Log::error('Bunny Stream validateVideoExists exception: ' . $sanitizedMsg);
            return [
                'success' => false,
                'exists' => false,
                'status' => 500,
                'error' => "استثناء أثناء التحقق من وجود فيديو Bunny: {$sanitizedMsg}",
                'raw_body' => null,
                'bunny_message' => $sanitizedMsg,
                'data' => null,
            ];
        }
    }

    /**
     * Fetch video details from Bunny Stream.
     * Backwards-compatible helper returning array on success, or null on failure.
     */
    public function getVideoDetails(string $videoId): ?array
    {
        $result = $this->validateVideoExists($videoId);
        return ($result['success'] && $result['exists']) ? $result['data'] : null;
    }

    /**
     * Get structured video existence and details array from Bunny Stream.
     */
    public function getVideo(string $videoId): array
    {
        return $this->validateVideoExists($videoId);
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
            $response = Http::withoutVerifying()
                ->timeout(30)
                ->connectTimeout(10)
                ->withHeaders([
                    'AccessKey' => $this->apiKey,
                    'accept' => 'application/json',
                ])->delete("https://video.bunnycdn.com/library/{$this->libraryId}/videos/{$videoId}");

            if (!$response->successful()) {
                $this->parseBunnyErrorResponse($response, 'deleteVideo');
            }

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Bunny Stream deleteVideo error: ' . $this->sanitizeErrorMessage($e->getMessage()));
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
            $overrideStorage = \DB::table('teacher_resource_overrides')->where('teacher_id', $teacherId)->value('extra_storage_gb') ?? 0;
            $limitGb = $planLimit + $overrideStorage;

            $subscriptionExtraStorage = $subscription->extra_storage_gb;
            $remainingStorage = max(0, $limitGb - $usedGb);

            \Log::info('STORAGE DEBUG', [
                'teacher_id' => $teacherId,
                'plan_storage' => $planLimit,
                'override_storage' => $overrideStorage,
                'subscription_extra_storage' => $subscriptionExtraStorage,
                'addon_storage' => $addonStorage,
                'remaining_storage' => $remainingStorage,
                'final_limit' => $limitGb,
            ]);

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
     * Check if Bunny player URL is already accessible and playable.
     */
    public function isPlayerUrlPlayable(string $videoId): bool
    {
        if (empty($this->libraryId) || empty($videoId)) {
            return false;
        }

        try {
            $playerUrl = "https://player.mediadelivery.net/play/{$this->libraryId}/{$videoId}";
            $response = Http::withoutVerifying()
                ->timeout(4)
                ->connectTimeout(2)
                ->head($playerUrl);

            if ($response->status() === 200) {
                return true;
            }

            if ($response->status() === 405 || !$response->successful()) {
                $getRes = Http::withoutVerifying()
                    ->timeout(4)
                    ->connectTimeout(2)
                    ->withHeaders(['Range' => 'bytes=0-100'])
                    ->get($playerUrl);
                return $getRes->status() === 200 || $getRes->status() === 206;
            }

            return false;
        } catch (\Throwable $t) {
            return false;
        }
    }

    /**
     * Determine comprehensive video status from Bunny API details and playability check.
     */
    public function determineStatus(array $details, ?string $videoId = null): string
    {
        $statusInt = intval($details['status'] ?? 0);
        $encodeProgress = intval($details['encodeProgress'] ?? 0);
        $availableResolutions = trim((string)($details['availableResolutions'] ?? ''));
        $length = intval($details['length'] ?? 0);

        // 1. Permanent failures
        if ($statusInt === 5 || $statusInt === 6 || $statusInt === 8) {
            return 'failed';
        }

        // 2. Definitive finished/ready
        if ($statusInt === 4 || $encodeProgress >= 100) {
            return 'ready';
        }

        // 3. Transcoding with available resolutions and duration is playable
        if ($statusInt === 3 && !empty($availableResolutions) && $length > 0) {
            return 'ready';
        }

        // 4. If status is 2 or 3, check if player URL is confirmed playable
        if (in_array($statusInt, [2, 3]) && $videoId) {
            if ($this->isPlayerUrlPlayable($videoId)) {
                return 'ready';
            }
        }

        // 5. Normal processing stages
        if ($statusInt === 0) {
            return 'queued';
        }
        if ($statusInt === 1) {
            return 'uploaded';
        }

        return 'processing';
    }

    /**
     * Map Bunny Video Status Code (integer) to status string.
     */
    public function mapStatusCodeToString(int $status): string
    {
        return match ($status) {
            0 => 'queued',
            1 => 'uploaded',
            2, 3 => 'processing',
            4 => 'ready',
            5, 6, 8 => 'failed',
            default => 'processing'
        };
    }

    /**
     * Authoritatively synchronize video status, duration, size, and URLs with Bunny Stream.
     */
    public function syncVideoStatus(Video $video): array
    {
        $guid = $video->bunny_video_id ?: $video->bunny_stream_id;
        if (empty($guid)) {
            return [
                'success' => false,
                'status' => 'failed',
                'is_ready' => false,
                'is_failed' => true,
                'message' => 'Missing Bunny video GUID',
            ];
        }

        if (!$this->isConfigured()) {
            $isRdy = in_array($video->bunny_status, ['ready', 'finished']);
            return [
                'success' => false,
                'status' => $video->bunny_status ?: 'queued',
                'is_ready' => $isRdy,
                'is_failed' => $video->bunny_status === 'failed',
                'message' => 'Bunny Stream not configured',
            ];
        }

        $details = $this->getVideoDetails($guid);
        if (!$details) {
            $isOld = $video->created_at && $video->created_at->diffInMinutes(now()) > 30;
            if ($isOld && !in_array($video->bunny_status, ['ready', 'finished'])) {
                $video->update(['bunny_status' => 'failed']);
            }
            $isRdy = in_array($video->bunny_status, ['ready', 'finished']);
            return [
                'success' => false,
                'status' => $video->bunny_status,
                'is_ready' => $isRdy,
                'is_failed' => $video->bunny_status === 'failed',
                'message' => 'Could not fetch video details from Bunny Stream',
            ];
        }

        $statusStr = $this->determineStatus($details, $guid);
        $duration = intval($details['length'] ?? 0);
        $sizeBytes = intval($details['storageSize'] ?? 0);

        $embedUrl = $this->getEmbedUrl($guid);
        $thumbnailUrl = $this->getThumbnailUrl($guid);

        $updateData = [
            'bunny_status' => $statusStr,
            'bunny_embed_url' => $embedUrl,
            'bunny_thumbnail_url' => $thumbnailUrl,
        ];

        if ($duration > 0) {
            $updateData['bunny_duration'] = $duration;
            $updateData['duration_seconds'] = $duration;
        }

        if ($sizeBytes > 0) {
            $updateData['bunny_size_bytes'] = $sizeBytes;
            $updateData['storage_size'] = $sizeBytes;
        }

        $video->update($updateData);

        // Recalculate teacher storage if needed
        $course = $video->lesson?->unit?->course ?? null;
        if ($course && $course->teacher_id && $sizeBytes > 0) {
            try {
                $this->recalculateStorage($course->teacher_id);
            } catch (\Throwable $e) {}
        }

        $isReady = in_array($statusStr, ['ready', 'finished']);
        $isFailed = $statusStr === 'failed';

        return [
            'success' => true,
            'status' => $statusStr,
            'is_ready' => $isReady,
            'is_failed' => $isFailed,
            'duration' => $duration,
            'size_bytes' => $sizeBytes,
            'details' => $details,
        ];
    }

    /**
     * Purge orphaned/abandoned 0-byte video objects from Bunny Stream library that are not linked in the database.
     */
    public function cleanOrphanedVideos(): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'message' => 'Bunny Stream not configured.'];
        }

        try {
            $response = Http::withoutVerifying()
                ->timeout(30)
                ->connectTimeout(10)
                ->withHeaders([
                    'AccessKey' => $this->apiKey,
                    'accept' => 'application/json',
                ])->get("https://video.bunnycdn.com/library/{$this->libraryId}/videos?page=1&itemsPerPage=100");

            if (!$response->successful()) {
                return ['success' => false, 'message' => 'Failed to list Bunny videos'];
            }

            $items = $response->json('items') ?? [];
            $activeGuids = Video::pluck('bunny_video_id')
                ->merge(Video::pluck('bunny_stream_id'))
                ->filter()
                ->unique()
                ->toArray();

            $deletedCount = 0;
            $deletedGuids = [];

            foreach ($items as $item) {
                $guid = $item['guid'] ?? null;
                $status = intval($item['status'] ?? 0);
                $length = intval($item['length'] ?? 0);
                $storageSize = intval($item['storageSize'] ?? 0);

                if ($guid && !in_array($guid, $activeGuids)) {
                    if ($status === 0 || $storageSize === 0 || $length === 0) {
                        if ($this->deleteVideo($guid)) {
                            $deletedCount++;
                            $deletedGuids[] = $guid;
                        }
                    }
                }
            }

            return [
                'success' => true,
                'deleted_count' => $deletedCount,
                'deleted_guids' => $deletedGuids,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Exception cleaning orphaned videos: ' . $e->getMessage(),
            ];
        }
    }
}

