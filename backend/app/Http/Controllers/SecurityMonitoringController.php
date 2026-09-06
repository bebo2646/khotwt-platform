<?php

namespace App\Http\Controllers;

use App\Models\SecurityEvent;
use App\Models\IpSecurityBlock;
use App\Models\User;
use App\Services\SecurityMonitoringService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SecurityMonitoringController extends Controller
{
    /**
     * Admin: Overview statistics for the security dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        $todayStart = Carbon::today()->startOfDay();
        $todayEnd = Carbon::today()->endOfDay();

        // High level counters for today
        $eventsToday = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])->count();
        $unauthorizedToday = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->whereIn('status_code', [401, 403])
            ->count();
        $unknownRoutesToday = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->where('status_code', 404)
            ->count();
        $rateLimitsToday = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->where('status_code', 429)
            ->count();
        $highSeverityToday = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->whereIn('severity', ['high', 'critical'])
            ->count();

        // Active blocked IPs
        $now = Carbon::now();
        $activeBlockedIps = IpSecurityBlock::where('is_blocked', true)
            ->where('blocked_until', '>', $now)
            ->count();
        $totalBlockedIps = IpSecurityBlock::count();

        // Severity breakdown for today
        $severityCounts = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->select('severity', DB::raw('count(*) as count'))
            ->groupBy('severity')
            ->pluck('count', 'severity')
            ->toArray();

        // Recent high priority events (last 10)
        $recentHighPriority = SecurityEvent::with('user:id,name,email,role')
            ->whereIn('severity', ['high', 'critical'])
            ->orderBy('occurred_at', 'desc')
            ->limit(10)
            ->get();

        // Top 5 suspicious IPs today
        $topIps = SecurityEvent::whereBetween('occurred_at', [$todayStart, $todayEnd])
            ->select('ip_address', DB::raw('count(*) as count'))
            ->groupBy('ip_address')
            ->orderBy('count', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'events_today_count' => $eventsToday,
            'unauthorized_today_count' => $unauthorizedToday,
            'unknown_routes_today_count' => $unknownRoutesToday,
            'rate_limits_today_count' => $rateLimitsToday,
            'high_severity_today_count' => $highSeverityToday,
            'active_blocked_ips_count' => $activeBlockedIps,
            'total_blocked_ips_count' => $totalBlockedIps,
            'severity_breakdown' => [
                'low' => $severityCounts['low'] ?? 0,
                'medium' => $severityCounts['medium'] ?? 0,
                'high' => $severityCounts['high'] ?? 0,
                'critical' => $severityCounts['critical'] ?? 0,
            ],
            'recent_high_priority' => $recentHighPriority,
            'top_ips' => $topIps,
        ]);
    }

    /**
     * Admin: Paginated security events with comprehensive filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $query = SecurityEvent::with('user:id,name,email,phone,role');

        // Filter: Severity
        if ($request->filled('severity') && $request->severity !== 'all') {
            $query->where('severity', $request->severity);
        }

        // Filter: Event Type
        if ($request->filled('event_type') && $request->event_type !== 'all') {
            $eventType = $request->event_type;
            if ($eventType === 'auth') {
                $query->whereIn('event_type', ['unauthenticated_request', 'invalid_authentication', 'repeated_auth_failure', 'login_bruteforce_block', 'blocked_ip_login_attempt']);
            } elseif ($eventType === 'routes') {
                $query->where('event_type', 'unknown_route');
            } elseif ($eventType === 'access') {
                $query->whereIn('event_type', ['forbidden_resource', 'role_access_violation', 'resource_access_denied']);
            } elseif ($eventType === 'rate_limit') {
                $query->where('event_type', 'rate_limit_triggered');
            } elseif ($eventType === 'abuse') {
                $query->whereIn('event_type', ['resource_id_abuse', 'suspicious_exam_access']);
            } else {
                $query->where('event_type', $eventType);
            }
        }

        // Filter: Status Code
        if ($request->filled('status_code')) {
            $query->where('status_code', (int) $request->status_code);
        }

        // Filter: IP Address
        if ($request->filled('ip_address')) {
            $query->where('ip_address', 'like', '%' . trim($request->ip_address) . '%');
        }

        // Filter: User
        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->user_id);
        }

        // Filter: Date Range
        if ($request->filled('date_from')) {
            $query->where('occurred_at', '>=', Carbon::parse($request->date_from)->startOfDay());
        }
        if ($request->filled('date_to')) {
            $query->where('occurred_at', '<=', Carbon::parse($request->date_to)->endOfDay());
        }

        // Filter: Free text search across description, path, IP, and user info
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('path', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhere('request_id', 'like', "%{$search}%")
                  ->orWhere('event_name', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%")
                         ->orWhere('phone', 'like', "%{$search}%");
                  });
            });
        }

        $perPage = max(5, min(100, (int) $request->input('per_page', 25)));
        $events = $query->orderBy('occurred_at', 'desc')->paginate($perPage);

        return response()->json($events);
    }

    /**
     * Admin: List blocked and tracked IPs with remaining block time.
     */
    public function blockedIps(Request $request): JsonResponse
    {
        $now = Carbon::now();
        $query = IpSecurityBlock::query();

        // Filter: Status
        if ($request->input('status') === 'blocked') {
            $query->where('is_blocked', true)
                  ->where('blocked_until', '>', $now);
        } elseif ($request->input('status') === 'unblocked') {
            $query->where(function ($q) use ($now) {
                $q->where('is_blocked', false)
                  ->orWhere('blocked_until', '<=', $now);
            });
        }

        // Search: IP address or identifier
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('ip_address', 'like', "%{$search}%")
                  ->orWhere('last_identifier', 'like', "%{$search}%");
            });
        }

        $perPage = max(5, min(100, (int) $request->input('per_page', 25)));
        $records = $query->orderBy('is_blocked', 'desc')
                         ->orderBy('updated_at', 'desc')
                         ->paginate($perPage);

        // Append computed attributes for remaining minutes
        $records->getCollection()->transform(function ($item) {
            $item->is_currently_blocked = $item->isCurrentlyBlocked();
            $item->remaining_seconds = $item->remainingBlockedSeconds();
            $item->remaining_minutes = $item->remainingBlockedMinutes();
            return $item;
        });

        return response()->json($records);
    }

    /**
     * Admin: Unblock an IP address manually.
     */
    public function unblockIp(Request $request): JsonResponse
    {
        $request->validate([
            'ip_address' => 'required_without:id|string|max:45',
            'id' => 'required_without:ip_address|integer',
            'reason' => 'nullable|string|max:255',
        ]);

        $ip = $request->ip_address;
        if (!$ip && $request->id) {
            $record = IpSecurityBlock::find($request->id);
            if ($record) {
                $ip = $record->ip_address;
            }
        }

        if (!$ip) {
            return response()->json(['message' => 'عنوان IP غير صالح.'], 422);
        }

        $unblocked = SecurityMonitoringService::unblockIp($ip, $request->reason);

        if ($unblocked) {
            // Record admin unblock audit event
            SecurityMonitoringService::recordEvent(
                'admin_ip_unblocked',
                'info',
                $request,
                200,
                'ip_block',
                null,
                [
                    'unblocked_ip' => $ip,
                    'reason' => $request->reason ?: 'إلغاء حظر يدوي من قبل المشرف',
                    'admin_id' => $request->user()?->id,
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'تم إلغاء حظر عنوان IP بنجاح.',
                'ip_address' => $ip,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'فشلت عملية إلغاء الحظر.',
        ], 500);
    }

    /**
     * Admin: Security activity timeline for a specific student profile.
     */
    public function studentSecurityEvents(Request $request, int $studentId): JsonResponse
    {
        $student = User::where('role', 'student')->findOrFail($studentId);

        $perPage = max(5, min(100, (int) $request->input('per_page', 20)));

        $query = SecurityEvent::where(function ($q) use ($student) {
            $q->where('user_id', $student->id);
            if (!empty($student->email)) {
                $q->orWhere('metadata->user_email', $student->email)
                  ->orWhere('metadata->attempted_identifier', $student->email);
            }
            if (!empty($student->phone)) {
                $q->orWhere('metadata->attempted_identifier', $student->phone);
            }
        });

        // Filter: Severity
        if ($request->filled('severity') && $request->severity !== 'all') {
            $query->where('severity', $request->severity);
        }

        $events = $query->orderBy('occurred_at', 'desc')->paginate($perPage);

        return response()->json([
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'phone' => $student->phone,
            ],
            'events' => $events,
        ]);
    }
}
