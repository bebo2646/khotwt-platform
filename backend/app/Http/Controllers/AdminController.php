<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\PurchaseCode;
use App\Models\AdminActivityLog;
use App\Models\Package;
use App\Models\Unit;
use App\Models\Lesson;
use App\Services\ReportService;
use App\Services\CourseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AdminController extends Controller
{
    protected $reportService;
    protected $courseService;

    public function __construct(ReportService $reportService, CourseService $courseService)
    {
        $this->reportService = $reportService;
        $this->courseService = $courseService;
    }

    /**
     * Get admin analytics dashboard.
     */
    public function dashboard()
    {
        $totalTeachers = User::where('role', 'teacher')->count();
        $totalStudents = User::where('role', 'student')->count();
        $totalCourses = Course::count();
        $totalEnrollments = Enrollment::count();

        // Gross, Refunded, and Net Revenue calculation from transactions
        $grossRevenue = (float) WalletTransaction::where('type', 'purchase')->sum('amount');
        $refundedRevenue = (float) WalletTransaction::where('type', 'refund')->sum('amount');
        $netRevenue = $grossRevenue - $refundedRevenue;

        $grossMonthlyRevenue = (float) WalletTransaction::where('type', 'purchase')
            ->whereYear('created_at', Carbon::now()->year)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount');
        $refundedMonthlyRevenue = (float) WalletTransaction::where('type', 'refund')
            ->whereYear('created_at', Carbon::now()->year)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount');
        $netMonthlyRevenue = $grossMonthlyRevenue - $refundedMonthlyRevenue;

        // Recent transactions
        $recentTransactions = WalletTransaction::with('wallet.student')
            ->latest()
            ->take(10)
            ->get();

        // Monthly sales for chart (NET sales)
        $monthlyChart = WalletTransaction::whereIn('type', ['purchase', 'refund'])
            ->select(
                DB::raw("COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE -amount END), 0) as total"),
                DB::raw("TO_CHAR(created_at, 'YYYY-MM') as month")
            )
            ->groupBy('month')
            ->orderBy('month', 'asc')
            ->get();

        // Calculate Teacher Subscription Revenue Metrics
        $subLifetimeRevenue = (float) \App\Models\SubscriptionPayment::where('payment_status', 'Paid')->sum('amount');
        $subCurrentMonthRevenue = (float) \App\Models\SubscriptionPayment::where('payment_status', 'Paid')
            ->whereYear('payment_date', Carbon::now()->year)
            ->whereMonth('payment_date', Carbon::now()->month)
            ->sum('amount');
        $subPreviousMonthRevenue = (float) \App\Models\SubscriptionPayment::where('payment_status', 'Paid')
            ->whereYear('payment_date', Carbon::now()->subMonth()->year)
            ->whereMonth('payment_date', Carbon::now()->subMonth()->month)
            ->sum('amount');
        $subTodayRevenue = (float) \App\Models\SubscriptionPayment::where('payment_status', 'Paid')
            ->whereDate('payment_date', Carbon::today())
            ->sum('amount');
        $subPendingRevenue = (float) \App\Models\SubscriptionPayment::where('payment_status', 'Pending')->sum('amount');
        $subRefundedRevenue = (float) \App\Models\SubscriptionPayment::where('payment_status', 'Refunded')->sum('amount');
        
        $subGrowth = 0.0;
        if ($subPreviousMonthRevenue > 0) {
            $subGrowth = (($subCurrentMonthRevenue - $subPreviousMonthRevenue) / $subPreviousMonthRevenue) * 100;
        } elseif ($subCurrentMonthRevenue > 0) {
            $subGrowth = 100.0;
        }

        // Platform Commission Calculations
        $commissionLifetime = (float) \App\Models\PlatformEarning::sum('amount');
        $commissionCurrentMonth = (float) \App\Models\PlatformEarning::whereYear('created_at', Carbon::now()->year)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount');
        $commissionPreviousMonth = (float) \App\Models\PlatformEarning::whereYear('created_at', Carbon::now()->subMonth()->year)
            ->whereMonth('created_at', Carbon::now()->subMonth()->month)
            ->sum('amount');
        $commissionToday = (float) \App\Models\PlatformEarning::whereDate('created_at', Carbon::today())
            ->sum('amount');

        // Teacher Earning Payouts Calculations
        $pendingPayouts = (float) \App\Models\TeacherEarning::where('status', 'pending')->sum('amount');
        $paidPayouts = (float) \App\Models\TeacherEarning::where('status', 'paid')->sum('amount');
        $lifetimeTeacherRevenue = (float) \App\Models\TeacherEarning::sum('amount');

        // System analytics logs
        $analytics = [
            'total_teachers' => $totalTeachers,
            'total_students' => $totalStudents,
            'total_courses' => $totalCourses,
            'total_enrollments' => $totalEnrollments,
            'total_revenue' => $netRevenue, // backward compatibility
            'monthly_revenue' => $netMonthlyRevenue, // backward compatibility
            'gross_revenue' => $grossRevenue,
            'refunded_revenue' => $refundedRevenue,
            'net_revenue' => $netRevenue,
            'gross_monthly_revenue' => $grossMonthlyRevenue,
            'refunded_monthly_revenue' => $refundedMonthlyRevenue,
            'net_monthly_revenue' => $netMonthlyRevenue,
            'recent_transactions' => $recentTransactions,
            'monthly_chart' => $monthlyChart,
            
            // Teacher Subscription metrics
            'sub_lifetime_revenue' => $subLifetimeRevenue,
            'sub_current_month_revenue' => $subCurrentMonthRevenue,
            'sub_previous_month_revenue' => $subPreviousMonthRevenue,
            'sub_today_revenue' => $subTodayRevenue,
            'sub_pending_revenue' => $subPendingRevenue,
            'sub_refunded_revenue' => $subRefundedRevenue,
            'sub_growth_percentage' => $subGrowth,

            // Revenue Split Metrics
            'commission_lifetime' => $commissionLifetime,
            'commission_current_month' => $commissionCurrentMonth,
            'commission_previous_month' => $commissionPreviousMonth,
            'commission_today' => $commissionToday,
            'pending_teacher_payouts' => $pendingPayouts,
            'paid_teacher_payouts' => $paidPayouts,
            'lifetime_teacher_revenue' => $lifetimeTeacherRevenue,
        ];

        return response()->json($analytics);
    }

    /**
     * List all teachers.
     */
    public function listTeachers()
    {
        $teachers = User::where('role', 'teacher')
            ->with(['teacherSubscription.plan'])
            ->withCount('courses')
            ->withCount(['courses as students_count' => function ($query) {
                $query->join('enrollments', 'courses.id', '=', 'enrollments.course_id');
            }])
            ->withCount(['courses as discounted_courses_count' => function ($query) {
                $query->where('enable_discount', true);
            }])
            ->latest()
            ->get();

        $syncService = null;
        try {
            $syncService = app(\App\Services\BunnySubscriptionService::class);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Failed to resolve BunnySubscriptionService: " . $e->getMessage());
        }

        foreach ($teachers as $t) {
            if ($t->teacherSubscription) {
                try {
                    if ($syncService) {
                        $syncService->syncStorageAndCodes($t->id);
                        $t->teacherSubscription->refresh();
                    }

                    $sub = $t->teacherSubscription;
                    
                    // Expiration days remaining
                    $today = \Carbon\Carbon::today();
                    $endDate = $sub->end_date ? \Carbon\Carbon::parse($sub->end_date) : $today;
                    $remainingDays = $today->diffInDays($endDate, false);

                    // Retrieve payment status (e.g. from recent payment)
                    $payment = \App\Models\SubscriptionPayment::where('teacher_subscription_id', $sub->id)
                        ->latest()
                        ->first();
                    $paymentStatus = $payment ? $payment->payment_status : 'Pending';

                    $sub->remaining_days = max(0, $remainingDays);
                    $sub->payment_status = $paymentStatus;
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error("Failed to sync or enrich storage/codes for teacher {$t->id}: " . $e->getMessage());
                }
            }
        }

        return response()->json($teachers);
    }

    /**
     * Create Teacher (Admin Flow).
     */
    public function createTeacher(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string',
            'subject' => 'required|string',
            'bio' => 'nullable|string',
            'experience' => 'required|string',
            'grades' => 'required|array|min:1',
            'avatar' => 'nullable|string',
            'email' => 'nullable|string|email|unique:users,email',
            'password' => 'nullable|string|min:6',
            'status' => 'nullable|string|in:active,disabled',
            'plan_id' => 'nullable|exists:subscription_plans,id',
            'billing_cycle' => 'nullable|string|in:monthly,quarterly,semi_annual,annual',
            'extra_storage_gb' => 'nullable|integer|min:0',
            'extra_codes' => 'nullable|integer|min:0',
            'teaching_mode' => 'nullable|string|in:online,center,both',
        ]);

        $status = $request->status ?? 'active';
        $email = $request->email;
        
        if (empty($email)) {
            // Auto generate email
            $safeName = Str::slug($request->name, '_');
            if (empty($safeName)) {
                $safeName = 'teacher';
            }
            $randomNum = mt_rand(100, 999);
            $email = $safeName . '_' . $randomNum . '@teacher.com';

            // Check uniqueness
            while (User::where('email', $email)->exists()) {
                $randomNum = mt_rand(100, 999);
                $email = $safeName . '_' . $randomNum . '@teacher.com';
            }
        }

        // Auto generate temporary password if empty
        $tempPassword = $request->password;
        $mustChange = empty($tempPassword);
        if (empty($tempPassword)) {
            $tempPassword = Str::random(8);
        }

        $teacher = null;
        DB::beginTransaction();
        try {
            $teacher = User::create([
                'name' => $request->name,
                'email' => $email,
                'password' => Hash::make($tempPassword),
                'role' => 'teacher',
                'phone' => $request->phone,
                'subject' => $request->subject,
                'bio' => $request->bio,
                'experience' => $request->experience,
                'grades' => $request->grades,
                'avatar' => $request->avatar,
                'must_change_password' => $mustChange,
                'status' => $status,
                'teaching_mode' => $request->teaching_mode ?? 'both',
            ]);

            // Initialize subscription if plan is provided
            if ($request->plan_id) {
                $plan = \App\Models\SubscriptionPlan::findOrFail($request->plan_id);
                $billingCycle = $request->billing_cycle ?? $request->billing_period ?? 'monthly';
                
                $settings = DB::table('subscription_settings')->pluck('value', 'key')->toArray();
                $semiDiscount = isset($settings['discount_semi_annually']) ? (float)$settings['discount_semi_annually'] : 10.0;
                $annualDiscount = isset($settings['discount_annually']) ? (float)$settings['discount_annually'] : 20.0;

                $months = 1;
                $discountPercent = 0;
                if ($billingCycle === 'quarterly') {
                    $months = 3;
                    $discountPercent = 0;
                } elseif ($billingCycle === 'semi_annual') {
                    $months = 6;
                    $discountPercent = $semiDiscount;
                } elseif ($billingCycle === 'annual') {
                    $months = 12;
                    $discountPercent = $annualDiscount;
                }

                $basePrice = (float)($plan->price_egp * $months);
                $discountAmount = round($basePrice * ($discountPercent / 100), 2);
                $finalPrice = round($basePrice - $discountAmount, 2);

                $sub = \App\Models\TeacherSubscription::create([
                    'teacher_id' => $teacher->id,
                    'plan_id' => $plan->id,
                    'billing_period' => $billingCycle,
                    'billing_cycle' => $billingCycle,
                    'discount_percentage' => $discountPercent,
                    'discount_amount' => $discountAmount,
                    'final_price' => $finalPrice,
                    'start_date' => Carbon::now()->toDateString(),
                    'end_date' => Carbon::now()->addMonths($months)->toDateString(),
                    'status' => 'Active',
                    'used_storage_bytes' => 0,
                    'used_codes' => 0,
                ]);

                // Add extra storage (15 EGP per GB)
                if ($request->extra_storage_gb > 0) {
                    \App\Models\SubscriptionAddon::create([
                        'teacher_subscription_id' => $sub->id,
                        'type' => 'storage',
                        'amount' => $request->extra_storage_gb,
                        'price_egp' => $request->extra_storage_gb * 15,
                    ]);

                    \App\Models\SubscriptionPayment::create([
                        'teacher_subscription_id' => $sub->id,
                        'amount' => $request->extra_storage_gb * 15,
                        'payment_status' => 'Paid',
                        'notes' => "دفع مساحة إضافية (+{$request->extra_storage_gb} جيجا) عند إنشاء الحساب",
                        'payment_date' => Carbon::now(),
                        'admin_name' => $request->user()->name,
                        'admin_id' => $request->user()->id,
                    ]);
                }

                // Add extra student codes (5 EGP per code)
                if ($request->extra_codes > 0) {
                    \App\Models\SubscriptionAddon::create([
                        'teacher_subscription_id' => $sub->id,
                        'type' => 'codes',
                        'amount' => $request->extra_codes,
                        'price_egp' => $request->extra_codes * 5, // Pricing updated to 5 EGP
                    ]);

                    \App\Models\SubscriptionPayment::create([
                        'teacher_subscription_id' => $sub->id,
                        'amount' => $request->extra_codes * 5,
                        'payment_status' => 'Paid',
                        'notes' => "دفع أكواد إضافية (+{$request->extra_codes} كود) عند إنشاء الحساب",
                        'payment_date' => Carbon::now(),
                        'admin_name' => $request->user()->name,
                        'admin_id' => $request->user()->id,
                    ]);
                }

                // Create payment log for basic plan
                \App\Models\SubscriptionPayment::create([
                    'teacher_subscription_id' => $sub->id,
                    'amount' => $finalPrice,
                    'payment_status' => 'Paid',
                    'notes' => "قيمة الباقة الأساسية ({$plan->name}) - دورة {$billingCycle}",
                    'payment_date' => Carbon::now(),
                    'admin_name' => $request->user()->name,
                    'admin_id' => $request->user()->id,
                ]);
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'حدث خطأ أثناء إنشاء حساب المعلم أو تفعيل الاشتراك.',
                'errors' => ['error' => [$e->getMessage()]],
            ], 422);
        }

        // Save Admin Activity log (wrapped to not block execution)
        try {
            $logPlanName = isset($plan) ? $plan->name : 'N/A';
            $logExtraStorage = $request->extra_storage_gb ?? 0;
            $logExtraCodes = $request->extra_codes ?? 0;
            \App\Models\AdminActivityLog::create([
                'admin_name' => $request->user()->name,
                'action_type' => "إنشاء حساب للمعلم {$teacher->name} بباقة {$logPlanName} ومساحة إضافية {$logExtraStorage} جيجا وأكواد إضافية {$logExtraCodes}",
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            \Log::warning("Failing to create AdminActivityLog upon teacher creation: " . $e->getMessage());
        }

        return response()->json([
            'teacher' => $teacher,
            'generated_email' => $email,
            'temporary_password' => $tempPassword,
            'message' => 'تم إنشاء حساب المعلم واشتراكه بنجاح.',
        ], 201);
    }

    /**
     * Edit Teacher.
     */
    public function updateTeacher(Request $request, $id)
    {
        $teacher = User::where('id', $id)->where('role', 'teacher')->firstOrFail();

        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string',
            'subject' => 'required|string',
            'bio' => 'nullable|string',
            'experience' => 'required|string',
            'grades' => 'required|array',
            'status' => 'required|string|in:active,disabled',
            'avatar' => 'nullable|string',
            'teaching_mode' => 'nullable|string|in:online,center,both',
        ]);

        $teacher->update($request->only([
            'name', 'phone', 'subject', 'bio', 'experience', 'grades', 'status', 'avatar', 'teaching_mode'
        ]));

        return response()->json([
            'teacher' => $teacher,
            'message' => 'تم تحديث بيانات المعلم بنجاح.',
        ]);
    }

    /**
     * List all students.
     */
    public function listStudents()
    {
        $students = User::where('role', 'student')
            ->with('wallet')
            ->withCount('enrollments')
            ->latest()
            ->get();

        return response()->json($students);
    }

    /**
     * List all courses.
     */
    public function listCourses()
    {
        $courses = Course::with('teacher')
            ->withCount('students')
            ->latest()
            ->get();

        return response()->json($courses);
    }

    /**
     * Generate Purchase Codes.
     */
    public function generatePurchaseCodes(Request $request)
    {
        $request->validate([
            'type' => 'required|string|in:wallet,course,teacher',
            'quantity' => 'required|integer|min:1|max:10000',
            'amount' => 'nullable|numeric|min:0', // required if type is wallet or teacher
            'course_id' => 'nullable|exists:courses,id', // optional course link
            'package_id' => 'nullable|exists:packages,id', // optional package link
            'teacher_id' => 'nullable|exists:users,id', // optional teacher link
            'expires_at' => 'nullable|date|after:today',
        ]);

        if ($request->type === 'wallet' && !$request->amount) {
            return response()->json(['message' => 'القيمة مطلوبة لشحن المحفظة.'], 422);
        }

        if ($request->type === 'teacher') {
            if (!$request->teacher_id) {
                return response()->json(['message' => 'يجب اختيار معلم محدد لتقييد الكود به.'], 422);
            }
            if (!$request->amount) {
                return response()->json(['message' => 'يجب إدخال رصيد المعلم المستهدف الكود.'], 422);
            }
        }

        if ($request->type === 'course' && !$request->course_id && !$request->package_id) {
            return response()->json(['message' => 'يجب تحديد الكورس أو الباقة لإنشاء كود الاشتراك.'], 422);
        }

        $expires = $request->expires_at ? Carbon::parse($request->expires_at) : null;
        $quantity = (int) $request->quantity;

        // Fetch course or package selling price if type is course
        $amount = 0.00;
        if ($request->type === 'wallet' || $request->type === 'teacher') {
            $amount = (float) $request->amount;
        } elseif ($request->type === 'course') {
            if ($request->course_id) {
                $course = Course::findOrFail($request->course_id);
                $amount = (float) $course->final_price;
            } elseif ($request->package_id) {
                $package = Package::findOrFail($request->package_id);
                $amount = (float) $package->price;
            }
        }

        // Generate unique codes in memory
        $codes = [];
        while (count($codes) < $quantity) {
            $codeStr = 'ELM-' . strtoupper(Str::random(8));
            $codes[$codeStr] = true;
        }
        $codeList = array_keys($codes);

        // Check if any of these codes already exist in the database
        $existingCodes = PurchaseCode::whereIn('code', $codeList)->pluck('code')->toArray();
        
        while (!empty($existingCodes)) {
            $newCodesNeeded = count($existingCodes);
            $newCodes = [];
            while (count($newCodes) < $newCodesNeeded) {
                $codeStr = 'ELM-' . strtoupper(Str::random(8));
                if (!isset($codes[$codeStr])) {
                    $newCodes[$codeStr] = true;
                }
            }
            // Remove colliding codes from our main list
            foreach ($existingCodes as $collideCode) {
                unset($codes[$collideCode]);
            }
            // Add new codes
            foreach (array_keys($newCodes) as $newCodeStr) {
                $codes[$newCodeStr] = true;
            }
            $codeList = array_keys($codes);
            // Re-check only the newly added codes
            $existingCodes = PurchaseCode::whereIn('code', array_keys($newCodes))->pluck('code')->toArray();
        }

        // Prepare records for insertion
        $now = now();
        $records = [];
        foreach ($codeList as $codeStr) {
            $records[] = [
                'code' => $codeStr,
                'type' => $request->type,
                'code_type' => $request->type,
                'amount' => $amount,
                'credit_amount' => $request->type === 'teacher' ? $amount : 0.00,
                'course_id' => $request->type === 'course' ? $request->course_id : null,
                'package_id' => $request->type === 'course' ? $request->package_id : null,
                'teacher_id' => ($request->type === 'teacher' || $request->teacher_id) ? $request->teacher_id : null,
                'is_redeemed' => false,
                'expires_at' => $expires,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Write generation inside a database transaction
        DB::transaction(function () use ($records) {
            foreach (array_chunk($records, 1000) as $chunk) {
                PurchaseCode::insert($chunk);
            }
        });

        // Retrieve the generated codes to return them to the client
        $generatedCodes = [];
        foreach (array_chunk($codeList, 1000) as $chunk) {
            $chunkCodes = PurchaseCode::whereIn('code', $chunk)->get();
            foreach ($chunkCodes as $c) {
                $generatedCodes[] = $c;
            }
        }

        return response()->json([
            'codes' => $generatedCodes,
            'message' => 'تم إنشاء ' . $quantity . ' كود بنجاح.',
        ], 201);
    }

    /**
     * List purchase codes.
     */
    public function listPurchaseCodes(Request $request)
    {
        $query = PurchaseCode::with(['course', 'package', 'teacher', 'redeemedBy']);

        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        if ($request->has('status') && $request->status) {
            if ($request->status === 'redeemed') {
                $query->where('is_redeemed', true);
            } elseif ($request->status === 'active') {
                $query->where('is_redeemed', false)->where(function($q) {
                    $q->whereNull('expires_at')->orWhere('expires_at', '>', Carbon::now());
                });
            } elseif ($request->status === 'expired') {
                $query->where('is_redeemed', false)->where('expires_at', '<=', Carbon::now());
            }
        }

        $codes = $query->latest()->get();

        return response()->json($codes);
    }

    /**
     * View reports details.
     */
    public function reports()
    {
        $reportData = $this->reportService->getAdminSalesReport();
        
        // Compute teacher revenue dynamically using ReportService
        $teachers = User::where('role', 'teacher')->get();
        $teacherRevenue = [];
        foreach ($teachers as $t) {
            $tReport = $this->reportService->getTeacherRevenueReport($t->id);
            if ($tReport['net_revenue'] != 0) {
                $teacherRevenue[] = [
                    'teacher_name' => $t->name,
                    'total_revenue' => $tReport['net_revenue']
                ];
            }
        }

        $refundLogs = \App\Models\RefundLog::with(['student', 'course', 'package', 'lesson', 'admin'])
            ->latest()
            ->get();

        $walletAdjustments = \App\Models\AdminActivityLog::where('action_type', 'like', '%Wallet Adjustment%')
            ->latest()
            ->get();

        $codeUsages = PurchaseCode::where('is_redeemed', true)
            ->with(['redeemedBy', 'course', 'package'])
            ->latest()
            ->get();

        $data = [
            'sales' => $reportData['sales'],
            'monthly_sales' => $reportData['monthlySales'],
            'teacher_revenue' => $teacherRevenue,
            'refund_logs' => $refundLogs,
            'wallet_adjustments' => $walletAdjustments,
            'code_usages' => $codeUsages,
        ];

        return response()->json([
            'success' => true,
            'message' => 'تم تحميل التقارير بنجاح',
            'data' => $data
        ]);
    }

    /**
     * Disable a user account (Teacher or Student).
     */
    public function disableUser(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $user->status = 'disabled';
        $user->save();
        
        return response()->json([
            'user' => $user,
            'message' => 'تم تعطيل الحساب بنجاح.',
        ]);
    }

    /**
     * Enable a user account (Teacher or Student).
     */
    public function enableUser(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $user->status = 'active';
        $user->save();
        
        return response()->json([
            'user' => $user,
            'message' => 'تم تفعيل الحساب بنجاح.',
        ]);
    }

    /**
     * Admin reset student password.
     */
    public function resetStudentPassword(Request $request, $id)
    {
        $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $student = User::where('id', $id)->where('role', 'student')->firstOrFail();
        
        $student->password = Hash::make($request->password);
        $student->must_change_password = true;
        $student->save();

        return response()->json([
            'student' => $student,
            'message' => 'تم إعادة تعيين كلمة مرور الطالب بنجاح وتفعيل تغيير كلمة المرور إجبارياً عند تسجيل الدخول القادم.',
        ]);
    }

    /**
     * Admin reset teacher password (overwriting previous random implementation with specified password input).
     */
    public function resetTeacherPassword(Request $request, $id)
    {
        $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $teacher = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        
        $teacher->password = Hash::make($request->password);
        $teacher->must_change_password = true;
        $teacher->save();

        return response()->json([
            'teacher' => $teacher,
            'message' => 'تم إعادة تعيين كلمة مرور المعلم بنجاح وتفعيل تغيير كلمة المرور إجبارياً عند تسجيل الدخول القادم.',
        ]);
    }

    /**
     * Delete a student account.
     */
    public function deleteStudent(Request $request, $id)
    {
        $student = User::where('id', $id)->where('role', 'student')->firstOrFail();
        
        $adminName = $request->user()->name;
        $studentEmail = $student->email;
        $ipAddress = $request->ip();

        $student->delete();
        
        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => "Deleted Student: {$studentEmail}",
            'deleted_count' => 1,
            'ip_address' => $ipAddress,
        ]);
        
        return response()->json([
            'message' => 'تم حذف حساب الطالب بنجاح.',
        ]);
    }

    /**
     * Delete a teacher account with course warnings and options to delete or transfer.
     */
    public function deleteTeacher(Request $request, $id)
    {
        $teacher = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        
        $coursesCount = Course::where('teacher_id', $id)->count();
        
        if ($coursesCount > 0) {
            $action = $request->input('action'); // 'delete_all' or 'transfer'
            
            if (!$action) {
                return response()->json([
                    'has_courses' => true,
                    'courses_count' => $coursesCount,
                    'message' => 'هذا المعلم لديه كورسات مرتبطة به. يرجى اختيار إجراء للتعامل مع هذه الكورسات.',
                ], 422);
            }
            
            if ($action === 'transfer') {
                $request->validate([
                    'transfer_to_teacher_id' => 'required|exists:users,id',
                ]);
                
                $transferToId = $request->transfer_to_teacher_id;
                // Transfer courses
                Course::where('teacher_id', $id)->update(['teacher_id' => $transferToId]);
            }
        }
        
        $adminName = $request->user()->name;
        $teacherEmail = $teacher->email;
        $ipAddress = $request->ip();

        // Delete the teacher
        $teacher->delete();
        
        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => "Deleted Teacher: {$teacherEmail}",
            'deleted_count' => 1,
            'ip_address' => $ipAddress,
        ]);
        
        return response()->json([
            'message' => 'تم حذف حساب المعلم بنجاح.',
        ]);
    }

    /**
     * Get analytics statistics for a single student.
     */
    public function studentAnalytics(Request $request, $studentId)
    {
        $student = User::where('id', $studentId)->where('role', 'student')->firstOrFail();
        
        // Student Course Progress: Completed Videos count vs Total Videos count
        $totalVideos = \App\Models\Video::count();
        $completedVideos = \App\Models\VideoProgress::where('student_id', $studentId)
            ->where('completed', true)
            ->count();

        $watchTimeSeconds = \App\Models\VideoProgress::where('student_id', $studentId)
            ->sum('watched_seconds');

        // Exam and homework scores
        $attempts = \App\Models\StudentExam::with('exam')
            ->where('student_id', $studentId)
            ->get();

        $lastProgress = \App\Models\VideoProgress::where('student_id', $studentId)->latest('updated_at')->first();
        $lastExam = \App\Models\StudentExam::where('student_id', $studentId)->latest('updated_at')->first();
        
        $lastActivityDate = null;
        if ($lastProgress && $lastExam) {
            $lastActivityDate = $lastProgress->updated_at->gt($lastExam->updated_at) ? $lastProgress->updated_at : $lastExam->updated_at;
        } elseif ($lastProgress) {
            $lastActivityDate = $lastProgress->updated_at;
        } elseif ($lastExam) {
            $lastActivityDate = $lastExam->updated_at;
        }

        return response()->json([
            'student' => $student,
            'progress' => [
                'total_videos' => $totalVideos,
                'completed_videos' => $completedVideos,
                'completion_rate' => $totalVideos > 0 ? round(($completedVideos / $totalVideos) * 100, 2) : 0,
                'watch_time_minutes' => round($watchTimeSeconds / 60, 2),
            ],
            'exam_attempts' => $attempts,
            'last_activity' => $lastActivityDate ? $lastActivityDate->diffForHumans() : 'لا يوجد نشاط مؤخراً',
        ]);
    }

    /**
     * List all packages.
     */
    public function listPackages()
    {
        $packages = \App\Models\Package::with(['course.teacher', 'lessons'])
            ->withCount('enrollments')
            ->latest()
            ->get();

        return response()->json($packages);
    }

    /**
     * Update a package.
     */
    public function updatePackage(Request $request, $packageId)
    {
        $package = \App\Models\Package::findOrFail($packageId);

        $request->validate([
            'title' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'cover_image' => 'nullable|string',
            'package_thumbnail' => 'nullable|string',
            'lesson_ids' => 'required|array',
            'lesson_ids.*' => 'exists:lessons,id',
            'type' => 'required|string|in:bundle,month,revision',
        ]);

        return DB::transaction(function () use ($request, $package) {
            $package->update([
                'title' => $request->title,
                'price' => $request->price,
                'description' => $request->description,
                'cover_image' => $request->cover_image,
                'package_thumbnail' => $request->package_thumbnail,
                'type' => $request->type,
            ]);

            $package->lessons()->sync($request->lesson_ids);

            return response()->json($package->load('lessons'), 200);
        });
    }

    /**
     * Delete a package.
     */
    public function deletePackage(Request $request, $packageId)
    {
        \Log::info('DELETE PACKAGE REQUEST', [
            'package_id' => $packageId
        ]);

        try {
            $package = \App\Models\Package::find($packageId);

            \Log::info('PACKAGE FOUND', [
                'package' => $package
            ]);

            if (!$package) {
                return response()->json([
                    'success' => false,
                    'message' => 'Package not found'
                ], 404);
            }

            \Log::info('STARTING DELETE');

            \DB::beginTransaction();
            
            // Delete dependent records
            \DB::table('package_lessons')->where('package_id', $packageId)->delete();
            \DB::table('purchase_codes')->where('package_id', $packageId)->update(['package_id' => null]);
            \DB::table('enrollments')->where('package_id', $packageId)->update(['package_id' => null]);
            \DB::table('refund_logs')->where('package_id', $packageId)->update(['package_id' => null]);
            
            $package->delete();
            
            \DB::commit();

            \Log::info('DELETE SUCCESS');

            return response()->json(['message' => 'تم حذف الباقة المجمعة بنجاح'], 200);
        } catch (\Throwable $e) {
            if (\DB::transactionLevel() > 0) {
                \DB::rollBack();
            }
            \Log::error('DELETE FAILED', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Get all available permissions dynamically.
     */
    public function listAllPermissions(Request $request)
    {
        // Enforce Super Admin check
        if (!$request->user()->is_super_admin && !$request->user()->hasPermission('admins.manage')) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        // Sync permissions from config
        $config = require base_path('config/permissions.php');
        $groups = $config['groups'] ?? [];
        $permissionsConfig = $config['permissions'] ?? [];
        
        foreach ($permissionsConfig as $key => $details) {
            $groupKey = $details['group'];
            \App\Models\Permission::updateOrCreate(
                ['key' => $key],
                [
                    'group_key' => $groupKey,
                    'group_label' => $groups[$groupKey] ?? $groupKey,
                    'label_ar' => $details['label'],
                ]
            );
        }
        
        // Clean up legacy permissions not in config
        \App\Models\Permission::whereNotIn('key', array_keys($permissionsConfig))->delete();

        $permissions = \App\Models\Permission::orderBy('group_key')->get();
        return response()->json($permissions);
    }

    /**
     * List all administrator users.
     */
    public function listAdmins(Request $request)
    {
        // Enforce Super Admin or admins.manage permission check
        if (!$request->user()->is_super_admin && !$request->user()->hasPermission('admins.manage')) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $admins = User::where('role', 'admin')
            ->orderBy('is_super_admin', 'desc')
            ->latest()
            ->get();

        return response()->json($admins);
    }

    /**
     * Create a new administrator.
     */
    public function createAdmin(Request $request)
    {
        // Enforce Super Admin check
        if (!$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $availablePermissionKeys = \App\Models\Permission::pluck('key')->toArray();
        if (empty($availablePermissionKeys)) {
            $config = require base_path('config/permissions.php');
            $availablePermissionKeys = array_keys($config['permissions'] ?? []);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'permissions' => 'required|array',
            'permissions.*' => 'string|in:' . implode(',', $availablePermissionKeys),
        ]);

        $admin = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'admin',
            'is_super' => false,
            'is_super_admin' => false,
            'permissions' => $request->permissions,
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => "Created Admin: {$admin->email}",
            'deleted_count' => 0,
            'ip_address' => $ipAddress,
        ]);

        return response()->json([
            'admin' => $admin,
            'message' => 'تم إنشاء حساب المشرف بنجاح.',
        ], 201);
    }

    /**
     * Update an administrator permissions/details.
     */
    public function updateAdmin(Request $request, $id)
    {
        // Enforce Super Admin check
        if (!$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $admin = User::where('id', $id)->where('role', 'admin')->firstOrFail();

        // Prevent modifying Super Admin
        if ($admin->is_super_admin && $admin->id !== $request->user()->id) {
            return response()->json(['message' => 'لا يمكن تعديل صلاحيات المشرف العام الرئيسي.'], 403);
        }

        $availablePermissionKeys = \App\Models\Permission::pluck('key')->toArray();
        if (empty($availablePermissionKeys)) {
            $config = require base_path('config/permissions.php');
            $availablePermissionKeys = array_keys($config['permissions'] ?? []);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'permissions' => 'required|array',
            'permissions.*' => 'string|in:' . implode(',', $availablePermissionKeys),
        ]);

        $admin->name = $request->name;
        $admin->email = $request->email;
        if ($request->filled('password')) {
            $admin->password = Hash::make($request->password);
        }
        
        // Only allow editing permissions if it is not the main super admin editing themselves
        if (!$admin->is_super_admin) {
            $admin->permissions = $request->permissions;
        }
        
        $admin->save();

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => "Updated Admin: {$admin->email}",
            'deleted_count' => 0,
            'ip_address' => $ipAddress,
        ]);

        return response()->json([
            'admin' => $admin,
            'message' => 'تم تحديث بيانات المشرف بنجاح.',
        ]);
    }

    /**
     * Delete an administrator.
     */
    public function deleteAdmin(Request $request, $id)
    {
        // Enforce Super Admin check
        if (!$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $admin = User::where('id', $id)->where('role', 'admin')->firstOrFail();

        if ($admin->is_super_admin) {
            return response()->json(['message' => 'لا يمكن حذف حساب المشرف العام الرئيسي.'], 403);
        }

        $adminName = $request->user()->name;
        $adminEmail = $admin->email;
        $ipAddress = $request->ip();

        $admin->delete();

        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => "Deleted Admin: {$adminEmail}",
            'deleted_count' => 1,
            'ip_address' => $ipAddress,
        ]);

        return response()->json([
            'message' => 'تم حذف حساب المشرف بنجاح.',
        ]);
    }

    /**
     * Toggle active/disabled status of an administrator.
     */
    public function toggleAdminStatus(Request $request, $id)
    {
        // Enforce Super Admin check
        if (!$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $admin = User::where('id', $id)->where('role', 'admin')->firstOrFail();

        if ($admin->is_super_admin) {
            return response()->json(['message' => 'لا يمكن تعطيل حساب المشرف العام الرئيسي.'], 403);
        }

        $admin->status = $admin->status === 'active' ? 'disabled' : 'active';
        $admin->save();

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => ($admin->status === 'active' ? 'Activated' : 'Deactivated') . " Admin: {$admin->email}",
            'deleted_count' => 0,
            'ip_address' => $ipAddress,
        ]);

        return response()->json([
            'admin' => $admin,
            'message' => $admin->status === 'active' ? 'تم تفعيل حساب المشرف بنجاح.' : 'تم تعطيل حساب المشرف بنجاح.',
        ]);
    }

    /**
     * Reset the platform for a new academic year.
     */
    public function resetYear(Request $request)
    {
        // Enforce Super Admin or admins.manage permission check
        if (!$request->user()->is_super_admin && !$request->user()->hasPermission('admins.manage')) {
            return response()->json(['message' => 'عذراً، لا تملك الصلاحية لإجراء هذا الإجراء الخطير.'], 403);
        }

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        return DB::transaction(function () use ($adminName, $ipAddress) {
            // Remove all student enrollments (course and package subscriptions)
            DB::table('enrollments')->delete();

            // Remove exam attempts and results, and homework submissions
            DB::table('student_answers')->delete();
            DB::table('student_exams')->delete();

            // Remove exam purchases
            DB::table('exam_purchases')->delete();

            // Remove watch progress
            DB::table('video_progresses')->delete();

            // Remove temporary reports (by clearing wallet transactions)
            DB::table('wallet_transactions')->delete();

            // Reset student wallets to 0
            DB::table('wallets')->update(['balance' => 0.00]);

            // Remove notifications (if a notifications table exists)
            if (\Illuminate\Support\Facades\Schema::hasTable('notifications')) {
                DB::table('notifications')->delete();
            }

            // Log activity
            \App\Models\AdminActivityLog::create([
                'admin_name' => $adminName,
                'action_type' => 'Reset Academic Year',
                'deleted_count' => 0,
                'ip_address' => $ipAddress,
            ]);

            return response()->json([
                'message' => 'تم تهيئة المنصة للسنة الجديدة بنجاح وحذف كافة الاشتراكات والمحاولات والتقارير المؤقتة.',
            ]);
        });
    }

    /**
     * Bulk delete all students with safety protections.
     */
    public function bulkDeleteStudents(Request $request)
    {
        if (!$request->user() || !$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام الرئيسي.'], 403);
        }

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        return DB::transaction(function () use ($request, $adminName, $ipAddress) {
            $studentIds = User::where('role', 'student')->pluck('id')->toArray();
            $deletedCount = count($studentIds);

            if ($deletedCount > 0) {
                // Delete student answers
                DB::table('student_answers')
                    ->whereIn('student_exam_id', function ($query) use ($studentIds) {
                        $query->select('id')->from('student_exams')->whereIn('student_id', $studentIds);
                    })->delete();

                // Delete student exams
                DB::table('student_exams')->whereIn('student_id', $studentIds)->delete();

                // Delete exam purchases
                DB::table('exam_purchases')->whereIn('student_id', $studentIds)->delete();

                // Delete enrollments
                DB::table('enrollments')->whereIn('student_id', $studentIds)->delete();

                // Delete watch history
                DB::table('video_progresses')->whereIn('student_id', $studentIds)->delete();

                // Delete wallet transactions
                DB::table('wallet_transactions')
                    ->whereIn('wallet_id', function ($query) use ($studentIds) {
                        $query->select('id')->from('wallets')->whereIn('student_id', $studentIds);
                    })->delete();

                // Delete wallets
                DB::table('wallets')->whereIn('student_id', $studentIds)->delete();

                // Delete notifications if table exists
                if (\Illuminate\Support\Facades\Schema::hasTable('notifications')) {
                    DB::table('notifications')
                        ->where('notifiable_type', 'App\Models\User')
                        ->whereIn('notifiable_id', $studentIds)
                        ->delete();
                }

                // Delete tokens
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', 'App\Models\User')
                    ->whereIn('tokenable_id', $studentIds)
                    ->delete();

                // Delete student accounts
                User::whereIn('id', $studentIds)->delete();
            }

            // Log activity
            \App\Models\AdminActivityLog::create([
                'admin_name' => $adminName,
                'action_type' => 'Deleted Students',
                'deleted_count' => $deletedCount,
                'ip_address' => $ipAddress,
            ]);

            return response()->json([
                'message' => 'تم حذف جميع الطلاب بنجاح وبشكل نهائي.',
                'deleted_count' => $deletedCount,
            ]);
        });
    }

    /**
     * Bulk delete all teachers with safety protections.
     */
    public function bulkDeleteTeachers(Request $request)
    {
        if (!$request->user() || !$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام الرئيسي.'], 403);
        }

        $coursesCount = Course::count();
        if ($coursesCount > 0) {
            $courses = Course::with('teacher')->get();
            $courseDetails = $courses->map(function ($course) {
                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'teacher_name' => $course->teacher ? $course->teacher->name : 'غير محدد'
                ];
            });

            return response()->json([
                'error_type' => 'courses_exist',
                'message' => 'لا يمكن حذف المعلمين لوجود كورسات نشطة مرتبطة بهم. يرجى حذف الكورسات أولاً.',
                'courses' => $courseDetails
            ], 422);
        }

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        return DB::transaction(function () use ($request, $adminName, $ipAddress) {
            $teacherIds = User::where('role', 'teacher')->pluck('id')->toArray();
            $deletedCount = count($teacherIds);

            if ($deletedCount > 0) {
                // Delete tokens
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', 'App\Models\User')
                    ->whereIn('tokenable_id', $teacherIds)
                    ->delete();

                // Delete teacher accounts (this deletes profiles and permissions since they are on the users table)
                User::whereIn('id', $teacherIds)->delete();
            }

            // Log activity
            \App\Models\AdminActivityLog::create([
                'admin_name' => $adminName,
                'action_type' => 'Deleted Teachers',
                'deleted_count' => $deletedCount,
                'ip_address' => $ipAddress,
            ]);

            return response()->json([
                'message' => 'تم حذف جميع المعلمين بنجاح وبشكل نهائي.',
                'deleted_count' => $deletedCount,
            ]);
        });
    }

    /**
     * Bulk delete all codes with safety protections.
     */
    public function bulkDeleteCodes(Request $request)
    {
        if (!$request->user() || !$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام الرئيسي.'], 403);
        }

        $adminName = $request->user()->name;
        $ipAddress = $request->ip();

        return DB::transaction(function () use ($request, $adminName, $ipAddress) {
            $deletedCount = DB::table('purchase_codes')->count();

            // Delete all codes
            DB::table('purchase_codes')->delete();

            // Log activity
            \App\Models\AdminActivityLog::create([
                'admin_name' => $adminName,
                'action_type' => 'Deleted Codes',
                'deleted_count' => $deletedCount,
                'ip_address' => $ipAddress,
            ]);

            return response()->json([
                'message' => 'تم حذف جميع الأكواد بنجاح وبشكل نهائي.',
                'deleted_count' => $deletedCount,
            ]);
        });
    }

    /**
     * Delete Course (Admin Flow).
     */
    public function deleteCourse(Request $request, $id)
    {
        $course = Course::findOrFail($id);
        
        $adminName = $request->user()->name;
        $courseTitle = $course->title;
        $ipAddress = $request->ip();

        $course->delete();

        // Log activity
        \App\Models\AdminActivityLog::create([
            'admin_name' => $adminName,
            'action_type' => "Deleted Course: {$courseTitle}",
            'deleted_count' => 1,
            'ip_address' => $ipAddress,
        ]);

        return response()->json([
            'message' => 'تم حذف الكورس بنجاح.',
        ]);
    }

    /**
     * View all activity logs (Super Admin only).
     */
    public function activityLogs(Request $request)
    {
        if (!$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $logs = \App\Models\AdminActivityLog::latest()->get();
        return response()->json($logs);
    }

    /**
     * Get student enrollments for refund management.
     */
    public function studentEnrollments($studentId)
    {
        $enrollments = Enrollment::with(['course.teacher', 'package', 'lesson'])
            ->where('student_id', $studentId)
            ->latest()
            ->get();
        return response()->json($enrollments);
    }

    /**
     * Refund student enrollment (Purchase Reversal System).
     */
    public function refundEnrollment(Request $request, $enrollmentId)
    {
        $enrollment = Enrollment::with(['course', 'package', 'lesson'])->findOrFail($enrollmentId);
        $studentId = $enrollment->student_id;
        $admin = $request->user();

        return DB::transaction(function () use ($enrollment, $studentId, $admin, $request) {
            $wallet = Wallet::firstOrCreate(['student_id' => $studentId], ['balance' => 0.00]);
            
            $amount = 0.00;
            if ($enrollment->package_id) {
                // Refund package
                $amount = $enrollment->package->price;
                // Try to find exact transaction amount
                $tx = WalletTransaction::where('wallet_id', $wallet->id)
                    ->where('type', 'purchase')
                    ->where('reference_id', $enrollment->package_id)
                    ->where('description', 'like', '%باقة%')
                    ->latest()
                    ->first();
                if ($tx) {
                    $amount = $tx->amount;
                }
            } elseif ($enrollment->lesson_id) {
                // Refund lesson
                $amount = $enrollment->lesson->price ?: 0.00;
                // Try to find exact transaction amount
                $tx = WalletTransaction::where('wallet_id', $wallet->id)
                    ->where('type', 'purchase')
                    ->where('reference_id', $enrollment->lesson_id)
                    ->where(function($q) {
                        $q->where('description', 'like', '%محاضرة%')
                          ->orWhere('description', 'like', '%درس%');
                    })
                    ->latest()
                    ->first();
                if ($tx) {
                    $amount = $tx->amount;
                }
            } else {
                // Refund course
                $amount = $enrollment->course->final_price;
                $tx = WalletTransaction::where('wallet_id', $wallet->id)
                    ->where('type', 'purchase')
                    ->where('reference_id', $enrollment->course_id)
                    ->where('description', 'like', '%كورس%')
                    ->latest()
                    ->first();
                if ($tx) {
                    $amount = $tx->amount;
                }
            }

            // Remove student access by deleting enrollment
            $enrollment->delete();

            // Create Wallet Transaction
            $desc = $enrollment->package_id 
                ? 'إرجاع قيمة باقة: ' . $enrollment->package->title 
                : ($enrollment->lesson_id 
                    ? 'إرجاع قيمة درس: ' . $enrollment->lesson->title 
                    : 'إرجاع قيمة كورس: ' . $enrollment->course->title);

            $refId = $enrollment->package_id ?: ($enrollment->lesson_id ?: $enrollment->course_id);
            
            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'type' => 'refund',
                'amount' => $amount,
                'description' => $desc . ' بواسطة المسؤول (استرجاع إداري)',
                'reference_id' => $refId,
            ]);

            // Save Refund Log
            \App\Models\RefundLog::create([
                'student_id' => $studentId,
                'course_id' => $enrollment->course_id,
                'package_id' => $enrollment->package_id,
                'lesson_id' => $enrollment->lesson_id,
                'amount' => $amount,
                'admin_id' => $admin->id,
            ]);

            // Save Admin Activity Log
            \App\Models\AdminActivityLog::create([
                'admin_name' => $admin->name,
                'action_type' => "Wallet Adjustment (Refund/Cancel: {$amount} ج.م) to Student ID: {$studentId}",
                'deleted_count' => 0,
                'ip_address' => $request->ip(),
            ]);

            // Recalculate balance using dynamic transaction ledger and save it
            $wallet->balance = $wallet->getBalanceAttribute(null);
            $wallet->save();

            return response()->json([
                'message' => 'تم إلغاء الاشتراك وإعادة المبلغ إلى محفظة الطالب بنجاح.',
                'balance' => $wallet->balance,
            ]);
        });
    }

    /**
     * Adjust student wallet balance (Admin Wallet Control).
     */
    public function adjustStudentWallet(Request $request, $studentId)
    {
        $request->validate([
            'action' => 'required|string|in:increase,decrease',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'nullable|string',
        ]);

        $action = $request->action;
        $amount = $request->amount;
        $admin = $request->user();

        return DB::transaction(function () use ($studentId, $action, $amount, $admin, $request) {
            $wallet = Wallet::firstOrCreate(['student_id' => $studentId], ['balance' => 0.00]);
            
            if ($action === 'increase') {
                $wallet->balance += $amount;
                $wallet->save();

                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'recharge',
                    'amount' => $amount,
                    'description' => $request->description ?: 'شحن الرصيد (+ إضافة رصيد بواسطة المسؤول)',
                    'reference_id' => null,
                ]);
            } else {
                if ($wallet->balance < $amount) {
                    return response()->json(['message' => 'رصيد المحفظة الحالي (' . $wallet->balance . ' ج.م) أقل من القيمة المراد خصمها.'], 422);
                }

                $wallet->balance -= $amount;
                $wallet->save();

                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'purchase',
                    'amount' => $amount,
                    'description' => $request->description ?: 'خصم رصيد (- خصم رصيد بواسطة المسؤول)',
                    'reference_id' => null,
                ]);
            }

            // Log activity
            \App\Models\AdminActivityLog::create([
                'admin_name' => $admin->name,
                'action_type' => "Wallet Adjustment ({$action}: {$amount} ج.م) for Student ID: {$studentId}",
                'deleted_count' => 0,
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'تم تعديل محفظة الطالب بنجاح.',
                'balance' => $wallet->balance,
            ]);
        });
    }

    /**
     * Get refund logs (Refund history).
     */
    public function refundLogs()
    {
        $logs = \App\Models\RefundLog::with(['student', 'course', 'package', 'admin'])
            ->latest()
            ->get();
        return response()->json($logs);
    }

    /**
     * List all users with active sessions.
     */
    public function listActiveSessions(\Illuminate\Http\Request $request)
    {
        $users = User::whereNotNull('session_token')
            ->select('id', 'name', 'email', 'role', 'device_id', 'last_activity')
            ->orderBy('last_activity', 'desc')
            ->get();
        return response()->json($users);
    }

    /**
     * Force logout of a specific user.
     */
    public function forceLogoutSession(\Illuminate\Http\Request $request, $id)
    {
        $user = User::findOrFail($id);
        
        // Delete all Sanctum tokens
        $user->tokens()->delete();
        
        // Clear session token
        $user->update([
            'session_token' => null,
            'device_id' => null,
            'last_activity' => null,
        ]);

        return response()->json(['message' => "تم إنهاء الجلسة وتسجيل خروج المستخدم {$user->name} بنجاح."]);
    }

    /**
     * Force logout of all active sessions except current admin.
     */
    public function forceLogoutAllSessions(\Illuminate\Http\Request $request)
    {
        $currentAdminId = $request->user()->id;

        // Fetch all users with session tokens except the current admin
        $users = User::whereNotNull('session_token')
            ->where('id', '!=', $currentAdminId)
            ->get();

        foreach ($users as $user) {
            $user->tokens()->delete();
            $user->update([
                'session_token' => null,
                'device_id' => null,
                'last_activity' => null,
            ]);
        }

        return response()->json(['message' => 'تم إنهاء جميع الجلسات النشطة بنجاح (باستثنائك).']);
    }

    /**
     * Get Bunny Stream dashboard stats for administrators.
     */
    public function bunnyDashboard(Request $request)
    {
        // 1. Fetch total Bunny storage usage (sum of all videos size)
        $totalBytes = \App\Models\Video::sum('bunny_size_bytes');
        $totalGb = round($totalBytes / (1024 * 1024 * 1024), 4);

        // 2. Fetch usage per teacher
        $teachers = User::where('role', 'teacher')
            ->with(['teacherSubscription.plan'])
            ->get()
            ->map(function ($teacher) {
                // Ensure storage metrics are populated
                $usedGb = (float) ($teacher->bunny_storage_used_gb ?? 0.00);
                
                // Let's retrieve limits from subscription or default
                $subscription = $teacher->teacherSubscription;
                $limitGb = 10.00;
                if ($subscription) {
                    $planLimit = 10.00;
                    if ($subscription->plan) {
                        $planSlug = strtolower($subscription->plan->slug ?? '');
                        $planLimit = match($planSlug) {
                            'starter' => 10.00,
                            'basic' => 25.00,
                            'pro' => 50.00,
                            'academy' => 100.00,
                            default => floatval($subscription->plan->video_storage_gb ?? $subscription->plan->max_storage_gb ?? 10.00)
                        };
                    }
                    $overrideStorage = \DB::table('teacher_resource_overrides')->where('teacher_id', $teacher->id)->value('extra_storage_gb') ?? 0;
                    $limitGb = $planLimit + $overrideStorage;
                }
                
                // Keep DB aligned
                if ($teacher->bunny_storage_limit_gb != $limitGb) {
                    $teacher->update(['bunny_storage_limit_gb' => $limitGb]);
                }

                $planName = $subscription && $subscription->plan ? $subscription->plan->name : 'Starter';
                
                $videoCount = \App\Models\Video::whereHas('lesson.unit.course', function ($q) use ($teacher) {
                    $q->where('teacher_id', $teacher->id);
                })->count();

                return [
                    'id' => $teacher->id,
                    'name' => $teacher->name,
                    'email' => $teacher->email,
                    'plan_name' => $planName,
                    'bunny_storage_used_gb' => $usedGb,
                    'bunny_storage_limit_gb' => $limitGb,
                    'used_percentage' => $limitGb > 0 ? min(100, round(($usedGb / $limitGb) * 100, 2)) : 0,
                    'video_count' => $videoCount,
                ];
            });

        // 3. Top storage consumers
        $topConsumers = $teachers->sortByDesc('bunny_storage_used_gb')->values()->take(5);

        // 4. Largest videos
        $largestVideos = \App\Models\Video::with(['lesson.unit.course.teacher'])
            ->orderBy('bunny_size_bytes', 'desc')
            ->take(10)
            ->get()
            ->map(function ($video) {
                $course = $video->lesson->unit->course ?? null;
                $teacher = $course->teacher ?? null;
                return [
                    'id' => $video->id,
                    'title' => $video->title,
                    'bunny_video_id' => $video->bunny_video_id,
                    'bunny_size_bytes' => $video->bunny_size_bytes,
                    'bunny_size_gb' => round($video->bunny_size_bytes / (1024 * 1024 * 1024), 4),
                    'bunny_status' => $video->bunny_status,
                    'course_title' => $course ? $course->title : 'N/A',
                    'teacher_name' => $teacher ? $teacher->name : 'N/A',
                ];
            });

        return response()->json([
            'total_storage_bytes' => $totalBytes,
            'total_storage_gb' => $totalGb,
            'teachers_usage' => $teachers,
            'top_consumers' => $topConsumers,
            'largest_videos' => $largestVideos,
        ]);
    }

    /**
     * Get maintenance mode settings (Super Admin only).
     */
    public function getMaintenanceSettings(Request $request)
    {
        if (!$request->user() || !$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $settings = \App\Models\PlatformSetting::first();
        return response()->json($settings);
    }

    /**
     * Update maintenance mode settings (Super Admin only).
     */
    public function updateMaintenanceSettings(Request $request)
    {
        if (!$request->user() || !$request->user()->is_super_admin) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرف العام.'], 403);
        }

        $request->validate([
            'maintenance_mode' => 'required|boolean',
            'maintenance_message' => 'nullable|string',
            'maintenance_eta' => 'nullable|string',
        ]);

        $settings = \App\Models\PlatformSetting::first();
        $oldMaintenanceMode = $settings ? $settings->maintenance_mode : false;

        if (!$settings) {
            $settings = new \App\Models\PlatformSetting();
        }

        $settings->maintenance_mode = $request->maintenance_mode;
        $settings->maintenance_message = $request->maintenance_message;
        $settings->maintenance_eta = $request->maintenance_eta;
        $settings->save();

        // Maintenance History logging
        $isTurningOn = $request->maintenance_mode && !$oldMaintenanceMode;
        $isTurningOff = !$request->maintenance_mode && $oldMaintenanceMode;

        if ($isTurningOn) {
            \App\Models\MaintenanceLog::create([
                'enabled_by' => $request->user()->id,
                'enabled_at' => now(),
                'message' => $request->maintenance_message,
            ]);
        } elseif ($isTurningOff) {
            $latestLog = \App\Models\MaintenanceLog::whereNull('disabled_at')
                ->latest()
                ->first();
            if ($latestLog) {
                $enabledAt = $latestLog->enabled_at;
                $disabledAt = now();
                $duration = $disabledAt->diffInSeconds($enabledAt);

                $latestLog->update([
                    'disabled_at' => $disabledAt,
                    'duration' => $duration,
                ]);
            }
        }

        $statusStr = $settings->maintenance_mode ? 'تفعيل' : 'إلغاء تفعيل';
        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تعديل وضع الصيانة: {$statusStr}",
            'deleted_count' => 0,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم تحديث إعدادات وضع الصيانة بنجاح.',
            'settings' => $settings
        ]);
    }

    /**
     * List pending and completed payouts (Admin).
     */
    public function listPayouts()
    {
        // 1. Group pending earnings by teacher
        $pendingPayouts = \App\Models\TeacherEarning::where('status', 'pending')
            ->select('teacher_id', DB::raw('SUM(amount) as pending_amount'))
            ->groupBy('teacher_id')
            ->with('teacher:id,name,email,phone')
            ->get();

        // 2. Fetch history of payouts
        $payoutHistory = \App\Models\TeacherPayout::with('teacher:id,name,email,phone')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'pending_payouts' => $pendingPayouts,
            'payout_history' => $payoutHistory,
        ]);
    }

    /**
     * Record a payout to a teacher (Admin).
     */
    public function createPayout(Request $request)
    {
        $request->validate([
            'teacher_id' => 'required|exists:users,id',
            'amount' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        $teacherId = $request->teacher_id;
        $amount = (float)$request->amount;

        // Check if there is enough pending earnings
        $pendingSum = (float) \App\Models\TeacherEarning::where('teacher_id', $teacherId)
            ->where('status', 'pending')
            ->sum('amount');

        if ($pendingSum < $amount) {
            return response()->json(['message' => 'المبلغ المحدد أكبر من الرصيد المعلق للمعلم.'], 422);
        }

        return DB::transaction(function () use ($teacherId, $amount, $request) {
            // Create payout record
            $payout = \App\Models\TeacherPayout::create([
                'teacher_id' => $teacherId,
                'amount' => $amount,
                'status' => 'paid',
                'payout_date' => now(),
                'notes' => $request->notes,
            ]);

            // Mark pending earnings as paid and link to payout
            $earnings = \App\Models\TeacherEarning::where('teacher_id', $teacherId)
                ->where('status', 'pending')
                ->get();

            foreach ($earnings as $earning) {
                $earning->update([
                    'status' => 'paid',
                    'payout_id' => $payout->id,
                ]);
            }

            // Create admin activity log
            \App\Models\AdminActivityLog::create([
                'admin_name' => $request->user()->name,
                'action_type' => "تسجيل عملية دفع للمعلم ID: {$teacherId} بقيمة {$amount} ج.م",
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'تم تسجيل دفعة المعلم بنجاح.',
                'payout' => $payout,
            ]);
        });
    }

    /**
     * Get list of pending students.
     */
    public function getPendingStudents(Request $request)
    {
        $students = \App\Models\User::where('role', 'student')
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json($students);
    }

    /**
     * Approve a student.
     */
    public function approveStudent(Request $request, $id)
    {
        $student = \App\Models\User::findOrFail($id);
        $student->status = 'active';
        $student->rejection_reason = null;
        $student->save();

        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تفعيل حساب الطالب: {$student->name} ({$student->phone})",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم تفعيل حساب الطالب بنجاح.',
            'user' => $student,
        ]);
    }

    /**
     * Reject a student.
     */
    public function rejectStudent(Request $request, $id)
    {
        $request->validate([
            'reason' => 'required|string',
        ]);

        $student = \App\Models\User::findOrFail($id);
        $settings = \App\Models\PlatformSetting::first();
        $autoDelete = $settings ? (bool)$settings->auto_delete_rejected_accounts : false;

        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "رفض حساب الطالب: {$student->name} ({$student->phone}). السبب: {$request->reason}",
            'ip_address' => $request->ip(),
        ]);

        if ($autoDelete) {
            if ($student->wallet) {
                $student->wallet->delete();
            }
            $student->delete();
            return response()->json([
                'message' => 'تم رفض حساب الطالب وحذفه تلقائياً بناءً على إعدادات المنصة.',
                'deleted' => true,
            ]);
        } else {
            $student->status = 'rejected';
            $student->rejection_reason = $request->reason;
            $student->save();

            $student->tokens()->delete();

            return response()->json([
                'message' => 'تم رفض حساب الطالب بنجاح وتسجيل السبب.',
                'user' => $student,
            ]);
        }
    }

    /**
     * Get enterprise and view limit settings.
     */
    public function getEnterpriseSettings(Request $request)
    {
        $settings = \App\Models\PlatformSetting::first();
        return response()->json($settings);
    }

    /**
     * Update enterprise settings.
     */
    public function updateEnterpriseSettings(Request $request)
    {
        $request->validate([
            'require_student_approval' => 'required|boolean',
            'auto_delete_rejected_accounts' => 'required|boolean',
            'view_limit_enabled' => 'required|boolean',
            'default_max_views' => 'required|integer|min:1',
            'video_threshold_seconds' => 'required|integer|min:5',
            'grace_period_days' => 'required|integer|min:0',
        ]);

        $settings = \App\Models\PlatformSetting::first();
        if (!$settings) {
            $settings = new \App\Models\PlatformSetting();
        }

        $settings->require_student_approval = $request->require_student_approval;
        $settings->auto_delete_rejected_accounts = $request->auto_delete_rejected_accounts;
        $settings->view_limit_enabled = $request->view_limit_enabled;
        $settings->default_max_views = $request->default_max_views;
        $settings->video_threshold_seconds = $request->video_threshold_seconds;
        $settings->grace_period_days = $request->grace_period_days;
        $settings->save();

        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تحديث الإعدادات العامة وإعدادات المشاهدة والمراجعة وفترة السماح للمنصة",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم حفظ الإعدادات بنجاح.',
            'settings' => $settings,
        ]);
    }

    /**
     * Get student course view limit overrides and counters.
     */
    public function getStudentCourseLimits(Request $request)
    {
        $query = \App\Models\StudentCourseViewLimit::with(['student', 'course']);

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }
        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $limits = $query->get()->map(function ($limit) {
            $course = $limit->course;
            $settings = \App\Models\PlatformSetting::first();
            $globalDefault = $settings ? (int)$settings->default_max_views : 10;
            
            $baseLimit = $limit->max_views_override !== null 
                ? $limit->max_views_override 
                : ($course->max_views !== null ? $course->max_views : $globalDefault);

            $maxAllowed = $baseLimit + $limit->extra_views;
            $remaining = max(0, $maxAllowed - $limit->views_used);

            return [
                'id' => $limit->id,
                'student_id' => $limit->student_id,
                'student_name' => $limit->student->name ?? 'طالب محذوف',
                'student_phone' => $limit->student->phone ?? '',
                'course_id' => $limit->course_id,
                'course_title' => $course->title ?? 'كورس محذوف',
                'views_used' => $limit->views_used,
                'max_views_override' => $limit->max_views_override,
                'extra_views' => $limit->extra_views,
                'max_allowed' => $maxAllowed,
                'remaining' => $remaining,
            ];
        });

        return response()->json($limits);
    }

    /**
     * Create or update student course view limit (Override / Add Extra / Remove views).
     */
    public function updateStudentCourseLimit(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:users,id',
            'course_id' => 'required|exists:courses,id',
            'max_views_override' => 'nullable|integer|min:-1',
            'extra_views' => 'nullable|integer',
            'views_used' => 'nullable|integer|min:0',
        ]);

        $limit = \App\Models\StudentCourseViewLimit::updateOrCreate([
            'student_id' => $request->student_id,
            'course_id' => $request->course_id,
        ], [
            'max_views_override' => $request->max_views_override,
            'extra_views' => $request->input('extra_views', 0),
        ]);

        if ($request->has('views_used')) {
            $limit->views_used = $request->views_used;
            $limit->save();
        }

        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تحديث قيود مشاهدة الكورس ID: {$request->course_id} للطالب ID: {$request->student_id}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم حفظ قيود المشاهدة للطالب بنجاح.',
            'limit' => $limit,
        ]);
    }

    /**
     * Reset views counter for a student in a course.
     */
    public function resetStudentCourseLimit(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:users,id',
            'course_id' => 'required|exists:courses,id',
        ]);

        $limit = \App\Models\StudentCourseViewLimit::where('student_id', $request->student_id)
            ->where('course_id', $request->course_id)
            ->first();

        if ($limit) {
            $limit->views_used = 0;
            $limit->save();
        }

        // Also clean up their session history for this course to make it a true reset
        \App\Models\VideoViewSession::where('student_id', $request->student_id)
            ->where('course_id', $request->course_id)
            ->delete();

        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "إعادة تعيين عداد المشاهدات للكورس ID: {$request->course_id} للطالب ID: {$request->student_id}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم إعادة تعيين عداد مشاهدات الطالب بنجاح.',
        ]);
    }

    /**
     * Get course-specific view limits configuration.
     */
    public function getCourseViewLimitsConfig($courseId)
    {
        $course = \App\Models\Course::findOrFail($courseId);
        return response()->json([
            'view_limit_enabled' => $course->view_limit_enabled,
            'max_views' => $course->max_views,
        ]);
    }

    /**
     * Update course-specific view limits configuration.
     */
    public function updateCourseViewLimitsConfig(Request $request, $courseId)
    {
        $request->validate([
            'view_limit_enabled' => 'nullable|boolean',
            'max_views' => 'nullable|integer|min:-1',
        ]);

        $course = \App\Models\Course::findOrFail($courseId);
        $course->view_limit_enabled = $request->view_limit_enabled;
        $course->max_views = $request->max_views;
        $course->save();

        \App\Models\AdminActivityLog::create([
            'admin_name' => $request->user()->name,
            'action_type' => "تحديث قيود المشاهدة لكورس: {$course->title}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'تم حفظ قيود مشاهدة الكورس بنجاح.',
            'course' => $course,
        ]);
    }

    /**
     * Get comprehensive video view statistics for the Admin dashboard.
     */
    public function getVideoViewsAnalytics(Request $request)
    {
        // 1. Total Lesson/Video Views (counted sessions)
        $totalViews = \App\Models\VideoViewSession::where('counted', true)->count();

        // 2. Unique Student Views (unique student_id in counted sessions)
        $uniqueStudentViews = \App\Models\VideoViewSession::where('counted', true)
            ->distinct('student_id')
            ->count('student_id');

        // 3. Most and Least Watched Lessons
        $videoStats = \App\Models\VideoViewSession::where('counted', true)
            ->select('video_id', \DB::raw('count(*) as views_count'), \DB::raw('sum(watch_time) as total_watch_time'), \DB::raw('max(updated_at) as last_viewed_at'))
            ->groupBy('video_id')
            ->orderBy('views_count', 'desc')
            ->get();

        $videoStats->load('video.lesson.unit.course.teacher');

        $formattedVideoStats = $videoStats->map(function ($stat) {
            $video = $stat->video;
            
            $uniqueViewers = \App\Models\VideoViewSession::where('video_id', $stat->video_id)
                ->where('counted', true)
                ->distinct('student_id')
                ->count('student_id');
                
            $avgCompletion = \App\Models\VideoProgress::where('video_id', $stat->video_id)
                ->avg('watched_percentage') ?? 0;
                
            $avgWatchTime = $stat->views_count > 0 
                ? (int)round(($stat->total_watch_time / $stat->views_count) / 60) 
                : 0;

            return [
                'video_id' => $stat->video_id,
                'video_title' => $video->title ?? 'فيديو محذوف',
                'lesson_title' => $video->lesson->title ?? 'درس محذوف',
                'course_title' => $video->lesson->unit->course->title ?? 'كورس محذوف',
                'teacher_name' => $video->lesson->unit->course->teacher->name ?? 'معلم محذوف',
                'views_count' => $stat->views_count,
                'unique_viewers' => $uniqueViewers,
                'total_watch_time_minutes' => (int)round($stat->total_watch_time / 60),
                'completion_percentage' => round($avgCompletion, 2),
                'average_watch_time_minutes' => $avgWatchTime,
                'last_viewed' => $stat->last_viewed_at,
            ];
        });

        $mostWatched = $formattedVideoStats->take(10)->values()->all();
        $leastWatched = $formattedVideoStats->reverse()->take(10)->values()->all();

        // 4. Per-Course Statistics
        $courseStats = \App\Models\VideoViewSession::where('counted', true)
            ->select('course_id', \DB::raw('count(*) as views_count'), \DB::raw('sum(watch_time) as total_watch_time'))
            ->groupBy('course_id')
            ->orderBy('views_count', 'desc')
            ->get();

        $courseStats->load('course.teacher');

        $formattedCourseStats = $courseStats->map(function ($stat) {
            $course = $stat->course;
            return [
                'course_id' => $stat->course_id,
                'course_title' => $course->title ?? 'كورس محذوف',
                'teacher_name' => $course->teacher->name ?? 'معلم محذوف',
                'views_count' => $stat->views_count,
                'total_watch_time_minutes' => (int)round($stat->total_watch_time / 60),
            ];
        });

        // 5. Per-Teacher Statistics
        $teacherStats = \App\Models\VideoViewSession::where('counted', true)
            ->join('courses', 'video_view_sessions.course_id', '=', 'courses.id')
            ->join('users', 'courses.teacher_id', '=', 'users.id')
            ->select('users.id as teacher_id', 'users.name as teacher_name', \DB::raw('count(*) as views_count'), \DB::raw('sum(watch_time) as total_watch_time'))
            ->groupBy('users.id', 'users.name')
            ->orderBy('views_count', 'desc')
            ->get();

        $formattedTeacherStats = $teacherStats->map(function ($stat) {
            return [
                'teacher_id' => $stat->teacher_id,
                'teacher_name' => $stat->teacher_name,
                'views_count' => $stat->views_count,
                'total_watch_time_minutes' => (int)round($stat->total_watch_time / 60),
            ];
        });

        return response()->json([
            'total_views' => $totalViews,
            'unique_student_views' => $uniqueStudentViews,
            'most_watched_lessons' => $mostWatched,
            'least_watched_lessons' => $leastWatched,
            'course_statistics' => $formattedCourseStats,
            'teacher_statistics' => $formattedTeacherStats,
        ]);
    }

    /**
     * Export the database as JSON backup (Admin only).
     */
    public function exportDatabase(Request $request)
    {
        $tables = [
            'users', 'courses', 'units', 'lessons', 'packages', 'package_lessons',
            'videos', 'pdfs', 'exams', 'questions', 'student_exams', 'student_answers',
            'wallets', 'wallet_transactions', 'purchase_codes', 'enrollments',
            'video_progresses', 'student_pdf_progresses', 'exam_purchases', 'refund_logs',
            'teacher_payouts', 'teacher_earnings', 'platform_earnings', 'payment_histories',
            'purchase_audit_logs', 'notifications', 'notification_reads', 'sessions',
            'password_reset_tokens'
        ];

        $dump = [];
        foreach ($tables as $table) {
            if (\Schema::hasTable($table)) {
                $dump[$table] = \DB::table($table)->get()->toArray();
            }
        }

        $json = json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $filename = 'backup_' . date('Y_m_d_His') . '.json';

        return response($json, 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Reset the academic year (Admin only).
     */
    public function resetAcademicYear(Request $request)
    {
        $request->validate([
            'confirmation' => 'required|string',
        ]);

        if ($request->input('confirmation') !== 'RESET ACADEMIC YEAR') {
            return response()->json(['message' => 'تأكيد التهيئة غير صحيح. يرجى كتابة RESET ACADEMIC YEAR بدقة.'], 422);
        }

        \DB::transaction(function () {
            // Get student IDs
            $studentIds = \DB::table('users')->where('role', 'student')->pluck('id')->toArray();

            // 1. Delete student progress, attempts, messages, transactions
            \DB::table('video_progresses')->delete();
            if (\Schema::hasTable('student_pdf_progresses')) {
                \DB::table('student_pdf_progresses')->delete();
            }
            \DB::table('student_answers')->delete();
            \DB::table('student_exams')->delete();
            \DB::table('enrollments')->delete();
            \DB::table('wallet_transactions')->delete();
            \DB::table('wallets')->delete();
            if (\Schema::hasTable('exam_purchases')) {
                \DB::table('exam_purchases')->delete();
            }
            if (\Schema::hasTable('refund_logs')) {
                \DB::table('refund_logs')->delete();
            }
            
            // Teacher earnings, payouts, platform earnings, payment histories
            if (\Schema::hasTable('teacher_payouts')) {
                \DB::table('teacher_payouts')->delete();
            }
            if (\Schema::hasTable('teacher_earnings')) {
                \DB::table('teacher_earnings')->delete();
            }
            if (\Schema::hasTable('platform_earnings')) {
                \DB::table('platform_earnings')->delete();
            }
            if (\Schema::hasTable('payment_histories')) {
                \DB::table('payment_histories')->delete();
            }
            if (\Schema::hasTable('purchase_audit_logs')) {
                \DB::table('purchase_audit_logs')->delete();
            }

            // Notifications
            \DB::table('notification_reads')->delete();
            \DB::table('notifications')->delete();

            // Reset purchase codes usage
            \DB::table('purchase_codes')->update([
                'is_redeemed' => false,
                'redeemed_by' => null,
                'redeemed_at' => null,
            ]);

            // Delete sessions and tokens for students
            if (!empty($studentIds)) {
                \DB::table('sessions')->whereIn('user_id', $studentIds)->delete();
                \DB::table('personal_access_tokens')
                    ->whereIn('tokenable_id', $studentIds)
                    ->where('tokenable_type', 'App\\Models\\User')
                    ->delete();
            }
            \DB::table('sessions')->whereNull('user_id')->delete();
            \DB::table('password_reset_tokens')->delete();

            // Finally delete the student users
            \DB::table('users')->where('role', 'student')->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تهيئة السنة الدراسية الجديدة بنجاح وتصفير السجلات المالية والطلاب مع الاحتفاظ بالمحتوى التعليمي.'
        ]);
    }
}

