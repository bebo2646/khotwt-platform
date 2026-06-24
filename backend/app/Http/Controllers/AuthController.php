<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

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
        ]);

        $student = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'student',
            'phone' => $request->phone,
            'parent_phone' => $request->parent_phone,
            'status' => 'active',
            'grades' => [$request->grade],
        ]);

        // Auto create wallet for the student
        Wallet::create([
            'student_id' => $student->id,
            'balance' => 0.00,
        ]);

        $sessionToken = \Illuminate\Support\Str::random(40);
        $student->update([
            'session_token' => $sessionToken,
            'device_id' => substr($request->header('User-Agent') . ' (' . $request->ip() . ')', 0, 255),
            'last_activity' => now(),
        ]);

        $token = $student->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $student,
            'token' => $token,
            'session_token' => $sessionToken,
        ], 201);
    }

    /**
     * Log in a user (Admin, Teacher, or Student).
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['بيانات الاعتماد المدخلة غير صحيحة.'],
            ]);
        }

        if ($user->status === 'disabled') {
            return response()->json(['message' => 'تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة.'], 403);
        }

        // Deactivate previous sessions: delete existing Sanctum tokens
        $user->tokens()->delete();

        $sessionToken = \Illuminate\Support\Str::random(40);
        $user->update([
            'session_token' => $sessionToken,
            'device_id' => substr($request->header('User-Agent') . ' (' . $request->ip() . ')', 0, 255),
            'last_activity' => now(),
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
            'session_token' => $sessionToken,
        ]);
    }

    /**
     * Log out the authenticated user.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

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
}
