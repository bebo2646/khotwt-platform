<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforcePasswordChange
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            // Allow password change and logout requests only
            if (!$request->is('api/change-password') && !$request->is('api/logout')) {
                return response()->json([
                    'must_change_password' => true,
                    'message' => 'You must change your temporary password before accessing the system.'
                ], 403);
            }
        }

        return $next($request);
    }
}
