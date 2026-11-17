<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\TelegramUser;
use App\Models\TelegramLinkToken;
use App\Models\TelegramProcessedUpdate;
use App\Services\TelegramService;
use App\Services\ConversationStateEngine;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TelegramWebhookAndCoreEngineTest extends TestCase
{
    protected string $testSecret = 'test_webhook_secret_khotwtk_2026';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('services.telegram.webhook_secret', $this->testSecret);
        Config::set('services.telegram.bot_token', '123456789:ABCDefGhIJKlmNoPQRstuvWXyz');
        Config::set('services.telegram.official_frontend_domain', 'khotwtk.com');
        Config::set('queue.default', 'sync'); // sync for deterministic test assertions
    }

    /**
     * Test webhook rejects non-POST HTTP methods.
     */
    public function test_webhook_rejects_get_requests(): void
    {
        $response = $this->getJson('/api/telegram/webhook');
        $response->assertStatus(405);
    }

    /**
     * Test webhook rejects requests when secret token is empty or invalid.
     */
    public function test_webhook_rejects_missing_or_invalid_secret_token(): void
    {
        // 1. Missing header
        $resMissing = $this->postJson('/api/telegram/webhook', ['update_id' => 10001]);
        $resMissing->assertStatus(403);

        // 2. Wrong header
        $resWrong = $this->postJson('/api/telegram/webhook', [
            'update_id' => 10001,
        ], [
            'X-Telegram-Bot-Api-Secret-Token' => 'wrong_secret',
        ]);
        $resWrong->assertStatus(403);
    }

    /**
     * Test webhook rejects malformed payload without update_id.
     */
    public function test_webhook_rejects_malformed_payload(): void
    {
        $response = $this->postJson('/api/telegram/webhook', [
            'some_random_field' => 'data',
        ], [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);

        $response->assertStatus(400);
    }

    /**
     * Test webhook accepts valid secret token and records Transactional Outbox update.
     */
    public function test_webhook_accepts_valid_update_with_outbox_lifecycle(): void
    {
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $updateId = rand(1000000, 9999999);

        $response = $this->postJson('/api/telegram/webhook', [
            'update_id' => $updateId,
            'message' => [
                'message_id' => 1,
                'from' => [
                    'id' => 999888777,
                    'is_bot' => false,
                    'first_name' => 'Khotwtk',
                    'username' => 'testuser',
                ],
                'chat' => [
                    'id' => 999888777,
                    'type' => 'private',
                ],
                'date' => time(),
                'text' => '/start',
            ],
        ], [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);

        $response->assertStatus(200);
        $response->assertJson(['ok' => true]);

        // Assert record created and marked as processed via Outbox
        $record = TelegramProcessedUpdate::where('update_id', $updateId)->first();
        $this->assertNotNull($record);
        $this->assertEquals(TelegramProcessedUpdate::STATUS_PROCESSED, $record->status);
        $this->assertNotNull($record->processed_at);

        // Assert TelegramUser created
        $this->assertDatabaseHas('telegram_users', [
            'telegram_user_id' => 999888777,
            'role' => 'guest',
        ]);
    }

    /**
     * Test atomic update deduplication.
     */
    public function test_webhook_deduplication_drops_duplicate_update(): void
    {
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $updateId = rand(1000000, 9999999);

        $payload = [
            'update_id' => $updateId,
            'message' => [
                'message_id' => 2,
                'from' => ['id' => 555444333, 'first_name' => 'User'],
                'chat' => ['id' => 555444333, 'type' => 'private'],
                'text' => '/help',
            ],
        ];

        // First delivery
        $res1 = $this->postJson('/api/telegram/webhook', $payload, [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);
        $res1->assertStatus(200);
        $res1->assertJson(['ok' => true]);

        // Second delivery (Telegram retry)
        $res2 = $this->postJson('/api/telegram/webhook', $payload, [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);
        $res2->assertStatus(200);
        $res2->assertJson(['ok' => true, 'duplicate' => true]);

        // Exactly 1 record in database
        $count = TelegramProcessedUpdate::where('update_id', $updateId)->count();
        $this->assertEquals(1, $count);
    }

    /**
     * Test group chats are politely rejected for private-only assistant.
     */
    public function test_group_chats_are_rejected(): void
    {
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $updateId = rand(1000000, 9999999);

        $response = $this->postJson('/api/telegram/webhook', [
            'update_id' => $updateId,
            'message' => [
                'message_id' => 10,
                'from' => ['id' => 112233, 'first_name' => 'GroupUser'],
                'chat' => ['id' => -987654321, 'type' => 'supergroup'],
                'text' => '/start',
            ],
        ], [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);

        $response->assertStatus(200);

        // TelegramUser should not be created for groups
        $this->assertDatabaseMissing('telegram_users', [
            'telegram_user_id' => 112233,
        ]);
    }

    /**
     * Test account linking via /start link_<token>.
     */
    public function test_deep_link_account_linking_flow(): void
    {
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $user = User::create([
            'name' => 'Linking Student',
            'email' => 'linking_student_' . uniqid() . '@khotwtk.com',
            'password' => bcrypt('secret'),
            'role' => 'student',
            'phone' => '01011112222',
            'parent_phone' => '01099998888',
            'status' => 'active',
        ]);

        $plainToken = Str::random(40);
        TelegramLinkToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => Carbon::now()->addMinutes(10),
        ]);

        $telegramUserId = 666777888;

        $response = $this->postJson('/api/telegram/webhook', [
            'update_id' => rand(1000000, 9999999),
            'message' => [
                'message_id' => 3,
                'from' => ['id' => $telegramUserId, 'first_name' => 'Linker'],
                'chat' => ['id' => $telegramUserId, 'type' => 'private'],
                'text' => "/start link_{$plainToken}",
            ],
        ], [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);

        $response->assertStatus(200);

        // Assert user is now linked
        $tgUser = TelegramUser::where('telegram_user_id', $telegramUserId)->first();
        $this->assertNotNull($tgUser);
        $this->assertTrue($tgUser->is_linked);
        $this->assertEquals($user->id, $tgUser->user_id);
        $this->assertEquals('student', $tgUser->role);
    }

    /**
     * Test /cancel command clears state.
     */
    public function test_cancel_command_clears_active_state(): void
    {
        Http::fake([
            'api.telegram.org/*' => Http::response(['ok' => true], 200),
        ]);

        $telegramUserId = 777666555;
        $tgUser = TelegramUser::create([
            'telegram_user_id' => $telegramUserId,
            'telegram_chat_id' => $telegramUserId,
            'current_conversation_state' => ConversationStateEngine::STATE_AWAITING_RECOVERY_CONTACT,
            'state_payload' => ['step' => 1],
        ]);

        $response = $this->postJson('/api/telegram/webhook', [
            'update_id' => rand(1000000, 9999999),
            'message' => [
                'message_id' => 4,
                'from' => ['id' => $telegramUserId, 'first_name' => 'Canceller'],
                'chat' => ['id' => $telegramUserId, 'type' => 'private'],
                'text' => '/cancel',
            ],
        ], [
            'X-Telegram-Bot-Api-Secret-Token' => $this->testSecret,
        ]);

        $response->assertStatus(200);

        $tgUser->refresh();
        $this->assertEquals(ConversationStateEngine::STATE_IDLE, $tgUser->current_conversation_state);
        $this->assertNull($tgUser->state_payload);
    }

    /**
     * Test Frontend URL builder safety.
     */
    public function test_frontend_url_normalization_safety(): void
    {
        Config::set('services.telegram.official_frontend_domain', 'khotwtk.com');
        $this->assertEquals('https://khotwtk.com', TelegramService::getFrontendUrl());
        $this->assertEquals('https://khotwtk.com/reset-password', TelegramService::getFrontendUrl('reset-password'));

        // If domain was entered with https:// and trailing slash
        Config::set('services.telegram.official_frontend_domain', 'https://khotwtk.com/');
        $this->assertEquals('https://khotwtk.com', TelegramService::getFrontendUrl());
        $this->assertEquals('https://khotwtk.com/profile', TelegramService::getFrontendUrl('/profile'));
    }
}
