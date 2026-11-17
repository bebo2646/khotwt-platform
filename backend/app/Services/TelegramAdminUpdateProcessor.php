<?php

namespace App\Services;

use App\Models\TelegramUser;
use App\Models\TelegramSupportTicket;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class TelegramAdminUpdateProcessor
{
    protected TelegramAdminService $telegramAdminService;
    protected ConversationStateEngine $stateEngine;
    protected TelegramAdminDashboardService $adminDashboardService;
    protected TelegramSupportService $supportService;
    protected TelegramTeacherApplicationService $teacherAppService;

    public function __construct(
        TelegramAdminService $telegramAdminService,
        ConversationStateEngine $stateEngine,
        TelegramAdminDashboardService $adminDashboardService,
        TelegramSupportService $supportService,
        TelegramTeacherApplicationService $teacherAppService
    ) {
        $this->telegramAdminService = $telegramAdminService;
        $this->stateEngine = $stateEngine;
        $this->adminDashboardService = $adminDashboardService;
        $this->supportService = $supportService;
        $this->teacherAppService = $teacherAppService;
    }

    /**
     * Main entry point to process incoming update from the Admin Bot.
     */
    public function process(array $update): void
    {
        // 1. Process message
        if (isset($update['message'])) {
            $this->processMessage($update['message']);
            return;
        }

        // 2. Process callback query
        if (isset($update['callback_query'])) {
            $this->processCallbackQuery($update['callback_query']);
            return;
        }

        Log::info('TelegramAdminUpdateProcessor: Unsupported update type ignored', [
            'update_id' => $update['update_id'] ?? null,
        ]);
    }

    /**
     * Process message received by Admin Bot.
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

        // 1. Strict security: Require Private Chat
        if (($chat['type'] ?? 'private') !== 'private') {
            $this->telegramAdminService->sendMessage(
                $chatId,
                '⚠️ لأسباب أمنية وحماية سرية بيانات المنصة، يجب استخدام بوت الإدارة في المحادثات الخاصة فقط.'
            );
            return;
        }

        // 2. Strict Admin Authorization: Reject any unauthorized user
        if (!$this->adminDashboardService->isAdmin($fromId)) {
            Log::warning('TelegramAdminUpdateProcessor: Unauthorized user attempted access to Admin Bot', [
                'from_id' => $fromId,
                'chat_id' => $chatId,
                'username' => $from['username'] ?? null,
            ]);
            $this->telegramAdminService->sendMessage(
                $chatId,
                '⛔️ <b>وصول مرفوض:</b> هذا البوت مخصص لإدارة منصة خطوتك وفريق الدعم الفني المعتمد فقط.'
            );
            return;
        }

        // 3. Resolve or update TelegramUser record (without auto-linking platform student account)
        $telegramUser = TelegramUser::firstOrCreate(
            ['telegram_user_id' => $fromId],
            [
                'telegram_chat_id' => $chatId,
                'admin_chat_id' => $chatId,
                'telegram_username' => $from['username'] ?? null,
                'first_name' => $from['first_name'] ?? null,
                'last_name' => $from['last_name'] ?? null,
                'role' => 'admin',
                'is_linked' => false,
            ]
        );

        $telegramUser->update([
            'admin_chat_id' => $chatId,
            'telegram_username' => $from['username'] ?? $telegramUser->telegram_username,
            'first_name' => $from['first_name'] ?? $telegramUser->first_name,
            'last_name' => $from['last_name'] ?? $telegramUser->last_name,
            'admin_last_interaction_at' => Carbon::now(),
        ]);

        \App\Models\TelegramUserActivity::recordActivity($fromId, 'admin_message');

        // 4. Handle Active Conversation States in 'admin' scope
        $currentState = $this->stateEngine->getState($telegramUser, 'admin');

        if ($currentState === ConversationStateEngine::STATE_ADMIN_REPLYING_TICKET) {
            $this->supportService->deliverAdminReply($telegramUser, $text);
            return;
        }

        if ($currentState === ConversationStateEngine::STATE_ADMIN_REJECTING_TEACHER) {
            $this->teacherAppService->submitRejection($telegramUser, $text);
            return;
        }

        if ($currentState === ConversationStateEngine::STATE_ADMIN_SEARCHING_USER) {
            $this->stateEngine->clearState($telegramUser, 'admin');
            $this->adminDashboardService->searchUser($telegramUser, $text);
            return;
        }

        // 5. Handle Admin Commands
        if ($text === '/start' || $text === '/admin' || $text === 'لوحة الإدارة') {
            $this->stateEngine->clearState($telegramUser, 'admin');
            $this->adminDashboardService->showAdminDashboard($telegramUser);
            return;
        }

        if ($text === '/help' || $text === 'مساعدة') {
            $this->sendAdminHelp($telegramUser);
            return;
        }

        if ($text === '/cancel' || $text === 'إلغاء') {
            $this->stateEngine->clearState($telegramUser, 'admin');
            $this->telegramAdminService->sendMessage($chatId, "✅ تم إلغاء الإجراء الحالي.");
            $this->adminDashboardService->showAdminDashboard($telegramUser);
            return;
        }

        // If numeric or query looks like a search, execute quick search
        if (strlen($text) >= 3 && !str_starts_with($text, '/')) {
            $this->adminDashboardService->searchUser($telegramUser, $text);
            return;
        }

        // Default: Offer dashboard
        $this->adminDashboardService->showAdminDashboard($telegramUser);
    }

    /**
     * Process callback queries on Admin Bot.
     */
    protected function processCallbackQuery(array $callbackQuery): void
    {
        $id = $callbackQuery['id'] ?? '';
        $from = $callbackQuery['from'] ?? [];
        $data = $callbackQuery['data'] ?? '';
        $fromId = isset($from['id']) ? (int)$from['id'] : null;

        if (!$fromId) {
            return;
        }

        // Acknowledge immediately to dismiss Telegram spinner
        $this->telegramAdminService->answerCallbackQuery($id);

        $chatId = isset($callbackQuery['message']['chat']['id']) 
            ? (int)$callbackQuery['message']['chat']['id'] 
            : $fromId;

        // Strict Admin Authorization
        if (!$this->adminDashboardService->isAdmin($fromId)) {
            Log::warning('TelegramAdminUpdateProcessor: Unauthorized callback query rejected on Admin Bot', [
                'performer_telegram_id' => $fromId,
                'callback_data' => $data,
                'chat_id' => $chatId,
            ]);
            $this->telegramAdminService->sendMessage(
                $chatId,
                "⛔️ <b>غير مصرح:</b> ليس لديك صلاحيات لتنفيذ هذا الإجراء الإداري."
            );
            return;
        }

        // Resolve or update TelegramUser
        $telegramUser = TelegramUser::firstOrCreate(
            ['telegram_user_id' => $fromId],
            [
                'telegram_chat_id' => $chatId,
                'admin_chat_id' => $chatId,
                'telegram_username' => $from['username'] ?? null,
                'first_name' => $from['first_name'] ?? null,
                'last_name' => $from['last_name'] ?? null,
                'role' => 'admin',
                'is_linked' => false,
            ]
        );

        $telegramUser->update([
            'admin_chat_id' => $chatId,
            'telegram_username' => $from['username'] ?? $telegramUser->telegram_username,
            'first_name' => $from['first_name'] ?? $telegramUser->first_name,
            'last_name' => $from['last_name'] ?? $telegramUser->last_name,
            'admin_last_interaction_at' => Carbon::now(),
        ]);

        \App\Models\TelegramUserActivity::recordActivity($fromId, 'admin_callback');

        // Route Admin Callback Actions
        // 1. Support Tickets Actions
        if (str_starts_with($data, 'adm_rep_tkt_')) {
            $ticketId = substr($data, 12);
            $this->supportService->startAdminReply($telegramUser, $ticketId);
            return;
        }

        if (str_starts_with($data, 'adm_prog_tkt_')) {
            $ticketId = substr($data, 13);
            $this->supportService->updateTicketStatus($telegramUser, $ticketId, TelegramSupportTicket::STATUS_IN_PROGRESS);
            return;
        }

        if (str_starts_with($data, 'adm_cls_tkt_')) {
            $ticketId = substr($data, 12);
            $this->supportService->updateTicketStatus($telegramUser, $ticketId, TelegramSupportTicket::STATUS_CLOSED);
            return;
        }

        if (str_starts_with($data, 'adm_usr_tkt_')) {
            $ticketId = substr($data, 12);
            $this->supportService->showComplainantProfile($telegramUser, $ticketId);
            return;
        }

        // 2. Teacher Applications Actions
        if (str_starts_with($data, 'adm_app_teach_')) {
            $appId = substr($data, 14);
            $this->teacherAppService->approveApplication($telegramUser, $appId);
            return;
        }

        if (str_starts_with($data, 'adm_rej_teach_')) {
            $appId = substr($data, 14);
            $this->teacherAppService->startRejectApplication($telegramUser, $appId);
            return;
        }

        // 3. Navigation Sections
        if ($data === 'adm_nav_new_tickets') {
            $this->adminDashboardService->showNewTickets($telegramUser);
            return;
        }

        if ($data === 'adm_nav_tickets') {
            $this->adminDashboardService->showSupportTickets($telegramUser);
            return;
        }

        if ($data === 'adm_nav_teachers') {
            $this->adminDashboardService->showTeacherApplications($telegramUser);
            return;
        }

        if ($data === 'adm_nav_users') {
            $this->adminDashboardService->showUsersManagement($telegramUser);
            return;
        }

        if ($data === 'adm_nav_stats') {
            $text = $this->adminDashboardService->getAnalyticsText();
            $buttons = [[['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']]];
            $this->telegramAdminService->sendMessage($chatId, $text, ['inline_keyboard' => $buttons]);
            return;
        }

        if ($data === 'adm_nav_finance') {
            $this->adminDashboardService->showFinanceOverview($telegramUser);
            return;
        }

        if ($data === 'adm_nav_gifts') {
            $this->adminDashboardService->showGiftCodesOverview($telegramUser);
            return;
        }

        if ($data === 'adm_nav_broadcast') {
            $this->telegramAdminService->sendMessage(
                $chatId,
                "📢 <b>الإشعارات والحملات الإدارية:</b>\n\nلإرسال إشعار جماعي للطلاب أو المعلمين مع احترام خيارات الاشتراك، استخدم لوحة إدارة الحملات أو إرسال الأمر المخصص."
            );
            return;
        }

        if ($data === 'adm_nav_settings') {
            $this->adminDashboardService->showBotSettings($telegramUser);
            return;
        }

        if ($data === 'adm_nav_search') {
            $this->stateEngine->setState($telegramUser, ConversationStateEngine::STATE_ADMIN_SEARCHING_USER, [], 'admin');
            $this->telegramAdminService->sendMessage(
                $chatId,
                "🔍 <b>البحث عن مستخدم:</b>\n\nأرسل رقم الهاتف، البريد الإلكتروني، أو معرف Telegram للبحث:\n<i>(أو أرسل /cancel للإلغاء)</i>"
            );
            return;
        }

        if ($data === 'adm_nav_main') {
            $this->stateEngine->clearState($telegramUser, 'admin');
            $this->adminDashboardService->showAdminDashboard($telegramUser);
            return;
        }

        if ($data === 'adm_nav_close') {
            $this->telegramAdminService->sendMessage($chatId, "تم إغلاق لوحة الإدارة. يمكنك إعادة فتحها بأمر /admin في أي وقت.");
            return;
        }
    }

    /**
     * Send Admin Bot Quick Help Guide.
     */
    protected function sendAdminHelp(TelegramUser $telegramUser): void
    {
        $chatId = $telegramUser->admin_chat_id ?: $telegramUser->telegram_chat_id;
        $help = "📖 <b>دليل استخدام بوت إدارة خطوتك:</b>\n\n" .
            "• <b>/admin</b> أو <b>/start</b>: فتح لوحة التحكم الرئيسية.\n" .
            "• <b>/cancel</b>: إلغاء أي إجراء أو رد جاري والعودة للرئيسية.\n" .
            "• <b>البحث المباشر</b>: يمكنك كتابة رقم هاتف أو إيميل أو Telegram ID في المحادثة مباشرة للبحث الفوري.\n\n" .
            "💡 <i>ملاحظة: كافة الردود التي ترسلها للتذاكر تصل تلقائياً لصاحب الشكوى عبر بوت الطلاب الرسمي.</i>";

        $buttons = [[['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']]];
        $this->telegramAdminService->sendMessage($chatId, $help, ['inline_keyboard' => $buttons]);
    }
}
