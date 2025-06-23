// testScripts/subscription.js

import { updateApiResponse } from './utils.js';

// displayApiResponse를 updateApiResponse로 대체하는 호환성 함수
function displayApiResponse(title, data, type = 'success') {
    const message = `${title}: ${JSON.stringify(data, null, 2)}`;
    updateApiResponse(message);
}

/**
 * 구독 등급 목록 조회 테스트
 */
export async function testGetSubscriptionTiers() {
    try {
        console.log('[subscription] Testing subscription tiers retrieval...');
        
        const response = await fetch('/api/subscriptions/tiers', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 등급 목록 조회 성공', result);
            console.log('[subscription] Subscription tiers:', result);
        } else {
            displayApiResponse('구독 등급 목록 조회 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('구독 등급 목록 조회 오류', { error: error.message }, 'error');
        console.error('[subscription] Error getting subscription tiers:', error);
    }
};

/**
 * 사용자 구독 정보 조회 테스트
 */
export async function testGetUserSubscription() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        console.log(`[subscription] Testing user subscription for: ${userId}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('사용자 구독 정보 조회 성공', result);
            console.log('[subscription] User subscription:', result);
        } else {
            displayApiResponse('사용자 구독 정보 조회 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('사용자 구독 정보 조회 오류', { error: error.message }, 'error');
        console.error('[subscription] Error getting user subscription:', error);
    }
};

/**
 * 구독 업그레이드 테스트
 */
export async function testUpdateSubscription() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        const tierName = document.getElementById('target-tier')?.value || 'planet';
        const paymentMethod = document.getElementById('payment-method')?.value || 'card';
        const billingCycle = document.getElementById('billing-cycle')?.value || 'monthly';
        const autoRenewal = document.getElementById('auto-renewal')?.checked || true;
        
        console.log(`[subscription] Testing subscription update for ${userId} to ${tierName}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tier_name: tierName,
                payment_method: paymentMethod,
                billing_cycle: billingCycle,
                auto_renewal: autoRenewal
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 업데이트 성공', result);
            console.log('[subscription] Subscription updated:', result);
        } else {
            displayApiResponse('구독 업데이트 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('구독 업데이트 오류', { error: error.message }, 'error');
        console.error('[subscription] Error updating subscription:', error);
    }
};

/**
 * 구독 취소 테스트
 */
export async function testCancelSubscription() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        console.log(`[subscription] Testing subscription cancellation for: ${userId}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 취소 성공', result);
            console.log('[subscription] Subscription canceled:', result);
        } else {
            displayApiResponse('구독 취소 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('구독 취소 오류', { error: error.message }, 'error');
        console.error('[subscription] Error canceling subscription:', error);
    }
};

/**
 * 구독 이력 조회 테스트
 */
export async function testGetSubscriptionHistory() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        console.log(`[subscription] Testing subscription history for: ${userId}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription/history`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 이력 조회 성공', result);
            console.log('[subscription] Subscription history:', result);
        } else {
            displayApiResponse('구독 이력 조회 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('구독 이력 조회 오류', { error: error.message }, 'error');
        console.error('[subscription] Error getting subscription history:', error);
    }
};

/**
 * 기능 접근 권한 확인 테스트
 */
export async function testCheckFeatureAccess() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        const featureName = document.getElementById('feature-name')?.value || 'file_upload';
        console.log(`[subscription] Testing feature access for ${userId}, feature: ${featureName}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription/features/${featureName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('기능 접근 권한 확인 성공', result);
            console.log('[subscription] Feature access check:', result);
        } else {
            displayApiResponse('기능 접근 권한 확인 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('기능 접근 권한 확인 오류', { error: error.message }, 'error');
        console.error('[subscription] Error checking feature access:', error);
    }
};

/**
 * 일일 사용량 확인 테스트
 */
export async function testCheckDailyUsage() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        console.log(`[subscription] Testing daily usage check for: ${userId}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription/usage`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('일일 사용량 확인 성공', result);
            console.log('[subscription] Daily usage check:', result);
        } else {
            displayApiResponse('일일 사용량 확인 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('일일 사용량 확인 오류', { error: error.message }, 'error');
        console.error('[subscription] Error checking daily usage:', error);
    }
};

/**
 * 구독 업그레이드 시뮬레이션 테스트 ()
 */
export async function testSimulateUpgrade() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        const tierName = document.getElementById('target-tier')?.value || 'star';
        console.log(`[subscription] Testing upgrade simulation for ${userId} to ${tierName}`);
        
        const response = await fetch(`/api/subscriptions/users/${userId}/subscription/simulate-upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tier_name: tierName,
                simulate_payment: true
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 업그레이드 시뮬레이션 성공', result);
            console.log('[subscription] Upgrade simulation:', result);
        } else {
            displayApiResponse('구독 업그레이드 시뮬레이션 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('구독 업그레이드 시뮬레이션 오류', { error: error.message }, 'error');
        console.error('[subscription] Error simulating upgrade:', error);
    }
};

/**
 * 구독 갱신 테스트
 */
export async function testSimulateRenewal() {
    try {
        const userId = document.getElementById('subscription-user-id')?.value || 'guest';
        console.log(`[subscription] Testing renewal for: ${userId}`);

        const response = await fetch(`/api/subscriptions/users/${userId}/subscription/renewal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 갱신 성공', result);
            console.log('[subscription] Renewal simulation:', result);
        } else {
            displayApiResponse('구독 갱신 실패', result, 'error');
        }
        
    } catch (error) {
        displayApiResponse('구독 갱신 오류', { error: error.message }, 'error');
        console.error('[subscription] Error simulating renewal:', error);
    }
};
