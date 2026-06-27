<?php

namespace App\Services;

use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\PurchaseCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PaymentService
{
    /**
     * Recharge wallet using a charging code.
     */
    public function redeemCode(int $studentId, string $codeString)
    {
        return DB::transaction(function () use ($studentId, $codeString) {
            $code = PurchaseCode::where('code', $codeString)
                ->where('is_redeemed', false)
                ->where(function ($query) {
                    $query->whereNull('expires_at')
                        ->orWhere('expires_at', '>', Carbon::now());
                })
                ->first();

            if (!$code) {
                throw new \Exception('كود الشحن غير صالح أو تم استخدامه من قبل أو منتهي الصلاحية.');
            }

            if ($code->type !== 'wallet') {
                throw new \Exception('هذا الكود ليس مخصصاً لشحن المحفظة.');
            }

            $wallet = Wallet::firstOrCreate(['student_id' => $studentId], ['balance' => 0]);
            
            // Increment balance
            $wallet->increment('balance', $code->amount);

            // Record transaction
            WalletTransaction::create([
                'wallet_id' => $wallet->id,
                'type' => 'deposit',
                'amount' => $code->amount,
                'description' => 'شحن المحفظة عن طريق كود شحن: ' . $code->code,
                'reference_id' => $code->id,
            ]);

            // Mark code as redeemed
            $code->update([
                'is_redeemed' => true,
                'redeemed_by_student_id' => $studentId,
                'redeemed_at' => Carbon::now(),
            ]);

            return [
                'wallet' => $wallet,
                'amount' => $code->amount,
            ];
        });
    }

    /**
     * Create purchase code (admin tool).
     */
    public function createPurchaseCode(array $data)
    {
        return PurchaseCode::create($data);
    }
}
