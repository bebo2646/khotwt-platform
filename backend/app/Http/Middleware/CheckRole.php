<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            \Illuminate\Support\Facades\Log::info('CheckRole: Unauthenticated request');
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        \Illuminate\Support\Facades\Log::info('CheckRole debug info:', [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'is_super_admin' => $user->is_super_admin,
            'is_super' => $user->is_super,
            'requested_roles' => $roles,
            'has_role' => in_array($user->role, $roles),
        ]);

        if ($user->is_super_admin || $user->is_super) {
            return $next($request);
        }

        if (!in_array($user->role, $roles)) {
            return response()->json(['message' => 'Unauthorized. This action requires specific permissions.'], 403);
        }

        if ($user->status === 'disabled') {
            return response()->json(['message' => 'Your account has been deactivated. Please contact support.'], 403);
        }

        return $next($request);
    }
}
