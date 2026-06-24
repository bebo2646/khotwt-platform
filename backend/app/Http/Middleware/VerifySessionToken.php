<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySessionToken
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            $sessionToken = $request->header('X-Session-Token');

            if ($user->current_session_token && $sessionToken !== $user->current_session_token) {
                // Invalidate the current Sanctum token immediately
                $user->currentAccessToken()->delete();

                return response()->json([
                    'message' => 'تم تسجيل الدخول من جهاز آخر.',
                    'code' => 'SESSION_EXPIRED',
                    'session_invalid' => true
                ], 401); // 401 Unauthorized
            }

            // Update last activity
            $user->update([
                'last_activity' => now()
            ]);
        }

        return $next($request);
    }
}
