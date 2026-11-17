<?php

namespace App\Services;

use App\Models\TelegramUser;
use Carbon\Carbon;

class ConversationStateEngine
{
    public const STATE_IDLE = 'IDLE';
    public const STATE_AWAITING_RECOVERY_CONTACT = 'AWAITING_RECOVERY_CONTACT';
    public const STATE_AWAITING_GUARDIAN_CONTACT = 'AWAITING_GUARDIAN_CONTACT';
    public const STATE_AWAITING_GIFT_CODE = 'AWAITING_GIFT_CODE';

    /**
     * Default timeout for an active state in minutes.
     */
    protected int $stateTimeoutMinutes = 15;

    /**
     * Get the active state of a TelegramUser.
     * Automatically resets to IDLE if the interaction has timed out.
     */
    public function getState(TelegramUser $telegramUser): string
    {
        $state = $telegramUser->current_conversation_state ?: self::STATE_IDLE;

        if ($state !== self::STATE_IDLE && $this->isExpired($telegramUser)) {
            $this->clearState($telegramUser);
            return self::STATE_IDLE;
        }

        return $state;
    }

    /**
     * Set a new conversation state with optional contextual payload.
     */
    public function setState(TelegramUser $telegramUser, string $state, array $payload = []): void
    {
        $telegramUser->update([
            'current_conversation_state' => $state,
            'state_payload' => $payload,
            'last_interaction_at' => Carbon::now(),
        ]);
    }

    /**
     * Clear the current conversation state and return to IDLE.
     */
    public function clearState(TelegramUser $telegramUser): void
    {
        $telegramUser->update([
            'current_conversation_state' => self::STATE_IDLE,
            'state_payload' => null,
            'last_interaction_at' => Carbon::now(),
        ]);
    }

    /**
     * Retrieve the contextual payload for the active state.
     */
    public function getPayload(TelegramUser $telegramUser): array
    {
        if ($this->isExpired($telegramUser)) {
            return [];
        }

        return is_array($telegramUser->state_payload) ? $telegramUser->state_payload : [];
    }

    /**
     * Check if the user's pending state has expired.
     */
    public function isExpired(TelegramUser $telegramUser): bool
    {
        if (!$telegramUser->last_interaction_at) {
            return false;
        }

        return $telegramUser->last_interaction_at->diffInMinutes(Carbon::now()) > $this->stateTimeoutMinutes;
    }
}
