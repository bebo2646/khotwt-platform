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
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (!$user) {
            \Illuminate\Support\Facades\Log::info('CheckPermission: Unauthenticated request');
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->status === 'disabled') {
            return response()->json(['message' => 'Your account has been deactivated. Please contact support.'], 403);
        }

        if ($user->is_super_admin || $user->is_super) {
            return $next($request);
        }

        // Verify if user is admin
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'عذراً، هذا الإجراء متاح فقط للمشرفين.'], 403);
        }

        // Flatten comma or pipe separated permissions
        $flatPermissions = [];
        foreach ($permissions as $p) {
            foreach (preg_split('/[,|]/', $p) as $single) {
                $trimmed = trim($single);
                if ($trimmed !== '') {
                    $flatPermissions[] = $trimmed;
                }
            }
        }

        // Check if user has at least one matching permission
        $hasAccess = false;
        foreach ($flatPermissions as $permission) {
            if ($user->hasPermission($permission)) {
                $hasAccess = true;
                break;
            }
        }

        \Illuminate\Support\Facades\Log::info('CheckPermission debug info:', [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'is_super_admin' => $user->is_super_admin,
            'is_super' => $user->is_super,
            'requested_permissions' => $flatPermissions,
            'is_admin' => $user->isAdmin(),
            'has_access' => $hasAccess,
        ]);

        if (!$hasAccess) {
            return response()->json(['message' => 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية.'], 403);
        }

        return $next($request);
    }
}
