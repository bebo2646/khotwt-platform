<?php

namespace App\Http\Middleware;

use App\Services\SecurityMonitoringService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AssignRequestId
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = SecurityMonitoringService::assignRequestId($request);

        $response = $next($request);

        // Attach X-Request-ID header to response
        if (method_exists($response, 'header')) {
            $response->header('X-Request-ID', $requestId);
        } elseif (isset($response->headers)) {
            $response->headers->set('X-Request-ID', $requestId);
        }

        return $response;
    }
}
