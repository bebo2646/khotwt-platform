<?php

namespace App\Http\Middleware;

use App\Services\SecurityMonitoringService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityMonitoringMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only inspect API requests
        if ($request->is('api/*')) {
            try {
                $status = $response->getStatusCode();

                if ($status === 401) {
                    $hasToken = $request->bearerToken() || $request->header('Authorization');
                    $eventType = $hasToken ? 'invalid_authentication' : 'unauthenticated_request';
                    SecurityMonitoringService::recordEvent(
                        $eventType,
                        'low',
                        $request,
                        401,
                        'api_auth',
                        null,
                        [
                            'has_token' => !empty($hasToken),
                            'path' => $request->path(),
                        ]
                    );
                } elseif ($status === 403) {
                    SecurityMonitoringService::logUnauthorizedAccess($request, 403);
                } elseif ($status === 429) {
                    SecurityMonitoringService::logRateLimit($request, $request->path());
                } elseif ($status === 404) {
                    SecurityMonitoringService::logUnknownRoute($request);
                }
            } catch (\Throwable $e) {
                // Non-blocking
            }
        }

        return $response;
    }
}
