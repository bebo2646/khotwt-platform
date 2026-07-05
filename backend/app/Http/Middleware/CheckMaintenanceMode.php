<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\PlatformSetting;

class CheckMaintenanceMode
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $settings = PlatformSetting::first();

        if ($settings && $settings->maintenance_mode) {
            $user = $request->user();

            // If user is NOT authenticated: allow request
            if (!$user) {
                return $next($request);
            }

            // If authenticated user is Super Admin: allow request
            if ($user->is_super_admin || $user->is_super) {
                return $next($request);
            }

            // If authenticated user is Teacher or Student: return 503
            return response()->json([
                'maintenance' => true,
                'message' => $settings->maintenance_message ?? 'نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة.',
                'eta' => $settings->maintenance_eta
            ], 503);
        }

        return $next($request);
    }
}
