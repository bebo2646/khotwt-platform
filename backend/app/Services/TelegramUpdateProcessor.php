<?php

namespace App\Services;

use App\Models\TelegramUser;
use App\Models\TelegramLinkToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TelegramUpdateProcessor
{
    protected TelegramService $telegramService;
    protected TelegramKeyboardService $keyboardService;
    protected ConversationStateEngine $stateEngine;
    protected TelegramPasswordRecoveryService $recoveryService;
    protected TelegramGuardianService $guardianService;

    public function __construct(
        TelegramService $telegramService,
        TelegramKeyboardService $keyboardService,
        ConversationStateEngine $stateEngine,
        ?TelegramPasswordRecoveryService $recoveryService = null,
        ?TelegramGuardianService $guardianService = null
    ) {
        $this->telegramService = $telegramService;
        $this->keyboardService = $keyboardService;
        $this->stateEngine = $stateEngine;
        $this->recoveryService = $recoveryService ?: app(TelegramPasswordRecoveryService::class);
        $this->guardianService = $guardianService ?: app(TelegramGuardianService::class);
    }

    /**
     * Main entry point to process any incoming update.
     */
    public function process(array $update): void
    {
        // 1. Process standard message
        if (isset($update['message'])) {
            $this->processMessage($update['message']);
            return;
        }

        // 2. Process callback query (inline button clicks)
        if (isset($update['callback_query'])) {
            $this->processCallbackQuery($update['callback_query']);
            return;
        }

        Log::info('TelegramUpdateProcessor: Unsupported update type ignored', [
            'update_id' => $update['update_id'] ?? null,
        ]);
    }

    /**
     * Process incoming message object.
     */
    protected function processMessage(array $message): void
    {
        $chat = $message['chat'] ?? [];
        $from = $message['from'] ?? [];
        $text = trim($message['text'] ?? '');

        $chatId = $chat['id'] ?? null;
        $fromId = $from['id'] ?? null;

        if (!$chatId || !$fromId) {
            return;
        }

        // Strict security: Reject Group, Supergroup, and Channel
        if (($chat['type'] ?? 'private') !== 'private') {
            $this->telegramService->sendMessage(
                $chatId,
                '⚠️ حفاظاً على خصوصيتك وأمان بياناتك، يرجى استخدام بوت خطوتك في المحادثات الخاصة فقط.'
            );
            return;
        }

        // Resolve or create TelegramUser
        $telegramUser = TelegramUser::firstOrCreate(
            ['telegram_user_id' => $fromId],
            [
                'telegram_chat_id' => $chatId,
                'telegram_username' => $from['username'] ?? null,
                'first_name' => $from['first_name'] ?? null,
                'last_name' => $from['last_name'] ?? null,
                'role' => 'guest',
                'is_linked' => false,
            ]
        );

        $telegramUser->update([
            'telegram_chat_id' => $chatId,
            'telegram_username' => $from['username'] ?? $telegramUser->telegram_username,
            'first_name' => $from['first_name'] ?? $telegramUser->first_name,
            'last_name' => $from['last_name'] ?? $telegramUser->last_name,
            'last_interaction_at' => Carbon::now(),
        ]);

        // 1. Handle Commands
        if (str_starts_with($text, '/start')) {
            $this->handleStartCommand($telegramUser, $text);
            return;
        }

        if ($text === '/help' || $text === 'مساعدة') {
            $this->handleHelpCommand($telegramUser);
            return;
        }

        if ($text === '/cancel' || $text === '❌ إلغاء والعودة للقائمة الرئيسية' || $text === 'إلغاء') {
            $this->handleCancelCommand($telegramUser);
            return;
        }

        if ($text === '/unlink' || $text === '🔓 إلغاء ربط الحساب') {
            $this->handleUnlinkCommand($telegramUser);
            return;
        }

        // 2. Handle Contact Sharing
        if (isset($message['contact'])) {
            $this->handleContactReceived($telegramUser, $message['contact']);
            return;
        }

        // 3. Handle Active Conversation States
        $currentState = $this->stateEngine->getState($telegramUser);

        if ($currentState === ConversationStateEngine::STATE_AWAITING_RECOVERY_CONTACT ||
            $currentState === ConversationStateEngine::STATE_AWAITING_GUARDIAN_CONTACT) {
            $this->telegramService->sendMessage(
                $chatId,
                "⚠️ يرجى الضغط على زر مشاركة جهة الاتصال بالأسفل للتحقق الأمني من رقم هاتفك، ولا تقم بكتابة الرقم يدوياً لضمان الأمان ومكافحة التلاعب.",
                $this->keyboardService->requestContactKeyboard()
            );
            return;
        }

        // 4. Handle Menu Button Clicks
        $this->handleMenuNavigation($telegramUser, $text);
    }

    /**
     * Handle /start command and deep-link payloads.
     */
    protected function handleStartCommand(TelegramUser $telegramUser, string $text): void
    {
        $this->stateEngine->clearState($telegramUser);
        $parts = explode(' ', $text, 2);
        $payload = isset($parts[1]) ? trim($parts[1]) : '';

        // Deep linking: /start link_<token>
        if (str_starts_with($payload, 'link_')) {
            $this->handleAccountLinkDeepLink($telegramUser, substr($payload, 5));
            return;
        }

        // Standard /start welcome
        $this->sendRoleBasedWelcome($telegramUser);
    }

    /**
     * Handle Deep Link Account Linking.
     */
    protected function handleAccountLinkDeepLink(TelegramUser $telegramUser, string $token): void
    {
        $tokenHash = hash('sha256', $token);
        $linkToken = TelegramLinkToken::where('token_hash', $tokenHash)->first();

        if (!$linkToken || !$linkToken->isValid()) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "❌ <b>عذراً، رمز الربط غير صحيح أو منتهي الصلاحية!</b>\n\nيرجى تسجيل الدخول إلى منصة خطوتك والضغط على «ربط حساب Telegram» للحصول على رابط جديد صالح لمدة 15 دقيقة.",
                $this->keyboardService->unlinkedGuestKeyboard()
            );
            return;
        }

        $user = $linkToken->user;

        // Constraint 1: Check if this Telegram account is already linked to another Khotwtk user
        if ($telegramUser->is_linked && $telegramUser->user_id && (int)$telegramUser->user_id !== (int)$user->id) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "⚠️ حساب Telegram هذا مرتبط بالفعل بحساب خطوتك آخر. يرجى إلغاء الربط من الحساب القديم أولاً عبر إرسال /unlink أو من إعدادات المنصة.",
                $this->keyboardService->unlinkedGuestKeyboard()
            );
            return;
        }

        // Constraint 2: Check if this Khotwtk user is already linked to another active Telegram account
        $existingLink = TelegramUser::where('user_id', $user->id)
            ->where('is_linked', true)
            ->where('id', '!=', $telegramUser->id)
            ->first();

        if ($existingLink) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "⚠️ حساب خطوتك الخاص بك مرتبط بالفعل بحساب Telegram آخر. يرجى فصل الربط أولاً من إعدادات حسابك على المنصة لتتمكن من ربطه بهذا الحساب.",
                $this->keyboardService->unlinkedGuestKeyboard()
            );
            return;
        }

        // Complete the link inside DB transaction
        DB::transaction(function () use ($linkToken, $telegramUser, $user) {
            $linkToken->update([
                'used_at' => Carbon::now(),
            ]);

            $role = $user->role;
            if ($user->isTeacher() && $user->category === 'university') {
                $role = 'doctor';
            }

            $telegramUser->update([
                'user_id' => $user->id,
                'is_linked' => true,
                'role' => $role,
                'linked_at' => Carbon::now(),
            ]);
        });

        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            "🎉 <b>تم ربط حسابك بمنصة خطوتك بنجاح!</b>\n\nأهلاً بك يا <b>{$user->name}</b>. يمكنك الآن الاستفادة من كافة خدمات المنصة المخصصة لك مباشرة من تيليجرام.",
            $this->getKeyboardForUser($telegramUser)
        );
    }

    /**
     * Handle unlinking account directly from Telegram.
     */
    protected function handleUnlinkCommand(TelegramUser $telegramUser): void
    {
        if (!$telegramUser->is_linked || !$telegramUser->user_id) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "ℹ️ حسابك غير مرتبط حالياً بأي حساب على منصة خطوتك.",
                $this->keyboardService->unlinkedGuestKeyboard()
            );
            return;
        }

        DB::transaction(function () use ($telegramUser) {
            $telegramUser->update([
                'is_linked' => false,
                'user_id' => null,
                'role' => 'guest',
            ]);
        });

        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            "✅ <b>تم إلغاء ربط الحساب بنجاح.</b>\n\nتم فصل حساب خطوتك عن هذا المعرف. يمكنك إعادة الربط في أي وقت من خلال إعدادات حسابك على المنصة.",
            $this->keyboardService->unlinkedGuestKeyboard()
        );
    }

    /**
     * Send adaptive welcome based on role.
     */
    protected function sendRoleBasedWelcome(TelegramUser $telegramUser): void
    {
        $telegramUser->loadMissing('user');
        $user = $telegramUser->user;

        if (!$telegramUser->is_linked || !$user) {
            if ($telegramUser->role === 'guardian') {
                $text = "مرحباً بك في خدمات أولياء الأمور — منصة خطوتك 👨‍👩‍👧\nيمكنك استعراض تقارير الأبناء ومتابعة نتائجهم من القائمة بالأسفل:";
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    $text,
                    $this->keyboardService->guardianKeyboard()
                );
                return;
            }

            $welcomeText = "أهلاً بيك في بوت خطوتك 🎓\n\nمساعدك التعليمي وخدماتك في مكان واحد.\n\nاختار الخدمة اللي محتاجها من القائمة بالأسفل:";
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                $welcomeText,
                $this->keyboardService->unlinkedGuestKeyboard()
            );
            return;
        }

        if ($user->isStudent()) {
            $text = "مرحباً بك يا <b>{$user->name}</b> 🌟\nمساعدك التعليمي جاهز لمتابعة كورساتك ونتائجك وإشعاراتك.";
        } elseif ($user->isTeacher()) {
            if ($user->category === 'university') {
                $text = "مرحباً بك دكتور <b>{$user->name}</b> 👨‍🏫\nلوحة خدماتك الجامعية وإدارة المقررات ومساحة التخزين في متناول يدك.";
            } else {
                $text = "مرحباً بك أستاذ <b>{$user->name}</b> 👨‍🏫\nلوحة خدمات المعلم ومتابعة الطلاب ومساحة التخزين في متناول يدك.";
            }
        } else {
            $text = "مرحباً بك <b>{$user->name}</b> في منصة خطوتك 🎓";
        }

        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            $text,
            $this->getKeyboardForUser($telegramUser)
        );
    }

    /**
     * Handle /help command.
     */
    protected function handleHelpCommand(TelegramUser $telegramUser): void
    {
        $helpText = "📖 <b>دليل استخدام بوت خطوتك (Khotwtk Assistant)</b>\n\n" .
            "• <b>/start</b>: فتح القائمة الرئيسية وتحديث الواجهة.\n" .
            "• <b>/unlink</b>: إلغاء ربط الحساب الحالي.\n" .
            "• <b>/cancel</b>: إلغاء أي عملية معلقة والعودة للرئيسية.\n" .
            "• <b>/help</b>: استعراض هذه المساعدة.\n\n" .
            "🔐 <b>استعادة كلمة المرور</b>: استعادة حسابك بسرعة عبر التحقق الموثق برقم هاتفك.\n" .
            "🔗 <b>ربط الحساب</b>: لربط حسابك المسجل والحصول على إشعاراتك ودرجاتك.\n" .
            "👨‍👩‍👧 <b>خدمات ولي الأمر</b>: لمتابعة أداء الأبناء والتقارير الأسبوعية.\n\n" .
            "إذا واجهتك أي مشكلة، تواصل معنا عبر قسم «🛠 الدعم الفني».";

        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            $helpText,
            $this->getKeyboardForUser($telegramUser)
        );
    }

    /**
     * Handle /cancel command.
     */
    protected function handleCancelCommand(TelegramUser $telegramUser): void
    {
        $this->stateEngine->clearState($telegramUser);

        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            "✅ تم إلغاء العملية والعودة إلى القائمة الرئيسية.",
            $this->getKeyboardForUser($telegramUser)
        );
    }

    /**
     * Handle menu buttons.
     */
    protected function handleMenuNavigation(TelegramUser $telegramUser, string $text): void
    {
        $chatId = $telegramUser->telegram_chat_id;

        switch ($text) {
            case '🔗 ربط حساب خطوتك':
                $frontendUrl = TelegramService::getFrontendUrl();
                $msg = "🔗 <b>كيفية ربط حسابك بمنصة خطوتك:</b>\n\n" .
                    "1. افتح موقع خطوتك: <b>{$frontendUrl}</b>\n" .
                    "2. سجل دخولك إلى حسابك وافتح صفحة الملف الشخصي أو الإعدادات.\n" .
                    "3. اضغط على زر «<b>ربط حساب Telegram</b>».\n" .
                    "4. سيتم فتح البوت تلقائياً وإتمام الربط الآمن خلال ثوانٍ.\n\n" .
                    "⚠️ لا تشارك أي كلمات مرور مع أي جهة، الربط يتم فقط عبر الرابط الرسمي الصادر من حسابك.";
                $this->telegramService->sendMessage($chatId, $msg, $this->keyboardService->unlinkedGuestKeyboard());
                break;

            case '🔐 استعادة كلمة المرور':
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_AWAITING_RECOVERY_CONTACT);
                $msg = "🔐 <b>استعادة كلمة المرور — منصة خطوتك</b>\n\n" .
                    "للتحقق من هويتك بأمان، يرجى الضغط على الزر بالأسفل لمشاركة رقم هاتفك المسجل في المنصة.\n\n" .
                    "⚠️ <i>ملاحظة: يجب استخدام الزر الرسمي لمشاركة جهة الاتصال، ولن يُقبل إدخال الرقم كنص.</i>";
                $this->telegramService->sendMessage($chatId, $msg, $this->keyboardService->requestContactKeyboard());
                break;

            case '👨‍👩‍👧 خدمات ولي الأمر':
            case '➕ ربط طالب إضافي':
                $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_AWAITING_GUARDIAN_CONTACT);
                $msg = "👨‍👩‍👧 <b>خدمات أولياء الأمور — منصة خطوتك ❤️</b>\n\n" .
                    "لمتابعة نتائج الأبناء وتقاريرهم الأسبوعية، يرجى مشاركة رقم هاتف ولي الأمر المسجل في بيانات الطلاب بالضغط على الزر بالأسفل:";
                $this->telegramService->sendMessage($chatId, $msg, $this->keyboardService->requestContactKeyboard('📱 مشاركة رقم هاتف ولي الأمر للتحقق'));
                break;

            case '👨‍🎓 استعراض تقارير الأبناء':
                $students = $this->guardianService->getLinkedStudents($telegramUser);
                if ($students->isEmpty()) {
                    $this->telegramService->sendMessage(
                        $chatId,
                        "ℹ️ لا يوجد أبناء مرتبطون بحسابك حالياً. اضغط على «➕ ربط طالب إضافي» للمزامنة برقم الهاتف.",
                        $this->keyboardService->guardianKeyboard()
                    );
                } else {
                    $listText = "👨‍👧‍👦 <b>الأبناء المرتبطون بحسابك:</b>\n\n";
                    foreach ($students as $idx => $student) {
                        $num = $idx + 1;
                        $grade = $student->grade ?? 'غير محدد';
                        $listText .= "{$num}. <b>{$student->name}</b> (الصف: {$grade})\n";
                    }
                    $listText .= "\n💡 ستصلك إشعارات فورية بالدرجات والتقارير الأسبوعية هنا مباشرة.";
                    $this->telegramService->sendMessage($chatId, $listText, $this->keyboardService->guardianKeyboard());
                }
                break;

            case '⚙️ إعدادات الحساب':
                $msg = "⚙️ <b>إعدادات الحساب والتنبيهات:</b>\n\nاختر الإجراء المطلوب من القائمة بالأسفل:";
                $this->telegramService->sendMessage($chatId, $msg, $this->keyboardService->settingsKeyboard());
                break;

            case '🏠 القائمة الرئيسية':
                $this->sendRoleBasedWelcome($telegramUser);
                break;

            case '🎁 العروض وأكواد الهدايا':
                $msg = "🎁 <b>العروض وأكواد الهدايا</b>\n\n" .
                    "تابع أحدث العروض والخصومات المتاحة لحسابك، أو اكتب كود الهدية وسنقوم بفحصه وتفعيله فوراً على المنصة.";
                $this->telegramService->sendMessage($chatId, $msg, $this->getKeyboardForUser($telegramUser));
                break;

            case '🛠 الدعم الفني':
                $msg = "🛠 <b>فريق الدعم الفني — منصة خطوتك</b>\n\n" .
                    "نسعد دائماً بمساعدتك في حال واجهت أي استفسار أو مشكلة فنية.\n\n" .
                    "• البريد الرسمي: support@khotwtk.com\n" .
                    "• أوقات العمل: يومياً من 9 صباحاً حتى 10 مساءً.";
                $this->telegramService->sendMessage($chatId, $msg, $this->getKeyboardForUser($telegramUser));
                break;

            default:
                $this->telegramService->sendMessage(
                    $chatId,
                    "عذراً، لم أفهم طلبك. يمكنك اختيار إحدى الخدمات من القائمة بالأسفل، أو إرسال <b>/help</b> للمساعدة.",
                    $this->getKeyboardForUser($telegramUser)
                );
                break;
        }
    }

    /**
     * Handle received contact payload for Password Recovery and Guardian linking.
     */
    protected function handleContactReceived(TelegramUser $telegramUser, array $contact): void
    {
        $currentState = $this->stateEngine->getState($telegramUser);

        // Case 1: Password Recovery
        if ($currentState === ConversationStateEngine::STATE_AWAITING_RECOVERY_CONTACT) {
            $result = $this->recoveryService->processRecoveryContact($telegramUser, $contact);

            if (!$result['success']) {
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    $result['user_message'],
                    $this->keyboardService->unlinkedGuestKeyboard()
                );
            }
            // Note: If success, processRecoveryContact already sent the secure link

            $this->stateEngine->clearState($telegramUser);
            return;
        }

        // Case 2: Guardian Linking
        if ($currentState === ConversationStateEngine::STATE_AWAITING_GUARDIAN_CONTACT) {
            // Anti-spoofing check
            $senderId = $contact['user_id'] ?? null;
            if (!$senderId || (int)$senderId !== (int)$telegramUser->telegram_user_id) {
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    "❌ <b>فشل التحقق الأمني:</b> يجب مشاركة جهة الاتصال الخاصة بحسابك فقط عبر الزر الرسمي بالأسفل.",
                    $this->keyboardService->cancelKeyboard()
                );
                return;
            }

            $rawPhone = $contact['phone_number'] ?? '';
            $linkResult = $this->guardianService->linkGuardianByParentPhone($telegramUser, $rawPhone);

            if ($linkResult['success']) {
                $studentNames = $linkResult['students']->pluck('name')->implode('، ');
                $msg = "🎉 <b>تم ربط حساب ولي الأمر بنجاح!</b>\n\n" .
                    "تم العثور على <b>{$linkResult['count']}</b> من الأبناء:\n" .
                    "👨‍🎓 <b>{$studentNames}</b>\n\n" .
                    "ستصلك الآن تقارير الدرجات والامتحانات الأسبوعية تلقائياً.";
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    $msg,
                    $this->keyboardService->guardianKeyboard()
                );
            } else {
                $this->telegramService->sendMessage(
                    $telegramUser->telegram_chat_id,
                    $linkResult['message'],
                    $this->keyboardService->unlinkedGuestKeyboard()
                );
            }

            $this->stateEngine->clearState($telegramUser);
            return;
        }

        // Default: Contact sent outside of any prompt
        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            "ℹ️ تم استلام جهة الاتصال. إذا كنت ترغب في استعادة كلمة المرور أو ربط حساب ولي الأمر، يرجى اختيار الخدمة المناسبة من القائمة أولاً.",
            $this->getKeyboardForUser($telegramUser)
        );
        $this->stateEngine->clearState($telegramUser);
    }

    /**
     * Process callback queries.
     */
    protected function processCallbackQuery(array $callbackQuery): void
    {
        Log::info('TelegramUpdateProcessor: Callback query received', [
            'id' => $callbackQuery['id'] ?? null,
            'data' => $callbackQuery['data'] ?? null,
        ]);
    }

    /**
     * Get keyboard appropriate for user's linked status and role.
     */
    protected function getKeyboardForUser(TelegramUser $telegramUser): array
    {
        if (!$telegramUser->is_linked) {
            if ($telegramUser->role === 'guardian') {
                return $this->keyboardService->guardianKeyboard();
            }
            return $this->keyboardService->unlinkedGuestKeyboard();
        }

        if ($telegramUser->role === 'student') {
            return $this->keyboardService->studentKeyboard();
        }

        if ($telegramUser->role === 'doctor') {
            return $this->keyboardService->doctorKeyboard();
        }

        if ($telegramUser->role === 'teacher') {
            return $this->keyboardService->teacherKeyboard();
        }

        return $this->keyboardService->unlinkedGuestKeyboard();
    }
}
