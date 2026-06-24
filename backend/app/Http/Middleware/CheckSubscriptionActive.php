<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\TeacherSubscription;
use Carbon\Carbon;

class CheckSubscriptionActive
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isTeacher()) {
            $subscription = TeacherSubscription::where('teacher_id', $user->id)->first();

            // If no subscription, create a default Starter subscription (1 month)
            if (!$subscription) {
                $starter = \App\Models\SubscriptionPlan::where('name', 'Starter')->first();
                $subscription = TeacherSubscription::create([
                    'teacher_id' => $user->id,
                    'plan_id' => $starter ? $starter->id : 1,
                    'start_date' => Carbon::now()->toDateString(),
                    'end_date' => Carbon::now()->addDays(30)->toDateString(),
                    'status' => 'Active',
                    'used_storage_bytes' => 0,
                    'used_codes' => 0,
                    'billing_period' => 'monthly',
                ]);
            }

            // Sync quotas
            $today = Carbon::today();
            $endDate = Carbon::parse($subscription->end_date);
            $isExpired = $today->gt($endDate) || $subscription->status === 'Expired';

            if ($isExpired || $subscription->status === 'Suspended') {
                // Update status in DB if expired
                if ($subscription->status !== 'Expired' && $subscription->status !== 'Suspended') {
                    $subscription->update(['status' => 'Expired']);
                }

                return response()->json([
                    'message' => 'عذراً، انتهت صلاحية باقة اشتراكك أو تم تعليقها. يرجى تجديد الاشتراك أو اختيار باقة مدفوعة للمتابعة.',
                    'subscription_expired' => true,
                ], 403);
            }
        }

        return $next($request);
    }
}
