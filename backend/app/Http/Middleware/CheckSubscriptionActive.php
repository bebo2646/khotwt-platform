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

            // If no subscription, create a default Starter subscription (30 days)
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

            // Sync quotas/calculate status
            $statusDetails = $subscription->calculateStatusDetails();
            $status = $statusDetails['status'];

            if ($status === 'Expired' || $subscription->status === 'Suspended') {
                return response()->json([
                    'message' => 'عذراً، انتهت صلاحية باقة اشتراكك. يرجى تجديد الاشتراك للمتابعة.',
                    'subscription_expired' => true,
                ], 403);
            }

            if ($status === 'Grace Period') {
                $routeAction = $request->route() ? $request->route()->getActionMethod() : '';
                $routePath = $request->path();

                $blockedActions = ['createCourse', 'addLesson', 'addVideo', 'replaceVideo', 'generateSignedUpload'];
                if (in_array($routeAction, $blockedActions) || 
                    str_contains($routePath, 'signed-upload') || 
                    (str_contains($routePath, 'lessons') && str_contains($routePath, 'video'))) {
                    
                    return response()->json([
                        'message' => 'عذراً، لا يمكنك تنفيذ هذا الإجراء (إنشاء كورس، نشر درس، أو رفع فيديو) خلال فترة السماح. يرجى تجديد اشتراكك لتفعيل كامل الميزات.',
                        'subscription_grace_blocked' => true,
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
