<?php

namespace App\Http\Controllers;

use App\Models\Video;
use App\Services\BunnyStreamService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BunnyWebhookController extends Controller
{
    /**
     * Handle incoming webhooks from Bunny Stream.
     */
    public function handle(Request $request)
    {
        $payload = $request->getContent();
        $secret = config('services.bunny.webhook_secret');

        // Verify the webhook signature if configured
        if (!empty($secret)) {
            $receivedSignature = strtolower($request->header('x-bunny-signature') ?? '');
            $computedSignature = strtolower(hash_hmac('sha1', $payload, $secret));

            if (!hash_equals($computedSignature, $receivedSignature)) {
                Log::warning('Bunny Stream Webhook: Signature verification failed.', [
                    'received' => $receivedSignature,
                    'computed' => $computedSignature
                ]);
                return response()->json(['message' => 'Invalid signature'], 401);
            }
        } else {
            Log::info('Bunny Stream Webhook: Secret not configured, bypassing signature check (development mode).');
        }

        $data = json_decode($payload, true);
        if (!$data) {
            return response()->json(['message' => 'Empty or invalid JSON payload'], 400);
        }

        $libraryId = $data['VideoLibraryId'] ?? null;
        $videoId = $data['VideoGuid'] ?? null;
        $statusCode = isset($data['Status']) ? intval($data['Status']) : null;

        if (empty($videoId)) {
            return response()->json(['message' => 'Missing VideoGuid in payload'], 400);
        }

        Log::info("Bunny Stream Webhook received: Video {$videoId}, Status Code: {$statusCode}");

        // Find the video in our database
        $video = Video::where('bunny_video_id', $videoId)
            ->orWhere('bunny_stream_id', $videoId)
            ->first();

        if (!$video) {
            Log::warning("Bunny Stream Webhook: Video with GUID {$videoId} not found in database.");
            return response()->json(['message' => 'Video not found'], 404);
        }

        // Initialize Bunny Stream Service
        $bunnyService = new BunnyStreamService();
        
        // Map status code to standard status string
        $statusString = 'processing';
        if ($statusCode !== null) {
            $statusString = $bunnyService->mapStatusCodeToString($statusCode);
        }

        // Fetch latest details from Bunny Stream to sync metadata
        $details = $bunnyService->getVideoDetails($videoId);
        $duration = 0;
        $sizeBytes = 0;

        if ($details) {
            $duration = intval($details['length'] ?? 0);
            $sizeBytes = intval($details['storageSize'] ?? 0);
        }

        $cdnHost = config('services.bunny.cdn_hostname');
        $pullZone = config('services.bunny.pull_zone');
        $domain = !empty($cdnHost) ? $cdnHost : (!empty($pullZone) ? $pullZone : 'iframe.mediadelivery.net');
        $libId = config('services.bunny.library_id');

        $embedUrl = "https://{$domain}/embed/{$libId}/{$videoId}";
        $thumbnailUrl = "https://{$domain}/play/{$libId}/{$videoId}/thumbnail.jpg";

        // Update video
        $video->update([
            'bunny_status' => $statusString,
            'bunny_duration' => $duration > 0 ? $duration : $video->bunny_duration,
            'bunny_size_bytes' => $sizeBytes > 0 ? $sizeBytes : $video->bunny_size_bytes,
            'bunny_thumbnail_url' => $thumbnailUrl,
            'bunny_embed_url' => $embedUrl,
            // Sync legacy fields
            'duration_seconds' => $duration > 0 ? $duration : $video->duration_seconds,
            'thumbnail_path' => $thumbnailUrl,
        ]);

        // Recalculate teacher storage usage
        $course = $video->lesson->unit->course ?? null;
        if ($course && $course->teacher_id) {
            $bunnyService->recalculateStorage($course->teacher_id);
            Log::info("Bunny Stream Webhook: Recalculated storage for teacher ID: {$course->teacher_id}");
        }

        return response()->json([
            'message' => 'Webhook processed successfully',
            'video_id' => $videoId,
            'status' => $statusString,
        ]);
    }
}
