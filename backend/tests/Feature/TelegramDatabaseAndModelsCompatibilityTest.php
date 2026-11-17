<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\TelegramUser;
use App\Models\TelegramLinkToken;
use App\Models\GuardianStudentRelation;
use App\Models\TelegramPasswordReset;
use App\Models\MarketingCampaign;
use App\Models\GiftCode;
use App\Models\GiftCodeRedemption;
use App\Models\CampaignDelivery;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TelegramDatabaseAndModelsCompatibilityTest extends TestCase
{
    protected User $student1;
    protected User $student2;
    protected User $teacher;
    protected User $doctor;
    protected User $admin;
    protected string $suffix;

    protected function setUp(): void
    {
        parent::setUp();
        $this->suffix = uniqid();

        // 1. Existing Student 1
        $this->student1 = User::create([
            'name' => 'Student One ' . $this->suffix,
            'email' => "student1_{$this->suffix}@example.com",
            'phone' => '01011111111',
            'parent_phone' => '01099999999',
            'password' => Hash::make('password123'),
            'role' => 'student',
            'grades' => ['ثالثة ثانوي'],
            'status' => 'active',
            'student_type' => 'online',
        ]);

        // 2. Existing Student 2 (sibling sharing same parent_phone)
        $this->student2 = User::create([
            'name' => 'Student Two ' . $this->suffix,
            'email' => "student2_{$this->suffix}@example.com",
            'phone' => '01022222222',
            'parent_phone' => '01099999999',
            'password' => Hash::make('password123'),
            'role' => 'student',
            'grades' => ['أولى ثانوي'],
            'status' => 'active',
            'student_type' => 'center',
        ]);

        // 3. Existing School Teacher
        $this->teacher = User::create([
            'name' => 'Teacher ' . $this->suffix,
            'email' => "teacher_{$this->suffix}@example.com",
            'phone' => '01033333333',
            'password' => Hash::make('password123'),
            'role' => 'teacher',
            'subject' => 'Physics',
            'category' => 'school',
            'status' => 'active',
        ]);

        // 4. Existing University Doctor
        $this->doctor = User::create([
            'name' => 'Dr. Ahmed ' . $this->suffix,
            'email' => "doctor_{$this->suffix}@example.com",
            'phone' => '01055555555',
            'password' => Hash::make('password123'),
            'role' => 'teacher',
            'subject' => 'Computer Science',
            'category' => 'university',
            'status' => 'active',
        ]);

        // 5. Existing Admin
        $this->admin = User::create([
            'name' => 'Admin ' . $this->suffix,
            'email' => "admin_{$this->suffix}@example.com",
            'phone' => '01044444444',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_super_admin' => true,
            'status' => 'active',
        ]);
    }

    /**
     * Test creating and linking TelegramUser with User model, and safe unlinking/re-linking.
     */
    public function test_telegram_user_can_be_created_linked_and_unlinked_safely(): void
    {
        $externalTelegramUserId = 9876543210 + rand(1, 100000);
        $externalChatId = $externalTelegramUserId;

        $telegramUser = TelegramUser::create([
            'user_id' => $this->student1->id,
            'telegram_user_id' => $externalTelegramUserId,
            'telegram_chat_id' => $externalChatId,
            'telegram_username' => 'student_one_tg',
            'first_name' => 'Student',
            'last_name' => 'One',
            'phone' => '+20101111111',
            'role' => 'student',
            'is_linked' => true,
            'linked_at' => Carbon::now(),
            'last_interaction_at' => Carbon::now(),
        ]);

        $this->assertNotNull($telegramUser->id);
        $this->assertEquals($this->student1->id, $telegramUser->user_id);
        $this->assertTrue($telegramUser->is_linked);
        $this->assertTrue($telegramUser->isStudent());

        // Check inverse relationship on User
        $this->student1->refresh();
        $this->assertNotNull($this->student1->telegramUser);
        $this->assertEquals($telegramUser->id, $this->student1->telegramUser->id);

        // Safe unlinking
        $telegramUser->update([
            'is_linked' => false,
            'user_id' => null,
            'role' => 'guest',
        ]);

        $this->assertFalse($telegramUser->is_linked);
        $this->student1->refresh();
        $this->assertNull($this->student1->telegramUser);
    }

    /**
     * Test TelegramLinkToken generation and validity logic.
     */
    public function test_telegram_link_token_validity_and_expiration(): void
    {
        $rawToken = Str::random(40);
        $tokenHash = hash('sha256', $rawToken);

        $activeToken = TelegramLinkToken::create([
            'user_id' => $this->teacher->id,
            'token_hash' => $tokenHash,
            'expires_at' => Carbon::now()->addMinutes(10),
            'ip_address' => '127.0.0.1',
        ]);

        $this->assertTrue($activeToken->isValid());

        // Test used token
        $activeToken->update(['used_at' => Carbon::now()]);
        $this->assertFalse($activeToken->isValid());

        // Test expired token
        $expiredToken = TelegramLinkToken::create([
            'user_id' => $this->teacher->id,
            'token_hash' => hash('sha256', Str::random(40)),
            'expires_at' => Carbon::now()->subMinute(),
        ]);
        $this->assertFalse($expiredToken->isValid());

        // Relationship
        $this->assertCount(2, $this->teacher->telegramLinkTokens);
    }

    /**
     * Test Multi-Student Guardian relationship mapping using guardian_telegram_account_id.
     */
    public function test_guardian_can_link_multiple_students_via_verified_phone(): void
    {
        // Create unlinked guardian Telegram user
        $guardianTg = TelegramUser::create([
            'telegram_user_id' => 1234567890 + rand(1, 100000),
            'telegram_chat_id' => 1234567890 + rand(1, 100000),
            'telegram_username' => 'parent_tg',
            'first_name' => 'Father',
            'phone' => '+20109999999',
            'role' => 'guardian',
            'is_linked' => false,
        ]);

        // Link Student 1 to Guardian
        $rel1 = GuardianStudentRelation::create([
            'guardian_telegram_account_id' => $guardianTg->id,
            'student_user_id' => $this->student1->id,
            'verified_phone' => '01099999999',
            'status' => 'active',
            'notifications_enabled' => true,
            'weekly_report_enabled' => true,
        ]);

        // Link Student 2 (sibling) to the same Guardian
        $rel2 = GuardianStudentRelation::create([
            'guardian_telegram_account_id' => $guardianTg->id,
            'student_user_id' => $this->student2->id,
            'verified_phone' => '01099999999',
            'status' => 'active',
            'notifications_enabled' => true,
            'weekly_report_enabled' => true,
        ]);

        $this->assertCount(2, $guardianTg->guardianRelations);
        $this->assertEquals($this->student1->id, $guardianTg->guardianRelations[0]->student_user_id);
        $this->assertEquals($this->student2->id, $guardianTg->guardianRelations[1]->student_user_id);

        // Student side relations
        $this->assertCount(1, $this->student1->guardianRelations);
        $this->assertCount(1, $this->student2->guardianRelations);
    }

    /**
     * Test TelegramPasswordReset token generation and consumption.
     */
    public function test_telegram_password_reset_token_lifecycle(): void
    {
        $rawResetToken = Str::random(64);
        $tokenHash = hash('sha256', $rawResetToken);

        $reset = TelegramPasswordReset::create([
            'user_id' => $this->student1->id,
            'telegram_user_id' => 999888777,
            'telegram_chat_id' => 999888777,
            'verified_phone' => '01011111111',
            'token_hash' => $tokenHash,
            'expires_at' => Carbon::now()->addMinutes(15),
            'ip_address' => '192.168.1.1',
        ]);

        $this->assertTrue($reset->isValid());

        // Invalidate by using
        $reset->update(['used_at' => Carbon::now()]);
        $this->assertFalse($reset->isValid());

        // Check user relations
        $this->assertCount(1, $this->student1->telegramPasswordResets);
    }

    /**
     * Test Multi-Role GiftCode targeting (students only, teachers only, doctors only, students+teachers, all).
     */
    public function test_gift_code_multi_role_targeting_and_redemption(): void
    {
        $campaign = MarketingCampaign::create([
            'title' => 'Mega Academic 2026',
            'description' => 'Multi-tier offers for education',
            'offer_type' => 'gift_code',
            'target_audience' => ['roles' => ['student', 'teacher', 'doctor']],
            'start_date' => Carbon::now()->subDay()->toDateString(),
            'end_date' => Carbon::now()->addMonth()->toDateString(),
            'max_uses' => 1000,
            'used_count' => 0,
            'is_active' => true,
            'created_by' => $this->admin->id,
        ]);

        $this->assertTrue($campaign->isRunning());

        // 1. Code for Students AND School Teachers together: ['student', 'teacher']
        $codeBoth = GiftCode::create([
            'code' => 'STUDENT_AND_TEACHER',
            'campaign_id' => $campaign->id,
            'target_roles' => ['student', 'teacher'],
            'gift_type' => 'course_discount',
            'benefit_value' => 20.00,
            'max_redemptions' => 100,
            'redemptions_count' => 0,
            'is_multi_use' => false,
            'expires_at' => Carbon::now()->addDays(7),
            'is_active' => true,
            'created_by' => $this->admin->id,
        ]);

        $this->assertTrue($codeBoth->isEligibleForUser($this->student1));
        $this->assertTrue($codeBoth->isEligibleForUser($this->teacher));
        $this->assertFalse($codeBoth->isEligibleForUser($this->doctor)); // University doctor excluded

        // 2. Code specifically for University Doctors only: ['doctor']
        $codeDoctorOnly = GiftCode::create([
            'code' => 'DR_EXCLUSIVE',
            'campaign_id' => $campaign->id,
            'target_roles' => ['doctor'],
            'gift_type' => 'extra_storage_gb',
            'benefit_value' => 50.00,
            'max_redemptions' => 10,
            'redemptions_count' => 0,
            'is_multi_use' => false,
            'expires_at' => Carbon::now()->addDays(7),
            'is_active' => true,
            'created_by' => $this->admin->id,
        ]);

        $this->assertFalse($codeDoctorOnly->isEligibleForUser($this->student1));
        $this->assertFalse($codeDoctorOnly->isEligibleForUser($this->teacher));
        $this->assertTrue($codeDoctorOnly->isEligibleForUser($this->doctor));

        // 3. Redeem for student
        $redemption = GiftCodeRedemption::create([
            'gift_code_id' => $codeBoth->id,
            'user_id' => $this->student1->id,
            'redeemed_at' => Carbon::now(),
            'ip_address' => '127.0.0.1',
            'telegram_chat_id' => 11223344,
        ]);

        $this->assertNotNull($redemption->id);
        $this->assertEquals($this->student1->id, $redemption->user_id);

        // 4. Test CampaignDelivery using disambiguated telegram_account_id
        $tgUser = TelegramUser::create([
            'telegram_user_id' => 777888999,
            'telegram_chat_id' => 777888999,
            'role' => 'student',
        ]);

        $delivery = CampaignDelivery::create([
            'campaign_id' => $campaign->id,
            'telegram_account_id' => $tgUser->id,
            'status' => 'sent',
            'sent_at' => Carbon::now(),
        ]);

        $this->assertEquals('sent', $delivery->status);
        $this->assertEquals($tgUser->id, $delivery->telegram_account_id);
    }
}
