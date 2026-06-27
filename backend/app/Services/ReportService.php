<?php

namespace App\Services;

use App\Models\WalletTransaction;
use App\Models\User;
use App\Models\Course;
use App\Models\Package;
use App\Models\Unit;
use App\Models\Lesson;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * Compile general sales and revenue reports.
     */
    public function getAdminSalesReport()
    {
        $transactions = WalletTransaction::whereIn('type', ['purchase', 'refund'])
            ->with('wallet.student')
            ->latest()
            ->get();

        $refundedKeys = [];
        foreach ($transactions as $tx) {
            if ($tx->type === 'refund') {
                $refId = $tx->reference_id;
                $itemType = 'course';
                if (str_contains($tx->description, 'باقة')) {
                    $itemType = 'bundle';
                } elseif (str_contains($tx->description, 'محاضرة') || str_contains($tx->description, 'درس')) {
                    $itemType = 'lesson';
                }
                $refundedKeys[$tx->wallet_id][$refId][$itemType] = true;
            }
        }

        $sales = $transactions->filter(function ($tx) use ($refundedKeys) {
            if ($tx->type !== 'purchase') return false;
            $refId = $tx->reference_id;
            $itemType = 'course';
            if (str_contains($tx->description, 'باقة')) {
                $itemType = 'bundle';
            } elseif (str_contains($tx->description, 'محاضرة') || str_contains($tx->description, 'درس')) {
                $itemType = 'lesson';
            }
            return !isset($refundedKeys[$tx->wallet_id][$refId][$itemType]);
        })->values();

        $monthlySales = WalletTransaction::whereIn('type', ['purchase', 'refund'])
            ->select(
                DB::raw("COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE -amount END), 0) as total"),
                DB::raw("TO_CHAR(created_at, 'YYYY-MM') as month")
            )
            ->groupBy('month')
            ->orderBy('month', 'desc')
            ->get();

        return [
            'sales' => $sales,
            'monthlySales' => $monthlySales,
        ];
    }

    /**
     * Compile teacher financial share report.
     */
    public function getTeacherRevenueReport(int $teacherId)
    {
        $t = User::findOrFail($teacherId);
        $tCourseIds = Course::where('teacher_id', $t->id)->pluck('id');
        $tCourseIdsStr = $tCourseIds->map(fn($id) => (string)$id)->toArray();

        $tPackageIds = Package::whereIn('course_id', $tCourseIds)->pluck('id')->toArray();
        $tPackageIdsStr = array_map('strval', $tPackageIds);

        $tUnitIds = Unit::whereIn('course_id', $tCourseIds)->pluck('id');
        $tLessonIds = Lesson::whereIn('unit_id', $tUnitIds)->pluck('id')->toArray();
        $tLessonIdsStr = array_map('strval', $tLessonIds);

        // Sum purchases
        $purchasesQuery = WalletTransaction::where('type', 'purchase')
            ->where(function ($q) use ($tCourseIdsStr, $tPackageIdsStr, $tLessonIdsStr) {
                $q->where(function ($sq) use ($tCourseIdsStr) {
                    $sq->where('description', 'like', '%شراء كورس%')
                        ->whereIn('reference_id', $tCourseIdsStr);
                })->orWhere(function ($sq) use ($tPackageIdsStr) {
                    $sq->where('description', 'like', '%شراء باقة%')
                        ->whereIn('reference_id', $tPackageIdsStr);
                })->orWhere(function ($sq) use ($tLessonIdsStr) {
                    $sq->where(function ($lq) {
                        $lq->where('description', 'like', '%شراء محاضرة%')
                            ->orWhere('description', 'like', '%شراء درس%');
                    })->whereIn('reference_id', $tLessonIdsStr);
                });
            });

        $totalPurchases = $purchasesQuery->sum('amount');
        $purchasesList = $purchasesQuery->with('wallet.student')->latest()->get();

        // Sum refunds
        $refundsQuery = WalletTransaction::where('type', 'refund')
            ->where(function ($q) use ($tCourseIdsStr, $tPackageIdsStr, $tLessonIdsStr) {
                $q->where(function ($sq) use ($tCourseIdsStr) {
                    $sq->where('description', 'like', '%استرجاع كورس%')
                        ->whereIn('reference_id', $tCourseIdsStr);
                })->orWhere(function ($sq) use ($tPackageIdsStr) {
                    $sq->where('description', 'like', '%استرجاع باقة%')
                        ->whereIn('reference_id', $tPackageIdsStr);
                })->orWhere(function ($sq) use ($tLessonIdsStr) {
                    $sq->where('description', 'like', '%استرجاع محاضرة%')
                        ->whereIn('reference_id', $tLessonIdsStr);
                });
            });

        $totalRefunds = $refundsQuery->sum('amount');

        // Net Revenue
        $netRevenue = max(0, $totalPurchases - $totalRefunds);

        // Teacher share calculations (e.g. 85%)
        $systemRatio = 0.15; // 15% platform fee
        $teacherShare = $netRevenue * (1 - $systemRatio);
        $systemShare = $netRevenue * $systemRatio;

        return [
            'gross_revenue' => $totalPurchases,
            'refunded_revenue' => $totalRefunds,
            'net_revenue' => $netRevenue,
            'teacher_share' => $teacherShare,
            'system_share' => $systemShare,
            'transactions' => $purchasesList,
        ];
    }
}
