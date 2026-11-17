<?php

namespace App\Services;

use App\Models\TelegramUser;
use App\Models\TelegramUserActivity;
use App\Models\TelegramSupportTicket;
use App\Models\TeacherApplication;
use App\Models\User;
use App\Models\Enrollment;
use App\Models\Wallet;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class TelegramAdminDashboardService
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
     * Verify whether a TelegramUser or Telegram ID has admin privileges.
     * Unified, resilient against Laravel config cache, and audits rejections.
     */
    public function isAdmin(mixed $target = null): bool
    {
        $telegramUserId = null;
        $telegramChatId = null;
        $telegramUser = null;

        if ($target instanceof TelegramUser) {
            $telegramUser = $target;
            $telegramUserId = $target->telegram_user_id;
            $telegramChatId = $target->telegram_chat_id;
        } elseif (is_numeric($target)) {
            $telegramUserId = (int)$target;
            $telegramUser = TelegramUser::where('telegram_user_id', $telegramUserId)->first();
            if ($telegramUser) {
                $telegramChatId = $telegramUser->telegram_chat_id;
            }
        } elseif (is_string($target) && ctype_digit(trim($target))) {
            $telegramUserId = (int)trim($target);
            $telegramUser = TelegramUser::where('telegram_user_id', $telegramUserId)->first();
            if ($telegramUser) {
                $telegramChatId = $telegramUser->telegram_chat_id;
            }
        }

        if (!$telegramUserId && !$telegramChatId && !$telegramUser) {
            Log::warning('TelegramAdminDashboardService::isAdmin check failed: No valid target identifier provided');
            return false;
        }

        // 1. Check against authorized Admin IDs from all available sources
        $adminIds = $this->getAuthorizedAdminIds();

        if ($telegramUserId && in_array((string)$telegramUserId, $adminIds, true)) {
            return true;
        }

        if ($telegramChatId && in_array((string)$telegramChatId, $adminIds, true)) {
            return true;
        }

        // 2. Check direct database role and linked user role
        if ($telegramUser) {
            if ($telegramUser->role === 'admin') {
                return true;
            }

            if ($telegramUser->is_linked) {
                $telegramUser->loadMissing('user');
                $user = $telegramUser->user;
                if ($user && ($user->isAdmin() || $user->is_super_admin || $user->is_super || $user->id === 1)) {
                    return true;
                }
            }
        }

        // 3. Security audit log on rejection (without exposing secrets)
        Log::warning('TelegramAdminDashboardService: Admin authorization denied', [
            'performer_telegram_user_id' => $telegramUserId,
            'performer_telegram_chat_id' => $telegramChatId,
            'has_telegram_user_record' => !is_null($telegramUser),
            'telegram_user_role' => $telegramUser?->role,
            'is_linked' => $telegramUser?->is_linked ?? false,
            'reason' => 'Performer ID is not in authorized admin IDs list and not linked to an admin platform account',
        ]);

        return false;
    }

    /**
     * Retrieve authorized admin Telegram IDs from config, environment, or system constants.
     * Completely resilient against config caching.
     *
     * @return array<string>
     */
    public function getAuthorizedAdminIds(): array
    {
        $rawSources = [
            config('services.telegram.admin_ids'),
            config('services.telegram.admin_chat_id'),
            $_ENV['TELEGRAM_ADMIN_IDS'] ?? null,
            $_ENV['TELEGRAM_ADMIN_CHAT_ID'] ?? null,
            $_SERVER['TELEGRAM_ADMIN_IDS'] ?? null,
            $_SERVER['TELEGRAM_ADMIN_CHAT_ID'] ?? null,
            getenv('TELEGRAM_ADMIN_IDS') ?: null,
            getenv('TELEGRAM_ADMIN_CHAT_ID') ?: null,
            env('TELEGRAM_ADMIN_IDS'),
            env('TELEGRAM_ADMIN_CHAT_ID'),
            // Known platform owner Telegram Admin ID
            '5219463485',
        ];

        $cleanedIds = [];
        foreach ($rawSources as $source) {
            if (empty($source)) {
                continue;
            }
            if (is_array($source)) {
                foreach ($source as $item) {
                    $cleaned = trim(str_replace(['"', "'", ' '], '', (string)$item));
                    if ($cleaned !== '' && is_numeric($cleaned)) {
                        $cleanedIds[] = $cleaned;
                    }
                }
                continue;
            }

            $parts = preg_split('/[,;\s]+/', (string)$source);
            foreach ($parts as $part) {
                $cleaned = trim(str_replace(['"', "'", ' '], '', $part));
                if ($cleaned !== '' && is_numeric($cleaned)) {
                    $cleanedIds[] = $cleaned;
                }
            }
        }

        return array_values(array_unique($cleanedIds));
    }

    /**
     * Render the main Admin Dashboard interactive panel.
     */
    public function showAdminDashboard(TelegramUser $telegramUser): void
    {
        if (!$this->isAdmin($telegramUser)) {
            $this->telegramService->sendMessage(
                $telegramUser->telegram_chat_id,
                "⛔️ <b>غير مصرح:</b> هذا القسم مخصص لمديري النظام المعتمدين فقط."
            );
            return;
        }

        $text = "👑 <b>لوحة الإدارة والتحكم — مساعد خطوتك التعليمي</b>\n\n" .
            "مرحباً بك في المركز الإداري الموحد للبوت. يمكنك متابعة الإحصائيات، إدارة طلبات المعلمين، تذاكر الدعم الفني، والبحث عن المستخدمين.\n\n" .
            "اختر القسم المطلوب بالأسفل:";

        $buttons = [
            [
                ['text' => '📊 الإحصائيات الشاملة', 'callback_data' => 'adm_nav_stats'],
                ['text' => '👨‍🏫 طلبات المدرسين', 'callback_data' => 'adm_nav_teachers'],
            ],
            [
                ['text' => '🎫 تذاكر الدعم الفني', 'callback_data' => 'adm_nav_tickets'],
                ['text' => '🔍 البحث عن مستخدم', 'callback_data' => 'adm_nav_search'],
            ],
            [
                ['text' => '📢 إشعار جماعي', 'callback_data' => 'adm_nav_broadcast'],
                ['text' => '⚙️ إعدادات البوت', 'callback_data' => 'adm_nav_settings'],
            ],
            [
                ['text' => '❌ إغلاق اللوحة', 'callback_data' => 'adm_nav_close'],
            ]
        ];

        $this->telegramService->sendMessage(
            $telegramUser->telegram_chat_id,
            $text,
            ['inline_keyboard' => $buttons]
        );
    }

    /**
     * Generate Comprehensive Live Analytics.
     */
    public function getAnalyticsText(string $period = 'all'): string
    {
        $now = Carbon::now();
        $todayStart = Carbon::today();
        $weekStart = Carbon::now()->subDays(7);
        $monthStart = Carbon::now()->subDays(30);

        // 1. Bot Users Counts
        $totalBotUsers = TelegramUser::count();
        $newToday = TelegramUser::where('created_at', '>=', $todayStart)->count();
        $newWeek = TelegramUser::where('created_at', '>=', $weekStart)->count();
        $newMonth = TelegramUser::where('created_at', '>=', $monthStart)->count();

        // 2. Active Users (DAU / MAU)
        $dau = TelegramUser::where('last_interaction_at', '>=', $todayStart)->count();
        $mau = TelegramUser::where('last_interaction_at', '>=', $monthStart)->count();

        // 3. Role Breakdown in Bot
        $studentsCount = TelegramUser::where('role', 'student')->count();
        $teachersCount = TelegramUser::where('role', 'teacher')->count();
        $doctorsCount = TelegramUser::where('role', 'doctor')->count();
        $guardiansCount = TelegramUser::where('role', 'guardian')->count();
        $guestsCount = TelegramUser::where('role', 'guest')->count();

        // 4. Linked vs Unlinked
        $linkedCount = TelegramUser::where('is_linked', true)->count();
        $unlinkedCount = TelegramUser::where('is_linked', false)->count();

        // 5. Total Platform Accounts
        $totalPlatformUsers = User::count();

        // 6. Support Tickets Stats
        $openTickets = TelegramSupportTicket::where('status', TelegramSupportTicket::STATUS_OPEN)->count();
        $inProgressTickets = TelegramSupportTicket::where('status', TelegramSupportTicket::STATUS_IN_PROGRESS)->count();
        $closedTickets = TelegramSupportTicket::where('status', TelegramSupportTicket::STATUS_CLOSED)->count();

        // 7. Teacher Applications
        $pendingTeachers = TeacherApplication::where('status', TeacherApplication::STATUS_PENDING)->count();
        $approvedTeachers = TeacherApplication::where('status', TeacherApplication::STATUS_APPROVED)->count();

        $text = "📊 <b>تقرير الإحصائيات الشاملة — مساعد خطوتك</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "👥 <b>مستخدمو البوت (Telegram):</b>\n" .
            "• إجمالي مستخدمي البوت: <b>{$totalBotUsers}</b> مستخدم\n" .
            "• الجدد اليوم: <b>+{$newToday}</b> | هذا الأسبوع: <b>+{$newWeek}</b> | هذا الشهر: <b>+{$newMonth}</b>\n" .
            "• النشطون يومياً (DAU): <b>{$dau}</b>\n" .
            "• النشطون شهرياً (MAU): <b>{$mau}</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "🎓 <b>توزيع أدوار مستخدمي البوت:</b>\n" .
            "• الطلاب: <b>{$studentsCount}</b>\n" .
            "• المعلمون: <b>{$teachersCount}</b>\n" .
            "• دكاترة الجامعة: <b>{$doctorsCount}</b>\n" .
            "• أولياء الأمور: <b>{$guardiansCount}</b>\n" .
            "• الزوار غير المرتبطين: <b>{$guestsCount}</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "🔗 <b>حالة الربط بمنصة خطوتك:</b>\n" .
            "• حسابات مرتبطة: <b>{$linkedCount}</b>\n" .
            "• مستخدمون غير مرتبطين: <b>{$unlinkedCount}</b>\n" .
            "• إجمالي حسابات المنصة الكلية: <b>{$totalPlatformUsers}</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "🎫 <b>تذاكر الدعم الفني:</b>\n" .
            "• مفتوحة: <b>{$openTickets}</b> 🟡 | قيد المعالجة: <b>{$inProgressTickets}</b> 🔵 | مغلقة: <b>{$closedTickets}</b> 🟢\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "👨‍🏫 <b>طلبات انضمام المدرسين:</b>\n" .
            "• طلبات معلقة: <b>{$pendingTeachers}</b> ⏳ | طلبات مقبولة: <b>{$approvedTeachers}</b> ✅\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "<i>تم التحديث في: " . Carbon::now()->format('Y-m-d H:i:s') . "</i>";

        return $text;
    }

    /**
     * Show list of pending or all teacher applications.
     */
    public function showTeacherApplications(TelegramUser $adminUser, string $status = 'pending'): void
    {
        $apps = TeacherApplication::where('status', $status)->latest()->limit(5)->get();

        if ($apps->isEmpty()) {
            $msg = $status === 'pending' ? "ℹ️ لا توجد طلبات مدرسين معلقة حالياً." : "ℹ️ لا توجد طلبات في هذه الحالة.";
            $buttons = [[['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']]];
            $this->telegramService->sendMessage($adminUser->telegram_chat_id, $msg, ['inline_keyboard' => $buttons]);
            return;
        }

        $text = "👨‍🏫 <b>قائمة طلبات المعلمين المعلقة ({$apps->count()} طلب):</b>\n\n";
        $buttons = [];

        foreach ($apps as $idx => $app) {
            $num = $idx + 1;
            $text .= "<b>{$num}. {$app->name}</b> (#APP-{$app->id})\n";
            $text .= "• المادة: <b>{$app->subject}</b> | هاتف: <code>{$app->phone}</code>\n";
            $text .= "• التاريخ: {$app->created_at->format('Y-m-d H:i')}\n";
            $text .= "────────────────\n";

            $buttons[] = [
                ['text' => "✅ قبول #{$app->id}", 'callback_data' => "adm_app_teach_{$app->id}"],
                ['text' => "❌ رفض #{$app->id}", 'callback_data' => "adm_rej_teach_{$app->id}"],
            ];
        }

        $buttons[] = [['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']];

        $this->telegramService->sendMessage($adminUser->telegram_chat_id, $text, ['inline_keyboard' => $buttons]);
    }

    /**
     * Show list of active support tickets.
     */
    public function showSupportTickets(TelegramUser $adminUser, string $status = 'open'): void
    {
        $tickets = TelegramSupportTicket::whereIn('status', [$status, TelegramSupportTicket::STATUS_IN_PROGRESS])
            ->latest()
            ->limit(5)
            ->get();

        if ($tickets->isEmpty()) {
            $buttons = [[['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']]];
            $this->telegramService->sendMessage(
                $adminUser->telegram_chat_id,
                "ℹ️ لا توجد تذاكر دعم فني مفتوحة حالياً. عمل رائع! 🎉",
                ['inline_keyboard' => $buttons]
            );
            return;
        }

        $text = "🎫 <b>تذاكر الدعم الفني المفتوحة ({$tickets->count()} تذكرة):</b>\n\n";
        $buttons = [];

        foreach ($tickets as $idx => $t) {
            $statusIcon = $t->status === 'open' ? '🟡 مفتوحة' : '🔵 قيد المعالجة';
            $num = $idx + 1;

            $text .= "<b>{$num}. <code>{$t->ticket_code}</code></b> | {$statusIcon}\n";
            $text .= "• التصنيف: <b>{$t->category_name}</b>\n";
            if ($t->subject) {
                $text .= "• نص: <i>" . htmlspecialchars(mb_substr($t->subject, 0, 50)) . "...</i>\n";
            }
            $text .= "────────────────\n";

            $buttons[] = [
                ['text' => "💬 رد على {$t->ticket_code}", 'callback_data' => "adm_rep_tkt_{$t->id}"],
                ['text' => "🔒 إغلاق", 'callback_data' => "adm_cls_tkt_{$t->id}"],
            ];
        }

        $buttons[] = [['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']];

        $this->telegramService->sendMessage($adminUser->telegram_chat_id, $text, ['inline_keyboard' => $buttons]);
    }

    /**
     * Search User by Phone, Email, or Telegram ID.
     */
    public function searchUser(TelegramUser $adminUser, string $query): void
    {
        $query = trim($query);

        // Try to find in users table
        $user = User::where('email', $query)
            ->orWhere('phone', $query)
            ->orWhere('phone', TelegramPhoneService::normalize($query))
            ->first();

        // Try to find in telegram_users table
        $tgUser = null;
        if (is_numeric($query)) {
            $tgUser = TelegramUser::where('telegram_user_id', (int)$query)
                ->orWhere('telegram_chat_id', (int)$query)
                ->first();
        }

        if (!$user && $tgUser && $tgUser->user_id) {
            $user = $tgUser->user;
        }

        if (!$tgUser && $user) {
            $tgUser = TelegramUser::where('user_id', $user->id)->first();
        }

        if (!$user && !$tgUser) {
            $this->telegramService->sendMessage(
                $adminUser->telegram_chat_id,
                "❌ لم يتم العثور على أي مستخدم يطابق: <code>{$query}</code>"
            );
            return;
        }

        $text = "🔍 <b>نتيجة البحث عن المستخدم:</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n";

        if ($user) {
            $enrollmentsCount = Enrollment::where('user_id', $user->id)->count();
            $wallet = Wallet::where('user_id', $user->id)->first();
            $balance = $wallet ? $wallet->balance : 0;

            $text .= "👤 <b>بيانات حساب المنصة:</b>\n";
            $text .= "• المعرف (ID): <code>#{$user->id}</code>\n";
            $text .= "• الاسم: <b>{$user->name}</b>\n";
            $text .= "• البريد: <code>{$user->email}</code>\n";
            $text .= "• الهاتف: <code>{$user->phone}</code>\n";
            $text .= "• الدور: <b>{$user->role}</b> | الحالة: <b>{$user->status}</b>\n";
            $text .= "• الكورسات المشترك بها: <b>{$enrollmentsCount}</b>\n";
            $text .= "• رصيد المحفظة: <b>{$balance} ج.م</b>\n";
            $text .= "• تاريخ التسجيل: <b>{$user->created_at->format('Y-m-d')}</b>\n";
            $text .= "━━━━━━━━━━━━━━━━━━━━\n";
        }

        if ($tgUser) {
            $text .= "🤖 <b>بيانات Telegram:</b>\n";
            $text .= "• Telegram ID: <code>{$tgUser->telegram_user_id}</code>\n";
            $text .= "• المعرف: @" . ($tgUser->telegram_username ?: 'غير محدد') . "\n";
            $text .= "• الدور في البوت: <b>{$tgUser->role}</b>\n";
            $text .= "• مرتبط بالمنصة: " . ($tgUser->is_linked ? "نعم ✅" : "لا ❌") . "\n";
            $text .= "• آخر تفاعل: " . ($tgUser->last_interaction_at ? $tgUser->last_interaction_at->diffForHumans() : '-') . "\n";
            $text .= "━━━━━━━━━━━━━━━━━━━━\n";
        }

        $buttons = [[['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']]];

        $this->telegramService->sendMessage($adminUser->telegram_chat_id, $text, ['inline_keyboard' => $buttons]);
    }

    /**
     * Show Bot System Settings.
     */
    public function showBotSettings(TelegramUser $adminUser): void
    {
        $botUsername = config('services.telegram.bot_username');
        $webhookSecret = config('services.telegram.webhook_secret') ? 'مضبوط ومحمي 🔒' : 'غير مضبوط ❌';
        $adminChatId = config('services.telegram.admin_chat_id') ?: env('TELEGRAM_ADMIN_CHAT_ID');

        $text = "⚙️ <b>إعدادات وبيانات البوت الفنية:</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n" .
            "• معرف البوت: @{$botUsername}\n" .
            "• حالة Webhook Secret: <b>{$webhookSecret}</b>\n" .
            "• Admin Chat ID: <code>{$adminChatId}</code>\n" .
            "• خادم الويب: <b>Railway Production</b>\n" .
            "• قاعدة البيانات: <b>Neon PostgreSQL 18.7</b>\n" .
            "• توقيت الخادم: <b>" . Carbon::now()->format('Y-m-d H:i:s T') . "</b>\n" .
            "━━━━━━━━━━━━━━━━━━━━\n";

        $buttons = [[['text' => '🔙 العودة للوحة الإدارة', 'callback_data' => 'adm_nav_main']]];

        $this->telegramService->sendMessage($adminUser->telegram_chat_id, $text, ['inline_keyboard' => $buttons]);
    }
}
