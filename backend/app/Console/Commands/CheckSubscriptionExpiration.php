<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\TeacherSubscription;
use App\Services\NotificationService;
use Carbon\Carbon;

class CheckSubscriptionExpiration extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'subscription:check-expiration';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check for expiring teacher subscriptions and send notification alerts';

    /**
     * Execute the console command.
     */
    public function handle(NotificationService $notificationService)
    {
        $this->info('Checking teacher subscriptions expiration dates...');

        $today = Carbon::today();
        $subscriptions = TeacherSubscription::whereIn('status', ['Active', 'Expiring Soon'])->get();

        foreach ($subscriptions as $sub) {
            $endDate = Carbon::parse($sub->end_date);
            $diffInDays = $today->diffInDays($endDate, false); // false to allow negative numbers

            if ($diffInDays === 7) {
                $notificationService->sendNotification(
                    'تنبيه انتهاء الاشتراك (7 أيام)',
                    'متبقي 7 أيام على انتهاء باقة اشتراكك الحالية. يرجى التجديد لتفادي توقف الخدمة.',
                    'specific_teacher',
                    $sub->teacher_id
                );
                $sub->update(['status' => 'Expiring Soon']);
                $this->info("Notified teacher {$sub->teacher_id} (7 days left).");
            } elseif ($diffInDays === 3) {
                $notificationService->sendNotification(
                    'تنبيه انتهاء الاشتراك (3 أيام)',
                    'متبقي 3 أيام فقط على انتهاء باقة اشتراكك الحالية. يرجى التجديد لتفادي توقف الخدمة.',
                    'specific_teacher',
                    $sub->teacher_id
                );
                $sub->update(['status' => 'Expiring Soon']);
                $this->info("Notified teacher {$sub->teacher_id} (3 days left).");
            } elseif ($diffInDays === 0) {
                $notificationService->sendNotification(
                    'انتهى اشتراكك اليوم',
                    'لقد انتهت باقة اشتراكك الحالية اليوم. يرجى تجديد الاشتراك لتفعيل الميزات وتفادي حظر الطلاب.',
                    'specific_teacher',
                    $sub->teacher_id
                );
                $sub->update(['status' => 'Expired']);
                $this->info("Notified teacher {$sub->teacher_id} (Expired today).");
            } elseif ($diffInDays < 0 && $sub->status !== 'Expired') {
                $sub->update(['status' => 'Expired']);
                $this->info("Updated teacher {$sub->teacher_id} subscription status to Expired.");
            }
        }

        $this->info('Subscription expiration checks finished.');
    }
}
