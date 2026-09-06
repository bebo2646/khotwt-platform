<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trust all reverse proxies (Vercel, Railway, Cloudflare, Nginx) so client IP is accurately extracted
        $middleware->trustProxies(at: '*');

        $middleware->prepend(\App\Http\Middleware\AssignRequestId::class);
        $middleware->append(\App\Http\Middleware\CheckMaintenanceMode::class);
        $middleware->append(\App\Http\Middleware\SecurityMonitoringMiddleware::class);

        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            'must_change_password' => \App\Http\Middleware\EnforcePasswordChange::class,
            'permission' => \App\Http\Middleware\CheckPermission::class,
            'subscription.active' => \App\Http\Middleware\CheckSubscriptionActive::class,
            'verify_session' => \App\Http\Middleware\VerifySessionToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $status = 500;
                if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                    $status = $e->getStatusCode();
                } elseif ($e instanceof \Illuminate\Validation\ValidationException) {
                    $status = 422;
                    return response()->json([
                        'message' => $e->getMessage(),
                        'errors' => $e->errors(),
                    ], 422);
                } elseif ($e instanceof \Illuminate\Auth\AuthenticationException) {
                    $status = 401;
                } elseif ($e instanceof \Illuminate\Auth\AccessDeniedException || $e instanceof \Symfony\Component\Finder\Exception\AccessDeniedException) {
                    $status = 403;
                }

                $isDebug = config('app.debug', false);

                // Safe message without leaking internal framework/SQL details
                $message = $e->getMessage();
                if ($status === 404) {
                    $message = 'المسار المطلوب غير موجود';
                } elseif ($status === 401) {
                    $message = 'غير مصرح لك بالوصول (يرجى تسجيل الدخول)';
                } elseif ($status === 403) {
                    $message = $message ?: 'عذراً، ليس لديك الصلاحية الكافية لإجراء هذه العملية';
                } elseif ($status === 500 && !$isDebug) {
                    $message = 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً.';
                }

                $data = [
                    'message' => $message ?: 'خطأ في معالجة الطلب',
                ];

                if (method_exists($e, 'errors') && $e->errors()) {
                    $data['errors'] = $e->errors();
                }

                if ($isDebug) {
                    $data['exception'] = get_class($e);
                }

                $response = response()->json($data, $status);
                $requestId = \App\Services\SecurityMonitoringService::getRequestId($request);
                if ($requestId) {
                    $response->header('X-Request-ID', $requestId);
                }

                return $response;
            }
        });
    })->create();
