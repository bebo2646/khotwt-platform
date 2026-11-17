<?php

namespace App\Services;

use App\Models\TelegramSupportTicket;
use App\Models\TelegramSupportMessage;
use App\Models\TelegramUser;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class TelegramSupportService
{
    protected TelegramService $telegramService;
    protected ConversationStateEngine $stateEngine;

    public const CATEGORIES = [
        'login_issues' => '🔐 تسجيل الدخول والحسابات',
        'payments'     => '💳 الاشتراكات والمدفوعات',
        'videos'       => '🎥 الفيديوهات والمحاضرات',
        'exams'        => '📝 الامتحانات والنتائج',
        'other'        => '💬 مشكلة أخرى',
    ];

    public function __construct(
        TelegramService $telegramService,
        ConversationStateEngine $stateEngine
    ) {
        $this->telegramService = $telegramService;
        $this->stateEngine = $stateEngine;
    }

    /**
     * Show issue categories to user.
     */
    public function promptCategorySelection(TelegramUser $telegramUser): void
    {
        $text = "🛠 <b>مركز الدعم الفني — منصة خطوتك</b>\n\n" .
            "يسعدنا مساعدتك! يرجى اختيار تصنيف المشكلة التي تواجهها من القائمة بالأسفل:";

        $buttons = [];
        foreach (self::CATEGORIES as $key => $name) {
            $buttons[] = [
                ['text' => $name, 'callback_data' => "tkt_cat_{$key}"]
            ];
        }
        $buttons[] = [
            ['text' => '🎫 متابعة تذاكري السابقة', 'callback_data' => 'tkt_my_list']
        ];
        $buttons[] = [
            ['text' => '❌ إلغاء', 'callback_data' => 'tkt_cancel']
        ];

        $replyMarkup = ['inline_keyboard' => $buttons];
        $this->telegramService->sendMessage($telegramUser->telegram_chat_id, $text, $replyMarkup);
    }

    /**
     * User selected category, prompt for message.
     */
    public function handleCategorySelected(TelegramUser $telegramUser, string $categoryKey): void
    {
        $categoryName = self::CATEGORIES[$categoryKey] ?? 'مشكلة عامة';

        $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_AWAITING_SUPPORT_MESSAGE, [
            'category' => $categoryKey,
            'category_name' => $categoryName,
        ]);

        $text = "✍️ <b>تفاصيل المشكلة — {$categoryName}</b>\n\n" .
            "يرجى كتابة رسالتك ووصف المشكلة بالتفصيل وسيقوم فريق الدعم الفني بمراجعتها والرد عليك فوراً عبر البوت.\n\n" .
            "<i>(يمكنك إرسال /cancel في أي وقت للإلغاء والعودة للقائمة)</i>";

        $this->telegramService->sendMessage($telegramUser->telegram_chat_id, $text);
    }

    /**
     * Create ticket from user's message.
     */
    public function createTicket(TelegramUser $telegramUser, string $messageText): array
    {
        $payload = $this->stateEngine->getPayload($telegramUser);
        $category = $payload['category'] ?? 'other';
        $categoryName = $payload['category_name'] ?? (self::CATEGORIES[$category] ?? 'مشكلة أخرى');

        $ticketCode = TelegramSupportTicket::generateTicketCode();

        $ticket = TelegramSupportTicket::create([
            'ticket_code' => $ticketCode,
            'telegram_user_id' => $telegramUser->telegram_user_id,
            'user_id' => $telegramUser->user_id,
            'category' => $category,
            'category_name' => $categoryName,
            'status' => TelegramSupportTicket::STATUS_OPEN,
            'subject' => mb_substr($messageText, 0, 100),
            'last_reply_by' => 'user',
        ]);

        // Save initial message
        TelegramSupportMessage::create([
            'ticket_id' => $ticket->id,
            'sender_type' => 'user',
            'sender_telegram_id' => $telegramUser->telegram_user_id,
            'sender_user_id' => $telegramUser->user_id,
            'message_text' => $messageText,
        ]);

        $this->stateEngine->clearState($telegramUser);

        // 1. Confirm to user
        $userConfirm = "✅ <b>تم إنشاء تذكرة الدعم بنجاح!</b>\n\n" .
            "• رقم التذكرة: <code>{$ticketCode}</code>\n" .
            "• التصنيف: <b>{$categoryName}</b>\n\n" .
            "تم إشعار فريق الدعم الفني وسيقوم أحد ممثلي الخدمة بالرد عليك مباشرة هنا فور معالجة طلبك.";

        $this->telegramService->sendMessage($telegramUser->telegram_chat_id, $userConfirm);

        // 2. Dispatch alert to Admin Chat
        $this->notifyAdminNewTicket($ticket, $telegramUser, $messageText);

        return ['success' => true, 'ticket' => $ticket];
    }

    /**
     * Send new ticket notification to Admin Chat ID.
     */
    public function notifyAdminNewTicket(TelegramSupportTicket $ticket, TelegramUser $telegramUser, string $messageText): void
    {
        $adminChatId = config('services.telegram.admin_chat_id') ?: env('TELEGRAM_ADMIN_CHAT_ID');
        if (!$adminChatId) {
            Log::warning('TelegramSupportService: TELEGRAM_ADMIN_CHAT_ID not configured, admin alert skipped.');
            return;
        }

        $userName = trim(($telegramUser->first_name ?: '') . ' ' . ($telegramUser->last_name ?: ''));
        if (empty($userName)) {
            $userName = $telegramUser->user?->name ?: 'مستخدم غير معروف';
        }

        $roleArabic = [
            'student'  => 'طالب',
            'teacher'  => 'معلم',
            'doctor'   => 'دكتور جامعة',
            'guardian' => 'ولي أمر',
            'guest'    => 'زائر',
            'admin'    => 'مسؤول',
        ][$telegramUser->role] ?? $telegramUser->role;

        $platformUser = $telegramUser->user ? "#{$telegramUser->user->id} ({$telegramUser->user->name})" : "غير مرتبط بالمنصة";
        $phone = $telegramUser->user?->phone ?: ($telegramUser->phone ?: 'غير مسجل');

        $adminText = "🎫 <b>تذكرة دعم فني جديدة!</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "• رقم التذكرة: <code>{$ticket->ticket_code}</code>\n" .
            "• المستخدم: <b>{$userName}</b>\n" .
            "• Telegram ID: <code>{$telegramUser->telegram_user_id}</code>\n" .
            "• حساب المنصة: <b>{$platformUser}</b>\n" .
            "• الدور: <b>{$roleArabic}</b> | الهاتف: <code>{$phone}</code>\n" .
            "• التصنيف: <b>{$ticket->category_name}</b>\n" .
            "• التاريخ: <b>" . Carbon::now()->format('Y-m-d H:i') . "</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "📝 <b>نص الرسالة:</b>\n" .
            htmlspecialchars($messageText) . "\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "اختر الإجراء المطلوب:";

        $inlineKeyboard = [
            [
                ['text' => '💬 الرد على المستخدم', 'callback_data' => "adm_rep_tkt_{$ticket->id}"],
                ['text' => '⏳ قيد المعالجة', 'callback_data' => "adm_prog_tkt_{$ticket->id}"],
            ],
            [
                ['text' => '🔒 إغلاق التذكرة', 'callback_data' => "adm_cls_tkt_{$ticket->id}"],
            ]
        ];

        try {
            $this->telegramService->sendMessage($adminChatId, $adminText, ['inline_keyboard' => $inlineKeyboard]);
        } catch (\Throwable $e) {
            Log::error('TelegramSupportService: Failed to notify admin: ' . $e->getMessage());
        }
    }

    /**
     * Start admin reply flow.
     */
    public function startAdminReply(TelegramUser $adminUser, int $ticketId): void
    {
        $ticket = TelegramSupportTicket::find($ticketId);
        if (!$ticket) {
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "❌ التذكرة غير موجودة.");
            return;
        }

        $this->stateEngine->setState($adminUser, ConversationStateEngine::STATE_ADMIN_REPLYING_TICKET, [
            'ticket_id' => $ticket->id,
            'ticket_code' => $ticket->ticket_code,
            'client_telegram_id' => $ticket->telegram_user_id,
        ]);

        $text = "💬 <b>الرد على التذكرة <code>{$ticket->ticket_code}</code></b>\n\n" .
            "اكتب نص الرد الذي ترغب في إرساله للمستخدم الآن:\n" .
            "<i>(سيتم تسليم ردك للمستخدم فوراً عبر البوت، أو أرسل /cancel للإلغاء)</i>";

        $this->telegramService->sendMessage($adminUser->telegram_chat_id, $text);
    }

    /**
     * Deliver admin reply to ticket owner.
     */
    public function deliverAdminReply(TelegramUser $adminUser, string $replyText): void
    {
        $payload = $this->stateEngine->getPayload($adminUser);
        $ticketId = $payload['ticket_id'] ?? null;
        $ticket = TelegramSupportTicket::find($ticketId);

        if (!$ticket) {
            $this->stateEngine->clearState($adminUser);
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "❌ التذكرة غير موجودة.");
            return;
        }

        // Save admin message
        TelegramSupportMessage::create([
            'ticket_id' => $ticket->id,
            'sender_type' => 'admin',
            'sender_telegram_id' => $adminUser->telegram_user_id,
            'sender_user_id' => $adminUser->user_id,
            'message_text' => $replyText,
        ]);

        $ticket->update([
            'status' => TelegramSupportTicket::STATUS_IN_PROGRESS,
            'last_reply_by' => 'admin',
        ]);

        $this->stateEngine->clearState($adminUser);

        // Notify client
        $clientMessage = "💬 <b>رد من فريق الدعم الفني — منصة خطوتك</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "• بخصوص التذكرة: <code>{$ticket->ticket_code}</code>\n" .
            "• التصنيف: <b>{$ticket->category_name}</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n\n" .
            htmlspecialchars($replyText) . "\n\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "💡 <i>إذا كانت لديك أي استفسارات إضافية، يمكنك الرد على هذه الرسالة مباشرة.</i>";

        try {
            $this->telegramService->sendMessage($ticket->telegram_user_id, $clientMessage);
            $this->telegramService->sendMessage(
                $adminUser->telegram_chat_id,
                "✅ <b>تم إرسال ردك بنجاح</b> إلى صاحب التذكرة <code>{$ticket->ticket_code}</code>."
            );
        } catch (\Throwable $e) {
            Log::error('TelegramSupportService: Failed to deliver reply to user: ' . $e->getMessage());
            $this->telegramService->sendMessage(
                $adminUser->telegram_chat_id,
                "⚠️ تم حفظ الرد، لكن تعذر إرساله للمستخدم عبر Telegram: " . $e->getMessage()
            );
        }
    }

    /**
     * Update ticket status (in_progress, closed).
     */
    public function updateTicketStatus(TelegramUser $adminUser, int $ticketId, string $status): void
    {
        $ticket = TelegramSupportTicket::find($ticketId);
        if (!$ticket) {
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, "❌ التذكرة غير موجودة.");
            return;
        }

        $ticket->status = $status;
        if ($status === TelegramSupportTicket::STATUS_CLOSED) {
            $ticket->closed_at = Carbon::now();
        }
        $ticket->save();

        $statusArabic = [
            TelegramSupportTicket::STATUS_IN_PROGRESS => 'قيد المعالجة ⏳',
            TelegramSupportTicket::STATUS_CLOSED => 'مغلقة 🔒',
        ][$status] ?? $status;

        $this->telegramService->sendMessage(
            $adminUser->telegram_chat_id,
            "✅ تم تحديث حالة التذكرة <code>{$ticket->ticket_code}</code> إلى: <b>{$statusArabic}</b>"
        );

        // Notify client of status change
        if ($status === TelegramSupportTicket::STATUS_CLOSED) {
            $clientNote = "🔒 <b>إغلاق تذكرة الدعم الفني</b>\n\n" .
                "تم إغلاق تذكرتك رقم <code>{$ticket->ticket_code}</code> بنجاح.\n" .
                "نشكر تواصلك معنا ونتمنى أن نكون قد قدمنا لك الدعم المطلوب! يمكنك فتح تذكرة جديدة في أي وقت.";
            try {
                $this->telegramService->sendMessage($ticket->telegram_user_id, $clientNote);
            } catch (\Throwable $e) {
                // silent catch
            }
        }
    }

    /**
     * Show user's active & past tickets.
     */
    public function showUserTickets(TelegramUser $telegramUser): void
    {
        $tickets = TelegramSupportTicket::where('telegram_user_id', $telegramUser->telegram_user_id)
            ->latest()
            ->limit(10)
            ->get();

        if ($tickets->isEmpty()) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "ℹ️ ليس لديك أي تذاكر دعم فني مسجلة حتى الآن.\nاضغط على «🛠 الدعم الفني» لإنشاء طلب جديد."
            );
            return;
        }

        $text = "📋 <b>سجل تذاكر الدعم الفني الخاصة بك:</b>\n\n";

        foreach ($tickets as $idx => $t) {
            $statusIcon = [
                TelegramSupportTicket::STATUS_OPEN => '🟡 مفتوحة',
                TelegramSupportTicket::STATUS_IN_PROGRESS => '🔵 قيد المعالجة',
                TelegramSupportTicket::STATUS_CLOSED => '🟢 مغلقة',
            ][$t->status] ?? $t->status;

            $date = $t->created_at ? $t->created_at->format('Y-m-d') : '-';
            $num = $idx + 1;

            $text .= "<b>{$num}. <code>{$t->ticket_code}</code></b> | {$statusIcon}\n";
            $text .= "• التصنيف: {$t->category_name}\n";
            $text .= "• التاريخ: {$date}\n";
            if ($t->subject) {
                $text .= "• الملخص: <i>" . htmlspecialchars(mb_substr($t->subject, 0, 50)) . "...</i>\n";
            }
            $text .= "────────────────\n";
        }

        $this->telegramService->sendMessage($telegramUser->telegram_chat_id, $text);
    }
}
