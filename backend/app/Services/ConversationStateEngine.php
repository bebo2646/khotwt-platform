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

    // Support Ticket states
    public const STATE_AWAITING_SUPPORT_MESSAGE = 'AWAITING_SUPPORT_MESSAGE';
    public const STATE_ADMIN_REPLYING_TICKET = 'ADMIN_REPLYING_TICKET';

    // Teacher Application states
    public const STATE_TEACHER_APP_NAME = 'TEACHER_APP_NAME';
    public const STATE_TEACHER_APP_PHONE = 'TEACHER_APP_PHONE';
    public const STATE_TEACHER_APP_EMAIL = 'TEACHER_APP_EMAIL';
    public const STATE_TEACHER_APP_SUBJECT = 'TEACHER_APP_SUBJECT';
    public const STATE_TEACHER_APP_GRADES = 'TEACHER_APP_GRADES';
    public const STATE_TEACHER_APP_CENTER = 'TEACHER_APP_CENTER';
    public const STATE_TEACHER_APP_CONFIRM = 'TEACHER_APP_CONFIRM';
    public const STATE_ADMIN_REJECTING_TEACHER = 'ADMIN_REJECTING_TEACHER';

    // Admin states
    public const STATE_ADMIN_SEARCHING_USER = 'ADMIN_SEARCHING_USER';
    public const STATE_ADMIN_BROADCAST_ROLE = 'ADMIN_BROADCAST_ROLE';
    public const STATE_ADMIN_BROADCAST_MESSAGE = 'ADMIN_BROADCAST_MESSAGE';

    /**
     * Default timeout for an active state in minutes.
     */
    protected int $stateTimeoutMinutes = 15;

    /**
     * Get the active state of a TelegramUser.
     * Automatically resets to IDLE if the interaction has timed out.
     */
    public function getState(TelegramUser $telegramUser, string $botType = 'user'): string
    {
        $stateField = $botType === 'admin' ? 'admin_conversation_state' : 'current_conversation_state';
        $state = $telegramUser->{$stateField} ?: self::STATE_IDLE;

        if ($state !== self::STATE_IDLE && $this->isExpired($telegramUser, $botType)) {
            $this->clearState($telegramUser, $botType);
            return self::STATE_IDLE;
        }

        return $state;
    }

    /**
     * Set a new conversation state with optional contextual payload.
     */
    public function setState(TelegramUser $telegramUser, string $state, array $payload = [], string $botType = 'user'): void
    {
        $stateField = $botType === 'admin' ? 'admin_conversation_state' : 'current_conversation_state';
        $payloadField = $botType === 'admin' ? 'admin_state_payload' : 'state_payload';
        $timeField = $botType === 'admin' ? 'admin_last_interaction_at' : 'last_interaction_at';

        $telegramUser->update([
            $stateField => $state,
            $payloadField => $payload,
            $timeField => Carbon::now(),
        ]);
    }

    /**
     * Clear the current conversation state and return to IDLE.
     */
    public function clearState(TelegramUser $telegramUser, string $botType = 'user'): void
    {
        $stateField = $botType === 'admin' ? 'admin_conversation_state' : 'current_conversation_state';
        $payloadField = $botType === 'admin' ? 'admin_state_payload' : 'state_payload';
        $timeField = $botType === 'admin' ? 'admin_last_interaction_at' : 'last_interaction_at';

        $telegramUser->update([
            $stateField => self::STATE_IDLE,
            $payloadField => null,
            $timeField => Carbon::now(),
        ]);
    }

    /**
     * Retrieve the contextual payload for the active state.
     */
    public function getPayload(TelegramUser $telegramUser, string $botType = 'user'): array
    {
        if ($this->isExpired($telegramUser, $botType)) {
            return [];
        }

        $payloadField = $botType === 'admin' ? 'admin_state_payload' : 'state_payload';
        return is_array($telegramUser->{$payloadField}) ? $telegramUser->{$payloadField} : [];
    }

    /**
     * Check if the user's pending state has expired.
     */
    public function isExpired(TelegramUser $telegramUser, string $botType = 'user'): bool
    {
        $timeField = $botType === 'admin' ? 'admin_last_interaction_at' : 'last_interaction_at';
        $timestamp = $telegramUser->{$timeField};

        if (!$timestamp) {
            return false;
        }

        return $timestamp->diffInMinutes(Carbon::now()) > $this->stateTimeoutMinutes;
    }
}
