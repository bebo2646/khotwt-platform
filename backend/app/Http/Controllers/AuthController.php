<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    /**
     * Register a new student.
     */
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|unique:users|max:255',
            'password' => 'required|string|min:6',
            'phone' => 'required|string',
            'parent_phone' => 'required|string',
            'grade' => 'required|string|in:first_preparatory,second_preparatory,third_preparatory,first_secondary,second_secondary,third_secondary',
            'student_type' => 'required|string|in:online,center',
        ]);

        $phone = $request->phone;
        $parentPhone = $request->parent_phone;
        
        $normalize = function ($num) {
            if (!$num) return '';
            $clean = preg_replace('/\D/', '', $num);
            if (strpos($clean, '00201') === 0 && strlen($clean) === 14) {
                $clean = substr($clean, 4);
            } elseif (strpos($clean, '201') === 0 && strlen($clean) === 12) {
                $clean = substr($clean, 2);
            } elseif (strpos($clean, '01') === 0 && strlen($clean) === 11) {
                $clean = substr($clean, 1);
            } elseif (strpos($clean, '0') === 0) {
                $clean = substr($clean, 1);
            }
            return $clean;
        };

        if ($normalize($phone) === $normalize($parentPhone)) {
            throw ValidationException::withMessages([
                'parent_phone' => ["The student's phone number cannot be the same as the parent's phone number."],
            ]);
        }

        $settings = \App\Models\PlatformSetting::first();
        $requireApproval = $settings ? (bool)$settings->require_student_approval : false;

        $student = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'student',
            'phone' => $request->phone,
            'parent_phone' => $request->parent_phone,
            'status' => $requireApproval ? 'pending' : 'active',
            'grades' => [$request->grade],
            'student_type' => $request->student_type,
        ]);

        // Auto create wallet for the student
        Wallet::create([
            'student_id' => $student->id,
            'balance' => 0.00,
        ]);

        if ($student->status === 'pending') {
            return response()->json([
                'status' => 'pending',
                'message' => 'سيتم مراجعة بياناتك خلال 24 ساعة للتحقق من صحتها.',
                'user' => $student,
            ], 201);
        }

        $sessionToken = \Illuminate\Support\Str::random(40);
        $currentSessionToken = (string) \Illuminate\Support\Str::uuid();
        $student->update([
            'session_token' => $sessionToken,
            'device_id' => substr($request->header('User-Agent') . ' (' . $request->ip() . ')', 0, 255),
            'last_activity' => now(),
            'current_session_token' => $currentSessionToken,
        ]);

        $token = $student->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $student,
            'token' => $token,
            'session_token' => $currentSessionToken,
            'current_session_token' => $currentSessionToken,
        ], 201);
    }

    /**
     * Log in a user (Admin, Teacher, or Student) by Registered Email or Registered Student Phone Number.
     */
    public function login(Request $request)
    {
        $request->validate([
            'identifier' => 'nullable|string',
            'email' => 'nullable|string',
            'password' => 'required|string',
        ], [
            'password.required' => 'كلمة المرور مطلوبة.',
        ]);

        $rawIdentifier = $request->input('identifier') ?? $request->input('email');
        if ($rawIdentifier === null || trim((string)$rawIdentifier) === '') {
            throw ValidationException::withMessages([
                'identifier' => ['يرجى إدخال البريد الإلكتروني أو رقم الطالب.'],
            ]);
        }

        // Convert Arabic/Eastern-Arabic digits (٠-٩) to standard ASCII digits (0-9) and trim
        $identifier = trim((string)$rawIdentifier);
        $arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        $identifier = str_replace($arabicDigits, $englishDigits, $identifier);

        $ip = $request->ip();
        $throttleKey = 'login_attempts:' . \Illuminate\Support\Str::lower($identifier) . '|' . $ip;
        $errorField = $request->has('identifier') ? 'identifier' : 'email';

        if (RateLimiter::tooManyAttempts($throttleKey, 10)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            $minutes = ceil($seconds / 60);
            throw ValidationException::withMessages([
                $errorField => ["محاولات تسجيل دخول كثيرة جداً. يرجى المحاولة بعد {$minutes} دقيقة."],
            ]);
        }

        // Determine identifier type & search user in database:
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL) || str_contains($identifier, '@')) {
            // Case 1: Email matching (case-insensitive)
            $user = User::whereRaw('LOWER(email) = ?', [strtolower($identifier)])->first();
        } else {
            // Case 2: Phone number / Student Number matching (strictly registered phone)
            $cleanDigits = preg_replace('/\D/', '', $identifier);
            
            $normalizedDigits = $cleanDigits;
            if (str_starts_with($cleanDigits, '0020') && strlen($cleanDigits) === 14) {
                $normalizedDigits = '0' . substr($cleanDigits, 4);
            } elseif (str_starts_with($cleanDigits, '20') && strlen($cleanDigits) === 12) {
                $normalizedDigits = '0' . substr($cleanDigits, 2);
            } elseif (strlen($cleanDigits) === 10 && in_array(substr($cleanDigits, 0, 2), ['10', '11', '12', '15'])) {
                $normalizedDigits = '0' . $cleanDigits;
            }

            $core10 = (strlen($normalizedDigits) === 11 && str_starts_with($normalizedDigits, '0')) 
                ? substr($normalizedDigits, 1) 
                : $normalizedDigits;

            // Build all Egyptian and international phone variations
            $phoneVariations = array_unique(array_filter([
                $identifier,
                $cleanDigits,
                $normalizedDigits,
                $core10,
                !empty($core10) ? '0' . $core10 : null,
                !empty($core10) ? '+20' . $core10 : null,
                !empty($core10) ? '20' . $core10 : null,
                !empty($core10) ? '+2' . $core10 : null,
                !empty($core10) ? '2' . $core10 : null,
                !empty($core10) ? '0020' . $core10 : null,
            ]));

            $user = User::where(function ($query) use ($identifier, $phoneVariations) {
                $query->whereIn('phone', $phoneVariations)
                    ->orWhereRaw('LOWER(email) = ?', [strtolower($identifier)]);
            })->first();
        }

        // CASE 1 — ACCOUNT DOES NOT EXIST:
        if (!$user) {
            RateLimiter::hit($throttleKey, 1800); // 30 minutes
            throw ValidationException::withMessages([
                $errorField => ['هذا الحساب غير موجود'],
            ]);
        }

        // CASE 2 — ACCOUNT EXISTS BUT PASSWORD IS WRONG:
        if (!Hash::check($request->password, $user->password)) {
            RateLimiter::hit($throttleKey, 1800); // 30 minutes
            throw ValidationException::withMessages([
                'password' => ['كلمة المرور غير صحيحة'],
            ]);
        }

        // CASE 3 — VALID LOGIN:
        RateLimiter::clear($throttleKey);

        if ($user->status === 'disabled') {
            return response()->json(['message' => 'تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة.'], 403);
        }

        if ($user->role === 'student') {
            if ($user->status === 'pending') {
                return response()->json([
                    'status' => 'pending',
                    'message' => 'حسابك قيد المراجعة.',
                ], 403);
            }

            if ($user->status === 'rejected') {
                return response()->json([
                    'status' => 'rejected',
                    'message' => 'تم رفض الحساب.',
                    'rejection_reason' => $user->rejection_reason ?? 'لا يوجد سبب محدد',
                ], 403);
            }
        }

        // Deactivate previous sessions: delete existing Sanctum tokens
        $user->tokens()->delete();

        $sessionToken = \Illuminate\Support\Str::random(40);
        $currentSessionToken = (string) \Illuminate\Support\Str::uuid();
        $user->update([
            'session_token' => $sessionToken,
            'device_id' => substr($request->header('User-Agent') . ' (' . $request->ip() . ')', 0, 255),
            'last_activity' => now(),
            'current_session_token' => $currentSessionToken,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
            'session_token' => $currentSessionToken,
            'current_session_token' => $currentSessionToken,
        ]);
    }

    /**
     * Log out the authenticated user.
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            $user->update([
                'current_session_token' => null
            ]);
            $user->currentAccessToken()->delete();
        }

        return response()->json(['message' => 'تم تسجيل الخروج بنجاح.']);
    }

    /**
     * Get the authenticated user.
     */
    public function me(Request $request)
    {
        $user = $request->user();
        if ($user->isStudent()) {
            $user->load('wallet');
        }
        return response()->json($user);
    }

    /**
     * Force or allow changing the user's password.
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();
        
        $rules = [
            'password' => 'required|string|min:6|confirmed',
        ];
        
        if (!$user->must_change_password) {
            $rules['current_password'] = 'required|string';
        }
        
        $request->validate($rules);
        
        if (!$user->must_change_password) {
            if (!Hash::check($request->current_password, $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['كلمة المرور الحالية غير صحيحة.'],
                ]);
            }
        }

        $user->password = Hash::make($request->password);
        $user->must_change_password = false;
        $user->save();

        return response()->json([
            'user' => $user,
            'message' => 'تم تغيير كلمة المرور بنجاح.',
        ]);
    }

    /**
     * Check session token validity.
     */
    public function checkSession(Request $request)
    {
        $user = $request->user();
        $sessionToken = $request->header('X-Session-Token');

        $valid = $user && $user->current_session_token && ($sessionToken === $user->current_session_token);

        return response()->json([
            'valid' => (bool)$valid
        ]);
    }

    /**
     * Delete a rejected student account.
     */
    public function deleteRejectedAccount(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email',
        ]);
        
        $user = User::where('email', $request->email)->where('status', 'rejected')->first();
        if ($user) {
            // Delete Sanctum tokens
            $user->tokens()->delete();
            // Delete wallet
            Wallet::where('student_id', $user->id)->delete();
            // Delete view limits
            \App\Models\StudentCourseViewLimit::where('student_id', $user->id)->delete();
            // Delete view sessions
            \App\Models\VideoViewSession::where('student_id', $user->id)->delete();
            // Delete user itself
            $user->delete();
            
            return response()->json(['message' => 'Account deleted successfully']);
        }
        return response()->json(['message' => 'No rejected account found'], 404);
    }
}
