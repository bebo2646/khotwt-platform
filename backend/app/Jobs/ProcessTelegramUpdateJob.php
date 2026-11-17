<?php

namespace App\Jobs;

use App\Models\TelegramProcessedUpdate;
use App\Services\TelegramUpdateProcessor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessTelegramUpdateJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $processedUpdateId;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(int $processedUpdateId)
    {
        $this->processedUpdateId = $processedUpdateId;
    }

    public function handle(TelegramUpdateProcessor $processor): void
    {
        $record = TelegramProcessedUpdate::find($this->processedUpdateId);
        if (!$record) {
            Log::warning("ProcessTelegramUpdateJob: Record [{$this->processedUpdateId}] not found.");
            return;
        }

        // Idempotency: If already processed, exit cleanly
        if ($record->isProcessed()) {
            return;
        }

        $record->markAsProcessing();

        try {
            $processor->process($record->payload ?: []);
            $record->markAsProcessed();
        } catch (Throwable $e) {
            $record->markAsFailed($e->getMessage());

            Log::error("ProcessTelegramUpdateJob: Processing update [{$record->update_id}] failed", [
                'error' => $e->getMessage(),
                'attempt' => $this->attempts(),
            ]);

            throw $e;
        }
    }
}
