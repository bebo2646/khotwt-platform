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

    public function getLibraryId(): string
    {
        return $this->libraryId;
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
        return "https://{$domain}/play/{$this->libraryId}/{$videoId}/thumbnail.jpg";
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

