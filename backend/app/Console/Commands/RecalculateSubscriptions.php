<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\TeacherSubscription;
use App\Services\BunnySubscriptionService;
use Carbon\Carbon;

class RecalculateSubscriptions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'subscription:recalculate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculates every teacher subscription according to new business logic rules';

    /**
     * Execute the console command.
     */
    public function handle(BunnySubscriptionService $syncService)
    {
        $this->info('Starting subscription recalculation...');

        $subscriptions = TeacherSubscription::with('plan')->get();

        foreach ($subscriptions as $sub) {
            $this->info("Recalculating subscription ID {$sub->id} for Teacher ID {$sub->teacher_id}...");

            $plan = $sub->plan;
            if (!$plan) {
                $this->error("No plan assigned to subscription ID {$sub->id}. Skipping.");
                continue;
            }

            // Sync storage bytes used and active student counts dynamically
            $syncService->syncStorageAndCodes($sub->teacher_id);
            $sub->refresh();

            // Clean status transitions
            $status = $sub->status;
            $today = Carbon::today();
            $endDate = Carbon::parse($sub->end_date);

            if ($sub->status !== 'Suspended') {
                if ($today->gt($endDate)) {
                    $status = 'Expired';
                } elseif ($today->diffInDays($endDate) <= 7) {
                    $status = 'Expiring Soon';
                } else {
                    $status = 'Active';
                }
            }

            $sub->update([
                'status' => $status,
            ]);

            $this->info("Successfully recalculated subscription. Status: {$status}. Used Storage: " . round($sub->used_storage_bytes / (1024*1024*1024), 2) . " GB. Used Codes: {$sub->used_codes}.");
        }

        $this->info('Subscription recalculation complete.');
    }
}
