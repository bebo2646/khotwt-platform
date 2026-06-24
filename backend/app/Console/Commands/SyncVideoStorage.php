<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\BunnySubscriptionService;

class SyncVideoStorage extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'subscription:sync-storage';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync Bunny Stream video storage sizes and update teacher subscription usage';

    /**
     * Execute the console command.
     */
    public function handle(BunnySubscriptionService $service)
    {
        $this->info('Starting Bunny Stream video storage synchronization...');
        
        $success = $service->syncStorageAndCodes();

        if ($success) {
            $this->info('Synchronization completed successfully!');
        } else {
            $this->error('Synchronization failed. Check Laravel log files.');
        }
    }
}
