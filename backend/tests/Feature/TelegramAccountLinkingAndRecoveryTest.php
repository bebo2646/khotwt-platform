<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\TelegramUser;
use App\Models\TelegramLinkToken;
use App\Models\TelegramPasswordReset;
use App\Models\GuardianStudentRelation;
use App\Services\TelegramService;
use App\Services\TelegramUpdateProcessor;
use App\Services\TelegramPhoneService;
use App\Services\TelegramGuardianService;
use App\Services\TelegramPasswordRecoveryService;
use App\Services\ConversationStateEngine;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TelegramAccountLinkingAndRecoveryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Config::set('services.telegram.bot_token', '123456789:ABCDefGhIJKlmNoPQRstuvWXyz');
        Config::set('services.telegram.bot_username', 'khatwtk_edu_bot');
        Config::set('services.telegram.official_frontend_domain', 'https://manst-khatwtak.vercel.app');
        Config::set('queue.default', 'sync');
        RateLimiter::clear('tg_recovery:999001');
        RateLimiter::clear('tg_recovery:999002');
        RateLimiter::clear('tg_link_token:1');
    }

    /**
     * Test 1: Authenticated user can generate a link token and valid deep link.
     */
    public function test_authenticated_user_can_generate_link_token(): void
    {
        $user = User::factory()->create([
            'role' => 'student',
            'status' => 'active',
        ]);

        $response = $this->actingAs($user)->postJson('/api/telegram/link-token');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'deep_link',
                'expires_at',
                'expires_in_seconds',
            ]);

        $this->assertTrue($response['success']);
        $this->assertStringContainsString('https://t.me/khatwtk_edu_bot?start=link_', $response['deep_link']);

        $tokenHash = TelegramLinkToken::where('user_id', $user->id)->first();
        $this->assertNotNull($tokenHash);
        $this->assertTrue($tokenHash->isValid());
    }

    /**
     * Test 2: Telegram Bot /start link_<token> successfully links platform account.
     */
    public function test_telegram_bot_links_account_via_valid_deep_link(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create([
            'role' => 'student',
            'name' => 'أحمد محمود',
            'status' => 'active',
        ]);

        $plainToken = bin2hex(random_bytes(32));
        $linkToken = TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        $processor = app(TelegramUpdateProcessor::class);
        $processor->process([
            'update_id' => 101,
            'message' => [
                'message_id' => 1,
                'chat' => ['id' => 999111, 'type' => 'private'],
                'from' => ['id' => 999111, 'username' => 'ahmed_tg'],
                'text' => "/start link_{$plainToken}",
            ],
        ]);

        $linkToken->refresh();
        $this->assertNotNull($linkToken->used_at);

        $tgUser = TelegramUser::where('telegram_user_id', 999111)->first();
        $this->assertNotNull($tgUser);
        $this->assertTrue($tgUser->is_linked);
        $this->assertEquals($user->id, $tgUser->user_id);
        $this->assertEquals('student', $tgUser->role);
    }

    /**
     * Test 3: Telegram Bot rejects expired or already used link tokens.
     */
    public function test_telegram_bot_rejects_expired_or_used_link_token(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create(['role' => 'student']);

        // Expired token
        $expiredToken = bin2hex(random_bytes(32));
        TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $expiredToken),
            'expires_at' => Carbon::now()->subMinutes(5),
        ]);

        $processor = app(TelegramUpdateProcessor::class);
        $processor->process([
            'update_id' => 102,
            'message' => [
                'message_id' => 2,
                'chat' => ['id' => 999112, 'type' => 'private'],
                'from' => ['id' => 999112],
                'text' => "/start link_{$expiredToken}",
            ],
        ]);

        $tgUser = TelegramUser::where('telegram_user_id', 999112)->first();
        $this->assertFalse($tgUser->is_linked);
        $this->assertNull($tgUser->user_id);
    }

    /**
     * Test 4: Cannot link one active Telegram account to multiple platform users.
     */
    public function test_cannot_link_telegram_account_to_multiple_platform_users(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user1 = User::factory()->create(['role' => 'student']);
        $user2 = User::factory()->create(['role' => 'student']);

        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999113,
            'telegram_chat_id' => 999113,
            'user_id' => $user1->id,
            'is_linked' => true,
            'role' => 'student',
        ]);

        $tokenForUser2 = bin2hex(random_bytes(32));
        TelegramLinkToken::create([
            'user_id' => $user2->id,
            'token_hash' => hash('sha256', $tokenForUser2),
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        $processor = app(TelegramUpdateProcessor::class);
        $processor->process([
            'update_id' => 103,
            'message' => [
                'message_id' => 3,
                'chat' => ['id' => 999113, 'type' => 'private'],
                'from' => ['id' => 999113],
                'text' => "/start link_{$tokenForUser2}",
            ],
        ]);

        $tgUser->refresh();
        $this->assertEquals($user1->id, $tgUser->user_id); // Still linked to user1, user2 rejected
    }

    /**
     * Test 5: Cannot link one Khotwtk user to multiple active Telegram accounts.
     */
    public function test_cannot_link_khotwtk_user_to_multiple_active_telegram_accounts(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create(['role' => 'student']);

        // First Telegram account linked
        TelegramUser::create([
            'telegram_user_id' => 999114,
            'telegram_chat_id' => 999114,
            'user_id' => $user->id,
            'is_linked' => true,
            'role' => 'student',
        ]);

        // Second Telegram account tries to link with a new token for the same user
        $plainToken = bin2hex(random_bytes(32));
        TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        $processor = app(TelegramUpdateProcessor::class);
        $processor->process([
            'update_id' => 104,
            'message' => [
                'message_id' => 4,
                'chat' => ['id' => 999115, 'type' => 'private'],
                'from' => ['id' => 999115],
                'text' => "/start link_{$plainToken}",
            ],
        ]);

        $secondTgUser = TelegramUser::where('telegram_user_id', 999115)->first();
        $this->assertFalse($secondTgUser->is_linked);
        $this->assertNull($secondTgUser->user_id);
    }

    /**
     * Test 6: Unlinking and relinking succeeds cleanly.
     */
    public function test_unlinking_and_relinking_succeeds_cleanly(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create(['role' => 'student']);
        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999116,
            'telegram_chat_id' => 999116,
            'user_id' => $user->id,
            'is_linked' => true,
            'role' => 'student',
        ]);

        // Unlink via bot command /unlink
        $processor = app(TelegramUpdateProcessor::class);
        $processor->process([
            'update_id' => 105,
            'message' => [
                'message_id' => 5,
                'chat' => ['id' => 999116, 'type' => 'private'],
                'from' => ['id' => 999116],
                'text' => "/unlink",
            ],
        ]);

        $tgUser->refresh();
        $this->assertFalse($tgUser->is_linked);
        $this->assertNull($tgUser->user_id);

        // Relink with a fresh token
        $relinkToken = bin2hex(random_bytes(32));
        TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $relinkToken),
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        $processor->process([
            'update_id' => 106,
            'message' => [
                'message_id' => 6,
                'chat' => ['id' => 999116, 'type' => 'private'],
                'from' => ['id' => 999116],
                'text' => "/start link_{$relinkToken}",
            ],
        ]);

        $tgUser->refresh();
        $this->assertTrue($tgUser->is_linked);
        $this->assertEquals($user->id, $tgUser->user_id);
    }

    /**
     * Test 7: Phone recovery rejects spoofed contact (contact.user_id != message.from.id).
     */
    public function test_phone_recovery_rejects_spoofed_contact(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create([
            'role' => 'student',
            'phone' => '01012345678',
            'status' => 'active',
        ]);

        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999001,
            'telegram_chat_id' => 999001,
            'is_linked' => false,
        ]);

        $stateEngine = app(ConversationStateEngine::class);
        $stateEngine->setState($tgUser, ConversationStateEngine::STATE_AWAITING_RECOVERY_CONTACT);

        // Contact has user_id = 888888, but message.from.id = 999001
        $processor = app(TelegramUpdateProcessor::class);
        $processor->process([
            'update_id' => 107,
            'message' => [
                'message_id' => 7,
                'chat' => ['id' => 999001, 'type' => 'private'],
                'from' => ['id' => 999001],
                'contact' => [
                    'phone_number' => '+201012345678',
                    'first_name' => 'Attacker',
                    'user_id' => 888888, // Spoofed!
                ],
            ],
        ]);

        // Zero reset tokens created
        $this->assertEquals(0, TelegramPasswordReset::where('user_id', $user->id)->count());
    }

    /**
     * Test 8: Phone recovery rate limiting prevents brute-forcing.
     */
    public function test_phone_recovery_rate_limiting(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999002,
            'telegram_chat_id' => 999002,
            'is_linked' => false,
        ]);

        $recoveryService = app(TelegramPasswordRecoveryService::class);

        $contact = [
            'phone_number' => '01000000000',
            'user_id' => 999002,
        ];

        // 3 allowed hits
        $res1 = $recoveryService->processRecoveryContact($tgUser, $contact);
        $res2 = $recoveryService->processRecoveryContact($tgUser, $contact);
        $res3 = $recoveryService->processRecoveryContact($tgUser, $contact);

        // 4th hit should be rate limited
        $res4 = $recoveryService->processRecoveryContact($tgUser, $contact);

        $this->assertFalse($res4['success']);
        $this->assertEquals('RATE_LIMITED', $res4['error_code']);
    }

    /**
     * Test 9: Phone recovery strictly excludes Admin accounts.
     */
    public function test_phone_recovery_strictly_excludes_admin(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $admin = User::factory()->create([
            'role' => 'admin',
            'phone' => '01099998888',
            'status' => 'active',
        ]);

        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999003,
            'telegram_chat_id' => 999003,
            'is_linked' => false,
        ]);

        $recoveryService = app(TelegramPasswordRecoveryService::class);
        $result = $recoveryService->processRecoveryContact($tgUser, [
            'phone_number' => '+201099998888',
            'user_id' => 999003,
        ]);

        $this->assertFalse($result['success']);
        $this->assertEquals('ADMIN_BLOCKED', $result['error_code']);
        $this->assertEquals(0, TelegramPasswordReset::where('user_id', $admin->id)->count());
    }

    /**
     * Test 10: Phone recovery blocks cross-Telegram accounts.
     */
    public function test_phone_recovery_blocks_cross_telegram_linked_accounts(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create([
            'role' => 'student',
            'phone' => '01077776666',
            'status' => 'active',
        ]);

        // User is linked to Telegram ID 777001
        TelegramUser::create([
            'telegram_user_id' => 777001,
            'telegram_chat_id' => 777001,
            'user_id' => $user->id,
            'is_linked' => true,
        ]);

        // Attacker or different Telegram ID 777002 tries recovery
        $tgUser2 = TelegramUser::create([
            'telegram_user_id' => 777002,
            'telegram_chat_id' => 777002,
            'is_linked' => false,
        ]);

        $recoveryService = app(TelegramPasswordRecoveryService::class);
        $result = $recoveryService->processRecoveryContact($tgUser2, [
            'phone_number' => '01077776666',
            'user_id' => 777002,
        ]);

        $this->assertFalse($result['success']);
        $this->assertEquals('CROSS_LINKED', $result['error_code']);
        $this->assertEquals(0, TelegramPasswordReset::where('user_id', $user->id)->count());
    }

    /**
     * Test 11: Phone recovery matches users.phone and creates single-use reset token with URL fragment.
     */
    public function test_phone_recovery_matches_primary_phone_and_generates_token(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create([
            'role' => 'student',
            'name' => 'كريم عصام',
            'phone' => '01011112222',
            'status' => 'active',
        ]);

        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999004,
            'telegram_chat_id' => 999004,
            'is_linked' => false,
        ]);

        $recoveryService = app(TelegramPasswordRecoveryService::class);
        $result = $recoveryService->processRecoveryContact($tgUser, [
            'phone_number' => '+201011112222', // International format matching local in DB
            'user_id' => 999004,
        ]);

        $this->assertTrue($result['success']);
        $this->assertStringContainsString('https://manst-khatwtak.vercel.app/reset-password#token=', $result['reset_url']);

        $reset = TelegramPasswordReset::where('user_id', $user->id)->first();
        $this->assertNotNull($reset);
        $this->assertTrue($reset->isValid());
        $this->assertNull($reset->used_at);
    }

    /**
     * Test 12: Phone recovery does NOT match parent_phone for student account recovery.
     */
    public function test_phone_recovery_does_not_match_parent_phone_for_recovery(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $student = User::factory()->create([
            'role' => 'student',
            'phone' => '01011113333',
            'parent_phone' => '01099994444', // Guardian phone
            'status' => 'active',
        ]);

        $tgUser = TelegramUser::create([
            'telegram_user_id' => 999005,
            'telegram_chat_id' => 999005,
            'is_linked' => false,
        ]);

        $recoveryService = app(TelegramPasswordRecoveryService::class);
        // Providing parent_phone in recovery
        $result = $recoveryService->processRecoveryContact($tgUser, [
            'phone_number' => '01099994444',
            'user_id' => 999005,
        ]);

        $this->assertFalse($result['success']);
        $this->assertEquals('USER_NOT_ELIGIBLE', $result['error_code']);
    }

    /**
     * Test 13: Password Reset API updates user password and rejects reuse.
     */
    public function test_password_reset_api_updates_password_and_invalidates_token(): void
    {
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => true, 'result' => []], 200),
        ]);

        $user = User::factory()->create([
            'password' => Hash::make('old_secret_password_123'),
        ]);

        $plainToken = bin2hex(random_bytes(32));
        $resetRecord = TelegramPasswordReset::create([
            'user_id' => $user->id,
            'telegram_user_id' => 999006,
            'telegram_chat_id' => 999006,
            'verified_phone' => '01012345678',
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        // Execute reset
        $response = $this->postJson('/api/telegram/reset-password', [
            'token' => $plainToken,
            'password' => 'New_Secret_Pass_2026!',
            'password_confirmation' => 'New_Secret_Pass_2026!',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $user->refresh();
        $this->assertTrue(Hash::check('New_Secret_Pass_2026!', $user->password));

        $resetRecord->refresh();
        $this->assertNotNull($resetRecord->used_at);
        $this->assertFalse($resetRecord->isValid());

        // Reusing the token MUST be rejected
        $reuseResponse = $this->postJson('/api/telegram/reset-password', [
            'token' => $plainToken,
            'password' => 'Another_Password_999!',
            'password_confirmation' => 'Another_Password_999!',
        ]);

        $reuseResponse->assertStatus(422);
    }

    /**
     * Test 14: Guardian links to multiple students via parent_phone.
     */
    public function test_guardian_links_to_multiple_students(): void
    {
        $guardianPhone = '01088887777';

        $student1 = User::factory()->create([
            'name' => 'طالب 1',
            'role' => 'student',
            'parent_phone' => $guardianPhone,
            'status' => 'active',
        ]);

        $student2 = User::factory()->create([
            'name' => 'طالب 2',
            'role' => 'student',
            'parent_phone' => '+201088887777', // variant
            'status' => 'active',
        ]);

        $guardianTgUser = TelegramUser::create([
            'telegram_user_id' => 555001,
            'telegram_chat_id' => 555001,
            'role' => 'guest',
        ]);

        $guardianService = app(TelegramGuardianService::class);
        $result = $guardianService->linkGuardianByParentPhone($guardianTgUser, $guardianPhone);

        $this->assertTrue($result['success']);
        $this->assertEquals(2, $result['count']);

        $linkedStudents = $guardianService->getLinkedStudents($guardianTgUser);
        $this->assertCount(2, $linkedStudents);
        $this->assertTrue($linkedStudents->contains('id', $student1->id));
        $this->assertTrue($linkedStudents->contains('id', $student2->id));

        $guardianTgUser->refresh();
        $this->assertEquals('guardian', $guardianTgUser->role);
    }

    /**
     * Test 15: Guardian unauthorized student access prevention.
     */
    public function test_guardian_unauthorized_student_access_prevention(): void
    {
        $guardianTgUser = TelegramUser::create([
            'telegram_user_id' => 555002,
            'telegram_chat_id' => 555002,
            'role' => 'guardian',
        ]);

        $authorizedStudent = User::factory()->create(['role' => 'student']);
        $unauthorizedStudent = User::factory()->create(['role' => 'student']);

        GuardianStudentRelation::create([
            'guardian_telegram_account_id' => $guardianTgUser->id,
            'student_user_id' => $authorizedStudent->id,
            'verified_phone' => '01012345678',
            'status' => 'active',
        ]);

        $guardianService = app(TelegramGuardianService::class);

        $this->assertTrue($guardianService->canAccessStudent($guardianTgUser, $authorizedStudent->id));
        $this->assertFalse($guardianService->canAccessStudent($guardianTgUser, $unauthorizedStudent->id));
    }

    /**
     * Test 16: Guardian can unlink individual student independently.
     */
    public function test_guardian_can_unlink_individual_student_independently(): void
    {
        $guardianTgUser = TelegramUser::create([
            'telegram_user_id' => 555003,
            'telegram_chat_id' => 555003,
            'role' => 'guardian',
        ]);

        $student1 = User::factory()->create(['role' => 'student']);
        $student2 = User::factory()->create(['role' => 'student']);

        GuardianStudentRelation::create([
            'guardian_telegram_account_id' => $guardianTgUser->id,
            'student_user_id' => $student1->id,
            'verified_phone' => '01012345678',
            'status' => 'active',
        ]);
        GuardianStudentRelation::create([
            'guardian_telegram_account_id' => $guardianTgUser->id,
            'student_user_id' => $student2->id,
            'verified_phone' => '01012345678',
            'status' => 'active',
        ]);

        $guardianService = app(TelegramGuardianService::class);

        // Unlink student 1
        $unlinked = $guardianService->unlinkStudent($guardianTgUser, $student1->id);
        $this->assertTrue($unlinked);

        $this->assertFalse($guardianService->canAccessStudent($guardianTgUser, $student1->id));
        $this->assertTrue($guardianService->canAccessStudent($guardianTgUser, $student2->id));

        // Guardian still has student 2, so role remains guardian
        $guardianTgUser->refresh();
        $this->assertEquals('guardian', $guardianTgUser->role);

        // Unlink student 2 (no students left)
        $guardianService->unlinkStudent($guardianTgUser, $student2->id);
        $guardianTgUser->refresh();
        $this->assertEquals('guest', $guardianTgUser->role);
    }

    /**
     * Test 17: Safe handling when Telegram API fails or throws exception.
     */
    public function test_safe_handling_when_telegram_api_fails(): void
    {
        // Mock API throwing 500 server error
        Http::fake([
            'https://api.telegram.org/*' => Http::response(['ok' => false, 'description' => 'Internal Server Error'], 500),
        ]);

        $telegramService = app(TelegramService::class);
        $result = $telegramService->sendMessage(123456, 'Test safe message');

        $this->assertFalse($result['ok']);
        $this->assertArrayHasKey('description', $result);
    }
}
