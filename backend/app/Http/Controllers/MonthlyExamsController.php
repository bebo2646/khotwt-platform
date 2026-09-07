<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use App\Models\Exam;
use App\Models\Question;
use App\Models\StudentExam;
use App\Models\StudentAnswer;
use App\Models\ExamPurchase;
use App\Models\ExamViolation;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\PlatformEarning;
use App\Models\TeacherEarning;
use App\Services\StudentActivityService;

class MonthlyExamsController extends Controller
{
    /**
     * Public / Student: List all published & active standalone monthly exams.
     */
    public function index(Request $request)
    {
        $stage = $request->input('stage');
        $grade = $request->input('grade');
        $subject = $request->input('subject');
        $month = $request->input('month');
        $teacherId = $request->input('teacher_id');

        $query = Exam::where('type', 'monthly_exam')
            ->where('is_published', true)
            ->where('is_active', true)
            ->with([
                'teacher:id,name,avatar,subject,bio',
            ])
            ->withCount('questions');

        if ($stage) {
            $query->where('stage', $stage);
        }
        if ($grade) {
            $query->where('grade', $grade);
        }
        if ($subject) {
            $query->where('subject', $subject);
        }
        if ($month) {
            $query->where('month', $month);
        }
        if ($teacherId) {
            $query->where('teacher_id', $teacherId);
        }

        $exams = $query->latest()->get();

        // If authenticated as student, check purchase and attempt status
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->role === 'student') {
            $purchasedExamIds = ExamPurchase::where('student_id', $user->id)
                ->pluck('exam_id')
                ->flip()
                ->toArray();

            $attempts = StudentExam::where('student_id', $user->id)
                ->whereIn('exam_id', $exams->pluck('id'))
                ->get()
                ->groupBy('exam_id');

            $exams->transform(function ($exam) use ($purchasedExamIds, $attempts, $user) {
                $isPurchased = isset($purchasedExamIds[$exam->id]) || !$exam->is_paid || (float)$exam->price <= 0;
                $examAttempts = $attempts->get($exam->id, collect());
                $latestAttempt = $examAttempts->sortByDesc('created_at')->first();

                $exam->is_purchased = $isPurchased;
                $exam->attempts_count = $examAttempts->count();
                $exam->latest_attempt = $latestAttempt ? [
                    'id' => $latestAttempt->id,
                    'status' => $latestAttempt->status,
                    'score' => $latestAttempt->score,
                    'submitted_at' => $latestAttempt->submitted_at,
                    'is_terminated_for_cheating' => $latestAttempt->isTerminatedForCheating(),
                ] : null;

                return $exam;
            });
        }

        return response()->json($exams);
    }

    /**
     * Public / Student: Get details of a single monthly exam.
     */
    public function show($id, Request $request)
    {
        $exam = Exam::where('type', 'monthly_exam')
            ->with([
                'teacher:id,name,avatar,subject,bio,experience',
            ])
            ->withCount('questions')
            ->findOrFail($id);

        $user = Auth::guard('sanctum')->user();
        if ($user && $user->role === 'student') {
            $isPurchased = ExamPurchase::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->exists() || !$exam->is_paid || (float)$exam->price <= 0;

            $exam->is_purchased = $isPurchased;

            $latestAttempt = StudentExam::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->latest()
                ->first();

            $exam->latest_attempt = $latestAttempt;
        }

        return response()->json($exam);
    }

    /**
     * Student: Purchase a standalone monthly exam using wallet balance.
     */
    public function purchase(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'student') {
            return response()->json(['message' => 'غير مصرح للطلاب فقط.'], 403);
        }

        $exam = Exam::with('teacher')->findOrFail($id);

        if ($exam->type !== 'monthly_exam') {
            return response()->json(['message' => 'هذا الامتحان ليس امتحاناً شهرياً مستقلاً.'], 422);
        }

        if (!$exam->is_paid || (float)$exam->price <= 0) {
            return response()->json(['message' => 'هذا الامتحان مجاني ولا يتطلب شراء.'], 422);
        }

        $alreadyPurchased = ExamPurchase::where('student_id', $user->id)
            ->where('exam_id', $exam->id)
            ->exists();

        if ($alreadyPurchased) {
            return response()->json(['message' => 'لقد قمت بشراء هذا الامتحان بالفعل.'], 422);
        }

        $wallet = Wallet::firstOrCreate(
            ['student_id' => $user->id],
            ['balance' => 0]
        );

        if ((float)$wallet->balance < (float)$exam->price) {
            return response()->json([
                'message' => 'رصيد المحفظة غير كافٍ. يرجى شحن المحفظة أولاً.',
                'required_amount' => $exam->price,
                'current_balance' => $wallet->balance,
            ], 422);
        }

        return DB::transaction(function () use ($exam, $user, $wallet) {
            // Deduct from student wallet
            $wallet->balance = (float)$wallet->balance - (float)$exam->price;
            $wallet->save();

            // Record wallet transaction
            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'type' => 'purchase',
                'amount' => $exam->price,
                'description' => 'شراء امتحان شهري: ' . $exam->title,
                'reference_id' => $exam->id,
            ]);

            // Create purchase record
            ExamPurchase::create([
                'student_id' => $user->id,
                'exam_id' => $exam->id,
                'purchased_at' => Carbon::now(),
            ]);

            // Log purchase audit activity
            StudentActivityService::logPurchase(
                $user,
                'exam',
                $exam,
                (float)$exam->price,
                'wallet',
                [
                    'exam_id' => $exam->id,
                    'exam_title' => $exam->title,
                    'paid_amount' => (float)$exam->price,
                    'balance_after' => (float)$wallet->balance,
                ]
            );

            // Teacher revenue split if teacher assigned
            if ($exam->teacher_id && (float)$exam->price > 0) {
                $teacherPercentage = 0.80; // 80% to teacher, 20% platform
                $teacherShare = round((float)$exam->price * $teacherPercentage, 2);
                $platformShare = round((float)$exam->price - $teacherShare, 2);

                TeacherEarning::create([
                    'teacher_id' => $exam->teacher_id,
                    'student_id' => $user->id,
                    'exam_id' => $exam->id,
                    'amount' => $teacherShare,
                    'source' => 'monthly_exam',
                    'description' => 'شراء امتحان شهري: ' . $exam->title,
                ]);

                PlatformEarning::create([
                    'teacher_id' => $exam->teacher_id,
                    'student_id' => $user->id,
                    'exam_id' => $exam->id,
                    'amount' => $platformShare,
                    'source' => 'monthly_exam',
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم شراء الامتحان الشهري بنجاح.',
                'balance' => $wallet->balance,
                'exam_id' => $exam->id,
            ]);
        });
    }

    /**
     * Student: Start a monthly exam attempt (with clean question/option randomization & no correct answers sent).
     */
    public function start(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'student') {
            return response()->json(['message' => 'غير مصرح للطلاب فقط.'], 403);
        }

        $exam = Exam::with(['questions'])->findOrFail($id);

        if (!$exam->is_active || !$exam->is_published) {
            return response()->json(['message' => 'هذا الامتحان غير متاح حالياً.'], 403);
        }

        // Verify purchase if paid
        if ($exam->is_paid && (float)$exam->price > 0) {
            $hasPurchased = ExamPurchase::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->exists();

            if (!$hasPurchased) {
                return response()->json(['message' => 'يجب شراء هذا الامتحان أولاً للبدء.'], 403);
            }
        }

        // Check for existing attempt
        $existingAttempt = StudentExam::where('student_id', $user->id)
            ->where('exam_id', $exam->id)
            ->latest()
            ->first();

        if ($existingAttempt) {
            // If terminated for cheating, student cannot restart
            if ($existingAttempt->isTerminatedForCheating()) {
                return response()->json([
                    'message' => 'تم حرمانك من هذا الامتحان بسبب مخالفات نظام المراقبة.',
                    'terminated' => true,
                    'attempt_id' => $existingAttempt->id,
                ], 403);
            }

            // If still started and not expired, resume active attempt
            if ($existingAttempt->status === 'started') {
                $now = Carbon::now();
                if (!$existingAttempt->expires_at) {
                    $existingAttempt->expires_at = Carbon::parse($existingAttempt->started_at ?? $now)
                        ->addMinutes($existingAttempt->duration_minutes ?: ($exam->time_limit_minutes ?: 60));
                    $existingAttempt->save();
                }

                if ($now->gt($existingAttempt->expires_at)) {
                    // Auto-submit expired attempt
                    $this->finalizeExpiredAttempt($existingAttempt);
                } else {
                    return $this->buildActiveAttemptResponse($exam, $existingAttempt);
                }
            }

            // Check max attempts
            $submittedAttemptsCount = StudentExam::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->whereIn('status', ['submitted', 'graded'])
                ->count();

            $maxAttempts = $exam->max_attempts ?: 1;
            if ($submittedAttemptsCount >= $maxAttempts) {
                return response()->json([
                    'message' => 'لقد استنفدت الحد الأقصى للمحاولات المسموح بها لهذا الامتحان.',
                    'attempt_id' => $existingAttempt->id,
                ], 403);
            }
        }

        // Start new attempt
        $durationMinutes = $exam->time_limit_minutes ?: 60;
        $startedAt = Carbon::now();
        $expiresAt = (clone $startedAt)->addMinutes($durationMinutes);

        // Prepare question order & randomization
        $questions = $exam->questions;
        if ($questions->isEmpty()) {
            return response()->json(['message' => 'لا توجد أسئلة مضافة لهذا الامتحان بعد.'], 422);
        }

        $questionIds = $questions->pluck('id')->toArray();
        if ($exam->randomize_questions) {
            shuffle($questionIds);
        }

        if ($exam->use_question_bank && $exam->questions_per_attempt && $exam->questions_per_attempt < count($questionIds)) {
            $questionIds = array_slice($questionIds, 0, $exam->questions_per_attempt);
        }

        $shuffleMapping = [
            'question_order' => $questionIds,
            'options_mapping' => [],
        ];

        // Option randomization
        foreach ($questions as $q) {
            if ($exam->randomize_options && !empty($q->options) && is_array($q->options)) {
                $shuffled = $q->options;
                shuffle($shuffled);
                $shuffleMapping['options_mapping'][$q->id] = $shuffled;
            }
        }

        $studentExam = StudentExam::create([
            'student_id' => $user->id,
            'exam_id' => $exam->id,
            'status' => 'started',
            'started_at' => $startedAt,
            'expires_at' => $expiresAt,
            'duration_minutes' => $durationMinutes,
            'shuffle_mapping' => $shuffleMapping,
            'cheat_violations_count' => 0,
            'violation_count' => 0,
        ]);

        return $this->buildActiveAttemptResponse($exam, $studentExam);
    }

    /**
     * Build the secure active attempt response without correct answers or explanations.
     */
    private function buildActiveAttemptResponse(Exam $exam, StudentExam $studentExam)
    {
        $shuffleMapping = $studentExam->shuffle_mapping ?? [];
        $questionOrder = $shuffleMapping['question_order'] ?? $exam->questions->pluck('id')->toArray();
        $optionsMapping = $shuffleMapping['options_mapping'] ?? [];

        $allQuestions = $exam->questions->keyBy('id');
        $orderedQuestions = collect();

        foreach ($questionOrder as $qId) {
            if (isset($allQuestions[$qId])) {
                $q = clone $allQuestions[$qId];
                // Apply shuffled options if present
                if (isset($optionsMapping[$qId])) {
                    $q->options = $optionsMapping[$qId];
                }
                // SECURITY: Strip correct_answer and explanation
                unset($q->correct_answer);
                unset($q->explanation);
                $orderedQuestions->push($q);
            }
        }

        // Get saved student draft answers if any
        $savedAnswers = StudentAnswer::where('student_exam_id', $studentExam->id)
            ->get()
            ->keyBy('question_id');

        $serverNow = Carbon::now();
        if (!$studentExam->expires_at) {
            $studentExam->expires_at = Carbon::parse($studentExam->started_at ?? $serverNow)
                ->addMinutes($studentExam->duration_minutes ?: ($exam->time_limit_minutes ?: 60));
            $studentExam->save();
        }

        $timeRemainingSeconds = max(0, (int) $serverNow->diffInSeconds($studentExam->expires_at, false));
        if ($serverNow->gt($studentExam->expires_at)) {
            $timeRemainingSeconds = 0;
        }

        return response()->json([
            'attempt_id' => $studentExam->id,
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'description' => $exam->description,
                'type' => $exam->type,
                'time_limit_minutes' => $exam->time_limit_minutes,
                'max_score' => $exam->max_score,
                'passing_score' => $exam->passing_score,
                'allowed_violations' => $exam->allowed_violations ?: 3,
                'enable_fullscreen' => (bool)$exam->enable_fullscreen,
                'enable_anti_tab_switching' => (bool)$exam->enable_anti_tab_switching,
                'enable_copy_protection' => (bool)$exam->enable_copy_protection,
            ],
            'started_at' => $studentExam->started_at?->toIso8601String(),
            'expires_at' => $studentExam->expires_at?->toIso8601String(),
            'server_now' => $serverNow->toIso8601String(),
            'time_remaining_seconds' => $timeRemainingSeconds,
            'violations_count' => $studentExam->cheat_violations_count ?: $studentExam->violation_count ?: 0,
            'questions' => $orderedQuestions,
            'saved_answers' => $savedAnswers,
        ]);
    }

    /**
     * Student: Save draft answer during exam.
     */
    public function saveDraft(Request $request, $id)
    {
        $user = $request->user();
        $studentExam = StudentExam::where('student_id', $user->id)
            ->where('exam_id', $id)
            ->latest()
            ->first();

        if (!$studentExam) {
            return response()->json(['message' => 'لم يتم العثور على محاولة لهذا الامتحان.'], 404);
        }

        if ($studentExam->isTerminatedForCheating() || $studentExam->status === 'terminated_for_cheating') {
            return response()->json([
                'message' => 'تم إنهاء الامتحان بسبب مخالفات نظام المراقبة، ولا يمكن حفظ إجابات جديدة.',
                'terminated' => true,
            ], 403);
        }

        if ($studentExam->status !== 'started') {
            return response()->json(['message' => 'لا توجد محاولة نشطة لحفظ الإجابة.'], 400);
        }

        // Validate expiration with 30s grace period for in-flight requests
        if ($studentExam->expires_at && Carbon::now()->gt($studentExam->expires_at->copy()->addSeconds(30))) {
            return response()->json(['message' => 'انتهى الوقت المحدد للامتحان ولا يمكن حفظ إجابات جديدة.'], 422);
        }

        $questionId = $request->input('question_id');
        $answerText = (string)($request->input('answer_text') ?? '');

        if (!$questionId) {
            return response()->json(['message' => 'رقم السؤال مطلوب.'], 422);
        }

        StudentAnswer::updateOrCreate(
            [
                'student_exam_id' => $studentExam->id,
                'question_id' => $questionId,
            ],
            [
                'answer_text' => $answerText,
                'is_correct' => false,
                'score' => 0,
            ]
        );

        $studentExam->last_heartbeat_at = Carbon::now();
        $studentExam->save();

        return response()->json(['success' => true, 'question_id' => $questionId]);
    }

    /**
     * Student: Log anti-cheat violation and terminate if limit reached.
     */
    public function logViolation(Request $request, $id)
    {
        $user = $request->user();
        $studentExam = StudentExam::where('student_id', $user->id)
            ->where('exam_id', $id)
            ->latest()
            ->first();

        if (!$studentExam) {
            return response()->json(['message' => 'لم يتم العثور على محاولة لهذا الامتحان.'], 404);
        }

        $exam = $studentExam->exam;
        $allowedViolations = (int)($exam->allowed_violations ?: 3);

        // If already terminated or submitted, return authoritative state gracefully
        if ($studentExam->status !== 'started') {
            return response()->json([
                'success' => true,
                'already_terminated' => true,
                'violations_count' => $studentExam->cheat_violations_count ?: $studentExam->violation_count ?: 0,
                'allowed_violations' => $allowedViolations,
                'terminated' => true,
                'status' => $studentExam->status,
                'message' => 'تم إنهاء المحاولة مسبقاً بسبب مخالفات المراقبة.',
            ]);
        }

        $violationType = (string)$request->input('violation_type', 'tab_switch');
        $timeRemaining = (int)$request->input('time_remaining_seconds', 0);
        $metadata = $request->input('metadata', []);

        $terminated = false;
        $violationsCount = 0;

        DB::transaction(function () use ($studentExam, $exam, $user, $violationType, $timeRemaining, $metadata, $allowedViolations, $request, &$terminated, &$violationsCount) {
            $lockedAttempt = StudentExam::where('id', $studentExam->id)->lockForUpdate()->first();

            if (!$lockedAttempt || $lockedAttempt->status !== 'started') {
                $terminated = true;
                $violationsCount = $lockedAttempt?->cheat_violations_count ?: 0;
                return;
            }

            // Deduplication window: within 2.5 seconds, do not record duplicate or correlated events
            $lastViolation = ExamViolation::where('student_exam_id', $lockedAttempt->id)
                ->latest()
                ->first();

            $correlatedTypes = ['tab_switch', 'window_blur', 'focus_loss', 'visibility_hidden'];
            $isDuplicate = false;

            if ($lastViolation && abs(Carbon::now()->diffInMilliseconds($lastViolation->created_at)) < 2500) {
                if ($lastViolation->violation_type === $violationType || 
                    (in_array($lastViolation->violation_type, $correlatedTypes) && in_array($violationType, $correlatedTypes))) {
                    $isDuplicate = true;
                }
            }

            if (!$isDuplicate) {
                ExamViolation::create([
                    'student_id' => $user->id,
                    'exam_id' => $exam->id,
                    'student_exam_id' => $lockedAttempt->id,
                    'violation_type' => $violationType,
                    'time_remaining_seconds' => $timeRemaining,
                    'metadata' => $metadata,
                ]);

                $lockedAttempt->cheat_violations_count = ($lockedAttempt->cheat_violations_count ?: 0) + 1;
                $lockedAttempt->violation_count = $lockedAttempt->cheat_violations_count;

                if ($lockedAttempt->cheat_violations_count >= $allowedViolations) {
                    $lockedAttempt->status = 'terminated_for_cheating';
                    $lockedAttempt->terminated_for_cheating_at = Carbon::now();
                    $lockedAttempt->submission_reason = 'cheat_violations_limit_exceeded';
                    $lockedAttempt->auto_submitted = true;
                    $lockedAttempt->submitted_at = Carbon::now();
                    $lockedAttempt->score = 0;
                    $terminated = true;

                    // Log activity event for cheating termination
                    StudentActivityService::logExamEvent(
                        $user,
                        $exam,
                        'submitted',
                        $lockedAttempt,
                        ['reason' => 'cheat_violations_limit_exceeded', 'score' => 0],
                        $request
                    );
                }

                $lockedAttempt->save();
            } else {
                if ($lockedAttempt->cheat_violations_count >= $allowedViolations) {
                    $terminated = true;
                }
            }

            $violationsCount = $lockedAttempt->cheat_violations_count;
        });

        return response()->json([
            'success' => true,
            'violations_count' => $violationsCount,
            'allowed_violations' => $allowedViolations,
            'terminated' => $terminated,
            'status' => $terminated ? 'terminated_for_cheating' : 'started',
            'message' => $terminated ? 'تم إنهاء الامتحان تلقائياً بسبب تجاوز حد المخالفات.' : null,
        ]);
    }

    /**
     * Student: Submit exam attempt.
     */
    public function submit(Request $request, $id)
    {
        $user = $request->user();
        $studentExam = StudentExam::with('exam.questions')
            ->where('student_id', $user->id)
            ->where('exam_id', $id)
            ->latest()
            ->first();

        if (!$studentExam) {
            return response()->json(['message' => 'لم يتم العثور على محاولة لهذا الامتحان.'], 404);
        }

        $exam = $studentExam->exam;

        // Idempotency: if already submitted or terminated, return existing result gracefully without error
        if ($studentExam->status !== 'started') {
            $isTerminated = $studentExam->status === 'terminated_for_cheating' || $studentExam->isTerminatedForCheating();
            return response()->json([
                'success' => true,
                'already_submitted' => true,
                'terminated' => $isTerminated,
                'message' => $isTerminated ? 'تم إنهاء الامتحان مسبقاً بسبب مخالفات نظام المراقبة.' : 'تم تسليم الامتحان مسبقاً.',
                'attempt_id' => $studentExam->id,
                'score' => $isTerminated ? 0 : $studentExam->score,
                'max_score' => $exam->max_score,
                'status' => $studentExam->status,
                'passed' => $isTerminated ? false : ($studentExam->score >= ($exam->passing_score ?: ($exam->max_score * 0.5))),
            ]);
        }

        // Validate expiration: 30s grace period for in-flight requests
        $isExpired = false;
        if ($studentExam->expires_at && Carbon::now()->gt($studentExam->expires_at->copy()->addSeconds(30))) {
            $isExpired = true;
        }

        $answers = $request->input('answers', []); // [question_id => answer_text]
        if (!is_array($answers)) {
            $answers = [];
        }

        // Fetch pre-saved draft answers to ensure none are lost
        $existingAnswers = StudentAnswer::where('student_exam_id', $studentExam->id)
            ->get()
            ->keyBy('question_id');

        $totalScore = 0;
        $hasPendingEssay = false;

        DB::transaction(function () use ($studentExam, $exam, $answers, $existingAnswers, $isExpired, &$totalScore, &$hasPendingEssay, $user, $request) {
            foreach ($exam->questions as $question) {
                // Check answers submitted in payload, fallback to existing draft in DB, fallback to empty string (NEVER null)
                $submittedAnswer = '';
                if (isset($answers[$question->id]) && $answers[$question->id] !== null) {
                    $submittedAnswer = (string)$answers[$question->id];
                } elseif (isset($existingAnswers[$question->id]) && $existingAnswers[$question->id]->answer_text !== null) {
                    $submittedAnswer = (string)$existingAnswers[$question->id]->answer_text;
                }

                $isCorrect = false;
                $scoreAwarded = 0;

                if ($question->type === 'mcq' || $question->type === 'true_false') {
                    if (trim((string)$submittedAnswer) !== '' && trim((string)$submittedAnswer) === trim((string)$question->correct_answer)) {
                        $isCorrect = true;
                        $scoreAwarded = (int)$question->score;
                        $totalScore += $scoreAwarded;
                    }
                } elseif ($question->type === 'essay') {
                    $hasPendingEssay = true;
                }

                StudentAnswer::updateOrCreate(
                    [
                        'student_exam_id' => $studentExam->id,
                        'question_id' => $question->id,
                    ],
                    [
                        'answer_text' => $submittedAnswer,
                        'is_correct' => $isCorrect,
                        'score' => $scoreAwarded,
                    ]
                );
            }

            $studentExam->submitted_at = Carbon::now();
            $studentExam->status = $hasPendingEssay ? 'submitted' : 'graded';
            $studentExam->score = $totalScore;
            if ($isExpired) {
                $studentExam->auto_submitted = true;
                $studentExam->submission_reason = 'time_expired';
            }
            if (!$hasPendingEssay) {
                $studentExam->graded_at = Carbon::now();
            }
            $studentExam->save();

            StudentActivityService::logExamEvent($user, $exam, 'submitted', $studentExam, ['score' => $studentExam->score], $request);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تسليم الامتحان بنجاح.',
            'attempt_id' => $studentExam->id,
            'score' => $studentExam->score,
            'max_score' => $exam->max_score,
            'status' => $studentExam->status,
            'passed' => $studentExam->score >= ($exam->passing_score ?: ($exam->max_score * 0.5)),
        ]);
    }

    /**
     * Finalize and grade an expired attempt server-side.
     */
    private function finalizeExpiredAttempt(StudentExam $studentExam)
    {
        $exam = $studentExam->exam()->with('questions')->first();
        if (!$exam) {
            $studentExam->status = 'submitted';
            $studentExam->auto_submitted = true;
            $studentExam->submission_reason = 'time_expired';
            $studentExam->submitted_at = $studentExam->expires_at ?: Carbon::now();
            $studentExam->save();
            return;
        }

        $existingAnswers = StudentAnswer::where('student_exam_id', $studentExam->id)
            ->get()
            ->keyBy('question_id');

        $totalScore = 0;
        $hasPendingEssay = false;

        DB::transaction(function () use ($studentExam, $exam, $existingAnswers, &$totalScore, &$hasPendingEssay) {
            foreach ($exam->questions as $question) {
                $submittedAnswer = (string)($existingAnswers[$question->id]->answer_text ?? '');
                $isCorrect = false;
                $scoreAwarded = 0;

                if ($question->type === 'mcq' || $question->type === 'true_false') {
                    if (trim($submittedAnswer) !== '' && trim($submittedAnswer) === trim((string)$question->correct_answer)) {
                        $isCorrect = true;
                        $scoreAwarded = (int)$question->score;
                        $totalScore += $scoreAwarded;
                    }
                } elseif ($question->type === 'essay') {
                    $hasPendingEssay = true;
                }

                StudentAnswer::updateOrCreate(
                    [
                        'student_exam_id' => $studentExam->id,
                        'question_id' => $question->id,
                    ],
                    [
                        'answer_text' => $submittedAnswer,
                        'is_correct' => $isCorrect,
                        'score' => $scoreAwarded,
                    ]
                );
            }

            $studentExam->submitted_at = $studentExam->expires_at ?: Carbon::now();
            $studentExam->status = $hasPendingEssay ? 'submitted' : 'graded';
            $studentExam->score = $totalScore;
            $studentExam->auto_submitted = true;
            $studentExam->submission_reason = 'time_expired';
            if (!$hasPendingEssay) {
                $studentExam->graded_at = Carbon::now();
            }
            $studentExam->save();
        });
    }

    /**
     * Student: View exam results and answer review.
     */
    public function results(Request $request, $id)
    {
        $user = $request->user();
        $attempt = StudentExam::with([
            'exam.teacher:id,name,avatar',
            'exam.questions',
            'answers.question',
        ])
        ->where('student_id', $user->id)
        ->where('exam_id', $id)
        ->latest()
        ->firstOrFail();

        $canView = $attempt->canViewAnswers();

        // If terminated for cheating and not unlocked, hide answers
        if (!$canView) {
            $attempt->exam->questions->makeHidden(['correct_answer', 'explanation']);
            foreach ($attempt->answers as $a) {
                if ($a->question) {
                    $a->question->makeHidden(['correct_answer', 'explanation']);
                }
            }
        }

        return response()->json([
            'attempt' => $attempt,
            'can_view_answers' => $canView,
            'is_terminated_for_cheating' => $attempt->isTerminatedForCheating(),
        ]);
    }

    /**
     * Admin / Teacher: List all monthly exams for management.
     */
    public function adminList(Request $request)
    {
        $user = $request->user();
        $query = Exam::where('type', 'monthly_exam')
            ->with(['teacher:id,name,email', 'course:id,title'])
            ->withCount(['questions', 'attempts', 'purchases']);

        if ($user->role === 'teacher') {
            $query->where('teacher_id', $user->id);
        }

        if ($request->filled('grade')) {
            $query->where('grade', $request->grade);
        }
        if ($request->filled('stage')) {
            $query->where('stage', $request->stage);
        }
        if ($request->filled('month')) {
            $query->where('month', $request->month);
        }
        if ($request->filled('teacher_id') && $user->role === 'admin') {
            $query->where('teacher_id', $request->teacher_id);
        }

        $exams = $query->latest()->get();
        return response()->json($exams);
    }

    /**
     * Admin / Teacher: Show a single monthly exam with questions for editing.
     */
    public function adminShow(Request $request, $id)
    {
        $user = $request->user();
        $query = Exam::where('type', 'monthly_exam')->with(['questions', 'teacher']);
        if ($user->role === 'teacher') {
            $query->where('teacher_id', $user->id);
        }
        $exam = $query->findOrFail($id);
        return response()->json($exam);
    }

    /**
     * Admin / Teacher: Create a new standalone monthly exam.
     */
    public function adminStore(Request $request)
    {
        $user = $request->user();
        
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'month' => 'required|string|max:50',
            'stage' => 'nullable|string|max:100',
            'grade' => 'required|string|max:100',
            'subject' => 'required|string|max:100',
            'category' => 'nullable|string|max:100',
            'teacher_id' => 'nullable|exists:users,id',
            'time_limit_minutes' => 'required|integer|min:1|max:300',
            'max_score' => 'required|integer|min:1',
            'passing_score' => 'nullable|integer|min:0',
            'price' => 'required|numeric|min:0',
            'is_paid' => 'nullable|boolean',
            'is_published' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'allowed_violations' => 'nullable|integer|min:1|max:10',
            'enable_fullscreen' => 'nullable|boolean',
            'enable_anti_tab_switching' => 'nullable|boolean',
            'enable_copy_protection' => 'nullable|boolean',
            'randomize_questions' => 'nullable|boolean',
            'randomize_options' => 'nullable|boolean',
            'questions' => 'nullable|array',
            'questions.*.text' => 'required|string',
            'questions.*.type' => 'required|string|in:mcq,true_false,essay',
            'questions.*.options' => 'nullable|array',
            'questions.*.correct_answer' => 'nullable|string',
            'questions.*.score' => 'required|numeric|min:0',
        ]);

        $teacherId = $user->role === 'teacher' ? $user->id : ($validated['teacher_id'] ?? null);
        $isPaid = (float)$validated['price'] > 0;

        return DB::transaction(function () use ($validated, $teacherId, $isPaid, $request, $user) {
            $exam = Exam::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'type' => 'monthly_exam',
                'month' => $validated['month'],
                'stage' => $validated['stage'] ?? null,
                'grade' => $validated['grade'],
                'subject' => $validated['subject'],
                'category' => $validated['category'] ?? 'school',
                'teacher_id' => $teacherId,
                'course_id' => null,
                'lesson_id' => null,
                'time_limit_minutes' => $validated['time_limit_minutes'],
                'max_score' => $validated['max_score'],
                'passing_score' => $validated['passing_score'] ?? (int)($validated['max_score'] * 0.5),
                'price' => $validated['price'],
                'is_paid' => $isPaid,
                'is_published' => $validated['is_published'] ?? true,
                'is_active' => $validated['is_active'] ?? true,
                'allowed_violations' => $validated['allowed_violations'] ?? 3,
                'enable_fullscreen' => $validated['enable_fullscreen'] ?? true,
                'enable_anti_tab_switching' => $validated['enable_anti_tab_switching'] ?? true,
                'enable_copy_protection' => $validated['enable_copy_protection'] ?? true,
                'randomize_questions' => $validated['randomize_questions'] ?? true,
                'randomize_options' => $validated['randomize_options'] ?? true,
                'max_attempts' => 1,
            ]);

            if ($request->has('questions') && is_array($request->questions)) {
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
            }

            if ($user && $user->role === 'teacher') {
                \App\Services\TeacherActivityService::logExamCreated($user, $exam, $request);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء الامتحان الشهري بنجاح.',
                'exam' => $exam->load(['questions', 'teacher']),
            ], 201);
        });
    }

    /**
     * Admin / Teacher: Update a monthly exam.
     */
    public function adminUpdate(Request $request, $id)
    {
        $user = $request->user();
        $query = Exam::where('type', 'monthly_exam');
        if ($user->role === 'teacher') {
            $query->where('teacher_id', $user->id);
        }
        $exam = $query->findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'month' => 'required|string|max:50',
            'stage' => 'nullable|string|max:100',
            'grade' => 'required|string|max:100',
            'subject' => 'required|string|max:100',
            'category' => 'nullable|string|max:100',
            'teacher_id' => 'nullable|exists:users,id',
            'time_limit_minutes' => 'required|integer|min:1|max:300',
            'max_score' => 'required|integer|min:1',
            'passing_score' => 'nullable|integer|min:0',
            'price' => 'required|numeric|min:0',
            'is_paid' => 'nullable|boolean',
            'is_published' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
            'allowed_violations' => 'nullable|integer|min:1|max:10',
            'enable_fullscreen' => 'nullable|boolean',
            'enable_anti_tab_switching' => 'nullable|boolean',
            'enable_copy_protection' => 'nullable|boolean',
            'randomize_questions' => 'nullable|boolean',
            'randomize_options' => 'nullable|boolean',
            'questions' => 'nullable|array',
            'questions.*.text' => 'required|string',
            'questions.*.type' => 'required|string|in:mcq,true_false,essay',
            'questions.*.options' => 'nullable|array',
            'questions.*.correct_answer' => 'nullable|string',
            'questions.*.score' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated, $exam, $user, $request) {
            if ($user->role === 'admin' && isset($validated['teacher_id'])) {
                $exam->teacher_id = $validated['teacher_id'];
            }

            $exam->title = $validated['title'];
            $exam->description = $validated['description'] ?? $exam->description;
            $exam->month = $validated['month'];
            $exam->stage = $validated['stage'] ?? $exam->stage;
            $exam->grade = $validated['grade'];
            $exam->subject = $validated['subject'];
            $exam->category = $validated['category'] ?? $exam->category;
            $exam->time_limit_minutes = $validated['time_limit_minutes'];
            $exam->max_score = $validated['max_score'];
            $exam->passing_score = $validated['passing_score'] ?? $exam->passing_score;
            $exam->price = $validated['price'];
            $exam->is_paid = (float)$validated['price'] > 0;
            $exam->course_id = null;
            $exam->lesson_id = null;
            $exam->type = 'monthly_exam';
            
            if (isset($validated['is_published'])) $exam->is_published = $validated['is_published'];
            if (isset($validated['is_active'])) $exam->is_active = $validated['is_active'];
            if (isset($validated['allowed_violations'])) $exam->allowed_violations = $validated['allowed_violations'];
            if (isset($validated['enable_fullscreen'])) $exam->enable_fullscreen = $validated['enable_fullscreen'];
            if (isset($validated['enable_anti_tab_switching'])) $exam->enable_anti_tab_switching = $validated['enable_anti_tab_switching'];
            if (isset($validated['enable_copy_protection'])) $exam->enable_copy_protection = $validated['enable_copy_protection'];
            if (isset($validated['randomize_questions'])) $exam->randomize_questions = $validated['randomize_questions'];
            if (isset($validated['randomize_options'])) $exam->randomize_options = $validated['randomize_options'];

            $exam->save();

            if ($request->has('questions') && is_array($request->questions)) {
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
            }

            if ($user && $user->role === 'teacher') {
                \App\Services\TeacherActivityService::logExamUpdated($user, $exam, $request);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث الامتحان الشهري بنجاح.',
                'exam' => $exam->load(['questions', 'teacher']),
            ]);
        });
    }

    /**
     * Admin / Teacher: Delete a monthly exam.
     */
    public function adminDestroy(Request $request, $id)
    {
        $user = $request->user();
        $query = Exam::where('type', 'monthly_exam');
        if ($user->role === 'teacher') {
            $query->where('teacher_id', $user->id);
        }
        $exam = $query->findOrFail($id);
        $examTitle = $exam->title;

        $hasAttempts = StudentExam::where('exam_id', $exam->id)->exists();
        if ($hasAttempts) {
            // Soft de-activate instead of hard deleting to preserve student records
            $exam->is_active = false;
            $exam->is_published = false;
            $exam->save();

            if ($user && $user->role === 'teacher') {
                \App\Services\TeacherActivityService::logExamUpdated($user, $exam, $request);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم إخفاء الامتحان وتعطيله لوجود محاولات سابقة للطلاب.',
            ]);
        }

        $exam->questions()->delete();
        $exam->delete();

        if ($user && $user->role === 'teacher') {
            \App\Services\TeacherActivityService::logExamDeleted($user, (int)$id, $examTitle, true, $request);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الامتحان الشهري بنجاح.',
        ]);
    }

    /**
     * Admin / Teacher: Unlock answers review for a cheating-terminated student attempt.
     */
    public function unlockAnswers(Request $request, $attemptId)
    {
        $user = $request->user();
        $attempt = StudentExam::with(['exam', 'student'])->findOrFail($attemptId);

        if ($user->role === 'teacher' && $attempt->exam->teacher_id !== $user->id) {
            return response()->json(['message' => 'غير مصرح لك بتعديل هذا الامتحان.'], 403);
        }

        $attempt->answers_unlocked_at = Carbon::now();
        $attempt->answers_unlocked_by = $user->id;
        $attempt->save();

        if ($user && $user->role === 'teacher' && $attempt->exam && $attempt->student) {
            \App\Services\TeacherActivityService::logExamAnswersUnlocked($user, $attempt->exam, $attempt->student, $request);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم فتح عرض نموذج الإجابات للطالب بنجاح.',
            'attempt' => $attempt,
        ]);
    }
}
