<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Package;
use App\Models\Enrollment;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\PurchaseCode;
use App\Models\Video;
use App\Models\VideoProgress;
use App\Models\Exam;
use App\Models\StudentExam;
use App\Models\StudentAnswer;
use App\Services\StudentActivityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class StudentController extends Controller
{
    /**
     * Get enrolled courses.
     */
    public function enrolledCourses(Request $request)
    {
        $user = $request->user();
        $enrollments = Enrollment::with(['course.teacher', 'package.course.teacher', 'lesson.unit.course.teacher'])
            ->where('student_id', $user->id)
            ->latest()
            ->get();

        $formatted = $enrollments->map(function ($enrollment) {
            $course = null;
            $typeLabel = 'course';
            $coverImage = null;
            $productTitle = null;

            if ($enrollment->course) {
                $course = $enrollment->course;
                $isBundle = (bool)$course->is_bundle;
                $typeLabel = $isBundle ? 'bundle' : 'course';
                $productTitle = $course->title;
                $coverImage = $course->cover_image;
            } elseif ($enrollment->package) {
                $course = $enrollment->package->course;
                $typeLabel = $enrollment->package->type; // bundle, month, revision
                $productTitle = $enrollment->package->title;
                if ($typeLabel === 'bundle') {
                    $teacher = $enrollment->package->teacher;
                    return [
                        'id' => $enrollment->id,
                        'enrolled_at' => $enrollment->enrolled_at ? $enrollment->enrolled_at->toIso8601String() : null,
                        'product_type' => 'bundle',
                        'product_title' => $productTitle,
                        'package_id' => $enrollment->package_id,
                        'lesson_id' => null,
                        'is_bundle' => true,
                        'course' => [
                            'id' => 'bundle-' . $enrollment->package_id,
                            'title' => $productTitle,
                            'description' => $enrollment->package->description,
                            'cover_image' => $enrollment->package->package_thumbnail ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
                            'subject' => 'باقة مجمعة',
                            'is_bundle' => true,
                            'teacher' => [
                                'name' => $teacher ? $teacher->name : 'معلم محذوف',
                            ],
                        ]
                    ];
                }
                $coverImage = $enrollment->package->package_thumbnail ?: ($course ? $course->cover_image : null);
            } elseif ($enrollment->lesson && $enrollment->lesson->unit) {
                $course = $enrollment->lesson->unit->course;
                $typeLabel = 'lesson';
                $productTitle = $enrollment->lesson->title;
                $coverImage = $course->cover_image;
            }

            if (!$course) {
                return null;
            }

            $isBundleCourse = (bool)($course->is_bundle ?? false);

            return [
                'id' => $enrollment->id,
                'enrolled_at' => $enrollment->enrolled_at ? $enrollment->enrolled_at->toIso8601String() : null,
                'product_type' => $isBundleCourse ? 'bundle' : $typeLabel,
                'product_title' => $productTitle,
                'package_id' => $enrollment->package_id,
                'lesson_id' => $enrollment->lesson_id,
                'is_bundle' => $isBundleCourse,
                'course' => [
                    'id' => $course->id,
                    'title' => $productTitle,
                    'description' => $course->description,
                    'cover_image' => $coverImage ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
                    'subject' => $course->subject,
                    'is_bundle' => $isBundleCourse,
                    'teacher' => [
                        'name' => $course->teacher ? $course->teacher->name : 'معلم محذوف',
                    ],
                ]
            ];
        })->filter();

        return response()->json(array_values($formatted->toArray()));
    }

    /**
     * Get wallet details.
     */
    public function wallet(Request $request)
    {
        $user = $request->user();
        $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
        $transactions = WalletTransaction::where('wallet_id', $wallet->id)
            ->latest()
            ->get();

        return response()->json([
            'balance' => $wallet->balance,
            'transactions' => $transactions,
        ]);
    }

    /**
     * Redeem purchase code.
     */
    public function redeemCode(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        $user = $request->user();
        $purchaseCode = PurchaseCode::where('code', $request->code)->first();

        if (!$purchaseCode) {
            return response()->json(['message' => 'كود الشحن المدخل غير صحيح.'], 422);
        }

        if ($purchaseCode->is_redeemed) {
            return response()->json(['message' => 'هذا الكود تم استخدامه من قبل.'], 422);
        }

        if ($purchaseCode->expires_at && Carbon::now()->gt($purchaseCode->expires_at)) {
            return response()->json(['message' => 'هذا الكود منتهي الصلاحية.'], 422);
        }

        $type = $purchaseCode->code_type ?: $purchaseCode->type;
        $teacherId = null;
        if ($type === 'course') {
            $c = Course::find($purchaseCode->course_id);
            if ($c) $teacherId = $c->teacher_id;
        } elseif ($type === 'teacher') {
            $teacherId = $purchaseCode->teacher_id;
        }

        if ($teacherId) {
            $capacityCheck = $this->checkTeacherCapacity($user->id, $teacherId);
            if ($capacityCheck === 'subscription_expired') {
                return response()->json(['message' => 'عذراً، اشتراك المعلم غير نشط أو منتهي الصلاحية حالياً. لا يمكن تفعيل الكود.'], 422);
            } elseif (!$capacityCheck) {
                return response()->json(['message' => 'عذراً، المعلم شارف على استهلاك كامل السعة الاستيعابية للطلاب المحددة لاشتراكه حالياً. لا يمكن تفعيل الكود.'], 422);
            }
        }

        return DB::transaction(function () use ($purchaseCode, $user, $type) {

            if ($type === 'wallet') {
                $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
                $balanceBefore = (float)$wallet->balance;
                $wallet->balance += $purchaseCode->amount;
                $wallet->save();

                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'recharge',
                    'amount' => $purchaseCode->amount,
                    'description' => 'شحن المحفظة عن طريق كود: ' . $purchaseCode->code,
                    'reference_id' => $purchaseCode->id,
                ]);

                $purchaseCode->is_redeemed = true;
                $purchaseCode->redeemed_by = $user->id;
                $purchaseCode->redeemed_at = Carbon::now();
                $purchaseCode->save();

                \App\Services\StudentActivityService::logWalletTopup(
                    $user,
                    (float)$purchaseCode->amount,
                    'recharge_code',
                    $purchaseCode->code,
                    $balanceBefore,
                    (float)$wallet->balance,
                    request()
                );

                return response()->json([
                    'type' => 'wallet',
                    'message' => 'تم إضافة الرصيد إلى محفظتك بقيمة ' . $purchaseCode->amount . ' ج.م.',
                    'balance' => $wallet->balance,
                ]);
            } elseif ($type === 'teacher') {
                if (!$purchaseCode->teacher_id) {
                    return response()->json(['message' => 'كود غير صالح: لا يوجد معلم مرتبط.'], 422);
                }

                $teacher = User::findOrFail($purchaseCode->teacher_id);
                $creditVal = $purchaseCode->amount > 0 ? $purchaseCode->amount : $purchaseCode->credit_amount;

                // Create or update restricted teacher credit
                $existingCredit = DB::table('student_teacher_credits')
                    ->where('student_id', $user->id)
                    ->where('teacher_id', $teacher->id)
                    ->first();
                if ($existingCredit) {
                    DB::table('student_teacher_credits')
                        ->where('student_id', $user->id)
                        ->where('teacher_id', $teacher->id)
                        ->update([
                            'balance' => $existingCredit->balance + (float)$creditVal,
                            'updated_at' => Carbon::now(),
                        ]);
                } else {
                    DB::table('student_teacher_credits')->insert([
                        'student_id' => $user->id,
                        'teacher_id' => $teacher->id,
                        'balance' => (float)$creditVal,
                        'created_at' => Carbon::now(),
                        'updated_at' => Carbon::now(),
                    ]);
                }

                $purchaseCode->is_redeemed = true;
                $purchaseCode->redeemed_by = $user->id;
                $purchaseCode->redeemed_at = Carbon::now();
                $purchaseCode->save();

                return response()->json([
                    'type' => 'teacher',
                    'message' => 'تم تفعيل رصيد خاص بالمعلم ' . $teacher->name . ' بقيمة ' . $creditVal . ' ج.م.',
                ]);
            } elseif ($type === 'course') {
                if (!$purchaseCode->course_id && !$purchaseCode->package_id) {
                    return response()->json(['message' => 'كود غير صالح: لا يوجد كورس أو باقة مرتبطة.'], 422);
                }

                $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);

                if ($purchaseCode->course_id) {
                    $course = Course::findOrFail($purchaseCode->course_id);
                    $amount = (float) $course->final_price;

                    $alreadyEnrolled = Enrollment::where('student_id', $user->id)
                        ->where('course_id', $course->id)
                        ->whereNull('package_id')
                        ->exists();

                    if ($alreadyEnrolled) {
                        // Reset views used to unlock course/renew views
                        $viewLimit = \App\Models\StudentCourseViewLimit::where('student_id', $user->id)
                            ->where('course_id', $course->id)
                            ->first();
                            
                        if ($viewLimit) {
                            $viewLimit->views_used = 0;
                            $viewLimit->save();
                        } else {
                            \App\Models\StudentCourseViewLimit::create([
                                'student_id' => $user->id,
                                'course_id' => $course->id,
                                'views_used' => 0,
                                'max_views_override' => null,
                                'extra_views' => 0,
                            ]);
                        }

                        // Create transaction records exactly like normal checkout (payment method coupon)
                        WalletTransaction::create([
                            'wallet_id' => $wallet->id,
                            'type' => 'recharge',
                            'amount' => $amount,
                            'description' => 'شحن تلقائي لتفعيل كود الكورس: ' . $purchaseCode->code,
                            'reference_id' => $purchaseCode->id,
                        ]);

                        WalletTransaction::create([
                            'wallet_id' => $wallet->id,
                            'type' => 'purchase',
                            'amount' => $amount,
                            'description' => 'شراء كورس باستخدام كود: ' . $purchaseCode->code,
                            'reference_id' => $course->id,
                        ]);

                        $purchaseCode->is_redeemed = true;
                        $purchaseCode->redeemed_by = $user->id;
                        $purchaseCode->redeemed_at = Carbon::now();
                        $purchaseCode->save();

                        // Split revenue
                        \App\Services\RevenueSharingService::handlePurchase(
                            $user->id,
                            $course->teacher_id,
                            $amount,
                            $course->id,
                            null,
                            null,
                            $purchaseCode->id,
                            'code'
                        );

                        $viewLimitDetails = $course->getStudentViewLimitDetails($user->id);

                        return response()->json([
                            'type' => 'course',
                            'message' => 'تم تفعيل كود الشحن وتجديد عدد المشاهدات للكورس بنجاح!',
                            'course_id' => $course->id,
                            'view_limit_details' => $viewLimitDetails
                        ]);
                    }

                    // Create transaction records for new enrollment
                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'recharge',
                        'amount' => $amount,
                        'description' => 'شحن تلقائي لتفعيل كود الكورس: ' . $purchaseCode->code,
                        'reference_id' => $purchaseCode->id,
                    ]);

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'purchase',
                        'amount' => $amount,
                        'description' => 'شراء كورس باستخدام كود: ' . $purchaseCode->code,
                        'reference_id' => $course->id,
                    ]);

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $course->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    // Create or reset views used on enrollment
                    \App\Models\StudentCourseViewLimit::updateOrCreate(
                        ['student_id' => $user->id, 'course_id' => $course->id],
                        ['views_used' => 0]
                    );

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $course->teacher_id,
                        $amount,
                        $course->id,
                        null,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    return response()->json([
                        'type' => 'course',
                        'message' => 'تم الاشتراك في الكورس بنجاح',
                        'course_id' => $course->id,
                        'view_limit_details' => $course->getStudentViewLimitDetails($user->id)
                    ]);

                } elseif ($purchaseCode->package_id) {
                    $package = Package::with('course')->findOrFail($purchaseCode->package_id);
                    $amount = (float) $package->price;
                    $teacherId = $package->course ? $package->course->teacher_id : $package->teacher_id;

                    $alreadyEnrolled = Enrollment::where('student_id', $user->id)
                        ->where('package_id', $package->id)
                        ->exists();

                    if ($alreadyEnrolled) {
                        return response()->json(['message' => 'أنت مشترك بالفعل في هذه الباقة.'], 422);
                    }

                    // Create transaction records
                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'recharge',
                        'amount' => $amount,
                        'description' => 'شحن تلقائي لتفعيل كود الباقة: ' . $purchaseCode->code,
                        'reference_id' => $purchaseCode->id,
                    ]);

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'purchase',
                        'amount' => $amount,
                        'description' => 'شراء باقة شهرية باستخدام كود: ' . $purchaseCode->code,
                        'reference_id' => $package->id,
                    ]);

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $package->course_id,
                        'package_id' => $package->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $teacherId,
                        $amount,
                        $package->course_id,
                        $package->id,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    return response()->json([
                        'type' => 'course',
                        'message' => 'تم الاشتراك في الباقة بنجاح',
                        'course_id' => $package->course_id ?: 'bundle-' . $package->id,
                    ]);
                }
            }

            return response()->json(['message' => 'نوع الكود غير معروف.'], 422);
        });
    }

    /**
     * Subscribe to a Course using Wallet or Purchase Code.
     */
    public function subscribeCourse(Request $request, $courseId)
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $alreadyEnrolled = Enrollment::where('student_id', $user->id)
            ->where('course_id', $courseId)
            ->whereNull('package_id')
            ->whereNull('lesson_id')
            ->exists();

        if ($alreadyEnrolled) {
            return response()->json(['message' => 'أنت مشترك بالفعل في هذا الكورس.'], 422);
        }

        $capacityCheck = $this->checkTeacherCapacity($user->id, $course->teacher_id);
        if ($capacityCheck === 'subscription_expired') {
            return response()->json(['message' => 'عذراً، اشتراك المعلم غير نشط أو منتهي الصلاحية حالياً. لا يمكن الاشتراك في الكورس.'], 422);
        } elseif (!$capacityCheck) {
            return response()->json(['message' => 'عذراً، المعلم شارف على استهلاك كامل السعة الاستيعابية للطلاب المحددة لاشتراكه حالياً. لا يمكن الاشتراك.'], 422);
        }

        $paymentMethod = $request->input('payment_method', 'wallet');

        if ($paymentMethod === 'code') {
            $codeStr = $request->input('code');
            if (empty($codeStr)) {
                return response()->json(['message' => 'يرجى إدخال كود الشراء.'], 422);
            }

            $purchaseCode = PurchaseCode::where('code', $codeStr)->first();
            if (!$purchaseCode) {
                return response()->json(['message' => 'كود الشحن المدخل غير صحيح.'], 422);
            }
            if ($purchaseCode->is_redeemed) {
                return response()->json(['message' => 'هذا الكود تم استخدامه من قبل.'], 422);
            }
            if ($purchaseCode->expires_at && Carbon::now()->gt($purchaseCode->expires_at)) {
                return response()->json(['message' => 'هذا الكود منتهي الصلاحية.'], 422);
            }

            // Verify restrictions
            if (!$this->checkRestrictions($purchaseCode, 'course', $courseId)) {
                return response()->json(['message' => 'هذا الكود غير صالح لهذا الكورس أو هذا المعلم.'], 422);
            }

            return DB::transaction(function () use ($purchaseCode, $course, $user) {
                $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
                $type = $purchaseCode->code_type ?: $purchaseCode->type;

                if ($type === 'course') {
                    $amount = (float) $course->final_price;

                    // Direct unlock
                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'recharge',
                        'amount' => $amount,
                        'description' => 'شحن تلقائي لتفعيل كود الكورس: ' . $purchaseCode->code,
                        'reference_id' => $purchaseCode->id,
                    ]);

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'purchase',
                        'amount' => $amount,
                        'description' => 'شراء كورس باستخدام كود: ' . $purchaseCode->code,
                        'reference_id' => $course->id,
                    ]);

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $course->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $course->teacher_id,
                        $amount,
                        $course->id,
                        null,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    StudentActivityService::logPurchase($user, $course->is_bundle ? 'bundle' : 'course', $course, $amount, 'code', ['code' => $purchaseCode->code], request());

                    return response()->json([
                        'message' => 'تم الاشتراك في الكورس بنجاح.',
                        'balance' => $wallet->balance,
                    ]);
                } elseif ($type === 'teacher') {
                    $creditVal = $purchaseCode->amount > 0 ? $purchaseCode->amount : $purchaseCode->credit_amount;
                    $existingCredit = DB::table('student_teacher_credits')
                        ->where('student_id', $user->id)
                        ->where('teacher_id', $course->teacher_id)
                        ->first();
                    if ($existingCredit) {
                        DB::table('student_teacher_credits')
                            ->where('student_id', $user->id)
                            ->where('teacher_id', $course->teacher_id)
                            ->update([
                                'balance' => $existingCredit->balance + (float)$creditVal,
                                'updated_at' => Carbon::now(),
                            ]);
                    } else {
                        DB::table('student_teacher_credits')->insert([
                            'student_id' => $user->id,
                            'teacher_id' => $course->teacher_id,
                            'balance' => (float)$creditVal,
                            'created_at' => Carbon::now(),
                            'updated_at' => Carbon::now(),
                        ]);
                    }

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    $teacherCredit = DB::table('student_teacher_credits')
                        ->where('student_id', $user->id)
                        ->where('teacher_id', $course->teacher_id)
                        ->first();
                    $creditBalance = $teacherCredit ? (float)$teacherCredit->balance : 0.00;

                    $deductFromCredit = min($course->final_price, $creditBalance);
                    $deductFromWallet = $course->final_price - $deductFromCredit;

                    if (($creditBalance + $wallet->balance) < $course->final_price) {
                        return response()->json([
                            'message' => 'تم شحن رصيد المعلم بقيمة ' . $creditVal . ' ج.م بنجاح، ولكن إجمالي الرصيد غير كاف لشراء الكورس.',
                            'balance' => $wallet->balance,
                        ], 200);
                    }

                    if ($deductFromCredit > 0) {
                        DB::table('student_teacher_credits')
                            ->where('student_id', $user->id)
                            ->where('teacher_id', $course->teacher_id)
                            ->decrement('balance', $deductFromCredit);
                    }

                    if ($deductFromWallet > 0) {
                        $wallet->balance -= $deductFromWallet;
                        $wallet->save();

                        WalletTransaction::create([
                            'wallet_id' => $wallet->id,
                            'type' => 'purchase',
                            'amount' => $deductFromWallet,
                            'description' => 'شراء كورس (جزء من المحفظة): ' . $course->title,
                            'reference_id' => $course->id,
                        ]);
                    }

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $course->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $course->teacher_id,
                        $course->final_price,
                        $course->id,
                        null,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    return response()->json([
                        'message' => 'تم شحن رصيد المعلم المخصص والاشتراك في الكورس بنجاح.',
                        'balance' => $wallet->balance,
                    ]);
                } elseif ($type === 'wallet') {
                    $wallet->balance += $purchaseCode->amount;
                    $wallet->save();

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'recharge',
                        'amount' => $purchaseCode->amount,
                        'description' => 'شحن المحفظة عن طريق كود: ' . $purchaseCode->code,
                        'reference_id' => $purchaseCode->id,
                    ]);

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    if ($wallet->balance < $course->final_price) {
                        return response()->json([
                            'message' => 'تم شحن المحفظة بقيمة ' . $purchaseCode->amount . ' ج.م بنجاح، ولكن الرصيد الإجمالي غير كاف لشراء الكورس. يرجى الشحن مرة أخرى.',
                            'balance' => $wallet->balance,
                        ], 200);
                    }

                    $wallet->balance -= $course->final_price;
                    $wallet->save();

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'purchase',
                        'amount' => $course->final_price,
                        'description' => 'شراء كورس: ' . $course->title,
                        'reference_id' => $course->id,
                    ]);

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $course->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $course->teacher_id,
                        $course->final_price,
                        $course->id,
                        null,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    return response()->json([
                        'message' => 'تم شحن الرصيد والاشتراك في الكورس بنجاح.',
                        'balance' => $wallet->balance,
                    ]);
                }
            });
        }

        // Wallet / Restricted teacher credit option
        $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);

        $teacherCredit = DB::table('student_teacher_credits')
            ->where('student_id', $user->id)
            ->where('teacher_id', $course->teacher_id)
            ->first();
        $creditBalance = $teacherCredit ? (float)$teacherCredit->balance : 0.00;
        $totalAvailable = $wallet->balance + $creditBalance;

        if ($totalAvailable < $course->final_price) {
            StudentActivityService::logPurchaseFailed($user, $course->is_bundle ? 'bundle' : 'course', $course, 'رصيد المحفظة غير كافٍ للاشتراك', [], $request);
            return response()->json(['message' => 'رصيد المحفظة والائتمان المخصص للمعلم غير كافٍ للاشتراك. يرجى الشحن أولاً.'], 422);
        }

        return DB::transaction(function () use ($course, $user, $creditBalance) {
            $wallet = Wallet::where('student_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = Wallet::create(['student_id' => $user->id, 'balance' => 0.00]);
            }

            // Check duplicate under lock
            $alreadyEnrolled = Enrollment::where('student_id', $user->id)
                ->where('course_id', $course->id)
                ->whereNull('package_id')
                ->whereNull('lesson_id')
                ->exists();

            if ($alreadyEnrolled) {
                return response()->json(['message' => 'أنت مشترك بالفعل في هذا الكورس.'], 422);
            }

            $currentTeacherCredit = DB::table('student_teacher_credits')
                ->where('student_id', $user->id)
                ->where('teacher_id', $course->teacher_id)
                ->lockForUpdate()
                ->first();
            $lockedCreditBalance = $currentTeacherCredit ? (float)$currentTeacherCredit->balance : 0.00;

            $totalLockedAvailable = $wallet->balance + $lockedCreditBalance;
            if ($totalLockedAvailable < $course->final_price) {
                return response()->json(['message' => 'رصيد المحفظة والائتمان المخصص للمعلم غير كافٍ للاشتراك. يرجى الشحن أولاً.'], 422);
            }

            $deductFromCredit = min($course->final_price, $lockedCreditBalance);
            $deductFromWallet = $course->final_price - $deductFromCredit;

            if ($deductFromCredit > 0) {
                DB::table('student_teacher_credits')
                    ->where('student_id', $user->id)
                    ->where('teacher_id', $course->teacher_id)
                    ->decrement('balance', $deductFromCredit);
            }

            if ($deductFromWallet > 0) {
                $wallet->balance -= $deductFromWallet;
                $wallet->save();

                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'purchase',
                    'amount' => $deductFromWallet,
                    'description' => 'شراء كورس (جزء من المحفظة): ' . $course->title,
                    'reference_id' => $course->id,
                ]);
            }

            Enrollment::create([
                'student_id' => $user->id,
                'course_id' => $course->id,
                'enrolled_at' => Carbon::now(),
            ]);

            $originalPrice = (float)$course->price;
            $discountAmount = max(0.00, $originalPrice - (float)$course->final_price);

            // Split revenue
            \App\Services\RevenueSharingService::handlePurchase(
                $user->id,
                $course->teacher_id,
                $course->final_price,
                $course->id,
                null,
                null,
                null,
                'wallet',
                null,
                $originalPrice,
                $discountAmount
            );

            StudentActivityService::logPurchase($user, $course->is_bundle ? 'bundle' : 'course', $course, (float)$course->final_price, 'wallet', ['amount' => (float)$course->final_price, 'balance_after' => (float)$wallet->balance], request());

            return response()->json([
                'message' => 'تم الاشتراك في الكورس بنجاح.',
                'balance' => $wallet->balance,
            ]);
        });
    }

    /**
     * Subscribe to a Monthly Package using Wallet or Purchase Code.
     */
    public function subscribePackage(Request $request, $packageId)
    {
        $user = $request->user();
        $package = Package::with('course')->findOrFail($packageId);
        $teacherId = $package->course ? $package->course->teacher_id : $package->teacher_id;

        $alreadyEnrolled = Enrollment::where('student_id', $user->id)
            ->where('package_id', $packageId)
            ->exists();

        if ($alreadyEnrolled) {
            return response()->json(['message' => 'أنت مشترك بالفعل في هذا الباقة.'], 422);
        }

        $capacityCheck = $this->checkTeacherCapacity($user->id, $teacherId);
        if ($capacityCheck === 'subscription_expired') {
            return response()->json(['message' => 'عذراً، اشتراك المعلم غير نشط أو منتهي الصلاحية حالياً. لا يمكن الاشتراك في الباقة.'], 422);
        } elseif (!$capacityCheck) {
            return response()->json(['message' => 'عذراً، المعلم شارف على استهلاك كامل السعة الاستيعابية للطلاب المحددة لاشتراكه حالياً. لا يمكن الاشتراك في الباقة.'], 422);
        }

        $paymentMethod = $request->input('payment_method', 'wallet');

        if ($paymentMethod === 'code') {
            $codeStr = $request->input('code');
            if (empty($codeStr)) {
                return response()->json(['message' => 'يرجى إدخال كود الشراء.'], 422);
            }

            $purchaseCode = PurchaseCode::where('code', $codeStr)->first();
            if (!$purchaseCode) {
                return response()->json(['message' => 'كود الشحن المدخل غير صحيح.'], 422);
            }
            if ($purchaseCode->is_redeemed) {
                return response()->json(['message' => 'هذا الكود تم استخدامه من قبل.'], 422);
            }
            if ($purchaseCode->expires_at && Carbon::now()->gt($purchaseCode->expires_at)) {
                return response()->json(['message' => 'هذا الكود منتهي الصلاحية.'], 422);
            }

            // Verify restrictions
            if (!$this->checkRestrictions($purchaseCode, 'package', $packageId)) {
                return response()->json(['message' => 'هذا الكود غير صالح لهذا الكورس أو هذا المعلم.'], 422);
            }

            return DB::transaction(function () use ($purchaseCode, $package, $user, $teacherId) {
                $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
                $type = $purchaseCode->code_type ?: $purchaseCode->type;

                if ($type === 'course') {
                    $amount = (float) $package->price;

                    // Direct unlock
                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'recharge',
                        'amount' => $amount,
                        'description' => 'شحن تلقائي لتفعيل كود الباقة: ' . $purchaseCode->code,
                        'reference_id' => $purchaseCode->id,
                    ]);

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'purchase',
                        'amount' => $amount,
                        'description' => 'شراء باقة شهرية باستخدام كود: ' . $purchaseCode->code,
                        'reference_id' => $package->id,
                    ]);

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $package->course_id,
                        'package_id' => $package->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $teacherId,
                        $amount,
                        $package->course_id,
                        $package->id,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    return response()->json([
                        'message' => 'تم الاشتراك في الباقة بنجاح.',
                        'balance' => $wallet->balance,
                    ]);
                } elseif ($type === 'teacher') {
                    $creditVal = $purchaseCode->amount > 0 ? $purchaseCode->amount : $purchaseCode->credit_amount;
                    $existingCredit = DB::table('student_teacher_credits')
                        ->where('student_id', $user->id)
                        ->where('teacher_id', $teacherId)
                        ->first();
                    if ($existingCredit) {
                        DB::table('student_teacher_credits')
                            ->where('student_id', $user->id)
                            ->where('teacher_id', $teacherId)
                            ->update([
                                'balance' => $existingCredit->balance + (float)$creditVal,
                                'updated_at' => Carbon::now(),
                            ]);
                    } else {
                        DB::table('student_teacher_credits')->insert([
                            'student_id' => $user->id,
                            'teacher_id' => $teacherId,
                            'balance' => (float)$creditVal,
                            'created_at' => Carbon::now(),
                            'updated_at' => Carbon::now(),
                        ]);
                    }

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    $teacherCredit = DB::table('student_teacher_credits')
                        ->where('student_id', $user->id)
                        ->where('teacher_id', $teacherId)
                        ->first();
                    $creditBalance = $teacherCredit ? (float)$teacherCredit->balance : 0.00;

                    $deductFromCredit = min($package->price, $creditBalance);
                    $deductFromWallet = $package->price - $deductFromCredit;

                    if (($creditBalance + $wallet->balance) < $package->price) {
                        return response()->json([
                            'message' => 'تم شحن رصيد المعلم بقيمة ' . $creditVal . ' ج.م بنجاح، ولكن إجمالي الرصيد غير كاف لشراء الباقة.',
                            'balance' => $wallet->balance,
                        ], 200);
                    }

                    return DB::transaction(function () use ($wallet, $package, $user, $deductFromCredit, $deductFromWallet, $teacherId, $purchaseCode) {
                        if ($deductFromCredit > 0) {
                            DB::table('student_teacher_credits')
                                ->where('student_id', $user->id)
                                ->where('teacher_id', $teacherId)
                                ->decrement('balance', $deductFromCredit);
                        }

                        if ($deductFromWallet > 0) {
                            $wallet->balance -= $deductFromWallet;
                            $wallet->save();

                            WalletTransaction::create([
                                'wallet_id' => $wallet->id,
                                'type' => 'purchase',
                                'amount' => $deductFromWallet,
                                'description' => 'شراء باقة شهرية باستخدام رصيد المعلم والمحفظة: ' . $package->id,
                                'reference_id' => $package->id,
                            ]);
                        }

                        Enrollment::create([
                            'student_id' => $user->id,
                            'course_id' => $package->course_id,
                            'package_id' => $package->id,
                            'enrolled_at' => Carbon::now(),
                        ]);

                        // Split revenue
                        \App\Services\RevenueSharingService::handlePurchase(
                            $user->id,
                            $teacherId,
                            $package->price,
                            $package->course_id,
                            $package->id,
                            null,
                            $purchaseCode->id,
                            'code'
                        );

                        return response()->json([
                            'message' => 'تم شحن رصيد المعلم المخصص والاشتراك في الباقة بنجاح.',
                            'balance' => $wallet->balance,
                        ]);
                    });
                } elseif ($type === 'wallet') {
                    // Recharge and buy
                    $wallet->balance += $purchaseCode->amount;
                    $wallet->save();

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'recharge',
                        'amount' => $purchaseCode->amount,
                        'description' => 'شحن المحفظة عن طريق كود: ' . $purchaseCode->code,
                        'reference_id' => $purchaseCode->id,
                    ]);

                    $purchaseCode->is_redeemed = true;
                    $purchaseCode->redeemed_by = $user->id;
                    $purchaseCode->redeemed_at = Carbon::now();
                    $purchaseCode->save();

                    if ($wallet->balance < $package->price) {
                        return response()->json([
                            'message' => 'تم شحن المحفظة بقيمة ' . $purchaseCode->amount . ' ج.م بنجاح، ولكن الرصيد الإجمالي غير كاف لشراء الباقة. يرجى الشحن مرة أخرى.',
                            'balance' => $wallet->balance,
                        ], 200);
                    }

                    $wallet->balance -= $package->price;
                    $wallet->save();

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'type' => 'purchase',
                        'amount' => $package->price,
                        'description' => 'شراء باقة شهرية: ' . $package->title . ($package->course ? ' لـ ' . $package->course->title : ''),
                        'reference_id' => $package->id,
                    ]);

                    Enrollment::create([
                        'student_id' => $user->id,
                        'course_id' => $package->course_id,
                        'package_id' => $package->id,
                        'enrolled_at' => Carbon::now(),
                    ]);

                    // Split revenue
                    \App\Services\RevenueSharingService::handlePurchase(
                        $user->id,
                        $teacherId,
                        $package->price,
                        $package->course_id,
                        $package->id,
                        null,
                        $purchaseCode->id,
                        'code'
                    );

                    return response()->json([
                        'message' => 'تم شحن الرصيد والاشتراك في الباقة بنجاح.',
                        'balance' => $wallet->balance,
                    ]);
                }
            });
        }

        // Wallet / Restricted teacher credit option
        $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
        $teacherCredit = DB::table('student_teacher_credits')
            ->where('student_id', $user->id)
            ->where('teacher_id', $teacherId)
            ->first();
        $creditBalance = $teacherCredit ? (float)$teacherCredit->balance : 0.00;
        $totalAvailable = $wallet->balance + $creditBalance;

        if ($totalAvailable < $package->price) {
            return response()->json(['message' => 'رصيد المحفظة والائتمان المخصص للمعلم غير كافٍ للاشتراك. يرجى الشحن أولاً.'], 422);
        }

        return DB::transaction(function () use ($package, $user, $teacherId) {
            $wallet = Wallet::where('student_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = Wallet::create(['student_id' => $user->id, 'balance' => 0.00]);
            }

            // Check duplicate under lock
            $alreadyEnrolled = Enrollment::where('student_id', $user->id)
                ->where('package_id', $package->id)
                ->exists();

            if ($alreadyEnrolled) {
                return response()->json(['message' => 'أنت مشترك بالفعل في هذا الباقة.'], 422);
            }

            $currentTeacherCredit = DB::table('student_teacher_credits')
                ->where('student_id', $user->id)
                ->where('teacher_id', $teacherId)
                ->lockForUpdate()
                ->first();
            $lockedCreditBalance = $currentTeacherCredit ? (float)$currentTeacherCredit->balance : 0.00;

            $totalLockedAvailable = $wallet->balance + $lockedCreditBalance;
            if ($totalLockedAvailable < $package->price) {
                return response()->json(['message' => 'رصيد المحفظة والائتمان المخصص للمعلم غير كافٍ للاشتراك. يرجى الشحن أولاً.'], 422);
            }

            $deductFromCredit = min($package->price, $lockedCreditBalance);
            $deductFromWallet = $package->price - $deductFromCredit;

            if ($deductFromCredit > 0) {
                DB::table('student_teacher_credits')
                    ->where('student_id', $user->id)
                    ->where('teacher_id', $teacherId)
                    ->decrement('balance', $deductFromCredit);
            }

            if ($deductFromWallet > 0) {
                $wallet->balance -= $deductFromWallet;
                $wallet->save();

                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'purchase',
                    'amount' => $deductFromWallet,
                    'description' => 'شراء باقة شهرية (جزء من المحفظة): ' . $package->title,
                    'reference_id' => $package->id,
                ]);
            }

            Enrollment::create([
                'student_id' => $user->id,
                'course_id' => $package->course_id,
                'package_id' => $package->id,
                'enrolled_at' => Carbon::now(),
            ]);

            $packagePrice = (float)$package->price;

            // Split revenue
            \App\Services\RevenueSharingService::handlePurchase(
                $user->id,
                $teacherId,
                $packagePrice,
                $package->course_id,
                $package->id,
                null,
                null,
                'wallet',
                null,
                $packagePrice,
                0.00
            );

            return response()->json([
                'message' => 'تم الاشتراك في الباقة بنجاح.',
                'balance' => $wallet->balance,
            ]);
        });
    }

    /**
     * Check purchase code restrictions.
     */
    private function checkRestrictions($purchaseCode, $type, $itemId)
    {
        $codeType = $purchaseCode->code_type ?: $purchaseCode->type;
        if ($codeType === 'course') {
            if (empty($purchaseCode->course_id) && empty($purchaseCode->package_id)) {
                return false;
            }
        }

        // Case 2: teacher_id assigned
        if (!empty($purchaseCode->teacher_id)) {
            if ($type === 'course') {
                $course = Course::find($itemId);
                if (!$course || $course->teacher_id != $purchaseCode->teacher_id) {
                    return false;
                }
            } elseif ($type === 'package') {
                $package = Package::with('course')->find($itemId);
                if (!$package) {
                    return false;
                }
                $tId = $package->course ? $package->course->teacher_id : $package->teacher_id;
                if ($tId != $purchaseCode->teacher_id) {
                    return false;
                }
            }
        }

        // Case 3: course_id assigned
        if (!empty($purchaseCode->course_id)) {
            if ($type === 'course') {
                if ($itemId != $purchaseCode->course_id) {
                    return false;
                }
            } elseif ($type === 'package') {
                $package = Package::find($itemId);
                if (!$package || $package->course_id != $purchaseCode->course_id) {
                    return false;
                }
            }
        }

        // Case 4: package_id assigned
        if (!empty($purchaseCode->package_id)) {
            if ($type === 'package') {
                if ($itemId != $purchaseCode->package_id) {
                    return false;
                }
            } else {
                return false;
            }
        }

        return true;
    }

    /**
     * Subscribe to a Lesson using Wallet.
     */
    public function subscribeLesson(Request $request, $lessonId)
    {
        $user = $request->user();
        $lesson = \App\Models\Lesson::with('unit.course')->findOrFail($lessonId);
        $courseId = $lesson->unit->course_id;

        // Check if already purchased this standalone lesson
        $alreadyPurchasedLesson = Enrollment::where('student_id', $user->id)
            ->where('lesson_id', $lessonId)
            ->exists();

        if ($alreadyPurchasedLesson) {
            return response()->json(['message' => 'أنت مشترك بالفعل في هذه المحاضرة كمنتج مستقل.'], 422);
        }

        $capacityCheck = $this->checkTeacherCapacity($user->id, $lesson->unit->course->teacher_id);
        if ($capacityCheck === 'subscription_expired') {
            return response()->json(['message' => 'عذراً، اشتراك المعلم غير نشط أو منتهي الصلاحية حالياً. لا يمكن الاشتراك في المحاضرة.'], 422);
        } elseif (!$capacityCheck) {
            return response()->json(['message' => 'عذراً، المعلم شارف على استهلاك كامل السعة الاستيعابية للطلاب المحددة لاشتراكه حالياً. لا يمكن الاشتراك في المحاضرة.'], 422);
        }

        // Wallet / Restricted teacher credit option
        $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
        $teacherCredit = DB::table('student_teacher_credits')
            ->where('student_id', $user->id)
            ->where('teacher_id', $lesson->unit->course->teacher_id)
            ->first();
        $creditBalance = $teacherCredit ? (float)$teacherCredit->balance : 0.00;
        $totalAvailable = $wallet->balance + $creditBalance;

        if ($totalAvailable < $lesson->price) {
            StudentActivityService::logPurchaseFailed($user, 'lesson', $lesson, 'رصيد المحفظة غير كافٍ للاشتراك', [], $request);
            return response()->json(['message' => 'رصيد المحفظة والائتمان المخصص للمعلم غير كافٍ للاشتراك. يرجى الشحن أولاً.'], 422);
        }

        return DB::transaction(function () use ($lesson, $courseId, $user) {
            $wallet = Wallet::where('student_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = Wallet::create(['student_id' => $user->id, 'balance' => 0.00]);
            }

            // Check duplicate under lock
            $alreadyPurchasedLesson = Enrollment::where('student_id', $user->id)
                ->where('lesson_id', $lesson->id)
                ->exists();

            if ($alreadyPurchasedLesson) {
                return response()->json(['message' => 'أنت مشترك بالفعل في هذه المحاضرة كمنتج مستقل.'], 422);
            }

            $currentTeacherCredit = DB::table('student_teacher_credits')
                ->where('student_id', $user->id)
                ->where('teacher_id', $lesson->unit->course->teacher_id)
                ->lockForUpdate()
                ->first();
            $lockedCreditBalance = $currentTeacherCredit ? (float)$currentTeacherCredit->balance : 0.00;

            $totalLockedAvailable = $wallet->balance + $lockedCreditBalance;
            if ($totalLockedAvailable < $lesson->price) {
                return response()->json(['message' => 'رصيد المحفظة والائتمان المخصص للمعلم غير كافٍ للاشتراك. يرجى الشحن أولاً.'], 422);
            }

            $deductFromCredit = min($lesson->price, $lockedCreditBalance);
            $deductFromWallet = $lesson->price - $deductFromCredit;

            if ($deductFromCredit > 0) {
                DB::table('student_teacher_credits')
                    ->where('student_id', $user->id)
                    ->where('teacher_id', $lesson->unit->course->teacher_id)
                    ->decrement('balance', $deductFromCredit);
            }

            if ($deductFromWallet > 0) {
                $wallet->balance -= $deductFromWallet;
                $wallet->save();

                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'type' => 'purchase',
                    'amount' => $deductFromWallet,
                    'description' => 'شراء محاضرة (جزء من المحفظة): ' . $lesson->title . ' من كورس ' . $lesson->unit->course->title,
                    'reference_id' => $lesson->id,
                ]);
            }

            Enrollment::create([
                'student_id' => $user->id,
                'course_id' => null,
                'lesson_id' => $lesson->id,
                'enrolled_at' => Carbon::now(),
            ]);

            $lessonPrice = (float)$lesson->price;

            // Split revenue
            \App\Services\RevenueSharingService::handlePurchase(
                $user->id,
                $lesson->unit->course->teacher_id,
                $lessonPrice,
                $courseId,
                null,
                $lesson->id,
                null,
                'wallet',
                null,
                $lessonPrice,
                0.00
            );

            StudentActivityService::logPurchase($user, 'lesson', $lesson, $lessonPrice, 'wallet', ['amount' => $lessonPrice, 'balance_after' => (float)$wallet->balance], request());

            return response()->json([
                'message' => 'تم الاشتراك في المحاضرة بنجاح.',
                'balance' => $wallet->balance,
            ]);
        });
    }

    /**
     * View lesson details (available only if enrolled in Course).
     */
    public function lessonDetail(Request $request, $lessonId)
    {
        $courseId = $request->query('course_id') ?: $request->input('course_id');
        $packageId = $request->query('package_id') ?: $request->input('package_id');
        return $this->getLessonDetailWithContext($request, $lessonId, $courseId, $packageId);
    }

    public function lessonDetailInCourse(Request $request, $courseId, $lessonId)
    {
        return $this->getLessonDetailWithContext($request, $lessonId, $courseId, null);
    }

    public function lessonDetailInPackage(Request $request, $packageId, $lessonId)
    {
        return $this->getLessonDetailWithContext($request, $lessonId, null, $packageId);
    }

    protected function getLessonDetailWithContext(Request $request, $lessonId, $courseIdParam = null, $packageIdParam = null)
    {
        $user = $request->user();
        $lesson = \App\Models\Lesson::with(['unit.course'])->findOrFail($lessonId);
        $course = $lesson->unit->course;

        $parentBundle = null;
        if ($courseIdParam) {
            $parentBundle = \App\Models\Course::find($courseIdParam);
        } elseif ($packageIdParam) {
            $parentBundle = \App\Models\Course::find($packageIdParam);
        }

        $contextCourseId = null;
        $contextPackageId = null;
        $contextLessonId = null;

        if ($user->role === 'student') {
            $teacherSubscription = \App\Models\TeacherSubscription::where('teacher_id', $course->teacher_id)->first();
            if ($teacherSubscription) {
                $statusDetails = $teacherSubscription->calculateStatusDetails();
                if ($statusDetails['status'] === 'Expired') {
                    return response()->json([
                        'subscription_expired' => true,
                        'message' => 'This course is temporarily unavailable because the teacher subscription has expired. Access will automatically resume after renewal.',
                        'lesson' => [
                            'id' => $lesson->id,
                            'title' => $lesson->title,
                            'unit' => [
                                'title' => $lesson->unit->title,
                                'course' => [
                                    'title' => $lesson->unit->course->title,
                                    'id' => $lesson->unit->course->id
                                ],
                                'course_id' => $lesson->unit->course->id
                            ]
                        ]
                    ], 403);
                }
            }

            $hasAccess = \App\Services\StudentAccessService::hasAccess($user->id, $course->id, $packageIdParam, $lesson->id, $courseIdParam);

            if (!$hasAccess) {
                return response()->json(['message' => 'غير مصرح لك بمشاهدة محتوى هذه المحاضرة. يرجى الاشتراك أولاً.'], 403);
            }

            $context = \App\Services\StudentAccessService::resolveProgressContext($user->id, $course->id, $packageIdParam, $lesson->id, $courseIdParam);
            $contextCourseId = $context['course_id'];
            $contextPackageId = $context['package_id'];
            $contextLessonId = $context['lesson_id'];

            // Check if student has exceeded view limit (only in Course context)
            $contextCourse = $contextCourseId ? \App\Models\Course::find($contextCourseId) : $course;
            if (false && $contextCourse && $contextCourse->hasExceededViewLimitForStudent($user->id)) {
                $viewLimitDetails = $contextCourse->getStudentViewLimitDetails($user->id);
                return response()->json([
                    'is_views_exceeded' => true,
                    'message' => 'لقد استنفدت عدد المشاهدات المسموح بها لهذا الكورس.',
                    'lesson' => [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'unit' => [
                            'title' => $lesson->unit->title,
                            'course' => [
                                    'title' => $course->title,
                                    'id' => $course->id
                            ],
                            'course_id' => $course->id
                        ]
                    ],
                    'videos' => [],
                    'pdfs' => [],
                    'exams' => [],
                    'view_limit_details' => $viewLimitDetails
                ]);
            }

            if ($courseIdParam && $lesson->isLockedForStudent($user->id, $courseIdParam)) {
                return response()->json([
                    'message' => 'يجب إكمال متطلبات الدرس السابق أولاً (مشاهدة المحاضرات وحل الواجب).',
                    'is_locked' => true
                ], 403);
            }

            $bundleId = $parentBundle && $parentBundle->is_bundle ? $parentBundle->id : null;
            StudentActivityService::logLessonOpened($user, $lesson, $course->id, $bundleId, $request);
        } elseif ($user->role === 'teacher') {
            if ($course->teacher_id !== $user->id) {
                return response()->json(['message' => 'غير مصرح لك بمشاهدة محتوى درس لا يخص كورساتك.'], 403);
            }
        } elseif ($user->role === 'admin') {
            // Admin has full access
        } else {
            return response()->json(['message' => 'دور المستخدم غير صالح.'], 403);
        }

        $videos = Video::where('lesson_id', $lessonId)->get();
        $pdfs = \App\Models\Pdf::where('lesson_id', $lessonId)->get();
        $exams = Exam::where('lesson_id', $lessonId)->get();

        $viewLimitDetails = null;
        if ($user->isStudent() && $contextCourse) {
            $viewLimitDetails = $contextCourse->getStudentViewLimitDetails($user->id);
        }

        // Get progress for each video
        $videosWithProgress = $videos->map(function ($video) use ($user, $contextCourseId, $contextPackageId, $contextLessonId, $viewLimitDetails) {
            $progressQuery = VideoProgress::where('student_id', $user->id)
                ->where('video_id', $video->id)
                ->where('course_id', $contextCourseId);
            if ($contextPackageId) {
                $progressQuery->where('package_id', $contextPackageId);
            } else {
                $progressQuery->whereNull('package_id');
            }
            $progress = $progressQuery->first();

            $limitEnabled = $viewLimitDetails && $viewLimitDetails['limit_enabled'];
            $totalAllowed = $limitEnabled ? (int)($viewLimitDetails['base_limit'] + $viewLimitDetails['extra_views']) : -1;
            
            $viewsUsed = $progress ? (int)$progress->views_count : 0;
            $viewsRemaining = $limitEnabled && $totalAllowed !== -1 ? max(0, $totalAllowed - $viewsUsed) : -1;

            $videoViewLimitDetails = [
                'limit_enabled' => $limitEnabled,
                'total_allowed_views' => $totalAllowed,
                'max_views' => $totalAllowed,
                'views_used' => $viewsUsed,
                'remaining_views' => $viewsRemaining,
                'remaining' => $viewsRemaining,
                'is_unlimited' => !$limitEnabled || $totalAllowed === -1,
                'exceeded' => $limitEnabled && $totalAllowed !== -1 && $viewsUsed >= $totalAllowed,
            ];

            return [
                'id' => $video->id,
                'title' => $video->title,
                'bunny_stream_id' => $video->bunny_stream_id,
                'bunny_embed_url' => $video->bunny_embed_url,
                'bunny_status' => $video->bunny_status,
                'duration_seconds' => $video->duration_seconds,
                'thumbnail_path' => $video->thumbnail_path,
                'progress' => [
                    'watched_seconds' => $progress ? $progress->watched_seconds : 0,
                    'watched_percentage' => $progress ? $progress->watched_percentage : 0.00,
                    'completed' => $progress ? $progress->completed : false,
                    'last_position_seconds' => $progress ? $progress->last_position_seconds : 0,
                    'watched_segments' => $progress && $progress->watched_segments ? $progress->watched_segments : [],
                    'views_allowed' => $totalAllowed,
                    'views_used' => $viewsUsed,
                    'views_remaining' => $viewsRemaining,
                    'view_limit_details' => $videoViewLimitDetails,
                ],
            ];
        });

        // Get exam submissions for this student
        $examsWithAttempts = $exams->map(function ($exam) use ($user, $contextCourseId, $contextPackageId, $contextLessonId) {
            $allAttempts = StudentExam::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->where('course_id', $contextCourseId)
                ->where('package_id', $contextPackageId)
                ->where('lesson_id', $contextLessonId)
                ->get();

            $lastAttempt = $allAttempts->sortByDesc('created_at')->first();
            $bestAttempt = $allAttempts->where('status', 'graded')->sortByDesc('score')->first();
            if (!$bestAttempt) {
                $bestAttempt = $allAttempts->sortByDesc('score')->first();
            }

            $attemptsCount = $allAttempts->count();
            $questionsCount = $exam->questions()->count();

            $isPurchased = !$exam->is_paid || \App\Models\ExamPurchase::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->exists();

            $progressData = $lastAttempt ? [
                'id' => $lastAttempt->id,
                'score' => $lastAttempt->score,
                'status' => $lastAttempt->status,
                'is_suspicious' => (bool)$lastAttempt->is_suspicious,
                'submitted_at' => $lastAttempt->submitted_at,
                'graded_at' => $lastAttempt->graded_at,
                'created_at' => $lastAttempt->created_at ? $lastAttempt->created_at->toIso8601String() : null,
                'teacher_feedback' => $lastAttempt->teacher_feedback,
                'attempts_count' => $attemptsCount,
            ] : null;

            return [
                'id' => $exam->id,
                'title' => $exam->title,
                'type' => $exam->type,
                'time_limit_minutes' => $exam->time_limit_minutes,
                'max_score' => $exam->max_score,
                'is_paid' => $exam->is_paid,
                'price' => $exam->price,
                'is_purchased' => $isPurchased,
                
                // Scheduling details
                'enable_schedule' => (bool)$exam->enable_schedule,
                'open_date' => $exam->open_date ? $exam->open_date->format('Y-m-d') : null,
                'open_time' => $exam->open_time,
                'close_date' => $exam->close_date ? $exam->close_date->format('Y-m-d') : null,
                'close_time' => $exam->close_time,
                'start_date' => $exam->start_date ? $exam->start_date->format('Y-m-d') : null,
                'start_time' => $exam->start_time,
                'end_date' => $exam->end_date ? $exam->end_date->format('Y-m-d') : null,
                'end_time' => $exam->end_time,

                // Metadata
                'questions_count' => $questionsCount,
                'max_attempts' => $exam->max_attempts ?? 1,
                'passing_score' => $exam->passing_score ?? 50,

                // Attempt details
                'attempts_count' => $attemptsCount,
                'progress' => $progressData,
                'last_attempt' => $progressData,
                'best_attempt' => $bestAttempt ? [
                    'id' => $bestAttempt->id,
                    'score' => $bestAttempt->score,
                    'status' => $bestAttempt->status,
                ] : null,
            ];
        });



        if ($parentBundle && $parentBundle->is_bundle) {
            $lesson->unit->course->title = $parentBundle->title;
            $lesson->unit->course->id = $parentBundle->id;
        }

        return response()->json([
            'lesson' => $lesson,
            'videos' => $videosWithProgress,
            'pdfs' => $pdfs,
            'exams' => $examsWithAttempts,
            'view_limit_details' => $viewLimitDetails
        ]);
    }

    /**
     * Save video watch progress.
     */
    public function updateVideoProgress(Request $request, $videoId)
    {
        \Log::info('Updating progress', $request->all());

        $request->validate([
            'watched_seconds' => 'required|integer|min:0',
            'last_position_seconds' => 'required|integer|min:0',
            'watched_segments' => 'nullable|array',
            'session_id' => 'nullable|string',
            'session_watch_time' => 'nullable|integer|min:0',
        ]);

        $user = $request->user();
        $video = Video::findOrFail($videoId);
        $lesson = $video->lesson;

        if ($user->isStudent()) {
            if (!$lesson || !$lesson->unit) {
                return response()->json(['message' => 'المحاضرة غير صالحة.'], 404);
            }

            $courseIdParam = $request->input('course_id') ?: $request->query('course_id');
            $packageIdParam = $request->input('package_id') ?: $request->query('package_id');

            $hasAccess = \App\Services\StudentAccessService::hasAccess($user->id, $lesson->unit->course_id, $packageIdParam, $lesson->id, $courseIdParam);
            if (!$hasAccess) {
                return response()->json(['message' => 'غير مصرح لك بمشاهدة هذا الفيديو أو تحديث تقدمه.'], 403);
            }

            $context = \App\Services\StudentAccessService::resolveProgressContext($user->id, $lesson->unit->course_id, $packageIdParam, $lesson->id, $courseIdParam);
            $contextCourseId = $context['course_id'];
            $contextPackageId = $context['package_id'];
            $contextLessonId = $context['lesson_id'];

            // Check if student has exceeded view limit (only in Course context)
            $contextCourse = $contextCourseId ? \App\Models\Course::find($contextCourseId) : $course;
            $viewLimitDetails = $contextCourse ? $contextCourse->getStudentViewLimitDetails($user->id) : null;
            $limitEnabled = $viewLimitDetails && $viewLimitDetails['limit_enabled'];
            $totalAllowed = $limitEnabled ? (int)$viewLimitDetails['total_allowed_views'] : -1;
            
            $isExceeded = false;
            if ($limitEnabled && $totalAllowed !== -1) {
                $existingProgressQuery = \App\Models\VideoProgress::where('student_id', $user->id)
                    ->where('video_id', $video->id)
                    ->where('course_id', $contextCourseId);
                if ($contextPackageId) {
                    $existingProgressQuery->where('package_id', $contextPackageId);
                } else {
                    $existingProgressQuery->whereNull('package_id');
                }
                $existingProgress = $existingProgressQuery->first();
                $viewsUsed = $existingProgress ? (int)$existingProgress->views_count : 0;
                if ($viewsUsed >= $totalAllowed) {
                    $isExceeded = true;
                }
            }

            if ($isExceeded) {
                // Allow the student to continue their current active playback session
                $sessionId = $request->input('session_id');
                $sessionExists = false;
                if ($sessionId) {
                    $sessionExists = \App\Models\VideoViewSession::where('session_id', $sessionId)
                        ->where('student_id', $user->id)
                        ->where('video_id', $video->id)
                        ->exists();
                }
                if (!$sessionExists) {
                    return response()->json(['message' => 'لقد انتهى عدد مرات مشاهدة هذا الفيديو. يرجى شراء كود جديد لاستعادة الوصول.'], 403);
                }
            }
        } else {
            $contextCourseId = null;
            $contextPackageId = $packageIdParam;
            $contextLessonId = $lesson ? $lesson->id : null;
            $contextCourse = $course;
        }

        // Fetch duration if set, default to 300 seconds if not provided to avoid divide by zero
        $duration = $video->duration_seconds ?: 300;

        // Track and count views based on session watch time
        $sessionId = $request->input('session_id');
        $sessionWatchTime = $request->input('session_watch_time', 0);
        
        if ($sessionId && $user->isStudent() && $video->lesson && $video->lesson->unit) {
            $session = \App\Models\VideoViewSession::firstOrCreate([
                'session_id' => $sessionId,
            ], [
                'student_id' => $user->id,
                'video_id' => $video->id,
                'course_id' => $contextCourseId,
                'watch_time' => 0,
                'counted' => false,
            ]);

            if ($sessionWatchTime > $session->watch_time) {
                $session->watch_time = $sessionWatchTime;
                $session->save();
            }

            // Load settings dynamically instead of using hardcoded defaults
            $settings = \App\Models\PlatformSetting::first();
            $configuredThreshold = $settings ? (int)$settings->video_threshold_seconds : 300;

            // Strictly enforce view threshold based on settings: $configuredThreshold seconds or 80% if duration < $configuredThreshold
            $threshold = ($duration < $configuredThreshold) ? (int)round(0.80 * $duration) : $configuredThreshold;
            
            // Get views count before update
            $viewLimitRecord = \App\Models\StudentCourseViewLimit::where('student_id', $user->id)
                ->where('course_id', $contextCourseId)
                ->first();
            $viewsUsedBefore = $viewLimitRecord ? $viewLimitRecord->views_used : 0;

            $skipViewIncrement = (bool)$request->input('skip_view_increment', false);

            $shouldIncrementViewsCount = false;
            if ($session->watch_time >= $threshold && !$session->counted) {
                // Perform atomic update to prevent concurrent race condition
                $affected = \App\Models\VideoViewSession::where('id', $session->id)
                    ->where('counted', false)
                    ->update(['counted' => true]);

                if ($affected > 0) {
                    $session->counted = true;
                    $shouldIncrementViewsCount = true;

                    // Check if this video has already been counted for the student (no duplicates across sessions/refreshes)
                    $alreadyCountedSession = \App\Models\VideoViewSession::where('student_id', $user->id)
                        ->where('video_id', $video->id)
                        ->where('course_id', $contextCourseId)
                        ->where('counted', true)
                        ->where('session_id', '!=', $session->session_id)
                        ->exists();

                    $alreadyCompletedProgressQuery = \App\Models\VideoProgress::where('student_id', $user->id)
                        ->where('video_id', $video->id)
                        ->where('course_id', $contextCourseId);
                    if ($contextPackageId) {
                        $alreadyCompletedProgressQuery->where('package_id', $contextPackageId);
                    } else {
                        $alreadyCompletedProgressQuery->whereNull('package_id');
                    }
                    $alreadyCompletedProgress = $alreadyCompletedProgressQuery->where(function ($q) use ($threshold) {
                            $q->where('completed', true)
                              ->orWhere('watched_seconds', '>=', $threshold);
                        })
                        ->exists();

                    if (!$alreadyCountedSession && !$alreadyCompletedProgress && $contextCourseId) {
                        $viewLimit = \App\Models\StudentCourseViewLimit::firstOrCreate([
                            'student_id' => $user->id,
                            'course_id' => $contextCourseId,
                        ], [
                            'views_used' => 0,
                            'max_views_override' => null,
                            'extra_views' => 0,
                        ]);

                        $viewLimit->increment('views_used');
                    }
                }
            }

            // Get views count after update
            $viewLimitRecordAfter = \App\Models\StudentCourseViewLimit::where('student_id', $user->id)
                ->where('course_id', $contextCourseId)
                ->first();
            $viewsUsedAfter = $viewLimitRecordAfter ? $viewLimitRecordAfter->views_used : 0;

            // Recalculate remaining views
            $limitDetails = $contextCourse ? $contextCourse->getStudentViewLimitDetails($user->id) : null;
            $remainingViews = $limitDetails ? $limitDetails['remaining'] : null;

            // Temporary logging for audit and debugging
            \Log::info('Watch Limit Tracking Log:', [
                'loaded_settings' => [
                    'view_limit_enabled' => $settings ? (bool)$settings->view_limit_enabled : false,
                    'default_max_views' => $settings ? (int)$settings->default_max_views : 10,
                    'video_threshold_seconds' => $configuredThreshold,
                ],
                'current_watch_duration' => $session->watch_time,
                'watch_count_before_update' => $viewsUsedBefore,
                'watch_count_after_update' => $viewsUsedAfter,
                'remaining_views' => $remainingViews,
            ]);
        }
        
        $lastPosition = $request->last_position_seconds;

        // Find existing progress record
        $progressQuery = VideoProgress::where('student_id', $user->id)
            ->where('video_id', $videoId)
            ->where('course_id', $contextCourseId);
        if ($contextPackageId) {
            $progressQuery->where('package_id', $contextPackageId);
        } else {
            $progressQuery->whereNull('package_id');
        }
        $progress = $progressQuery->first();

        // Process segments
        $incomingSegments = $request->input('watched_segments', []);
        $mergedSegments = $this->mergeTimeSegments($incomingSegments);
        
        // Calculate watched seconds as sum of unique watched segments
        $watchedDuration = $this->calculateWatchedDuration($mergedSegments);
        
        // Fallback to request's watched_seconds if no segments are provided
        $finalWatchedSeconds = count($mergedSegments) > 0 ? (int)round($watchedDuration) : $request->watched_seconds;
        
        // Calculate percentage strictly from actual unique watched seconds
        $percentage = min(100.00, round(($finalWatchedSeconds / $duration) * 100, 2));

        $viewsCount = $progress ? $progress->views_count : 0;
        if (isset($shouldIncrementViewsCount) && $shouldIncrementViewsCount) {
            $viewsCount++;
        }

        // Completion must happen only when progress >= 90 based on unique watched segments
        $completed = ($percentage >= 90.0);

        $progress = VideoProgress::updateOrCreate(
            [
                'student_id' => $user->id,
                'video_id' => $videoId,
                'course_id' => $contextCourseId,
                'package_id' => $contextPackageId,
            ],
            [
                'course_id' => $contextCourseId,
                'package_id' => $contextPackageId,
                'lesson_id' => $contextLessonId,
                'watched_seconds' => max($finalWatchedSeconds, $progress ? $progress->watched_seconds : 0),
                'watched_percentage' => max($percentage, $progress ? $progress->watched_percentage : 0.00),
                'completed' => $completed || ($progress && $progress->completed),
                'last_position_seconds' => $lastPosition,
                'views_count' => $viewsCount,
                'watched_segments' => $mergedSegments,
            ]
        );

        if ($user->role === 'student') {
            $bundleId = $contextCourse && $contextCourse->is_bundle ? $contextCourse->id : null;
            $childCourseId = $lesson && $lesson->unit ? $lesson->unit->course_id : ($contextCourse && !$contextCourse->is_bundle ? $contextCourse->id : null);
            
            // Log video started
            if ($finalWatchedSeconds > 0) {
                StudentActivityService::logVideoStarted($user, $video, $childCourseId, $bundleId, $request);
            }

            // Log video milestones (25%, 50%, 75%) or completion
            StudentActivityService::logVideoProgress(
                $user,
                $video,
                (float)$percentage,
                (int)$finalWatchedSeconds,
                (bool)$completed,
                $childCourseId,
                $bundleId,
                $request
            );
        }

        $videoViewLimitDetails = null;
        $totalAllowed = -1;
        $viewsUsed = 0;
        $viewsRemaining = -1;
        
        if ($user->isStudent() && $contextCourse) {
            $courseLimitDetails = $contextCourse->getStudentViewLimitDetails($user->id);
            $limitEnabled = $courseLimitDetails && $courseLimitDetails['limit_enabled'];
            
            if ($courseLimitDetails && $courseLimitDetails['is_unlimited']) {
                $totalAllowed = -1;
                $viewsUsed = 0;
                $viewsRemaining = -1;
                $videoViewLimitDetails = [
                    'limit_enabled' => true,
                    'total_allowed_views' => -1,
                    'max_views' => -1,
                    'views_used' => 0,
                    'remaining_views' => -1,
                    'remaining' => -1,
                    'is_unlimited' => true,
                    'exceeded' => false,
                ];
            } else {
                $totalAllowed = $limitEnabled ? (int)($courseLimitDetails['base_limit'] + $courseLimitDetails['extra_views']) : -1;
                $viewsUsed = $viewsCount;
                $viewsRemaining = $limitEnabled && $totalAllowed !== -1 ? max(0, $totalAllowed - $viewsUsed) : -1;

                $videoViewLimitDetails = [
                    'limit_enabled' => $limitEnabled,
                    'total_allowed_views' => $totalAllowed,
                    'max_views' => $totalAllowed,
                    'views_used' => $viewsUsed,
                    'remaining_views' => $viewsRemaining,
                    'remaining' => $viewsRemaining,
                    'is_unlimited' => !$limitEnabled || $totalAllowed === -1,
                    'exceeded' => $limitEnabled && $totalAllowed !== -1 && $viewsUsed >= $totalAllowed,
                ];
            }
        }
        
        $progress->views_allowed = $totalAllowed;
        $progress->views_used = $viewsUsed;
        $progress->views_remaining = $viewsRemaining;
        $progress->view_limit_details = $videoViewLimitDetails;

        return response()->json($progress);
    }

    /**
     * Record PDF open/view progress.
     */
    public function viewPdf(Request $request, $pdfId)
    {
        $user = $request->user();
        $pdf = \App\Models\Pdf::findOrFail($pdfId);
        $lesson = $pdf->lesson;

        $courseIdParam = $request->input('course_id') ?: $request->query('course_id');
        $packageIdParam = $request->input('package_id') ?: $request->query('package_id');

        $contextCourseId = null;
        $contextPackageId = null;
        $contextLessonId = null;

        if ($courseIdParam) {
            $contextCourseId = $courseIdParam;
        } elseif ($packageIdParam) {
            $contextPackageId = $packageIdParam;
        } else {
            $contextLessonId = $lesson ? $lesson->id : null;
        }

        // Record or update PDF progress
        $progress = \App\Models\StudentPdfProgress::firstOrCreate(
            [
                'student_id' => $user->id,
                'pdf_id' => $pdf->id,
                'course_id' => $contextCourseId,
                'package_id' => $contextPackageId,
                'lesson_id' => $contextLessonId,
            ],
            [
                'open_count' => 0,
            ]
        );

        $progress->increment('open_count');
        $progress->last_opened_at = \Carbon\Carbon::now();
        $progress->save();

        if ($user->role === 'student') {
            $bundleId = null;
            if ($courseIdParam) {
                $c = Course::find($courseIdParam);
                if ($c && $c->is_bundle) $bundleId = $c->id;
            }
            StudentActivityService::logPdfOpened($user, $pdf, $contextCourseId, $bundleId, $request);
        }

        return response()->json([
            'message' => 'تم تسجيل فتح الملف بنجاح.',
            'open_count' => $progress->open_count,
            'last_opened_at' => $progress->last_opened_at->toIso8601String(),
        ]);
    }

    public function getPdfDetails(Request $request, $pdfId)
    {
        $user = $request->user();
        $pdf = \App\Models\Pdf::findOrFail($pdfId);
        $lesson = $pdf->lesson;
        if (!$lesson || !$lesson->unit) {
            return response()->json(['message' => 'المحاضرة غير صالحة.'], 404);
        }
        $courseId = $lesson->unit->course_id;

        $courseIdParam = $request->query('course_id') ?: $request->input('course_id');
        $packageIdParam = $request->query('package_id') ?: $request->input('package_id');

        $parentBundle = null;
        if ($courseIdParam) {
            $parentBundle = \App\Models\Course::find($courseIdParam);
        } elseif ($packageIdParam) {
            $parentBundle = \App\Models\Course::find($packageIdParam);
        }

        $hasAccess = \App\Services\StudentAccessService::hasAccess($user->id, $lesson->unit->course_id, $packageIdParam, $lesson->id, $courseIdParam);

        if (!$hasAccess) {
            return response()->json(['message' => 'غير مصرح لك بمشاهدة محتوى هذا الملف. يرجى الاشتراك أولاً.'], 403);
        }

        $context = \App\Services\StudentAccessService::resolveProgressContext($user->id, $lesson->unit->course_id, $packageIdParam, $lesson->id, $courseIdParam);
        $contextCourseId = $context['course_id'];
        $contextPackageId = $context['package_id'];
        $contextLessonId = $context['lesson_id'];

        $progress = \App\Models\StudentPdfProgress::firstOrCreate(
            [
                'student_id' => $user->id,
                'pdf_id' => $pdf->id,
                'course_id' => $contextCourseId,
                'package_id' => $contextPackageId,
                'lesson_id' => $contextLessonId,
            ],
            [
                'open_count' => 0,
            ]
        );
        $progress->increment('open_count');
        $progress->last_opened_at = \Carbon\Carbon::now();
        $progress->save();

        $isPublic = true;
        $errorMessage = null;

        if (strpos($pdf->file_path, 'drive.google.com') !== false || strpos($pdf->file_path, 'docs.google.com') !== false) {
            $fileId = null;
            if (preg_match('/\/d\/([a-zA-Z0-9-_]+)/', $pdf->file_path, $matches)) {
                $fileId = $matches[1];
            } elseif (preg_match('/id=([a-zA-Z0-9-_]+)/', $pdf->file_path, $matches)) {
                $fileId = $matches[1];
            }

            if ($fileId) {
                $previewUrl = "https://drive.google.com/file/d/{$fileId}/preview";
                try {
                    $response = \Illuminate\Support\Facades\Http::withoutVerifying()
                        ->timeout(5)
                        ->get($previewUrl);
                    
                    if ($response->failed() || strpos($response->body(), 'sign-in') !== false || strpos($response->body(), 'Login') !== false || strpos($response->body(), 'Google Drive - Page Not Found') !== false) {
                        $isPublic = false;
                        $errorMessage = 'This file is not publicly shared.';
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to check Google Drive link: " . $e->getMessage());
                }
            }
        }

        if ($parentBundle && $parentBundle->is_bundle) {
            $lesson->unit->course->title = $parentBundle->title;
            $lesson->unit->course->id = $parentBundle->id;
        }

        return response()->json([
            'pdf' => $pdf,
            'is_public' => $isPublic,
            'error_message' => $errorMessage,
            'lesson' => [
                'id' => $lesson->id,
                'title' => $lesson->title,
            ]
        ]);
    }

    /**
     * Merge overlapping time segments.
     */
    private function mergeTimeSegments(array $segments): array
    {
        if (empty($segments)) {
            return [];
        }

        // Sort segments by start time
        usort($segments, function ($a, $b) {
            $aStart = isset($a['start']) ? floatval($a['start']) : (isset($a[0]) ? floatval($a[0]) : 0.0);
            $bStart = isset($b['start']) ? floatval($b['start']) : (isset($b[0]) ? floatval($b[0]) : 0.0);
            return $aStart <=> $bStart;
        });

        $merged = [];
        $first = $segments[0];
        $lastStart = isset($first['start']) ? floatval($first['start']) : (isset($first[0]) ? floatval($first[0]) : 0.0);
        $lastEnd = isset($first['end']) ? floatval($first['end']) : (isset($first[1]) ? floatval($first[1]) : 0.0);

        $merged[] = ['start' => $lastStart, 'end' => $lastEnd];

        for ($i = 1; $i < count($segments); $i++) {
            $current = $segments[$i];
            $currentStart = isset($current['start']) ? floatval($current['start']) : (isset($current[0]) ? floatval($current[0]) : 0.0);
            $currentEnd = isset($current['end']) ? floatval($current['end']) : (isset($current[1]) ? floatval($current[1]) : 0.0);

            $lastIndex = count($merged) - 1;
            if ($currentStart <= $merged[$lastIndex]['end']) {
                $merged[$lastIndex]['end'] = max($merged[$lastIndex]['end'], $currentEnd);
            } else {
                $merged[] = ['start' => $currentStart, 'end' => $currentEnd];
            }
        }

        return $merged;
    }

    /**
     * Calculate sum of unique watched durations.
     */
    private function calculateWatchedDuration(array $mergedSegments): float
    {
        $duration = 0.0;
        foreach ($mergedSegments as $segment) {
            $duration += max(0.0, floatval($segment['end']) - floatval($segment['start']));
        }
        return $duration;
    }

    /**
     * Finalize and grade an expired course exam attempt server-side.
     */
    private function finalizeExpiredCourseAttempt(StudentExam $attempt, Exam $exam)
    {
        $existingAnswers = StudentAnswer::where('student_exam_id', $attempt->id)
            ->pluck('answer_text', 'question_id')
            ->toArray();

        $totalScore = 0;
        $isAutoGraded = in_array($exam->type, ['quiz', 'monthly_exam']) || ($exam->type === 'homework' && $exam->homework_type === 'bubble_sheet');
        $hasEssay = false;

        foreach ($exam->questions as $question) {
            $answerText = $existingAnswers[$question->id] ?? '';
            $isCorrect = false;
            $questionScore = 0;

            if ($question->type === 'essay') {
                $hasEssay = true;
            } else {
                if (trim(strtolower((string)$answerText)) === trim(strtolower((string)$question->correct_answer))) {
                    $isCorrect = true;
                    $questionScore = $question->score;
                    $totalScore += $questionScore;
                }
            }

            StudentAnswer::updateOrCreate(
                [
                    'student_exam_id' => $attempt->id,
                    'question_id' => $question->id,
                ],
                [
                    'answer_text' => $answerText,
                    'is_correct' => $isCorrect,
                    'score' => $questionScore,
                ]
            );
        }

        $attempt->status = ($isAutoGraded && !$hasEssay) ? 'graded' : 'submitted';
        $attempt->score = $totalScore;
        $attempt->auto_submitted = true;
        $attempt->submission_reason = 'time_expired';
        $attempt->submitted_at = $attempt->expires_at ?: Carbon::now();
        if ($attempt->status === 'graded') {
            $attempt->graded_at = Carbon::now();
        }
        $attempt->save();
    }

    /**
     * Start/Load an exam.
     */
    public function startExam(Request $request, $examId)
    {
        $user = $request->user();
        $exam = Exam::with('questions')->findOrFail($examId);
        
        $lesson = $exam->lesson;
        $courseId = $lesson->unit->course_id;

        $courseIdParam = $request->query('course_id') ?: $request->input('course_id');
        $packageIdParam = $request->query('package_id') ?: $request->input('package_id');

        $hasAccess = \App\Services\StudentAccessService::hasAccess($user->id, $lesson->unit->course_id, $packageIdParam, $lesson->id, $courseIdParam);

        if (!$hasAccess) {
            return response()->json(['message' => 'غير مصرح لك بأداء هذا الامتحان. يرجى الاشتراك أولاً.'], 403);
        }

        $context = \App\Services\StudentAccessService::resolveProgressContext($user->id, $lesson->unit->course_id, $packageIdParam, $lesson->id, $courseIdParam);
        $contextCourseId = $context['course_id'];
        $contextPackageId = $context['package_id'];
        $contextLessonId = $context['lesson_id'];

        // Check if student has exceeded course views (only in Course context)
        $contextCourse = $contextCourseId ? \App\Models\Course::find($contextCourseId) : $lesson->unit->course;
        if ($contextCourse && $contextCourse->hasExceededViewLimitForStudent($user->id)) {
            return response()->json(['message' => 'لقد انتهت عدد المشاهدات المسموح بها لهذا الكورس. لا يمكنك أداء هذا الامتحان.'], 403);
        }

        $maxAttempts = (int)($exam->max_attempts ?: 1);

        // Transaction and row-locking to ensure atomicity and prevent race condition duplicate attempts
        $attemptOrResponse = DB::transaction(function () use ($request, $user, $exam, $examId, $maxAttempts, $contextCourseId, $contextPackageId, $contextLessonId) {
            // Authoritative attempt lookup across all contexts for this student and exam
            $allAttempts = StudentExam::where('student_id', $user->id)
                ->where('exam_id', $examId)
                ->lockForUpdate()
                ->orderBy('id', 'desc')
                ->get();

            $activeAttempt = $allAttempts->firstWhere('status', 'started');

            if ($activeAttempt) {
                // If terminated for cheating, student cannot restart
                if ($activeAttempt->isTerminatedForCheating()) {
                    return response()->json([
                        'message' => 'تم حرمانك من هذا الامتحان بسبب مخالفات نظام المراقبة.',
                        'terminated' => true,
                        'error_code' => 'TERMINATED_FOR_CHEATING',
                        'attempt_id' => $activeAttempt->id,
                    ], 403);
                }

                // Check expiration
                $now = \Carbon\Carbon::now();
                if (!$activeAttempt->expires_at && $exam->time_limit_minutes) {
                    $activeAttempt->expires_at = \Carbon\Carbon::parse($activeAttempt->started_at ?? $now)
                        ->addMinutes($activeAttempt->duration_minutes ?: $exam->time_limit_minutes);
                    $activeAttempt->save();
                }

                if ($activeAttempt->expires_at && $now->gt($activeAttempt->expires_at)) {
                    $this->finalizeExpiredCourseAttempt($activeAttempt, $exam);
                    $activeAttempt = null; // Finalized, no longer active
                } else {
                    // Active and valid -> Resume!
                    return $activeAttempt;
                }
            }

            // At this point, there is NO active in-progress attempt.
            // Check how many attempts have been consumed.
            // Consumed = submitted, graded, terminated_for_cheating, or expired.
            $now = \Carbon\Carbon::now();
            $consumedCount = $allAttempts->filter(function ($att) use ($now) {
                return in_array($att->status, ['submitted', 'graded', 'terminated_for_cheating'])
                    || $att->isTerminatedForCheating()
                    || ($att->status === 'started' && $att->expires_at && $now->gt($att->expires_at));
            })->count();

            if ($consumedCount >= $maxAttempts) {
                $lastAttempt = $allAttempts->first();
                return response()->json([
                    'message' => 'لقد استنفدت الحد الأقصى للمحاولات المسموح بها لهذا الامتحان (' . $maxAttempts . ').',
                    'error_code' => 'ATTEMPTS_LIMIT_REACHED',
                    'max_attempts' => $maxAttempts,
                    'attempts_used' => $consumedCount,
                    'attempts_remaining' => 0,
                    'attempt_id' => $lastAttempt?->id,
                ], 403);
            }

            // New attempt -> Enforce authoritative availability window BEFORE creating attempt
            $avail = $exam->getAvailabilityStatus();
            if (!$avail['is_available']) {
                return response()->json([
                    'message' => $avail['message'],
                    'status' => $avail['status'],
                    'error_code' => $avail['error_code'],
                    'open_datetime' => $avail['open_datetime'] ?? null,
                    'close_datetime' => $avail['close_datetime'] ?? null,
                    'starts_at' => $avail['starts_at'] ?? null,
                    'ends_at' => $avail['ends_at'] ?? null,
                    'countdown_seconds' => $avail['countdown_seconds'] ?? 0,
                    'formatted_dates' => $avail['formatted_dates'] ?? null,
                ], 403);
            }

            // Check if the exam is paid and student has purchased it
            if ($exam->is_paid) {
                $hasPurchased = \App\Models\ExamPurchase::where('student_id', $user->id)
                    ->where('exam_id', $examId)
                    ->exists();

                if (!$hasPurchased && !$user->isAdmin()) {
                    return response()->json([
                        'message' => 'هذا الامتحان مدفوع ويجب شراؤه أولاً.',
                        'needs_purchase' => true,
                        'price' => $exam->price,
                    ], 402);
                }
            }

            $startedAt = \Carbon\Carbon::now();
            $durationMinutes = $exam->time_limit_minutes ?: null;
            $expiresAt = $durationMinutes ? $startedAt->copy()->addMinutes($durationMinutes) : null;

            $newAttempt = StudentExam::create([
                'student_id' => $user->id,
                'exam_id' => $examId,
                'status' => 'started',
                'course_id' => $contextCourseId,
                'package_id' => $contextPackageId,
                'lesson_id' => $contextLessonId,
                'score' => null,
                'started_at' => $startedAt,
                'duration_minutes' => $durationMinutes,
                'expires_at' => $expiresAt,
            ]);

            return $newAttempt;
        });

        if ($attemptOrResponse instanceof \Illuminate\Http\JsonResponse) {
            return $attemptOrResponse;
        }

        $attempt = $attemptOrResponse;

        // Persistent exam randomization (anti-cheating)
        if (!$attempt->shuffle_mapping) {
            $questionIds = $exam->questions->pluck('id')->toArray();
            shuffle($questionIds);

            $optionsMapping = [];
            foreach ($exam->questions as $question) {
                if ($question->type === 'mcq' && is_array($question->options)) {
                    $indexes = array_keys($question->options);
                    shuffle($indexes);
                    $optionsMapping[$question->id] = $indexes;
                }
            }

            $attempt->shuffle_mapping = [
                'questions' => $questionIds,
                'options' => $optionsMapping,
            ];
            $attempt->save();
        }

        $mapping = $attempt->shuffle_mapping;
        $shuffledQuestionIds = $mapping['questions'] ?? [];
        $optionsMap = $mapping['options'] ?? [];

        $keyedQuestions = $exam->questions->keyBy('id');
        $shuffledQuestions = collect();

        foreach ($shuffledQuestionIds as $qId) {
            if (isset($keyedQuestions[$qId])) {
                $q = $keyedQuestions[$qId];
                
                $shuffledOptions = [];
                if ($q->type === 'mcq' && is_array($q->options) && isset($optionsMap[$qId])) {
                    $shuffledIndexes = $optionsMap[$qId];
                    foreach ($shuffledIndexes as $idx) {
                        if (isset($q->options[$idx])) {
                            $shuffledOptions[] = $q->options[$idx];
                        }
                    }
                    if (count($shuffledOptions) !== count($q->options)) {
                        $shuffledOptions = $q->options;
                    }
                } else {
                    $shuffledOptions = $q->options;
                }

                $shuffledQuestions->push([
                    'id' => $q->id,
                    'text' => $q->text,
                    'type' => $q->type,
                    'options' => $shuffledOptions,
                    'score' => $q->score,
                ]);
            }
        }

        // Fallback for new questions added after attempt started
        foreach ($exam->questions as $q) {
            if (!in_array($q->id, $shuffledQuestionIds)) {
                $shuffledQuestions->push([
                    'id' => $q->id,
                    'text' => $q->text,
                    'type' => $q->type,
                    'options' => $q->options,
                    'score' => $q->score,
                ]);
            }
        }

        // Get existing attempt answers to support resuming
        $existingAnswers = \App\Models\StudentAnswer::where('student_exam_id', $attempt->id)->get();
        $answersFormatted = [];
        foreach ($existingAnswers as $ans) {
            $answersFormatted[$ans->question_id] = $ans->answer_text;
        }

        if ($user->role === 'student') {
            StudentActivityService::logExamEvent($user, $exam, 'started', $attempt, [], $request);
        }

        $serverNow = \Carbon\Carbon::now();
        $timeRemainingSeconds = null;
        if ($attempt->expires_at) {
            $timeRemainingSeconds = max(0, $serverNow->diffInSeconds($attempt->expires_at, false));
        }

        return response()->json([
            'attempt_id' => $attempt->id,
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'type' => $exam->type,
                'homework_type' => $exam->homework_type,
                'time_limit_minutes' => $exam->time_limit_minutes,
                'max_score' => $exam->max_score,
                'allowed_violations' => $exam->allowed_violations ?? 3,
                'auto_submit_on_violation' => (bool)($exam->auto_submit_on_violation ?? true),
                'enable_fullscreen' => (bool)($exam->enable_fullscreen ?? true),
                'enable_anti_tab_switching' => (bool)($exam->enable_anti_tab_switching ?? true),
                'enable_copy_protection' => (bool)($exam->enable_copy_protection ?? true),
                'close_datetime' => $exam->close_date ? \Carbon\Carbon::parse($exam->close_date->format('Y-m-d') . ' ' . ($exam->close_time ?: '23:59:59'))->toIso8601String() : null,
            ],
            'started_at' => $attempt->started_at?->toIso8601String(),
            'expires_at' => $attempt->expires_at?->toIso8601String(),
            'server_now' => $serverNow->toIso8601String(),
            'time_remaining_seconds' => $timeRemainingSeconds,
            'questions' => $shuffledQuestions,
            'existing_answers' => $answersFormatted,
        ]);
    }

    /**
     * Check exam or homework availability before entering.
     */
    public function checkAvailability(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);
        $user = $request->user();

        // 1. Authoritative check: verify if the authenticated student has already consumed all allowed attempts
        if ($user && $user->isStudent()) {
            $allAttempts = StudentExam::where('student_id', $user->id)
                ->where('exam_id', $examId)
                ->get();

            $now = \Carbon\Carbon::now();
            $hasActiveStarted = $allAttempts->contains(function ($att) use ($now) {
                return $att->status === 'started' && (!$att->expires_at || $now->lte($att->expires_at));
            });

            if (!$hasActiveStarted) {
                $consumedCount = $allAttempts->filter(function ($att) use ($now) {
                    return in_array($att->status, ['submitted', 'graded', 'terminated_for_cheating'])
                        || $att->isTerminatedForCheating()
                        || ($att->status === 'started' && $att->expires_at && $now->gt($att->expires_at));
                })->count();

                $maxAttempts = (int)($exam->max_attempts ?: 1);
                if ($consumedCount >= $maxAttempts) {
                    $lastAttempt = $allAttempts->sortByDesc('id')->first();
                    return response()->json([
                        'available' => false,
                        'message' => 'لقد استنفدت الحد الأقصى للمحاولات المسموح بها لهذا الامتحان (' . $maxAttempts . ').',
                        'error_code' => 'ATTEMPTS_LIMIT_REACHED',
                        'max_attempts' => $maxAttempts,
                        'attempts_used' => $consumedCount,
                        'attempts_remaining' => 0,
                        'last_attempt_id' => $lastAttempt?->id,
                    ], 403);
                }
            }
        }

        // 2. Check calendar availability window
        $avail = $exam->getAvailabilityStatus();

        if (!$avail['is_available']) {
            return response()->json([
                'available' => false,
                'message' => $avail['message'],
                'error_code' => $avail['error_code'],
                'status' => $avail['status'],
                'start_datetime' => $avail['starts_at'] ?? $avail['open_datetime'] ?? null,
                'end_datetime' => $avail['ends_at'] ?? $avail['close_datetime'] ?? null,
                'countdown_seconds' => $avail['countdown_seconds'] ?? 0,
                'formatted_dates' => $avail['formatted_dates'] ?? null,
            ], 403);
        }

        return response()->json([
            'available' => true,
            'message' => 'الامتحان متاح حالياً للبدء.',
            'formatted_dates' => $avail['formatted_dates'] ?? null,
        ]);
    }

    /**
     * Save draft progress for an exam attempt.
     */
    public function saveDraftExam(Request $request, $examId)
    {
        $request->validate([
            'attempt_id' => 'required|integer',
            'answers' => 'required|array',
        ]);

        $user = $request->user();
        $attempt = StudentExam::where('id', $request->attempt_id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        if ($attempt->isTerminatedForCheating() || $attempt->status === 'terminated_for_cheating') {
            return response()->json([
                'message' => 'تم إنهاء الامتحان بسبب مخالفات نظام المراقبة، ولا يمكن حفظ إجابات جديدة.',
                'terminated' => true,
            ], 403);
        }

        if ($attempt->status !== 'started') {
            return response()->json(['message' => 'هذا الامتحان غير متاح للتعديل.'], 422);
        }

        // Validate expiration with 30s grace period for in-flight requests
        if ($attempt->expires_at && \Carbon\Carbon::now()->gt($attempt->expires_at->copy()->addSeconds(30))) {
            return response()->json(['message' => 'انتهى الوقت المحدد للامتحان ولا يمكن حفظ إجابات جديدة.'], 422);
        }

        DB::transaction(function () use ($attempt, $request) {
            foreach ($request->answers as $qId => $ansText) {
                $ansTextStr = is_null($ansText) ? '' : (string)$ansText;
                
                StudentAnswer::updateOrCreate(
                    [
                        'student_exam_id' => $attempt->id,
                        'question_id' => $qId,
                    ],
                    [
                        'answer_text' => $ansTextStr,
                        'is_correct' => false,
                        'score' => 0,
                    ]
                );
            }
        });

        return response()->json(['message' => 'تم حفظ الإجابات بنجاح.']);
    }

    /**
     * Submit answers for an exam attempt.
     * Note: Does NOT check exam multi-day calendar window on submit.
     * Checks attempt duration expiration and grades deterministically.
     */
    public function submitExam(Request $request, $examId)
    {
        $request->validate([
            'attempt_id' => 'required|integer',
            'answers' => 'required|array', // key: question_id, value: answer text/option
        ]);

        $user = $request->user();
        $exam = Exam::with(['questions', 'lesson.unit.course'])->findOrFail($examId);
        $attempt = StudentExam::where('id', $request->attempt_id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        if ($attempt->status !== 'started') {
            return response()->json([
                'message' => 'تم تسليم هذا الامتحان مسبقاً.',
                'already_submitted' => true,
                'attempt' => $attempt,
                'score' => $attempt->score,
            ], 200);
        }

        // Check if attempt duration has expired (with 60-second grace window for submission latency)
        $now = \Carbon\Carbon::now();
        $isAttemptExpired = false;
        if ($attempt->expires_at && $now->gt($attempt->expires_at->copy()->addSeconds(60))) {
            $isAttemptExpired = true;
            $attempt->auto_submitted = true;
            $attempt->submission_reason = 'time_expired';
        }

        return DB::transaction(function () use ($exam, $attempt, $request, $user, $isAttemptExpired) {
            $submittedAnswers = $request->answers;
            $totalScore = 0;
            $isAutoGraded = in_array($exam->type, ['quiz', 'monthly_exam']) || ($exam->type === 'homework' && $exam->homework_type === 'bubble_sheet');
            $hasEssay = false;

            // Loop through all exam questions to grade them
            foreach ($exam->questions as $question) {
                $answerText = isset($submittedAnswers[$question->id]) ? (string)$submittedAnswers[$question->id] : '';
                $isCorrect = false;
                $questionScore = 0;

                if ($question->type === 'essay') {
                    $hasEssay = true;
                    $isCorrect = false; // Requires teacher manual check
                    $questionScore = 0; // Filled later by teacher
                } else {
                    // Auto-grade MCQs and True/False questions
                    if (trim(strtolower($answerText)) === trim(strtolower((string)$question->correct_answer))) {
                        $isCorrect = true;
                        $questionScore = (int)$question->score;
                        $totalScore += $questionScore;
                    }
                }

                StudentAnswer::updateOrCreate(
                    [
                        'student_exam_id' => $attempt->id,
                        'question_id' => $question->id,
                    ],
                    [
                        'answer_text' => $answerText,
                        'is_correct' => $isCorrect,
                        'score' => $questionScore,
                    ]
                );
            }

            // If it is auto-gradable with no essay questions, we mark as graded
            if ($isAutoGraded && !$hasEssay) {
                $attempt->status = 'graded';
                $attempt->score = $totalScore;
                $attempt->graded_at = Carbon::now();
            } else {
                $attempt->status = 'submitted'; // Needs teacher review
                $attempt->score = $isAutoGraded ? $totalScore : null; // MCQ part or empty
            }

            $attempt->submitted_at = Carbon::now();
            $attempt->save();

            // Send notification to teacher about submission
            $teacherId = $exam->lesson?->unit?->course?->teacher_id;
            if ($teacherId) {
                \App\Models\Notification::create([
                    'title' => "تسليم جديد: " . ($exam->type === 'homework' ? 'واجب' : 'امتحان'),
                    'message' => "قام الطالب " . $user->name . " بتسليم " . ($exam->type === 'homework' ? 'الواجب' : 'الامتحان') . ": " . $exam->title,
                    'recipient_type' => 'specific_teacher',
                    'recipient_id' => $teacherId,
                    'sender_id' => $user->id,
                    'important' => false,
                ]);

                // Score and Failure notifications
                if ($attempt->status === 'graded') {
                    \App\Models\Notification::create([
                        'title' => "تم رصد درجة الطالب تلقائياً",
                        'message' => "حصل الطالب " . $user->name . " على درجة " . $totalScore . " من " . $exam->max_score . " في " . $exam->title . ".",
                        'recipient_type' => 'specific_teacher',
                        'recipient_id' => $teacherId,
                        'sender_id' => $user->id,
                        'important' => false,
                    ]);

                    $percent = $exam->max_score > 0 ? ($totalScore / $exam->max_score) * 100 : 0;
                    if ($percent < 50) {
                        \App\Models\Notification::create([
                            'title' => "رسوب طالب في التقييم",
                            'message' => "رسب الطالب " . $user->name . " في " . $exam->title . " بعد الحصول على " . $totalScore . " من " . $exam->max_score . " (النسبة: " . round($percent, 1) . "%).",
                            'recipient_type' => 'specific_teacher',
                            'recipient_id' => $teacherId,
                            'sender_id' => $user->id,
                            'important' => false,
                        ]);
                    }
                }
            }

            if ($user->role === 'student') {
                StudentActivityService::logExamEvent($user, $exam, 'submitted', $attempt, ['score' => $attempt->score], $request);
            }

            return response()->json([
                'success' => true,
                'message' => 'تم تسليم الإجابات بنجاح.',
                'attempt' => $attempt,
                'score' => $attempt->score,
                'max_score' => $exam->max_score,
                'status' => $attempt->status,
                'time_expired' => $isAttemptExpired,
            ]);
        });
    }

    /**
     * Log a student exam cheating violation.
     */
    public function logViolation(Request $request, $examId)
    {
        $request->validate([
            'attempt_id' => 'required|integer',
            'violation_type' => 'required|string',
            'question_id' => 'nullable|integer',
            'question_number' => 'nullable|integer',
            'time_remaining' => 'nullable|integer',
        ]);

        $user = $request->user();
        $exam = Exam::with('questions')->findOrFail($examId);
        $attempt = StudentExam::where('id', $request->attempt_id)
            ->where('student_id', $user->id)
            ->firstOrFail();

        if ($attempt->status !== 'started') {
            return response()->json([
                'message' => 'هذه المحاولة غير نشطة.',
                'status' => $attempt->status,
                'terminated' => $attempt->isTerminatedForCheating(),
            ], 422);
        }

        $timestamps = $attempt->violation_timestamps ?: [];
        
        $violationData = [
            'type' => $request->violation_type,
            'time' => \Carbon\Carbon::now()->toDateTimeString(),
            'question_id' => $request->question_id,
            'question_number' => $request->question_number,
            'time_remaining' => $request->time_remaining,
        ];

        // Increment violation count only if it's not a return focus event
        if ($request->violation_type !== 'returned') {
            $attempt->violation_count += 1;
        }

        $timestamps[] = $violationData;
        $attempt->violation_timestamps = $timestamps;

        if ($user->role === 'student') {
            StudentActivityService::logAntiCheat($user, $exam, $request->violation_type, $violationData, $request);
        }

        $allowedViolations = (int)($exam->allowed_violations ?? 3);
        $reachedLimit = $attempt->violation_count >= $allowedViolations;
        
        if ($reachedLimit && $request->violation_type !== 'returned') {
            if ($user->role === 'student') {
                StudentActivityService::logAntiCheat($user, $exam, 'terminated_for_cheating', array_merge($violationData, ['reason' => 'تجاوز الحد الأقصى للمخالفات']), $request);
            }
            $attempt->is_suspicious = true;
            $attempt->status = 'terminated_for_cheating';
            $attempt->terminated_for_cheating_at = \Carbon\Carbon::now();
            $attempt->cheat_violations_count = $attempt->violation_count;
            $attempt->submission_reason = 'cheat_violations_limit_exceeded';
            $attempt->auto_submitted = true;
            $attempt->submitted_at = \Carbon\Carbon::now();
            $attempt->score = 0; // Terminated for cheating is assigned 0

            // Save existing draft answers so teacher can review them
            $existingAnswers = StudentAnswer::where('student_exam_id', $attempt->id)
                ->pluck('answer_text', 'question_id')
                ->toArray();

            foreach ($exam->questions as $question) {
                $answerText = $existingAnswers[$question->id] ?? '';
                StudentAnswer::updateOrCreate(
                    [
                        'student_exam_id' => $attempt->id,
                        'question_id' => $question->id,
                    ],
                    [
                        'answer_text' => $answerText,
                        'is_correct' => false,
                        'score' => 0,
                    ]
                );
            }
        }

        $attempt->save();

        return response()->json([
            'violation_count' => $attempt->violation_count,
            'allowed_violations' => $allowedViolations,
            'is_suspicious' => $attempt->is_suspicious,
            'status' => $attempt->status,
            'terminated' => $attempt->isTerminatedForCheating(),
            'message' => $attempt->isTerminatedForCheating() ? 'تم إنهاء الامتحان بسبب مخالفات المراقبة.' : 'تم تسجيل المخالفة بنجاح.',
        ]);
    }

    /**
     * Get student exam attempts.
     */
    public function examResults(Request $request)
    {
        $user = $request->user();
        $attempts = StudentExam::with([
            'exam.lesson.unit.course',
            'exam.course',
            'course',
            'exam.questions',
            'answers.question'
        ])
        ->where('student_id', $user->id)
        ->whereIn('status', ['submitted', 'graded', 'terminated_for_cheating'])
        ->latest()
        ->get();

        // Calculate dynamic rank for each graded attempt
        $attempts->transform(function ($attempt) {
            $canView = $attempt->canViewAnswers();
            $attempt->can_view_answers = $canView;
            $attempt->is_terminated_for_cheating = $attempt->isTerminatedForCheating();

            // If terminated for cheating and answers not unlocked, strip correct answers and explanations
            if (!$canView && $attempt->exam && $attempt->exam->questions) {
                $attempt->exam->questions->makeHidden(['correct_answer', 'explanation']);
                foreach ($attempt->exam->questions as $q) {
                    $q->correct_answer = null;
                    $q->explanation = null;
                }
                if ($attempt->answers) {
                    foreach ($attempt->answers as $a) {
                        if ($a->question) {
                            $a->question->makeHidden(['correct_answer', 'explanation']);
                            $a->question->correct_answer = null;
                            $a->question->explanation = null;
                        }
                    }
                }
            }

            if ($attempt->status === 'graded' && $attempt->score !== null) {
                $rankedAttempts = StudentExam::where('exam_id', $attempt->exam_id)
                    ->where('status', 'graded')
                    ->whereNotNull('score')
                    ->orderBy('score', 'desc')
                    ->get();
                
                $rank = 1;
                $found = false;
                foreach ($rankedAttempts as $index => $ra) {
                    if ($ra->student_id === $attempt->student_id) {
                        $rank = $index + 1;
                        $found = true;
                        break;
                    }
                }
                $attempt->rank = $found ? $rank : 1;
                $attempt->total_participants = $rankedAttempts->count();
            } else {
                $attempt->rank = null;
                $attempt->total_participants = StudentExam::where('exam_id', $attempt->exam_id)->count();
            }

            // Restore the exact same randomized order of questions and choices for review
            if ($attempt->shuffle_mapping) {
                $mapping = $attempt->shuffle_mapping;
                $questionOrder = $mapping['questions'] ?? [];
                $optionsMap = $mapping['options'] ?? [];

                if ($attempt->relationLoaded('answers') && !empty($questionOrder)) {
                    $sortedAnswers = $attempt->answers->sortBy(function ($ans) use ($questionOrder) {
                        $pos = array_search($ans->question_id, $questionOrder);
                        return $pos === false ? 9999 : $pos;
                    })->values();

                    foreach ($sortedAnswers as $ans) {
                        $q = $ans->question;
                        if ($q && $q->type === 'mcq' && is_array($q->options) && isset($optionsMap[$q->id])) {
                            $shuffledOptions = [];
                            foreach ($optionsMap[$q->id] as $idx) {
                                if (isset($q->options[$idx])) {
                                    $shuffledOptions[] = $q->options[$idx];
                                }
                            }
                            if (count($shuffledOptions) === count($q->options)) {
                                $q->options = $shuffledOptions;
                            }
                        }
                    }

                    $attempt->setRelation('answers', $sortedAnswers);
                }
            }

            return $attempt;
        });

        return response()->json($attempts);
    }

    /**
     * Get student dashboard analytics overview.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        
        // Wallet Balance
        $wallet = Wallet::firstOrCreate(['student_id' => $user->id], ['balance' => 0.00]);
        $walletBalance = $wallet->balance;

        // Enrolled Courses and calculation of progress
        $enrollments = Enrollment::with(['course.teacher', 'course.units.lessons.videos', 'package.course.teacher', 'lesson.unit.course.teacher'])
            ->where('student_id', $user->id)
            ->latest()
            ->get();

        // Pre-fetch progress records to eliminate nested N+1 queries
        $progressRecords = VideoProgress::where('student_id', $user->id)
            ->get();

        $coursesData = [];
        $totalVideosCount = 0;
        $completedVideosCount = 0;

        foreach ($enrollments as $enrollment) {
            $course = $enrollment->course;
            $isBundle = false;
            $bundleLessons = collect();
            
            if ($enrollment->package && $enrollment->package->type === 'bundle') {
                $isBundle = true;
                $bundleLessons = $enrollment->package->lessons()->with('videos')->get();
            }

            if (!$course && !$isBundle) {
                if ($enrollment->package) {
                    $course = $enrollment->package->course;
                } elseif ($enrollment->lesson && $enrollment->lesson->unit) {
                    $course = $enrollment->lesson->unit->course;
                }
            }
            if (!$course && !$isBundle) continue;

            $isBundledCourse = false;
            if ($course && $course->is_bundle) {
                $isBundledCourse = true;
                $childIds = \DB::table('course_bundle_items')->where('parent_id', $course->id)->pluck('child_id')->toArray();
                $bundleLessons = \App\Models\Lesson::whereIn('unit_id', function($q) use ($childIds) {
                    $q->select('id')->from('units')->whereIn('course_id', $childIds);
                })->with('videos')->get();
            }

            $contextCourseId = null;
            $contextPackageId = null;
            $contextLessonId = null;

            if ($enrollment->package_id) {
                $contextPackageId = $enrollment->package_id;
            } elseif ($enrollment->course_id) {
                $contextCourseId = $enrollment->course_id;
            } elseif ($enrollment->lesson_id) {
                $contextLessonId = $enrollment->lesson_id;
            }

            // Gather all video IDs
            $videoIds = [];
            if ($isBundle || $isBundledCourse) {
                foreach ($bundleLessons as $lesson) {
                    foreach ($lesson->videos as $video) {
                        $videoIds[] = $video->id;
                    }
                }
            } else {
                foreach ($course->units as $unit) {
                    foreach ($unit->lessons as $lesson) {
                        foreach ($lesson->videos as $video) {
                            $videoIds[] = $video->id;
                        }
                    }
                }
            }

            // Filter progress records to only include this subscription context
            $matchingProgress = $progressRecords->filter(function ($prog) use ($videoIds, $contextCourseId, $contextPackageId) {
                return in_array($prog->video_id, $videoIds) &&
                       $prog->course_id == $contextCourseId &&
                       $prog->package_id == $contextPackageId;
            })->keyBy('video_id');

            $totalVideos = count($videoIds);
            $completedVideos = 0;
            $totalDuration = 0;
            $watchedSeconds = 0;

            if ($totalVideos > 0) {
                $courseProgress = $matchingProgress;
                $completedVideos = $courseProgress->where('completed', true)->count();
                $sumPercentage = $courseProgress->sum('watched_percentage');
                $progress = min(100, round($sumPercentage / $totalVideos));
                
                // Get actual durations and watched seconds
                if ($isBundle || $isBundledCourse) {
                    foreach ($bundleLessons as $lesson) {
                        foreach ($lesson->videos as $video) {
                            $totalDuration += $video->duration_seconds;
                            $prog = $matchingProgress->get($video->id);
                            if ($prog) {
                                $watchedSeconds += $prog->watched_seconds;
                            }
                        }
                    }
                } else {
                    foreach ($course->units as $unit) {
                        foreach ($unit->lessons as $lesson) {
                            foreach ($lesson->videos as $video) {
                                $totalDuration += $video->duration_seconds;
                                $prog = $matchingProgress->get($video->id);
                                if ($prog) {
                                    $watchedSeconds += $prog->watched_seconds;
                                }
                            }
                        }
                    }
                }
            } else {
                $progress = 100; // if no videos exist, mark as 100% or finished
            }

            $totalVideosCount += $totalVideos;
            $completedVideosCount += $completedVideos;

            if ($isBundle) {
                $coursesData[] = [
                    'id' => 'bundle-' . $enrollment->package_id,
                    'title' => $enrollment->package->title,
                    'description' => $enrollment->package->description,
                    'cover_image' => $enrollment->package->package_thumbnail ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
                    'subject' => 'باقة مجمعة',
                    'grade' => null,
                    'teacher' => [
                        'name' => $enrollment->package->teacher ? $enrollment->package->teacher->name : 'معلم محذوف',
                        'avatar' => $enrollment->package->teacher ? $enrollment->package->teacher->avatar : null,
                    ],
                    'progress_percentage' => $progress,
                    'total_duration_seconds' => $totalDuration,
                    'watched_seconds' => $watchedSeconds,
                    'purchase_type' => 'package',
                    'package_id' => $enrollment->package_id,
                    'lesson_id' => null,
                    'package_type' => 'bundle',
                    'package_title' => $enrollment->package->title,
                    'lesson_title' => null,
                ];
            } else {
                $coursesData[] = [
                    'id' => $course->id,
                    'title' => $enrollment->package ? $enrollment->package->title : ($enrollment->lesson ? $enrollment->lesson->title : $course->title),
                    'description' => $enrollment->package ? $enrollment->package->description : ($enrollment->lesson ? $enrollment->lesson->description : $course->description),
                    'cover_image' => ($enrollment->package && $enrollment->package->package_thumbnail) ? $enrollment->package->package_thumbnail : ($course->cover_image ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'),
                    'subject' => $course->subject,
                    'grade' => $course->grade,
                    'teacher' => [
                        'name' => $course->teacher ? $course->teacher->name : 'معلم محذوف',
                        'avatar' => $course->teacher ? $course->teacher->avatar : null,
                    ],
                    'progress_percentage' => $progress,
                    'total_duration_seconds' => $totalDuration,
                    'watched_seconds' => $watchedSeconds,
                    'purchase_type' => $enrollment->package_id ? 'package' : ($enrollment->lesson_id ? 'lesson' : 'course'),
                    'package_id' => $enrollment->package_id,
                    'lesson_id' => $enrollment->lesson_id,
                    'package_type' => $enrollment->package ? $enrollment->package->type : null,
                    'package_title' => $enrollment->package ? $enrollment->package->title : null,
                    'lesson_title' => $enrollment->lesson ? $enrollment->lesson->title : null,
                ];
            }
        }

        // Overall progress percentage
        $overallProgress = 0;
        if ($totalVideosCount > 0) {
            $totalSumPercentage = 0;
            $allVideosSummedCount = 0;
            foreach ($enrollments as $enrollment) {
                $course = $enrollment->course;
                $isBundle = false;
                $bundleLessons = collect();
                
                if ($enrollment->package && $enrollment->package->type === 'bundle') {
                    $isBundle = true;
                    $bundleLessons = $enrollment->package->lessons()->with('videos')->get();
                }

                if (!$course && !$isBundle) {
                    if ($enrollment->package) {
                        $course = $enrollment->package->course;
                    } elseif ($enrollment->lesson && $enrollment->lesson->unit) {
                        $course = $enrollment->lesson->unit->course;
                    }
                }
                if (!$course && !$isBundle) continue;

                $isBundledCourse = false;
                if ($course && $course->is_bundle) {
                    $isBundledCourse = true;
                    $childIds = \DB::table('course_bundle_items')->where('parent_id', $course->id)->pluck('child_id')->toArray();
                    $bundleLessons = \App\Models\Lesson::whereIn('unit_id', function($q) use ($childIds) {
                        $q->select('id')->from('units')->whereIn('course_id', $childIds);
                    })->with('videos')->get();
                }

                $contextCourseId = null;
                $contextPackageId = null;
                $contextLessonId = null;

                if ($enrollment->package_id) {
                    $contextPackageId = $enrollment->package_id;
                } elseif ($enrollment->course_id) {
                    $contextCourseId = $enrollment->course_id;
                } elseif ($enrollment->lesson_id) {
                    $contextLessonId = $enrollment->lesson_id;
                }

                $videoIds = [];
                if ($isBundle || $isBundledCourse) {
                    foreach ($bundleLessons as $lesson) {
                        foreach ($lesson->videos as $video) {
                            $videoIds[] = $video->id;
                        }
                    }
                } else {
                    foreach ($course->units as $unit) {
                        foreach ($unit->lessons as $lesson) {
                            foreach ($lesson->videos as $video) {
                                $videoIds[] = $video->id;
                            }
                        }
                    }
                }

                $matchingProgress = $progressRecords->filter(function ($prog) use ($videoIds, $contextCourseId, $contextPackageId) {
                    return in_array($prog->video_id, $videoIds) &&
                           $prog->course_id == $contextCourseId &&
                           $prog->package_id == $contextPackageId;
                })->keyBy('video_id');

                $courseProgress = $matchingProgress;
                $totalSumPercentage += $courseProgress->sum('watched_percentage');
                $allVideosSummedCount += count($videoIds);
            }
            $overallProgress = min(100, round($totalSumPercentage / max(1, $allVideosSummedCount)));
        } elseif (count($enrollments) > 0) {
            $overallProgress = 100;
        }

        // Recent lessons within enrolled courses
        $directEnrolledCourseIds = Enrollment::where('student_id', $user->id)
            ->whereNotNull('course_id')
            ->pluck('course_id');

        $bundleChildCourseIds = \DB::table('course_bundle_items')
            ->whereIn('parent_id', $directEnrolledCourseIds)
            ->pluck('child_id');

        $enrolledCourseIds = $directEnrolledCourseIds
            ->union($bundleChildCourseIds)
            ->union(
                Package::whereIn('id', Enrollment::where('student_id', $user->id)->whereNotNull('package_id')->pluck('package_id'))
                    ->pluck('course_id')
            )
            ->union(
                \App\Models\Lesson::whereIn('id', Enrollment::where('student_id', $user->id)->whereNotNull('lesson_id')->pluck('lesson_id'))
                    ->whereHas('unit', function($q) { $q->whereNotNull('course_id'); })
                    ->get()
                    ->pluck('unit.course_id')
            )
            ->filter()
            ->unique();

        $recentLessons = \App\Models\Lesson::whereIn('unit_id', function ($query) use ($enrolledCourseIds) {
            $query->select('id')->from('units')->whereIn('course_id', $enrolledCourseIds);
        })
        ->with('unit.course')
        ->latest()
        ->take(5)
        ->get();

        // 1. Recommended Courses based on student stage/grade (and not enrolled in yet)
        $studentGrades = $user->grades ?? [];
        if (!is_array($studentGrades)) {
            $studentGrades = [$studentGrades];
        }
        
        $recommendedCoursesQuery = Course::with('teacher')
            ->where('is_published', true)
            ->whereNotIn('id', $enrolledCourseIds);
            
        if (!empty($studentGrades)) {
            $recommendedCoursesQuery->whereIn('grade', $studentGrades);
        }
        
        $recommendedCourses = $recommendedCoursesQuery->latest()->take(3)->get();

        // 2. All exam history
        $examsHistory = StudentExam::with(['exam.lesson.unit.course'])
            ->where('student_id', $user->id)
            ->whereIn('status', ['submitted', 'graded'])
            ->latest()
            ->get();

        // Calculate Average Grade from graded exams
        $gradedAttempts = $examsHistory->filter(function ($attempt) {
            return $attempt->status === 'graded' && $attempt->score !== null;
        });
        
        $avgScoreSum = 0;
        $gradedCount = 0;
        foreach ($gradedAttempts as $attempt) {
            $maxScore = $attempt->exam->max_score ?: 100;
            $avgScoreSum += ($attempt->score / $maxScore) * 100;
            $gradedCount++;
        }
        $averageScore = $gradedCount > 0 ? round($avgScoreSum / $gradedCount, 2) : 0;

        // Statistics Summary
        $stats = [
            'enrolled_courses_count' => count($coursesData),
            'completed_lectures_count' => $completedVideosCount,
            'exams_solved_count' => $examsHistory->count(),
            'average_score' => $averageScore,
        ];

        // 3. Upcoming Exams (exams from enrolled courses that are not yet attempted)
        $lessonIds = \App\Models\Lesson::whereIn('unit_id', function ($query) use ($enrolledCourseIds) {
            $query->select('id')->from('units')->whereIn('course_id', $enrolledCourseIds);
        })->pluck('id');

        $attemptedExamIds = StudentExam::where('student_id', $user->id)
            ->pluck('exam_id')
            ->toArray();

        $upcomingExams = Exam::with('lesson.unit.course')
            ->whereIn('lesson_id', $lessonIds)
            ->whereNotIn('id', $attemptedExamIds)
            ->latest()
            ->take(5)
            ->get();

        // Split exam attempts into quizzes/monthly exams history vs homework history
        $examHistoryAttempts = [];
        $homeworkHistoryAttempts = [];

        foreach ($examsHistory as $attempt) {
            $exam = $attempt->exam;
            if (!$exam) continue;

            $maxScore = $exam->max_score ?: 100;
            $percentage = $attempt->score !== null ? round(($attempt->score / $maxScore) * 100, 2) : null;
            $item = [
                'id' => $attempt->id,
                'exam_title' => $exam->title,
                'course_title' => $exam->lesson->unit->course->title ?? 'كورس عام',
                'score' => $attempt->score,
                'max_score' => $maxScore,
                'percentage' => $percentage,
                'submitted_at' => $attempt->submitted_at,
            ];

            if ($exam->type === 'homework') {
                $homeworkHistoryAttempts[] = $item;
            } else {
                $examHistoryAttempts[] = $item;
            }
        }

        // 4. Watch history (Recently Watched)
        $watchHistory = VideoProgress::with(['video.lesson.unit.course'])
            ->where('student_id', $user->id)
            ->latest('updated_at')
            ->take(5)
            ->get()
            ->map(function ($progress) {
                return [
                    'id' => $progress->id,
                    'video_title' => $progress->video->title ?? 'فيديو محذوف',
                    'course_title' => $progress->video->lesson->unit->course->title ?? 'كورس عام',
                    'views_count' => $progress->views_count,
                    'watched_percentage' => $progress->watched_percentage,
                    'updated_at' => $progress->updated_at,
                ];
            });

        // Get all enrollments for the student
        $enrollments = Enrollment::with([
            'course.teacher',
            'course.units.lessons.videos',
            'package.course.teacher',
            'package.course.units.lessons.videos',
            'lesson.unit.course.teacher',
            'lesson.unit.course.units.lessons.videos'
        ])
            ->where('student_id', $user->id)
            ->latest()
            ->get();

        $lastWatchedItems = [];

        foreach ($enrollments as $enrollment) {
            $course = $enrollment->course;
            if (!$course) {
                if ($enrollment->package) {
                    $course = $enrollment->package->course;
                } elseif ($enrollment->lesson && $enrollment->lesson->unit) {
                    $course = $enrollment->lesson->unit->course;
                }
            }
            if (!$course) continue;

            $contextCourseId = $enrollment->course_id;
            $contextPackageId = $enrollment->package_id;

            // Get the latest VideoProgress record for this context
            $latestProgress = VideoProgress::with(['video.lesson'])
                ->where('student_id', $user->id)
                ->where('course_id', $contextCourseId)
                ->where('package_id', $contextPackageId)
                ->latest('updated_at')
                ->first();

            if ($latestProgress && $latestProgress->video && $latestProgress->video->lesson) {
                $video = $latestProgress->video;
                $purchaseType = $enrollment->package_id ? 'package' : ($enrollment->lesson_id ? 'lesson' : 'course');

                $lastWatchedItems[] = [
                    'course_id' => $course->id,
                    'course_title' => $enrollment->package ? $enrollment->package->title : ($enrollment->lesson ? $enrollment->lesson->title : $course->title),
                    'course_cover' => ($enrollment->package && $enrollment->package->package_thumbnail) ? $enrollment->package->package_thumbnail : $course->cover_image,
                    'video_id' => $video->id,
                    'video_title' => $video->title,
                    'watched_seconds' => $latestProgress->watched_seconds,
                    'duration_seconds' => $video->duration_seconds,
                    'progress_percentage' => $latestProgress->watched_percentage,
                    'lesson_id' => $video->lesson_id,
                    'package_id' => $enrollment->package_id,
                    'purchase_type' => $purchaseType,
                    'teacher_name' => $course->teacher ? $course->teacher->name : 'معلم',
                ];
            } else {
                // Fallback: get the first video of this course
                $firstVideo = null;
                if ($course->is_bundle) {
                    $childIds = \DB::table('course_bundle_items')->where('parent_id', $course->id)->pluck('child_id')->toArray();
                    $bundleLessons = \App\Models\Lesson::whereIn('unit_id', function($q) use ($childIds) {
                        $q->select('id')->from('units')->whereIn('course_id', $childIds);
                    })->with('videos')->get();
                    foreach ($bundleLessons as $lesson) {
                        if ($lesson->videos->count() > 0) {
                            $firstVideo = $lesson->videos->first();
                            break;
                        }
                    }
                } else {
                    foreach ($course->units as $unit) {
                        foreach ($unit->lessons as $lesson) {
                            if ($lesson->videos->count() > 0) {
                                $firstVideo = $lesson->videos->first();
                                break 2;
                            }
                        }
                    }
                }

                if ($firstVideo) {
                    $purchaseType = $enrollment->package_id ? 'package' : ($enrollment->lesson_id ? 'lesson' : 'course');
                    $lastWatchedItems[] = [
                        'course_id' => $course->id,
                        'course_title' => $enrollment->package ? $enrollment->package->title : ($enrollment->lesson ? $enrollment->lesson->title : $course->title),
                        'course_cover' => ($enrollment->package && $enrollment->package->package_thumbnail) ? $enrollment->package->package_thumbnail : $course->cover_image,
                        'video_id' => $firstVideo->id,
                        'video_title' => $firstVideo->title,
                        'watched_seconds' => 0,
                        'duration_seconds' => $firstVideo->duration_seconds,
                        'progress_percentage' => 0,
                        'lesson_id' => $firstVideo->lesson_id,
                        'package_id' => $enrollment->package_id,
                        'purchase_type' => $purchaseType,
                        'teacher_name' => $course->teacher ? $course->teacher->name : 'معلم',
                    ];
                }
            }
        }

        // Deduplicate the items to make sure we don't have multiple cards for the same course and package
        $lastWatchedItems = collect($lastWatchedItems)->unique(function ($item) {
            return ($item['course_id'] ?? '') . '-' . ($item['package_id'] ?? '');
        })->values()->all();

        $lastWatched = $lastWatchedItems;

        return response()->json([
            'wallet_balance' => $walletBalance,
            'courses' => $coursesData,
            'last_watched' => $lastWatched,
            'overall_progress_percentage' => $overallProgress,
            'recent_lessons' => $recentLessons,
            'recommended_courses' => $recommendedCourses,
            'stats' => $stats,
            'upcoming_exams' => $upcomingExams,
            'exam_history' => $examHistoryAttempts,
            'homework_history' => $homeworkHistoryAttempts,
            'watch_history' => $watchHistory,
        ]);
    }

    /**
     * Get detailed student profile statistics and history.
     */
    public function profileStats(Request $request)
    {
        $user = $request->user();

        // 1. Enrolled courses
        $enrollments = Enrollment::with(['course.teacher', 'course.units.lessons.videos', 'package.course.teacher', 'lesson.unit.course.teacher'])
            ->where('student_id', $user->id)
            ->latest()
            ->get();

        // Pre-fetch progress records to eliminate nested N+1 queries
        $progressRecords = VideoProgress::where('student_id', $user->id)
            ->get();

        $coursesData = [];
        $totalVideosCount = 0;
        $completedVideosCount = 0;
        $totalWatchedSeconds = $progressRecords->sum('watched_seconds');

        foreach ($enrollments as $enrollment) {
            $course = $enrollment->course;
            if (!$course) {
                if ($enrollment->package) {
                    $course = $enrollment->package->course;
                } elseif ($enrollment->lesson && $enrollment->lesson->unit) {
                    $course = $enrollment->lesson->unit->course;
                }
            }
            if (!$course) continue;

            $contextCourseId = null;
            $contextPackageId = null;
            $contextLessonId = null;

            if ($enrollment->package_id) {
                $contextPackageId = $enrollment->package_id;
            } elseif ($enrollment->course_id) {
                $contextCourseId = $enrollment->course_id;
            } elseif ($enrollment->lesson_id) {
                $contextLessonId = $enrollment->lesson_id;
            }

            $videoIds = [];
            if ($course->is_bundle) {
                $childIds = \DB::table('course_bundle_items')->where('parent_id', $course->id)->pluck('child_id')->toArray();
                $bundleLessons = \App\Models\Lesson::whereIn('unit_id', function($q) use ($childIds) {
                    $q->select('id')->from('units')->whereIn('course_id', $childIds);
                })->with('videos')->get();
                foreach ($bundleLessons as $lesson) {
                    foreach ($lesson->videos as $video) {
                        $videoIds[] = $video->id;
                    }
                }
            } else {
                foreach ($course->units as $unit) {
                    foreach ($unit->lessons as $lesson) {
                        foreach ($lesson->videos as $video) {
                            $videoIds[] = $video->id;
                        }
                    }
                }
            }

            // Filter progress records to only include this subscription context
            $matchingProgress = $progressRecords->filter(function ($prog) use ($videoIds, $contextCourseId, $contextPackageId) {
                return in_array($prog->video_id, $videoIds) &&
                       $prog->course_id == $contextCourseId &&
                       $prog->package_id == $contextPackageId;
            })->keyBy('video_id');

            $totalVideos = count($videoIds);
            $completedVideos = 0;

            if ($totalVideos > 0) {
                $courseProgress = $matchingProgress;
                $completedVideos = $courseProgress->where('completed', true)->count();
                $sumPercentage = $courseProgress->sum('watched_percentage');

                $progress = min(100, round($sumPercentage / $totalVideos));
            } else {
                $progress = 100;
            }

            $totalVideosCount += $totalVideos;
            $completedVideosCount += $completedVideos;

            $courseIdKey = $course->id;
            if ($enrollment->package && $enrollment->package->type === 'bundle') {
                $courseIdKey = 'bundle-' . $enrollment->package_id;
            } elseif ($enrollment->package) {
                $courseIdKey = 'package-' . $enrollment->package_id;
            } elseif ($enrollment->lesson_id) {
                $courseIdKey = 'lesson-' . $enrollment->lesson_id;
            }

            $coursesData[] = [
                'id' => $courseIdKey,
                'title' => $enrollment->package ? $enrollment->package->title : ($enrollment->lesson ? $enrollment->lesson->title : $course->title),
                'cover_image' => ($enrollment->package && $enrollment->package->package_thumbnail) ? $enrollment->package->package_thumbnail : ($course->cover_image ?: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'),
                'teacher_name' => $course->teacher ? $course->teacher->name : 'معلم محذوف',
                'progress_percentage' => $progress,
                'completed_lectures' => $completedVideos,
                'remaining_lectures' => max(0, $totalVideos - $completedVideos),
            ];
        }

        $coursesData = collect($coursesData)->unique('id')->values()->all();

        // 2. Exams history
        $examsHistory = StudentExam::with(['exam.lesson.unit.course'])
            ->where('student_id', $user->id)
            ->whereIn('status', ['submitted', 'graded'])
            ->latest()
            ->get()
            ->map(function ($attempt) {
                $maxScore = $attempt->exam->max_score ?: 100;
                $percentage = $attempt->score !== null ? round(($attempt->score / $maxScore) * 100, 2) : null;
                return [
                    'id' => $attempt->id,
                    'exam_title' => $attempt->exam->title,
                    'course_title' => $attempt->exam->lesson->unit->course->title ?? 'كورس عام',
                    'score' => $attempt->score,
                    'max_score' => $maxScore,
                    'percentage' => $percentage,
                    'submitted_at' => $attempt->submitted_at,
                ];
            });

        // Calculate Average Score
        $gradedAttempts = $examsHistory->filter(fn($item) => $item['percentage'] !== null);
        $averageScore = $gradedAttempts->count() > 0 ? round($gradedAttempts->avg('percentage'), 2) : 0;

        // 3. Watch history
        $watchHistory = VideoProgress::with(['video.lesson'])
            ->where('student_id', $user->id)
            ->latest('updated_at')
            ->get()
            ->map(function ($progress) {
                return [
                    'id' => $progress->id,
                    'video_title' => $progress->video->title ?? 'فيديو محذوف',
                    'views_count' => $progress->views_count,
                    'watched_percentage' => $progress->watched_percentage,
                    'updated_at' => $progress->updated_at,
                ];
            });

        // 4. Last activity date
        $lastVideoActivity = VideoProgress::where('student_id', $user->id)->latest('updated_at')->first();
        $lastExamActivity = StudentExam::where('student_id', $user->id)->latest('updated_at')->first();

        $lastActivity = null;
        if ($lastVideoActivity && $lastExamActivity) {
            $lastActivity = $lastVideoActivity->updated_at->gt($lastExamActivity->updated_at) 
                ? $lastVideoActivity->updated_at 
                : $lastExamActivity->updated_at;
        } elseif ($lastVideoActivity) {
            $lastActivity = $lastVideoActivity->updated_at;
        } elseif ($lastExamActivity) {
            $lastActivity = $lastExamActivity->updated_at;
        }

        return response()->json([
            'stats' => [
                'enrolled_courses_count' => count($coursesData),
                'completed_lectures_count' => $completedVideosCount,
                'watched_hours' => round($totalWatchedSeconds / 3600, 2),
                'exams_solved_count' => $examsHistory->count(),
                'average_score' => $averageScore,
                'last_activity' => $lastActivity,
            ],
            'courses' => $coursesData,
            'exams_history' => $examsHistory,
            'watch_history' => $watchHistory,
        ]);
    }

    /**
     * Purchase a paid exam using wallet balance.
     */
    public function purchaseExam(Request $request, $examId)
    {
        $user = $request->user();
        $exam = Exam::with('lesson.unit.course')->findOrFail($examId);

        if (!$exam->is_paid) {
            return response()->json(['message' => 'هذا الامتحان مجاني ولا يتطلب شراء.'], 422);
        }

        $lesson = $exam->lesson;
        $courseId = ($lesson && $lesson->unit) ? $lesson->unit->course_id : null;
        $teacherId = ($lesson && $lesson->unit && $lesson->unit->course) ? $lesson->unit->course->teacher_id : null;

        // Check if student has access to the lesson (either course, package, lesson, or parent bundle level)
        $hasAccess = Enrollment::where('student_id', $user->id)
            ->where(function($q) use ($courseId, $lesson) {
                // Course level
                if ($courseId) {
                    $q->where(function($q2) use ($courseId) {
                        $q2->where('course_id', $courseId)->whereNull('package_id')->whereNull('lesson_id');
                    });
                }
                // Lesson level
                if ($lesson) {
                    $q->orWhere('lesson_id', $lesson->id);
                    // Package level (if the package contains the lesson)
                    $q->orWhereIn('package_id', function($subQuery) use ($lesson) {
                        $subQuery->select('package_id')
                            ->from('package_lessons')
                            ->where('lesson_id', $lesson->id);
                    });
                }
                // Parent bundle level
                if ($courseId) {
                    $q->orWhereIn('course_id', function($subQuery) use ($courseId) {
                        $subQuery->select('parent_id')
                            ->from('course_bundle_items')
                            ->where('child_id', $courseId);
                    });
                }
            })
            ->exists();

        if (!$hasAccess) {
            return response()->json(['message' => 'يجب عليك الاشتراك في الكورس أو الباقة أو المحاضرة أولاً.'], 403);
        }

        return DB::transaction(function () use ($exam, $user, $courseId, $lesson, $teacherId) {
            $wallet = Wallet::where('student_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                $wallet = Wallet::create(['student_id' => $user->id, 'balance' => 0.00]);
            }

            // Check if already purchased under lock
            $alreadyPurchased = \App\Models\ExamPurchase::where('student_id', $user->id)
                ->where('exam_id', $exam->id)
                ->exists();

            if ($alreadyPurchased) {
                return response()->json(['message' => 'لقد قمت بشراء هذا الامتحان مسبقاً.'], 422);
            }

            if ($wallet->balance < $exam->price) {
                return response()->json(['message' => 'رصيد المحفظة غير كافٍ لشراء الامتحان. يرجى شحن المحفظة أولاً.'], 422);
            }

            $wallet->balance -= $exam->price;
            $wallet->save();

            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'type' => 'purchase',
                'amount' => $exam->price,
                'description' => 'شراء امتحان: ' . $exam->title,
                'reference_id' => $exam->id,
            ]);

            \App\Models\ExamPurchase::create([
                'student_id' => $user->id,
                'exam_id' => $exam->id,
                'purchased_at' => Carbon::now(),
            ]);

            // Split revenue through standard RevenueSharingService
            if ($teacherId) {
                \App\Services\RevenueSharingService::handlePurchase(
                    $user->id,
                    $teacherId,
                    $exam->price,
                    $courseId,
                    null,
                    $lesson ? $lesson->id : null,
                    null,
                    'wallet',
                    $exam->id,
                    $exam->price,
                    0.00
                );
            }

            return response()->json([
                'message' => 'تم شراء الامتحان بنجاح.',
                'balance' => $wallet->balance,
            ]);
        });
    }

    /**
     * Update student profile.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'phone' => 'required|string',
            'parent_phone' => 'required|string',
            'grade' => 'required|string|max:100',
            'student_type' => 'nullable|string|in:online,center',
        ]);

        $user->name = $request->name;
        $user->email = $request->email;
        $user->phone = $request->phone;
        $user->parent_phone = $request->parent_phone;
        $user->grades = [$request->grade];
        if ($request->has('student_type')) {
            $user->student_type = $request->student_type;
        }
        $user->save();

        return response()->json([
            'user' => $user,
            'message' => 'تم تحديث بيانات الملف الشخصي بنجاح.',
        ]);
    }

    /**
     * Check if a teacher has remaining student slots for subscription.
     */
    private function checkTeacherCapacity($studentId, $teacherId)
    {
        // Check if student is already enrolled in any of this teacher's courses
        $courseIds = \App\Models\Course::where('teacher_id', $teacherId)->pluck('id');
        $alreadyEnrolled = \App\Models\Enrollment::where('student_id', $studentId)
            ->whereIn('course_id', $courseIds)
            ->exists();

        if ($alreadyEnrolled) {
            return true;
        }

        // Fetch teacher subscription
        $subscription = \App\Models\TeacherSubscription::where('teacher_id', $teacherId)->first();
        if (!$subscription) {
            // Create Starter subscription dynamically
            $starter = \App\Models\SubscriptionPlan::where('name', 'Starter')->first();
            $subscription = \App\Models\TeacherSubscription::create([
                'teacher_id' => $teacherId,
                'plan_id' => $starter ? $starter->id : 1,
                'start_date' => Carbon::now()->toDateString(),
                'end_date' => Carbon::now()->addDays(30)->toDateString(),
                'status' => 'Active',
                'used_storage_bytes' => 0,
                'used_codes' => 0,
                'billing_period' => 'monthly',
            ]);
        }

        // Check if expired or suspended
        $today = Carbon::today();
        $endDate = Carbon::parse($subscription->end_date);
        if ($today->gt($endDate) || $subscription->status === 'Expired' || $subscription->status === 'Suspended') {
            return 'subscription_expired';
        }

        // Validate capacity
        if ($subscription->remaining_codes !== null && $subscription->remaining_codes <= 0) {
            return false;
        }

        return true;
    }

    /**
     * Get recommended courses for student based on educational stage.
     */
    public function recommendedCourses(Request $request)
    {
        $user = $request->user();
        $studentGrades = $user->grades ?? [];
        if (!is_array($studentGrades)) {
            $studentGrades = [$studentGrades];
        }
        
        $studentGrade = !empty($studentGrades) ? $studentGrades[0] : null;
        $cacheKey = 'recommended_courses_' . ($studentGrade ?? 'none');

        $data = \Cache::remember($cacheKey, 300, function() use ($studentGrade) {
            $eagerRelations = [
                'teacher',
                'childCourses' => function ($q) {
                    $q->withCount(['units', 'lessons']);
                }
            ];

            $recommended = [];
            if ($studentGrade) {
                $recommended = \App\Models\Course::with($eagerRelations)
                    ->withCount(['units', 'lessons'])
                    ->where('is_published', true)
                    ->where(function($q) use ($studentGrade) {
                        $q->where('grade', $studentGrade)
                          ->orWhere(function($bq) use ($studentGrade) {
                              $bq->where('is_bundle', true)
                                 ->whereHas('childCourses', function($cq) use ($studentGrade) {
                                     $cq->where('grade', $studentGrade);
                                 });
                          });
                    })
                    ->latest()
                    ->get();
            }

            $latest = \App\Models\Course::with($eagerRelations)
                ->withCount(['units', 'lessons'])
                ->where('is_published', true)
                ->latest()
                ->take(6)
                ->get();

            $allCourses = \App\Models\Course::with($eagerRelations)
                ->withCount(['units', 'lessons'])
                ->where('is_published', true)
                ->latest()
                ->get();

            return [
                'recommended' => $recommended,
                'latest' => $latest,
                'allCourses' => $allCourses,
            ];
        });

        return response()->json($data);
    }
}
