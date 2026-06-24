<?php

namespace App\Services;

use App\Models\Video;
use App\Models\User;
use App\Models\TeacherSubscription;
use App\Models\PurchaseCode;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BunnySubscriptionService
{
    /**
     * Sync video storage sizes from Bunny Stream and update teacher subscription usage.
     */
    public function syncStorageAndCodes($teacherId = null)
    {
        $libraryId = env('BUNNY_STREAM_LIBRARY_ID');
        $apiKey = env('BUNNY_STREAM_API_KEY');

        if (empty($libraryId) || empty($apiKey)) {
            Log::warning('Bunny Stream is not configured. Skipping storage synchronization.');
            return false;
        }

        try {
            // 1. Fetch all videos from Bunny Stream (handling pagination)
            $bunnyVideos = [];
            $page = 1;
            $perPage = 100;
            $hasMore = true;

            while ($hasMore) {
                $response = Http::withHeaders([
                    'AccessKey' => $apiKey,
                    'accept' => 'application/json',
                ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos", [
                    'page' => $page,
                    'itemsPerPage' => $perPage,
                ]);

                if (!$response->successful()) {
                    Log::error('Failed to fetch videos from Bunny Stream library.', ['body' => $response->body()]);
                    break;
                }

                $data = $response->json();
                $items = $data['items'] ?? [];
                
                foreach ($items as $item) {
                    if (isset($item['guid'])) {
                        $bunnyVideos[$item['guid']] = $item['storageSize'] ?? 0;
                    }
                }

                if (count($items) < $perPage) {
                    $hasMore = false;
                } else {
                    $page++;
                }
            }

            // 2. Update local database video storage sizes
            foreach ($bunnyVideos as $guid => $size) {
                Video::where('bunny_stream_id', $guid)->update(['storage_size' => $size]);
            }

            // 3. Update Teacher Subscriptions used_storage_bytes & used_codes
            $teachersQuery = User::where('role', 'teacher');
            if ($teacherId) {
                $teachersQuery->where('id', $teacherId);
            }
            $teachers = $teachersQuery->get();

            foreach ($teachers as $teacher) {
                $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
                if (!$subscription) {
                    continue;
                }

                // Sum storage sizes for all videos belonging to this teacher
                $usedStorage = Video::whereHas('lesson.unit.course', function ($q) use ($teacher) {
                    $q->where('teacher_id', $teacher->id);
                })->sum('storage_size');

                // Sum all active students enrolled in this teacher's courses
                $courseIds = \App\Models\Course::where('teacher_id', $teacher->id)->pluck('id');
                $usedCodes = \App\Models\Enrollment::whereIn('course_id', $courseIds)
                    ->join('users', 'enrollments.student_id', '=', 'users.id')
                    ->where('users.status', 'active')
                    ->where('users.role', 'student')
                    ->distinct('enrollments.student_id')
                    ->count('enrollments.student_id');

                // Check status dates to transition status
                $status = $subscription->status;
                $today = now();
                $endDate = $subscription->end_date;

                if ($subscription->status !== 'Suspended') {
                    if ($today->gt($endDate)) {
                        $status = 'Expired';
                    } elseif ($today->diffInDays($endDate) <= 7) {
                        $status = 'Expiring Soon';
                    } else {
                        $status = 'Active';
                    }
                }

                $subscription->update([
                    'used_storage_bytes' => $usedStorage,
                    'used_codes' => $usedCodes,
                    'status' => $status,
                ]);
            }

            return true;
        } catch (\Exception $e) {
            Log::error('Error in BunnySubscriptionService storage sync: ' . $e->getMessage());
            return false;
        }
    }
}
