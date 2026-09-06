<?php

namespace App\Services;

use App\Models\SecurityEvent;
use App\Models\IpSecurityBlock;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class SecurityMonitoringService
{
    public const MAX_FAILED_LOGIN_ATTEMPTS = 5;
    public const BLOCK_DURATION_MINUTES = 30;

    /**
     * Keys that must be stripped from any logged metadata.
     */
    protected const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'token',
        'access_token',
        'refresh_token',
        'secret',
        'api_key',
        'authorization',
        'credit_card',
        'card_number',
        'cvv',
        'cvc',
        'pin',
        'cookie',
        'cookies',
        'auth_token',
        'bearer',
    ];

    /**
     * Assign or retrieve Request Correlation ID.
     */
    public static function assignRequestId(Request $request): string
    {
        $existing = $request->attributes->get('request_id');
        if ($existing) {
            return $existing;
        }

        $incoming = $request->header('X-Request-ID') ?: $request->header('X-Correlation-ID');
        if ($incoming && is_string($incoming) && strlen($incoming) <= 64 && preg_match('/^[a-zA-Z0-9_\-]+$/', $incoming)) {
            $requestId = $incoming;
        } else {
            $requestId = 'req_' . (string) Str::uuid();
        }

        $request->attributes->set('request_id', $requestId);
        return $requestId;
    }

    /**
     * Get the assigned correlation ID from the request.
     */
    public static function getRequestId(Request $request): ?string
    {
        return $request->attributes->get('request_id');
    }

    /**
     * Sanitize metadata array to ensure no credentials or secrets are logged.
     */
    public static function sanitizeMetadata(?array $data): array
    {
        if (empty($data)) {
            return [];
        }

        $clean = [];
        foreach ($data as $k => $v) {
            $lowerKey = strtolower((string) $k);
            $isSensitive = false;
            foreach (self::SENSITIVE_KEYS as $sensitive) {
                if (str_contains($lowerKey, $sensitive)) {
                    $isSensitive = true;
                    break;
                }
            }

            if ($isSensitive) {
                $clean[$k] = '[REDACTED]';
            } elseif (is_array($v)) {
                $clean[$k] = self::sanitizeMetadata($v);
            } elseif (is_scalar($v) || is_null($v)) {
                $clean[$k] = $v;
            } else {
                $clean[$k] = (string) $v;
            }
        }

        return $clean;
    }

    /**
     * Centralized bulletproof event recorder. Never throws or disrupts caller.
     */
    public static function recordEvent(
        string $eventType,
        string $severity,
        Request $request,
        int $statusCode,
        ?string $resourceType = null,
        $resourceId = null,
        ?array $metadata = null,
        ?int $userId = null
    ): ?SecurityEvent {
        try {
            $dedupKey = "sec_logged:{$eventType}:{$statusCode}";
            if ($request->attributes->get($dedupKey)) {
                return null;
            }
            $request->attributes->set($dedupKey, true);

            $ip = $request->ip() ?: '127.0.0.1';
            $method = substr($request->method(), 0, 10);
            $path = substr($request->path(), 0, 500);
            $userAgent = $request->userAgent();
            $requestId = self::assignRequestId($request);

            $resolvedUserId = $userId;
            if (!$resolvedUserId && $request->user()) {
                $resolvedUserId = $request->user()->id;
            }

            $sessionIdentifier = null;
            if ($request->user() && isset($request->user()->current_session_token)) {
                $sessionIdentifier = $request->user()->current_session_token;
            } elseif ($request->header('X-Session-Token')) {
                $sessionIdentifier = $request->header('X-Session-Token');
            }

            // Frequency analysis: if repeated events from same IP within 5 minutes, escalate severity
            $calculatedSeverity = self::evaluateSeverityEscalation($ip, $severity);

            $sanitizedMeta = self::sanitizeMetadata($metadata);

            return SecurityEvent::create([
                'user_id' => $resolvedUserId,
                'event_type' => $eventType,
                'severity' => $calculatedSeverity,
                'ip_address' => $ip,
                'user_agent' => $userAgent,
                'method' => $method,
                'path' => $path,
                'status_code' => $statusCode,
                'request_id' => $requestId,
                'session_identifier' => $sessionIdentifier,
                'resource_type' => $resourceType,
                'resource_id' => is_numeric($resourceId) ? (int)$resourceId : null,
                'metadata' => !empty($sanitizedMeta) ? $sanitizedMeta : null,
                'occurred_at' => Carbon::now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('SecurityMonitoringService::recordEvent failed to write to database: ' . $e->getMessage(), [
                'event_type' => $eventType,
                'ip' => $request->ip(),
            ]);
            return null;
        }
    }

    /**
     * Check if client IP is currently blocked by brute force protection.
     * Returns a 429 JsonResponse if blocked, or null if allowed to proceed.
     */
    public static function checkLoginBruteForce(Request $request, ?string $rawIdentifier = null): ?JsonResponse
    {
        try {
            $ip = $request->ip() ?: '127.0.0.1';
            $cacheKey = "ip_security_block:{$ip}";

            // 1. Quick check from Cache
            $cachedBlocked = Cache::get($cacheKey);
            if ($cachedBlocked === true) {
                // Fetch record to know exact remaining minutes
                $blockRecord = IpSecurityBlock::where('ip_address', $ip)->first();
                if ($blockRecord && $blockRecord->isCurrentlyBlocked()) {
                    $remainingMinutes = $blockRecord->remainingBlockedMinutes();

                    // Log suspicious repeated attempt on blocked IP
                    self::recordEvent(
                        'blocked_ip_login_attempt',
                        'high',
                        $request,
                        429,
                        'ip_block',
                        $blockRecord->id,
                        [
                            'ip_address' => $ip,
                            'attempted_identifier' => $rawIdentifier ? substr((string)$rawIdentifier, 0, 100) : null,
                            'remaining_minutes' => $remainingMinutes,
                        ]
                    );

                    return response()->json([
                        'message' => 'تم حظر محاولات تسجيل الدخول من هذا الجهاز لمدة 30 دقيقة بسبب تكرار البيانات غير الصحيحة.',
                        'code' => 'IP_TEMPORARILY_BLOCKED',
                        'blocked' => true,
                        'remaining_minutes' => $remainingMinutes,
                        'blocked_until' => $blockRecord->blocked_until?->toIso8601String(),
                    ], 429);
                } else {
                    // Block expired, remove from cache
                    Cache::forget($cacheKey);
                }
            }

            // 2. Database check
            $block = IpSecurityBlock::where('ip_address', $ip)->first();
            if ($block && $block->is_blocked) {
                if ($block->isCurrentlyBlocked()) {
                    $remainingMinutes = $block->remainingBlockedMinutes();
                    Cache::put($cacheKey, true, max(1, $block->remainingBlockedSeconds()));

                    self::recordEvent(
                        'blocked_ip_login_attempt',
                        'high',
                        $request,
                        429,
                        'ip_block',
                        $block->id,
                        [
                            'ip_address' => $ip,
                            'attempted_identifier' => $rawIdentifier ? substr((string)$rawIdentifier, 0, 100) : null,
                            'remaining_minutes' => $remainingMinutes,
                        ]
                    );

                    return response()->json([
                        'message' => 'تم حظر محاولات تسجيل الدخول من هذا الجهاز لمدة 30 دقيقة بسبب تكرار البيانات غير الصحيحة.',
                        'code' => 'IP_TEMPORARILY_BLOCKED',
                        'blocked' => true,
                        'remaining_minutes' => $remainingMinutes,
                        'blocked_until' => $block->blocked_until?->toIso8601String(),
                    ], 429);
                } else {
                    // Expired block -> reset
                    $block->unblock();
                    Cache::forget($cacheKey);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('SecurityMonitoringService::checkLoginBruteForce error: ' . $e->getMessage());
        }

        return null;
    }

    /**
     * Handle a failed login attempt for the originating IP.
     * Rule: Attempts 1-5 increment counter. Attempt 6 immediately blocks the IP for 30 minutes.
     */
    public static function handleFailedLogin(
        Request $request,
        ?string $identifier = null,
        string $reason = 'بيانات الدخول غير صحيحة'
    ): ?JsonResponse {
        try {
            $ip = $request->ip() ?: '127.0.0.1';
            $now = Carbon::now();

            $block = IpSecurityBlock::firstOrCreate(
                ['ip_address' => $ip],
                [
                    'failed_attempts' => 0,
                    'first_attempt_at' => $now,
                    'is_blocked' => false,
                ]
            );

            // If existing block had expired, reset attempts count
            if ($block->blocked_until && $now->gte($block->blocked_until)) {
                $block->failed_attempts = 0;
                $block->is_blocked = false;
                $block->blocked_until = null;
                $block->blocked_at = null;
            }

            $block->failed_attempts += 1;
            $block->last_attempt_at = $now;
            $block->first_attempt_at = $block->first_attempt_at ?: $now;
            $block->last_identifier = $identifier ? substr($identifier, 0, 255) : null;
            $block->user_agent = $request->userAgent();

            // Check if attempt threshold reached (6th attempt triggers block)
            if ($block->failed_attempts > self::MAX_FAILED_LOGIN_ATTEMPTS) {
                $block->is_blocked = true;
                $block->blocked_at = $now;
                $block->blocked_until = $now->copy()->addMinutes(self::BLOCK_DURATION_MINUTES);
                $block->reason = 'تكرار محاولات تسجيل الدخول غير الصحيحة (6 محاولات)';
                $block->save();

                // Put in Cache for 30 minutes (1800 seconds)
                Cache::put("ip_security_block:{$ip}", true, self::BLOCK_DURATION_MINUTES * 60);

                // Log high severity security event
                self::recordEvent(
                    'login_bruteforce_block',
                    'high',
                    $request,
                    429,
                    'ip_block',
                    $block->id,
                    [
                        'ip_address' => $ip,
                        'failed_attempts' => $block->failed_attempts,
                        'blocked_at' => $block->blocked_at->toIso8601String(),
                        'blocked_until' => $block->blocked_until->toIso8601String(),
                        'last_identifier' => $block->last_identifier,
                        'reason' => $block->reason,
                    ]
                );

                return response()->json([
                    'message' => 'تم حظر محاولات تسجيل الدخول من هذا الجهاز لمدة 30 دقيقة بسبب تكرار البيانات غير الصحيحة.',
                    'code' => 'IP_TEMPORARILY_BLOCKED',
                    'blocked' => true,
                    'remaining_minutes' => self::BLOCK_DURATION_MINUTES,
                    'blocked_until' => $block->blocked_until->toIso8601String(),
                ], 429);
            } else {
                $block->save();

                // Log failed authentication event
                $severity = $block->failed_attempts >= 3 ? 'medium' : 'low';
                self::recordEvent(
                    'repeated_auth_failure',
                    $severity,
                    $request,
                    401,
                    'user_login',
                    null,
                    [
                        'ip_address' => $ip,
                        'attempt_number' => $block->failed_attempts,
                        'max_allowed' => self::MAX_FAILED_LOGIN_ATTEMPTS,
                        'identifier' => $identifier ? substr($identifier, 0, 100) : null,
                        'reason' => $reason,
                    ]
                );
            }
        } catch (\Throwable $e) {
            Log::warning('SecurityMonitoringService::handleFailedLogin error: ' . $e->getMessage());
        }

        return null;
    }

    /**
     * Handle successful login: resets failed attempt counter and clears active block if expired.
     */
    public static function handleSuccessfulLogin(Request $request, User $user): void
    {
        try {
            $ip = $request->ip() ?: '127.0.0.1';
            Cache::forget("ip_security_block:{$ip}");

            $block = IpSecurityBlock::where('ip_address', $ip)->first();
            if ($block) {
                $block->update([
                    'failed_attempts' => 0,
                    'is_blocked' => false,
                    'blocked_at' => null,
                    'blocked_until' => null,
                    'reason' => null,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('SecurityMonitoringService::handleSuccessfulLogin error: ' . $e->getMessage());
        }
    }

    /**
     * Unblock an IP address manually (Admin action).
     */
    public static function unblockIp(string $ip, ?string $adminReason = null): bool
    {
        try {
            Cache::forget("ip_security_block:{$ip}");
            $block = IpSecurityBlock::where('ip_address', $ip)->first();
            if ($block) {
                $block->unblock();
            }
            return true;
        } catch (\Throwable $e) {
            Log::warning('SecurityMonitoringService::unblockIp error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Log an attempted request to an unknown/non-existent API endpoint.
     */
    public static function logUnknownRoute(Request $request): void
    {
        $path = $request->path();
        
        // Filter out harmless static assets or non-api paths
        if (!str_starts_with($path, 'api')) {
            return;
        }

        self::recordEvent(
            'unknown_route',
            'low',
            $request,
            404,
            'api_route',
            null,
            [
                'description' => 'محاولة طلب مسار غير موجود على الـ API: ' . $path,
                'path' => $path,
            ]
        );
    }

    /**
     * Log unauthorized or forbidden access attempt (401 or 403).
     */
    public static function logUnauthorizedAccess(Request $request, int $statusCode, ?string $reason = null): void
    {
        $user = $request->user();
        $path = $request->path();

        if ($statusCode === 401) {
            $eventType = 'unauthenticated_request';
            $severity = 'low';
            $desc = 'محاولة وصول بدون تسجيل دخول لمسار محمي: ' . $path;
        } elseif ($statusCode === 403) {
            // Check if student requesting admin or teacher route
            if ($user && $user->role === 'student' && (str_contains($path, 'admin') || str_contains($path, 'teacher'))) {
                $eventType = 'role_access_violation';
                $severity = 'medium';
                $desc = 'محاولة غير مصرح بها من طالب للوصول إلى مسارات المشرفين/المعلمين: ' . $path;
            } else {
                $eventType = 'forbidden_resource';
                $severity = 'low';
                $desc = 'رفض الإذن بالوصول لمورد محمي: ' . $path;
            }
        } else {
            $eventType = 'resource_access_denied';
            $severity = 'low';
            $desc = 'طلب مرفوض (كود ' . $statusCode . '): ' . $path;
        }

        self::recordEvent(
            $eventType,
            $severity,
            $request,
            $statusCode,
            'resource',
            null,
            [
                'reason' => $reason ?: $desc,
                'user_role' => $user?->role,
                'user_email' => $user?->email,
            ]
        );
    }

    /**
     * Log rate limit / abuse event (429).
     */
    public static function logRateLimit(Request $request, string $endpoint): void
    {
        self::recordEvent(
            'rate_limit_triggered',
            'medium',
            $request,
            429,
            'rate_limiter',
            null,
            [
                'endpoint' => $endpoint,
                'description' => 'تجاوز معدل الطلبات المسموح به (Rate Limit) على: ' . $endpoint,
            ]
        );
    }

    /**
     * Log resource ID enumeration/abuse attempts.
     */
    public static function logResourceAbuse(Request $request, string $resourceType, $resourceId): void
    {
        self::recordEvent(
            'resource_id_abuse',
            'medium',
            $request,
            403,
            $resourceType,
            $resourceId,
            [
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'description' => 'محاولة وصول غير مصرح بها لمعرف المورد: ' . $resourceType . ' #' . $resourceId,
            ]
        );
    }

    /**
     * Log exam / assessment integrity violation.
     */
    public static function logExamViolation(Request $request, $examId, string $violationType, ?array $meta = null): void
    {
        self::recordEvent(
            'suspicious_exam_access',
            'medium',
            $request,
            403,
            'exam',
            $examId,
            array_merge([
                'violation_type' => $violationType,
                'exam_id' => $examId,
                'description' => 'مخالفة أمان مرتبطة بالامتحان: ' . $violationType,
            ], $meta ?? [])
        );
    }

    /**
     * Evaluates whether severity should be escalated based on repeated recent events from same IP.
     */
    protected static function evaluateSeverityEscalation(string $ip, string $defaultSeverity): string
    {
        try {
            $fiveMinutesAgo = Carbon::now()->subMinutes(5);
            $recentCount = SecurityEvent::where('ip_address', $ip)
                ->where('occurred_at', '>=', $fiveMinutesAgo)
                ->count();

            if ($recentCount >= 10) {
                return 'high';
            } elseif ($recentCount >= 4 && in_array($defaultSeverity, ['info', 'low'])) {
                return 'medium';
            }
        } catch (\Throwable $e) {
            // Ignore failure in frequency check
        }

        return $defaultSeverity;
    }
}
