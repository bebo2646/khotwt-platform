<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Course;
use App\Models\PaymentHistory;
use App\Models\TeacherEarning;
use App\Models\PlatformEarning;
use App\Models\TeacherPayout;
use App\Models\FinancialAuditLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialController extends Controller
{
    /**
     * Apply date filter helper.
     */
    protected function applyDateFilter($query, $range, $startDate = null, $endDate = null, $column = 'payment_histories.created_at')
    {
        switch ($range) {
            case 'today':
                $query->whereDate($column, Carbon::today());
                break;
            case 'yesterday':
                $query->whereDate($column, Carbon::yesterday());
                break;
            case 'last_7_days':
                $query->where($column, '>=', Carbon::now()->subDays(7));
                break;
            case 'last_30_days':
                $query->where($column, '>=', Carbon::now()->subDays(30));
                break;
            case 'this_month':
                $query->whereMonth($column, Carbon::now()->month)
                      ->whereYear($column, Carbon::now()->year);
                break;
            case 'last_month':
                $lastMonth = Carbon::now()->subMonth();
                $query->whereMonth($column, $lastMonth->month)
                      ->whereYear($column, $lastMonth->year);
                break;
            case 'this_year':
                $query->whereYear($column, Carbon::now()->year);
                break;
            case 'custom':
                if ($startDate) {
                    $query->whereDate($column, '>=', Carbon::parse($startDate));
                }
                if ($endDate) {
                    $query->whereDate($column, '<=', Carbon::parse($endDate));
                }
                break;
        }
        return $query;
    }

    /**
     * Apply general filters helper.
     */
    protected function applyGeneralFilters($query, Request $request)
    {
        if ($request->filled('teacher_id')) {
            $query->where('payment_histories.teacher_id', $request->query('teacher_id'));
        }
        if ($request->filled('student_id')) {
            $query->where('payment_histories.student_id', $request->query('student_id'));
        }
        if ($request->filled('course_id')) {
            $query->where('payment_histories.course_id', $request->query('course_id'));
        }
        if ($request->filled('package_id')) {
            $query->where('payment_histories.package_id', $request->query('package_id'));
        }
        if ($request->filled('payment_method')) {
            $query->where('payment_histories.payment_method', $request->query('payment_method'));
        }
        if ($request->filled('status')) {
            $query->where('payment_histories.status', $request->query('status'));
        }
        if ($request->filled('purchase_type')) {
            $type = $request->query('purchase_type');
            if ($type === 'direct') {
                $query->whereNull('payment_histories.purchase_code_id');
            } elseif ($type === 'code') {
                $query->whereNotNull('payment_histories.purchase_code_id');
            }
        }
        if ($request->filled('min_price')) {
            $query->where('payment_histories.amount', '>=', $request->query('min_price'));
        }
        if ($request->filled('max_price')) {
            $query->where('payment_histories.amount', '<=', $request->query('max_price'));
        }

        // Product Type Filter
        if ($request->filled('product_type')) {
            $type = $request->query('product_type');
            if ($type === 'course') {
                $query->whereNotNull('payment_histories.course_id')
                      ->whereNull('payment_histories.package_id')
                      ->whereNull('payment_histories.lesson_id');
            } elseif ($type === 'lesson') {
                $query->whereNotNull('payment_histories.lesson_id');
            } elseif (in_array($type, ['bundle', 'month', 'revision'])) {
                $query->whereHas('package', function($q) use ($type) {
                    $q->where('type', $type);
                });
            }
        }

        // Grade and Subject filters (need Course table)
        if ($request->filled('grade') || $request->filled('subject')) {
            $query->join('courses', 'payment_histories.course_id', '=', 'courses.id');
            if ($request->filled('grade')) {
                $query->where('courses.grade', $request->query('grade'));
            }
            if ($request->filled('subject')) {
                $query->where('courses.subject', $request->query('subject'));
            }
            $query->select('payment_histories.*');
        }

        return $query;
    }

    /**
     * Helper to apply general filters directly to teacher/platform earnings queries
     */
    protected function applyGeneralFiltersToEarnings($query, Request $request)
    {
        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->query('teacher_id'));
        }
        if ($request->filled('student_id')) {
            $query->where('student_id', $request->query('student_id'));
        }
        if ($request->filled('course_id')) {
            $query->where('course_id', $request->query('course_id'));
        }
        if ($request->filled('package_id')) {
            $query->where('package_id', $request->query('package_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('purchase_type')) {
            $type = $request->query('purchase_type');
            if ($type === 'direct') {
                $query->whereNull('purchase_code_id');
            } elseif ($type === 'code') {
                $query->whereNotNull('purchase_code_id');
            }
        }
        if ($request->filled('product_type')) {
            $type = $request->query('product_type');
            if ($type === 'course') {
                $query->whereNotNull('course_id')->whereNull('package_id')->whereNull('lesson_id');
            } elseif ($type === 'lesson') {
                $query->whereNotNull('lesson_id');
            } elseif (in_array($type, ['bundle', 'month', 'revision'])) {
                $query->whereHas('package', function($q) use ($type) {
                    $q->where('type', $type);
                });
            }
        }
        if ($request->filled('grade') || $request->filled('subject')) {
            $query->join('courses', $query->getModel()->getTable() . '.course_id', '=', 'courses.id');
            if ($request->filled('grade')) {
                $query->where('courses.grade', $request->query('grade'));
            }
            if ($request->filled('subject')) {
                $query->where('courses.subject', $request->query('subject'));
            }
            $query->select($query->getModel()->getTable() . '.*');
        }
        return $query;
    }

    /**
     * Main dashboard cards, charts, and automatic financial audit alerts.
     */
    public function dashboard(Request $request)
    {
        $range = $request->query('range', 'this_month');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        // Standard Revenue frames
        $todayRevenue = $this->applyGeneralFilters(PaymentHistory::whereDate('created_at', Carbon::today()), $request)->sum('amount');
        $yesterdayRevenue = $this->applyGeneralFilters(PaymentHistory::whereDate('created_at', Carbon::yesterday()), $request)->sum('amount');
        $thisWeekRevenue = $this->applyGeneralFilters(PaymentHistory::where('created_at', '>=', Carbon::now()->startOfWeek()), $request)->sum('amount');
        $thisMonthRevenue = $this->applyGeneralFilters(PaymentHistory::where('created_at', '>=', Carbon::now()->startOfMonth()), $request)->sum('amount');
        $thisYearRevenue = $this->applyGeneralFilters(PaymentHistory::where('created_at', '>=', Carbon::now()->startOfYear()), $request)->sum('amount');

        // Filtered Range Total
        $filteredQuery = PaymentHistory::query();
        $filteredQuery = $this->applyGeneralFilters($filteredQuery, $request);
        $filteredQuery = $this->applyDateFilter($filteredQuery, $range, $startDate, $endDate);
        $totalRevenue = $filteredQuery->sum('amount');

        // Split shares
        $teacherEarningQuery = TeacherEarning::query();
        $teacherEarningQuery = $this->applyGeneralFiltersToEarnings($teacherEarningQuery, $request);
        $teacherEarningQuery = $this->applyDateFilter($teacherEarningQuery, $range, $startDate, $endDate, 'teacher_earnings.created_at');
        $totalTeacherEarnings = $teacherEarningQuery->sum('amount');

        $platformEarningQuery = PlatformEarning::query();
        $platformEarningQuery = $this->applyGeneralFiltersToEarnings($platformEarningQuery, $request);
        $platformEarningQuery = $this->applyDateFilter($platformEarningQuery, $range, $startDate, $endDate, 'platform_earnings.created_at');
        $totalPlatformEarnings = $platformEarningQuery->sum('amount');

        // Payout balances
        $pendingPayouts = TeacherPayout::where('status', 'pending');
        if ($request->filled('teacher_id')) {
            $pendingPayouts->where('teacher_id', $request->query('teacher_id'));
        }
        $pendingWithdrawals = $pendingPayouts->sum('amount');

        $completedPayouts = TeacherPayout::where('status', 'completed');
        if ($request->filled('teacher_id')) {
            $completedPayouts->where('teacher_id', $request->query('teacher_id'));
        }
        $completedWithdrawals = $completedPayouts->sum('amount');

        // Daily chart metrics
        $salesByDay = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->selectRaw('DATE(payment_histories.created_at) as date, SUM(payment_histories.amount) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $weeklyRevenue = [];
        $monthlyRevenue = [];
        $yearlyRevenue = [];

        foreach ($salesByDay as $sale) {
            $date = Carbon::parse($sale->date);
            $weekKey = $date->format('Y') . '-W' . $date->format('W');
            if (!isset($weeklyRevenue[$weekKey])) {
                $weeklyRevenue[$weekKey] = ['label' => $weekKey, 'value' => 0.00];
            }
            $weeklyRevenue[$weekKey]['value'] += (float)$sale->total;

            $monthKey = $date->format('Y-m');
            if (!isset($monthlyRevenue[$monthKey])) {
                $monthlyRevenue[$monthKey] = ['label' => $monthKey, 'value' => 0.00];
            }
            $monthlyRevenue[$monthKey]['value'] += (float)$sale->total;

            $yearKey = $date->format('Y');
            if (!isset($yearlyRevenue[$yearKey])) {
                $yearlyRevenue[$yearKey] = ['label' => $yearKey, 'value' => 0.00];
            }
            $yearlyRevenue[$yearKey]['value'] += (float)$sale->total;
        }

        // Top charts
        $revenuePerTeacher = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->join('users', 'payment_histories.teacher_id', '=', 'users.id')
            ->selectRaw('users.name as label, SUM(payment_histories.amount) as value')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('value')
            ->limit(8)
            ->get();

        $revenuePerSubject = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->join('courses', 'payment_histories.course_id', '=', 'courses.id')
            ->selectRaw('courses.subject as label, SUM(payment_histories.amount) as value')
            ->groupBy('courses.subject')
            ->orderByDesc('value')
            ->get();

        $revenuePerGrade = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->join('courses', 'payment_histories.course_id', '=', 'courses.id')
            ->selectRaw('courses.grade as label, SUM(payment_histories.amount) as value')
            ->groupBy('courses.grade')
            ->orderByDesc('value')
            ->get();

        $revenueByProductType = [
            ['label' => 'Course', 'value' => (float)$this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)->whereNotNull('payment_histories.course_id')->whereNull('payment_histories.package_id')->whereNull('payment_histories.lesson_id')->sum('payment_histories.amount')],
            ['label' => 'Bundle', 'value' => (float)$this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)->whereHas('package', function($q) { $q->where('type', 'bundle'); })->sum('payment_histories.amount')],
            ['label' => 'Monthly Package', 'value' => (float)$this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)->whereHas('package', function($q) { $q->where('type', 'month'); })->sum('payment_histories.amount')],
            ['label' => 'Revision Package', 'value' => (float)$this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)->whereHas('package', function($q) { $q->where('type', 'revision'); })->sum('payment_histories.amount')],
            ['label' => 'Standalone Lecture', 'value' => (float)$this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)->whereNotNull('payment_histories.lesson_id')->sum('payment_histories.amount')],
        ];

        $topSellingCourses = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->whereNotNull('payment_histories.course_id')
            ->whereNull('payment_histories.package_id')
            ->whereNull('payment_histories.lesson_id')
            ->join('courses', 'payment_histories.course_id', '=', 'courses.id')
            ->selectRaw('courses.title as label, COUNT(*) as sales_count, SUM(payment_histories.amount) as value')
            ->groupBy('courses.id', 'courses.title')
            ->orderByDesc('sales_count')
            ->limit(5)
            ->get();

        $topSellingBundles = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->whereNotNull('payment_histories.package_id')
            ->join('packages', 'payment_histories.package_id', '=', 'packages.id')
            ->where('packages.type', 'bundle')
            ->selectRaw('packages.title as label, COUNT(*) as sales_count, SUM(payment_histories.amount) as value')
            ->groupBy('packages.id', 'packages.title')
            ->orderByDesc('sales_count')
            ->limit(5)
            ->get();

        $topTeachers = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->join('users', 'payment_histories.teacher_id', '=', 'users.id')
            ->selectRaw('users.name as label, COUNT(*) as sales_count, SUM(payment_histories.amount) as value')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('value')
            ->limit(5)
            ->get();

        $topStudents = $this->applyDateFilter($this->applyGeneralFilters(PaymentHistory::query(), $request), $range, $startDate, $endDate)
            ->join('users', 'payment_histories.student_id', '=', 'users.id')
            ->selectRaw('users.name as label, COUNT(*) as purchases_count, SUM(payment_histories.amount) as value')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('value')
            ->limit(5)
            ->get();

        // --- AUTOMATED AUDIT ALERTS CHECKS ---
        
        // 1. Large Refund (> 500 EGP)
        $largeRefundsAlerts = \App\Models\RefundLog::where('amount', '>', 500.00)
            ->with(['student:id,name', 'course:id,title'])
            ->latest()
            ->limit(5)
            ->get()
            ->map(function($r) {
                return [
                    'id' => $r->id,
                    'student_name' => $r->student ? $r->student->name : 'N/A',
                    'product' => $r->course ? $r->course->title : ($r->package ? $r->package->title : 'Product'),
                    'amount' => (float)$r->amount,
                    'timestamp' => $r->created_at->toDateTimeString()
                ];
            });

        // 2. Large Manual Adjustment (> 1000 EGP or < -1000 EGP)
        $largeAdjustmentAlerts = TeacherEarning::where('source', 'manual_adjustment')
            ->where(function($q) {
                $q->where('amount', '>', 1000.00)
                  ->orWhere('amount', '<', -1000.00);
            })
            ->with('teacher:id,name')
            ->latest()
            ->limit(5)
            ->get()
            ->map(function($a) {
                return [
                    'id' => $a->id,
                    'teacher_name' => $a->teacher ? $a->teacher->name : 'N/A',
                    'amount' => (float)$a->amount,
                    'description' => $a->description,
                    'timestamp' => $a->created_at->toDateTimeString()
                ];
            });

        // 3. Negative Teacher Balances
        $teacherEarningsSum = TeacherEarning::selectRaw('teacher_id, SUM(amount) as total')
            ->groupBy('teacher_id')
            ->pluck('total', 'teacher_id');

        $teacherPayoutsSum = TeacherPayout::where('status', 'completed')
            ->selectRaw('teacher_id, SUM(amount) as total')
            ->groupBy('teacher_id')
            ->pluck('total', 'teacher_id');

        $negativeBalanceAlerts = [];
        $teacherNames = User::where('role', 'teacher')->pluck('name', 'id');
        foreach ($teacherNames as $tid => $name) {
            $earn = $teacherEarningsSum->get($tid) ?: 0.00;
            $payout = $teacherPayoutsSum->get($tid) ?: 0.00;
            $bal = (float)$earn - (float)$payout;
            if ($bal < 0) {
                $negativeBalanceAlerts[] = [
                    'teacher_id' => $tid,
                    'teacher_name' => $name,
                    'balance' => round($bal, 2)
                ];
            }
        }

        // 4. Revenue Reconciliation Mismatch Alert (Student Payments == Teacher Share + Platform Share)
        $totalAllStudentPayments = PaymentHistory::sum('amount');
        $totalAllTeacherShare = TeacherEarning::sum('amount');
        $totalAllPlatformShare = PlatformEarning::sum('amount');
        $difference = round($totalAllStudentPayments - ($totalAllTeacherShare + $totalAllPlatformShare), 2);
        
        $reconciliationMismatch = [
            'mismatch' => abs($difference) > 0.05,
            'student_payments' => (float)$totalAllStudentPayments,
            'teacher_earnings' => (float)$totalAllTeacherShare,
            'platform_earnings' => (float)$totalAllPlatformShare,
            'difference' => $difference
        ];

        // 5. Duplicate Payments Alert (same student, same product, within 2 minutes)
        $duplicatePaymentsCandidates = PaymentHistory::select('student_id', 'course_id', 'package_id', 'lesson_id', DB::raw('COUNT(*) as count'))
            ->groupBy('student_id', 'course_id', 'package_id', 'lesson_id')
            ->havingRaw('COUNT(*) > 1')
            ->limit(5)
            ->get();

        $duplicatePaymentAlerts = [];
        foreach ($duplicatePaymentsCandidates as $dp) {
            $records = PaymentHistory::where('student_id', $dp->student_id)
                ->where('course_id', $dp->course_id)
                ->where('package_id', $dp->package_id)
                ->where('lesson_id', $dp->lesson_id)
                ->orderBy('created_at')
                ->get();
            
            for ($i = 0; $i < count($records) - 1; $i++) {
                $t1 = strtotime($records[$i]->created_at);
                $t2 = strtotime($records[$i+1]->created_at);
                if ($t2 - $t1 <= 120) {
                    $student = User::find($dp->student_id);
                    $productName = 'Product';
                    if ($dp->course_id) {
                        $c = Course::find($dp->course_id);
                        $productName = $c ? $c->title : 'Course';
                    } elseif ($dp->package_id) {
                        $p = \App\Models\Package::find($dp->package_id);
                        $productName = $p ? $p->title : 'Package';
                    } elseif ($dp->lesson_id) {
                        $l = \App\Models\Lesson::find($dp->lesson_id);
                        $productName = $l ? $l->title : 'Lecture';
                    }

                    $duplicatePaymentAlerts[] = [
                        'student_id' => $dp->student_id,
                        'student_name' => $student ? $student->name : 'Unknown Student',
                        'product_name' => $productName,
                        'time_diff' => ($t2 - $t1) . ' seconds',
                        'timestamp' => $records[$i+1]->created_at->toDateTimeString(),
                    ];
                    break;
                }
            }
        }

        // 6. Duplicate Wallet Transactions Alert (same wallet, same amount, same type, within 2 minutes)
        $duplicateWalletCandidates = \App\Models\WalletTransaction::select('wallet_id', 'amount', 'type', DB::raw('COUNT(*) as count'))
            ->groupBy('wallet_id', 'amount', 'type')
            ->havingRaw('COUNT(*) > 1')
            ->limit(5)
            ->get();

        $duplicateWalletAlerts = [];
        foreach ($duplicateWalletCandidates as $dwt) {
            $records = \App\Models\WalletTransaction::where('wallet_id', $dwt->wallet_id)
                ->where('amount', $dwt->amount)
                ->where('type', $dwt->type)
                ->orderBy('created_at')
                ->get();
            
            for ($i = 0; $i < count($records) - 1; $i++) {
                $t1 = strtotime($records[$i]->created_at);
                $t2 = strtotime($records[$i+1]->created_at);
                if ($t2 - $t1 <= 120) {
                    $wallet = \App\Models\Wallet::find($dwt->wallet_id);
                    $studentName = ($wallet && $wallet->student) ? $wallet->student->name : 'Wallet #' . $dwt->wallet_id;
                    $duplicateWalletAlerts[] = [
                        'wallet_id' => $dwt->wallet_id,
                        'student_name' => $studentName,
                        'amount' => (float)$dwt->amount,
                        'type' => $dwt->type,
                        'timestamp' => $records[$i+1]->created_at->toDateTimeString(),
                    ];
                    break;
                }
            }
        }

        return response()->json([
            'summary' => [
                'today' => (float)$todayRevenue,
                'yesterday' => (float)$yesterdayRevenue,
                'week' => (float)$thisWeekRevenue,
                'month' => (float)$thisMonthRevenue,
                'year' => (float)$thisYearRevenue,
                'filtered_total' => (float)$totalRevenue,
                'platform_net_profit' => (float)$totalPlatformEarnings,
                'teachers_earnings' => (float)$totalTeacherEarnings,
                'platform_commission' => (float)$totalPlatformEarnings,
                'average_commission_percentage' => $totalRevenue > 0 ? round(($totalPlatformEarnings / $totalRevenue) * 100, 2) : 0.00,
                'pending_withdrawals' => (float)$pendingWithdrawals,
                'completed_withdrawals' => (float)$completedWithdrawals,
            ],
            'charts' => [
                'daily_revenue' => $salesByDay,
                'weekly_revenue' => array_values($weeklyRevenue),
                'monthly_revenue' => array_values($monthlyRevenue),
                'yearly_revenue' => array_values($yearlyRevenue),
                'revenue_per_teacher' => $revenuePerTeacher,
                'revenue_per_subject' => $revenuePerSubject,
                'revenue_per_grade' => $revenuePerGrade,
                'revenue_by_product_type' => $revenueByProductType,
                'top_selling_courses' => $topSellingCourses,
                'top_selling_bundles' => $topSellingBundles,
                'top_teachers' => $topTeachers,
                'top_students_by_spending' => $topStudents
            ],
            'alerts' => [
                'large_refunds' => $largeRefundsAlerts,
                'large_adjustments' => $largeAdjustmentAlerts,
                'negative_balances' => $negativeBalanceAlerts,
                'revenue_mismatch' => $reconciliationMismatch,
                'duplicate_payments' => $duplicatePaymentAlerts,
                'duplicate_wallet_transactions' => $duplicateWalletAlerts
            ]
        ]);
    }

    /**
     * Paginated transaction listing.
     */
    public function transactions(Request $request)
    {
        $range = $request->query('range', 'this_month');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $perPage = $request->query('per_page', 20);

        $query = PaymentHistory::with(['student', 'teacher', 'course', 'package', 'lesson', 'purchaseCode']);
        $query = $this->applyGeneralFilters($query, $request);
        $query = $this->applyDateFilter($query, $range, $startDate, $endDate);
        
        $paginator = $query->orderBy('payment_histories.created_at', 'desc')->paginate($perPage);

        $studentIds = $paginator->pluck('student_id')->unique()->toArray();
        $teacherIds = $paginator->pluck('teacher_id')->unique()->toArray();

        $teacherEarnings = TeacherEarning::whereIn('student_id', $studentIds)
            ->whereIn('teacher_id', $teacherIds)
            ->get();

        $platformEarnings = PlatformEarning::whereIn('student_id', $studentIds)
            ->whereIn('teacher_id', $teacherIds)
            ->get();

        // Trace wallet transactions
        $wallets = \App\Models\Wallet::whereIn('student_id', $studentIds)->get()->keyBy('student_id');
        $walletIds = $wallets->pluck('id')->toArray();
        $walletTransactions = \App\Models\WalletTransaction::whereIn('wallet_id', $walletIds)
            ->where('type', 'purchase')
            ->get();

        $items = collect($paginator->items())->map(function($ph) use ($teacherEarnings, $platformEarnings, $wallets, $walletTransactions) {
            $te = $teacherEarnings->first(function($e) use ($ph) {
                return $e->student_id == $ph->student_id 
                    && $e->teacher_id == $ph->teacher_id
                    && $e->course_id == $ph->course_id 
                    && $e->package_id == $ph->package_id 
                    && $e->lesson_id == $ph->lesson_id
                    && abs(strtotime($e->created_at) - strtotime($ph->created_at)) < 15;
            });

            $pe = $platformEarnings->first(function($e) use ($ph) {
                return $e->student_id == $ph->student_id 
                    && $e->teacher_id == $ph->teacher_id
                    && $e->course_id == $ph->course_id 
                    && $e->package_id == $ph->package_id 
                    && $e->lesson_id == $ph->lesson_id
                    && abs(strtotime($e->created_at) - strtotime($ph->created_at)) < 15;
            });

            $wallet = $wallets->get($ph->student_id);
            $wtId = null;
            if ($wallet) {
                $refId = $ph->course_id ?: ($ph->package_id ?: $ph->lesson_id);
                $wt = $walletTransactions->first(function($t) use ($wallet, $ph, $refId) {
                    return $t->wallet_id == $wallet->id
                        && (float)$t->amount == (float)$ph->amount
                        && $t->reference_id == $refId
                        && abs(strtotime($t->created_at) - strtotime($ph->created_at)) < 15;
                });
                if ($wt) {
                    $wtId = $wt->id;
                }
            }

            $productType = 'Course';
            $productName = $ph->course ? $ph->course->title : 'Unknown Course';

            if ($ph->package_id) {
                if ($ph->package) {
                    if ($ph->package->type === 'bundle') {
                        $productType = 'Bundle';
                    } elseif ($ph->package->type === 'month') {
                        $productType = 'Monthly Package';
                    } else {
                        $productType = 'Revision Package';
                    }
                    $productName = $ph->package->title;
                } else {
                    $productType = 'Package';
                    $productName = 'Unknown Package';
                }
            } elseif ($ph->lesson_id) {
                $productType = 'Standalone Lecture';
                $productName = $ph->lesson ? $ph->lesson->title : 'Unknown Lecture';
            }

            $originalPrice = (float)$ph->amount;
            $discount = 0.00;
            if ($ph->course) {
                $originalPrice = (float)$ph->course->price;
                $discount = max(0.00, $originalPrice - (float)$ph->amount);
            } elseif ($ph->package) {
                $originalPrice = (float)$ph->package->price;
                $discount = max(0.00, $originalPrice - (float)$ph->amount);
            } elseif ($ph->lesson) {
                $originalPrice = (float)$ph->lesson->price;
                $discount = max(0.00, $originalPrice - (float)$ph->amount);
            }

            $activationTime = $ph->created_at->toDateTimeString();
            if ($ph->purchaseCode && $ph->purchaseCode->redeemed_at) {
                $activationTime = $ph->purchaseCode->redeemed_at->toDateTimeString();
            }

            return [
                'id' => $ph->id,
                'created_at' => $ph->created_at->toDateTimeString(),
                'student' => [
                    'id' => $ph->student_id,
                    'name' => $ph->student ? $ph->student->name : 'Deleted Student',
                    'email' => $ph->student ? $ph->student->email : 'N/A',
                    'phone' => $ph->student ? $ph->student->phone : 'N/A',
                ],
                'teacher' => [
                    'id' => $ph->teacher_id,
                    'name' => $ph->teacher ? $ph->teacher->name : 'Deleted Teacher',
                    'subject' => $ph->teacher ? $ph->teacher->subject : 'N/A',
                ],
                'product_type' => $productType,
                'product_name' => $productName,
                'course_name' => $ph->course ? $ph->course->title : ($ph->package && $ph->package->course ? $ph->package->course->title : 'N/A'),
                'bundle_name' => ($ph->package && $ph->package->type === 'bundle') ? $ph->package->title : 'N/A',
                'original_price' => $originalPrice,
                'discount' => $discount,
                'final_paid_amount' => (float)$ph->amount,
                'teacher_share' => $te ? (float)$te->amount : round($ph->amount * 0.8, 2),
                'platform_share' => $pe ? (float)$pe->amount : round($ph->amount * 0.2, 2),
                'payment_method' => $ph->payment_method,
                'wallet_transaction_id' => $wtId,
                'status' => $ph->status,
                'activation_time' => $activationTime
            ];
        });

        return response()->json([
            'data' => $items,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
        ]);
    }

    /**
     * Day-by-day closing reports.
     */
    public function dailyReport(Request $request)
    {
        $range = $request->query('range', 'this_month');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $query = PaymentHistory::query();
        $query = $this->applyGeneralFilters($query, $request);
        $query = $this->applyDateFilter($query, $range, $startDate, $endDate);

        $reports = $query->leftJoin('packages', 'payment_histories.package_id', '=', 'packages.id')
            ->selectRaw("
                DATE(payment_histories.created_at) as date, 
                SUM(payment_histories.amount) as total_revenue,
                COUNT(payment_histories.id) as total_purchases,
                SUM(CASE WHEN payment_histories.course_id IS NOT NULL AND payment_histories.package_id IS NULL AND payment_histories.lesson_id IS NULL THEN 1 ELSE 0 END) as courses_sold,
                SUM(CASE WHEN payment_histories.package_id IS NOT NULL AND packages.type = 'bundle' THEN 1 ELSE 0 END) as bundles_sold,
                SUM(CASE WHEN payment_histories.package_id IS NOT NULL AND packages.type = 'month' THEN 1 ELSE 0 END) as monthly_packages_sold,
                SUM(CASE WHEN payment_histories.package_id IS NOT NULL AND packages.type = 'revision' THEN 1 ELSE 0 END) as revision_packages_sold,
                SUM(CASE WHEN payment_histories.lesson_id IS NOT NULL THEN 1 ELSE 0 END) as standalone_sold
            ")
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->get();

        $dailyTopTeachers = PaymentHistory::selectRaw("DATE(created_at) as date, teacher_id, SUM(amount) as total_amount")
            ->groupBy('date', 'teacher_id')
            ->orderByDesc('total_amount')
            ->get()
            ->groupBy('date');

        $dailyTopCourses = PaymentHistory::whereNotNull('course_id')
            ->whereNull('package_id')
            ->whereNull('lesson_id')
            ->selectRaw("DATE(created_at) as date, course_id, COUNT(*) as sales_count")
            ->groupBy('date', 'course_id')
            ->orderByDesc('sales_count')
            ->get()
            ->groupBy('date');

        $dailyTopBundles = PaymentHistory::whereNotNull('package_id')
            ->join('packages', 'payment_histories.package_id', '=', 'packages.id')
            ->where('packages.type', 'bundle')
            ->selectRaw("DATE(payment_histories.created_at) as date, payment_histories.package_id, COUNT(*) as sales_count")
            ->groupBy('date', 'payment_histories.package_id')
            ->orderByDesc('sales_count')
            ->get()
            ->groupBy('date');

        $dailyTopSubjects = PaymentHistory::join('courses', 'payment_histories.course_id', '=', 'courses.id')
            ->selectRaw("DATE(payment_histories.created_at) as date, courses.subject, SUM(payment_histories.amount) as total_amount")
            ->groupBy('date', 'courses.subject')
            ->orderByDesc('total_amount')
            ->get()
            ->groupBy('date');

        $teacherNames = User::where('role', 'teacher')->pluck('name', 'id');
        $courseTitles = Course::pluck('title', 'id');
        $packageTitles = \App\Models\Package::pluck('title', 'id');

        $dailyStats = $reports->map(function($rep) use (
            $dailyTopTeachers, $dailyTopCourses, $dailyTopBundles, $dailyTopSubjects,
            $teacherNames, $courseTitles, $packageTitles
        ) {
            $dateStr = $rep->date;
            
            $teacherShare = TeacherEarning::whereDate('created_at', $dateStr)->sum('amount');
            $platformShare = PlatformEarning::whereDate('created_at', $dateStr)->sum('amount');
            $newStudents = User::where('role', 'student')->whereDate('created_at', $dateStr)->count();
            $refundsSum = \App\Models\RefundLog::whereDate('created_at', $dateStr)->sum('amount');

            $topTeacher = 'N/A';
            $tList = $dailyTopTeachers->get($dateStr);
            if ($tList && $tList->count() > 0) {
                $tid = $tList->first()->teacher_id;
                $topTeacher = $teacherNames->get($tid) ?: 'N/A';
            }

            $topCourse = 'N/A';
            $cList = $dailyTopCourses->get($dateStr);
            if ($cList && $cList->count() > 0) {
                $cid = $cList->first()->course_id;
                $topCourse = $courseTitles->get($cid) ?: 'N/A';
            }

            $topBundle = 'N/A';
            $bList = $dailyTopBundles->get($dateStr);
            if ($bList && $bList->count() > 0) {
                $bid = $bList->first()->package_id;
                $topBundle = $packageTitles->get($bid) ?: 'N/A';
            }

            $topSub = 'N/A';
            $sList = $dailyTopSubjects->get($dateStr);
            if ($sList && $sList->count() > 0) {
                $topSub = $sList->first()->subject ?: 'N/A';
            }

            return [
                'date' => $dateStr,
                'total_revenue' => (float)$rep->total_revenue,
                'platform_earnings' => (float)$platformShare,
                'teachers_earnings' => (float)$teacherShare,
                'purchases_count' => (int)$rep->total_purchases,
                'new_students_count' => $newStudents,
                'refunds_amount' => (float)$refundsSum,
                'courses_sold' => (int)$rep->courses_sold,
                'bundles_sold' => (int)$rep->bundles_sold,
                'monthly_packages_sold' => (int)$rep->monthly_packages_sold,
                'revision_packages_sold' => (int)$rep->revision_packages_sold,
                'standalone_sold' => (int)$rep->standalone_sold,
                'top_teacher' => $topTeacher,
                'top_course' => $topCourse,
                'top_bundle' => $topBundle,
                'top_subject' => $topSub,
            ];
        });

        return response()->json($dailyStats);
    }

    /**
     * Teacher detailed report.
     */
    public function teachersReport(Request $request)
    {
        $teachers = User::where('role', 'teacher')->get();
        $teacherIds = $teachers->pluck('id')->toArray();

        $today = Carbon::today();
        $startOfWeek = Carbon::now()->startOfWeek();
        $startOfMonth = Carbon::now()->startOfMonth();
        $startOfYear = Carbon::now()->startOfYear();

        $teacherRevenueStats = PaymentHistory::whereIn('teacher_id', $teacherIds)
            ->selectRaw("
                teacher_id,
                SUM(amount) as total_revenue,
                COUNT(*) as sales_count,
                SUM(CASE WHEN DATE(created_at) = '{$today->toDateString()}' THEN amount ELSE 0 END) as today_revenue,
                SUM(CASE WHEN created_at >= '{$startOfWeek->toDateTimeString()}' THEN amount ELSE 0 END) as week_revenue,
                SUM(CASE WHEN created_at >= '{$startOfMonth->toDateTimeString()}' THEN amount ELSE 0 END) as month_revenue,
                SUM(CASE WHEN created_at >= '{$startOfYear->toDateTimeString()}' THEN amount ELSE 0 END) as year_revenue
            ")
            ->groupBy('teacher_id')
            ->get()
            ->keyBy('teacher_id');

        $teacherPayoutStats = TeacherPayout::whereIn('teacher_id', $teacherIds)
            ->selectRaw("
                teacher_id,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_payouts,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_payouts
            ")
            ->groupBy('teacher_id')
            ->get()
            ->keyBy('teacher_id');

        $courseSales = PaymentHistory::whereIn('teacher_id', $teacherIds)
            ->whereNotNull('course_id')
            ->whereNull('package_id')
            ->whereNull('lesson_id')
            ->selectRaw('teacher_id, course_id, COUNT(*) as sales_count')
            ->groupBy('teacher_id', 'course_id')
            ->get()
            ->groupBy('teacher_id');

        $packageSales = PaymentHistory::whereIn('teacher_id', $teacherIds)
            ->whereNotNull('package_id')
            ->selectRaw('teacher_id, package_id, COUNT(*) as sales_count')
            ->groupBy('teacher_id', 'package_id')
            ->get()
            ->groupBy('teacher_id');

        $lessonSales = PaymentHistory::whereIn('teacher_id', $teacherIds)
            ->whereNotNull('lesson_id')
            ->selectRaw('teacher_id, lesson_id, COUNT(*) as sales_count')
            ->groupBy('teacher_id', 'lesson_id')
            ->get()
            ->groupBy('teacher_id');

        $courseTitles = Course::whereIn('teacher_id', $teacherIds)->pluck('title', 'id');
        $packageTitles = \App\Models\Package::pluck('title', 'id');
        $lessonTitles = \App\Models\Lesson::pluck('title', 'id');

        $data = $teachers->map(function($teacher) use (
            $teacherRevenueStats, 
            $teacherPayoutStats,
            $courseSales,
            $packageSales,
            $lessonSales,
            $courseTitles,
            $packageTitles,
            $lessonTitles
        ) {
            $stats = $teacherRevenueStats->get($teacher->id);
            $payouts = $teacherPayoutStats->get($teacher->id);

            $topProduct = 'N/A';
            $maxSales = 0;

            $teacherCourses = $courseSales->get($teacher->id) ?: collect();
            foreach ($teacherCourses as $cs) {
                if ($cs->sales_count > $maxSales) {
                    $maxSales = $cs->sales_count;
                    $topProduct = $courseTitles->get($cs->course_id) ?: 'Course';
                }
            }

            $teacherPackages = $packageSales->get($teacher->id) ?: collect();
            foreach ($teacherPackages as $ps) {
                if ($ps->sales_count > $maxSales) {
                    $maxSales = $ps->sales_count;
                    $topProduct = $packageTitles->get($ps->package_id) ?: 'Package';
                }
            }

            $teacherLessons = $lessonSales->get($teacher->id) ?: collect();
            foreach ($teacherLessons as $ls) {
                if ($ls->sales_count > $maxSales) {
                    $maxSales = $ls->sales_count;
                    $topProduct = $lessonTitles->get($ls->lesson_id) ?: 'Lecture';
                }
            }

            $totalRev = $stats ? (float)$stats->total_revenue : 0.00;
            $salesCnt = $stats ? (int)$stats->sales_count : 0;

            return [
                'teacher' => [
                    'id' => $teacher->id,
                    'name' => $teacher->name,
                    'subject' => $teacher->subject ?: 'N/A',
                ],
                'total_revenue' => $totalRev,
                'today_revenue' => $stats ? (float)$stats->today_revenue : 0.00,
                'week_revenue' => $stats ? (float)$stats->week_revenue : 0.00,
                'month_revenue' => $stats ? (float)$stats->month_revenue : 0.00,
                'year_revenue' => $stats ? (float)$stats->year_revenue : 0.00,
                'sales_count' => $salesCnt,
                'avg_order_value' => $salesCnt > 0 ? round($totalRev / $salesCnt, 2) : 0.00,
                'top_selling_products' => $topProduct !== 'N/A' ? "{$topProduct} ({$maxSales} sales)" : 'N/A',
                'pending_payouts' => $payouts ? (float)$payouts->pending_payouts : 0.00,
                'completed_payouts' => $payouts ? (float)$payouts->completed_payouts : 0.00,
            ];
        });

        return response()->json($data);
    }

    /**
     * Student detailed purchase tracking.
     */
    public function studentsReport(Request $request)
    {
        $search = $request->query('search');

        $query = User::where('role', 'student');
        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate(20);
        $studentIds = collect($paginator->items())->pluck('id')->toArray();

        $studentStats = PaymentHistory::whereIn('student_id', $studentIds)
            ->selectRaw("
                student_id,
                SUM(amount) as total_spending,
                COUNT(*) as purchases_count,
                MAX(created_at) as last_purchase_date
            ")
            ->groupBy('student_id')
            ->get()
            ->keyBy('student_id');

        $favTeachers = PaymentHistory::whereIn('student_id', $studentIds)
            ->selectRaw('student_id, teacher_id, COUNT(*) as count')
            ->groupBy('student_id', 'teacher_id')
            ->orderByDesc('count')
            ->get()
            ->groupBy('student_id');

        $favSubjects = PaymentHistory::whereIn('payment_histories.student_id', $studentIds)
            ->join('courses', 'payment_histories.course_id', '=', 'courses.id')
            ->selectRaw('payment_histories.student_id, courses.subject, COUNT(*) as count')
            ->groupBy('payment_histories.student_id', 'courses.subject')
            ->orderByDesc('count')
            ->get()
            ->groupBy('student_id');

        $favProductTypes = PaymentHistory::whereIn('student_id', $studentIds)
            ->leftJoin('packages', 'payment_histories.package_id', '=', 'packages.id')
            ->selectRaw("
                payment_histories.student_id,
                SUM(CASE WHEN payment_histories.course_id IS NOT NULL AND payment_histories.package_id IS NULL AND payment_histories.lesson_id IS NULL THEN 1 ELSE 0 END) as course_count,
                SUM(CASE WHEN payment_histories.package_id IS NOT NULL AND packages.type = 'bundle' THEN 1 ELSE 0 END) as bundle_count,
                SUM(CASE WHEN payment_histories.package_id IS NOT NULL AND packages.type = 'month' THEN 1 ELSE 0 END) as month_count,
                SUM(CASE WHEN payment_histories.package_id IS NOT NULL AND packages.type = 'revision' THEN 1 ELSE 0 END) as revision_count,
                SUM(CASE WHEN payment_histories.lesson_id IS NOT NULL THEN 1 ELSE 0 END) as lesson_count
            ")
            ->groupBy('payment_histories.student_id')
            ->get()
            ->keyBy('student_id');

        $teacherNames = User::where('role', 'teacher')->pluck('name', 'id');

        $data = collect($paginator->items())->map(function($student) use (
            $studentStats, 
            $favTeachers, 
            $favSubjects, 
            $favProductTypes,
            $teacherNames
        ) {
            $stats = $studentStats->get($student->id);
            
            $favTeacherId = null;
            $tGroup = $favTeachers->get($student->id);
            if ($tGroup && $tGroup->count() > 0) {
                $favTeacherId = $tGroup->sortByDesc('count')->first()->teacher_id;
            }
            $favTeacher = $favTeacherId ? ($teacherNames->get($favTeacherId) ?: 'N/A') : 'N/A';

            $favSub = 'N/A';
            $sGroup = $favSubjects->get($student->id);
            if ($sGroup && $sGroup->count() > 0) {
                $favSub = $sGroup->sortByDesc('count')->first()->subject ?: 'N/A';
            }

            $favType = 'N/A';
            $typeStats = $favProductTypes->get($student->id);
            if ($typeStats) {
                $counts = [
                    'Course' => (int)$typeStats->course_count,
                    'Bundle' => (int)$typeStats->bundle_count,
                    'Monthly Package' => (int)$typeStats->month_count,
                    'Revision Package' => (int)$typeStats->revision_count,
                    'Standalone Lecture' => (int)$typeStats->lesson_count,
                ];
                arsort($counts);
                $firstKey = key($counts);
                if ($counts[$firstKey] > 0) {
                    $favType = $firstKey;
                }
            }

            return [
                'student' => [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'phone' => $student->phone,
                ],
                'total_spending' => $stats ? (float)$stats->total_spending : 0.00,
                'purchases_count' => $stats ? (int)$stats->purchases_count : 0,
                'last_purchase_date' => $stats ? $stats->last_purchase_date : null,
                'favorite_teacher' => $favTeacher,
                'favorite_subject' => $favSub,
                'favorite_product_type' => $favType,
            ];
        });

        return response()->json([
            'data' => $data,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
        ]);
    }

    /**
     * Create manual adjustment for teacher balance.
     */
    public function adjustTeacherBalance(Request $request, $id)
    {
        $request->validate([
            'amount' => 'required|numeric',
            'description' => 'required|string|max:255',
        ]);

        $teacher = User::where('role', 'teacher')->findOrFail($id);
        
        $oldBalance = TeacherEarning::where('teacher_id', $teacher->id)->sum('amount') - TeacherPayout::where('teacher_id', $teacher->id)->where('status', 'completed')->sum('amount');
        $newBalance = $oldBalance + $request->amount;

        $admin = $request->user();

        TeacherEarning::create([
            'teacher_id' => $teacher->id,
            'amount' => (float)$request->amount,
            'source' => 'manual_adjustment',
            'status' => 'completed',
            'description' => $request->description,
        ]);

        // Audit Log entry
        FinancialAuditLog::create([
            'admin_id' => $admin ? $admin->id : null,
            'admin_name' => $admin ? $admin->name : 'System/Admin',
            'action' => "Manual Adjustment (Teacher: {$teacher->name})",
            'previous_value' => "Balance: {$oldBalance} EGP",
            'new_value' => "Balance: {$newBalance} EGP (Adj: {$request->amount} EGP)",
            'reason' => $request->description,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم إضافة التسوية المالية اليدوية بنجاح.',
        ]);
    }

    /**
     * Detailed chronological financial statement for a teacher (bank statement style).
     */
    public function teacherStatement(Request $request, $id)
    {
        $teacher = User::where('role', 'teacher')->findOrFail($id);

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $openingBalance = 0.00;
        if ($startDate) {
            $prevEarnings = TeacherEarning::where('teacher_id', $teacher->id)
                ->where('created_at', '<', Carbon::parse($startDate))
                ->sum('amount');
            $prevPayouts = TeacherPayout::where('teacher_id', $teacher->id)
                ->where('status', 'completed')
                ->where('payout_date', '<', Carbon::parse($startDate))
                ->sum('amount');
            $openingBalance = (float)$prevEarnings - (float)$prevPayouts;
        }

        $earningsQuery = TeacherEarning::where('teacher_id', $teacher->id);
        $payoutsQuery = TeacherPayout::where('teacher_id', $teacher->id);

        if ($startDate) {
            $earningsQuery->where('created_at', '>=', Carbon::parse($startDate));
            $payoutsQuery->where('created_at', '>=', Carbon::parse($startDate));
        }
        if ($endDate) {
            $earningsQuery->where('created_at', '<=', Carbon::parse($endDate));
            $payoutsQuery->where('created_at', '<=', Carbon::parse($endDate));
        }

        $earnings = $earningsQuery->get();
        $payouts = $payoutsQuery->get();

        $events = collect();

        foreach ($earnings as $e) {
            $type = 'Sale';
            $description = 'مبيعات منتج للطلاب';
            
            if ($e->source === 'manual_adjustment') {
                $type = 'Adjustment';
                $description = $e->description ?: 'تسوية يدوية مضافة من الإدارة';
            } elseif ($e->source === 'reversal') {
                $type = 'Reversal';
                $description = 'إلغاء معاملة واسترجاع أرباح المعلم';
            } elseif ($e->course_id) {
                $course = Course::find($e->course_id);
                $description = 'مبيعات كورس: ' . ($course ? $course->title : 'كورس');
            } elseif ($e->package_id) {
                $package = \App\Models\Package::find($e->package_id);
                $description = 'مبيعات باقة: ' . ($package ? $package->title : 'باقة');
            } elseif ($e->lesson_id) {
                $lesson = \App\Models\Lesson::find($e->lesson_id);
                $description = 'مبيعات محاضرة فردية: ' . ($lesson ? $lesson->title : 'محاضرة');
            }

            $events->push([
                'id' => 'earn_' . $e->id,
                'date' => $e->created_at->toDateTimeString(),
                'timestamp' => $e->created_at->timestamp,
                'type' => $type,
                'description' => $description,
                'amount' => (float)$e->amount,
            ]);
        }

        foreach ($payouts as $p) {
            $type = 'Withdrawal';
            $description = 'سحب رصيد: ' . ($p->notes ?: 'تحويل نقدي للمستحقات');

            $events->push([
                'id' => 'payout_' . $p->id,
                'date' => $p->created_at->toDateTimeString(),
                'timestamp' => $p->created_at->timestamp,
                'type' => $type,
                'description' => $description,
                'amount' => -((float)$p->amount),
                'status' => $p->status,
            ]);
        }

        $sortedEvents = $events->sortBy('timestamp')->values();
        $currentRunning = $openingBalance;
        $timeline = [];
        
        foreach ($sortedEvents as $ev) {
            if ($ev['type'] === 'Withdrawal' && isset($ev['status']) && $ev['status'] !== 'completed') {
                $ev['running_balance'] = round($currentRunning, 2);
            } else {
                $currentRunning += $ev['amount'];
                $ev['running_balance'] = round($currentRunning, 2);
            }
            $timeline[] = $ev;
        }

        $totalAllEarnings = TeacherEarning::where('teacher_id', $teacher->id)->sum('amount');
        $totalAllPayouts = TeacherPayout::where('teacher_id', $teacher->id)->where('status', 'completed')->sum('amount');
        $currentBalance = (float)$totalAllEarnings - (float)$totalAllPayouts;

        return response()->json([
            'teacher' => [
                'id' => $teacher->id,
                'name' => $teacher->name,
                'subject' => $teacher->subject ?: 'N/A',
            ],
            'opening_balance' => round($openingBalance, 2),
            'current_balance' => round($currentBalance, 2),
            'timeline' => array_reverse($timeline),
        ]);
    }

    /**
     * Detailed ledger for a student purchase history.
     */
    public function studentLedger(Request $request, $id)
    {
        $student = User::where('role', 'student')->findOrFail($id);

        $ledger = PaymentHistory::where('student_id', $student->id)
            ->with(['course', 'package', 'lesson', 'teacher'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function($ph) {
                $productType = 'Course';
                $productName = $ph->course ? $ph->course->title : 'Unknown Course';

                if ($ph->package_id) {
                    if ($ph->package) {
                        if ($ph->package->type === 'bundle') {
                            $productType = 'Bundle';
                        } elseif ($ph->package->type === 'month') {
                            $productType = 'Monthly Package';
                        } else {
                            $productType = 'Revision Package';
                        }
                        $productName = $ph->package->title;
                    } else {
                        $productType = 'Package';
                        $productName = 'Unknown Package';
                    }
                } elseif ($ph->lesson_id) {
                    $productType = 'Standalone Lecture';
                    $productName = $ph->lesson ? $ph->lesson->title : 'Unknown Lecture';
                }

                $originalPrice = (float)$ph->amount;
                $discount = 0.00;
                if ($ph->course) {
                    $originalPrice = (float)$ph->course->price;
                    $discount = max(0.00, $originalPrice - (float)$ph->amount);
                } elseif ($ph->package) {
                    $originalPrice = (float)$ph->package->price;
                    $discount = max(0.00, $originalPrice - (float)$ph->amount);
                } elseif ($ph->lesson) {
                    $originalPrice = (float)$ph->lesson->price;
                    $discount = max(0.00, $originalPrice - (float)$ph->amount);
                }

                return [
                    'id' => $ph->id,
                    'date' => $ph->created_at->toDateTimeString(),
                    'product_type' => $productType,
                    'product_name' => $productName,
                    'teacher_name' => $ph->teacher ? $ph->teacher->name : 'Deleted Teacher',
                    'original_price' => $originalPrice,
                    'discount' => $discount,
                    'amount' => (float)$ph->amount,
                    'payment_method' => $ph->payment_method === 'wallet' ? 'رصيد محفظة' : 'كود تفعيل',
                    'status' => $ph->status,
                ];
            });

        return response()->json([
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'phone' => $student->phone,
            ],
            'ledger' => $ledger,
        ]);
    }

    /**
     * Financial Audit Logs list (for administrative visibility).
     */
    public function auditLogs(Request $request)
    {
        $logs = FinancialAuditLog::orderBy('created_at', 'desc')->paginate(30);
        return response()->json($logs);
    }

    /**
     * CSV Export of a specific Daily Closing report.
     */
    public function exportDailyClosing(Request $request)
    {
        $dateStr = $request->query('date', Carbon::today()->toDateString());

        // Calculate statistics
        $totalRevenue = PaymentHistory::whereDate('created_at', $dateStr)->sum('amount');
        $teacherShare = TeacherEarning::whereDate('created_at', $dateStr)->sum('amount');
        $platformShare = PlatformEarning::whereDate('created_at', $dateStr)->sum('amount');
        $refundsSum = \App\Models\RefundLog::whereDate('created_at', $dateStr)->sum('amount');
        $newStudents = User::where('role', 'student')->whereDate('created_at', $dateStr)->count();
        $purchasesCount = PaymentHistory::whereDate('created_at', $dateStr)->count();

        // Tops
        $tList = PaymentHistory::whereDate('created_at', $dateStr)
            ->selectRaw('teacher_id, SUM(amount) as total_amount')
            ->groupBy('teacher_id')
            ->orderByDesc('total_amount')
            ->first();
        $topTeacherName = $tList && $tList->teacher ? $tList->teacher->name : 'N/A';

        $cList = PaymentHistory::whereDate('created_at', $dateStr)
            ->whereNotNull('course_id')
            ->whereNull('package_id')
            ->whereNull('lesson_id')
            ->selectRaw('course_id, COUNT(*) as count')
            ->groupBy('course_id')
            ->orderByDesc('count')
            ->first();
        $topCourseTitle = $cList && $cList->course ? $cList->course->title : 'N/A';

        $bList = PaymentHistory::whereDate('created_at', $dateStr)
            ->whereNotNull('package_id')
            ->join('packages', 'payment_histories.package_id', '=', 'packages.id')
            ->where('packages.type', 'bundle')
            ->selectRaw('payment_histories.package_id, COUNT(*) as count')
            ->groupBy('payment_histories.package_id')
            ->orderByDesc('count')
            ->first();
        $topBundleTitle = $bList && $bList->package ? $bList->package->title : 'N/A';

        $sList = PaymentHistory::whereDate('payment_histories.created_at', $dateStr)
            ->join('courses', 'payment_histories.course_id', '=', 'courses.id')
            ->selectRaw('courses.subject, SUM(payment_histories.amount) as total_amount')
            ->groupBy('courses.subject')
            ->orderByDesc('total_amount')
            ->first();
        $topSubject = $sList ? $sList->subject : 'N/A';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="daily_closing_report_' . $dateStr . '.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0'
        ];

        $callback = function() use ($dateStr, $totalRevenue, $platformShare, $teacherShare, $refundsSum, $purchasesCount, $newStudents, $topTeacherName, $topCourseTitle, $topBundleTitle, $topSubject) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($file, ['تقرير الإغلاق اليومي للمنصة (Daily Closing Report)']);
            fputcsv($file, ['التاريخ', $dateStr]);
            fputcsv($file, []);
            fputcsv($file, ['البند المالي', 'القيمة بالجنيه المصري']);
            fputcsv($file, ['إجمالي المبيعات (Total Sales)', $totalRevenue]);
            fputcsv($file, ['أرباح المنصة (Platform Profit)', $platformShare]);
            fputcsv($file, ['أرباح المدرسين (Teachers Profit)', $teacherShare]);
            fputcsv($file, ['المبالغ المسترجعة (Refunds)', $refundsSum]);
            fputcsv($file, []);
            fputcsv($file, ['إحصائيات غير مالية', 'العدد']);
            fputcsv($file, ['الطلاب الجدد (New Students)', $newStudents]);
            fputcsv($file, ['عدد عمليات الشراء (New Purchases)', $purchasesCount]);
            fputcsv($file, []);
            fputcsv($file, ['الأعلى تحقيقاً', 'الاسم / العنوان']);
            fputcsv($file, ['المعلم الأعلى مبيعاً (Top Teacher)', $topTeacherName]);
            fputcsv($file, ['الكورس الأكثر مبيعاً (Top Course)', $topCourseTitle]);
            fputcsv($file, ['الباقة الأكثر مبيعاً (Top Bundle)', $topBundleTitle]);
            fputcsv($file, ['المادة الأكثر مبيعاً (Top Subject)', $topSubject]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * CSV Export of the filtered transactions list
     */
    public function export(Request $request)
    {
        $range = $request->query('range', 'this_month');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $query = PaymentHistory::with(['student', 'teacher', 'course', 'package', 'lesson', 'purchaseCode']);
        $query = $this->applyGeneralFilters($query, $request);
        $query = $this->applyDateFilter($query, $range, $startDate, $endDate);
        
        $transactions = $query->orderBy('payment_histories.created_at', 'desc')->get();

        $studentIds = $transactions->pluck('student_id')->unique()->toArray();
        $teacherIds = $transactions->pluck('teacher_id')->unique()->toArray();

        $teacherEarnings = TeacherEarning::whereIn('student_id', $studentIds)
            ->whereIn('teacher_id', $teacherIds)
            ->get();

        $platformEarnings = PlatformEarning::whereIn('student_id', $studentIds)
            ->whereIn('teacher_id', $teacherIds)
            ->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="financial_report_' . date('Y-m-d_H-i-s') . '.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0'
        ];

        $callback = function() use ($transactions, $teacherEarnings, $platformEarnings) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($file, [
                'Date & Time',
                'Transaction ID',
                'Student ID',
                'Student Name',
                'Teacher ID',
                'Teacher Name',
                'Product Type',
                'Product Name',
                'Original Price',
                'Discount',
                'Final Paid Amount',
                'Teacher Share',
                'Platform Share',
                'Payment Method',
                'Wallet Transaction ID',
                'Status'
            ]);

            foreach ($transactions as $ph) {
                $te = $teacherEarnings->first(function($e) use ($ph) {
                    return $e->student_id == $ph->student_id 
                        && $e->teacher_id == $ph->teacher_id
                        && $e->course_id == $ph->course_id 
                        && $e->package_id == $ph->package_id 
                        && $e->lesson_id == $ph->lesson_id
                        && abs(strtotime($e->created_at) - strtotime($ph->created_at)) < 15;
                });

                $pe = $platformEarnings->first(function($e) use ($ph) {
                    return $e->student_id == $ph->student_id 
                        && $e->teacher_id == $ph->teacher_id
                        && $e->course_id == $ph->course_id 
                        && $e->package_id == $ph->package_id 
                        && $e->lesson_id == $ph->lesson_id
                        && abs(strtotime($e->created_at) - strtotime($ph->created_at)) < 15;
                });

                $productType = 'Course';
                $productName = $ph->course ? $ph->course->title : 'Unknown Course';

                if ($ph->package_id) {
                    if ($ph->package) {
                        if ($ph->package->type === 'bundle') {
                            $productType = 'Bundle';
                        } elseif ($ph->package->type === 'month') {
                            $productType = 'Monthly Package';
                        } else {
                            $productType = 'Revision Package';
                        }
                        $productName = $ph->package->title;
                    } else {
                        $productType = 'Package';
                        $productName = 'Unknown Package';
                    }
                } elseif ($ph->lesson_id) {
                    $productType = 'Standalone Lecture';
                    $productName = $ph->lesson ? $ph->lesson->title : 'Unknown Lecture';
                }

                $originalPrice = (float)$ph->amount;
                $discount = 0.00;
                if ($ph->course) {
                    $originalPrice = (float)$ph->course->price;
                    $discount = max(0.00, $originalPrice - (float)$ph->amount);
                } elseif ($ph->package) {
                    $originalPrice = (float)$ph->package->price;
                    $discount = max(0.00, $originalPrice - (float)$ph->amount);
                } elseif ($ph->lesson) {
                    $originalPrice = (float)$ph->lesson->price;
                    $discount = max(0.00, $originalPrice - (float)$ph->amount);
                }

                fputcsv($file, [
                    $ph->created_at->toDateTimeString(),
                    $ph->id,
                    $ph->student_id,
                    $ph->student ? $ph->student->name : 'Deleted Student',
                    $ph->teacher_id,
                    $ph->teacher ? $ph->teacher->name : 'Deleted Teacher',
                    $productType,
                    $productName,
                    $originalPrice,
                    $discount,
                    $ph->amount,
                    $te ? (float)$te->amount : round($ph->amount * 0.8, 2),
                    $pe ? (float)$pe->amount : round($ph->amount * 0.2, 2),
                    $ph->payment_method,
                    $te ? $te->id : '',
                    $ph->status
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
