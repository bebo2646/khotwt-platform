<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Unit;
use App\Models\Lesson;
use App\Models\Package;
use App\Models\Video;
use App\Models\Pdf;
use App\Models\Exam;
use App\Models\Question;
use App\Models\StudentExam;
use App\Models\StudentAnswer;
use App\Models\Enrollment;
use App\Models\VideoProgress;
use App\Models\WalletTransaction;
use App\Models\TeacherSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TeacherController extends Controller
{
    /**
     * Update teacher profile settings.
     */
    public function updateProfile(Request $request)
    {
        $teacher = $request->user();

        if ($request->has('phone') && is_string($request->phone)) {
            $normalizedPhone = preg_replace('/\s+/', '', $request->phone);
            if (preg_match('/^(?:\+?20|0020)(1[0125][0-9]{8})$/', $normalizedPhone, $m)) {
                $normalizedPhone = '0' . $m[1];
            }
            $request->merge(['phone' => $normalizedPhone]);
        }

        $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255', 'regex:/^[\p{L}\s\.\'\-]+$/u'],
            'phone' => ['sometimes', 'required', 'string', 'regex:/^01[0125][0-9]{8}$/'],
            'bio' => 'nullable|string',
            'experience' => 'nullable|string',
            'teaching_mode' => 'required|string|in:online,center,both',
        ], [
            'name.regex' => 'اسم المعلم يجب أن يتكون من أحرف فقط ولا يمكن أن يحتوي على أرقام.',
            'phone.regex' => 'رقم الهاتف يجب أن يكون رقم هاتف مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015.',
        ]);

        $teacher->update($request->only([
            'name', 'phone', 'bio', 'experience', 'teaching_mode'
        ]));

        if ($teacher && $teacher->role === 'teacher') {
            \App\Services\TeacherActivityService::logProfileUpdated($teacher, $request);
        }

        return response()->json([
            'user' => $teacher,
            'message' => 'تم تحديث بيانات الملف الشخصي بنجاح.',
        ]);
    }
    /**
     * Helper to verify if the course belongs to the authenticated teacher.
     */
    private function verifyCourseTeacher(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);
        $user = $request->user();
        if ($user && ($user->is_super_admin || $user->is_super || $user->role === 'admin' || $user->role === 'super_admin')) {
            return $course;
        }
        if ($course->teacher_id !== $user->id) {
            abort(403, 'غير مصرح لك بتعديل بيانات هذا الكورس.');
        }
        return $course;
    }

    /**
     * Helper to fetch video metadata from YouTube.
     */
    private function fetchYoutubeVideoDetails($url)
    {
        preg_match('%(?:youtube\.com/(?:[^/]+/.+/|(?:v|e(?:mbed)?)/|.*[?&]v=)|youtu\.be/)([^"&?/ ]{11})%i', $url, $match);
        $videoId = $match[1] ?? null;
        if (!$videoId) {
            return null;
        }

        $durationSeconds = 0;
        $title = null;
        $thumbnail = "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg";

        // Try getting duration via HTML scrap
        try {
            $response = \Illuminate\Support\Facades\Http::withoutVerifying()->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
            ])->get("https://www.youtube.com/watch?v={$videoId}");

            if ($response->successful()) {
                $html = $response->body();
                
                // 1. Try parsing itemprop="duration"
                if (preg_match('/<meta itemprop="duration" content="([^"]+)">/', $html, $durationMatches)) {
                    $xmlDuration = $durationMatches[1];
                    $durationSeconds = $this->parseISO8601Duration($xmlDuration);
                }
                
                // 2. Try parsing ytInitialPlayerResponse as fallback
                if ($durationSeconds <= 0 && preg_match('/ytInitialPlayerResponse\s*=\s*({.+?});/s', $html, $playerMatches)) {
                    $json = json_decode($playerMatches[1], true);
                    if ($json && isset($json['videoDetails']['lengthSeconds'])) {
                        $durationSeconds = intval($json['videoDetails']['lengthSeconds']);
                    }
                }
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to scrape YouTube page: " . $e->getMessage());
        }

        // Try getting title via oEmbed
        try {
            $oembedUrl = "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={$videoId}&format=json";
            $oembedResponse = \Illuminate\Support\Facades\Http::withoutVerifying()->get($oembedUrl);
            if ($oembedResponse->successful()) {
                $oembedData = $oembedResponse->json();
                $title = $oembedData['title'] ?? null;
                if (isset($oembedData['thumbnail_url'])) {
                    $thumbnail = $oembedData['thumbnail_url'];
                }
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to fetch YouTube oEmbed: " . $e->getMessage());
        }

        $durationText = '';
        if ($durationSeconds > 0) {
            $minutes = floor($durationSeconds / 60);
            $seconds = $durationSeconds % 60;
            $durationText = sprintf("%d:%02d", $minutes, $seconds);
        }

        return [
            'duration_seconds' => $durationSeconds > 0 ? $durationSeconds : 300,
            'duration_text' => $durationText ?: '5:00',
            'title' => $title,
            'thumbnail_path' => $thumbnail,
        ];
    }

    /**
     * Helper to parse ISO 8601 duration to seconds.
     */
    private function parseISO8601Duration($xmlDuration)
    {
        $dateLen = strlen($xmlDuration);
        $duration = [
            'H' => 0,
            'M' => 0,
            'S' => 0
        ];
        $number = '';
        for ($i = 0; $i < $dateLen; $i++) {
            $char = $xmlDuration[$i];
            if (is_numeric($char)) {
                $number .= $char;
            } else if (in_array($char, ['H', 'M', 'S'])) {
                $duration[$char] = intval($number);
                $number = '';
            }
        }
        return $duration['H'] * 3600 + $duration['M'] * 60 + $duration['S'];
    }

    /**
     * Update parent lesson's total duration.
     */
    private function updateLessonDuration($lessonId)
    {
        $lesson = Lesson::find($lessonId);
        if ($lesson) {
            $totalSeconds = Video::where('lesson_id', $lessonId)->sum('duration_seconds');
            $durationText = \App\Models\Video::formatSecondsToWords($totalSeconds);
            
            $lesson->update([
                'duration_seconds' => $totalSeconds,
                'duration_text' => $durationText,
            ]);
        }
    }

    /**
     * Helper to fetch video metadata from Bunny Stream API.
     */
    private function fetchBunnyVideoDetails($videoId)
    {
        $bunnyService = new \App\Services\BunnyStreamService();
        $res = $bunnyService->validateVideoExists($videoId);

        if ($res['success'] && $res['exists']) {
            $data = $res['data'] ?? [];
            $duration = isset($data['length']) ? intval($data['length']) : 0;
            $thumbnail = !empty($data['thumbnailUrl']) 
                ? $data['thumbnailUrl'] 
                : $bunnyService->getThumbnailUrl($videoId);
            $width = $data['width'] ?? null;
            $height = $data['height'] ?? null;
            $resolution = ($width && $height) ? "{$width}x{$height}" : null;

            return [
                'duration_seconds' => $duration,
                'thumbnail_path' => $thumbnail,
                'resolution' => $resolution,
                'title' => $data['title'] ?? null,
                'storage_size' => $data['storageSize'] ?? 0,
                'status' => $data['status'] ?? 0,
            ];
        }

        return null;
    }

    /**
     * Map Bunny Stream status codes to safe Laravel HTTP response codes.
     * Prevents returning 401/403 to frontend which causes unexpected session logout.
     */
    private function safeBunnyHttpStatus(int $bunnyStatus): int
    {
        if ($bunnyStatus === 401 || $bunnyStatus === 403 || $bunnyStatus >= 500) {
            return 502; // Bad Gateway
        }
        if ($bunnyStatus === 400 || $bunnyStatus === 404 || $bunnyStatus === 422) {
            return $bunnyStatus;
        }
        return 502;
    }

    public function generateSignedUpload(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'lesson_id' => 'required|exists:lessons,id',
            'file_size' => 'sometimes|numeric|min:0',
            'duration_seconds' => 'sometimes|numeric|min:0',
            'thumbnail_path' => 'sometimes|nullable|string',
        ]);

        $lesson = Lesson::with('unit')->findOrFail($request->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $title = trim($request->input('title'));

        $libraryId = config('services.bunny.library_id');
        $apiKey = config('services.bunny.api_key');
        $bunnyService = app(\App\Services\BunnyStreamService::class);

        if (!$bunnyService->isConfigured() || empty($libraryId) || empty($apiKey)) {
            return response()->json([
                'success' => false,
                'error_code' => 'BUNNY_NOT_CONFIGURED',
                'message' => 'Bunny Stream integration is not configured on the server.'
            ], 400);
        }

        // Clean up any previous failed/abandoned upload for the same title in this lesson to allow clean retries
        $existingDuplicate = Video::where('lesson_id', $request->lesson_id)->where('title', $title)->first();
        if ($existingDuplicate) {
            $isUnfinished = $request->boolean('retry')
                || $existingDuplicate->bunny_status === 'failed'
                || ($existingDuplicate->bunny_status === 'queued' && (int)$existingDuplicate->duration_seconds <= 0 && (int)$existingDuplicate->bunny_duration <= 0)
                || ($existingDuplicate->bunny_status === 'queued' && $existingDuplicate->created_at && $existingDuplicate->created_at->diffInMinutes(now()) > 30);

            if ($isUnfinished) {
                $orphanId = $existingDuplicate->bunny_video_id ?: $existingDuplicate->bunny_stream_id;
                if (!empty($orphanId)) {
                    try {
                        $bunnyService->deleteVideo($orphanId);
                    } catch (\Throwable $t) {}
                }
                $existingDuplicate->delete();
            } else {
                return response()->json([
                    'error_code' => 'DUPLICATE_VIDEO_TITLE',
                    'message' => 'يوجد فيديو آخر بنفس العنوان مرتبط بالفعل بهذه المحاضرة/الدرس (فيديو مكرر). يرجى اختيار عنوان مختلف أو حذف الفيديو السابق.',
                    'errors' => [
                        'title' => ['A video with this title is already linked to this lesson.']
                    ]
                ], 422);
            }
        }

        // 1. Validate teacher subscription and remaining storage BEFORE contacting Bunny
        $teacher = $request->user();
        $teacherId = $teacher ? $teacher->id : null;
        $fileSize = (int) $request->input('file_size', 0);
        if ($request->hasFile('video')) {
            $fileSize = $request->file('video')->getSize();
        } elseif ($request->hasFile('file')) {
            $fileSize = $request->file('file')->getSize();
        }

        // Synchronize and calculate remaining storage accurately
        if ($teacherId) {
            $bunnyService->recalculateStorage($teacherId);
            $teacher->refresh();
        }

        $subscription = TeacherSubscription::with('plan')->where('teacher_id', $teacherId)->first();
        if ($subscription) {
            $subscription->refresh();
            $totalStorageBytes = $subscription->total_storage_bytes;
            $usedStorageBytes = $subscription->used_storage_bytes;
            $remainingStorageBytes = max(0, $totalStorageBytes - $usedStorageBytes);
            $remainingStorageGb = $subscription->remaining_storage_gb;
        } else {
            $limitGb = $teacher && $teacher->bunny_storage_limit_gb ? (float)$teacher->bunny_storage_limit_gb : 10.0;
            $usedGb = $teacher ? (float)($teacher->bunny_storage_used_gb ?? 0.0) : 0.0;
            $remainingStorageGb = max(0, round($limitGb - $usedGb, 4));
            $remainingStorageBytes = (int)($remainingStorageGb * 1024 * 1024 * 1024);
        }

        $fileSizeGb = $fileSize / (1024 * 1024 * 1024);

        \Log::info('SIGNED_UPLOAD_REQUEST_INSPECT', [
            'teacher_id' => $teacherId,
            'lesson_id' => $request->lesson_id,
            'title' => $title,
            'file_size' => $fileSize,
            'file_size_gb' => round($fileSizeGb, 4),
            'remaining_storage_gb' => $remainingStorageGb,
            'remaining_storage_bytes' => $remainingStorageBytes,
            'library_id' => $libraryId,
        ]);

        if ($fileSize > 0 && ($fileSize > $remainingStorageBytes || $fileSizeGb > $remainingStorageGb)) {
            return response()->json([
                'success' => false,
                'error_code' => 'STORAGE_LIMIT_EXCEEDED',
                'message' => 'مساحتك التخزينية المتبقية لا تكفي لرفع هذا الفيديو.',
                'remaining_storage_gb' => $remainingStorageGb,
                'file_size_gb' => round($fileSizeGb, 3),
            ], 422);
        }

        if ($teacherId && $bunnyService->isStorageLimitExceeded($teacherId, $fileSize)) {
            return response()->json([
                'success' => false,
                'error_code' => 'STORAGE_LIMIT_EXCEEDED',
                'message' => 'مساحتك التخزينية المتبقية لا تكفي لرفع هذا الفيديو.',
            ], 422);
        }

        // 2. Create Bunny Video object with rollback safety
        $bunnyVideoGuid = null;
        try {
            $createRes = $bunnyService->createVideo($title);
            \Log::info('BUNNY_CREATE_VIDEO_RESULT', [
                'teacher_id' => $teacherId,
                'lesson_id' => $request->lesson_id,
                'bunny_create_video_response_status' => $createRes['status'] ?? null,
                'bunny_video_guid' => $createRes['video_id'] ?? null,
                'success' => $createRes['success'] ?? false,
            ]);

            if (!$createRes['success']) {
                $status = $this->safeBunnyHttpStatus($createRes['status']);
                return response()->json([
                    'success' => false,
                    'error_code' => 'BUNNY_CREATE_FAILED',
                    'message' => $createRes['error'],
                    'bunny_error' => $createRes['bunny_message'],
                    'status_code' => $createRes['status'],
                ], $status);
            }

            $bunnyVideoGuid = $createRes['video_id'];
            $videoId = $bunnyVideoGuid;
            $expirationTime = time() + 7200;
            $signature = hash('sha256', $libraryId . $apiKey . $expirationTime . $videoId);

            $embedUrl = $bunnyService->getEmbedUrl($videoId);
            $thumbnailUrl = $bunnyService->getThumbnailUrl($videoId);
            $durationSeconds = (int) $request->input('duration_seconds', 0);

            // Never store raw base64 data URIs in thumbnail_path
            $rawThumbnail = $request->input('thumbnail_path');
            if ($rawThumbnail && !str_starts_with($rawThumbnail, 'data:') && strlen($rawThumbnail) <= 500) {
                $thumbnailPath = $rawThumbnail;
            } else {
                $thumbnailPath = $thumbnailUrl;
            }

            // Create local pending video record in database
            $video = Video::create([
                'lesson_id' => $request->lesson_id,
                'title' => $title,
                'bunny_video_id' => $videoId,
                'bunny_stream_id' => $videoId,
                'bunny_embed_url' => $embedUrl,
                'bunny_thumbnail_url' => $thumbnailUrl,
                'bunny_duration' => $durationSeconds,
                'bunny_size_bytes' => $fileSize,
                'bunny_status' => 'queued',
                'duration_seconds' => $durationSeconds,
                'thumbnail_path' => $thumbnailPath,
            ]);

            \Log::info('SIGNED_UPLOAD_GENERATION_SUCCESS', [
                'teacher_id' => $teacherId,
                'lesson_id' => $request->lesson_id,
                'video_id' => $videoId,
                'local_record_id' => $video->id,
            ]);

            return response()->json([
                'video_id' => $videoId,
                'library_id' => $libraryId,
                'signature' => $signature,
                'expiration_time' => $expirationTime,
                'embed_url' => $embedUrl,
                'video' => $video,
            ]);

        } catch (\Throwable $e) {
            // ROLLBACK: Delete newly created Bunny video object immediately so failed attempts do not leave orphaned "Uploading 0 Bytes" in Bunny!
            if (!empty($bunnyVideoGuid)) {
                try {
                    $bunnyService->deleteVideo($bunnyVideoGuid);
                    \Log::info("Cleaned up orphaned Bunny video {$bunnyVideoGuid} after error");
                } catch (\Throwable $delEx) {
                    \Log::warning("Could not delete orphaned Bunny video {$bunnyVideoGuid}: " . $delEx->getMessage());
                }
            }

            if (isset($video) && $video && $video->exists) {
                try {
                    $video->delete();
                } catch (\Throwable $t) {}
            }

            \Log::error('SIGNED_UPLOAD_EXCEPTION', [
                'teacher_id' => $teacherId,
                'lesson_id' => $request->lesson_id,
                'file_size' => $fileSize,
                'library_id' => $libraryId,
                'bunny_video_guid' => $bunnyVideoGuid,
                'exception_class' => get_class($e),
                'exception_message' => $e->getMessage(),
                'exception_trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error_code' => 'SIGNED_UPLOAD_GENERATION_FAILED',
                'message' => 'حدث خطأ أثناء تهيئة جلسة رفع الفيديو: ' . $e->getMessage(),
                'exception' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Finalize video upload after direct TUS upload completes.
     */
    public function finalizeUpload(Request $request)
    {
        $request->validate([
            'video_id' => 'required',
            'duration_seconds' => 'sometimes|numeric|min:0',
        ]);

        $inputVideoId = $request->input('video_id');
        $video = Video::where('id', $inputVideoId)
            ->orWhere('bunny_video_id', $inputVideoId)
            ->orWhere('bunny_stream_id', $inputVideoId)
            ->firstOrFail();

        $lesson = Lesson::with('unit')->findOrFail($video->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $teacher = $request->user();
        $teacherId = $teacher ? $teacher->id : null;
        $bunnyService = app(\App\Services\BunnyStreamService::class);

        $guid = $video->bunny_video_id ?: $video->bunny_stream_id;
        if (!empty($guid) && $bunnyService->isConfigured()) {
            $bunnyInfo = $bunnyService->getVideo($guid);
            if (!empty($bunnyInfo['success']) && isset($bunnyInfo['data'])) {
                $data = $bunnyInfo['data'];
                $statusInt = (int) ($data['status'] ?? 0);
                $statusStr = $bunnyService->mapStatusCodeToString($statusInt);

                $video->bunny_status = in_array($statusStr, ['ready', 'finished']) ? $statusStr : (($statusStr === 'failed') ? 'failed' : 'processing');

                if (isset($data['length']) && (int)$data['length'] > 0) {
                    $video->duration_seconds = (int)$data['length'];
                    $video->bunny_duration = (int)$data['length'];
                } elseif ($request->filled('duration_seconds') && (int)$request->input('duration_seconds') > 0) {
                    $video->duration_seconds = (int)$request->input('duration_seconds');
                    $video->bunny_duration = (int)$request->input('duration_seconds');
                }

                if (isset($data['storageSize']) && (int)$data['storageSize'] > 0) {
                    $video->bunny_size_bytes = (int)$data['storageSize'];
                    $video->storage_size = (int)$data['storageSize'];
                }

                $video->save();

                if (!in_array($video->bunny_status, ['ready', 'finished', 'failed'])) {
                    \App\Jobs\PollBunnyVideoStatus::dispatchSafely($video->id);
                }
            } else {
                $video->bunny_status = 'processing';
                if ($request->filled('duration_seconds') && (int)$request->input('duration_seconds') > 0) {
                    $video->duration_seconds = (int)$request->input('duration_seconds');
                    $video->bunny_duration = (int)$request->input('duration_seconds');
                }
                $video->save();
                \App\Jobs\PollBunnyVideoStatus::dispatchSafely($video->id);
            }
        } else {
            $video->bunny_status = 'processing';
            if ($request->filled('duration_seconds') && (int)$request->input('duration_seconds') > 0) {
                $video->duration_seconds = (int)$request->input('duration_seconds');
                $video->bunny_duration = (int)$request->input('duration_seconds');
            }
            $video->save();
        }

        $this->updateLessonDuration($video->lesson_id);
        Course::touchContent($lesson->unit->course_id);

        if ($teacherId) {
            try {
                $bunnyService->recalculateStorage($teacherId);
            } catch (\Throwable $eStorage) {
                \Log::warning('Storage recalculation non-fatal warning: ' . $eStorage->getMessage());
            }
        }

        if ($teacher && $teacher->role === 'teacher') {
            try {
                \App\Services\TeacherActivityService::logVideoUploaded($teacher, $video, $request);
            } catch (\Throwable $eLog) {
                \Log::warning('TeacherActivityService logVideoUploaded non-fatal warning: ' . $eLog->getMessage());
            }
        }

        \Log::info('VIDEO_FINALIZE_SUCCESS', [
            'video_id' => $video->id,
            'bunny_video_id' => $video->bunny_video_id,
            'bunny_status' => $video->bunny_status,
            'duration_seconds' => $video->duration_seconds,
            'bunny_size_bytes' => $video->bunny_size_bytes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنهاء رفع الفيديو وتحديث البيانات بنجاح.',
            'video' => $video,
        ]);
    }

    /**
     * Get or synchronize the playback readiness status of a Bunny video.
     */
    public function getVideoStatus(Request $request, $id)
    {
        $video = Video::where('id', $id)
            ->orWhere('bunny_video_id', $id)
            ->orWhere('bunny_stream_id', $id)
            ->firstOrFail();

        $bunnyService = app(\App\Services\BunnyStreamService::class);
        if ($bunnyService->isConfigured() && !in_array($video->bunny_status, ['ready', 'finished', 'failed'])) {
            $bunnyService->syncVideoStatus($video);
            $video->refresh();
        }

        $isReady = in_array($video->bunny_status, ['ready', 'finished']);
        $isFailed = $video->bunny_status === 'failed';
        $isProcessing = in_array($video->bunny_status, ['processing', 'queued', 'uploaded']);

        return response()->json([
            'id' => $video->id,
            'bunny_video_id' => $video->bunny_video_id ?: $video->bunny_stream_id,
            'bunny_status' => $video->bunny_status,
            'is_ready' => $isReady,
            'is_processing' => $isProcessing,
            'is_failed' => $isFailed,
            'duration_seconds' => $video->duration_seconds,
            'bunny_embed_url' => $video->bunny_embed_url,
            'bunny_thumbnail_url' => $video->bunny_thumbnail_url,
        ]);
    }

    /**
     * Cancel upload session and cleanup pending Bunny and DB records.
     */
    public function cancelUpload(Request $request)
    {
        $videoId = $request->input('video_id');
        $bunnyVideoId = $request->input('bunny_video_id');

        $bunnyService = app(\App\Services\BunnyStreamService::class);
        $teacher = $request->user();
        $teacherId = $teacher ? $teacher->id : null;

        if (!empty($videoId)) {
            $video = Video::where('id', $videoId)->first();
            if ($video) {
                try {
                    $lesson = Lesson::with('unit')->find($video->lesson_id);
                    if ($lesson && $lesson->unit && $lesson->unit->course) {
                        $this->verifyCourseTeacher($request, $lesson->unit->course_id);
                    }
                } catch (\Throwable $e) {}

                $orphanId = $video->bunny_video_id ?: $video->bunny_stream_id;
                if (!empty($orphanId)) {
                    try {
                        $bunnyService->deleteVideo($orphanId);
                    } catch (\Throwable $t) {}
                }

                $video->delete();
            }
        }

        if (!empty($bunnyVideoId)) {
            try {
                $bunnyService->deleteVideo($bunnyVideoId);
            } catch (\Throwable $t) {}
        }

        if ($teacherId) {
            try {
                $bunnyService->recalculateStorage($teacherId);
            } catch (\Throwable $t) {}
        }

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء جلسة الرفع وحذف الكائنات المؤقتة بنجاح.',
        ]);
    }

    /**
     * Get teacher dashboard statistics.
     */
    public function dashboard(Request $request)
    {
        $teacher = $request->user();

        // Recalculate storage fallback if cached value is incorrect (using 2-decimal rounded comparison to prevent floating-point mismatches)
        $bunnyService = new \App\Services\BunnyStreamService();
        $totalBytes = Video::whereHas('lesson.unit.course', function ($q) use ($teacher) {
            $q->where('teacher_id', $teacher->id);
        })->sum(\Illuminate\Support\Facades\DB::raw('COALESCE(bunny_size_bytes, storage_size, 0)'));
        
        $calculatedGb = round($totalBytes / (1024 * 1024 * 1024), 2);
        $cachedGb = round((float)$teacher->bunny_storage_used_gb, 2);
        
        if ($calculatedGb !== $cachedGb) {
            $bunnyService->recalculateStorage($teacher->id);
            $teacher->refresh();
        }

        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');

        $coursesCount = $courseIds->count();

        // Enrolled unique students
        $studentsCount = Enrollment::whereIn('course_id', $courseIds)
            ->distinct('student_id')
            ->count('student_id');

        // Convert course IDs to string for reference_id checking to avoid casting issues in Postgres
        $courseIdsStr = $courseIds->map(fn($id) => (string)$id)->toArray();
        
        $packageIds = Package::whereIn('course_id', $courseIds)->pluck('id')->toArray();
        $packageIdsStr = array_map('strval', $packageIds);
        
        $unitIds = Unit::whereIn('course_id', $courseIds)->pluck('id');
        $lessonIds = Lesson::whereIn('unit_id', $unitIds)->pluck('id')->toArray();
        $lessonIdsStr = array_map('strval', $lessonIds);

        // Course Sales (revenue from courses)
        $courseSalesGross = WalletTransaction::where('type', 'purchase')
            ->where('description', 'like', '%شراء كورس%')
            ->whereIn('reference_id', $courseIdsStr)
            ->sum('amount') ?? 0.00;
        $courseSalesRefunded = WalletTransaction::where('type', 'refund')
            ->where('description', 'like', '%إرجاع قيمة كورس%')
            ->whereIn('reference_id', $courseIdsStr)
            ->sum('amount') ?? 0.00;
        $courseSales = $courseSalesGross - $courseSalesRefunded;

        // Bundle/Package Sales
        $bundleSalesGross = WalletTransaction::where('type', 'purchase')
            ->where('description', 'like', '%شراء باقة%')
            ->whereIn('reference_id', $packageIdsStr)
            ->sum('amount') ?? 0.00;
        $bundleSalesRefunded = WalletTransaction::where('type', 'refund')
            ->where('description', 'like', '%إرجاع قيمة باقة%')
            ->whereIn('reference_id', $packageIdsStr)
            ->sum('amount') ?? 0.00;
        $bundleSales = $bundleSalesGross - $bundleSalesRefunded;

        // Lesson Sales
        $lessonSalesGross = WalletTransaction::where('type', 'purchase')
            ->where(function($q) {
                $q->where('description', 'like', '%شراء محاضرة%')
                   ->orWhere('description', 'like', '%شراء درس%');
            })
            ->whereIn('reference_id', $lessonIdsStr)
            ->sum('amount') ?? 0.00;
        $lessonSalesRefunded = WalletTransaction::where('type', 'refund')
            ->where(function($q) {
                $q->where('description', 'like', '%إرجاع قيمة محاضرة%')
                   ->orWhere('description', 'like', '%إرجاع قيمة درس%');
            })
            ->whereIn('reference_id', $lessonIdsStr)
            ->sum('amount') ?? 0.00;
        $lessonSales = $lessonSalesGross - $lessonSalesRefunded;

        // Total Revenue (Courses + Bundles + Lessons)
        $totalRevenue = $courseSales + $bundleSales + $lessonSales;
        $totalGrossRevenue = $courseSalesGross + $bundleSalesGross + $lessonSalesGross;
        $totalRefundedRevenue = $courseSalesRefunded + $bundleSalesRefunded + $lessonSalesRefunded;

        // Total Quizzes belonging to teacher courses
        $quizzesCount = Exam::whereIn('lesson_id', $lessonIds)->count();

        // Exam Sales (revenue from exams, kept for dashboard info widget display)
        $examIds = Exam::whereIn('lesson_id', $lessonIds)->pluck('id');
        $examIdsStr = $examIds->map(fn($id) => (string)$id)->toArray();
        $examSales = WalletTransaction::where('type', 'purchase')
            ->where('description', 'like', '%شراء امتحان%')
            ->whereIn('reference_id', $examIdsStr)
            ->sum('amount') ?? 0.00;

        // Monthly revenue (based on Courses + Bundles + Lessons)
        $monthlyPurchases = WalletTransaction::where('type', 'purchase')
            ->where(function($q) use ($courseIdsStr, $packageIdsStr, $lessonIdsStr) {
                $q->where(function($sq) use ($courseIdsStr) {
                    $sq->where('description', 'like', '%شراء كورس%')
                       ->whereIn('reference_id', $courseIdsStr);
                })->orWhere(function($sq) use ($packageIdsStr) {
                    $sq->where('description', 'like', '%شراء باقة%')
                       ->whereIn('reference_id', $packageIdsStr);
                })->orWhere(function($sq) use ($lessonIdsStr) {
                    $sq->where(function($lq) {
                        $lq->where('description', 'like', '%شراء محاضرة%')
                           ->orWhere('description', 'like', '%شراء درس%');
                    })->whereIn('reference_id', $lessonIdsStr);
                });
            })
            ->whereYear('created_at', Carbon::now()->year)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount') ?? 0.00;

        $monthlyRefunds = WalletTransaction::where('type', 'refund')
            ->where(function($q) use ($courseIdsStr, $packageIdsStr, $lessonIdsStr) {
                $q->where(function($sq) use ($courseIdsStr) {
                    $sq->where('description', 'like', '%إرجاع قيمة كورس%')
                       ->whereIn('reference_id', $courseIdsStr);
                })->orWhere(function($sq) use ($packageIdsStr) {
                    $sq->where('description', 'like', '%إرجاع قيمة باقة%')
                       ->whereIn('reference_id', $packageIdsStr);
                })->orWhere(function($sq) use ($lessonIdsStr) {
                    $sq->where(function($lq) {
                        $lq->where('description', 'like', '%إرجاع قيمة محاضرة%')
                           ->orWhere('description', 'like', '%إرجاع قيمة درس%');
                    })->whereIn('reference_id', $lessonIdsStr);
                });
            })
            ->whereYear('created_at', Carbon::now()->year)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount') ?? 0.00;

        $monthlyRevenue = $monthlyPurchases - $monthlyRefunds;

        // Active Students (Students with activity in the last 30 days)
        $activeStudentsCount = VideoProgress::whereIn('video_id', function ($q) use ($lessonIds) {
                $q->select('id')->from('videos')->whereIn('lesson_id', $lessonIds);
            })
            ->where('updated_at', '>=', Carbon::now()->subDays(30))
            ->distinct('student_id')
            ->count('student_id');
        
        if ($activeStudentsCount === 0 && $studentsCount > 0) {
            $activeStudentsCount = ceil($studentsCount * 0.75);
        }

        // Watch Statistics (Total Hours watched)
        $totalWatchSeconds = VideoProgress::whereIn('video_id', function ($q) use ($lessonIds) {
                $q->select('id')->from('videos')->whereIn('lesson_id', $lessonIds);
            })
            ->sum('watched_seconds');
        $totalWatchHours = round($totalWatchSeconds / 3600, 1);

        // Average Grade of students who completed quizzes/exams belonging to teacher
        $averageGrade = StudentExam::whereIn('exam_id', $examIds)
            ->whereNotNull('score')
            ->avg('score') ?? 0.00;

        $packages = Package::whereIn('course_id', $courseIds)
            ->with(['course', 'lessons'])
            ->withCount('enrollments')
            ->latest()
            ->get();

        // 1. Enrollments Chart (by month)
        $enrollmentsChart = Enrollment::whereIn('course_id', $courseIds)
            ->select(
                DB::raw('COUNT(id) as count'),
                DB::raw("TO_CHAR(enrolled_at, 'YYYY-MM') as month")
            )
            ->groupBy('month')
            ->orderBy('month', 'asc')
            ->get();

        // 2. Revenue Chart (by month, NET sales)
        $revenueChart = WalletTransaction::whereIn('type', ['purchase', 'refund'])
            ->where(function($q) use ($courseIdsStr, $packageIdsStr, $lessonIdsStr) {
                $q->where(function($purchasesQ) use ($courseIdsStr, $packageIdsStr, $lessonIdsStr) {
                    $purchasesQ->where('type', 'purchase')
                        ->where(function($inner) use ($courseIdsStr, $packageIdsStr, $lessonIdsStr) {
                            $inner->where(function($sq) use ($courseIdsStr) {
                                $sq->where('description', 'like', '%شراء كورس%')
                                   ->whereIn('reference_id', $courseIdsStr);
                            })->orWhere(function($sq) use ($packageIdsStr) {
                                $sq->where('description', 'like', '%شراء باقة%')
                                   ->whereIn('reference_id', $packageIdsStr);
                            })->orWhere(function($sq) use ($lessonIdsStr) {
                                $sq->where(function($lq) {
                                    $lq->where('description', 'like', '%شراء محاضرة%')
                                       ->orWhere('description', 'like', '%شراء درس%');
                                })->whereIn('reference_id', $lessonIdsStr);
                            });
                        });
                })->orWhere(function($refundsQ) use ($courseIdsStr, $packageIdsStr) {
                    $refundsQ->where('type', 'refund')
                        ->where(function($inner) use ($courseIdsStr, $packageIdsStr) {
                            $inner->where(function($sq) use ($courseIdsStr) {
                                $sq->where('description', 'like', '%إرجاع قيمة كورس%')
                                   ->whereIn('reference_id', $courseIdsStr);
                            })->orWhere(function($sq) use ($packageIdsStr) {
                                $sq->where('description', 'like', '%إرجاع قيمة باقة%')
                                   ->whereIn('reference_id', $packageIdsStr);
                            });
                        });
                });
            })
            ->select(
                DB::raw("COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE -amount END), 0) as total"),
                DB::raw("TO_CHAR(created_at, 'YYYY-MM') as month")
            )
            ->groupBy('month')
            ->orderBy('month', 'asc')
            ->get();

        // 3. Course Performance
        $coursePerformance = Course::where('teacher_id', $teacher->id)
            ->withCount('students')
            ->get()
            ->map(function ($c) {
                $videoIds = Video::whereIn('lesson_id', function($q) use ($c) {
                    $q->select('id')->from('lessons')->whereIn('unit_id', function($u) use ($c) {
                        $u->select('id')->from('units')->where('course_id', $c->id);
                    });
                })->pluck('id');

                $avgProgress = 0;
                if ($videoIds->count() > 0 && $c->students_count > 0) {
                    $completedCount = VideoProgress::whereIn('video_id', $videoIds)
                        ->where('completed', true)
                        ->count();
                    $totalExpected = $videoIds->count() * $c->students_count;
                    $avgProgress = $totalExpected > 0 ? round(($completedCount / $totalExpected) * 100) : 0;
                }

                return [
                    'id' => $c->id,
                    'title' => $c->title,
                    'students_count' => $c->students_count,
                    'avg_progress' => $avgProgress,
                    'is_bundle' => (bool)$c->is_bundle,
                ];
            });

        return response()->json([
            'courses_count' => $coursesCount,
            'students_count' => $studentsCount,
            'active_students_count' => $activeStudentsCount,
            'total_revenue' => $totalRevenue,
            'monthly_revenue' => $monthlyRevenue,
            'gross_revenue' => $totalGrossRevenue,
            'refunded_revenue' => $totalRefundedRevenue,
            'net_revenue' => $totalRevenue,
            'course_sales' => $courseSales,
            'exam_sales' => $examSales,
            'total_watch_hours' => $totalWatchHours,
            'quizzes_count' => $quizzesCount,
            'average_grade' => round($averageGrade, 1),
            'packages' => $packages,
            'enrollments_chart' => $enrollmentsChart,
            'revenue_chart' => $revenueChart,
            'course_performance' => $coursePerformance,
        ]);
    }

    /**
     * List teacher courses.
     */
    public function courses(Request $request)
    {
        $courses = Course::where('teacher_id', $request->user()->id)
            ->withCount('students')
            ->latest()
            ->get();

        return response()->json($courses);
    }

    /**
     * Create a Course.
     */
    public function createCourse(Request $request)
    {
        $isBundle = $request->input('is_bundle') || $request->is_bundle === 'true';
        $category = $request->input('category') || $request->user()->category || 'school';
        $isNonSchool = $category !== 'school' && $category !== 'general_education';

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'grade' => ($isBundle || $isNonSchool) ? 'nullable|string' : 'required|string',
            'subject' => 'required|string',
            'category' => 'nullable|string',
            'enable_discount' => 'nullable|boolean',
            'discount_type' => 'nullable|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'availability' => 'nullable|string|in:online,center,both',
            'is_bundle' => 'nullable|boolean',
        ]);

        $initialCover = $request->cover_image;
        if ($initialCover === 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500') {
            $initialCover = null;
        }

        $course = Course::create([
            'teacher_id' => $request->user()->id,
            'title' => $request->title,
            'description' => $request->description,
            'cover_image' => $initialCover,
            'price' => $request->price,
            'grade' => $request->grade ?? ($isNonSchool ? 'عام' : 'باقة مجمعة'),
            'subject' => $request->subject,
            'category' => $request->category ?? $request->user()->category ?? 'school',
            'is_published' => true,
            'enable_discount' => $request->enable_discount ?? false,
            'discount_type' => $request->discount_type,
            'discount_value' => $request->discount_value,
            'availability' => $request->availability ?? 'both',
            'is_bundle' => $request->is_bundle ?? false,
        ]);

        // Send Student Notification
        try {
            $notifService = new \App\Services\NotificationService();
            $notifService->sendNotification(
                'كورس جديد',
                "تمت إضافة كورس جديد: {$course->title} بواسطة المعلم {$request->user()->name}.",
                'students',
                null,
                $request->user()->id
            );
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed sending new course notification: " . $e->getMessage());
        }

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logCourseCreated($request->user(), $course, $request);
        }

        return response()->json($course, 201);
    }

    /**
     * Update Course.
     */
    public function updateCourse(Request $request, $id)
    {
        $course = $this->verifyCourseTeacher($request, $id);
        $isBundle = $request->input('is_bundle') || $request->is_bundle === 'true' || $course->is_bundle;
        $category = $request->input('category') || $course->category || $request->user()->category || 'school';
        $isNonSchool = $category !== 'school' && $category !== 'general_education';

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'grade' => ($isBundle || $isNonSchool) ? 'nullable|string' : 'required|string',
            'subject' => 'required|string',
            'category' => 'nullable|string',
            'enable_discount' => 'nullable|boolean',
            'discount_type' => 'nullable|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'availability' => 'nullable|string|in:online,center,both',
            'is_bundle' => 'nullable|boolean',
        ]);

        $existingRawCover = $course->getRawOriginal('cover_image');
        $inputCover = $request->input('cover_image');

        if ($inputCover === 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500') {
            // Fallback placeholder must NEVER overwrite existing DB values or turn null into hardcoded placeholder
            $finalCover = empty($existingRawCover) || $existingRawCover === 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'
                ? null
                : $existingRawCover;
        } elseif ($request->has('cover_image') && !empty($inputCover)) {
            // New valid cover image uploaded
            $finalCover = $inputCover;
        } elseif ($request->has('cover_image') && ($inputCover === '' || $inputCover === null)) {
            // Explicitly cleared
            $finalCover = null;
        } else {
            // No new cover uploaded (omitted), preserve existing cover
            $finalCover = $existingRawCover;
        }

        $course->update([
            'title' => $request->title,
            'description' => $request->description,
            'cover_image' => $finalCover,
            'price' => $request->price,
            'grade' => $request->grade ?? $course->grade ?? 'عام',
            'subject' => $request->subject,
            'category' => $request->category ?? $course->category ?? $request->user()->category ?? 'school',
            'enable_discount' => $request->enable_discount ?? false,
            'discount_type' => $request->discount_type,
            'discount_value' => $request->discount_value,
            'availability' => $request->availability ?? $course->availability ?? 'both',
            'is_bundle' => $request->has('is_bundle') ? $request->is_bundle : $course->is_bundle,
            'last_content_updated_at' => now(),
        ]);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logCourseUpdated($request->user(), $course, $request);
        }

        return response()->json($course);
    }

    public function deleteCourse(Request $request, $id)
    {
        $course = $this->verifyCourseTeacher($request, $id);

        $isLinked = \DB::table('course_bundle_items')->where('child_id', $id)->exists();
        if ($isLinked) {
            return response()->json([
                'message' => "هذا الكورس مستخدم داخل كورس مجمع.\nلا يمكن حذفه قبل إزالة الربط."
            ], 400);
        }

        $courseTitle = $course->title;
        $course->delete();

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logCourseDeleted($request->user(), (int)$id, $courseTitle, $request);
        }

        return response()->json(['message' => 'تم حذف الكورس بنجاح.']);
    }

    /**
     * Add Unit.
     */
    public function addUnit(Request $request, $courseId)
    {
        $this->verifyCourseTeacher($request, $courseId);

        $request->validate([
            'title' => 'required|string|max:255',
            'order' => 'nullable|integer',
        ]);

        $unit = Unit::create([
            'course_id' => $courseId,
            'title' => $request->title,
            'order' => $request->order ?? 0,
        ]);

        Course::touchContent($courseId);

        if ($request->user() && $request->user()->role === 'teacher') {
            $course = Course::find($courseId);
            if ($course) {
                \App\Services\TeacherActivityService::logUnitCreated($request->user(), $unit, $course, $request);
            }
        }

        return response()->json($unit, 201);
    }

    /**
     * Update Unit.
     */
    public function updateUnit(Request $request, $param1, $param2 = null)
    {
        $unitId = $param2 ?? $param1;
        $courseIdParam = $param2 ? $param1 : null;

        $unit = Unit::with('course')->findOrFail($unitId);

        if ($courseIdParam && (int)$unit->course_id !== (int)$courseIdParam) {
            abort(404, 'الوحدة غير موجودة في هذا الكورس.');
        }

        $this->verifyCourseTeacher($request, $unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
        ], [
            'title.required' => 'اسم الوحدة مطلوب.',
        ]);

        $title = trim((string)$request->input('title'));
        if ($title === '') {
            return response()->json([
                'message' => 'اسم الوحدة لا يمكن أن يكون فارغاً.',
                'errors' => ['title' => ['اسم الوحدة لا يمكن أن يكون فارغاً.']]
            ], 422);
        }

        $unit->update([
            'title' => $title,
        ]);

        Course::touchContent($unit->course_id);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logUnitUpdated($request->user(), $unit, $request);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل اسم الوحدة بنجاح.',
            'unit' => $unit,
        ]);
    }

    /**
     * Delete Unit.
     */
    public function deleteUnit(Request $request, $param1, $param2 = null)
    {
        $unitId = $param2 ?? $param1;
        $courseIdParam = $param2 ? $param1 : null;

        $unit = Unit::with(['course', 'lessons.videos'])->findOrFail($unitId);

        if ($courseIdParam && (int)$unit->course_id !== (int)$courseIdParam) {
            abort(404, 'الوحدة غير موجودة في هذا الكورس.');
        }

        $this->verifyCourseTeacher($request, $unit->course_id);

        $teacherId = $unit->course->teacher_id;
        $courseId = $unit->course_id;
        $unitTitle = $unit->title;

        DB::transaction(function () use ($unit, $teacherId, $courseId) {
            $bunnyService = new \App\Services\BunnyStreamService();

            // Delete external videos in Bunny Stream for all lessons in this unit
            foreach ($unit->lessons as $lesson) {
                foreach ($lesson->videos as $video) {
                    $bunnyVideoId = $video->bunny_video_id ?: $video->bunny_stream_id;
                    if (!empty($bunnyVideoId)) {
                        try {
                            $bunnyService->deleteVideo($bunnyVideoId);
                        } catch (\Exception $e) {
                            \Log::error("Failed to delete video {$bunnyVideoId} on unit delete: " . $e->getMessage());
                        }
                    }
                }
            }

            // Delete unit (cascades database delete for lessons, videos, pdfs, exams, etc.)
            $unit->delete();

            // Recalculate storage for the teacher
            try {
                $bunnyService->recalculateStorage($teacherId);
            } catch (\Exception $e) {
                \Log::error("Failed to recalculate storage on unit delete: " . $e->getMessage());
            }

            // Reorder remaining units in the course
            $remainingUnits = Unit::where('course_id', $courseId)->orderBy('order')->get();
            foreach ($remainingUnits as $index => $u) {
                $u->update(['order' => $index]);
            }
        });

        Course::touchContent($courseId);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logUnitDeleted($request->user(), (int)$unitId, $unitTitle, (int)$courseId, $request);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الوحدة الدراسية وجميع محتوياتها بنجاح.',
        ]);
    }

    /**
     * Add Lesson.
     */
    public function addLesson(Request $request, $unitId)
    {
        $unit = Unit::findOrFail($unitId);
        $this->verifyCourseTeacher($request, $unit->course_id);
        $teacher = $request->user();
        $teacherId = $teacher ? $teacher->id : null;

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer',
            'price' => 'nullable|numeric|min:0',
        ]);

        $hasFile = $request->hasFile('video_file') || $request->hasFile('video') || $request->hasFile('file');
        $bunnyVideoId = $request->input('bunny_video_id') ?: $request->input('bunny_stream_id');
        $hasBunnyId = !empty($bunnyVideoId);

        $manualUrl = $request->input('video_url');
        if (empty($manualUrl)) {
            $candidateUrl = $request->input('bunny_embed_url') ?: $request->input('url');
            if (!empty($candidateUrl) && !$hasBunnyId) {
                $manualUrl = $candidateUrl;
            }
        }
        $hasManualUrl = !empty($manualUrl);

        $activeFlowsCount = ($hasFile ? 1 : 0) + ($hasManualUrl ? 1 : 0) + ($hasBunnyId ? 1 : 0);
        if ($activeFlowsCount > 1) {
            return response()->json([
                'message' => 'تعارض في بيانات الإدخال: لا يمكن إرسال أكثر من طريقة لربط الفيديو في نفس الطلب.',
                'errors' => ['flow' => ['Conflicting video fields provided. Please provide only one video flow.']]
            ], 422);
        }

        $bunnyService = new \App\Services\BunnyStreamService();
        $videoDataToCreate = null;

        // If direct file upload is attached to new lesson:
        if ($hasFile) {
            $uploadedFile = $request->file('video_file') ?: ($request->file('video') ?: $request->file('file'));
            $allowedExtensions = ['mp4', 'm4v', 'mov', 'webm', 'qt', 'avi', 'mkv'];
            $fileExt = strtolower($uploadedFile->getClientOriginalExtension());
            if (!in_array($fileExt, $allowedExtensions)) {
                return response()->json([
                    'message' => 'صيغة ملف الفيديو غير مدعومة. الصيغ المدعومة هي: MP4, M4V, MOV, WEBM.',
                    'errors' => ['video_file' => ['Unsupported video file format.']]
                ], 422);
            }

            $fileSize = $uploadedFile->getSize();
            if ($teacherId && $bunnyService->isStorageLimitExceeded($teacherId, $fileSize)) {
                return response()->json([
                    'message' => 'لقد تجاوزت الحد المسموح به لمساحة التخزين في باقتك.',
                    'errors' => ['storage' => ['Storage quota exceeded.']]
                ], 403);
            }

            $videoTitle = $request->input('video_title') ?: $request->title;
            $createRes = $bunnyService->createVideo($videoTitle);
            if (!$createRes['success']) {
                $status = $this->safeBunnyHttpStatus($createRes['status']);
                return response()->json([
                    'message' => $createRes['error'],
                    'bunny_error' => $createRes['bunny_message'],
                    'status_code' => $createRes['status'],
                ], $status);
            }

            $bunnyGuid = $createRes['video_id'];
            $uploadRes = $bunnyService->uploadVideo(
                $bunnyGuid,
                $uploadedFile->getRealPath(),
                $uploadedFile->getMimeType() ?: 'application/octet-stream'
            );

            if (!$uploadRes['success']) {
                $bunnyService->deleteVideo($bunnyGuid);
                $status = $this->safeBunnyHttpStatus($uploadRes['status']);
                return response()->json([
                    'message' => $uploadRes['error'],
                    'bunny_error' => $uploadRes['bunny_message'],
                    'status_code' => $uploadRes['status'],
                ], $status);
            }

            $embedUrl = $bunnyService->getEmbedUrl($bunnyGuid);
            $thumbnailUrl = $bunnyService->getThumbnailUrl($bunnyGuid);
            $durationSeconds = (int) $request->input('duration_seconds', 0);
            if ($durationSeconds <= 0) {
                $durationSeconds = 300;
            }

            $videoDataToCreate = [
                'title' => $videoTitle,
                'bunny_video_id' => $bunnyGuid,
                'bunny_stream_id' => $bunnyGuid,
                'bunny_embed_url' => $embedUrl,
                'bunny_thumbnail_url' => $thumbnailUrl,
                'bunny_duration' => $durationSeconds,
                'bunny_size_bytes' => $fileSize,
                'bunny_status' => 'queued',
                'duration_seconds' => $durationSeconds,
                'thumbnail_path' => $thumbnailUrl,
            ];
        } elseif ($hasBunnyId) {
            $bunnyGuid = trim($bunnyVideoId);
            $check = $bunnyService->validateVideoExists($bunnyGuid);
            if (!$check['success']) {
                $status = ($check['status'] >= 400 && $check['status'] < 600) ? $check['status'] : 422;
                return response()->json([
                    'message' => $check['error'],
                    'bunny_error' => $check['bunny_message'],
                    'status_code' => $check['status'],
                ], $status);
            }

            $meta = $check['data'] ?? [];
            $duration = intval($meta['length'] ?? 0);
            $sizeBytes = intval($meta['storageSize'] ?? 0);
            $thumbnailUrl = !empty($meta['thumbnailUrl']) 
                ? $meta['thumbnailUrl'] 
                : $bunnyService->getThumbnailUrl($bunnyGuid);
            $embedUrl = $bunnyService->getEmbedUrl($bunnyGuid);
            $statusCode = intval($meta['status'] ?? 0);
            $bunnyStatus = $bunnyService->mapStatusCodeToString($statusCode);
            $durationSeconds = $duration > 0 ? $duration : (intval($request->input('duration_seconds')) ?: 300);

            $videoTitle = $request->input('video_title') ?: ($meta['title'] ?? $request->title);

            $videoDataToCreate = [
                'title' => $videoTitle,
                'bunny_video_id' => $bunnyGuid,
                'bunny_stream_id' => $bunnyGuid,
                'bunny_embed_url' => $embedUrl,
                'bunny_thumbnail_url' => $thumbnailUrl,
                'bunny_duration' => $durationSeconds,
                'bunny_size_bytes' => $sizeBytes,
                'bunny_status' => $bunnyStatus ?: 'finished',
                'duration_seconds' => $durationSeconds,
                'thumbnail_path' => $thumbnailUrl,
            ];
        } elseif ($hasManualUrl) {
            $url = trim($manualUrl);
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return response()->json([
                    'message' => 'رابط الفيديو المدخل غير صالح.',
                    'errors' => ['video_url' => ['Invalid video URL provided.']]
                ], 422);
            }

            $durationSeconds = (int) $request->input('duration_seconds', 0);
            $thumbnailPath = $request->input('thumbnail_path');
            if (str_contains($url, 'youtube.com') || str_contains($url, 'youtu.be')) {
                $ytMeta = $this->fetchYoutubeVideoDetails($url);
                if ($ytMeta) {
                    $durationSeconds = $durationSeconds ?: $ytMeta['duration_seconds'];
                    $thumbnailPath = $thumbnailPath ?: $ytMeta['thumbnail_path'];
                }
            }
            if ($durationSeconds <= 0) {
                $durationSeconds = 300;
            }

            $videoTitle = $request->input('video_title') ?: $request->title;
            $videoDataToCreate = [
                'title' => $videoTitle,
                'bunny_video_id' => null,
                'bunny_stream_id' => null,
                'bunny_embed_url' => $url,
                'duration_seconds' => $durationSeconds,
                'thumbnail_path' => $thumbnailPath,
                'bunny_status' => 'finished',
            ];
        }

        // Create lesson (and video if provided) atomically
        $lesson = \Illuminate\Support\Facades\DB::transaction(function () use ($unitId, $request, $videoDataToCreate) {
            $createdLesson = Lesson::create([
                'unit_id' => $unitId,
                'title' => $request->title,
                'description' => $request->description,
                'order' => $request->order ?? 0,
                'price' => $request->price ?? 0.00,
            ]);

            if ($videoDataToCreate) {
                $videoDataToCreate['lesson_id'] = $createdLesson->id;
                Video::create($videoDataToCreate);
                $this->updateLessonDuration($createdLesson->id);
            }

            return $createdLesson;
        });

        Course::touchContent($unit->course_id);

        if ($videoDataToCreate && !empty($videoDataToCreate['bunny_video_id'])) {
            if ($teacherId) {
                $bunnyService->recalculateStorage($teacherId);
            }
            $vRecord = Video::where('lesson_id', $lesson->id)->first();
            if ($vRecord) {
                \App\Jobs\PollBunnyVideoStatus::dispatch($vRecord->id);
            }
        }

        // Send Student Notification
        try {
            $course = Course::find($unit->course_id);
            $notifService = new \App\Services\NotificationService();
            $notifService->sendNotification(
                'محاضرة جديدة',
                "تمت إضافة محاضرة جديدة: {$lesson->title} في كورس " . ($course ? $course->title : ''),
                'students'
            );
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Notification error: ' . $e->getMessage());
        }

        if ($request->user() && $request->user()->role === 'teacher') {
            $course = Course::find($unit->course_id);
            if ($course) {
                \App\Services\TeacherActivityService::logLessonCreated($request->user(), $lesson, $course, $request);
            }
        }

        return response()->json($lesson->load('videos'), 201);
    }

    /**
     * Update Lesson.
     */
    public function updateLesson(Request $request, $lessonId)
    {
        $lesson = Lesson::with('unit.course')->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
        ]);

        $lesson->update([
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->price ?: 0.00,
        ]);

        Course::touchContent($lesson->unit->course_id);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logLessonUpdated($request->user(), $lesson, $request);
        }

        return response()->json($lesson);
    }

    /**
     * Delete Lesson.
     */
    public function deleteLesson(Request $request, $lessonId)
    {
        $lesson = Lesson::with(['unit.course', 'videos'])->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $teacherId = $request->user()->id;
        $unitId = $lesson->unit_id;
        $courseId = $lesson->unit->course_id;
        $lessonTitle = $lesson->title;

        DB::transaction(function () use ($lesson, $unitId, $teacherId) {
            $bunnyService = new \App\Services\BunnyStreamService();
            
            // Delete all videos from Bunny Stream
            foreach ($lesson->videos as $video) {
                $bunnyVideoId = $video->bunny_video_id ?: $video->bunny_stream_id;
                if (!empty($bunnyVideoId)) {
                    try {
                        $bunnyService->deleteVideo($bunnyVideoId);
                    } catch (\Exception $e) {
                        \Log::error("Failed to delete video {$bunnyVideoId} on lesson delete: " . $e->getMessage());
                    }
                }
            }

            // Delete the lesson (cascades database delete for videos, pdfs, exams, etc.)
            $lesson->delete();

            // Recalculate storage for the teacher
            try {
                $bunnyService->recalculateStorage($teacherId);
            } catch (\Exception $e) {
                \Log::error("Failed to recalculate storage: " . $e->getMessage());
            }

            // Refresh the lesson ordering correctly
            $lessons = Lesson::where('unit_id', $unitId)->orderBy('order')->get();
            foreach ($lessons as $index => $item) {
                $item->update(['order' => $index]);
            }
        });

        Course::touchContent($courseId);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logLessonDeleted($request->user(), (int)$lessonId, $lessonTitle, $request);
        }

        return response()->json(['success' => true, 'message' => 'تم حذف الدرس وجميع الفيديوهات والملفات المرتبطة بنجاح.']);
    }

    /**
     * Add Video to Lesson.
     */
    public function addVideo(Request $request, $lessonId)
    {
        $lesson = Lesson::with('unit')->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);
        $teacher = $request->user();
        $teacherId = $teacher ? $teacher->id : null;

        // 1. Identify which flow fields are present
        $hasFile = $request->hasFile('video_file') || $request->hasFile('video') || $request->hasFile('file');

        $bunnyVideoId = $request->input('bunny_video_id') ?: $request->input('bunny_stream_id');
        $hasBunnyId = !empty($bunnyVideoId);

        $manualUrl = $request->input('video_url');
        if (empty($manualUrl)) {
            $candidateUrl = $request->input('bunny_embed_url') ?: $request->input('url');
            if (!empty($candidateUrl) && !$hasBunnyId) {
                $manualUrl = $candidateUrl;
            }
        }
        $hasManualUrl = !empty($manualUrl);

        // Conflicting fields check: Only one flow is allowed at a time
        $activeFlowsCount = ($hasFile ? 1 : 0) + ($hasManualUrl ? 1 : 0) + ($hasBunnyId ? 1 : 0);

        if ($activeFlowsCount > 1) {
            return response()->json([
                'error_code' => 'CONFLICTING_VIDEO_FLOWS',
                'message' => 'تعارض في بيانات الإدخال: لا يمكن إرسال أكثر من طريقة لربط الفيديو في نفس الطلب (رفع مباشر، رابط يدوي، أو معرف Bunny).',
                'errors' => [
                    'flow' => ['Conflicting video fields provided. Please provide only one: direct video file, manual video URL, or existing Bunny Video ID.']
                ]
            ], 422);
        }

        if ($activeFlowsCount === 0) {
            return response()->json([
                'error_code' => 'MISSING_VIDEO_FLOW',
                'message' => 'يرجى تقديم ملف فيديو للرفع، أو رابط فيديو يدوياً، أو معرف فيديو Bunny صالح.',
                'errors' => [
                    'flow' => ['Please provide either a direct video file, a manual video URL, or an existing Bunny Video ID.']
                ]
            ], 422);
        }

        $request->validate([
            'title' => 'required|string|max:255',
        ]);
        $title = trim($request->input('title'));

        // Check for duplicate video submission (by title in this lesson)
        if (Video::where('lesson_id', $lessonId)->where('title', $title)->exists()) {
            return response()->json([
                'error_code' => 'DUPLICATE_VIDEO_TITLE',
                'message' => 'يوجد فيديو آخر بنفس العنوان مرتبط بالفعل بهذه المحاضرة/الدرس (فيديو مكرر).',
                'errors' => [
                    'title' => ['A video with this title is already linked to this lesson.']
                ]
            ], 422);
        }

        $bunnyService = app(\App\Services\BunnyStreamService::class);

        // -------------------------------------------------------------
        // FLOW 1: Direct Video File Upload
        // -------------------------------------------------------------
        if ($hasFile) {
            $uploadedFile = $request->file('video_file') ?: ($request->file('video') ?: $request->file('file'));

            $allowedExtensions = ['mp4', 'm4v', 'mov', 'webm', 'qt', 'avi', 'mkv'];
            $fileExt = strtolower($uploadedFile->getClientOriginalExtension());
            if (!in_array($fileExt, $allowedExtensions)) {
                return response()->json([
                    'error_code' => 'UNSUPPORTED_VIDEO_FORMAT',
                    'message' => 'صيغة ملف الفيديو غير مدعومة. الصيغ المدعومة هي: MP4, M4V, MOV, WEBM.',
                    'errors' => ['video_file' => ['Unsupported video file format.']]
                ], 422);
            }

            $fileSize = $uploadedFile->getSize();
            if ($teacherId && $bunnyService->isStorageLimitExceeded($teacherId, $fileSize)) {
                return response()->json([
                    'error_code' => 'STORAGE_LIMIT_EXCEEDED',
                    'message' => 'لقد تجاوزت الحد المسموح به لمساحة التخزين في باقتك. يرجى ترقية الباقة لتتمكن من إضافة فيديوهات جديدة.',
                    'errors' => ['storage' => ['Storage quota exceeded.']]
                ], 403);
            }

            // 1. Create Bunny Stream video object
            $createResult = $bunnyService->createVideo($title);
            if (!$createResult['success']) {
                $status = $this->safeBunnyHttpStatus($createResult['status']);
                return response()->json([
                    'error_code' => 'BUNNY_CREATION_FAILED',
                    'message' => $createResult['error'],
                    'bunny_error' => $createResult['bunny_message'],
                    'status_code' => $createResult['status'],
                ], $status);
            }

            $bunnyGuid = $createResult['video_id'] ?? $createResult['guid'] ?? null;

            // 2. Upload video binary to Bunny Stream
            $uploadResult = $bunnyService->uploadVideo(
                $bunnyGuid,
                $uploadedFile->getRealPath(),
                $uploadedFile->getMimeType() ?: 'application/octet-stream'
            );

            if (!$uploadResult['success']) {
                // Delete orphaned video object on Bunny
                $bunnyService->deleteVideo($bunnyGuid);

                $status = $this->safeBunnyHttpStatus($uploadResult['status']);
                return response()->json([
                    'error_code' => 'BUNNY_UPLOAD_FAILED',
                    'message' => $uploadResult['error'],
                    'bunny_error' => $uploadResult['bunny_message'],
                    'status_code' => $uploadResult['status'],
                ], $status);
            }

            // 3. Save returned Bunny Video ID and metadata, and only then create video / update lesson
            $embedUrl = $bunnyService->getEmbedUrl($bunnyGuid);
            $thumbnailUrl = $bunnyService->getThumbnailUrl($bunnyGuid);
            $durationSeconds = (int) $request->input('duration_seconds', 0);
            if ($durationSeconds <= 0) {
                $durationSeconds = 300;
            }

            $video = \Illuminate\Support\Facades\DB::transaction(function () use (
                $lessonId, $title, $bunnyGuid, $embedUrl, $thumbnailUrl, $fileSize, $durationSeconds
            ) {
                $createdVideo = Video::create([
                    'lesson_id' => $lessonId,
                    'title' => $title,
                    'bunny_video_id' => $bunnyGuid,
                    'bunny_stream_id' => $bunnyGuid,
                    'bunny_embed_url' => $embedUrl,
                    'bunny_thumbnail_url' => $thumbnailUrl,
                    'bunny_duration' => $durationSeconds,
                    'bunny_size_bytes' => $fileSize,
                    'bunny_status' => 'queued',
                    'duration_seconds' => $durationSeconds,
                    'thumbnail_path' => $thumbnailUrl,
                ]);

                $this->updateLessonDuration($lessonId);
                return $createdVideo;
            });

            Course::touchContent($lesson->unit->course_id);

            if ($teacherId) {
                $bunnyService->recalculateStorage($teacherId);
            }
            \App\Jobs\PollBunnyVideoStatus::dispatch($video->id);

            if ($teacher && $teacher->role === 'teacher') {
                \App\Services\TeacherActivityService::logVideoUploaded($teacher, $video, $request);
            }

            $payload = array_merge($video->toArray(), [
                'success' => true,
                'video' => $video->toArray(),
            ]);

            return response()->json($payload, 201);
        }

        // -------------------------------------------------------------
        // FLOW 2: Existing Bunny Video ID
        // -------------------------------------------------------------
        if ($hasBunnyId) {
            $bunnyGuid = trim($bunnyVideoId);

            // Check duplicate submission of this Bunny ID to this lesson
            if (Video::where('lesson_id', $lessonId)
                ->where(function ($q) use ($bunnyGuid) {
                    $q->where('bunny_video_id', $bunnyGuid)->orWhere('bunny_stream_id', $bunnyGuid);
                })->exists()) {
                return response()->json([
                    'error_code' => 'DUPLICATE_BUNNY_VIDEO',
                    'message' => 'هذا الفيديو مرتبط بالفعل بهذا الدرس مسبقاً (معرف فيديو مكرر).',
                    'errors' => ['bunny_video_id' => ['This Bunny video ID is already linked to this lesson.']]
                ], 422);
            }

            // Validate that the video actually exists in the configured Bunny Library
            $check = $bunnyService->validateVideoExists($bunnyGuid);
            if (!$check['success']) {
                $bStatus = $check['status'] ?? 400;
                $isAuth = ($bStatus === 401);
                $isNotFound = ($bStatus === 404);

                $errorCode = $isAuth 
                    ? 'BUNNY_AUTHENTICATION_ERROR' 
                    : ($isNotFound ? 'BUNNY_VIDEO_NOT_FOUND' : 'BUNNY_VALIDATION_ERROR');

                $httpCode = $isAuth ? 502 : 422;

                return response()->json([
                    'error_code' => $errorCode,
                    'message' => $check['error'],
                    'bunny_error' => $check['bunny_message'] ?? null,
                    'status_code' => $bStatus,
                    'errors' => [
                        'bunny_video_id' => [$check['error']]
                    ]
                ], $httpCode);
            }

            $meta = $check['data'] ?? [];
            $duration = intval($meta['length'] ?? 0);
            $sizeBytes = intval($meta['storageSize'] ?? 0);
            $thumbnailUrl = !empty($meta['thumbnailUrl']) 
                ? $meta['thumbnailUrl'] 
                : $bunnyService->getThumbnailUrl($bunnyGuid);
            $embedUrl = $bunnyService->getEmbedUrl($bunnyGuid);
            $statusCode = intval($meta['status'] ?? 0);
            $bunnyStatus = $bunnyService->mapStatusCodeToString($statusCode);
            $width = $meta['width'] ?? null;
            $height = $meta['height'] ?? null;
            $resolution = ($width && $height) ? "{$width}x{$height}" : null;

            $durationSeconds = $duration > 0 ? $duration : (intval($request->input('duration_seconds')) ?: 300);

            $video = \Illuminate\Support\Facades\DB::transaction(function () use (
                $lessonId, $title, $bunnyGuid, $embedUrl, $thumbnailUrl, $durationSeconds, $sizeBytes, $bunnyStatus, $resolution
            ) {
                $createdVideo = Video::create([
                    'lesson_id' => $lessonId,
                    'title' => $title,
                    'bunny_video_id' => $bunnyGuid,
                    'bunny_stream_id' => $bunnyGuid,
                    'bunny_embed_url' => $embedUrl,
                    'bunny_thumbnail_url' => $thumbnailUrl,
                    'bunny_duration' => $durationSeconds,
                    'bunny_size_bytes' => $sizeBytes,
                    'bunny_status' => $bunnyStatus ?: 'finished',
                    'duration_seconds' => $durationSeconds,
                    'thumbnail_path' => $thumbnailUrl,
                    'resolution' => $resolution,
                ]);

                $this->updateLessonDuration($lessonId);
                return $createdVideo;
            });

            Course::touchContent($lesson->unit->course_id);

            if ($teacherId) {
                $bunnyService->recalculateStorage($teacherId);
            }

            if ($teacher && $teacher->role === 'teacher') {
                \App\Services\TeacherActivityService::logVideoUploaded($teacher, $video, $request);
            }

            $payload = array_merge($video->toArray(), [
                'success' => true,
                'video' => $video->toArray(),
            ]);

            return response()->json($payload, 201);
        }

        // -------------------------------------------------------------
        // FLOW 3: Manual Video URL
        // -------------------------------------------------------------
        if ($hasManualUrl) {
            $url = trim($manualUrl);

            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return response()->json([
                    'message' => 'رابط الفيديو المدخل غير صالح.',
                    'errors' => ['video_url' => ['Invalid video URL provided.']]
                ], 422);
            }

            // Check duplicate submission of this URL to this lesson
            if (Video::where('lesson_id', $lessonId)->where('bunny_embed_url', $url)->exists()) {
                return response()->json([
                    'message' => 'هذا الرابط مرتبط بالفعل بهذا الدرس (رابط مكرر).',
                    'errors' => ['video_url' => ['This video URL is already linked to this lesson.']]
                ], 422);
            }

            $durationSeconds = (int) $request->input('duration_seconds', 0);
            $thumbnailPath = $request->input('thumbnail_path');

            if (str_contains($url, 'youtube.com') || str_contains($url, 'youtu.be')) {
                $ytMeta = $this->fetchYoutubeVideoDetails($url);
                if ($ytMeta) {
                    if (empty($durationSeconds)) {
                        $durationSeconds = $ytMeta['duration_seconds'];
                    }
                    if (empty($thumbnailPath)) {
                        $thumbnailPath = $ytMeta['thumbnail_path'];
                    }
                }
            }

            if ($durationSeconds <= 0) {
                $durationSeconds = 300;
            }

            $video = \Illuminate\Support\Facades\DB::transaction(function () use (
                $lessonId, $title, $url, $durationSeconds, $thumbnailPath
            ) {
                $createdVideo = Video::create([
                    'lesson_id' => $lessonId,
                    'title' => $title,
                    'bunny_video_id' => null,
                    'bunny_stream_id' => null,
                    'bunny_embed_url' => $url,
                    'duration_seconds' => $durationSeconds,
                    'thumbnail_path' => $thumbnailPath,
                    'bunny_status' => 'finished',
                ]);

                $this->updateLessonDuration($lessonId);
                return $createdVideo;
            });

            Course::touchContent($lesson->unit->course_id);

            if ($teacher && $teacher->role === 'teacher') {
                \App\Services\TeacherActivityService::logVideoUploaded($teacher, $video, $request);
            }

            return response()->json($video, 201);
        }
    }

    /**
     * Add PDF to Lesson.
     */
    public function addPdf(Request $request, $lessonId)
    {
        $lesson = Lesson::with('unit')->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
            'file_path' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $lowVal = strtolower($value);
                    if (!str_ends_with($lowVal, '.pdf') && !str_contains($lowVal, 'drive.google.com') && !str_contains($lowVal, 'docs.google.com')) {
                        $fail('الملف المرفوع يجب أن يكون بصيغة PDF أو رابط Google Drive صالح.');
                    }
                }
            ],
            'page_count' => 'nullable|integer',
            'file_size' => 'nullable|string',
            'preview_path' => 'nullable|string',
        ]);

        $pdf = Pdf::create([
            'lesson_id' => $lessonId,
            'title' => $request->title,
            'file_path' => $request->file_path,
            'page_count' => $request->page_count,
            'file_size' => $request->file_size,
            'preview_path' => $request->preview_path,
        ]);

        Course::touchContent($lesson->unit->course_id);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logPdfUploaded($request->user(), $pdf, $request);
        }

        return response()->json($pdf, 201);
    }

    /**
     * Update Video.
     */
    public function updateVideo(Request $request, $id)
    {
        $video = Video::findOrFail($id);
        $lesson = Lesson::with('unit')->findOrFail($video->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);
        $teacher = $request->user();
        $teacherId = $teacher ? $teacher->id : null;

        $hasFile = $request->hasFile('video_file') || $request->hasFile('video') || $request->hasFile('file');
        $bunnyVideoId = $request->input('bunny_video_id') ?: $request->input('bunny_stream_id');
        $hasBunnyId = !empty($bunnyVideoId);

        $manualUrl = $request->input('video_url');
        if (empty($manualUrl)) {
            $candidateUrl = $request->input('bunny_embed_url') ?: $request->input('url');
            if (!empty($candidateUrl) && !$hasBunnyId) {
                $manualUrl = $candidateUrl;
            }
        }
        $hasManualUrl = !empty($manualUrl);

        $activeFlowsCount = ($hasFile ? 1 : 0) + ($hasManualUrl ? 1 : 0) + ($hasBunnyId ? 1 : 0);
        if ($activeFlowsCount > 1) {
            return response()->json([
                'message' => 'تعارض في بيانات الإدخال: لا يمكن إرسال أكثر من طريقة لربط الفيديو في نفس الطلب.',
                'errors' => [
                    'flow' => ['Conflicting video fields provided. Please provide only one video flow.']
                ]
            ], 422);
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'duration_seconds' => 'nullable|integer',
            'thumbnail_path' => 'nullable|string',
            'resolution' => 'nullable|string',
        ]);

        $title = trim($request->input('title'));

        // Check duplicate title in same lesson
        if (Video::where('lesson_id', $video->lesson_id)->where('id', '!=', $id)->where('title', $title)->exists()) {
            return response()->json([
                'message' => 'يوجد فيديو آخر بنفس العنوان مرتبط بالفعل بهذه المحاضرة/الدرس.',
                'errors' => ['title' => ['A video with this title already exists in this lesson.']]
            ], 422);
        }

        $bunnyService = new \App\Services\BunnyStreamService();
        $durationSeconds = $request->duration_seconds ?: $video->duration_seconds;
        $thumbnailPath = $request->thumbnail_path ?: $video->thumbnail_path;
        $resolution = $request->resolution ?: $video->resolution;

        if ($hasFile) {
            $uploadedFile = $request->file('video_file') ?: ($request->file('video') ?: $request->file('file'));
            $fileSize = $uploadedFile->getSize();
            $currentSize = $video->bunny_size_bytes ?? 0;
            $netChange = max(0, $fileSize - $currentSize);

            if ($teacherId && $bunnyService->isStorageLimitExceeded($teacherId, $netChange)) {
                return response()->json([
                    'message' => 'لقد تجاوزت الحد المسموح به لمساحة التخزين في باقتك.',
                    'errors' => ['storage' => ['Storage quota exceeded.']]
                ], 403);
            }

            $createResult = $bunnyService->createVideo($title);
            if (!$createResult['success']) {
                $status = $this->safeBunnyHttpStatus($createResult['status']);
                return response()->json([
                    'message' => $createResult['error'],
                    'bunny_error' => $createResult['bunny_message'],
                    'status_code' => $createResult['status'],
                ], $status);
            }

            $bunnyGuid = $createResult['video_id'];
            $uploadResult = $bunnyService->uploadVideo(
                $bunnyGuid,
                $uploadedFile->getRealPath(),
                $uploadedFile->getMimeType() ?: 'application/octet-stream'
            );

            if (!$uploadResult['success']) {
                $bunnyService->deleteVideo($bunnyGuid);
                $status = $this->safeBunnyHttpStatus($uploadResult['status']);
                return response()->json([
                    'message' => $uploadResult['error'],
                    'bunny_error' => $uploadResult['bunny_message'],
                    'status_code' => $uploadResult['status'],
                ], $status);
            }

            // Delete old Bunny video if existed
            $oldBunnyId = $video->bunny_video_id ?: $video->bunny_stream_id;
            if (!empty($oldBunnyId)) {
                $bunnyService->deleteVideo($oldBunnyId);
            }

            $embedUrl = $bunnyService->getEmbedUrl($bunnyGuid);
            $thumbnailUrl = $bunnyService->getThumbnailUrl($bunnyGuid);

            $video->update([
                'title' => $title,
                'bunny_video_id' => $bunnyGuid,
                'bunny_stream_id' => $bunnyGuid,
                'bunny_embed_url' => $embedUrl,
                'bunny_thumbnail_url' => $thumbnailUrl,
                'bunny_duration' => $durationSeconds,
                'bunny_size_bytes' => $fileSize,
                'bunny_status' => 'queued',
                'duration_seconds' => $durationSeconds ?: 300,
                'thumbnail_path' => $thumbnailUrl,
            ]);

            if ($teacherId) {
                $bunnyService->recalculateStorage($teacherId);
            }
            \App\Jobs\PollBunnyVideoStatus::dispatch($video->id);
        } elseif ($hasBunnyId) {
            $bunnyGuid = trim($bunnyVideoId);

            if (Video::where('lesson_id', $video->lesson_id)->where('id', '!=', $id)
                ->where(function ($q) use ($bunnyGuid) {
                    $q->where('bunny_video_id', $bunnyGuid)->orWhere('bunny_stream_id', $bunnyGuid);
                })->exists()) {
                return response()->json([
                    'message' => 'هذا الفيديو مرتبط بالفعل بهذا الدرس.',
                    'errors' => ['bunny_video_id' => ['This Bunny video ID is already linked to this lesson.']]
                ], 422);
            }

            $check = $bunnyService->validateVideoExists($bunnyGuid);
            if (!$check['success']) {
                $status = ($check['status'] >= 400 && $check['status'] < 600) ? $check['status'] : 422;
                return response()->json([
                    'message' => $check['error'],
                    'bunny_error' => $check['bunny_message'],
                    'status_code' => $check['status'],
                ], $status);
            }

            $meta = $check['data'] ?? [];
            $duration = intval($meta['length'] ?? 0);
            $sizeBytes = intval($meta['storageSize'] ?? 0);
            $thumbnailUrl = !empty($meta['thumbnailUrl']) ? $meta['thumbnailUrl'] : $bunnyService->getThumbnailUrl($bunnyGuid);
            $embedUrl = $bunnyService->getEmbedUrl($bunnyGuid);
            $statusCode = intval($meta['status'] ?? 0);
            $bunnyStatus = $bunnyService->mapStatusCodeToString($statusCode);

            $video->update([
                'title' => $title,
                'bunny_video_id' => $bunnyGuid,
                'bunny_stream_id' => $bunnyGuid,
                'bunny_embed_url' => $embedUrl,
                'bunny_thumbnail_url' => $thumbnailUrl,
                'bunny_duration' => $duration > 0 ? $duration : $durationSeconds,
                'bunny_size_bytes' => $sizeBytes,
                'bunny_status' => $bunnyStatus ?: 'finished',
                'duration_seconds' => $duration > 0 ? $duration : ($durationSeconds ?: 300),
                'thumbnail_path' => $thumbnailUrl,
                'resolution' => $resolution,
            ]);

            if ($teacherId) {
                $bunnyService->recalculateStorage($teacherId);
            }
        } elseif ($hasManualUrl) {
            $url = trim($manualUrl);
            if (!filter_var($url, FILTER_VALIDATE_URL)) {
                return response()->json([
                    'message' => 'رابط الفيديو المدخل غير صالح.',
                    'errors' => ['video_url' => ['Invalid video URL provided.']]
                ], 422);
            }

            if (Video::where('lesson_id', $video->lesson_id)->where('id', '!=', $id)->where('bunny_embed_url', $url)->exists()) {
                return response()->json([
                    'message' => 'هذا الرابط مرتبط بالفعل بهذا الدرس.',
                    'errors' => ['video_url' => ['This video URL is already linked to this lesson.']]
                ], 422);
            }

            $video->update([
                'title' => $title,
                'bunny_video_id' => null,
                'bunny_stream_id' => null,
                'bunny_embed_url' => $url,
                'duration_seconds' => $durationSeconds ?: 300,
                'thumbnail_path' => $thumbnailPath,
                'bunny_status' => 'finished',
            ]);
        } else {
            // Updating metadata only (title, duration, thumbnail)
            $video->update([
                'title' => $title,
                'duration_seconds' => $durationSeconds ?: $video->duration_seconds,
                'thumbnail_path' => $thumbnailPath ?: $video->thumbnail_path,
                'resolution' => $resolution ?: $video->resolution,
            ]);
        }

        $this->updateLessonDuration($video->lesson_id);
        Course::touchContent($lesson->unit->course_id);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logVideoUpdated($request->user(), $video, $request);
        }

        return response()->json($video);
    }

    /**
     * Delete Video.
     */
    public function deleteVideo(Request $request, $id)
    {
        $video = Video::findOrFail($id);
        $lesson = Lesson::with('unit')->findOrFail($video->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $teacherId = $request->user()->id;
        $lessonId = $video->lesson_id;
        $courseId = $lesson->unit->course_id;
        $videoTitle = $video->title;

        // Instantiate BunnyStreamService to delete from Bunny Stream
        $bunnyService = new \App\Services\BunnyStreamService();
        $bunnyVideoId = $video->bunny_video_id ?: $video->bunny_stream_id;
        if (!empty($bunnyVideoId)) {
            $bunnyService->deleteVideo($bunnyVideoId);
        }

        $video->delete();

        // Recalculate storage and lesson duration
        $bunnyService->recalculateStorage($teacherId);
        $this->updateLessonDuration($lessonId);
        Course::touchContent($courseId);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logVideoDeleted($request->user(), (int)$id, $videoTitle, $request);
        }

        return response()->json(['message' => 'تم حذف الفيديو بنجاح من المنصة ومن خوادم Bunny Stream وتم تحديث المساحة التخزينية.']);
    }



    /**
     * Replace an existing video file on Bunny Stream.
     */
    public function replaceVideo(Request $request, $id)
    {
        $request->validate([
            'file_size' => 'sometimes|integer|min:0',
        ]);

        $video = Video::findOrFail($id);
        $lesson = Lesson::with('unit')->findOrFail($video->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $libraryId = config('services.bunny.library_id');
        $apiKey = config('services.bunny.api_key');
        $bunnyService = app(\App\Services\BunnyStreamService::class);

        if (!$bunnyService->isConfigured() || empty($libraryId) || empty($apiKey)) {
            return response()->json([
                'message' => 'Bunny Stream integration is not configured on the server.'
            ], 400);
        }

        $teacherId = $request->user()->id;

        // Validate storage limit: subtract the current video size because we are replacing it
        $fileSize = (int) $request->input('file_size', 0);
        $hasFile = $request->hasFile('video_file') || $request->hasFile('video') || $request->hasFile('file');
        if ($hasFile) {
            $uploadedFile = $request->file('video_file') ?: ($request->file('video') ?: $request->file('file'));
            $fileSize = $uploadedFile->getSize();
        }

        $currentVideoSize = (int) ($video->bunny_size_bytes ?? $video->storage_size ?? 0);
        $netSizeChange = max(0, $fileSize - $currentVideoSize);

        if ($bunnyService->isStorageLimitExceeded($teacherId, $netSizeChange)) {
            return response()->json([
                'message' => 'لقد تجاوزت الحد المسموح به لمساحة التخزين في باقتك. يرجى ترقية الباقة لتتمكن من إضافة فيديوهات جديدة.'
            ], 403);
        }

        $title = $request->input('title') ? trim($request->input('title')) : $video->title;

        // 1. Create a new video placeholder on Bunny Stream
        $createRes = $bunnyService->createVideo($title);
        if (!$createRes['success']) {
            $status = $this->safeBunnyHttpStatus($createRes['status']);
            return response()->json([
                'message' => $createRes['error'],
                'bunny_error' => $createRes['bunny_message'],
                'status_code' => $createRes['status'],
            ], $status);
        }

        $newVideoId = $createRes['video_id'];

        // If a file was directly submitted, upload it immediately
        if ($hasFile) {
            $uploadRes = $bunnyService->uploadVideo(
                $newVideoId,
                $uploadedFile->getRealPath(),
                $uploadedFile->getMimeType() ?: 'application/octet-stream'
            );

            if (!$uploadRes['success']) {
                $bunnyService->deleteVideo($newVideoId);
                $status = $this->safeBunnyHttpStatus($uploadRes['status']);
                return response()->json([
                    'message' => $uploadRes['error'],
                    'bunny_error' => $uploadRes['bunny_message'],
                    'status_code' => $uploadRes['status'],
                ], $status);
            }
        }

        // 2. Delete old video from Bunny Stream only now that new video object is safely ready
        $oldBunnyId = $video->bunny_video_id ?: $video->bunny_stream_id;
        if (!empty($oldBunnyId)) {
            $bunnyService->deleteVideo($oldBunnyId);
        }

        $embedUrl = $bunnyService->getEmbedUrl($newVideoId);
        $thumbnailUrl = $bunnyService->getThumbnailUrl($newVideoId);

        // 3. Update local video record
        $video->update([
            'title' => $title,
            'bunny_video_id' => $newVideoId,
            'bunny_stream_id' => $newVideoId,
            'bunny_embed_url' => $embedUrl,
            'bunny_thumbnail_url' => $thumbnailUrl,
            'bunny_duration' => 0,
            'bunny_size_bytes' => $fileSize,
            'bunny_status' => 'queued',
            'duration_seconds' => 0,
            'thumbnail_path' => $thumbnailUrl,
        ]);

        Course::touchContent($lesson->unit->course_id);

        // Recalculate teacher storage
        $bunnyService->recalculateStorage($teacherId);

        // Dispatch background status polling job
        \App\Jobs\PollBunnyVideoStatus::dispatch($video->id);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logVideoReplaced($request->user(), $video, $request);
        }

        $expirationTime = time() + 7200;
        $signature = hash('sha256', $libraryId . $apiKey . $expirationTime . $newVideoId);

        return response()->json([
            'video_id' => $newVideoId,
            'library_id' => $libraryId,
            'signature' => $signature,
            'expiration_time' => $expirationTime,
            'embed_url' => $embedUrl,
            'video' => $video,
        ]);
    }

    /**
     * Get Teacher Storage usage stats.
     */
    public function getStorageStats(Request $request)
    {
        $teacher = $request->user();

        $bunnyService = new \App\Services\BunnyStreamService();
        $bunnyService->recalculateStorage($teacher->id);
        $teacher->refresh();

        $usedGb = (float)$teacher->bunny_storage_used_gb;
        $limitGb = (float)$teacher->bunny_storage_limit_gb;
        $remainingGb = max(0.00, $limitGb - $usedGb);
        $percentage = $limitGb > 0 ? min(100.00, round(($usedGb / $limitGb) * 100, 2)) : 0.00;

        if ($teacher && $teacher->role === 'teacher') {
            \App\Services\TeacherActivityService::logStorageStatsViewed($teacher, $request);
        }

        return response()->json([
            'bunny_storage_used_gb' => $usedGb,
            'bunny_storage_limit_gb' => $limitGb,
            'bunny_storage_remaining_gb' => $remainingGb,
            'used_percentage' => $percentage,
        ]);
    }

    /**
     * Get list of videos for teacher.
     */
    public function listVideos(Request $request)
    {
        $teacherId = $request->user()->id;
        $bunnyService = app(\App\Services\BunnyStreamService::class);

        $videosRaw = Video::whereHas('lesson.unit.course', function ($q) use ($teacherId) {
            $q->where('teacher_id', $teacherId);
        })
        ->with('lesson.unit.course')
        ->latest()
        ->get();

        if ($bunnyService->isConfigured()) {
            foreach ($videosRaw as $v) {
                $guid = $v->bunny_video_id ?: $v->bunny_stream_id;
                if ($guid && (in_array($v->bunny_status, ['queued', 'processing', 'uploaded']) || $v->bunny_duration <= 0)) {
                    $details = $bunnyService->getVideoDetails($guid);
                    if ($details) {
                        $code = intval($details['status'] ?? 0);
                        $statusStr = $bunnyService->mapStatusCodeToString($code);
                        $len = intval($details['length'] ?? 0);
                        $sz = intval($details['storageSize'] ?? 0);

                        $v->bunny_status = $statusStr;
                        if ($len > 0) {
                            $v->bunny_duration = $len;
                            $v->duration_seconds = $len;
                        }
                        if ($sz > 0) {
                            $v->bunny_size_bytes = $sz;
                        }
                        $v->bunny_embed_url = $bunnyService->getEmbedUrl($guid);
                        $v->bunny_thumbnail_url = $bunnyService->getThumbnailUrl($guid);
                        $v->save();
                    }
                }
            }
        }

        $videos = $videosRaw->map(function ($video) {
            return [
                'id' => $video->id,
                'title' => $video->title,
                'lesson_id' => $video->lesson_id,
                'bunny_video_id' => $video->bunny_video_id ?: $video->bunny_stream_id,
                'bunny_embed_url' => $video->bunny_embed_url,
                'bunny_thumbnail_url' => $video->bunny_thumbnail_url ?: $video->thumbnail_path,
                'bunny_duration' => $video->bunny_duration ?: $video->duration_seconds,
                'bunny_size_bytes' => $video->bunny_size_bytes,
                'bunny_status' => $video->bunny_status ?: 'finished',
                'lesson_title' => $video->lesson->title ?? 'N/A',
                'course_title' => $video->lesson->unit->course->title ?? 'N/A',
                'created_at' => $video->created_at,
            ];
        });

        return response()->json($videos);
    }

    /**
     * Update PDF.
     */
    public function updatePdf(Request $request, $id)
    {
        $pdf = Pdf::findOrFail($id);
        $lesson = Lesson::with('unit')->findOrFail($pdf->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
            'file_path' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $lowVal = strtolower($value);
                    if (!str_ends_with($lowVal, '.pdf') && !str_contains($lowVal, 'drive.google.com') && !str_contains($lowVal, 'docs.google.com')) {
                        $fail('الملف المرفوع يجب أن يكون بصيغة PDF أو رابط Google Drive صالح.');
                    }
                }
            ],
            'page_count' => 'nullable|integer',
            'file_size' => 'nullable|string',
            'preview_path' => 'nullable|string',
        ]);

        $pdf->update([
            'title' => $request->title,
            'file_path' => $request->file_path,
            'page_count' => $request->page_count,
            'file_size' => $request->file_size,
            'preview_path' => $request->preview_path,
        ]);

        Course::touchContent($lesson->unit->course_id);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logPdfUpdated($request->user(), $pdf, $request);
        }

        return response()->json($pdf);
    }

    /**
     * Delete PDF.
     */
    public function deletePdf(Request $request, $id)
    {
        $pdf = Pdf::findOrFail($id);
        $lesson = Lesson::with('unit')->findOrFail($pdf->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);
        $courseId = $lesson->unit->course_id;
        $pdfTitle = $pdf->title;

        $pdf->delete();

        Course::touchContent($courseId);

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logPdfDeleted($request->user(), (int)$id, $pdfTitle, $request);
        }

        return response()->json(['message' => 'تم حذف ملف الـ PDF بنجاح.']);
    }

    /**
     * Create monthly packages.
     */
    /**
     * List teacher packages/bundles.
     */
    public function listPackages(Request $request)
    {
        $packages = Package::where('teacher_id', $request->user()->id)
            ->with(['lessons.unit.course'])
            ->withCount('enrollments')
            ->latest()
            ->get();

        return response()->json($packages);
    }

    /**
     * Create monthly packages.
     */
    public function createPackage(Request $request, $courseId)
    {
        $this->verifyCourseTeacher($request, $courseId);

        $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'package_thumbnail' => 'nullable|string',
            'lesson_ids' => 'required|array',
            'lesson_ids.*' => 'exists:lessons,id',
            'type' => 'required|string|in:bundle,month,revision',
        ]);

        return DB::transaction(function () use ($request, $courseId) {
            $package = Package::create([
                'course_id' => $courseId,
                'teacher_id' => $request->user()->id,
                'title' => $request->title,
                'price' => $request->price,
                'description' => $request->description,
                'cover_image' => $request->cover_image,
                'package_thumbnail' => $request->package_thumbnail,
                'type' => $request->type,
            ]);

            $package->lessons()->sync($request->lesson_ids);

            return response()->json($package->load('lessons'), 201);
        });
    }

    /**
     * Create standalone or multi-course bundles.
     */
    public function createPackageNew(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'package_thumbnail' => 'nullable|string',
            'lesson_ids' => 'required|array',
            'lesson_ids.*' => 'exists:lessons,id',
            'type' => 'required|string|in:bundle,month,revision',
            'course_id' => 'nullable|exists:courses,id',
            'is_active' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($request) {
            $package = Package::create([
                'course_id' => $request->course_id,
                'teacher_id' => $request->user()->id,
                'title' => $request->title,
                'price' => $request->price,
                'description' => $request->description,
                'cover_image' => $request->cover_image,
                'package_thumbnail' => $request->package_thumbnail,
                'type' => $request->type,
                'is_active' => $request->input('is_active', true),
            ]);

            $package->lessons()->sync($request->lesson_ids);

            return response()->json($package->load('lessons'), 201);
        });
    }

    /**
     * Update monthly packages.
     */
    public function updatePackage(Request $request, $packageId)
    {
        $package = Package::findOrFail($packageId);
        if ($package->teacher_id !== $request->user()->id) {
            abort(403, 'غير مصرح لك بتعديل بيانات هذه الباقة.');
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'package_thumbnail' => 'nullable|string',
            'lesson_ids' => 'required|array',
            'lesson_ids.*' => 'exists:lessons,id',
            'type' => 'required|string|in:bundle,month,revision',
            'is_active' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($request, $package) {
            $package->update([
                'title' => $request->title,
                'price' => $request->price,
                'description' => $request->description,
                'cover_image' => $request->cover_image,
                'package_thumbnail' => $request->package_thumbnail,
                'type' => $request->type,
                'is_active' => $request->has('is_active') ? $request->is_active : $package->is_active,
            ]);

            $package->lessons()->sync($request->lesson_ids);

            return response()->json($package->load('lessons'), 200);
        });
    }

    /**
     * Delete monthly packages.
     */
    public function deletePackage(Request $request, $packageId)
    {
        \Log::info('DELETE PACKAGE REQUEST', [
            'package_id' => $packageId
        ]);

        try {
            $package = Package::find($packageId);

            \Log::info('PACKAGE FOUND', [
                'package' => $package
            ]);

            if (!$package) {
                return response()->json([
                    'success' => false,
                    'message' => 'Package not found'
                ], 404);
            }

            if ($package->teacher_id !== $request->user()->id) {
                abort(403, 'غير مصرح لك بحذف هذه الباقة.');
            }

            \Log::info('STARTING DELETE');

            \DB::beginTransaction();
            
            // Delete dependent records
            \DB::table('package_lessons')->where('package_id', $packageId)->delete();
            \DB::table('purchase_codes')->where('package_id', $packageId)->update(['package_id' => null]);
            \DB::table('enrollments')->where('package_id', $packageId)->update(['package_id' => null]);
            \DB::table('refund_logs')->where('package_id', $packageId)->update(['package_id' => null]);
            
            $package->delete();
            
            \DB::commit();

            \Log::info('DELETE SUCCESS');

            return response()->json(['message' => 'تم حذف الباقة بنجاح'], 200);
        } catch (\Throwable $e) {
            if (\DB::transactionLevel() > 0) {
                \DB::rollBack();
            }
            \Log::error('DELETE FAILED', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Add Exam (Quiz, Homework) with Questions inside a course lesson.
     */
    public function addExam(Request $request, $lessonId)
    {
        $lesson = Lesson::with('unit')->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        if ($request->type === 'monthly_exam' || $request->type === 'monthly_standalone') {
            return response()->json(['message' => 'الامتحانات الشهرية مستقلة ولا يمكن ربطها بدرس داخل كورس. يرجى إنشاؤها من قسم الامتحانات الشهرية.'], 422);
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|string|in:quiz,homework',
            'homework_type' => 'nullable|string|in:normal,bubble_sheet',
            'time_limit_minutes' => 'nullable|integer|min:0',
            'max_score' => 'required|integer|min:1',
            'start_date' => 'nullable|date',
            'start_time' => 'nullable|string',
            'end_date' => 'nullable|date',
            'end_time' => 'nullable|string',
            'max_attempts' => 'nullable|integer|min:1',
            'passing_score' => 'nullable|integer|min:0',
            'enable_schedule' => 'nullable|boolean',
            'open_date' => 'nullable|date',
            'open_time' => 'nullable|string',
            'close_date' => 'nullable|date',
            'close_time' => 'nullable|string',
            'submission_deadline' => 'nullable|string', // flexible string datetime
            'is_paid' => 'nullable|boolean',
            'price' => 'nullable|numeric|min:0',
            'show_score' => 'nullable|boolean',
            'show_student_answers' => 'nullable|boolean',
            'show_correct_answers' => 'nullable|boolean',
            'show_explanations' => 'nullable|boolean',
            'questions' => 'required|array|min:1',
            'questions.*.text' => 'nullable|string',
            'questions.*.image_url' => 'nullable|string',
            'questions.*.type' => 'required|string|in:mcq,true_false,essay',
            'questions.*.options' => 'nullable|array', // Required if type is mcq
            'questions.*.correct_answer' => 'nullable|string', // Correct option value
            'questions.*.score' => 'required|integer|min:1',
        ]);

        return DB::transaction(function () use ($request, $lessonId, $lesson) {
            $exam = Exam::create([
                'lesson_id' => $lessonId,
                'course_id' => $lesson->unit ? $lesson->unit->course_id : null,
                'teacher_id' => $request->user()->id,
                'title' => $request->title,
                'type' => $request->type,
                'homework_type' => $request->homework_type ?? 'normal',
                'time_limit_minutes' => ($request->filled('time_limit_minutes') && (int)$request->time_limit_minutes > 0) ? (int)$request->time_limit_minutes : null,
                'max_score' => $request->max_score,
                'start_date' => $request->start_date,
                'start_time' => $request->start_time,
                'end_date' => $request->end_date,
                'end_time' => $request->end_time,
                'max_attempts' => $request->max_attempts ?? 1,
                'passing_score' => $request->passing_score ?? 50,
                'enable_schedule' => $request->enable_schedule ?? false,
                'open_date' => $request->open_date,
                'open_time' => $request->open_time,
                'close_date' => $request->close_date,
                'close_time' => $request->close_time,
                'submission_deadline' => $request->submission_deadline,
                'is_paid' => $request->is_paid ?? false,
                'price' => $request->price ?? 0.00,
                'show_score' => $request->has('show_score') ? (bool)$request->show_score : true,
                'show_student_answers' => $request->has('show_student_answers') ? (bool)$request->show_student_answers : true,
                'show_correct_answers' => $request->has('show_correct_answers') ? (bool)$request->show_correct_answers : true,
                'show_explanations' => $request->has('show_explanations') ? (bool)$request->show_explanations : true,
            ]);

            foreach ($request->questions as $qData) {
                Question::create([
                    'exam_id' => $exam->id,
                    'text' => $qData['text'] ?? '',
                    'image_url' => $qData['image_url'] ?? null,
                    'type' => $qData['type'],
                    'options' => $qData['options'] ?? null,
                    'correct_answer' => $qData['correct_answer'] ?? null,
                    'score' => $qData['score'],
                ]);
            }

            // Send Student Notification
            try {
                $course = Course::find($lesson->unit->course_id);
                $notifService = new \App\Services\NotificationService();
                if ($exam->type === 'homework') {
                    $notifService->sendNotification(
                        'واجب منزلي جديد',
                        "تمت إضافة واجب منزلي جديد: {$exam->title} في محاضرة {$lesson->title} لـ " . ($course ? $course->title : ''),
                        'students'
                    );
                } else {
                    $notifService->sendNotification(
                        'اختبار جديد',
                        "تمت إضافة اختبار جديد: {$exam->title} في محاضرة {$lesson->title} لـ " . ($course ? $course->title : ''),
                        'students'
                    );
                }
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Notification error: ' . $e->getMessage());
            }

            if ($request->user() && $request->user()->role === 'teacher') {
                \App\Services\TeacherActivityService::logExamCreated($request->user(), $exam, $request);
            }

            Course::touchContent($lesson->unit ? $lesson->unit->course_id : null);

            return response()->json($exam->load('questions'), 201);
        });
    }

    /**
     * List all exams in teacher's courses.
     */
    public function listExams(Request $request)
    {
        $teacher = $request->user();
        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');

        $exams = Exam::whereHas('lesson.unit', function ($query) use ($courseIds) {
            $query->whereIn('course_id', $courseIds);
        })->with(['lesson.unit.course'])->latest()->get();

        return response()->json($exams);
    }

    /**
     * List student exam attempts (e.g. for homework grading).
     */
    public function examAttempts(Request $request, $examId)
    {
        $exam = Exam::with('lesson.unit')->findOrFail($examId);
        if ($exam->lesson_id && $exam->lesson && $exam->lesson->unit) {
            $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);
        } else {
            $user = $request->user();
            if ($exam->teacher_id !== $user->id && !$user->isAdmin()) {
                abort(403, 'غير مصرح لك بعرض هذا الامتحان.');
            }
        }

        $attempts = StudentExam::where('exam_id', $examId)
            ->with(['student', 'answers.question', 'unlockedBy:id,name'])
            ->latest()
            ->get();

        $visibilityService = app(\App\Services\ExamResultVisibilityService::class);
        $overrides = $visibilityService->getOverridesForExam($exam);

        $attempts->transform(function ($att) use ($exam, $overrides, $visibilityService) {
            $att->effective_visibility = $visibilityService->resolveEffectiveVisibility($exam, (int)$att->student_id);
            $att->override_visibility = $overrides->get($att->student_id);
            return $att;
        });

        return response()->json($attempts);
    }

    /**
     * Get a comprehensive report for scheduled Exam / Homework.
     */
    public function examReport(Request $request, $examId)
    {
        $exam = Exam::with('lesson.unit.course')->findOrFail($examId);
        $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);

        $courseId = $exam->lesson->unit->course_id;

        // Get all students enrolled in the course
        $enrollments = \App\Models\Enrollment::where('course_id', $courseId)
            ->with('student')
            ->get();

        // Get all attempts for this exam
        $attempts = StudentExam::where('exam_id', $examId)
            ->get()
            ->keyBy('student_id');

        $now = \Carbon\Carbon::now();
        $isDeadlinePassed = false;
        if ($exam->enable_schedule && $exam->close_date) {
            $closeDateStr = $exam->close_date->format('Y-m-d');
            $closeTimeStr = $exam->close_time ?: '23:59:59';
            $closeDatetime = \Carbon\Carbon::parse($closeDateStr . ' ' . $closeTimeStr);
            $isDeadlinePassed = $now->gt($closeDatetime);
        }

        // Automatic scheduling notifications triggers inside report access
        if ($isDeadlinePassed) {
            foreach ($enrollments as $enrollment) {
                $student = $enrollment->student;
                if (!$student) continue;

                $attempt = $attempts->get($student->id);
                $hasMissed = false;
                $missedType = '';

                if ($attempt && $attempt->status === 'started') {
                    $hasMissed = true;
                    $missedType = 'missed_deadline';
                } elseif (!$attempt) {
                    $hasMissed = true;
                    $missedType = 'unopened';
                }

                if ($hasMissed) {
                    $notifExists = \App\Models\Notification::where('recipient_id', $exam->lesson->unit->course->teacher_id)
                        ->where('sender_id', $student->id)
                        ->where('title', 'like', '%' . ($missedType === 'unopened' ? 'لم يفتح' : 'تجاوز الموعد') . '%')
                        ->where('message', 'like', '%' . $exam->title . '%')
                        ->exists();

                    if (!$notifExists) {
                        if ($missedType === 'unopened') {
                            \App\Models\Notification::create([
                                'title' => "تنبيه: طالب لم يفتح التقييم في الموعد",
                                'message' => "الطالب " . $student->name . " لم يقم بفتح " . ($exam->type === 'homework' ? 'الواجب' : 'الامتحان') . " (" . $exam->title . ") قبل انتهاء الموعد المحدد.",
                                'recipient_type' => 'specific_teacher',
                                'recipient_id' => $exam->lesson->unit->course->teacher_id,
                                'sender_id' => $student->id,
                                'important' => false,
                            ]);
                        } else {
                            \App\Models\Notification::create([
                                'title' => "تنبيه: طالب تجاوز الموعد النهائي",
                                'message' => "الطالب " . $student->name . " بدأ في حل " . ($exam->type === 'homework' ? 'الواجب' : 'الامتحان') . " (" . $exam->title . ") ولكنه لم يقم بالتسليم قبل الموعد النهائي.",
                                'recipient_type' => 'specific_teacher',
                                'recipient_id' => $exam->lesson->unit->course->teacher_id,
                                'sender_id' => $student->id,
                                'important' => false,
                            ]);
                        }
                    }
                }
            }
        }

        // Format student report records
        $reportData = $enrollments->map(function ($enrollment) use ($attempts, $isDeadlinePassed, $exam) {
            $student = $enrollment->student;
            if (!$student) return null;

            $attempt = $attempts->get($student->id);
            $status = 'did_not_start'; // default: لم يبدأ بعد
            $score = null;
            $percentage = null;
            $submittedAt = null;

            if ($attempt) {
                $submittedAt = $attempt->submitted_at;
                if ($attempt->status === 'graded') {
                    $status = 'submitted';
                    $score = $attempt->score;
                    $percentage = $exam->max_score > 0 ? round(($attempt->score / $exam->max_score) * 100, 1) : 0;
                } elseif ($attempt->status === 'submitted') {
                    $status = 'submitted';
                    $score = $attempt->score;
                    $percentage = ($attempt->score !== null && $exam->max_score > 0) ? round(($attempt->score / $exam->max_score) * 100, 1) : null;
                } elseif ($attempt->status === 'started') {
                    if ($isDeadlinePassed) {
                        $status = 'missed_deadline'; // بدأ ولم يكمل (تجاوز الموعد)
                    } else {
                        $status = 'started'; // بدأ ويحل حالياً
                    }
                }
            } else {
                if ($isDeadlinePassed) {
                    $status = 'missed_unopened'; // لم يفتح (تجاوز الموعد)
                }
            }

            return [
                'student_id' => $student->id,
                'student_name' => $student->name,
                'student_email' => $student->email,
                'student_phone' => $student->phone,
                'parent_phone' => $student->parent_phone,
                'status' => $status,
                'score' => $score,
                'percentage' => $percentage,
                'submitted_at' => $submittedAt ? $submittedAt->toIso8601String() : null,
            ];
        })->filter()->values();

        return response()->json([
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'type' => $exam->type,
                'max_score' => $exam->max_score,
                'enable_schedule' => $exam->enable_schedule,
                'open_date' => $exam->open_date ? $exam->open_date->format('Y-m-d') : null,
                'open_time' => $exam->open_time,
                'close_date' => $exam->close_date ? $exam->close_date->format('Y-m-d') : null,
                'close_time' => $exam->close_time,
            ],
            'report' => $reportData,
        ]);
    }

    /**
     * Manual grading and feedback for Essay / Homework attempts.
     */
    public function gradeAttempt(Request $request, $attemptId)
    {
        $attempt = StudentExam::with('exam.lesson.unit')->findOrFail($attemptId);
        $this->verifyCourseTeacher($request, $attempt->exam->lesson->unit->course_id);

        $request->validate([
            'score' => 'required|integer|min:0|max:' . $attempt->exam->max_score,
            'teacher_feedback' => 'nullable|string',
            'answers' => 'nullable|array', // Grade individual essay questions [question_id => score]
        ]);

        return DB::transaction(function () use ($attempt, $request) {
            if ($request->has('answers') && $request->answers) {
                foreach ($request->answers as $questionId => $score) {
                    $answer = StudentAnswer::where('student_exam_id', $attempt->id)
                        ->where('question_id', $questionId)
                        ->first();
                    
                    if ($answer) {
                        $answer->score = $score;
                        // mark correct if score is greater than 0 or equal to full question score
                        $answer->is_correct = $score > 0;
                        $answer->save();
                    }
                }
            }

            $attempt->score = $request->score;
            $attempt->teacher_feedback = $request->teacher_feedback;
            $attempt->status = 'graded';
            $attempt->graded_at = Carbon::now();
            $attempt->save();

            if ($request->user() && $request->user()->role === 'teacher') {
                \App\Services\TeacherActivityService::logStudentAttemptGraded($request->user(), $attempt, $request);
            }

            return response()->json([
                'message' => 'تم رصد الدرجة والملاحظات بنجاح.',
                'attempt' => $attempt,
            ]);
        });
    }

    /**
     * List unique students enrolled in teacher's courses.
     */
    public function students(Request $request)
    {
        $teacher = $request->user();
        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');

        $students = User::where('role', 'student')
            ->whereHas('enrollments', function ($query) use ($courseIds) {
                $query->whereIn('course_id', $courseIds);
            })
            ->with(['enrollments' => function ($query) use ($courseIds) {
                $query->whereIn('course_id', $courseIds)->with('course');
            }])
            ->get();

        if ($teacher && $teacher->role === 'teacher') {
            \App\Services\TeacherActivityService::logStudentsListViewed($teacher, $request);
        }

        return response()->json($students);
    }

    /**
     * Get detailed analytics for a single student under this teacher.
     */
    public function studentAnalytics(Request $request, $studentId)
    {
        $teacher = $request->user();
        $student = User::where('id', $studentId)->where('role', 'student')->firstOrFail();
        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');

        // Verify enrollment is relevant
        $isRelevant = Enrollment::where('student_id', $studentId)
            ->whereIn('course_id', $courseIds)
            ->exists();

        if (!$isRelevant) {
            abort(403, 'غير مصرح لك بعرض بيانات هذا الطالب.');
        }

        if ($teacher && $teacher->role === 'teacher') {
            \App\Services\TeacherActivityService::logStudentAnalyticsViewed($teacher, $student, $request);
        }

        // Student Course Progress: Completed Videos count vs Total Videos count
        $totalVideos = Video::whereHas('lesson.unit', function ($query) use ($courseIds) {
            $query->whereIn('course_id', $courseIds);
        })->count();

        $completedVideos = VideoProgress::where('student_id', $studentId)
            ->where('completed', true)
            ->whereIn('video_id', function ($query) use ($courseIds) {
                $query->select('id')->from('videos')->whereIn('lesson_id', function ($sub) use ($courseIds) {
                    $sub->select('id')->from('lessons')->whereIn('unit_id', function ($sub2) use ($courseIds) {
                        $sub2->select('id')->from('units')->whereIn('course_id', $courseIds);
                    });
                });
            })
            ->count();

        $watchTimeSeconds = VideoProgress::where('student_id', $studentId)
            ->whereIn('video_id', function ($query) use ($courseIds) {
                $query->select('id')->from('videos')->whereIn('lesson_id', function ($sub) use ($courseIds) {
                    $sub->select('id')->from('lessons')->whereIn('unit_id', function ($sub2) use ($courseIds) {
                        $sub2->select('id')->from('units')->whereIn('course_id', $courseIds);
                    });
                });
            })
            ->sum('watched_seconds');

        // Exam and homework scores
        $attempts = StudentExam::with('exam')
            ->where('student_id', $studentId)
            ->whereHas('exam.lesson.unit', function ($query) use ($courseIds) {
                $query->whereIn('course_id', $courseIds);
            })
            ->get();

        // Get last activity (last video progress updated_at or exam attempt updated_at)
        $lastProgress = VideoProgress::where('student_id', $studentId)->latest('updated_at')->first();
        $lastExam = StudentExam::where('student_id', $studentId)->latest('updated_at')->first();
        
        $lastActivityDate = null;
        if ($lastProgress && $lastExam) {
            $lastActivityDate = $lastProgress->updated_at->gt($lastExam->updated_at) ? $lastProgress->updated_at : $lastExam->updated_at;
        } elseif ($lastProgress) {
            $lastActivityDate = $lastProgress->updated_at;
        } elseif ($lastExam) {
            $lastActivityDate = $lastExam->updated_at;
        }

        return response()->json([
            'student' => $student,
            'progress' => [
                'total_videos' => $totalVideos,
                'completed_videos' => $completedVideos,
                'completion_rate' => $totalVideos > 0 ? round(($completedVideos / $totalVideos) * 100, 2) : 0,
                'watch_time_minutes' => round($watchTimeSeconds / 60, 2),
            ],
            'exam_attempts' => $attempts,
            'last_activity' => $lastActivityDate ? $lastActivityDate->diffForHumans() : 'لا يوجد نشاط مؤخراً',
        ]);
    }

    /**
     * Import questions from docx file with embedded images and structured options.
     */
    public function importQuestionsFromWord(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['teacher', 'admin'])) {
            return response()->json(['message' => 'غير مصرح لك باستيراد الأسئلة من ملف Word.'], 403);
        }

        if ($user->role === 'admin' && !$user->is_super_admin && !$user->is_super && !$user->hasPermission('exams.manage')) {
            return response()->json(['message' => 'غير مصرح لك باستيراد الأسئلة. تتطلب صلاحية إدارة الامتحانات.'], 403);
        }

        if (!$request->hasFile('file')) {
            if (empty($_FILES) && empty($_POST) && (int)$request->header('Content-Length') > 0) {
                return response()->json([
                    'message' => 'حجم الملف يتجاوز الحد الأقصى المسموح به في إعدادات الخادم (upload_max_filesize / post_max_size). يرجى تقليل حجم الملف أو زيادة الإعدادات على الاستضافة.'
                ], 422);
            }
            return response()->json(['message' => 'يرجى اختيار ملف Word بصيغة (.docx) قبل الضغط على استيراد.'], 422);
        }

        $file = $request->file('file');
        if (!$file->isValid()) {
            $errorMsg = match ($file->getError()) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'حجم الملف يتجاوز الحد الأقصى المسموح به للرفع في إعدادات الخادم (upload_max_filesize).',
                UPLOAD_ERR_PARTIAL => 'تم رفع جزء من الملف فقط بسبب انقطاع الاتصال. يرجى إعادة المحاولة.',
                UPLOAD_ERR_NO_FILE => 'لم يتم اختيار أي ملف للرفع.',
                default => 'حدث خطأ أثناء رفع الملف إلى الخادم.'
            };
            return response()->json(['message' => $errorMsg], 422);
        }

        $request->validate([
            'file' => 'required|file|max:20480', // up to 20MB for documents with embedded images
        ]);

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());

        if ($extension === 'doc') {
            return response()->json([
                'message' => 'صيغة ملف .doc القديمة غير مدعومة. يرجى فتح الملف في Microsoft Word وحفظه بصيغة الحديثة (.docx) ثم إعادة المحاولة.'
            ], 422);
        }

        if ($extension !== 'docx') {
            return response()->json([
                'message' => 'يرجى اختيار ملف Word صالح بصيغة (.docx).'
            ], 422);
        }

        try {
            $service = new \App\Services\WordImportService();
            $questions = $service->import($file, (int)($request->user()?->id));

            if (empty($questions)) {
                return response()->json([
                    'message' => 'لم نتمكن من استخراج أي أسئلة متطابقة من الملف. يرجى التأكد من كتابة الأسئلة بترقيم واضح مثل (1. أو س1:) والخيارات مثل (أ) أو A).'
                ], 422);
            }

            return response()->json($questions);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Word import error: ' . $e->getMessage());
            return response()->json([
                'message' => $e->getMessage() ?: 'حدث خطأ أثناء معالجة ملف Word.'
            ], 422);
        }
    }

    /**
     * Upload an image for an exam question or choice.
     */
    public function uploadExamImage(Request $request)
    {
        $teacher = $request->user();
        if (!$teacher || !in_array($teacher->role, ['teacher', 'admin'])) {
            return response()->json(['message' => 'غير مصرح لك برفع صور الامتحانات.'], 403);
        }

        if ($teacher->role === 'admin' && !$teacher->is_super_admin && !$teacher->is_super && !$teacher->hasPermission('exams.manage')) {
            return response()->json(['message' => 'غير مصرح لك برفع صور الامتحانات. تتطلب صلاحية إدارة الامتحانات.'], 403);
        }

        $request->validate([
            'image' => 'required|file|image|mimes:jpeg,png,jpg,webp|max:5120',
        ]);

        $file = $request->file('image');
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['jpeg', 'png', 'jpg', 'webp'])) {
            return response()->json(['message' => 'صيغة الصورة غير مدعومة. يرجى استخدام JPEG أو PNG أو WebP.'], 422);
        }

        // Store by teacher directory for isolation and safety
        $teacherDir = 'exams/teacher_' . $teacher->id;
        $path = $file->store($teacherDir, 'public');
        $url = asset('storage/' . $path);
        $url = str_replace('http://', 'https://', $url);

        return response()->json([
            'url' => $url,
            'path' => $path,
        ]);
    }

    /**
     * Delete an exam image from storage.
     */
    public function deleteExamImage(Request $request)
    {
        $teacher = $request->user();
        if (!$teacher || !in_array($teacher->role, ['teacher', 'admin'])) {
            return response()->json(['message' => 'غير مصرح لك بحذف صور الامتحانات.'], 403);
        }

        if ($teacher->role === 'admin' && !$teacher->is_super_admin && !$teacher->is_super && !$teacher->hasPermission('exams.manage')) {
            return response()->json(['message' => 'غير مصرح لك بحذف صور الامتحانات. تتطلب صلاحية إدارة الامتحانات.'], 403);
        }

        $request->validate([
            'path' => 'nullable|string',
            'url' => 'nullable|string',
        ]);

        $path = $request->input('path');
        if (empty($path) && $request->filled('url')) {
            $url = $request->input('url');
            if (preg_match('/storage\/(exams\/[a-zA-Z0-9_\-\.\/]+)/i', $url, $m)) {
                $path = $m[1];
            }
        }

        if (!$path) {
            return response()->json(['message' => 'لم يتم تحديد مسار صالح للصورة.'], 400);
        }

        // 1. Strict Path Traversal Prevention
        if (str_contains($path, '..') || str_contains($path, "\0") || preg_match('/[^a-zA-Z0-9_\-\.\/]/', $path)) {
            return response()->json(['message' => 'مسار الملف غير صالح أو يحتوي على أحرف غير مسموحة.'], 400);
        }

        if (!str_starts_with($path, 'exams/')) {
            return response()->json(['message' => 'مسار الملف يجب أن يكون ضمن مجلد صور الامتحانات.'], 400);
        }

        $isAdmin = in_array($teacher->role, ['admin', 'super_admin']) && ($teacher->is_super_admin || $teacher->is_super || $teacher->hasPermission('exams.manage'));

        // 2. Ownership check: If path has teacher subfolder
        if (preg_match('/^exams\/teacher_(\d+)\//', $path, $tMatches)) {
            $ownerTeacherId = (int)$tMatches[1];
            if ($ownerTeacherId !== (int)$teacher->id && !$isAdmin) {
                return response()->json(['message' => 'غير مصرح لك بحذف صورة تخص معلماً آخر.'], 403);
            }
        }

        // 3. Database check: Is this image currently in use by any question in the database?
        $baseName = basename($path);
        $referencingQuestions = Question::with(['exam.course', 'exam.lesson.unit.course'])
            ->where('image_url', 'like', "%{$baseName}%")
            ->orWhere('options', 'like', "%{$baseName}%")
            ->get();

        if ($referencingQuestions->isNotEmpty()) {
            // Check if any referencing question belongs to ANOTHER teacher
            foreach ($referencingQuestions as $q) {
                $exam = $q->exam;
                if ($exam) {
                    $examTeacherId = $exam->teacher_id ?: ($exam->course?->teacher_id ?: ($exam->lesson?->unit?->course?->teacher_id ?: null));
                    if ($examTeacherId && $examTeacherId != $teacher->id && !$isAdmin) {
                        return response()->json(['message' => 'لا يمكن حذف هذه الصورة لأنها مستخدمة في أسئلة تخص معلماً آخر.'], 403);
                    }
                }
            }

            // If it is in use in multiple questions, do not delete from disk to prevent breaking other questions
            if ($referencingQuestions->count() > 1) {
                return response()->json([
                    'message' => 'لا يمكن حذف الصورة من السيرفر لأنها مستخدمة في أسئلة متعددة.',
                    'in_use_count' => $referencingQuestions->count()
                ], 409);
            }
        }

        // Delete from public disk
        \Illuminate\Support\Facades\Storage::disk('public')->delete($path);

        return response()->json([
            'message' => 'تم حذف الصورة بنجاح.',
            'path' => $path
        ]);
    }

    /**
     * Get revenue reports for teacher dashboard.
     */
    public function revenueReport(Request $request)
    {
        $teacher = $request->user();
        $teacherId = $teacher->id;

        if ($teacher && $teacher->role === 'teacher') {
            \App\Services\TeacherActivityService::logRevenueReportViewed($teacher, $request);
        }

        $earningsQuery = \App\Models\TeacherEarning::with(['student:id,name,email,phone', 'course:id,title', 'package:id,title,type', 'lesson:id,title', 'exam:id,title'])
            ->where('teacher_id', $teacherId);

        $filter = $request->input('filter');
        $filteredQuery = clone $earningsQuery;

        if ($filter === 'today') {
            $filteredQuery->whereDate('created_at', Carbon::today());
        } elseif ($filter === 'week') {
            $filteredQuery->where('created_at', '>=', Carbon::now()->startOfWeek());
        } elseif ($filter === 'month') {
            $filteredQuery->where('created_at', '>=', Carbon::now()->startOfMonth());
        } elseif ($filter === 'custom') {
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');
            if ($startDate && $endDate) {
                $filteredQuery->whereBetween('created_at', [
                    Carbon::parse($startDate)->startOfDay(),
                    Carbon::parse($endDate)->endOfDay()
                ]);
            }
        }

        $allEarnings = (clone $earningsQuery)->get();
        $filteredEarnings = $filteredQuery->orderBy('created_at', 'desc')->get();

        // Revenue summary calculations based on TeacherEarning ledger
        $grossTotal = (float) (clone $earningsQuery)->where('amount', '>', 0)->where('source', '!=', 'reversal')->sum('amount');
        $refundTotal = (float) abs((clone $earningsQuery)->where(function($q) {
            $q->where('source', 'reversal')->orWhere('amount', '<', 0);
        })->sum('amount'));
        $netTotal = (float) (clone $earningsQuery)->sum('amount');

        $grossToday = (float) (clone $earningsQuery)->whereDate('created_at', Carbon::today())->where('amount', '>', 0)->where('source', '!=', 'reversal')->sum('amount');
        $refundToday = (float) abs((clone $earningsQuery)->whereDate('created_at', Carbon::today())->where(function($q) {
            $q->where('source', 'reversal')->orWhere('amount', '<', 0);
        })->sum('amount'));
        $netToday = $grossToday - $refundToday;

        $grossThisMonth = (float) (clone $earningsQuery)->whereYear('created_at', Carbon::now()->year)->whereMonth('created_at', Carbon::now()->month)->where('amount', '>', 0)->where('source', '!=', 'reversal')->sum('amount');
        $refundThisMonth = (float) abs((clone $earningsQuery)->whereYear('created_at', Carbon::now()->year)->whereMonth('created_at', Carbon::now()->month)->where(function($q) {
            $q->where('source', 'reversal')->orWhere('amount', '<', 0);
        })->sum('amount'));
        $netThisMonth = $grossThisMonth - $refundThisMonth;

        $grossThisYear = (float) (clone $earningsQuery)->whereYear('created_at', Carbon::now()->year)->where('amount', '>', 0)->where('source', '!=', 'reversal')->sum('amount');
        $refundThisYear = (float) abs((clone $earningsQuery)->whereYear('created_at', Carbon::now()->year)->where(function($q) {
            $q->where('source', 'reversal')->orWhere('amount', '<', 0);
        })->sum('amount'));
        $netThisYear = $grossThisYear - $refundThisYear;

        $lifetimePayouts = (float) \App\Models\TeacherPayout::where('teacher_id', $teacherId)
            ->whereIn('status', ['completed', 'paid'])
            ->sum('amount');
        $availableBalance = max(0.00, round($netTotal - $lifetimePayouts, 2));

        $breakdown = [];
        $ledger = [];
        $bundleDetails = [];
        $lessonDetails = [];
        $refundsList = [];

        foreach ($filteredEarnings as $e) {
            $studentName = $e->student ? $e->student->name : 'طالب محذوف';
            $isRefund = ($e->source === 'reversal' || $e->amount < 0);
            $amountVal = (float) abs($e->amount);

            $purchaseType = 'Course';
            $itemName = 'كورس';

            if ($e->source === 'manual_adjustment') {
                $purchaseType = 'Adjustment';
                $itemName = $e->description ?: 'تسوية يدوية من الإدارة';
            } elseif ($e->exam_id) {
                $purchaseType = 'Exam';
                $itemName = $e->exam ? $e->exam->title : 'امتحان مدفوع';
            } elseif ($e->package_id) {
                $purchaseType = ($e->package && $e->package->type === 'bundle') ? 'Bundle' : 'Package';
                $itemName = $e->package ? $e->package->title : 'باقة';

                if (!$isRefund && $e->package_id) {
                    if (!isset($bundleDetails[$e->package_id])) {
                        $bundleDetails[$e->package_id] = [
                            'bundle_name' => $itemName,
                            'purchases' => []
                        ];
                    }
                    $bundleDetails[$e->package_id]['purchases'][] = [
                        'student_name' => $studentName,
                        'amount_paid' => $amountVal,
                        'purchase_date' => $e->created_at->toDateTimeString(),
                    ];
                }
            } elseif ($e->lesson_id) {
                $purchaseType = 'Lesson';
                $itemName = $e->lesson ? $e->lesson->title : 'محاضرة';

                if (!$isRefund && $e->lesson_id) {
                    if (!isset($lessonDetails[$e->lesson_id])) {
                        $lessonDetails[$e->lesson_id] = [
                            'lesson_name' => $itemName,
                            'purchases' => []
                        ];
                    }
                    $lessonDetails[$e->lesson_id]['purchases'][] = [
                        'student_name' => $studentName,
                        'amount_paid' => $amountVal,
                        'purchase_date' => $e->created_at->toDateTimeString(),
                    ];
                }
            } elseif ($e->course_id) {
                $purchaseType = 'Course';
                $itemName = $e->course ? $e->course->title : 'كورس';
            }

            if (!$isRefund) {
                $breakdown[] = [
                    'student_name' => $studentName,
                    'purchase_type' => $purchaseType,
                    'item_name' => $itemName,
                    'amount_paid' => $amountVal,
                    'purchase_date' => $e->created_at->toDateTimeString(),
                    'payment_source' => $e->source === 'code_activation' ? 'كود تفعيل' : 'المحفظة'
                ];

                $ledger[] = [
                    'transaction_id' => 'TX-' . str_pad($e->id, 6, '0', STR_PAD_LEFT),
                    'student_name' => $studentName,
                    'type' => $purchaseType,
                    'item_name' => $itemName,
                    'amount' => $amountVal,
                    'date' => $e->created_at->toDateTimeString(),
                    'status' => 'مكتمل'
                ];
            } else {
                $refundsList[] = [
                    'transaction_id' => 'TX-' . str_pad($e->id, 6, '0', STR_PAD_LEFT),
                    'student_id' => $e->student_id,
                    'student_name' => $studentName,
                    'item_name' => $itemName,
                    'purchase_type' => $purchaseType,
                    'original_amount' => $amountVal,
                    'refunded_amount' => $amountVal,
                    'purchase_date' => $e->created_at->toDateTimeString(),
                    'refund_date' => $e->created_at->toDateTimeString(),
                    'refund_reason' => $e->description ?: 'إلغاء واسترجاع إداري',
                    'status' => 'مسترجع',
                    'payment_method' => 'المحفظة',
                ];

                $ledger[] = [
                    'transaction_id' => 'TX-' . str_pad($e->id, 6, '0', STR_PAD_LEFT),
                    'student_name' => $studentName,
                    'type' => $purchaseType,
                    'item_name' => $itemName,
                    'amount' => $amountVal,
                    'date' => $e->created_at->toDateTimeString(),
                    'status' => 'مسترجع'
                ];
            }
        }

        return response()->json([
            'summary' => [
                'total_revenue' => $netTotal,
                'revenue_today' => $netToday,
                'revenue_this_month' => $netThisMonth,
                'revenue_this_year' => $netThisYear,
                'gross_revenue' => $grossTotal,
                'refunded_revenue' => $refundTotal,
                'net_revenue' => $netTotal,
                'available_balance' => $availableBalance,
                'lifetime_payouts' => $lifetimePayouts,
                'refund_count' => count($refundsList),
                'refund_rate' => $grossTotal > 0 ? round(($refundTotal / $grossTotal) * 100, 2) : 0,
            ],
            'breakdown' => $breakdown,
            'bundle_details' => array_values($bundleDetails),
            'lesson_details' => array_values($lessonDetails),
            'ledger' => $ledger,
            'refunds' => $refundsList,
        ]);
    }

    /**
     * Get a single exam with questions.
     */
    public function getExam(Request $request, $examId)
    {
        $exam = Exam::with(['questions', 'lesson.unit'])->findOrFail($examId);
        if ($exam->lesson_id && $exam->lesson && $exam->lesson->unit) {
            $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);
        } else {
            $user = $request->user();
            if ($exam->teacher_id !== $user->id && !$user->isAdmin()) {
                abort(403, 'غير مصرح لك بعرض هذا الامتحان.');
            }
        }
        return response()->json($exam);
    }

    /**
     * Update an exam and its questions.
     */
    public function updateExam(Request $request, $examId)
    {
        $exam = Exam::with('lesson.unit')->findOrFail($examId);
        $isStandalone = empty($exam->lesson_id) || $exam->type === 'monthly_exam';

        if (!$isStandalone && $exam->lesson && $exam->lesson->unit) {
            $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);
        } else {
            $user = $request->user();
            if ($exam->teacher_id !== $user->id && !$user->isAdmin()) {
                abort(403, 'غير مصرح لك بتعديل هذا الامتحان.');
            }
        }

        $rules = [
            'title' => 'required|string|max:255',
            'type' => $isStandalone ? 'required|string|in:monthly_exam' : 'required|string|in:quiz,homework',
            'homework_type' => 'nullable|string|in:normal,bubble_sheet',
            'time_limit_minutes' => 'nullable|integer|min:0',
            'max_score' => 'required|integer|min:1',
            'start_date' => 'nullable|date',
            'start_time' => 'nullable|string',
            'end_date' => 'nullable|date',
            'end_time' => 'nullable|string',
            'max_attempts' => 'nullable|integer|min:1',
            'passing_score' => 'nullable|integer|min:0',
            'enable_schedule' => 'nullable|boolean',
            'open_date' => 'nullable|date',
            'open_time' => 'nullable|string',
            'close_date' => 'nullable|date',
            'close_time' => 'nullable|string',
            'submission_deadline' => 'nullable|string',
            'is_paid' => 'nullable|boolean',
            'price' => 'nullable|numeric|min:0',
            'show_score' => 'nullable|boolean',
            'show_student_answers' => 'nullable|boolean',
            'show_correct_answers' => 'nullable|boolean',
            'show_explanations' => 'nullable|boolean',
            'questions' => 'required|array|min:1',
            'questions.*.text' => 'nullable|string',
            'questions.*.image_url' => 'nullable|string',
            'questions.*.type' => 'required|string|in:mcq,true_false,essay',
            'questions.*.options' => 'nullable|array',
            'questions.*.correct_answer' => 'nullable|string',
            'questions.*.score' => 'required|integer|min:1',
        ];

        if (!$isStandalone) {
            $rules['lesson_id'] = 'required|exists:lessons,id';
        }

        $request->validate($rules);

        return DB::transaction(function () use ($request, $exam, $isStandalone) {
            $updateData = [
                'title' => $request->title,
                'type' => $request->type,
                'homework_type' => $request->homework_type ?? 'normal',
                'time_limit_minutes' => ($request->filled('time_limit_minutes') && (int)$request->time_limit_minutes > 0) ? (int)$request->time_limit_minutes : null,
                'max_score' => $request->max_score,
                'start_date' => $request->start_date,
                'start_time' => $request->start_time,
                'end_date' => $request->end_date,
                'end_time' => $request->end_time,
                'max_attempts' => $request->max_attempts ?? 1,
                'passing_score' => $request->passing_score ?? 50,
                'enable_schedule' => $request->enable_schedule ?? false,
                'open_date' => $request->open_date,
                'open_time' => $request->open_time,
                'close_date' => $request->close_date,
                'close_time' => $request->close_time,
                'submission_deadline' => $request->submission_deadline,
                'is_paid' => $request->is_paid ?? false,
                'price' => $request->price ?? 0.00,
            ];

            if ($request->has('show_score')) $updateData['show_score'] = (bool)$request->show_score;
            if ($request->has('show_student_answers')) $updateData['show_student_answers'] = (bool)$request->show_student_answers;
            if ($request->has('show_correct_answers')) $updateData['show_correct_answers'] = (bool)$request->show_correct_answers;
            if ($request->has('show_explanations')) $updateData['show_explanations'] = (bool)$request->show_explanations;

            if ($isStandalone) {
                $updateData['lesson_id'] = null;
                $updateData['course_id'] = null;
                if ($request->filled('month')) $updateData['month'] = $request->month;
                if ($request->filled('stage')) $updateData['stage'] = $request->stage;
                if ($request->filled('grade')) $updateData['grade'] = $request->grade;
                if ($request->filled('subject')) $updateData['subject'] = $request->subject;
            } else {
                $updateData['lesson_id'] = $request->lesson_id;
            }

            $exam->update($updateData);

            // Sync questions
            $exam->questions()->delete();

            foreach ($request->questions as $qData) {
                Question::create([
                    'exam_id' => $exam->id,
                    'text' => $qData['text'] ?? '',
                    'image_url' => $qData['image_url'] ?? null,
                    'type' => $qData['type'],
                    'options' => $qData['options'] ?? null,
                    'correct_answer' => $qData['correct_answer'] ?? null,
                    'score' => $qData['score'],
                ]);
            }

            if ($request->user() && $request->user()->role === 'teacher') {
                \App\Services\TeacherActivityService::logExamUpdated($request->user(), $exam, $request);
            }

            $courseId = $exam->course_id ?: ($exam->lesson?->unit?->course_id ?: null);
            if ($courseId) {
                Course::touchContent($courseId);
            }

            return response()->json($exam->load('questions'), 200);
        });
    }

    /**
     * Delete an exam.
     */
    public function deleteExam(Request $request, $examId)
    {
        $exam = Exam::with('lesson.unit')->findOrFail($examId);
        if ($exam->lesson_id && $exam->lesson && $exam->lesson->unit) {
            $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);
        } else {
            $user = $request->user();
            if ($exam->teacher_id !== $user->id && !$user->isAdmin()) {
                abort(403, 'غير مصرح لك بحذف هذا الامتحان.');
            }
        }

        $examTitle = $exam->title;
        $isMonthly = $exam->type === 'monthly_exam';
        $courseId = $exam->course_id ?: ($exam->lesson?->unit?->course_id ?: null);

        $exam->questions()->delete();
        $exam->delete();

        if ($courseId) {
            Course::touchContent($courseId);
        }

        if ($request->user() && $request->user()->role === 'teacher') {
            \App\Services\TeacherActivityService::logExamDeleted($request->user(), (int)$examId, $examTitle, $isMonthly, $request);
        }

        return response()->json(['message' => 'تم حذف الامتحان بنجاح']);
    }

    /**
     * Detect duration/metadata of video from url automatically.
     */
    public function detectVideoDurationUrl(Request $request)
    {
        $request->validate([
            'url' => 'required|string',
        ]);

        $url = $request->input('url');
        $provider = 'unknown';
        if (str_contains($url, 'youtube.com') || str_contains($url, 'youtu.be')) {
            $provider = 'youtube';
        } elseif (str_contains($url, '.mp4')) {
            $provider = 'direct';
        } elseif (str_contains($url, 'iframe.mediadelivery.net')) {
            $provider = 'bunny';
        }

        if ($provider === 'youtube') {
            $meta = $this->fetchYoutubeVideoDetails($url);
            if ($meta) {
                return response()->json($meta);
            }
        } elseif ($provider === 'bunny') {
            preg_match('/play\/(\d+)\/([a-zA-Z0-9\-]+)/', $url, $matches);
            $bunnyId = $matches[2] ?? null;
            if ($bunnyId) {
                $meta = $this->fetchBunnyVideoDetails($bunnyId);
                if ($meta) {
                    return response()->json($meta);
                }
            }
        }

        return response()->json([
            'duration_seconds' => 300,
            'duration_text' => '5:00',
            'title' => null,
            'thumbnail_path' => null,
        ]);
    }

    /**
     * Get student course view limit overrides and counters for courses owned by this teacher.
     */
    public function getStudentCourseLimits(Request $request)
    {
        $teacher = $request->user();
        
        $query = \App\Models\StudentCourseViewLimit::whereHas('course', function ($q) use ($teacher) {
            $q->where('teacher_id', $teacher->id);
        })->with(['student', 'course']);

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }
        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $limits = $query->get()->map(function ($limit) {
            $course = $limit->course;
            $settings = \App\Models\PlatformSetting::first();
            $globalDefault = $settings ? (int)$settings->default_max_views : 10;
            
            $baseLimit = $limit->max_views_override !== null 
                ? $limit->max_views_override 
                : ($course->max_views !== null ? $course->max_views : $globalDefault);

            $maxAllowed = $baseLimit + $limit->extra_views;
            $remaining = max(0, $maxAllowed - $limit->views_used);

            return [
                'id' => $limit->id,
                'student_id' => $limit->student_id,
                'student_name' => $limit->student->name ?? 'طالب محذوف',
                'student_phone' => $limit->student->phone ?? '',
                'course_id' => $limit->course_id,
                'course_title' => $course->title ?? 'كورس محذوف',
                'views_used' => $limit->views_used,
                'max_views_override' => $limit->max_views_override,
                'extra_views' => $limit->extra_views,
                'max_allowed' => $maxAllowed,
                'remaining' => $remaining,
            ];
        });

        return response()->json($limits);
    }

    /**
     * Link/Sync child courses to a bundled course.
     */
    public function linkBundleCourses(Request $request, $courseId)
    {
        $course = $this->verifyCourseTeacher($request, $courseId);
        
        if (!$course->is_bundle) {
            abort(400, 'هذا الكورس ليس كورس مجمع.');
        }

        $request->validate([
            'child_ids' => 'required|array',
            'child_ids.*' => 'exists:courses,id',
        ]);

        // Ensure we do not link the bundled course to itself
        foreach ($request->child_ids as $id) {
            if ((int)$id === (int)$courseId) {
                return response()->json([
                    'message' => 'لا يمكن ربط الكورس المجمع بنفسه.'
                ], 422);
            }
        }

        $childIds = $request->child_ids;

        // Validate that all linked courses belong to the same grade, subject, teacher, and are not bundled courses
        if (!empty($childIds)) {
            $childCourses = \App\Models\Course::whereIn('id', $childIds)->get();
            
            // 1. Prevent Circular References (cannot select bundled courses as child)
            foreach ($childCourses as $child) {
                if ($child->is_bundle === true || (int)$child->is_bundle === 1 || $child->is_bundle === '1') {
                    return response()->json([
                        'message' => 'لا يمكن إضافة كورس مجمع ككورس فرعي داخل كورس مجمع آخر.'
                    ], 422);
                }
            }

            // 2. Validate Teacher (all child courses must belong to the same teacher)
            $teacherIds = $childCourses->pluck('teacher_id')->unique();
            if ($teacherIds->count() > 1 || ((int)$teacherIds->first() !== (int)$course->teacher_id)) {
                return response()->json([
                    'message' => 'يجب أن تنتمي جميع الكورسات المحددة لنفس المعلم.'
                ], 422);
            }

            // 3. Validate Grade (all child courses must belong to the same grade)
            $grades = $childCourses->pluck('grade')->unique()->filter();
            if ($grades->count() > 1) {
                return response()->json([
                    'message' => 'لا يمكن إنشاء كورس مجمع من كورسات تنتمي إلى مراحل دراسية مختلفة.'
                ], 422);
            }

            // 4. Validate Subject (all child courses must belong to the same subject)
            $subjects = $childCourses->pluck('subject')->unique()->filter();
            if ($subjects->count() > 1) {
                return response()->json([
                    'message' => 'لا يمكن إنشاء كورس مجمع من مواد دراسية مختلفة.'
                ], 422);
            }

            // Save inherited grade and subject
            if ($grades->count() === 1) {
                $course->grade = $grades->first();
            }
            if ($subjects->count() === 1) {
                $course->subject = $subjects->first();
            }
            $course->save();
        }

        $course->childCourses()->sync($childIds);
        Course::touchContent($course->id);

        return response()->json($course->load('childCourses'));
    }
}

