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
        $subscriptions = TeacherSubscription::all();

        foreach ($subscriptions as $sub) {
            $statusDetails = $sub->calculateStatusDetails();
            $graceDays = $statusDetails['grace_period_days'];
            
            $endDate = Carbon::parse($sub->end_date);
            $diffInDays = $today->diffInDays($endDate, false); // positive if in future, negative if in past

            if ($diffInDays === 7) {
                $notificationService->sendNotification(
                    'تنبيه انتهاء الاشتراك (7 أيام)',
                    'متبقي 7 أيام على انتهاء باقة اشتراكك الحالية. يرجى التجديد لتفادي توقف الخدمة.',
                    'specific_teacher',
                    $sub->teacher_id
                );
                $this->info("Notified teacher {$sub->teacher_id} (7 days left).");
            } elseif ($diffInDays === 3) {
                $notificationService->sendNotification(
                    'تنبيه انتهاء الاشتراك (3 أيام)',
                    'متبقي 3 أيام فقط على انتهاء باقة اشتراكك الحالية. يرجى التجديد لتفادي توقف الخدمة.',
                    'specific_teacher',
                    $sub->teacher_id
                );
                $this->info("Notified teacher {$sub->teacher_id} (3 days left).");
            } elseif ($diffInDays === 1) {
                $notificationService->sendNotification(
                    'تنبيه انتهاء الاشتراك (يوم واحد)',
                    'متبقي يوم واحد فقط على انتهاء باقة اشتراكك الحالية. يرجى التجديد لتفادي توقف الخدمة.',
                    'specific_teacher',
                    $sub->teacher_id
                );
                $this->info("Notified teacher {$sub->teacher_id} (1 day left).");
            } elseif ($diffInDays === -1) {
                $notificationService->sendNotification(
                    'بدء فترة السماح للاشتراك',
                    "انتهت صلاحية باقتك بالأمس وبدأت فترة السماح المحددة بـ {$graceDays} أيام. يرجى التجديد الآن لتجنب إيقاف الخدمات.",
                    'specific_teacher',
                    $sub->teacher_id
                );
                $this->info("Notified teacher {$sub->teacher_id} (First day of Grace Period).");
            } elseif ($diffInDays === -$graceDays - 1) {
                $notificationService->sendNotification(
                    'انتهاء صلاحية الاشتراك بالكامل',
                    'انتهت فترة السماح الخاصة باشتراكك وتم إيقاف الخدمات مؤقتاً. يرجى تجديد الاشتراك لاستعادة الوصول.',
                    'specific_teacher',
                    $sub->teacher_id
                );

                // Admin notification
                $teacherName = $sub->teacher ? $sub->teacher->name : 'معلم';
                $notificationService->sendNotification(
                    'انتهاء اشتراك معلم',
                    "انتهت فترة السماح واشتراك المعلم {$teacherName} (ID: {$sub->teacher_id}) بالكامل وتم إيقاف خدماته.",
                    'admin'
                );

                $this->info("Notified teacher {$sub->teacher_id} and admin (Subscription Expired).");
            }
        }

        $this->info('Subscription expiration checks finished.');
    }
}
