<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionRequest;
use App\Models\AdminActivityLog;
use App\Models\TeacherResourceOverride;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Notification;
use App\Models\Unit;
use App\Models\Lesson;
use App\Services\BunnySubscriptionService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    protected $syncService;
    protected $notificationService;

    public function __construct(BunnySubscriptionService $syncService, NotificationService $notificationService)
    {
        $this->syncService = $syncService;
        $this->notificationService = $notificationService;
    }

    /*
     * ----------------------------------------------------
     * Admin Endpoints
     * ----------------------------------------------------
     */

    /**
     * Get details of a teacher's subscription.
     */
    public function getTeacherSubscription(Request $request, $id)
    {
        $teacher = User::where('role', 'teacher')->findOrFail($id);

        // Fetch or create subscription
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
        if (!$subscription) {
            $starter = SubscriptionPlan::where('name', 'Starter')->first();
            $plan = $starter ?: SubscriptionPlan::first();
            $details = $this->getSubscriptionPriceDetails($plan, 'monthly');
            $subscription = TeacherSubscription::create([
                'teacher_id' => $teacher->id,
                'plan_id' => $plan->id,
                'billing_period' => 'monthly',
                'billing_cycle' => 'monthly',
                'discount_percentage' => $details['discount_percentage'],
                'discount_amount' => $details['discount_amount'],
                'final_price' => $details['final_price'],
                'start_date' => Carbon::now()->toDateString(),
                'end_date' => Carbon::now()->addYear()->toDateString(),
                'status' => 'Active',
                'used_storage_bytes' => 0,
                'used_codes' => 0,
            ]);
        }

        // Run real-time sync with Bunny Stream
        $this->syncService->syncStorageAndCodes($teacher->id);
        $subscription->refresh();

        // Calculate student count
        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');
        $studentsCount = Enrollment::whereIn('course_id', $courseIds)->distinct('student_id')->count('student_id');

        $coursesCount = Course::where('teacher_id', $teacher->id)->count();

        // Calculate Revenue
        $courseIdsStr = $courseIds->map('strval')->toArray();
        $packageIds = \App\Models\Package::whereIn('course_id', $courseIds)->pluck('id')->toArray();
        $packageIdsStr = array_map('strval', $packageIds);
        $unitIds = Unit::whereIn('course_id', $courseIds)->pluck('id');
        $lessonIds = Lesson::whereIn('unit_id', $unitIds)->pluck('id')->toArray();
        $lessonIdsStr = array_map('strval', $lessonIds);

        $grossRevenue = \App\Models\WalletTransaction::where('type', 'purchase')
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
            })->sum('amount');

        $refundedRevenue = \App\Models\WalletTransaction::where('type', 'refund')
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
            })->sum('amount');

        $currentRevenue = (float)($grossRevenue - $refundedRevenue);

        // Expiration remaining days
        $today = Carbon::today();
        $endDate = Carbon::parse($subscription->end_date);
        $remainingDays = $today->diffInDays($endDate, false);

        // Payment status
        $payment = \App\Models\SubscriptionPayment::where('teacher_subscription_id', $subscription->id)
            ->latest()
            ->first();
        $paymentStatus = $payment ? $payment->payment_status : 'Pending';

        return response()->json([
            'teacher' => [
                'id' => $teacher->id,
                'name' => $teacher->name,
                'email' => $teacher->email,
                'phone' => $teacher->phone,
            ],
            'subscription' => [
                'id' => $subscription->id,
                'plan' => $subscription->plan,
                'start_date' => $subscription->start_date->toDateString(),
                'end_date' => $subscription->end_date->toDateString(),
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'billing_period' => $subscription->billing_period,
                'final_price' => $subscription->final_price,
                'discount_percentage' => $subscription->discount_percentage,
                'discount_amount' => $subscription->discount_amount,
                'used_storage_bytes' => $subscription->used_storage_bytes,
                'used_codes' => $subscription->used_codes,
                'extra_storage_gb' => $subscription->extra_storage_gb,
                'extra_codes' => $subscription->extra_codes,
                'total_storage_gb' => $subscription->total_storage_gb,
                'total_codes' => $subscription->total_codes,
                'remaining_storage_gb' => $subscription->remaining_storage_gb,
                'remaining_codes' => $subscription->remaining_codes,
                'storage_percentage' => $subscription->storage_percentage,
                'students_count' => $studentsCount,
                'courses_count' => $coursesCount,
                'current_revenue' => $currentRevenue,
                'remaining_days' => max(0, $remainingDays),
                'payment_status' => $paymentStatus,
            ],
            'addons' => $subscription->addons()->orderBy('created_at', 'desc')->get(),
            'payments' => $subscription->payments()->orderBy('created_at', 'desc')->get(),
            'plans' => SubscriptionPlan::orderBy('sort_order', 'asc')->get(),
            'settings' => $this->getSettings(),
            'activation_code_packages' => \App\Models\ActivationCodePackage::orderBy('sort_order', 'asc')->get(),
            'storage_packages' => \App\Models\StoragePackage::orderBy('sort_order', 'asc')->get(),
        ]);
    }

    /**
     * Update a teacher's plan.
     */
    public function updateTeacherPlan(Request $request, $id)
    {
        $request->validate([
            'plan_id' => 'required|exists:subscription_plans,id',
            'duration_months' => 'nullable|integer|min:1',
            'billing_period' => 'nullable|string|in:monthly,quarterly,semi_annual,annual,yearly',
            'duration_days' => 'nullable|integer|min:1',
            'activation_code_package_id' => 'nullable|exists:activation_code_packages,id',
        ]);

        $teacher = User::where('role', 'teacher')->findOrFail($id);
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();
        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        $billingPeriod = $request->billing_period;
        if ($billingPeriod === 'yearly') {
            $billingPeriod = 'annual';
        }
        $months = $request->duration_months;
        $durationDays = $request->duration_days;

        if ($durationDays) {
            $billingPeriod = is_numeric($request->billing_period) ? 'custom' : ($request->billing_period ?: 'custom');
        } else {
            if ($billingPeriod) {
                if ($billingPeriod === 'monthly') {
                    $months = 1;
                } elseif ($billingPeriod === 'quarterly') {
                    $months = 3;
                } elseif ($billingPeriod === 'semi_annual') {
                    $months = 6;
                } elseif ($billingPeriod === 'annual') {
                    $months = 12;
                }
                $durationDays = $months * 30;
            } else {
                if ($months == 1) {
                    $billingPeriod = 'monthly';
                } elseif ($months == 3) {
                    $billingPeriod = 'quarterly';
                } elseif ($months == 6) {
                    $billingPeriod = 'semi_annual';
                } elseif ($months == 12) {
                    $billingPeriod = 'annual';
                } else {
                    $billingPeriod = 'monthly';
                }
                $durationDays = ($months ?: 1) * 30;
            }
        }

        $calc = $this->calculateNewSubscriptionDates($subscription, $plan, $billingPeriod, 'upgrade', $durationDays);
        $details = $calc['details'];

        $price = $details['final_price'];
        $grandTotal = $price;
        $paymentNotes = "تجديد/ترقية باقة ({$plan->name}) - دورة {$details['billing_cycle']}";

        if ($request->activation_code_package_id) {
            $codePackage = \App\Models\ActivationCodePackage::findOrFail($request->activation_code_package_id);
            SubscriptionAddon::create([
                'teacher_subscription_id' => $subscription->id,
                'type' => 'codes',
                'amount' => $codePackage->number_of_codes,
                'price_egp' => $codePackage->total_price,
            ]);
            $grandTotal += (float)$codePackage->total_price;
            $paymentNotes .= " + إضافة حزمة أكواد ({$codePackage->name})";
        }

        $subscription->update([
            'plan_id' => $plan->id,
            'billing_period' => $details['billing_cycle'],
            'billing_cycle' => $details['billing_cycle'],
            'discount_percentage' => $details['discount_percentage'],
            'discount_amount' => $details['discount_amount'],
            'final_price' => $price,
            'start_date' => $calc['start_date'],
            'end_date' => $calc['end_date'],
            'status' => 'Active',
        ]);

        // Create subscription payment log
        SubscriptionPayment::create([
            'teacher_subscription_id' => $subscription->id,
            'amount' => $grandTotal,
            'payment_status' => 'Paid',
            'notes' => $paymentNotes,
            'payment_date' => Carbon::now(),
            'admin_name' => $request->user()->name,
            'admin_id' => $request->user()->id ?? null,
        ]);

        // Send Notification
        $this->notificationService->sendNotification(
            'تجديد وترقية الاشتراك',
            "تم تفعيل باقة ({$plan->name}) لاشتراكك بنجاح من قبل الإدارة بدورة دفع ({$billingPeriod}) بقيمة {$grandTotal} ج.م.",
            'specific_teacher',
            $teacher->id
        );

        // Save activity log
        AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تحديث باقة المعلم {$teacher->name} إلى {$plan->name} بدورة دفع {$billingPeriod}",
            'ip_address' => $request->ip(),
        ]);

        $this->syncService->syncStorageAndCodes($teacher->id);

        return response()->json([
            'message' => 'تم تحديث باقة المعلم بنجاح',
            'subscription' => $subscription,
        ]);
    }

    /**
     * Helper to calculate start and end dates based on active/grace/expired state and plan.
     */
    private function calculateNewSubscriptionDates($subscription, $newPlan, $billingCycle, $actionType, $durationDays = null)
    {
        $today = Carbon::today();
        
        // If duration in days is provided or billingCycle is numeric
        if ($durationDays !== null) {
            $days = (int)$durationDays;
        } elseif (is_numeric($billingCycle)) {
            $days = (int)$billingCycle;
        } else {
            // standard billingCycle translation
            if ($billingCycle === 'quarterly') {
                $days = 90;
            } elseif ($billingCycle === 'semi_annual') {
                $days = 180;
            } elseif ($billingCycle === 'annual' || $billingCycle === 'yearly') {
                $days = 365;
            } else {
                $days = 30; // Default is 30 days
            }
        }
        
        // Check if it's renewal of the SAME plan
        $isSamePlan = $subscription && ((int)$subscription->plan_id === (int)$newPlan->id);
        $isRenewal = ($actionType === 'renew') || $isSamePlan;

        if ($subscription) {
            $statusDetails = $subscription->calculateStatusDetails();
            $currentStatus = $statusDetails['status'];
            
            if ($isRenewal) {
                if ($currentStatus === 'Active') {
                    // Renewing while Active: extend old end date
                    $currentEndDate = Carbon::parse($subscription->end_date);
                    $newStartDate = $subscription->start_date->toDateString();
                    $newEndDate = $currentEndDate->addDays($days)->toDateString();
                } else {
                    // Renewing while Grace or Expired: starts from today
                    $newStartDate = $today->toDateString();
                    $newEndDate = $today->copy()->addDays($days)->toDateString();
                }
            } else {
                // Changing plan (Upgrade/Downgrade): start from today
                $newStartDate = $today->toDateString();
                $newEndDate = $today->copy()->addDays($days)->toDateString();
            }
        } else {
            // No previous subscription: starts from today
            $newStartDate = $today->toDateString();
            $newEndDate = $today->copy()->addDays($days)->toDateString();
        }

        // Calculate price dynamically based on days using the plan's monthly price
        $monthlyPrice = (float)($newPlan->price ?? $newPlan->price_egp ?? 0);
        $basePrice = ($monthlyPrice / 30.0) * $days;
        
        $discountPercentage = 0.00;
        if ($durationDays === null && !is_numeric($billingCycle)) {
            $settings = $this->getSettings();
            $semiDiscount = isset($settings['discount_semi_annually']) ? (float)$settings['discount_semi_annually'] : 10.00;
            $annualDiscount = isset($settings['discount_annually']) ? (float)$settings['discount_annually'] : 20.00;
            
            if ($billingCycle === 'semi_annual') {
                $discountPercentage = $semiDiscount;
            } elseif ($billingCycle === 'annual' || $billingCycle === 'yearly') {
                $discountPercentage = $annualDiscount;
            }
        }
        
        $discountAmount = $basePrice * ($discountPercentage / 100.0);
        $finalPrice = $basePrice - $discountAmount;

        return [
            'start_date' => $newStartDate,
            'end_date' => $newEndDate,
            'details' => [
                'months' => round($days / 30.0, 1),
                'days' => $days,
                'billing_cycle' => is_numeric($billingCycle) ? 'custom' : $billingCycle,
                'discount_percentage' => $discountPercentage,
                'discount_amount' => round($discountAmount, 2),
                'final_price' => round($finalPrice, 2),
                'base_price' => round($basePrice, 2)
            ]
        ];
    }

    /**
     * Renew Current Plan.
     */
    public function renewSubscription(Request $request, $id)
    {
        $request->validate([
            'billing_period' => 'required|string|in:monthly,quarterly,semi_annual,annual,yearly',
        ]);

        $teacher = User::where('role', 'teacher')->findOrFail($id);
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();
        $plan = $subscription->plan;

        if (!$plan) {
            return response()->json(['message' => 'المعلم ليس لديه باقة حالية لتجديدها.'], 400);
        }

        $billingPeriod = $request->billing_period;
        if ($billingPeriod === 'yearly') {
            $billingPeriod = 'annual';
        }

        $calc = $this->calculateNewSubscriptionDates($subscription, $plan, $billingPeriod, 'renew');
        $details = $calc['details'];

        $subscription->update([
            'start_date' => $calc['start_date'],
            'end_date' => $calc['end_date'],
            'status' => 'Active',
            'billing_period' => $details['billing_cycle'],
            'billing_cycle' => $details['billing_cycle'],
            'discount_percentage' => $details['discount_percentage'],
            'discount_amount' => $details['discount_amount'],
            'final_price' => $details['final_price'],
        ]);

        $price = $details['final_price'];
        SubscriptionPayment::create([
            'teacher_subscription_id' => $subscription->id,
            'amount' => $price,
            'payment_status' => 'Paid',
            'notes' => "تجديد الباقة الحالية ({$plan->name}) - دورة {$details['billing_cycle']}",
            'payment_date' => Carbon::now(),
            'admin_name' => $request->user()->name,
            'admin_id' => $request->user()->id ?? null,
        ]);

        $this->notificationService->sendNotification(
            'تجديد الاشتراك',
            "تم تجديد اشتراك باقتك الحالية ({$plan->name}) بنجاح بدورة دفع ({$billingPeriod}) بقيمة {$price} ج.م.",
            'specific_teacher',
            $teacher->id
        );

        AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تجديد باقة المعلم {$teacher->name} الحالية ({$plan->name}) بدورة دفع {$billingPeriod}",
            'ip_address' => $request->ip(),
        ]);

        $this->syncService->syncStorageAndCodes($teacher->id);

        return response()->json([
            'message' => 'تم تجديد الاشتراك بنجاح',
            'subscription' => $subscription,
        ]);
    }

    /**
     * Add extra storage or codes addon.
     */
    public function addSubscriptionAddon(Request $request, $id)
    {
        $request->validate([
            'type' => 'required|in:storage,codes',
            'amount' => 'required|integer|min:1',
        ]);

        $teacher = User::where('role', 'teacher')->findOrFail($id);
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();

        // Calculate price
        $price = $this->calculateAddonPrice($request->type, $request->amount);
        if ($request->type === 'storage') {
            $msg = "تم إضافة مساحة تخزين إضافية قدرها {$request->amount} جيجابايت لاشتراكك.";
        } else {
            $msg = "تم إضافة عدد {$request->amount} كود طلاب إضافي لاشتراكك.";
        }

        $addon = SubscriptionAddon::create([
            'teacher_subscription_id' => $subscription->id,
            'type' => $request->type,
            'amount' => $request->amount,
            'price_egp' => $price,
        ]);

        // Automatically create a pending payment for this addon
        SubscriptionPayment::create([
            'teacher_subscription_id' => $subscription->id,
            'amount' => $price,
            'payment_status' => 'Pending',
            'notes' => 'قيمة إضافة: ' . ($request->type === 'storage' ? "مساحة +{$request->amount} جيجا" : "أكواد +{$request->amount} كود"),
        ]);

        // Send Alert Notification
        $this->notificationService->sendNotification(
            $request->type === 'storage' ? 'تمت إضافة مساحة تخزين' : 'تمت إضافة أكواد طلاب',
            $msg,
            'specific_teacher',
            $teacher->id
        );

        $this->syncService->syncStorageAndCodes($teacher->id);

        return response()->json([
            'message' => 'تمت إضافة الزيادة بنجاح وإنشاء الفاتورة المعلقة',
            'addon' => $addon,
        ]);
    }

    /**
     * Confirm subscription payment.
     */
    public function confirmSubscriptionPayment(Request $request, $id)
    {
        $request->validate([
            'payment_id' => 'required|exists:subscription_payments,id',
            'payment_status' => 'required|in:Paid,Pending,Unpaid,Refunded',
            'notes' => 'nullable|string',
        ]);

        $payment = SubscriptionPayment::findOrFail($request->payment_id);
        $subscription = TeacherSubscription::findOrFail($payment->teacher_subscription_id);
        $teacher = User::findOrFail($subscription->teacher_id);

        $payment->update([
            'payment_status' => $request->payment_status,
            'payment_date' => $request->payment_status === 'Paid' ? Carbon::now() : null,
            'admin_id' => $request->user()->id,
            'admin_name' => $request->user()->name,
            'notes' => $request->notes,
        ]);

        // Log admin activity
        AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تحديث حالة دفع فاتورة المعلم {$teacher->name} بقيمة {$payment->amount} جنيه إلى {$request->payment_status}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم تحديث حالة الدفع بنجاح',
            'payment' => $payment,
        ]);
    }

    /**
     * Get selection lists for students and teachers.
     */
    public function getUsersForSelectors(Request $request)
    {
        $teachers = User::where('role', 'teacher')->select('id', 'name', 'email')->get();
        $students = User::where('role', 'student')->select('id', 'name', 'email')->get();

        return response()->json([
            'teachers' => $teachers,
            'students' => $students,
        ]);
    }

    /**
     * Send broad or specific notification.
     */
    public function sendNotification(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'recipient_type' => 'required|in:all,students,teachers,specific_teacher,specific_student',
            'recipient_id' => 'nullable|required_if:recipient_type,specific_teacher,specific_student|exists:users,id',
            'important' => 'nullable|boolean',
            'send_to_admin' => 'nullable|boolean',
        ]);

        try {
            $notif = $this->notificationService->sendNotification(
                $request->title,
                $request->message,
                $request->recipient_type,
                $request->recipient_id,
                $request->user()->id ?? null,
                $request->important ?? false,
                $request->send_to_admin ?? false
            );
        } catch (\Exception $e) {
            \Log::error("Failed to send notification: " . $e->getMessage(), [
                'request' => $request->all(),
                'exception' => $e
            ]);
            return response()->json([
                'message' => 'فشل إرسال الإشعار.',
                'errors' => ['error' => [$e->getMessage()]],
            ], 422);
        }

        // Save activity log (non-blocking)
        try {
            $targetDesc = $request->recipient_type;
            if ($request->recipient_type === 'specific_teacher' || $request->recipient_type === 'specific_student') {
                $targetUser = User::find($request->recipient_id);
                if ($targetUser) {
                    $targetDesc = "{$targetUser->name} (ID: {$targetUser->id})";
                }
            }

            AdminActivityLog::create([
                'admin_name' => $request->user()->name,
                'action_type' => "إرسال إشعار: ({$request->title}) إلى ({$targetDesc}) | المسؤول: {$request->user()->name} (ID: {$request->user()->id})",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $ex) {
            \Log::warning("Failing to create AdminActivityLog upon sending notification: " . $ex->getMessage());
        }

        return response()->json([
            'message' => 'تم إرسال الإشعار بنجاح',
            'notification' => $notif,
        ]);
    }

    /**
     * Delete a single notification.
     */
    public function deleteNotification(Request $request, $id)
    {
        $notification = Notification::find($id);
        if (!$notification) {
            return response()->json(['message' => 'الإشعار غير موجود'], 404);
        }

        $notification->delete();

        AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "حذف إشعار: {$notification->title}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'تم حذف الإشعار بنجاح']);
    }

    /**
     * Delete multiple or all notifications.
     */
    public function deleteNotifications(Request $request)
    {
        if ($request->has('ids') && is_array($request->ids)) {
            $count = count($request->ids);
            Notification::whereIn('id', $request->ids)->delete();
            AdminActivityLog::create([
                'admin_name' => $request->user()->name,
                'action_type' => "حذف {$count} إشعارات محددة",
                'ip_address' => $request->ip(),
            ]);
            return response()->json(['message' => 'تم حذف الإشعارات المحددة بنجاح']);
        }

        // Delete all notifications
        Notification::query()->delete();
        AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "حذف جميع الإشعارات من النظام",
            'ip_address' => $request->ip(),
        ]);
        return response()->json(['message' => 'تم حذف جميع الإشعارات بنجاح']);
    }

    /**
     * Fetch upgrade and addon requests.
     */
    public function getSubscriptionRequests(Request $request)
    {
        $requests = SubscriptionRequest::with(['teacher', 'requestedPlan', 'activationCodePackage', 'storagePackage'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($requests);
    }

    /**
     * Handle upgrade requests (Approve/Reject).
     */
    public function handleSubscriptionRequest(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:Approved,Rejected',
            'admin_response' => 'nullable|string',
        ]);

        $subRequest = SubscriptionRequest::findOrFail($id);
        $teacher = User::findOrFail($subRequest->teacher_id);
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();

        $adminNote = $request->admin_response ? "\nملاحظة الإدارة: " . $request->admin_response : "";

        if ($request->status === 'Approved') {
            if ($subRequest->type === 'plan_upgrade') {
                $plan = SubscriptionPlan::findOrFail($subRequest->requested_plan_id);
                
                // Protection: Deactivated plans cannot be purchased/approved
                if (!$plan->active) {
                    return response()->json(['message' => 'عذراً، خطة الاشتراك المطلوبة غير مفعلة حالياً ولا يمكن تفعيلها للترقية.'], 400);
                }
                
                $period = $subRequest->billing_cycle;
                if ($period === 'monthly' && $subRequest->billing_period && $subRequest->billing_period !== 'monthly') {
                    $period = $subRequest->billing_period;
                }
                if (!$period) {
                    $period = $subRequest->billing_period ?: 'monthly';
                }
                
                $discountPercentage = $subRequest->discount_percentage;
                $discountAmount = $subRequest->discount_amount;
                $price = $subRequest->final_price;

                if ($price <= 0) {
                    $details = $this->getSubscriptionPriceDetails($plan, $period);
                    $discountPercentage = $details['discount_percentage'];
                    $discountAmount = $details['discount_amount'];
                    $price = $details['final_price'];
                    $months = $details['months'];
                } else {
                    $months = 1;
                    if ($period === 'quarterly') {
                        $months = 3;
                    } elseif ($period === 'semi_annual') {
                        $months = 6;
                    } elseif ($period === 'annual' || $period === 'yearly') {
                        $months = 12;
                    }
                }

                $calc = $this->calculateNewSubscriptionDates($subscription, $plan, $period, 'upgrade', $subRequest->duration_days);
                
                $discountPercentage = $calc['details']['discount_percentage'];
                $discountAmount = $calc['details']['discount_amount'];
                $price = $calc['details']['final_price'];

                $subscription->update([
                    'plan_id' => $plan->id,
                    'start_date' => $calc['start_date'],
                    'end_date' => $calc['end_date'],
                    'status' => 'Active',
                    'billing_period' => $period,
                    'billing_cycle' => $period,
                    'discount_percentage' => $discountPercentage,
                    'discount_amount' => $discountAmount,
                    'final_price' => $price,
                ]);

                // Create billing
                $grandTotal = $subRequest->total_price ?: $price;
                $paymentNotes = "قيمة تجديد وترقية الباقة إلى ({$plan->name}) - فترة: " . ($period === 'annual' || $period === 'yearly' ? 'سنوي' : ($period === 'semi_annual' ? 'نصف سنوي' : ($period === 'quarterly' ? '3 أشهر' : 'شهري')));
                
                if ($subRequest->activation_code_package_id) {
                    $codePackage = \App\Models\ActivationCodePackage::find($subRequest->activation_code_package_id);
                    if ($codePackage) {
                        SubscriptionAddon::create([
                            'teacher_subscription_id' => $subscription->id,
                            'type' => 'codes',
                            'amount' => $codePackage->number_of_codes,
                            'price_egp' => $codePackage->total_price,
                        ]);
                        $paymentNotes .= " + إضافة حزمة أكواد ({$codePackage->name})";
                    }
                }

                SubscriptionPayment::create([
                    'teacher_subscription_id' => $subscription->id,
                    'amount' => $grandTotal,
                    'payment_status' => 'Pending',
                    'notes' => $paymentNotes,
                ]);

                $this->notificationService->sendNotification(
                    'تمت الموافقة على طلب الترقية',
                    "تمت الموافقة على طلب ترقية باقتك إلى ({$plan->name}) بنجاح بقيمة {$grandTotal} ج.م، وتم إصدار فاتورة بالقيمة.{$adminNote}",
                    'specific_teacher',
                    $teacher->id
                );
            } elseif ($subRequest->type === 'extra_storage') {
                $price = $subRequest->final_price ?: $this->calculateAddonPrice('storage', $subRequest->amount);
                $storageGb = $subRequest->amount;
                $notes = "قيمة إضافة مساحة تخزين (+{$storageGb} جيجا)";

                if ($subRequest->storage_package_id) {
                    $storagePackage = \App\Models\StoragePackage::find($subRequest->storage_package_id);
                    if ($storagePackage) {
                        $price = $storagePackage->price;
                        $storageGb = $storagePackage->storage_gb;
                        $notes = "قيمة إضافة مساحة تخزين حزمة ({$storagePackage->name})";
                    }
                }

                SubscriptionAddon::create([
                    'teacher_subscription_id' => $subscription->id,
                    'type' => 'storage',
                    'amount' => $storageGb,
                    'price_egp' => $price,
                ]);

                SubscriptionPayment::create([
                    'teacher_subscription_id' => $subscription->id,
                    'amount' => $price,
                    'payment_status' => 'Pending',
                    'notes' => $notes,
                ]);

                $this->notificationService->sendNotification(
                    'تمت الموافقة على طلب المساحة الإضافية',
                    "تمت إضافة مساحة تخزين (+{$storageGb} جيجا) إلى حسابك بعد الموافقة على طلبكم.{$adminNote}",
                    'specific_teacher',
                    $teacher->id
                );
            } elseif ($subRequest->type === 'extra_codes') {
                $price = $subRequest->final_price ?: $this->calculateAddonPrice('codes', $subRequest->amount);
                $codesCount = $subRequest->amount;
                $notes = "قيمة إضافة أكواد طلاب (+{$codesCount} كود)";

                if ($subRequest->activation_code_package_id) {
                    $codePackage = \App\Models\ActivationCodePackage::find($subRequest->activation_code_package_id);
                    if ($codePackage) {
                        $price = $codePackage->total_price;
                        $codesCount = $codePackage->number_of_codes;
                        $notes = "قيمة إضافة أكواد حزمة ({$codePackage->name})";
                    }
                }

                SubscriptionAddon::create([
                    'teacher_subscription_id' => $subscription->id,
                    'type' => 'codes',
                    'amount' => $subRequest->amount,
                    'price_egp' => $price,
                ]);

                SubscriptionPayment::create([
                    'teacher_subscription_id' => $subscription->id,
                    'amount' => $price,
                    'payment_status' => 'Pending',
                    'notes' => "قيمة إضافة أكواد طلاب (+{$subRequest->amount} كود)",
                ]);

                $this->notificationService->sendNotification(
                    'تمت الموافقة على طلب الأكواد الإضافية',
                    "تمت إضافة (+{$subRequest->amount} كود طلاب) إلى حسابك بعد الموافقة على طلبكم.{$adminNote}",
                    'specific_teacher',
                    $teacher->id
                );
            }

            $subRequest->update([
                'status' => 'Approved',
                'admin_response' => $request->admin_response
            ]);
        } else {
            $subRequest->update([
                'status' => 'Rejected',
                'admin_response' => $request->admin_response
            ]);

            $this->notificationService->sendNotification(
                'تم رفض طلب ترقية الاشتراك',
                "نعتذر، لقد تم رفض طلب ترقية الاشتراك أو الإضافات المقدم من طرفكم من قبل الإدارة.{$adminNote}",
                'specific_teacher',
                $teacher->id
            );
        }

        // Save activity log
        AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "معالجة طلب ترقية للمعلم {$teacher->name} ({$subRequest->type}) إلى {$request->status}",
            'ip_address' => $request->ip(),
        ]);

        $this->syncService->syncStorageAndCodes($teacher->id);

        return response()->json([
            'message' => 'تم تحديث حالة الطلب بنجاح',
            'request' => $subRequest,
        ]);
    }

    /**
     * Excel Export reports for subscriptions, payments, storage usage, and code usage.
     */
    public function exportReports(Request $request)
    {
        $type = $request->query('type', 'subscriptions');

        $headers = [
            'Content-type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename={$type}_report.csv",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0'
        ];

        $callback = function() use ($type) {
            $file = fopen('php://output', 'w');
            
            // Add UTF-8 BOM for Microsoft Excel compatibility (especially for Arabic characters)
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            if ($type === 'subscriptions') {
                fputcsv($file, ['المعلم', 'الباقة الحالية', 'تاريخ البدء', 'تاريخ الانتهاء', 'الحالة', 'المساحة المستخدمة (جيجا)', 'الأكواد المستخدمة']);
                $subs = TeacherSubscription::with(['teacher', 'plan'])->get();
                foreach ($subs as $sub) {
                    fputcsv($file, [
                        $sub->teacher ? $sub->teacher->name : 'غير معروف',
                        $sub->plan ? $sub->plan->name : 'غير معروف',
                        $sub->start_date ? $sub->start_date->toDateString() : '',
                        $sub->end_date ? $sub->end_date->toDateString() : '',
                        $sub->status,
                        round($sub->used_storage_bytes / (1024 * 1024 * 1024), 2),
                        $sub->used_codes
                    ]);
                }
            } elseif ($type === 'payments') {
                fputcsv($file, ['المعلم', 'قيمة المعاملة (جنيه)', 'حالة الدفع', 'تاريخ الدفع', 'الأدمن المسؤول', 'ملاحظات المعاملة']);
                $payments = SubscriptionPayment::with('subscription.teacher')->get();
                foreach ($payments as $payment) {
                    fputcsv($file, [
                        $payment->subscription && $payment->subscription->teacher ? $payment->subscription->teacher->name : 'غير معروف',
                        $payment->amount,
                        $payment->payment_status,
                        $payment->payment_date ? $payment->payment_date->toDateTimeString() : 'معلق',
                        $payment->admin_name ?: 'تلقائي',
                        $payment->notes ?: ''
                    ]);
                }
            } elseif ($type === 'storage') {
                fputcsv($file, ['المعلم', 'المساحة الكلية المتاحة (جيجا)', 'المساحة المستخدمة (جيجا)', 'المساحة المتبقية (جيجا)', 'نسبة الاستهلاك']);
                $subs = TeacherSubscription::with('teacher')->get();
                foreach ($subs as $sub) {
                    fputcsv($file, [
                        $sub->teacher ? $sub->teacher->name : 'غير معروف',
                        $sub->total_storage_gb,
                        round($sub->used_storage_bytes / (1024 * 1024 * 1024), 2),
                        $sub->remaining_storage_gb,
                        $sub->storage_percentage . '%'
                    ]);
                }
            } elseif ($type === 'codes') {
                fputcsv($file, ['المعلم', 'الأكواد الكلية المتاحة', 'الأكواد المستخدمة', 'الأكواد المتبقية']);
                $subs = TeacherSubscription::with('teacher')->get();
                foreach ($subs as $sub) {
                    fputcsv($file, [
                        $sub->teacher ? $sub->teacher->name : 'غير معروف',
                        $sub->total_codes,
                        $sub->used_codes,
                        $sub->remaining_codes
                    ]);
                }
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /*
     * ----------------------------------------------------
     * Teacher Endpoints
     * ----------------------------------------------------
     */

    /**
     * Get current teacher's subscription dashboard.
     */
    public function getTeacherSubscriptionSelf(Request $request)
    {
        $teacher = $request->user();
        if (!$teacher->isTeacher() && !$teacher->is_super_admin && !$teacher->is_super) {
            return response()->json(['message' => 'غير مصرح للوصول لغير المعلمين'], 403);
        }

        // Support super_admin impersonation for subscription view
        if ($teacher->role !== 'teacher') {
            $firstTeacher = \App\Models\User::where('role', 'teacher')->first();
            if ($firstTeacher) {
                $teacher = $firstTeacher;
            } else {
                return response()->json(['message' => 'لا يوجد معلم في النظام لعرض اشتراكه.'], 400);
            }
        }

        // Fetch or create subscription
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
        if (!$subscription) {
            $starter = SubscriptionPlan::where('name', 'Starter')->first();
            $plan = $starter ?: SubscriptionPlan::first();
            $details = $this->getSubscriptionPriceDetails($plan, 'monthly');
            $subscription = TeacherSubscription::create([
                'teacher_id' => $teacher->id,
                'plan_id' => $plan->id,
                'billing_period' => 'monthly',
                'billing_cycle' => 'monthly',
                'discount_percentage' => $details['discount_percentage'],
                'discount_amount' => $details['discount_amount'],
                'final_price' => $details['final_price'],
                'start_date' => Carbon::now()->toDateString(),
                'end_date' => Carbon::now()->addYear()->toDateString(),
                'status' => 'Active',
                'used_storage_bytes' => 0,
                'used_codes' => 0,
            ]);
        }

        // Real-time synchronization
        $this->syncService->syncStorageAndCodes($teacher->id);
        $subscription->refresh();

        // Count students
        $courseIds = Course::where('teacher_id', $teacher->id)->pluck('id');
        $studentsCount = Enrollment::whereIn('course_id', $courseIds)->distinct('student_id')->count('student_id');
        $coursesCount = Course::where('teacher_id', $teacher->id)->count();

        // Expiration warnings
        $today = Carbon::today();
        $endDate = Carbon::parse($subscription->end_date);
        $remainingDays = $today->diffInDays($endDate, false);

        $alerts = [];
        if ($remainingDays <= 0) {
            $alerts[] = 'لقد انتهى اشتراكك اليوم! يرجى الترقية أو التجديد فوراً.';
        } elseif ($remainingDays <= 3) {
            $alerts[] = "تنبيه: متبقي {$remainingDays} أيام فقط على انتهاء اشتراكك.";
        } elseif ($remainingDays <= 7) {
            $alerts[] = "تنبيه: متبقي {$remainingDays} أيام على انتهاء اشتراكك الحالي.";
        }

        // Add additional alerts for storage
        if ($subscription->storage_percentage >= 100) {
            $alerts[] = 'تنبيه: لقد استهلكت كامل مساحة الفيديو المتاحة باشتراكك.';
        } elseif ($subscription->storage_percentage >= 90) {
            $alerts[] = 'تنبيه: لقد استهلكت أكثر من 90% من المساحة المتاحة باشتراكك.';
        }

        // Add low code warnings
        if ($subscription->remaining_codes !== null && $subscription->remaining_codes < 10) {
            $alerts[] = 'رصيد أكواد التفعيل الخاص بك شارف على النفاد. Your activation code balance is running low.';
        }

        $hasPendingRequest = \App\Models\SubscriptionRequest::where('teacher_id', $teacher->id)
            ->where('status', 'Pending')
            ->exists();

        // Calculate earnings for dashboard
        $earningsPlatformCommission = (float) \App\Models\PlatformEarning::where('teacher_id', $teacher->id)->sum('amount');
        $earningsTeacherTotal = (float) \App\Models\TeacherEarning::where('teacher_id', $teacher->id)->sum('amount');
        $earningsToday = (float) \App\Models\TeacherEarning::where('teacher_id', $teacher->id)
            ->whereDate('created_at', Carbon::today())
            ->sum('amount');
        $earningsMonth = (float) \App\Models\TeacherEarning::where('teacher_id', $teacher->id)
            ->whereYear('created_at', Carbon::now()->year)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount');

        return response()->json([
            'subscription' => [
                'id' => $subscription->id,
                'plan' => $subscription->plan,
                'start_date' => $subscription->start_date->toDateString(),
                'end_date' => $subscription->end_date->toDateString(),
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'billing_period' => $subscription->billing_period,
                'final_price' => $subscription->final_price,
                'discount_percentage' => $subscription->discount_percentage,
                'discount_amount' => $subscription->discount_amount,
                'used_storage_bytes' => $subscription->used_storage_bytes,
                'used_codes' => $subscription->used_codes,
                'extra_storage_gb' => $subscription->extra_storage_gb,
                'extra_codes' => $subscription->extra_codes,
                'total_storage_gb' => $subscription->total_storage_gb,
                'total_codes' => $subscription->total_codes,
                'remaining_storage_gb' => $subscription->remaining_storage_gb,
                'remaining_codes' => $subscription->remaining_codes,
                'storage_percentage' => $subscription->storage_percentage,
                'remaining_days' => max(0, $remainingDays),
                'students_count' => $studentsCount,
                'courses_count' => $coursesCount,
            ],
            'addons' => $subscription->addons()->orderBy('created_at', 'desc')->get(),
            'plans' => SubscriptionPlan::where('isActive', true)->orderBy('sort_order', 'asc')->get(),
            'settings' => $this->getSettings(),
            'alerts' => $alerts,
            'has_pending_request' => $hasPendingRequest,
            'activation_code_packages' => \App\Models\ActivationCodePackage::where('active', true)->orderBy('sort_order', 'asc')->get(),
            'storage_packages' => \App\Models\StoragePackage::where('active', true)->orderBy('sort_order', 'asc')->get(),
            'earnings' => [
                'platform_commission' => $earningsPlatformCommission,
                'teacher_earnings' => $earningsTeacherTotal,
                'today_earnings' => $earningsToday,
                'monthly_earnings' => $earningsMonth,
                'lifetime_earnings' => $earningsTeacherTotal,
            ]
        ]);
    }

    /**
     * Submit subscription upgrade/extra addon request.
     */
    public function requestUpgradeSelf(Request $request)
    {
        \Log::info('ADDITIONAL RESOURCE REQUEST', [
            'payload' => $request->all()
        ]);

        $validator = \Validator::make($request->all(), [
            'type' => 'required|in:plan_upgrade,extra_storage,extra_codes',
            'requested_plan_id' => 'nullable|required_if:type,plan_upgrade|exists:subscription_plans,id',
            'amount' => 'nullable|integer|min:1',
            'billing_period' => 'nullable|string',
            'duration_days' => 'nullable|integer|min:1',
            'activation_code_package_id' => 'nullable|exists:activation_code_packages,id',
            'storage_package_id' => 'nullable|exists:storage_packages,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $teacher = $request->user();
            if (!$teacher->isTeacher() && !$teacher->is_super_admin && !$teacher->is_super) {
                return response()->json(['message' => 'غير مصرح للوصول لغير المعلمين'], 403);
            }

            // Support super_admin impersonation for request upgrade
            if ($teacher->role !== 'teacher') {
                $firstTeacher = \App\Models\User::where('role', 'teacher')->first();
                if ($firstTeacher) {
                    $teacher = $firstTeacher;
                } else {
                    return response()->json(['message' => 'لا يوجد معلم في النظام لتنفيذ الطلب عليه.'], 400);
                }
            }

            // Check subscription status for addons
            $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
            if ($subscription) {
                $statusDetails = $subscription->calculateStatusDetails();
                if ($statusDetails['status'] !== 'Active' && $request->type !== 'plan_upgrade') {
                    return response()->json([
                        'message' => 'عذراً، لا يمكنك شراء إضافات (مساحة أو أكواد) أثناء فترة السماح أو بعد انتهاء الاشتراك. يرجى تجديد الباقة الأساسية أولاً.'
                    ], 403);
                }
            }

            // Check if there is an existing pending request of the same type to prevent spamming
            $pendingExists = SubscriptionRequest::where('teacher_id', $teacher->id)
                ->where('type', $request->type)
                ->where('status', 'Pending')
                ->exists();

            if ($pendingExists) {
                return response()->json([
                    'message' => 'لديك طلب معلق من نفس النوع بالفعل بانتظار موافقة الإدارة.'
                ], 400);
            }

            $durationDays = $request->duration_days ?: 30; // default 30 days
            $activationCodePackageId = $request->activation_code_package_id;
            $storagePackageId = $request->storage_package_id;

            $billingCycle = 'monthly';
            if ($request->type === 'plan_upgrade') {
                $billingCycle = is_numeric($request->billing_period) ? 'custom' : ($request->billing_period ?: 'monthly');
                if ($billingCycle === 'yearly') {
                    $billingCycle = 'annual';
                }
            }

            $discountPercentage = 0;
            $discountAmount = 0;
            $finalPrice = 0;
            $totalPrice = 0;
            $amount = null;

            if ($request->type === 'plan_upgrade') {
                $plan = SubscriptionPlan::findOrFail($request->requested_plan_id);
                
                // Protection: Deactivated plans cannot be requested/purchased
                if (!$plan->active && !$plan->isActive) {
                    return response()->json(['message' => 'عذراً، خطة الاشتراك المطلوبة غير متاحة حالياً ولا يمكن الترقية إليها.'], 400);
                }
                
                // Calculate subscription price
                $calc = $this->calculateNewSubscriptionDates($subscription, $plan, $billingCycle, 'upgrade', $durationDays);
                $discountPercentage = $calc['details']['discount_percentage'];
                $discountAmount = $calc['details']['discount_amount'];
                $finalPrice = $calc['details']['final_price'];
                $totalPrice = $finalPrice;

                // Add activation code package if chosen
                if ($activationCodePackageId) {
                    $codePackage = \App\Models\ActivationCodePackage::findOrFail($activationCodePackageId);
                    $totalPrice += (float)$codePackage->total_price;
                }
            } elseif ($request->type === 'extra_storage') {
                if ($storagePackageId) {
                    $storagePackage = \App\Models\StoragePackage::findOrFail($storagePackageId);
                    $amount = $storagePackage->storage_gb;
                    $finalPrice = $storagePackage->price;
                    $totalPrice = $finalPrice;
                } else {
                    $amount = (int)$request->amount;
                    $finalPrice = $this->calculateAddonPrice('storage', $amount);
                    $totalPrice = $finalPrice;
                }
            } elseif ($request->type === 'extra_codes') {
                if ($activationCodePackageId) {
                    $codePackage = \App\Models\ActivationCodePackage::findOrFail($activationCodePackageId);
                    $amount = $codePackage->number_of_codes;
                    $finalPrice = $codePackage->total_price;
                    $totalPrice = $finalPrice;
                } else {
                    $amount = (int)$request->amount;
                    $finalPrice = $this->calculateAddonPrice('codes', $amount);
                    $totalPrice = $finalPrice;
                }
            }

            $upgradeRequest = SubscriptionRequest::create([
                'teacher_id' => $teacher->id,
                'type' => $request->type,
                'requested_plan_id' => $request->type === 'plan_upgrade' ? $request->requested_plan_id : null,
                'amount' => $amount,
                'billing_period' => $billingCycle,
                'billing_cycle' => $billingCycle,
                'discount_percentage' => $discountPercentage,
                'discount_amount' => $discountAmount,
                'final_price' => $finalPrice,
                'status' => 'Pending',
                'duration_days' => $request->type === 'plan_upgrade' ? $durationDays : null,
                'activation_code_package_id' => $activationCodePackageId,
                'storage_package_id' => $storagePackageId,
                'total_price' => $totalPrice,
            ]);

            // Send alert to admin
            $this->notificationService->sendNotification(
                'طلب ترقية اشتراك جديد',
                "المعلم {$teacher->name} أرسل طلب ترقية من نوع ({$request->type}) وبانتظار المراجعة.",
                'admin'
            );

            return response()->json([
                'message' => 'تم إرسال طلب الترقية بنجاح إلى الإدارة وسيتم مراجعته قريباً.',
                'request' => $upgradeRequest,
            ]);
        } catch (\Exception $e) {
            \Log::error('UPGRADE REQUEST FAILED', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /*
     * ----------------------------------------------------
     * Universal Notification Endpoints
     * ----------------------------------------------------
     */

    public function getUserNotifications(Request $request)
    {
        $user = $request->user();
        if ($request->query('admin_view') === 'true' && ($user->isAdmin() || $user->is_super_admin || $user->is_super)) {
            $notifications = Notification::with('recipient')->orderBy('created_at', 'desc')->get();
            return response()->json($notifications);
        }
        $notifications = $this->notificationService->getNotificationsForUser($user);
        return response()->json($notifications);
    }

    /**
     * Get current user's unread notifications count.
     */
    public function getUnreadCount(Request $request)
    {
        $count = $this->notificationService->getUnreadCountForUser($request->user());
        return response()->json(['unread_count' => $count]);
    }

    /**
     * Mark a specific notification as read.
     */
    public function markNotificationAsRead(Request $request, $id)
    {
        $this->notificationService->markAsRead($request->user(), $id);
        if ($request->user() && $request->user()->role === 'student') {
            \App\Services\StudentActivityService::logNotificationOpened($request->user(), (int)$id, $request);
        }
        return response()->json(['message' => 'تم تعيين الإشعار كمقروء']);
    }

    /**
     * Mark a specific notification as seen (popup dismissed).
     */
    public function markNotificationAsSeen(Request $request, $id)
    {
        $this->notificationService->markAsSeen($request->user(), $id);
        return response()->json(['message' => 'تم تعيين الإشعار كمرئي']);
    }

    /**
     * Mark all user notifications as read.
     */
    public function markAllNotificationsAsRead(Request $request)
    {
        $this->notificationService->markAllAsRead($request->user());
        return response()->json(['message' => 'تم تعيين جميع الإشعارات كمقروءة']);
    }

    /**
     * Calculate price of an addon based on settings.
     */
    private function calculateAddonPrice($type, $amount)
    {
        $settings = DB::table('subscription_settings')->pluck('value', 'key');
        if ($type === 'storage') {
            $packages = isset($settings['extra_storage_packages']) 
                ? json_decode($settings['extra_storage_packages'], true) 
                : ['1' => 15, '10' => 120, '25' => 250, '50' => 450];
        } else {
            $packages = isset($settings['extra_codes_packages']) 
                ? json_decode($settings['extra_codes_packages'], true) 
                : ['50' => 75, '100' => 140, '250' => 300];
        }

        // Sort keys in descending order to match largest bundles first
        krsort($packages);
        
        $price = 0;
        $remaining = (int)$amount;

        foreach ($packages as $pkgAmount => $pkgPrice) {
            $pkgAmount = (int)$pkgAmount;
            if ($pkgAmount <= 0) continue;
            
            $count = intdiv($remaining, $pkgAmount);
            if ($count > 0) {
                $price += $count * $pkgPrice;
                $remaining %= $pkgAmount;
            }
        }

        if ($remaining > 0) {
            if ($type === 'storage') {
                $unitPrice = isset($packages['1']) ? $packages['1'] : 15;
                $price += $remaining * $unitPrice;
            } else {
                $keys = array_keys($packages);
                if (!empty($keys)) {
                    $smallestKey = end($keys);
                    $smallestPrice = $packages[$smallestKey];
                    $price += ceil($remaining / $smallestKey) * $smallestPrice;
                } else {
                    $price += $remaining * 5;
                }
            }
        }

        return $price;
    }

    /**
     * Create a subscription plan (Admin).
     */
    public function createPlan(Request $request)
    {
        if (!$request->user()->is_super_admin && !$request->user()->is_super && !$request->user()->hasPermission('subscription_plans.edit')) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subscription_plans,slug',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'duration_in_days' => 'required|integer|min:1',
            'max_courses' => 'nullable|integer|min:0',
            'max_storage_gb' => 'required|numeric|min:0',
            'included_codes' => 'required|integer|min:0',
            'featured' => 'required|boolean',
            'active' => 'required|boolean',
            'sort_order' => 'required|integer',
            'badge_text' => 'nullable|string|max:255',
            'color_theme' => 'nullable|string|max:255',
            'durationType' => 'required|string|in:monthly,quarterly,semi_annual,yearly',
            'discountPercentage' => 'required|numeric|between:0,100',
            'finalPrice' => 'required|numeric|min:0',
            'isActive' => 'required|boolean',
            'billing_options' => 'nullable|array',
            'most_popular' => 'nullable|boolean',
            'recommended' => 'nullable|boolean',
            'billing_type' => 'nullable|string|in:monthly,revenue_sharing',
            'commission_percentage' => 'nullable|numeric|between:0,100',
            'default_storage_gb' => 'nullable|numeric|min:0',
            'codes_limit_type' => 'nullable|string|in:unlimited,max',
            'max_codes_limit' => 'nullable|integer|min:0',
        ]);

        $data = $request->all();
        if (empty($data['slug'])) {
            $data['slug'] = \Illuminate\Support\Str::slug($data['name']);
        }
        if (empty($data['currency'])) {
            $data['currency'] = 'EGP';
        }

        // Auto-calculate finalPrice
        $data['finalPrice'] = $data['price'] - ($data['price'] * ($data['discountPercentage'] / 100));
        if ($data['finalPrice'] < 0) {
            $data['finalPrice'] = 0;
        }

        // Keep legacy fields populated just in case of raw queries
        $data['price_egp'] = $data['finalPrice'];
        $data['video_storage_gb'] = $data['max_storage_gb'];
        $data['student_codes'] = $data['included_codes'];
        $data['duration_days'] = $data['duration_in_days'];
        $data['is_popular'] = $data['featured'];
        $data['is_trial'] = ($data['slug'] === 'starter' || $data['slug'] === 'free' || $data['price'] == 0);
        $data['active'] = $data['isActive'];

        $plan = SubscriptionPlan::create($data);

        // Audit Log
        $this->logPlanAudit($plan->id, $request->user()->id, 'create', null, $plan->toArray());

        return response()->json([
            'message' => 'تم إنشاء خطة الاشتراك بنجاح',
            'plan' => $plan
        ]);
    }

    /**
     * Update a subscription plan (Admin).
     */
    public function updatePlan(Request $request, $id)
    {
        if (!$request->user()->is_super_admin && !$request->user()->is_super && !$request->user()->hasPermission('subscription_plans.edit')) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subscription_plans,slug,' . $id,
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'duration_in_days' => 'required|integer|min:1',
            'max_courses' => 'nullable|integer|min:0',
            'max_storage_gb' => 'required|numeric|min:0',
            'included_codes' => 'required|integer|min:0',
            'featured' => 'required|boolean',
            'active' => 'required|boolean',
            'sort_order' => 'required|integer',
            'badge_text' => 'nullable|string|max:255',
            'color_theme' => 'nullable|string|max:255',
            'durationType' => 'required|string|in:monthly,quarterly,semi_annual,yearly',
            'discountPercentage' => 'required|numeric|between:0,100',
            'finalPrice' => 'required|numeric|min:0',
            'isActive' => 'required|boolean',
            'billing_options' => 'nullable|array',
            'most_popular' => 'nullable|boolean',
            'recommended' => 'nullable|boolean',
            'billing_type' => 'nullable|string|in:monthly,revenue_sharing',
            'commission_percentage' => 'nullable|numeric|between:0,100',
            'default_storage_gb' => 'nullable|numeric|min:0',
            'codes_limit_type' => 'nullable|string|in:unlimited,max',
            'max_codes_limit' => 'nullable|integer|min:0',
        ]);

        $plan = SubscriptionPlan::findOrFail($id);
        $oldValues = $plan->toArray();

        $data = $request->all();
        if (empty($data['slug'])) {
            $data['slug'] = \Illuminate\Support\Str::slug($data['name']);
        }

        // Auto-calculate finalPrice
        $data['finalPrice'] = $data['price'] - ($data['price'] * ($data['discountPercentage'] / 100));
        if ($data['finalPrice'] < 0) {
            $data['finalPrice'] = 0;
        }

        // Keep legacy fields populated just in case of raw queries
        $data['price_egp'] = $data['finalPrice'];
        $data['video_storage_gb'] = $data['max_storage_gb'];
        $data['student_codes'] = $data['included_codes'];
        $data['duration_days'] = $data['duration_in_days'];
        $data['is_popular'] = $data['featured'];
        $data['is_trial'] = ($data['slug'] === 'starter' || $data['slug'] === 'free' || $data['price'] == 0);
        $data['active'] = $data['isActive'];

        // Price History Check
        if ((float)$plan->price !== (float)$data['price']) {
            \App\Models\SubscriptionPlanPriceHistory::create([
                'plan_id' => $plan->id,
                'old_price' => $plan->price,
                'new_price' => $data['price'],
                'changed_by' => $request->user()->id,
            ]);
        }

        $plan->update($data);
        $newValues = $plan->toArray();

        // Audit Log
        $this->logPlanAudit($plan->id, $request->user()->id, 'update', $oldValues, $newValues);

        return response()->json([
            'message' => 'تم تحديث خطة الاشتراك بنجاح',
            'plan' => $plan
        ]);
    }

    /**
     * Toggle active/inactive status of a plan.
     */
    public function togglePlanStatus(Request $request, $id)
    {
        if (!$request->user()->is_super_admin && !$request->user()->is_super && !$request->user()->hasPermission('subscription_plans.edit')) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        $plan = SubscriptionPlan::findOrFail($id);
        $oldValues = $plan->toArray();

        $field = $request->input('field', 'active');

        if ($field === 'featured') {
            $plan->featured = !$plan->featured;
            $plan->is_popular = $plan->featured;
            $action = 'toggle_featured';
            $msg = $plan->featured ? 'تم تمييز الباقة بنجاح' : 'تم إلغاء تمييز الباقة بنجاح';
        } elseif ($field === 'most_popular') {
            $plan->most_popular = !$plan->most_popular;
            $action = 'toggle_most_popular';
            $msg = $plan->most_popular ? 'تم تفعيل الأكثر شعبية بنجاح' : 'تم إلغاء الأكثر شعبية بنجاح';
        } elseif ($field === 'recommended') {
            $plan->recommended = !$plan->recommended;
            $action = 'toggle_recommended';
            $msg = $plan->recommended ? 'تم تفعيل الموصى بها بنجاح' : 'تم إلغاء الموصى بها بنجاح';
        } else {
            $plan->active = !$plan->active;
            $plan->isActive = !$plan->isActive;
            $action = 'toggle_active';
            $msg = $plan->isActive ? 'تم تفعيل خطة الاشتراك بنجاح' : 'تم إلغاء تفعيل خطة الاشتراك بنجاح';
        }

        $plan->save();

        $newValues = $plan->toArray();
        $this->logPlanAudit($plan->id, $request->user()->id, $action, $oldValues, $newValues);

        return response()->json([
            'message' => $msg,
            'plan' => $plan
        ]);
    }

    /**
     * Delete a subscription plan.
     */
    public function deletePlan(Request $request, $id)
    {
        if (!$request->user()->is_super_admin && !$request->user()->is_super && !$request->user()->hasPermission('subscription_plans.edit')) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        \Log::info('DELETE PLAN REQUEST', [
            'id' => $id,
            'user_id' => auth()->id(),
        ]);

        try {
            $plan = SubscriptionPlan::find($id);

            \Log::info('PLAN FOUND', ['plan' => $plan]);

            if (!$plan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Plan not found',
                    'plan_id' => $id
                ], 404);
            }

            \Log::info('STARTING DELETE');
            \DB::beginTransaction();

            \Log::info('DELETING RELATIONS');

            // Clean dependencies on subscription_requests table manually
            \DB::table('subscription_requests')->where('requested_plan_id', $id)->update(['requested_plan_id' => null]);

            // Reassign any remaining subscriptions referencing this plan to avoid foreign key restriction
            $starter = SubscriptionPlan::where('name', 'Starter')->where('id', '!=', $id)->first();
            $fallbackPlan = $starter ?: SubscriptionPlan::where('id', '!=', $id)->first();
            
            if ($fallbackPlan) {
                TeacherSubscription::where('plan_id', $id)->update(['plan_id' => $fallbackPlan->id]);
            } else {
                TeacherSubscription::where('plan_id', $id)->delete();
            }

            // Also delete history/audit logs manually to ensure integrity on all DB engines
            \DB::table('subscription_plan_price_history')->where('plan_id', $id)->delete();
            \DB::table('subscription_plan_audit_logs')->where('plan_id', $id)->delete();

            \Log::info('DELETING PLAN');
            $oldValues = $plan->toArray();
            $plan->delete();

            // Verify deletion immediately
            $exists = SubscriptionPlan::find($id);
            \Log::info('AFTER DELETE', [
                'exists' => $exists
            ]);

            // Write to AdminActivityLog instead of SubscriptionPlanAuditLog to avoid Foreign Key constraint violation
            \App\Models\AdminActivityLog::create([
                'admin_name' => $request->user()->name,
                'action_type' => "حذف خطة الاشتراك: {$plan->name} (ID: {$id})",
                'ip_address' => $request->ip(),
            ]);

            \DB::commit();

            \Log::info('DELETE SUCCESS');

            return response()->json([
                'success' => true,
                'deleted_id' => $id,
                'message' => 'تم حذف الباقة بنجاح'
            ], 200);
        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('DELETE FAILED', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'فشل حذف الخطة من قاعدة البيانات: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reorder plans.
     */
    public function reorderPlans(Request $request)
    {
        if (!$request->user()->is_super_admin && !$request->user()->is_super && !$request->user()->hasPermission('subscription_plans.edit')) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        $request->validate([
            'orders' => 'required|array',
            'orders.*' => 'required|exists:subscription_plans,id',
        ]);

        $orders = $request->orders;
        $oldValues = SubscriptionPlan::orderBy('sort_order', 'asc')->pluck('sort_order', 'id')->toArray();

        foreach ($orders as $index => $id) {
            SubscriptionPlan::where('id', $id)->update(['sort_order' => $index]);
        }

        $newValues = SubscriptionPlan::orderBy('sort_order', 'asc')->pluck('sort_order', 'id')->toArray();
        
        // Log audit
        $this->logPlanAudit($orders[0] ?? 1, $request->user()->id, 'reorder', $oldValues, $newValues);

        return response()->json([
            'message' => 'تم إعادة ترتيب خطط الاشتراك بنجاح',
            'plans' => SubscriptionPlan::orderBy('sort_order', 'asc')->get()
        ]);
    }

    /**
     * Get price history of a plan.
     */
    public function getPriceHistory(Request $request, $id)
    {
        $plan = SubscriptionPlan::findOrFail($id);
        $history = \App\Models\SubscriptionPlanPriceHistory::where('plan_id', $id)
            ->with('admin:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'plan' => $plan,
            'history' => $history
        ]);
    }

    /**
     * Get audit logs of a plan.
     */
    public function getAuditLogs(Request $request, $id)
    {
        $plan = SubscriptionPlan::findOrFail($id);
        $logs = \App\Models\SubscriptionPlanAuditLog::where('plan_id', $id)
            ->with('user:id,name,email,role')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'plan' => $plan,
            'logs' => $logs
        ]);
    }

    /**
     * Helper to write audit logs.
     */
    private function logPlanAudit($planId, $userId, $action, $oldValues = null, $newValues = null)
    {
        try {
            \App\Models\SubscriptionPlanAuditLog::create([
                'plan_id' => $planId,
                'user_id' => $userId,
                'action' => $action,
                'old_values' => $oldValues,
                'new_values' => $newValues,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to write plan audit log: ' . $e->getMessage());
        }
    }

    /**
     * Update dynamic settings (Admin).
     */
    public function updateSettings(Request $request)
    {
        $request->validate([
            'discount_semi_annually' => 'required|numeric|min:0|max:100',
            'discount_annually' => 'required|numeric|min:0|max:100',
            'extra_storage_packages' => 'required|array',
            'extra_storage_packages.*' => 'required|numeric|min:0',
            'extra_codes_packages' => 'required|array',
            'extra_codes_packages.*' => 'required|numeric|min:0',
        ]);

        foreach ($request->only([
            'discount_semi_annually',
            'discount_annually',
        ]) as $key => $val) {
            DB::table('subscription_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => (string)$val, 'updated_at' => now()]
            );
        }

        // Store package json maps
        DB::table('subscription_settings')->updateOrInsert(
            ['key' => 'extra_storage_packages'],
            ['value' => json_encode($request->extra_storage_packages), 'updated_at' => now()]
        );

        DB::table('subscription_settings')->updateOrInsert(
            ['key' => 'extra_codes_packages'],
            ['value' => json_encode($request->extra_codes_packages), 'updated_at' => now()]
        );

        return response()->json([
            'message' => 'تم تحديث الإعدادات العامة بنجاح',
            'settings' => $this->getSettings()
        ]);
    }

    public function getSubscriptionPriceDetails($plan, $billingCycle)
    {
        // Standardize billing cycle name
        $standardCycle = $billingCycle;
        if ($standardCycle === 'yearly') {
            $standardCycle = 'annual';
        }
        
        if (!empty($plan->billing_options)) {
            $options = is_string($plan->billing_options) ? json_decode($plan->billing_options, true) : $plan->billing_options;
            if (is_array($options)) {
                $cycleKey = $standardCycle;
                if ($cycleKey === 'quarterly') {
                    $cycleKey = 'three_months';
                } elseif ($cycleKey === 'semi_annual') {
                    $cycleKey = 'six_months';
                } elseif ($cycleKey === 'annual') {
                    $cycleKey = 'yearly';
                }
                
                if (isset($options[$cycleKey]) && !empty($options[$cycleKey]['enabled'])) {
                    $opt = $options[$cycleKey];
                    $price = (float)($opt['price'] ?? 0);
                    $discountPercentage = (float)($opt['discount'] ?? 0);
                    $discountAmount = $price * ($discountPercentage / 100);
                    $finalPrice = $price - $discountAmount;
                    
                    $months = 1;
                    if ($standardCycle === 'quarterly') {
                        $months = 3;
                    } elseif ($standardCycle === 'semi_annual') {
                        $months = 6;
                    } elseif ($standardCycle === 'annual') {
                        $months = 12;
                    }
                    
                    return [
                        'months' => $months,
                        'billing_cycle' => $standardCycle,
                        'discount_percentage' => $discountPercentage,
                        'discount_amount' => round($discountAmount, 2),
                        'final_price' => round($finalPrice, 2),
                        'base_price' => round($price, 2)
                    ];
                }
            }
        }

        if (!empty($plan->durationType)) {
            $months = 1;
            if ($plan->durationType === 'quarterly') {
                $months = 3;
            } elseif ($plan->durationType === 'semi_annual') {
                $months = 6;
            } elseif ($plan->durationType === 'yearly' || $plan->durationType === 'annual') {
                $months = 12;
            }
            
            $price = (float)$plan->price;
            $discountPercentage = (float)$plan->discountPercentage;
            $finalPrice = (float)$plan->finalPrice;
            $discountAmount = $price * ($discountPercentage / 100);
            
            return [
                'months' => $months,
                'billing_cycle' => $plan->durationType === 'yearly' ? 'annual' : $plan->durationType,
                'discount_percentage' => $discountPercentage,
                'discount_amount' => round($discountAmount, 2),
                'final_price' => round($finalPrice, 2),
                'base_price' => round($price, 2)
            ];
        }

        $monthlyPrice = (float)$plan->price_egp;
        $months = 1;
        $discountPercentage = 0.00;

        $settings = $this->getSettings();
        $semiDiscount = isset($settings['discount_semi_annually']) ? (float)$settings['discount_semi_annually'] : 10.00;
        $annualDiscount = isset($settings['discount_annually']) ? (float)$settings['discount_annually'] : 20.00;

        if ($billingCycle === 'quarterly') {
            $months = 3;
            $discountPercentage = 0.00;
        } elseif ($billingCycle === 'semi_annual') {
            $months = 6;
            $discountPercentage = $semiDiscount;
        } elseif ($billingCycle === 'annual' || $billingCycle === 'yearly') {
            $months = 12;
            $discountPercentage = $annualDiscount;
        } else {
            $billingCycle = 'monthly';
            $months = 1;
            $discountPercentage = 0.00;
        }

        $basePrice = $monthlyPrice * $months;
        $discountAmount = $basePrice * ($discountPercentage / 100);
        $finalPrice = $basePrice - $discountAmount;

        return [
            'months' => $months,
            'billing_cycle' => $billingCycle === 'yearly' ? 'annual' : $billingCycle,
            'discount_percentage' => $discountPercentage,
            'discount_amount' => round($discountAmount, 2),
            'final_price' => round($finalPrice, 2),
            'base_price' => round($basePrice, 2)
        ];
    }

    /**
     * Calculate plan price with discounts applied.
     */
    private function calculatePlanPrice($plan, $months)
    {
        $cycle = 'monthly';
        if ($months == 3) {
            $cycle = 'quarterly';
        } elseif ($months == 6) {
            $cycle = 'semi_annual';
        } elseif ($months == 12) {
            $cycle = 'annual';
        }
        
        $details = $this->getSubscriptionPriceDetails($plan, $cycle);
        return $details['final_price'];
    }

    /**
     * Get settings formatted for API.
     */
    private function getSettings()
    {
        $settings = DB::table('subscription_settings')->pluck('value', 'key')->toArray();
        
        if (isset($settings['extra_storage_packages'])) {
            $settings['extra_storage_packages'] = json_decode($settings['extra_storage_packages'], true);
        }
        if (isset($settings['extra_codes_packages'])) {
            $settings['extra_codes_packages'] = json_decode($settings['extra_codes_packages'], true);
        }
        
        return $settings;
    }

    /**
     * List all subscription plans and settings (Admin).
     */
    public function listPlansAdmin(Request $request)
    {
        return response()->json([
            'plans' => SubscriptionPlan::orderBy('sort_order', 'asc')->get(),
            'settings' => $this->getSettings()
        ]);
    }

    /**
     * List all active subscription plans (Public/Teachers).
     */
    public function listPlansPublic(Request $request)
    {
        return response()->json([
            'plans' => SubscriptionPlan::where('isActive', true)
                ->orderBy('sort_order', 'asc')
                ->get(),
            'settings' => $this->getSettings()
        ]);
    }

    public function getTeachersResourcesSummary(Request $request)
    {
        $teachers = User::where('role', 'teacher')->orderBy('name', 'asc')->get();
        $summary = [];
        
        foreach ($teachers as $t) {
            $subscription = TeacherSubscription::with('plan')->where('teacher_id', $t->id)->first();
            $plan = $subscription ? $subscription->plan : null;
            
            $baseStorage = $plan ? $plan->video_storage_gb : 10;
            $baseCodes = $plan ? $plan->student_codes : 0;
            
            $override = TeacherResourceOverride::where('teacher_id', $t->id)->first();
            $extraStorage = $override ? $override->extra_storage_gb : 0;
            $extraCodes = $override ? $override->extra_student_codes : 0;
            
            $summary[] = [
                'teacher_id' => $t->id,
                'teacher_name' => $t->name,
                'plan_name' => $plan ? $plan->name : 'Starter (Default)',
                'base_storage_gb' => $baseStorage,
                'extra_storage_gb' => $extraStorage,
                'base_student_codes' => $baseCodes,
                'extra_student_codes' => $extraCodes,
                'final_storage_gb' => $baseStorage + $extraStorage,
                'final_student_codes' => $baseCodes + $extraCodes,
            ];
        }
        
        return response()->json($summary);
    }

    public function getTeacherResourceOverrides(Request $request, $id)
    {
        $teacher = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        $subscription = TeacherSubscription::with('plan')->where('teacher_id', $id)->first();
        
        $override = TeacherResourceOverride::where('teacher_id', $id)->first();
        $manualStorage = $override ? (float) $override->extra_storage_gb : 0.0;
        $manualCodes = $override ? (int) $override->extra_student_codes : 0;
        
        if ($subscription) {
            $baseStorage = (float) $subscription->included_storage_gb;
            $baseCodes = $subscription->included_codes;
            
            $addonStorage = (float) ($subscription->addons()->where('type', 'storage')->sum('amount') ?? 0);
            $addonCodes = (int) ($subscription->addons()->where('type', 'codes')->sum('amount') ?? 0);
            
            $salesStorage = (float) ($subscription->allocated_storage_from_sales ?? 0);
            
            $extraStorage = (float) $subscription->extra_storage_gb;
            $extraCodes = (int) $subscription->extra_codes;
            
            $finalStorage = (float) $subscription->total_storage_gb;
            $finalCodes = $subscription->total_codes;
        } else {
            $baseStorage = 10.0;
            $baseCodes = 0;
            $addonStorage = 0.0;
            $addonCodes = 0;
            $salesStorage = 0.0;
            $extraStorage = $manualStorage;
            $extraCodes = $manualCodes;
            $finalStorage = $baseStorage + $extraStorage;
            $finalCodes = $baseCodes + $extraCodes;
        }
        
        return response()->json([
            'success' => true,
            'teacher_name' => $teacher->name,
            'plan_name' => ($subscription && $subscription->plan) ? $subscription->plan->name : 'لا يوجد',
            'base_storage_gb' => $baseStorage,
            'base_student_codes' => $baseCodes,
            'addon_storage_gb' => $addonStorage,
            'addon_student_codes' => $addonCodes,
            'manual_override_storage_gb' => $manualStorage,
            'manual_override_student_codes' => $manualCodes,
            'sales_storage_gb' => $salesStorage,
            'extra_storage_gb' => $extraStorage,
            'extra_student_codes' => $extraCodes,
            'storage_limit_gb' => $finalStorage,
            'student_codes_limit' => $finalCodes,
        ]);
    }

    public function updateTeacherResourceOverrides(Request $request, $id)
    {
        $teacher = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        
        $request->validate([
            'extra_storage_gb' => 'required|integer|min:0',
            'extra_student_codes' => 'required|integer|min:0',
        ]);
        
        $subscription = TeacherSubscription::where('teacher_id', $id)->first();
        
        // Target total extra values input by admin
        $targetExtraStorage = (float) $request->extra_storage_gb;
        $targetExtraCodes = (int) $request->extra_student_codes;
        
        // Sum active addons & sales values
        $addonStorage = (float) ($subscription ? ($subscription->addons()->where('type', 'storage')->sum('amount') ?? 0) : 0.0);
        $salesStorage = (float) ($subscription ? ($subscription->allocated_storage_from_sales ?? 0) : 0.0);
        $addonCodes = (int) ($subscription ? ($subscription->addons()->where('type', 'codes')->sum('amount') ?? 0) : 0);
        
        // Manual override is the difference to reach target
        $manualStorage = max(0.0, $targetExtraStorage - $addonStorage - $salesStorage);
        $manualCodes = max(0, $targetExtraCodes - $addonCodes);
        
        $override = TeacherResourceOverride::where('teacher_id', $id)->first();
        $oldStorage = $override ? $override->extra_storage_gb : 0;
        $oldCodes = $override ? $override->extra_student_codes : 0;
        
        $override = TeacherResourceOverride::updateOrCreate(
            ['teacher_id' => $id],
            [
                'extra_storage_gb' => $manualStorage,
                'extra_student_codes' => $manualCodes,
                'created_by' => $override ? $override->created_by : auth()->id(),
                'updated_by' => auth()->id(),
            ]
        );
        
        \Log::info('ADMIN_RESOURCE_UPDATE', [
            'admin_id' => auth()->id(),
            'teacher_id' => $id,
            'old_extra_storage' => $oldStorage,
            'new_extra_storage' => $manualStorage,
            'old_extra_codes' => $oldCodes,
            'new_extra_codes' => $manualCodes,
        ]);
        
        // Recalculate limits immediately
        $bunnyService = new \App\Services\BunnyStreamService();
        $bunnyService->recalculateStorage($id);
        
        // Load the updated subscription to calculate correct final limits
        $subscription = TeacherSubscription::with('plan')->where('teacher_id', $id)->first();
        
        if ($subscription) {
            $finalStorage = (float) $subscription->total_storage_gb;
            $finalCodes = $subscription->total_codes;
            $newStorage = (float) $subscription->extra_storage_gb;
            $newCodes = (int) $subscription->extra_codes;
        } else {
            $baseStorage = 10;
            $baseCodes = 0;
            $finalStorage = $baseStorage + $manualStorage;
            $finalCodes = $baseCodes + $manualCodes;
            $newStorage = $manualStorage;
            $newCodes = $manualCodes;
        }
        
        // Clear caches if any
        \Cache::forget("teacher_subscription_{$id}");
        
        return response()->json([
            'success' => true,
            'storage_limit_gb' => $finalStorage,
            'student_codes_limit' => $finalCodes,
            'extra_storage_gb' => $newStorage,
            'extra_student_codes' => $newCodes,
        ]);
    }

    public function deleteTeacherResourceOverrides(Request $request, $id)
    {
        $teacher = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        
        $override = TeacherResourceOverride::where('teacher_id', $id)->first();
        $oldStorage = $override ? $override->extra_storage_gb : 0;
        $oldCodes = $override ? $override->extra_student_codes : 0;
        
        if ($override) {
            $override->update([
                'extra_storage_gb' => 0,
                'extra_student_codes' => 0,
                'updated_by' => auth()->id(),
            ]);
        } else {
            TeacherResourceOverride::create([
                'teacher_id' => $id,
                'extra_storage_gb' => 0,
                'extra_student_codes' => 0,
                'created_by' => auth()->id(),
                'updated_by' => auth()->id(),
            ]);
        }
        
        // Delete all active subscription addons
        $subscription = TeacherSubscription::where('teacher_id', $id)->first();
        if ($subscription) {
            $subscription->addons()->delete();
        }
        
        \Log::info('ADMIN_RESOURCE_UPDATE', [
            'admin_id' => auth()->id(),
            'teacher_id' => $id,
            'old_extra_storage' => $oldStorage,
            'new_extra_storage' => 0,
            'old_extra_codes' => $oldCodes,
            'new_extra_codes' => 0,
        ]);
        
        // Recalculate limits immediately
        $bunnyService = new \App\Services\BunnyStreamService();
        $bunnyService->recalculateStorage($id);
        
        // Load the updated subscription to calculate correct final limits
        $subscription = TeacherSubscription::with('plan')->where('teacher_id', $id)->first();
        
        if ($subscription) {
            $finalStorage = (float) $subscription->total_storage_gb;
            $finalCodes = $subscription->total_codes;
            $newStorage = (float) $subscription->extra_storage_gb;
            $newCodes = (int) $subscription->extra_codes;
        } else {
            $baseStorage = 10;
            $baseCodes = 0;
            $finalStorage = $baseStorage;
            $finalCodes = $baseCodes;
            $newStorage = 0;
            $newCodes = 0;
        }
        
        \Cache::forget("teacher_subscription_{$id}");
        
        return response()->json([
            'success' => true,
            'storage_limit_gb' => $finalStorage,
            'student_codes_limit' => $finalCodes,
            'extra_storage_gb' => $newStorage,
            'extra_student_codes' => $newCodes,
        ]);
    }

    /*
     * ----------------------------------------------------
     * Activation Code Packages CRUD Endpoints
     * ----------------------------------------------------
     */

    public function listActivationCodePackagesAdmin(Request $request)
    {
        $packages = \App\Models\ActivationCodePackage::orderBy('sort_order', 'asc')->get();
        return response()->json($packages);
    }

    public function listActivationCodePackagesPublic(Request $request)
    {
        $packages = \App\Models\ActivationCodePackage::where('active', true)->orderBy('sort_order', 'asc')->get();
        return response()->json($packages);
    }

    public function createActivationCodePackage(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'number_of_codes' => 'required|integer|min:1',
            'price_per_code' => 'required|numeric|min:0',
            'total_price' => 'required|numeric|min:0',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $package = \App\Models\ActivationCodePackage::create($validated);
        return response()->json([
            'message' => 'تم إنشاء باقة الأكواد بنجاح',
            'package' => $package
        ], 201);
    }

    public function updateActivationCodePackage(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'number_of_codes' => 'required|integer|min:1',
            'price_per_code' => 'required|numeric|min:0',
            'total_price' => 'required|numeric|min:0',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $package = \App\Models\ActivationCodePackage::findOrFail($id);
        $package->update($validated);
        return response()->json([
            'message' => 'تم تحديث باقة الأكواد بنجاح',
            'package' => $package
        ]);
    }

    public function deleteActivationCodePackage(Request $request, $id)
    {
        $package = \App\Models\ActivationCodePackage::findOrFail($id);
        $package->delete();
        return response()->json([
            'message' => 'تم حذف باقة الأكواد بنجاح'
        ]);
    }

    public function toggleActivationCodePackageStatus(Request $request, $id)
    {
        $package = \App\Models\ActivationCodePackage::findOrFail($id);
        $package->active = !$package->active;
        $package->save();
        return response()->json([
            'message' => 'تم تغيير حالة باقة الأكواد بنجاح',
            'package' => $package
        ]);
    }

    /*
     * ----------------------------------------------------
     * Storage Packages CRUD Endpoints
     * ----------------------------------------------------
     */

    public function listStoragePackagesAdmin(Request $request)
    {
        $packages = \App\Models\StoragePackage::orderBy('sort_order', 'asc')->get();
        return response()->json($packages);
    }

    public function listStoragePackagesPublic(Request $request)
    {
        $packages = \App\Models\StoragePackage::where('active', true)->orderBy('sort_order', 'asc')->get();
        return response()->json($packages);
    }

    public function createStoragePackage(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'storage_gb' => 'required|integer|min:1',
            'price' => 'required|numeric|min:0',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $package = \App\Models\StoragePackage::create($validated);
        return response()->json([
            'message' => 'تم إنشاء باقة التخزين بنجاح',
            'package' => $package
        ], 201);
    }

    public function updateStoragePackage(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'storage_gb' => 'required|integer|min:1',
            'price' => 'required|numeric|min:0',
            'active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $package = \App\Models\StoragePackage::findOrFail($id);
        $package->update($validated);
        return response()->json([
            'message' => 'تم تحديث باقة التخزين بنجاح',
            'package' => $package
        ]);
    }

    public function deleteStoragePackage(Request $request, $id)
    {
        $package = \App\Models\StoragePackage::findOrFail($id);
        $package->delete();
        return response()->json([
            'message' => 'تم حذف باقة التخزين بنجاح'
        ]);
    }

    public function toggleStoragePackageStatus(Request $request, $id)
    {
        $package = \App\Models\StoragePackage::findOrFail($id);
        $package->active = !$package->active;
        $package->save();
        return response()->json([
            'message' => 'تم تغيير حالة باقة التخزين بنجاح',
            'package' => $package
        ]);
    }
}
