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

        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string',
            'bio' => 'nullable|string',
            'experience' => 'nullable|string',
            'teaching_mode' => 'required|string|in:online,center,both',
        ]);

        $teacher->update($request->only([
            'name', 'phone', 'bio', 'experience', 'teaching_mode'
        ]));

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
        if ($course->teacher_id !== $request->user()->id) {
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
        $libraryId = config('services.bunny.library_id');
        $apiKey = config('services.bunny.api_key');

        if (empty($libraryId) || empty($apiKey)) {
            return null;
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withoutVerifying()->withHeaders([
                'AccessKey' => $apiKey,
                'accept' => 'application/json',
            ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$videoId}");

            if ($response->successful()) {
                $data = $response->json();
                $duration = isset($data['length']) ? intval($data['length']) : 0;
                
                // Construct standard embed and thumbnail URLs
                $thumbnail = isset($data['thumbnailUrl']) && !empty($data['thumbnailUrl']) 
                    ? $data['thumbnailUrl'] 
                    : "https://iframe.mediadelivery.net/play/{$libraryId}/{$videoId}/thumbnail.jpg";
                
                $width = isset($data['width']) ? $data['width'] : null;
                $height = isset($data['height']) ? $data['height'] : null;
                $resolution = ($width && $height) ? "{$width}x{$height}" : null;

                return [
                    'duration_seconds' => $duration,
                    'thumbnail_path' => $thumbnail,
                    'resolution' => $resolution,
                    'title' => isset($data['title']) ? $data['title'] : null,
                ];
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to fetch Bunny video details: " . $e->getMessage());
        }

        return null;
    }

    public function generateSignedUpload(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'lesson_id' => 'required|exists:lessons,id',
            'file_size' => 'sometimes|integer|min:0',
        ]);

        $lesson = Lesson::with('unit')->findOrFail($request->lesson_id);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $libraryId = config('services.bunny.library_id');
        $apiKey = config('services.bunny.api_key');

        if (empty($libraryId) || empty($apiKey)) {
            return response()->json([
                'message' => 'Bunny Stream integration is not configured on the server.'
            ], 400);
        }

        // Validate teacher subscription storage limit
        $teacher = $request->user();
        $teacherId = $teacher->id;
        $fileSize = (int) $request->input('file_size', 0);
        if ($request->hasFile('video')) {
            $fileSize = $request->file('video')->getSize();
        } elseif ($request->hasFile('file')) {
            $fileSize = $request->file('file')->getSize();
        }

        $videoSizeGb = $fileSize / 1024 / 1024 / 1024;
        $remainingStorageGb = $teacher->remaining_storage_gb;

        \Log::info('VIDEO STORAGE CHECK', [
            'teacher_id' => $teacherId,
            'video_size_gb' => $videoSizeGb,
            'remaining_storage_gb' => $remainingStorageGb,
        ]);

        if ($videoSizeGb > $remainingStorageGb) {
            return response()->json([
                'success' => false,
                'message' => 'مساحتك التخزينية المتبقية لا تسمح برفع هذا الفيديو. يمكنك طلب مساحة إضافية.'
            ], 422);
        }

        $bunnyService = new \App\Services\BunnyStreamService();
        if ($bunnyService->isStorageLimitExceeded($teacherId, $fileSize)) {
            return response()->json([
                'success' => false,
                'message' => 'لقد تجاوزت الحد المسموح به لمساحة التخزين في باقتك. يرجى ترقية الباقة لتتمكن من إضافة فيديوهات جديدة.'
            ], 403);
        }

        try {
            // 1. Create a video placeholder in Bunny Stream
            $response = \Illuminate\Support\Facades\Http::withoutVerifying()->withHeaders([
                'AccessKey' => $apiKey,
                'Content-Type' => 'application/json',
                'accept' => 'application/json',
            ])->post("https://video.bunnycdn.com/library/{$libraryId}/videos", [
                'title' => $request->title,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $videoId = $data['guid']; // Bunny Stream Video ID (GUID)

                // 2. Generate authorization signature for TUS upload
                $expirationTime = time() + 7200; // 2 hours expiration
                $signature = hash('sha256', $libraryId . $apiKey . $expirationTime . $videoId);

                $cdnHost = config('services.bunny.cdn_hostname');
                $pullZone = config('services.bunny.pull_zone');
                $domain = !empty($cdnHost) ? $cdnHost : (!empty($pullZone) ? $pullZone : 'iframe.mediadelivery.net');

                $embedUrl = "https://iframe.mediadelivery.net/embed/{$libraryId}/{$videoId}";
                $thumbnailUrl = "https://{$domain}/play/{$libraryId}/{$videoId}/thumbnail.jpg";

                // 3. Create local video record in database immediately
                $video = Video::create([
                    'lesson_id' => $request->lesson_id,
                    'title' => $request->title,
                    'bunny_video_id' => $videoId,
                    'bunny_stream_id' => $videoId,
                    'bunny_embed_url' => $embedUrl,
                    'bunny_thumbnail_url' => $thumbnailUrl,
                    'bunny_duration' => 0,
                    'bunny_size_bytes' => $fileSize,
                    'bunny_status' => 'queued',
                    'duration_seconds' => 0,
                    'thumbnail_path' => $thumbnailUrl,
                ]);

                // Recalculate teacher storage
                $bunnyService->recalculateStorage($teacherId);

                // Dispatch background status polling job
                \App\Jobs\PollBunnyVideoStatus::dispatch($video->id);

                return response()->json([
                    'video_id' => $videoId,
                    'library_id' => $libraryId,
                    'signature' => $signature,
                    'expiration_time' => $expirationTime,
                    'embed_url' => $embedUrl,
                    'video' => $video,
                ]);
            } else {
                return response()->json([
                    'message' => 'Failed to create video object in Bunny Stream.',
                    'details' => $response->body()
                ], 500);
            }
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error generating signed upload: ' . $e->getMessage()
            ], 500);
        }
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
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'grade' => $isBundle ? 'nullable|string' : 'required|string',
            'subject' => 'required|string',
            'enable_discount' => 'nullable|boolean',
            'discount_type' => 'nullable|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'availability' => 'nullable|string|in:online,center,both',
            'is_bundle' => 'nullable|boolean',
        ]);

        $course = Course::create([
            'teacher_id' => $request->user()->id,
            'title' => $request->title,
            'description' => $request->description,
            'cover_image' => $request->cover_image,
            'price' => $request->price,
            'grade' => $request->grade ?? 'باقة مجمعة',
            'subject' => $request->subject,
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
                'students'
            );
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Notification error: ' . $e->getMessage());
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
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'grade' => $isBundle ? 'nullable|string' : 'required|string',
            'subject' => 'required|string',
            'enable_discount' => 'nullable|boolean',
            'discount_type' => 'nullable|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'availability' => 'nullable|string|in:online,center,both',
            'is_bundle' => 'nullable|boolean',
        ]);

        $course->update([
            'title' => $request->title,
            'description' => $request->description,
            'cover_image' => $request->cover_image,
            'price' => $request->price,
            'grade' => $request->grade ?? $course->grade ?? 'باقة مجمعة',
            'subject' => $request->subject,
            'enable_discount' => $request->enable_discount ?? false,
            'discount_type' => $request->discount_type,
            'discount_value' => $request->discount_value,
            'availability' => $request->availability ?? $course->availability ?? 'both',
            'is_bundle' => $request->has('is_bundle') ? $request->is_bundle : $course->is_bundle,
        ]);

        return response()->json($course);
    }

    /**
     * Delete Course.
     */
    public function deleteCourse(Request $request, $id)
    {
        $course = $this->verifyCourseTeacher($request, $id);
        $course->delete();

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

        return response()->json($unit, 201);
    }

    /**
     * Add Lesson.
     */
    public function addLesson(Request $request, $unitId)
    {
        $unit = Unit::findOrFail($unitId);
        $this->verifyCourseTeacher($request, $unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer',
            'price' => 'nullable|numeric|min:0',
        ]);

        $lesson = Lesson::create([
            'unit_id' => $unitId,
            'title' => $request->title,
            'description' => $request->description,
            'order' => $request->order ?? 0,
            'price' => $request->price ?? 0.00,
        ]);

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

        return response()->json($lesson, 201);
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

        return response()->json(['success' => true, 'message' => 'تم حذف الدرس وجميع الفيديوهات والملفات المرتبطة بنجاح.']);
    }

    /**
     * Add Video to Lesson.
     */
    public function addVideo(Request $request, $lessonId)
    {
        $lesson = Lesson::with('unit')->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $url = $request->input('bunny_embed_url', '');

        // Auto detect provider
        $provider = 'unknown';
        if (str_contains($url, 'youtube.com') || str_contains($url, 'youtu.be')) {
            $provider = 'youtube';
        } elseif (str_contains($url, '.mp4')) {
            $provider = 'direct';
        } elseif (str_contains($url, 'iframe.mediadelivery.net')) {
            $provider = 'bunny';
        }

        $bunnyStreamId = $request->input('bunny_stream_id');
        if (!empty($bunnyStreamId)) {
            $bunnyMeta = $this->fetchBunnyVideoDetails($bunnyStreamId);
            if ($bunnyMeta) {
                $request->merge([
                    'duration_seconds' => $bunnyMeta['duration_seconds'],
                    'thumbnail_path' => $bunnyMeta['thumbnail_path'],
                    'resolution' => $bunnyMeta['resolution'],
                ]);
            }
        }

        if ($provider === 'youtube') {
            $ytMeta = $this->fetchYoutubeVideoDetails($url);
            if ($ytMeta) {
                $request->merge([
                    'duration_seconds' => $ytMeta['duration_seconds'],
                    'thumbnail_path' => $ytMeta['thumbnail_path'],
                ]);
            }
        }

        $isBunnyConfigured = !empty(config('services.bunny.library_id'));
        $isDevMode = filter_var(env('DEVELOPMENT_MODE', false), FILTER_VALIDATE_BOOLEAN);

        $rules = [
            'title' => 'required|string|max:255',
            'bunny_embed_url' => 'required|string',
            'duration_seconds' => 'nullable|integer',
            'thumbnail_path' => 'nullable|string',
            'resolution' => 'nullable|string',
        ];

        if ($provider === 'bunny' && $isBunnyConfigured && !$isDevMode) {
            $rules['bunny_stream_id'] = 'required|string';
        } else {
            $rules['bunny_stream_id'] = 'nullable|string';
        }

        $request->validate($rules);

        $durationSeconds = $request->duration_seconds;
        if (empty($durationSeconds) || $durationSeconds <= 0) {
            $durationSeconds = 300; // fallback default
        }

        $video = Video::create([
            'lesson_id' => $lessonId,
            'title' => $request->title,
            'bunny_video_id' => $request->bunny_stream_id,
            'bunny_stream_id' => $request->bunny_stream_id,
            'bunny_embed_url' => $request->bunny_embed_url,
            'duration_seconds' => $durationSeconds,
            'thumbnail_path' => $request->thumbnail_path,
            'resolution' => $request->resolution,
            'bunny_status' => $request->bunny_stream_id ? 'finished' : 'finished',
        ]);

        $this->updateLessonDuration($lessonId);

        return response()->json($video, 201);
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

        $url = $request->input('bunny_embed_url', $video->bunny_embed_url);

        // Auto detect provider
        $provider = 'unknown';
        if (str_contains($url, 'youtube.com') || str_contains($url, 'youtu.be')) {
            $provider = 'youtube';
        } elseif (str_contains($url, '.mp4')) {
            $provider = 'direct';
        } elseif (str_contains($url, 'iframe.mediadelivery.net')) {
            $provider = 'bunny';
        }

        $bunnyStreamId = $request->input('bunny_stream_id');
        if (!empty($bunnyStreamId)) {
            $bunnyMeta = $this->fetchBunnyVideoDetails($bunnyStreamId);
            if ($bunnyMeta) {
                $request->merge([
                    'duration_seconds' => $bunnyMeta['duration_seconds'],
                    'thumbnail_path' => $bunnyMeta['thumbnail_path'],
                    'resolution' => $bunnyMeta['resolution'],
                ]);
            }
        }

        if ($provider === 'youtube') {
            $ytMeta = $this->fetchYoutubeVideoDetails($url);
            if ($ytMeta) {
                $request->merge([
                    'duration_seconds' => $ytMeta['duration_seconds'],
                    'thumbnail_path' => $ytMeta['thumbnail_path'],
                ]);
            }
        }

        $isBunnyConfigured = !empty(config('services.bunny.library_id'));
        $isDevMode = filter_var(env('DEVELOPMENT_MODE', false), FILTER_VALIDATE_BOOLEAN);

        $rules = [
            'title' => 'required|string|max:255',
            'bunny_embed_url' => 'required|string',
            'duration_seconds' => 'nullable|integer',
            'thumbnail_path' => 'nullable|string',
            'resolution' => 'nullable|string',
        ];

        if ($provider === 'bunny' && $isBunnyConfigured && !$isDevMode) {
            $rules['bunny_stream_id'] = 'required|string';
        } else {
            $rules['bunny_stream_id'] = 'nullable|string';
        }

        $request->validate($rules);

        $durationSeconds = $request->duration_seconds;
        if (empty($durationSeconds) || $durationSeconds <= 0) {
            $durationSeconds = $video->duration_seconds ?: 300;
        }

        $video->update([
            'title' => $request->title,
            'bunny_video_id' => $request->bunny_stream_id,
            'bunny_stream_id' => $request->bunny_stream_id,
            'bunny_embed_url' => $request->bunny_embed_url,
            'duration_seconds' => $durationSeconds,
            'thumbnail_path' => $request->thumbnail_path,
            'resolution' => $request->resolution,
            'bunny_status' => $request->bunny_stream_id ? ($video->bunny_status ?: 'finished') : 'finished',
        ]);

        $this->updateLessonDuration($video->lesson_id);

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

        if (empty($libraryId) || empty($apiKey)) {
            return response()->json([
                'message' => 'Bunny Stream integration is not configured on the server.'
            ], 400);
        }

        $teacherId = $request->user()->id;
        $bunnyService = new \App\Services\BunnyStreamService();

        // Validate storage limit: subtract the current video size because we are replacing it
        $fileSize = (int) $request->input('file_size', 0);
        $currentVideoSize = (int) ($video->bunny_size_bytes ?? $video->storage_size ?? 0);
        $netSizeChange = max(0, $fileSize - $currentVideoSize);

        if ($bunnyService->isStorageLimitExceeded($teacherId, $netSizeChange)) {
            return response()->json([
                'message' => 'لقد تجاوزت الحد المسموح به لمساحة التخزين في باقتك. يرجى ترقية الباقة لتتمكن من إضافة فيديوهات جديدة.'
            ], 403);
        }

        // 1. Delete old video from Bunny Stream if exists
        $oldBunnyId = $video->bunny_video_id ?: $video->bunny_stream_id;
        if (!empty($oldBunnyId)) {
            $bunnyService->deleteVideo($oldBunnyId);
        }

        try {
            // 2. Create a new video placeholder in Bunny Stream
            $response = \Illuminate\Support\Facades\Http::withoutVerifying()->withHeaders([
                'AccessKey' => $apiKey,
                'Content-Type' => 'application/json',
                'accept' => 'application/json',
            ])->post("https://video.bunnycdn.com/library/{$libraryId}/videos", [
                'title' => $video->title,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $newVideoId = $data['guid']; // New GUID

                // 3. Generate authorization signature for TUS upload
                $expirationTime = time() + 7200; // 2 hours expiration
                $signature = hash('sha256', $libraryId . $apiKey . $expirationTime . $newVideoId);

                $cdnHost = config('services.bunny.cdn_hostname');
                $pullZone = config('services.bunny.pull_zone');
                $domain = !empty($cdnHost) ? $cdnHost : (!empty($pullZone) ? $pullZone : 'iframe.mediadelivery.net');

                $embedUrl = "https://{$domain}/embed/{$libraryId}/{$newVideoId}";
                $thumbnailUrl = "https://{$domain}/play/{$libraryId}/{$newVideoId}/thumbnail.jpg";

                // 4. Update local video record immediately
                $video->update([
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

                // Recalculate teacher storage
                $bunnyService->recalculateStorage($teacherId);

                // Dispatch background status polling job
                \App\Jobs\PollBunnyVideoStatus::dispatch($video->id);

                return response()->json([
                    'video_id' => $newVideoId,
                    'library_id' => $libraryId,
                    'signature' => $signature,
                    'expiration_time' => $expirationTime,
                    'embed_url' => $embedUrl,
                    'video' => $video,
                ]);
            } else {
                return response()->json([
                    'message' => 'Failed to create replacement video object in Bunny Stream.',
                    'details' => $response->body()
                ], 500);
            }
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error generating signed replacement: ' . $e->getMessage()
            ], 500);
        }
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

        $videos = Video::whereHas('lesson.unit.course', function ($q) use ($teacherId) {
            $q->where('teacher_id', $teacherId);
        })
        ->with('lesson.unit.course')
        ->latest()
        ->get()
        ->map(function ($video) {
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

        $pdf->delete();

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
     * Add Exam (Quiz, Homework, Monthly Exam) with Questions.
     */
    public function addExam(Request $request, $lessonId)
    {
        $lesson = Lesson::with('unit')->findOrFail($lessonId);
        $this->verifyCourseTeacher($request, $lesson->unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|string|in:quiz,homework,monthly_exam',
            'homework_type' => 'nullable|string|in:normal,bubble_sheet',
            'time_limit_minutes' => 'nullable|integer',
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
            'questions' => 'required|array|min:1',
            'questions.*.text' => 'required|string',
            'questions.*.type' => 'required|string|in:mcq,true_false,essay',
            'questions.*.options' => 'nullable|array', // Required if type is mcq
            'questions.*.correct_answer' => 'nullable|string', // Correct option value
            'questions.*.score' => 'required|integer|min:1',
        ]);

        return DB::transaction(function () use ($request, $lessonId) {
            $exam = Exam::create([
                'lesson_id' => $lessonId,
                'title' => $request->title,
                'type' => $request->type,
                'homework_type' => $request->homework_type ?? 'normal',
                'time_limit_minutes' => $request->time_limit_minutes,
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
            ]);

            foreach ($request->questions as $qData) {
                Question::create([
                    'exam_id' => $exam->id,
                    'text' => $qData['text'],
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
        $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);

        $attempts = StudentExam::where('exam_id', $examId)
            ->with(['student', 'answers.question'])
            ->latest()
            ->get();

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
     * Import questions from docx/doc file.
     */
    public function importQuestionsFromWord(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:5120',
        ]);

        $file = $request->file('file');
        $text = '';
        $extension = strtolower($file->getClientOriginalExtension());

        if ($extension === 'docx') {
            $zip = new \ZipArchive;
            if ($zip->open($file->getRealPath()) === true) {
                if (($index = $zip->locateName('word/document.xml')) !== false) {
                    $xml = $zip->getFromIndex($index);
                    // Convert paragraph tags to newline to preserve lines
                    $xml = str_replace(['<w:p ', '<w:p>', '<w:p/', '<w:br', '<w:br/>'], "\n", $xml);
                    $text = strip_tags($xml);
                    $text = html_entity_decode($text);
                }
                $zip->close();
            }
        } else {
            // Read printable characters from binary .doc file
            $fileHandle = fopen($file->getRealPath(), 'r');
            $rawContent = fread($fileHandle, filesize($file->getRealPath()));
            fclose($fileHandle);
            $text = preg_replace('/[^a-zA-Z0-9\s\x{0600}-\x{06FF}\p{P}]/u', '', $rawContent);
        }

        if (empty(trim($text))) {
            return response()->json(['message' => 'لم نتمكن من قراءة أي نصوص بالملف. تأكد من جودة الملف أو استخدم صيغة docx.'], 422);
        }

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        
        // Split text by س and digit followed by colon
        $parts = preg_split('/س\d+[\s\)\-\.：:]+/ui', $text);
        array_shift($parts); // remove introduction

        $questions = [];
        $lettersOrder = ['أ', 'ب', 'ج', 'د'];

        foreach ($parts as $part) {
            $part = trim($part);
            if (empty($part)) continue;

            $lines = explode("\n", $part);
            $lines = array_map('trim', $lines);
            $lines = array_filter($lines, fn($l) => !empty($l));

            if (empty($lines)) continue;

            $questionText = array_shift($lines);
            $options = [];
            $correctLetter = '';

            foreach ($lines as $line) {
                if (preg_match('/^\s*([أبجد])[\s\)\-\.：:\x{FF09}\x{FF0E}]+(.+)$/ui', $line, $matches)) {
                    $letter = trim($matches[1]);
                    $options[$letter] = trim($matches[2]);
                } elseif (preg_match('/الإجابة\s+الصحيحة\s*[:：]\s*([أبجد])/ui', $line, $matches)) {
                    $correctLetter = trim($matches[1]);
                }
            }

            $optionsList = [];
            foreach ($lettersOrder as $let) {
                if (isset($options[$let])) {
                    $optionsList[] = $options[$let];
                }
            }

            $correctAnswerText = '';
            if ($correctLetter && isset($options[$correctLetter])) {
                $correctAnswerText = $options[$correctLetter];
            }

            $type = 'essay';
            if (count($optionsList) > 0) {
                $type = 'mcq';
                if (count($optionsList) === 2 && (in_array('صح', $optionsList) || in_array('خطأ', $optionsList))) {
                    $type = 'true_false';
                }
            }

            $questions[] = [
                'text' => $questionText,
                'type' => $type,
                'options' => $type === 'mcq' ? $optionsList : ($type === 'true_false' ? ['صح', 'خطأ'] : null),
                'correct_answer' => $correctAnswerText ?: ($correctLetter ?: ''),
                'score' => 5,
            ];
        }

        return response()->json($questions);
    }

    /**
     * Get revenue reports for teacher dashboard.
     */
    public function revenueReport(Request $request)
    {
        $teacher = $request->user();
        $courses = Course::where('teacher_id', $teacher->id)->get();
        $courseIds = $courses->pluck('id')->toArray();
        
        $courseIdsStr = array_map('strval', $courseIds);
        
        $packageIds = Package::whereIn('course_id', $courseIds)->pluck('id')->toArray();
        $packageIdsStr = array_map('strval', $packageIds);
        
        $unitIds = Unit::whereIn('course_id', $courseIds)->pluck('id');
        $lessonIds = Lesson::whereIn('unit_id', $unitIds)->pluck('id')->toArray();
        $lessonIdsStr = array_map('strval', $lessonIds);
        
        // Base query for teacher revenue
        $baseQuery = WalletTransaction::where('type', 'purchase')
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
            });
            
        // Base query for teacher refunds
        $refundBaseQuery = WalletTransaction::where('type', 'refund')
            ->where(function($q) use ($courseIdsStr, $packageIdsStr) {
                $q->where(function($sq) use ($courseIdsStr) {
                    $sq->where('description', 'like', '%إرجاع قيمة كورس%')
                       ->whereIn('reference_id', $courseIdsStr);
                })->orWhere(function($sq) use ($packageIdsStr) {
                    $sq->where('description', 'like', '%إرجاع قيمة باقة%')
                       ->whereIn('reference_id', $packageIdsStr);
                });
            });

        // Calculate Revenue Summary (Total, Today, Month, Year) - net sales
        $grossTotal = (float) (clone $baseQuery)->sum('amount');
        $refundTotal = (float) (clone $refundBaseQuery)->sum('amount');
        $netTotal = $grossTotal - $refundTotal;

        $grossToday = (float) (clone $baseQuery)->whereDate('created_at', Carbon::today())->sum('amount');
        $refundToday = (float) (clone $refundBaseQuery)->whereDate('created_at', Carbon::today())->sum('amount');
        $netToday = $grossToday - $refundToday;

        $grossThisMonth = (float) (clone $baseQuery)->whereYear('created_at', Carbon::now()->year)->whereMonth('created_at', Carbon::now()->month)->sum('amount');
        $refundThisMonth = (float) (clone $refundBaseQuery)->whereYear('created_at', Carbon::now()->year)->whereMonth('created_at', Carbon::now()->month)->sum('amount');
        $netThisMonth = $grossThisMonth - $refundThisMonth;

        $grossThisYear = (float) (clone $baseQuery)->whereYear('created_at', Carbon::now()->year)->sum('amount');
        $refundThisYear = (float) (clone $refundBaseQuery)->whereYear('created_at', Carbon::now()->year)->sum('amount');
        $netThisYear = $grossThisYear - $refundThisYear;

        $totalRevenue = $netTotal;
        $revenueToday = $netToday;
        $revenueThisMonth = $netThisMonth;
        $revenueThisYear = $netThisYear;
        
        // Query for filtered transactions (including both purchases and refunds for netting)
        $filteredQuery = WalletTransaction::with('wallet.student')
            ->whereIn('type', ['purchase', 'refund'])
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
            });
            
        // Apply filters
        $filter = $request->input('filter');
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
        
        $transactions = $filteredQuery->orderBy('created_at', 'desc')->get();

        // Map refunds for fast checks in PHP
        $refundedKeys = [];
        foreach ($transactions as $tx) {
            if ($tx->type === 'refund') {
                $refId = $tx->reference_id;
                $itemType = str_contains($tx->description, 'باقة') ? 'bundle' : 'course';
                $refundedKeys[$tx->wallet_id][$refId][$itemType] = true;
            }
        }
        
        // Maps for fast lookups
        $packagesMap = Package::whereIn('id', $packageIds)->pluck('title', 'id')->toArray();
        $lessonsMap = Lesson::whereIn('id', $lessonIds)->pluck('title', 'id')->toArray();
        $coursesMap = Course::whereIn('id', $courseIds)->pluck('title', 'id')->toArray();
        
        $breakdown = [];
        $ledger = [];
        $bundleDetails = [];
        $lessonDetails = [];
        
        foreach ($transactions as $tx) {
            if ($tx->type !== 'purchase') {
                continue;
            }
            
            $refId = (int)$tx->reference_id;
            $desc = $tx->description;
            $itemType = (str_contains($desc, 'شراء باقة') || str_contains($desc, 'باقة:')) ? 'bundle' : 'course';

            // Filter out refunded purchases
            if (isset($refundedKeys[$tx->wallet_id][$refId][$itemType])) {
                continue;
            }

            $studentName = $tx->wallet && $tx->wallet->student ? $tx->wallet->student->name : 'طالب محذوف';
            
            $purchaseType = 'Other';
            $itemName = $desc;
            
            if (str_contains($desc, 'شراء كورس') || str_contains($desc, 'كورس:')) {
                $purchaseType = 'Course';
                $itemName = $coursesMap[$refId] ?? 'كورس محذوف';
            } elseif (str_contains($desc, 'شراء باقة') || str_contains($desc, 'باقة شهرية') || str_contains($desc, 'باقة:')) {
                $purchaseType = 'Bundle';
                $itemName = $packagesMap[$refId] ?? 'باقة محذوفة';
                
                if (!isset($bundleDetails[$refId])) {
                    $bundleDetails[$refId] = [
                        'bundle_name' => $itemName,
                        'purchases' => []
                    ];
                }
                $bundleDetails[$refId]['purchases'][] = [
                    'student_name' => $studentName,
                    'amount_paid' => (float)$tx->amount,
                    'purchase_date' => $tx->created_at->toDateTimeString(),
                ];
            } elseif (str_contains($desc, 'شراء محاضرة') || str_contains($desc, 'محاضرة:') || str_contains($desc, 'شراء درس') || str_contains($desc, 'درس:')) {
                $purchaseType = 'Lesson';
                $itemName = $lessonsMap[$refId] ?? 'محاضرة محذوفة';
                
                if (!isset($lessonDetails[$refId])) {
                    $lessonDetails[$refId] = [
                        'lesson_name' => $itemName,
                        'purchases' => []
                    ];
                }
                $lessonDetails[$refId]['purchases'][] = [
                    'student_name' => $studentName,
                    'amount_paid' => (float)$tx->amount,
                    'purchase_date' => $tx->created_at->toDateTimeString(),
                ];
            }
            
            $paymentSource = 'المحفظة';
            if (str_contains($desc, 'استخدام كود') || str_contains($desc, 'بواسطة كود')) {
                $paymentSource = 'كود شحن كورس';
            }
            
            $breakdown[] = [
                'student_name' => $studentName,
                'purchase_type' => $purchaseType,
                'item_name' => $itemName,
                'amount_paid' => (float)$tx->amount,
                'purchase_date' => $tx->created_at->toDateTimeString(),
                'payment_source' => $paymentSource
            ];
            
            $ledger[] = [
                'transaction_id' => 'TX-' . str_pad($tx->id, 6, '0', STR_PAD_LEFT),
                'student_name' => $studentName,
                'type' => $purchaseType,
                'item_name' => $itemName,
                'amount' => (float)$tx->amount,
                'date' => $tx->created_at->toDateTimeString(),
                'status' => 'مكتمل'
            ];
        }
        
        return response()->json([
            'summary' => [
                'total_revenue' => $totalRevenue,
                'revenue_today' => $revenueToday,
                'revenue_this_month' => $revenueThisMonth,
                'revenue_this_year' => $revenueThisYear,
                'gross_revenue' => $grossTotal,
                'refunded_revenue' => $refundTotal,
                'net_revenue' => $netTotal,
            ],
            'breakdown' => $breakdown,
            'bundle_details' => array_values($bundleDetails),
            'lesson_details' => array_values($lessonDetails),
            'ledger' => $ledger
        ]);
    }

    /**
     * Get a single exam with questions.
     */
    public function getExam(Request $request, $examId)
    {
        $exam = Exam::with(['questions', 'lesson.unit'])->findOrFail($examId);
        $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);
        return response()->json($exam);
    }

    /**
     * Update an exam and its questions.
     */
    public function updateExam(Request $request, $examId)
    {
        $exam = Exam::with('lesson.unit')->findOrFail($examId);
        $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);

        $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|string|in:quiz,homework,monthly_exam',
            'homework_type' => 'nullable|string|in:normal,bubble_sheet',
            'time_limit_minutes' => 'nullable|integer',
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
            'questions' => 'required|array|min:1',
            'questions.*.text' => 'required|string',
            'questions.*.type' => 'required|string|in:mcq,true_false,essay',
            'questions.*.options' => 'nullable|array',
            'questions.*.correct_answer' => 'nullable|string',
            'questions.*.score' => 'required|integer|min:1',
            'lesson_id' => 'required|exists:lessons,id',
        ]);

        return DB::transaction(function () use ($request, $exam) {
            $exam->update([
                'lesson_id' => $request->lesson_id,
                'title' => $request->title,
                'type' => $request->type,
                'homework_type' => $request->homework_type ?? 'normal',
                'time_limit_minutes' => $request->time_limit_minutes,
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
            ]);

            // Sync questions
            $exam->questions()->delete();

            foreach ($request->questions as $qData) {
                Question::create([
                    'exam_id' => $exam->id,
                    'text' => $qData['text'],
                    'type' => $qData['type'],
                    'options' => $qData['options'] ?? null,
                    'correct_answer' => $qData['correct_answer'] ?? null,
                    'score' => $qData['score'],
                ]);
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
        $this->verifyCourseTeacher($request, $exam->lesson->unit->course_id);

        $exam->delete();
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
        $childIds = array_filter($request->child_ids, function($id) use ($courseId) {
            return (int)$id !== (int)$courseId;
        });

        // Validate that all linked courses belong to the same grade
        if (!empty($childIds)) {
            $childCourses = \App\Models\Course::whereIn('id', $childIds)->get();
            $grades = $childCourses->pluck('grade')->unique()->filter();
            if ($grades->count() > 1) {
                return response()->json([
                    'message' => 'لا يمكن إنشاء كورس مجمع من كورسات تنتمي إلى مراحل دراسية مختلفة.'
                ], 422);
            }
            if ($grades->count() === 1) {
                $course->grade = $grades->first();
                $course->save();
            }
        }

        $course->childCourses()->sync($childIds);

        return response()->json($course->load('childCourses'));
    }
}

