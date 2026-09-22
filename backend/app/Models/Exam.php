<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Exam extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'course_id',
        'teacher_id',
        'title',
        'description',
        'type', // quiz, homework, monthly_exam
        'homework_type', // normal, bubble_sheet
        'stage',
        'grade',
        'subject',
        'category',
        'month',
        'time_limit_minutes',
        'max_score',
        'start_date',
        'start_time',
        'end_date',
        'end_time',
        'max_attempts',
        'passing_score',
        'enable_schedule',
        'open_date',
        'open_time',
        'close_date',
        'close_time',
        'submission_deadline',
        'allowed_violations',
        'auto_submit_on_violation',
        'enable_fullscreen',
        'enable_anti_tab_switching',
        'enable_copy_protection',
        'is_paid',
        'price',
        'is_active',
        'is_published',
        'included_in_course',
        'randomize_questions',
        'randomize_options',
        'use_question_bank',
        'questions_per_attempt',
        'show_result_immediately',
        'show_answers_after_submission',
    ];

    protected $casts = [
        'auto_submit_on_violation' => 'boolean',
        'enable_fullscreen' => 'boolean',
        'enable_anti_tab_switching' => 'boolean',
        'enable_copy_protection' => 'boolean',
        'enable_schedule' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'open_date' => 'date',
        'close_date' => 'date',
        'submission_deadline' => 'datetime',
        'is_paid' => 'boolean',
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'is_published' => 'boolean',
        'included_in_course' => 'boolean',
        'randomize_questions' => 'boolean',
        'randomize_options' => 'boolean',
        'use_question_bank' => 'boolean',
        'show_result_immediately' => 'boolean',
        'show_answers_after_submission' => 'boolean',
    ];

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function questions()
    {
        return $this->hasMany(Question::class);
    }

    public function attempts()
    {
        return $this->hasMany(StudentExam::class);
    }

    public function purchases()
    {
        return $this->hasMany(ExamPurchase::class);
    }

    public function violations()
    {
        return $this->hasMany(ExamViolation::class);
    }

    /**
     * Determine start and end datetime of the exam availability window.
     */
    public function getAvailabilityWindow(): array
    {
        $startsAt = null;
        if ($this->open_date) {
            $dateStr = $this->open_date->format('Y-m-d');
            $timeStr = $this->open_time ?: '00:00:00';
            $startsAt = \Carbon\Carbon::parse($dateStr . ' ' . $timeStr);
        } elseif ($this->start_date) {
            $dateStr = $this->start_date->format('Y-m-d');
            $timeStr = $this->start_time ?: '00:00:00';
            $startsAt = \Carbon\Carbon::parse($dateStr . ' ' . $timeStr);
        }

        $endsAt = null;
        if ($this->close_date) {
            $dateStr = $this->close_date->format('Y-m-d');
            $timeStr = $this->close_time ?: '23:59:59';
            $endsAt = \Carbon\Carbon::parse($dateStr . ' ' . $timeStr);
        } elseif ($this->end_date) {
            $dateStr = $this->end_date->format('Y-m-d');
            $timeStr = $this->end_time ?: '23:59:59';
            $endsAt = \Carbon\Carbon::parse($dateStr . ' ' . $timeStr);
        } elseif ($this->submission_deadline) {
            $endsAt = \Carbon\Carbon::parse($this->submission_deadline);
        }

        return [
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'has_schedule' => (bool)($this->enable_schedule || $startsAt || $endsAt),
        ];
    }

    /**
     * Calculate server-authoritative effective timing for an exam attempt:
     * - effective_duration = MIN(configured_duration, remaining_time_until_availability_end)
     * - expires_at = MIN(started_at + configured_duration, availability_end_at)
     *
     * @param \Carbon\Carbon $startedAt
     * @param int|null $configuredDurationMinutes
     * @return array
     */
    public function calculateEffectiveTiming(\Carbon\Carbon $startedAt, ?int $configuredDurationMinutes = null): array
    {
        $window = $this->getAvailabilityWindow();
        $endsAt = $window['ends_at'] ? $window['ends_at']->copy() : null;

        $durationMinutes = $configuredDurationMinutes !== null ? $configuredDurationMinutes : ($this->time_limit_minutes ?: null);
        $nominalExpiresAt = $durationMinutes ? $startedAt->copy()->addMinutes($durationMinutes) : null;

        $expiresAt = null;
        if ($nominalExpiresAt && $endsAt) {
            $expiresAt = $nominalExpiresAt->gt($endsAt) ? $endsAt : $nominalExpiresAt;
        } elseif ($nominalExpiresAt) {
            $expiresAt = $nominalExpiresAt;
        } elseif ($endsAt) {
            $expiresAt = $endsAt;
        }

        $durationSeconds = $durationMinutes ? $durationMinutes * 60 : null;
        $effectiveDurationSeconds = null;
        $effectiveDurationMinutes = null;

        if ($expiresAt) {
            $effectiveDurationSeconds = (int) max(0, $startedAt->diffInSeconds($expiresAt, false));
            $effectiveDurationMinutes = $effectiveDurationSeconds > 0 ? (int) max(1, (int) ceil($effectiveDurationSeconds / 60)) : 0;
        } elseif ($durationMinutes) {
            $effectiveDurationSeconds = $durationSeconds;
            $effectiveDurationMinutes = $durationMinutes;
        }

        return [
            'started_at' => $startedAt,
            'availability_end_at' => $endsAt,
            'nominal_expires_at' => $nominalExpiresAt,
            'expires_at' => $expiresAt,
            'duration_minutes' => $durationMinutes,
            'duration_seconds' => $durationSeconds,
            'effective_duration_seconds' => $effectiveDurationSeconds,
            'effective_duration_minutes' => $effectiveDurationMinutes,
            'is_capped_by_deadline' => ($nominalExpiresAt && $endsAt && $nominalExpiresAt->gt($endsAt)),
        ];
    }

    /**
     * Check if the exam is currently available to START by a student.
     * NOW < starts_at -> not_started
     * starts_at <= NOW <= ends_at -> available
     * NOW > ends_at -> expired
     */
    public function getAvailabilityStatus(): array
    {
        $window = $this->getAvailabilityWindow();
        $startsAt = $window['starts_at'];
        $endsAt = $window['ends_at'];
        $hasSchedule = $window['has_schedule'];

        if (!$hasSchedule) {
            return [
                'is_available' => true,
                'status' => 'available',
                'starts_at' => null,
                'ends_at' => null,
                'message' => 'الامتحان متاح حالياً للبدء.',
                'formatted_dates' => null,
            ];
        }

        $now = \Carbon\Carbon::now();
        $formattedDates = $this->formatAvailabilityRange($startsAt, $endsAt);

        if ($startsAt && $now->lt($startsAt)) {
            return [
                'is_available' => false,
                'status' => 'not_started',
                'error_code' => 'SCHEDULE_NOT_STARTED',
                'starts_at' => $startsAt->toIso8601String(),
                'ends_at' => $endsAt ? $endsAt->toIso8601String() : null,
                'open_datetime' => $startsAt->toIso8601String(),
                'countdown_seconds' => $now->diffInSeconds($startsAt),
                'message' => 'هذا الامتحان غير متاح بعد.',
                'formatted_dates' => $formattedDates,
            ];
        }

        if ($endsAt && $now->gt($endsAt)) {
            return [
                'is_available' => false,
                'status' => 'expired',
                'error_code' => 'SCHEDULE_EXPIRED',
                'starts_at' => $startsAt ? $startsAt->toIso8601String() : null,
                'ends_at' => $endsAt->toIso8601String(),
                'close_datetime' => $endsAt->toIso8601String(),
                'countdown_seconds' => 0,
                'message' => 'انتهت مدة إتاحة الامتحان.',
                'formatted_dates' => $formattedDates,
            ];
        }

        return [
            'is_available' => true,
            'status' => 'available',
            'starts_at' => $startsAt ? $startsAt->toIso8601String() : null,
            'ends_at' => $endsAt ? $endsAt->toIso8601String() : null,
            'message' => 'الامتحان متاح حالياً للبدء.',
            'formatted_dates' => $formattedDates,
        ];
    }

    /**
     * Format availability date range into a readable Arabic phrase.
     */
    public function formatAvailabilityRange(?\Carbon\Carbon $startsAt, ?\Carbon\Carbon $endsAt): ?string
    {
        if (!$startsAt && !$endsAt) {
            return null;
        }

        $arabicMonths = [
            1 => 'يناير', 2 => 'فبراير', 3 => 'مارس', 4 => 'أبريل',
            5 => 'مايو', 6 => 'يونيو', 7 => 'يوليو', 8 => 'أغسطس',
            9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر'
        ];

        $formatDate = function (\Carbon\Carbon $date) use ($arabicMonths) {
            $day = $date->day;
            $month = $arabicMonths[$date->month] ?? $date->format('m');
            return "{$day} {$month}";
        };

        if ($startsAt && $endsAt) {
            return "متاح من {$formatDate($startsAt)} إلى {$formatDate($endsAt)}";
        } elseif ($startsAt) {
            return "متاح بدءاً من {$formatDate($startsAt)}";
        } else {
            return "متاح حتى {$formatDate($endsAt)}";
        }
    }
}
