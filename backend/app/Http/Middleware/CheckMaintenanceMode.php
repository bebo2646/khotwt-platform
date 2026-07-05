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
            // Exempt the config and authentication endpoints from the middleware block.
            // Authentication routes will be checked inside AuthController to verify if the user is a Super Admin.
            if ($request->is('api/config') || $request->is('api/login') || $request->is('api/register')) {
                return $next($request);
            }

            $user = $request->user();
            if ($user && ($user->is_super_admin || $user->is_super)) {
                return $next($request);
            }

            return response()->json([
                'maintenance' => true,
                'message' => $settings->maintenance_message ?? 'نعتذر لكم، يتم حالياً إجراء تحديثات لتحسين المنصة.',
                'eta' => $settings->maintenance_eta
            ], 503);
        }

        return $next($request);
    }
}
