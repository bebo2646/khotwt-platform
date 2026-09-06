<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\SecurityEvent;
use App\Models\IpSecurityBlock;
use App\Services\SecurityMonitoringService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class SecurityMonitoringTest extends TestCase
{
    protected User $admin;
    protected User $student;
    protected string $testPassword = 'TestPassword123!';

    protected function setUp(): void
    {
        parent::setUp();

        $suffix = uniqid();

        // Create Super Admin
        $this->admin = User::create([
            'name' => 'Security Admin ' . $suffix,
            'email' => "sec_admin_{$suffix}@example.com",
            'password' => Hash::make($this->testPassword),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);

        // Create Student
        $this->student = User::create([
            'name' => 'Security Student ' . $suffix,
            'email' => "sec_student_{$suffix}@example.com",
            'phone' => '010' . rand(10000000, 99999999),
            'parent_phone' => '010' . rand(10000000, 99999999),
            'password' => Hash::make($this->testPassword),
            'role' => 'student',
            'grade' => 'الثالث الثانوي',
            'student_type' => 'online',
            'status' => 'active',
        ]);
    }

    /**
     * 1. Valid API request works normally, assigns X-Request-ID, and creates 0 false-alarm security alerts.
     */
    public function test_valid_request_works_normally_without_false_alarms()
    {
        $initialCount = SecurityEvent::count();

        $response = $this->actingAs($this->admin)->getJson('/api/admin/dashboard');

        $response->assertStatus(200);
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));

        // No new security events should be created for successful requests
        $this->assertEquals($initialCount, SecurityEvent::count());
    }

    /**
     * 2. Non-existent API route returns 404 and logs unknown_route event.
     */
    public function test_unknown_api_route_returns_404_and_logs_event()
    {
        $randomPath = '/api/non-existent-endpoint-' . uniqid();
        $response = $this->getJson($randomPath);

        $response->assertStatus(404);
        $response->assertJsonStructure(['message', 'code', 'status', 'request_id']);
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));

        $this->assertDatabaseHas('security_events', [
            'event_type' => 'unknown_route',
            'status_code' => 404,
        ]);
    }

    /**
     * 3. Unauthenticated request to protected route returns 401 and logs unauthenticated_request.
     */
    public function test_unauthenticated_request_returns_401_and_logs_event()
    {
        $response = $this->getJson('/api/admin/dashboard');

        $response->assertStatus(401);
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));

        $this->assertDatabaseHas('security_events', [
            'event_type' => 'unauthenticated_request',
            'status_code' => 401,
        ]);
    }

    /**
     * 4. Student accessing admin-only endpoint returns 403 and logs role_access_violation.
     */
    public function test_student_accessing_admin_route_returns_403_and_logs_role_violation()
    {
        $response = $this->actingAs($this->student)->getJson('/api/admin/dashboard');

        $response->assertStatus(403);
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));

        $this->assertDatabaseHas('security_events', [
            'event_type' => 'role_access_violation',
            'status_code' => 403,
            'user_id' => $this->student->id,
            'severity' => 'medium',
        ]);
    }

    /**
     * 5. Brute Force Protection:
     * Attempts 1 to 5 from the same IP fail normally with 422,
     * Attempt 6 triggers 30-minute block returning 429 with exact Arabic message.
     */
    public function test_login_brute_force_blocks_ip_on_attempt_6_for_30_minutes()
    {
        $testIp = '198.51.100.' . rand(1, 250);
        Cache::forget("ip_security_block:{$testIp}");
        IpSecurityBlock::where('ip_address', $testIp)->delete();

        // Attempts 1 to 5: should fail with validation error (422)
        for ($i = 1; $i <= 5; $i++) {
            $response = $this->withServerVariables(['REMOTE_ADDR' => $testIp])
                ->postJson('/api/login', [
                    'identifier' => 'wrong_user_' . $i . '@example.com',
                    'password' => 'WrongPassword!',
                ]);

            $response->assertStatus(422);

            $block = IpSecurityBlock::where('ip_address', $testIp)->first();
            $this->assertNotNull($block);
            $this->assertEquals($i, $block->failed_attempts);
            $this->assertFalse((bool) $block->is_blocked);
        }

        // Attempt 6: MUST trigger immediate block and return 429
        $response6 = $this->withServerVariables(['REMOTE_ADDR' => $testIp])
            ->postJson('/api/login', [
                'identifier' => 'wrong_user_6@example.com',
                'password' => 'WrongPassword!',
            ]);

        $response6->assertStatus(429);
        $response6->assertJson([
            'message' => 'تم حظر محاولات تسجيل الدخول من هذا الجهاز لمدة 30 دقيقة بسبب تكرار البيانات غير الصحيحة.',
            'code' => 'IP_TEMPORARILY_BLOCKED',
            'blocked' => true,
        ]);

        $block = IpSecurityBlock::where('ip_address', $testIp)->first();
        $this->assertNotNull($block);
        $this->assertEquals(6, $block->failed_attempts);
        $this->assertTrue((bool) $block->is_blocked);
        $this->assertNotNull($block->blocked_until);
        $this->assertTrue($block->blocked_until->gt(Carbon::now()->addMinutes(25)));

        // Verify high severity security event recorded
        $this->assertDatabaseHas('security_events', [
            'event_type' => 'login_bruteforce_block',
            'severity' => 'high',
            'status_code' => 429,
            'ip_address' => $testIp,
        ]);
    }

    /**
     * 6. While IP is blocked, login with 100% correct credentials MUST still be rejected with 429.
     */
    public function test_blocked_ip_rejects_even_valid_credentials()
    {
        $testIp = '198.51.100.' . rand(1, 250);
        Cache::forget("ip_security_block:{$testIp}");
        IpSecurityBlock::where('ip_address', $testIp)->delete();

        // Simulate IP already blocked
        IpSecurityBlock::create([
            'ip_address' => $testIp,
            'failed_attempts' => 6,
            'is_blocked' => true,
            'blocked_at' => Carbon::now(),
            'blocked_until' => Carbon::now()->addMinutes(30),
            'reason' => 'تكرار محاولات تسجيل الدخول غير الصحيحة',
        ]);
        Cache::put("ip_security_block:{$testIp}", true, 1800);

        // Attempt login with valid student credentials from blocked IP
        $response = $this->withServerVariables(['REMOTE_ADDR' => $testIp])
            ->postJson('/api/login', [
                'identifier' => $this->student->email,
                'password' => $this->testPassword,
            ]);

        $response->assertStatus(429);
        $response->assertJson([
            'message' => 'تم حظر محاولات تسجيل الدخول من هذا الجهاز لمدة 30 دقيقة بسبب تكرار البيانات غير الصحيحة.',
            'code' => 'IP_TEMPORARILY_BLOCKED',
            'blocked' => true,
        ]);

        // Security event for attempting login from blocked IP should be recorded
        $this->assertDatabaseHas('security_events', [
            'event_type' => 'blocked_ip_login_attempt',
            'ip_address' => $testIp,
            'status_code' => 429,
        ]);
    }

    /**
     * 7. After block expires (or is unblocked), valid login succeeds and resets attempts.
     */
    public function test_expired_or_unblocked_ip_allows_valid_login_and_resets()
    {
        $testIp = '198.51.100.' . rand(1, 250);
        Cache::forget("ip_security_block:{$testIp}");

        // Create expired block (blocked 35 minutes ago, expired 5 minutes ago)
        IpSecurityBlock::updateOrCreate(
            ['ip_address' => $testIp],
            [
                'failed_attempts' => 6,
                'is_blocked' => true,
                'blocked_at' => Carbon::now()->subMinutes(35),
                'blocked_until' => Carbon::now()->subMinutes(5),
            ]
        );

        // Valid login from that IP
        $response = $this->withServerVariables(['REMOTE_ADDR' => $testIp])
            ->postJson('/api/login', [
                'identifier' => $this->student->email,
                'password' => $this->testPassword,
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['token', 'user']);

        // Block should now be cleared
        $block = IpSecurityBlock::where('ip_address', $testIp)->first();
        $this->assertFalse((bool) $block->is_blocked);
        $this->assertEquals(0, $block->failed_attempts);
    }

    /**
     * 8. Admin Security Dashboard: Stats, events listing, blocked IPs, and manual unblock.
     */
    public function test_admin_security_dashboard_and_management_endpoints()
    {
        // 1. Stats endpoint
        $statsResponse = $this->actingAs($this->admin)->getJson('/api/admin/security/stats');
        $statsResponse->assertStatus(200);
        $statsResponse->assertJsonStructure([
            'events_today_count',
            'unauthorized_today_count',
            'unknown_routes_today_count',
            'rate_limits_today_count',
            'high_severity_today_count',
            'active_blocked_ips_count',
            'total_blocked_ips_count',
            'severity_breakdown',
            'recent_high_priority',
            'top_ips',
        ]);

        // 2. Events listing endpoint with filters
        $eventsResponse = $this->actingAs($this->admin)->getJson('/api/admin/security/events?severity=all');
        $eventsResponse->assertStatus(200);
        $eventsResponse->assertJsonStructure(['data', 'current_page', 'total']);

        // 3. Blocked IPs listing
        $blockedIpsResponse = $this->actingAs($this->admin)->getJson('/api/admin/security/blocked-ips');
        $blockedIpsResponse->assertStatus(200);
        $blockedIpsResponse->assertJsonStructure(['data', 'current_page', 'total']);

        // 4. Manual Unblock IP action
        $testIp = '203.0.113.' . rand(1, 250);
        $block = IpSecurityBlock::create([
            'ip_address' => $testIp,
            'failed_attempts' => 6,
            'is_blocked' => true,
            'blocked_at' => Carbon::now(),
            'blocked_until' => Carbon::now()->addMinutes(30),
        ]);
        Cache::put("ip_security_block:{$testIp}", true, 1800);

        $unblockResponse = $this->actingAs($this->admin)->postJson('/api/admin/security/unblock-ip', [
            'ip_address' => $testIp,
            'reason' => 'Admin verified user identity',
        ]);

        $unblockResponse->assertStatus(200);
        $unblockResponse->assertJson(['success' => true]);

        // Cache must be forgotten and DB unblocked
        $this->assertNull(Cache::get("ip_security_block:{$testIp}"));
        $block->refresh();
        $this->assertFalse((bool) $block->is_blocked);
    }

    /**
     * 9. Student Security Activity endpoint returns security events for specific student.
     */
    public function test_student_security_events_endpoint()
    {
        // Record a security event associated with student
        SecurityMonitoringService::recordEvent(
            'role_access_violation',
            'medium',
            request(),
            403,
            'resource',
            null,
            ['details' => 'Student unauthorized access test'],
            $this->student->id
        );

        $response = $this->actingAs($this->admin)
            ->getJson("/api/admin/students/{$this->student->id}/security-events");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'student' => ['id', 'name', 'email'],
            'events' => ['data', 'total'],
        ]);

        $this->assertGreaterThanOrEqual(1, $response->json('events.total'));
    }

    /**
     * 10. Metadata Sanitization: Sensitive keys (password, token, secret) must NEVER be persisted.
     */
    public function test_sensitive_metadata_is_always_redacted()
    {
        $dirtyMetadata = [
            'user_name' => 'Test User',
            'password' => 'super_secret_password_123',
            'password_confirmation' => 'super_secret_password_123',
            'auth_token' => 'Bearer eyJhbGciOi...',
            'card_number' => '4111222233334444',
            'safe_param' => 'harmless_value',
            'nested' => [
                'token' => 'nested_token_value',
                'description' => 'Nested safe value',
            ],
        ];

        $clean = SecurityMonitoringService::sanitizeMetadata($dirtyMetadata);

        $this->assertEquals('[REDACTED]', $clean['password']);
        $this->assertEquals('[REDACTED]', $clean['password_confirmation']);
        $this->assertEquals('[REDACTED]', $clean['auth_token']);
        $this->assertEquals('[REDACTED]', $clean['card_number']);
        $this->assertEquals('harmless_value', $clean['safe_param']);
        $this->assertEquals('[REDACTED]', $clean['nested']['token']);
        $this->assertEquals('Nested safe value', $clean['nested']['description']);
    }
}
