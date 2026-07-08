<?php

namespace App\Services;

use App\Models\SubscriptionPlan;
use App\Models\TeacherSubscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionRequest;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SubscriptionService
{
    /**
     * Get active subscription plan.
     */
    public function getActiveSubscription(int $teacherId)
    {
        return TeacherSubscription::with('plan')
            ->where('teacher_id', $teacherId)
            ->first();
    }

    /**
     * Process subscription request action.
     */
    public function processRequest(int $requestId, string $status, string $adminResponse = null, int $adminId = null)
    {
        return DB::transaction(function () use ($requestId, $status, $adminResponse, $adminId) {
            $req = SubscriptionRequest::findOrFail($requestId);
            $req->update([
                'status' => $status,
                'admin_response' => $adminResponse,
            ]);

            if ($status === 'Approved') {
                $teacher = User::findOrFail($req->teacher_id);
                
                if ($req->type === 'plan_upgrade') {
                    $plan = SubscriptionPlan::findOrFail($req->requested_plan_id);
                    $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->first();
                    
                    $isRenewal = ($subscription && (int)$subscription->plan_id === (int)$plan->id);
                    $currentEndDate = ($subscription && $subscription->end_date) ? Carbon::parse($subscription->end_date) : null;
                    
                    if ($isRenewal && $subscription->status === 'Active' && $currentEndDate && $currentEndDate->isFuture()) {
                        $newStartDate = $subscription->start_date->toDateString();
                        $newEndDate = $currentEndDate->addDays($plan->duration_in_days)->toDateString();
                    } else {
                        $newStartDate = Carbon::now()->toDateString();
                        $newEndDate = Carbon::now()->addDays($plan->duration_in_days)->toDateString();
                    }

                    $subscription = TeacherSubscription::updateOrCreate(
                        ['teacher_id' => $teacher->id],
                        [
                            'plan_id' => $plan->id,
                            'start_date' => $newStartDate,
                            'end_date' => $newEndDate,
                            'status' => 'Active',
                        ]
                    );

                    // Create log/payment record
                    SubscriptionPayment::create([
                        'teacher_subscription_id' => $subscription->id,
                        'amount' => $plan->price,
                        'payment_status' => 'Paid',
                        'payment_date' => Carbon::now(),
                        'admin_id' => $adminId,
                        'admin_name' => $adminId ? User::find($adminId)->name : 'System',
                        'notes' => 'تفعيل ترقية الباقة: ' . $plan->name,
                    ]);
                    
                } elseif ($req->type === 'extra_storage') {
                    $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();
                    
                    // Add storage addon
                    SubscriptionAddon::create([
                        'teacher_subscription_id' => $subscription->id,
                        'type' => 'storage',
                        'amount' => $req->amount,
                        'price_egp' => 0, // Admin approved free or processed manually
                    ]);

                } elseif ($req->type === 'extra_codes') {
                    $subscription = TeacherSubscription::where('teacher_id', $teacher->id)->firstOrFail();
                    
                    // Add codes addon
                    SubscriptionAddon::create([
                        'teacher_subscription_id' => $subscription->id,
                        'type' => 'codes',
                        'amount' => $req->amount,
                        'price_egp' => 0,
                    ]);
                }
            }

            return $req;
        });
    }
}
