<?php

namespace App\Services;

use App\Models\TeacherApplication;
use App\Models\TelegramUser;
use App\Models\TelegramPasswordReset;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class TelegramTeacherApplicationService
{
    protected TelegramService $telegramService;
    protected ConversationStateEngine $stateEngine;

    public function __construct(
        TelegramService $telegramService,
        ConversationStateEngine $stateEngine
    ) {
        $this->telegramService = $telegramService;
        $this->stateEngine = $stateEngine;
    }

    /**
     * Start the Teacher Application process.
     */
    public function startApplication(TelegramUser $telegramUser): void
    {
        // 1. Check if user is already a teacher
        if ($telegramUser->role === 'teacher' || $telegramUser->role === 'doctor') {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "ℹ️ حسابك مسجل بالفعل كمعلم في منصة خطوتك."
            );
            return;
        }

        // 2. Check if user already has a pending application
        $pending = TeacherApplication::where('telegram_user_id', $telegramUser->telegram_user_id)
            ->where('status', TeacherApplication::STATUS_PENDING)
            ->first();

        if ($pending) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "⏳ <b>طلبك السابق قيد المراجعة!</b>\n\nلديك طلب انضمام كمعلم برقم <code>#APP-{$pending->id}</code> تم تقديمه في {$pending->created_at->format('Y-m-d')} وهو قيد المراجعة من قِبل إدارة خطوتك حالياً."
            );
            return;
        }

        // 3. Initiate Step 1: Full Name
        $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_NAME, []);

        $text = "👨‍🏫 <b>طلب الانضمام كمعلم — منصة خطوتك</b>\n\n" .
            "يسعدنا انضمامك إلى نخبة معلمي خطوتك! سنحتاج لبعض البيانات الأساسية لتقديم طلبك للإدارة.\n\n" .
            "<b>الخطوة 1 من 6:</b>\nيرجى كتابة <b>اسمك بالكامل</b> (الثلاثي أو الرباعي):\n\n" .
            "<i>(أرسل /cancel في أي وقت للإلغاء والعودة للقائمة الرئيسية)</i>";

        $this->telegramService->sendMessage($telegramUser->telegram_chat_id, $text);
    }

    /**
     * Handle multi-step input wizard.
     */
    public function handleWizardInput(TelegramUser $telegramUser, string $state, string $text): bool
    {
        $payload = $this->stateEngine->getPayload($telegramUser);

        switch ($state) {
            case ConversationStateEngine::STATE_TEACHER_APP_NAME:
                if (mb_strlen($text) < 3) {
                    $this->telegramService->sendMessage($telegramUser->telegram_chat_id, "⚠️ يرجى إدخال اسم صحيح لا يقل عن 3 أحرف:");
                    return true;
                }
                $payload['name'] = $text;
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_PHONE, $payload);
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    "📱 <b>الخطوة 2 من 6: رقم الهاتف</b>\n\nيرجى كتابة رقم هاتفك المحمول للتواصل ومطابقة الحساب (مثال: 01012345678):"
                );
                return true;

            case ConversationStateEngine::STATE_TEACHER_APP_PHONE:
                $normalizedPhone = TelegramPhoneService::normalize($text);
                if (strlen($normalizedPhone) < 10) {
                    $this->telegramService->sendMessage($telegramUser->telegram_chat_id, "⚠️ يرجى إدخال رقم هاتف محمول مصري صحيح:");
                    return true;
                }

                // Check duplicate teacher phone
                if (User::where('phone', $normalizedPhone)->where('role', 'teacher')->exists()) {
                    $this->telegramService->sendMessage($telegramUser->telegram_chat_id, "⚠️ رقم الهاتف هذا مسجل بالفعل لمعلم على المنصة. يرجى استخدام رقم آخر أو تسجيل الدخول:");
                    return true;
                }

                $payload['phone'] = $normalizedPhone;
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_EMAIL, $payload);
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    "📧 <b>الخطوة 3 من 6: البريد الإلكتروني</b>\n\nيرجى إدخال بريدك الإلكتروني الصحيح (سيستخدم لتسجيل الدخول):"
                );
                return true;

            case ConversationStateEngine::STATE_TEACHER_APP_EMAIL:
                if (!filter_var($text, FILTER_VALIDATE_EMAIL)) {
                    $this->telegramService->sendMessage($telegramUser->telegram_chat_id, "⚠️ صيغة البريد الإلكتروني غير صحيحة، يرجى كتابة بريد صالح (مثال: teacher@gmail.com):");
                    return true;
                }

                if (User::where('email', strtolower($text))->exists()) {
                    $this->telegramService->sendMessage($telegramUser->telegram_chat_id, "⚠️ هذا البريد الإلكتروني مسجل بالفعل على المنصة. يرجى إدخال بريد آخر:");
                    return true;
                }

                $payload['email'] = strtolower($text);
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_SUBJECT, $payload);
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    "📚 <b>الخطوة 4 من 6: المادة الدراسية</b>\n\nما هي المادة التي تدرسها؟ (مثال: لغة عربية، فيزياء، كيمياء، أحياء، رياضيات...):"
                );
                return true;

            case ConversationStateEngine::STATE_TEACHER_APP_SUBJECT:
                $payload['subject'] = $text;
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_GRADES, $payload);
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    "🎓 <b>الخطوة 5 من 6: الصفوف والمراحل الدراسية</b>\n\nما هي الصفوف التي تدرس لها؟ (مثال: أول ثانوي، ثاني ثانوي، ثالث ثانوي، إعدادي...):"
                );
                return true;

            case ConversationStateEngine::STATE_TEACHER_APP_GRADES:
                $payload['grades'] = array_map('trim', explode('،', str_replace(',', '،', $text)));
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_CENTER, $payload);
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    "🏢 <b>الخطوة 6 من 6: بيانات السنتر أو المركز التعليمي</b>\n\nاكتب اسم السنتر والمحافظة والمنطقة إن وجدت، أو اكتب «أونلاين فقط»:"
                );
                return true;

            case ConversationStateEngine::STATE_TEACHER_APP_CENTER:
                $payload['center_details'] = $text;
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_TEACHER_APP_CONFIRM, $payload);

                // Show confirmation summary
                $gradesStr = implode('، ', $payload['grades']);
                $summary = "📋 <b>مراجعة بيانات طلب انضمام المعلم:</b>\n" .
                    "━━━━━━━━━━━━━━━━━━━━\n" .
                    "• الاسم: <b>{$payload['name']}</b>\n" .
                    "• الهاتف: <code>{$payload['phone']}</code>\n" .
                    "• الإيميل: <code>{$payload['email']}</code>\n" .
                    "• المادة: <b>{$payload['subject']}</b>\n" .
                    "• الصفوف: <b>{$gradesStr}</b>\n" .
                    "• السنتر/المركز: <b>{$payload['center_details']}</b>\n" .
                    "━━━━━━━━━━━━━━━━━━━━\n" .
                    "هل تؤكد صحة هذه البيانات لإرسال الطلب للإدارة؟";

                $inlineKeyboard = [
                    [
                        ['text' => '✅ تأكيد وإرسال الطلب', 'callback_data' => 'teach_app_confirm'],
                        ['text' => '❌ إلغاء الطلب', 'callback_data' => 'teach_app_cancel'],
                    ]
                ];

                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    $summary,
                    ['inline_keyboard' => $inlineKeyboard]
                );
                return true;
        }

        return false;
    }

    /**
     * Confirm and submit teacher application to DB & Admin.
     */
    public function submitApplication(TelegramUser $telegramUser): void
    {
        $payload = $this->stateEngine->getPayload($telegramUser);
        if (empty($payload['name']) || empty($payload['phone']) || empty($payload['email'])) {
            $this->telegramService->sendMessage($telegramUser->telegram_chat_id, "⚠️ حدث خطأ في البيانات. يرجى إعادة تقديم الطلب.");
            $this->stateEngine->clearState($telegramUser);
            return;
        }

        $app = TeacherApplication::create([
            'telegram_user_id' => $telegramUser->telegram_user_id,
            'name' => $payload['name'],
            'phone' => $payload['phone'],
            'email' => $payload['email'],
            'subject' => $payload['subject'] ?? 'عام',
            'grades' => $payload['grades'] ?? ['first_secondary'],
            'center_details' => $payload['center_details'] ?? null,
            'status' => TeacherApplication::STATUS_PENDING,
        ]);

        $this->stateEngine->clearState($telegramUser);

        // 1. Notify Applicant
        $confirmMsg = "🎉 <b>تم إرسال طلب انضمامك كمعلم بنجاح!</b>\n\n" .
            "• رقم الطلب: <code>#APP-{$app->id}</code>\n" .
            "• الاسم: <b>{$app->name}</b>\n\n" .
            "طلبك الآن قيد المراجعة الإدارية. ستصلك رسالة فور اتخاذ القرار وتفعيل حسابك برابط آمن.\nنشكرك لاختيار منصة خطوتك! ❤️";

        $this->telegramService->sendMessage($telegramUser->telegram_chat_id, $confirmMsg);

        // 2. Notify Admin Chat
        $this->notifyAdminNewTeacherApplication($app, $telegramUser);
    }

    /**
     * Dispatch alert to Telegram Admin Chat with Action Buttons.
     */
    public function notifyAdminNewTeacherApplication(TeacherApplication $app, TelegramUser $telegramUser): void
    {
        $adminChatId = config('services.telegram.admin_chat_id') ?: env('TELEGRAM_ADMIN_CHAT_ID');
        if (!$adminChatId) {
            Log::warning('TelegramTeacherApplicationService: TELEGRAM_ADMIN_CHAT_ID missing, skipped admin alert.');
            return;
        }

        $gradesStr = is_array($app->grades) ? implode('، ', $app->grades) : $app->grades;

        $adminText = "👨‍🏫 <b>طلب انضمام معلم جديد!</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "• رقم الطلب: <code>#APP-{$app->id}</code>\n" .
            "• الاسم: <b>{$app->name}</b>\n" .
            "• الهاتف: <code>{$app->phone}</code>\n" .
            "• الإيميل: <code>{$app->email}</code>\n" .
            "• المادة: <b>{$app->subject}</b>\n" .
            "• الصفوف: <b>{$gradesStr}</b>\n" .
            "• السنتر: <b>" . ($app->center_details ?: 'أونلاين فقط') . "</b>\n" .
            "• Telegram ID: <code>{$app->telegram_user_id}</code>\n" .
            "• التاريخ: <b>" . Carbon::now()->format('Y-m-d H:i') . "</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "اختر الإجراء الإداري:";

        $inlineKeyboard = [
            [
                ['text' => '✅ قبول وتفعيل الحساب', 'callback_data' => "adm_app_teach_{$app->id}"],
                ['text' => '❌ رفض الطلب', 'callback_data' => "adm_rej_teach_{$app->id}"],
            ]
        ];

        try {
            $this->telegramService->sendMessage($adminChatId, $adminText, ['inline_keyboard' => $inlineKeyboard]);
        } catch (\Throwable $e) {
            Log::error('TelegramTeacherApplicationService: Admin alert failed: ' . $e->getMessage());
        }
    }

    /**
     * Admin approves teacher application: creates user, generates reset link, notifies teacher.
     */
    public function approveApplication(TelegramUser $adminUser, mixed $appId): array
    {
        $app = null;
        if (is_numeric($appId)) {
            $app = TeacherApplication::find((int)$appId);
        }
        if (!$app && (string)$appId === 'demo') {
            $app = TeacherApplication::where('status', TeacherApplication::STATUS_PENDING)->latest()->first() ?: TeacherApplication::latest()->first();
        }

        if (!$app) {
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "❌ الطلب غير موجود.");
            return ['success' => false];
        }

        if ($app->status === TeacherApplication::STATUS_APPROVED) {
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "ℹ️ تم قبول هذا الطلب مسبقاً.");
            return ['success' => false];
        }

        return DB::transaction(function () use ($app, $adminUser) {
            // 1. Create or update user
            $user = User::where('email', $app->email)->orWhere('phone', $app->phone)->first();
            if (!$user) {
                $user = User::create([
                    'name' => $app->name,
                    'email' => $app->email,
                    'phone' => $app->phone,
                    'role' => 'teacher',
                    'status' => 'active',
                    'must_change_password' => true,
                    'teaching_mode' => 'both',
                    'subject' => $app->subject,
                    'grades' => is_array($app->grades) ? $app->grades : [$app->grades],
                    'password' => Hash::make(bin2hex(random_bytes(16))),
                ]);
            } else {
                $user->update([
                    'role' => 'teacher',
                    'status' => 'active',
                    'must_change_password' => true,
                    'subject' => $app->subject,
                ]);
            }

            // 2. Generate secure single-use password setup link
            $plainToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $plainToken);
            $expiresAt = Carbon::now()->addDays(2); // 48h validity for teacher onboarding

            TelegramPasswordReset::create([
                'user_id' => $user->id,
                'telegram_user_id' => $app->telegram_user_id,
                'telegram_chat_id' => $app->telegram_user_id,
                'verified_phone' => $app->phone,
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt,
            ]);

            // 3. Update application status
            $app->update([
                'status' => TeacherApplication::STATUS_APPROVED,
                'created_user_id' => $user->id,
                'reviewed_by_telegram_id' => $adminUser->telegram_user_id,
                'reviewed_at' => Carbon::now(),
            ]);

            // 4. Update applicant's telegram_user role to teacher
            $applicantTg = TelegramUser::where('telegram_user_id', $app->telegram_user_id)->first();
            if ($applicantTg) {
                $applicantTg->update([
                    'user_id' => $user->id,
                    'role' => 'teacher',
                    'is_linked' => true,
                    'linked_at' => Carbon::now(),
                ]);
            }

            $baseUrl = TelegramService::getFrontendUrl('reset-password');
            $setupUrl = "{$baseUrl}#token={$plainToken}";

            // 5. Send celebratory message to teacher
            $teacherMsg = "🎉 <b>ألف مبروك! تمت الموافقة على انضمامك كمعلم في منصة خطوتك 🌟</b>\n\n" .
                "أهلاً بك يا أستاذ <b>{$user->name}</b> في منصة خطوتك التعليمية.\n" .
                "تم تفعيل حساب المعلم الخاص بك بنجاح.\n\n" .
                "للبدء فوراً وتعيين كلمة المرور واستكمال ملفك التعريفي، اضغط على الرابط الآمن بالأسفل:\n" .
                "<a href=\"{$setupUrl}\">👉 اضغط هنا لتعيين كلمة المرور وبدء التدريس</a>\n\n" .
                "⚠️ <i>الرابط مخصص لك وصالح لمدة 48 ساعة.</i>";

            try {
                $this->telegramService->sendMessage($app->telegram_user_id, $teacherMsg);
            } catch (\Throwable $e) {
                Log::warning('Failed to notify approved teacher via telegram: ' . $e->getMessage());
            }

            // 6. Confirm to admin
            $this->telegramService->sendMessage(
                $adminUser->telegram_chat_id,
                "✅ <b>تم قبول المعلم بنجاح!</b>\n\nتم إنشاء الحساب للمدرس <b>{$user->name}</b> برقم ID: #{$user->id} وتم إرسال رابط التفعيل وتعيين كلمة المرور له عبر تيليجرام."
            );

            return ['success' => true, 'user' => $user];
        });
    }

    /**
     * Start rejection flow: prompt admin for reason.
     */
    public function startRejectApplication(TelegramUser $adminUser, mixed $appId): void
    {
        $app = null;
        if (is_numeric($appId)) {
            $app = TeacherApplication::find((int)$appId);
        }
        if (!$app && (string)$appId === 'demo') {
            $app = TeacherApplication::where('status', TeacherApplication::STATUS_PENDING)->latest()->first() ?: TeacherApplication::latest()->first();
        }

        if (!$app) {
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "❌ الطلب غير موجود.");
            return;
        }

        $this->stateEngine->setState($adminUser, ConversationStateEngine::STATE_ADMIN_REJECTING_TEACHER, [
            'app_id' => $app->id,
            'applicant_telegram_id' => $app->telegram_user_id,
            'applicant_name' => $app->name,
        ]);

        $text = "❌ <b>رفض طلب المعلم: {$app->name}</b>\n\n" .
            "اكتب سبب الرفض بالأسفل (سيتم إرساله للمتقدم بأدب واحترام):\n" .
            "<i>(أو أرسل /cancel لإلغاء الرفض)</i>";

        $this->telegramService->sendMessage($adminUser->telegram_chat_id, $text);
    }

    /**
     * Submit rejection with reason to applicant.
     */
    public function submitRejection(TelegramUser $adminUser, string $reason): void
    {
        $payload = $this->stateEngine->getPayload($adminUser);
        $appId = $payload['app_id'] ?? null;
        $app = TeacherApplication::find($appId);

        if (!$app) {
            $this->stateEngine->clearState($adminUser);
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "❌ الطلب غير موجود.");
            return;
        }

        $app->update([
            'status' => TeacherApplication::STATUS_REJECTED,
            'rejection_reason' => $reason,
            'reviewed_by_telegram_id' => $adminUser->telegram_user_id,
            'reviewed_at' => Carbon::now(),
        ]);

        $this->stateEngine->clearState($adminUser);

        // Notify applicant
        $rejectMsg = "عزيزي الأستاذ <b>{$app->name}</b>،\n\n" .
            "نشكر اهتمامك بالانضمام لمنصة خطوتك التعليمية. نعتذر منك، لم تتم الموافقة على طلبك في الوقت الحالي.\n\n" .
            "• <b>سبب الاعتذار:</b>\n" . htmlspecialchars($reason) . "\n\n" .
            "نتمنى لك كل التوفيق والنجاح، ويمكنك التواصل مع إدارة المنصة للاستفسار.";

        try {
            $this->telegramService->sendMessage($app->telegram_user_id, $rejectMsg);
        } catch (\Throwable $e) {
            // silent catch
        }

        $this->telegramService->sendMessage(
            $adminUser->telegram_chat_id,
            "✅ تم تسجيل رفض الطلب رقم <code>#APP-{$app->id}</code> وإرسال السبب للمتقدم."
        );
    }
}
