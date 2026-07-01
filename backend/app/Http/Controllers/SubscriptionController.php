<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionRequest;
use App\Models\AdminActivityLog;
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
        ]);

        $teacher = User::where('role', 'teacher')->findOrFail($id);
        $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();
        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        $billingPeriod = $request->billing_period;
        if ($billingPeriod === 'yearly') {
            $billingPeriod = 'annual';
        }
        $months = $request->duration_months;

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
        } else {
            // fallback if billing period is not provided but months are
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
        }

        $details = $this->getSubscriptionPriceDetails($plan, $billingPeriod);
        $subscription->update([
            'plan_id' => $plan->id,
            'billing_period' => $details['billing_cycle'],
            'billing_cycle' => $details['billing_cycle'],
            'discount_percentage' => $details['discount_percentage'],
            'discount_amount' => $details['discount_amount'],
            'final_price' => $details['final_price'],
            'start_date' => Carbon::now()->toDateString(),
            'end_date' => Carbon::now()->addMonths($details['months'])->toDateString(),
            'status' => 'Active',
        ]);

        // Calculate price and log payment
        $price = $details['final_price'];
        SubscriptionPayment::create([
            'teacher_subscription_id' => $subscription->id,
            'amount' => $price,
            'payment_status' => 'Paid',
            'notes' => "تجديد/ترقية باقة ({$plan->name}) - دورة {$details['billing_cycle']}",
            'payment_date' => Carbon::now(),
            'admin_name' => $request->user()->name,
            'admin_id' => $request->user()->id ?? null,
        ]);

        // Send Notification
        $this->notificationService->sendNotification(
            'تجديد وترقية الاشتراك',
            "تم تفعيل باقة ({$plan->name}) لاشتراكك بنجاح من قبل الإدارة بدورة دفع ({$billingPeriod}) بقيمة {$price} ج.م.",
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
            'payment_status' => 'required|in:Paid,Pending,Unpaid',
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
        $requests = SubscriptionRequest::with(['teacher', 'requestedPlan'])
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

                $subscription->update([
                    'plan_id' => $plan->id,
                    'start_date' => Carbon::now()->toDateString(),
                    'end_date' => Carbon::now()->addMonths($months)->toDateString(),
                    'status' => 'Active',
                    'billing_period' => $period,
                    'billing_cycle' => $period,
                    'discount_percentage' => $discountPercentage,
                    'discount_amount' => $discountAmount,
                    'final_price' => $price,
                ]);

                // Create billing
                SubscriptionPayment::create([
                    'teacher_subscription_id' => $subscription->id,
                    'amount' => $price,
                    'payment_status' => 'Pending',
                    'notes' => "قيمة تجديد وترقية الباقة إلى ({$plan->name}) - فترة: " . ($period === 'annual' || $period === 'yearly' ? 'سنوي' : ($period === 'semi_annual' ? 'نصف سنوي' : ($period === 'quarterly' ? '3 أشهر' : 'شهري'))),
                ]);

                $this->notificationService->sendNotification(
                    'تمت الموافقة على طلب الترقية',
                    "تمت الموافقة على طلب ترقية باقتك إلى ({$plan->name}) بنجاح بقيمة {$price} ج.م، وتم إصدار فاتورة بالقيمة.{$adminNote}",
                    'specific_teacher',
                    $teacher->id
                );
            } elseif ($subRequest->type === 'extra_storage') {
                $price = $this->calculateAddonPrice('storage', $subRequest->amount);
                SubscriptionAddon::create([
                    'teacher_subscription_id' => $subscription->id,
                    'type' => 'storage',
                    'amount' => $subRequest->amount,
                    'price_egp' => $price,
                ]);

                SubscriptionPayment::create([
                    'teacher_subscription_id' => $subscription->id,
                    'amount' => $price,
                    'payment_status' => 'Pending',
                    'notes' => "قيمة إضافة مساحة تخزين (+{$subRequest->amount} جيجا)",
                ]);

                $this->notificationService->sendNotification(
                    'تمت الموافقة على طلب المساحة الإضافية',
                    "تمت إضافة مساحة تخزين (+{$subRequest->amount} جيجا) إلى حسابك بعد الموافقة على طلبكم.{$adminNote}",
                    'specific_teacher',
                    $teacher->id
                );
            } elseif ($subRequest->type === 'extra_codes') {
                $price = $this->calculateAddonPrice('codes', $subRequest->amount);
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

        return response()->json([
            'subscription' => [
                'id' => $subscription->id,
                'plan' => $subscription->plan,
                'start_date' => $subscription->start_date->toDateString(),
                'end_date' => $subscription->end_date->toDateString(),
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
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
            ],
            'addons' => $subscription->addons()->orderBy('created_at', 'desc')->get(),
            'plans' => SubscriptionPlan::where('isActive', true)->orderBy('sort_order', 'asc')->get(),
            'settings' => $this->getSettings(),
            'alerts' => $alerts,
        ]);
    }

    /**
     * Submit subscription upgrade/extra addon request.
     */
    public function requestUpgradeSelf(Request $request)
    {
        $request->validate([
            'type' => 'required|in:plan_upgrade,extra_storage,extra_codes',
            'requested_plan_id' => 'required_if:type,plan_upgrade|exists:subscription_plans,id',
            'amount' => 'required_if:type,extra_storage,extra_codes|integer|min:1',
            'billing_period' => 'nullable|string|in:monthly,quarterly,semi_annual,annual,yearly',
        ]);

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

        $billingCycle = $request->type === 'plan_upgrade' ? ($request->billing_period ?: 'monthly') : 'monthly';
        if ($billingCycle === 'yearly') {
            $billingCycle = 'annual';
        }
        $discountPercentage = 0;
        $discountAmount = 0;
        $finalPrice = 0;

        if ($request->type === 'plan_upgrade') {
            $plan = SubscriptionPlan::findOrFail($request->requested_plan_id);
            
            // Protection: Deactivated plans cannot be requested/purchased
            if (!$plan->isActive) {
                return response()->json(['message' => 'عذراً، خطة الاشتراك المطلوبة غير متاحة حالياً ولا يمكن الترقية إليها.'], 400);
            }
            
            $details = $this->getSubscriptionPriceDetails($plan, $billingCycle);
            $discountPercentage = $details['discount_percentage'];
            $discountAmount = $details['discount_amount'];
            $finalPrice = $details['final_price'];
        } else {
            $finalPrice = $this->calculateAddonPrice($request->type, $request->amount);
        }

        $upgradeRequest = SubscriptionRequest::create([
            'teacher_id' => $teacher->id,
            'type' => $request->type,
            'requested_plan_id' => $request->type === 'plan_upgrade' ? $request->requested_plan_id : null,
            'amount' => $request->type !== 'plan_upgrade' ? $request->amount : null,
            'billing_period' => $billingCycle,
            'billing_cycle' => $billingCycle,
            'discount_percentage' => $discountPercentage,
            'discount_amount' => $discountAmount,
            'final_price' => $finalPrice,
            'status' => 'Pending',
        ]);

        // Send alert to admin
        $this->notificationService->sendNotification(
            'طلب ترقية اشتراك جديد',
            "المعلم {$teacher->name} أرسل طلب ترقية من نوع ({$request->type}) وبانتظار المراجعة.",
            'admin' // Delivers to admin notification views
        );

        return response()->json([
            'message' => 'تم إرسال طلب الترقية بنجاح إلى الإدارة وسيتم مراجعته قريباً.',
            'request' => $upgradeRequest,
        ]);
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

        $plan->active = !$plan->active;
        $plan->isActive = !$plan->isActive;
        $plan->save();

        $newValues = $plan->toArray();
        $this->logPlanAudit($plan->id, $request->user()->id, 'toggle_active', $oldValues, $newValues);

        return response()->json([
            'message' => $plan->isActive ? 'تم تفعيل خطة الاشتراك بنجاح' : 'تم إلغاء تفعيل خطة الاشتراك بنجاح',
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

        $plan = SubscriptionPlan::findOrFail($id);

        \Log::info("DELETE PACKAGE ID: " . $id);
        error_log("DELETE PACKAGE ID: " . $id);

        // Check if there are active subscriptions using this plan
        $activeSubsCount = TeacherSubscription::where('plan_id', $id)
            ->whereIn('status', ['Active', 'Expiring Soon'])
            ->count();

        if ($activeSubsCount > 0) {
            return response()->json([
                'message' => 'لا يمكن حذف هذه الخطة لأن هناك معلمين مشتركين فيها حالياً بنشاط. يرجى إلغاء تفعيلها بدلاً من ذلك.'
            ], 400);
        }

        // Reassign any remaining inactive/expired subscriptions referencing this plan to avoid foreign key restriction
        $starter = SubscriptionPlan::where('name', 'Starter')->where('id', '!=', $id)->first();
        $fallbackPlan = $starter ?: SubscriptionPlan::where('id', '!=', $id)->first();
        
        if ($fallbackPlan) {
            TeacherSubscription::where('plan_id', $id)->update(['plan_id' => $fallbackPlan->id]);
        } else {
            TeacherSubscription::where('plan_id', $id)->delete();
        }

        $oldValues = $plan->toArray();
        $plan->delete();

        $this->logPlanAudit($id, $request->user()->id, 'delete', $oldValues, null);

        return response()->json([
            'message' => 'تم حذف خطة الاشتراك بنجاح'
        ]);
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
}
