<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (!$user) {
            \Illuminate\Support\Facades\Log::info('CheckPermission: Unauthenticated request');
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        \Illuminate\Support\Facades\Log::info('CheckPermission debug info:', [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'is_super_admin' => $user->is_super_admin,
            'is_super' => $user->is_super,
            'requested_permission' => $permission,
            'is_admin' => $user->isAdmin(),
            'has_permission' => $user->hasPermission($permission),
        ]);

        if ($user->status === 'disabled') {
            return response()->json(['message' => 'Your account has been deactivated. Please contact support.'], 403);
        }

        if ($user->is_super_admin || $user->is_super) {
            return $next($request);
        }

        // Verify if user is admin and has permission
        if (!$user->isAdmin() || !$user->hasPermission($permission)) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        return $next($request);
    }
}
