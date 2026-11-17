<?php

namespace App\Services;

use App\Models\MarketingCampaign;
use App\Models\TelegramUser;
use App\Models\CampaignDelivery;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class TelegramCampaignService
{
    protected TelegramService $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
    }

    /**
     * Broadcast a marketing campaign to eligible Telegram users based on multi-role targeting.
     */
    public function broadcastCampaign(MarketingCampaign $campaign): array
    {
        $roles = is_array($campaign->target_roles) ? $campaign->target_roles : ['all'];

        // Query eligible telegram users with marketing_opt_in = true
        $query = TelegramUser::where('marketing_opt_in', true)
            ->whereNotNull('telegram_chat_id');

        if (!in_array('all', $roles, true)) {
            $query->whereIn('role', $roles);
        }

        $recipients = $query->get();

        $total = $recipients->count();
        $successful = 0;
        $failed = 0;

        $campaign->update([
            'status' => 'processing',
            'total_recipients' => $total,
        ]);

        foreach ($recipients as $recipient) {
            $chatId = $recipient->telegram_chat_id;

            // Personalize message template
            $message = str_replace(
                ['{name}', '{first_name}'],
                [$recipient->first_name ?: 'عزيزنا المشترك', $recipient->first_name ?: ''],
                $campaign->message_template
            );

            try {
                $response = $this->telegramService->sendMessage($chatId, $message);

                if ($response['ok'] ?? false) {
                    $successful++;
                    CampaignDelivery::create([
                        'campaign_id' => $campaign->id,
                        'telegram_account_id' => $recipient->id,
                        'status' => 'delivered',
                        'sent_at' => Carbon::now(),
                    ]);
                } else {
                    $failed++;
                    CampaignDelivery::create([
                        'campaign_id' => $campaign->id,
                        'telegram_account_id' => $recipient->id,
                        'status' => 'failed',
                        'error_message' => $response['description'] ?? 'Telegram API error',
                    ]);
                }
            } catch (\Exception $e) {
                $failed++;
                CampaignDelivery::create([
                    'campaign_id' => $campaign->id,
                    'telegram_account_id' => $recipient->id,
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);
            }
        }

        $campaign->update([
            'status' => 'completed',
            'successful_deliveries' => $successful,
            'failed_deliveries' => $failed,
            'completed_at' => Carbon::now(),
        ]);

        return [
            'total' => $total,
            'successful' => $successful,
            'failed' => $failed,
        ];
    }
}
