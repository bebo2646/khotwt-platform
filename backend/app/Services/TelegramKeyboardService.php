<?php

namespace App\Services;

class TelegramKeyboardService
{
    /**
     * Unlinked / Guest main menu keyboard.
     */
    public function unlinkedGuestKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['🔗 ربط حساب خطوتك', '🔐 استعادة كلمة المرور'],
            ['👨‍👩‍👧 خدمات ولي الأمر', '🎁 العروض وأكواد الهدايا'],
            ['🛠 الدعم الفني'],
        ]);
    }

    /**
     * Student role adaptive keyboard.
     */
    public function studentKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['📚 كورساتي المسجلة', '📝 الامتحانات والواجبات'],
            ['📊 تقاريري ودرجاتي', '🎁 أكواد الهدايا والعروض'],
            ['🔔 التنبيهات التعليمية', '⚙️ إعدادات الحساب'],
        ]);
    }

    /**
     * School Teacher role adaptive keyboard.
     */
    public function teacherKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['📊 تفاصيل اشتراكي والمساحة', '🔄 تجديد أو ترقية الباقة'],
            ['🎟 أكواد الطلاب والتفعيل', '📈 إحصائيات سريعة'],
            ['🎁 العروض والحملات', '⚙️ إعدادات الحساب'],
        ]);
    }

    /**
     * University Doctor role adaptive keyboard.
     */
    public function doctorKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['📊 باقة الدكتور والمساحة', '🔄 تجديد أو ترقية الباقة'],
            ['🎟 أكواد الطلاب والفرق', '📈 إحصائيات المقررات'],
            ['🎁 العروض الجامعية', '⚙️ إعدادات الحساب'],
        ]);
    }

    /**
     * Settings keyboard with unlinking capability.
     */
    public function settingsKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['🔓 إلغاء ربط الحساب', '🔔 إعدادات التنبيهات'],
            ['❌ إلغاء والعودة للقائمة الرئيسية'],
        ]);
    }

    /**
     * Guardian role adaptive keyboard.
     */
    public function guardianKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['👨‍🎓 استعراض تقارير الأبناء', '➕ ربط طالب إضافي'],
            ['🔔 التقارير الأسبوعية', '🏠 القائمة الرئيسية'],
        ]);
    }

    /**
     * Keyboard to request user phone contact securely.
     */
    public function requestContactKeyboard(string $buttonText = '📱 مشاركة رقم هاتفي للتحقق'): array
    {
        return [
            'keyboard' => [
                [
                    [
                        'text' => $buttonText,
                        'request_contact' => true,
                    ],
                ],
                [
                    ['text' => '❌ إلغاء والعودة للقائمة الرئيسية'],
                ],
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => true,
        ];
    }

    /**
     * Simple cancel keyboard.
     */
    public function cancelKeyboard(): array
    {
        return $this->makeReplyKeyboard([
            ['❌ إلغاء والعودة للقائمة الرئيسية'],
        ]);
    }

    /**
     * Build standard ReplyKeyboardMarkup.
     */
    public function makeReplyKeyboard(array $rows, bool $resize = true, bool $oneTime = false): array
    {
        $keyboard = [];
        foreach ($rows as $row) {
            $formattedRow = [];
            foreach ($row as $btn) {
                if (is_string($btn)) {
                    $formattedRow[] = ['text' => $btn];
                } elseif (is_array($btn)) {
                    $formattedRow[] = $btn;
                }
            }
            $keyboard[] = $formattedRow;
        }

        return [
            'keyboard' => $keyboard,
            'resize_keyboard' => $resize,
            'one_time_keyboard' => $oneTime,
        ];
    }

    /**
     * Build InlineKeyboardMarkup.
     */
    public function makeInlineKeyboard(array $rows): array
    {
        return [
            'inline_keyboard' => $rows,
        ];
    }

    /**
     * Remove custom reply keyboard.
     */
    public function makeRemoveKeyboard(): array
    {
        return [
            'remove_keyboard' => true,
        ];
    }
}
