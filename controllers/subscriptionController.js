// controllers/subscriptionController.js
const {
    getSubscriptionTiers,
    getUserSubscription,
    updateUserSubscription,
    cancelUserSubscription,
    getUserSubscriptionHistory,
    checkUserFeatureAccess,
    checkDailyUsage
} = require('../models/subscription');

/**
 * 구독 등급 목록 조회 API
 * GET /api/subscriptions/tiers
 */
async function getSubscriptionTiersController(req, res) {
    try {
        console.log('[subscriptionController] Getting subscription tiers');
        
        const tiers = await getSubscriptionTiers();
        res.status(200).json(tiers);
        
    } catch (error) {
        console.error('[subscriptionController] Error getting subscription tiers:', error);
        res.status(500).json({
            error: 'Failed to get subscription tiers',
            message: error.message
        });
    }
}

/**
 * 사용자 구독 정보 조회 API
 * GET /api/users/:user_id/subscription
 */
async function getUserSubscriptionController(req, res) {
    try {
        const { user_id } = req.params;
        
        console.log(`[subscriptionController] Getting subscription for user: ${user_id}`);
        
        const subscription = await getUserSubscription(user_id);
        res.status(200).json(subscription);
        
    } catch (error) {
        console.error('[subscriptionController] Error getting user subscription:', error);
        res.status(500).json({
            error: 'Failed to get user subscription',
            message: error.message
        });
    }
}

/**
 * 구독 업그레이드/다운그레이드 API
 * PUT /api/users/:user_id/subscription
 */
async function updateUserSubscriptionController(req, res) {
    try {
        const { user_id } = req.params;
        const { tier_name, payment_method, billing_cycle, auto_renewal } = req.body;
        
        if (!tier_name) {
            return res.status(400).json({
                error: 'Tier name is required',
                message: 'Please specify the target subscription tier'
            });
        }
        
        console.log(`[subscriptionController] Updating subscription for user ${user_id} to ${tier_name}`);
        
        const options = {
            payment_method: payment_method || 'card',
            billing_cycle: billing_cycle || 'monthly',
            auto_renewal: auto_renewal !== undefined ? auto_renewal : true
        };
        
        const updatedSubscription = await updateUserSubscription(user_id, tier_name, options);
        
        res.status(200).json({
            message: 'Subscription updated successfully',
            subscription: updatedSubscription
        });
        
    } catch (error) {
        console.error('[subscriptionController] Error updating subscription:', error);
        res.status(500).json({
            error: 'Failed to update subscription',
            message: error.message
        });
    }
}

/**
 * 구독 취소 API
 * DELETE /api/users/:user_id/subscription
 */
async function cancelUserSubscriptionController(req, res) {
    try {
        const { user_id } = req.params;
        
        console.log(`[subscriptionController] Canceling subscription for user: ${user_id}`);
        
        const canceledSubscription = await cancelUserSubscription(user_id);
        
        res.status(200).json({
            message: 'Subscription canceled successfully',
            subscription: canceledSubscription
        });
        
    } catch (error) {
        console.error('[subscriptionController] Error canceling subscription:', error);
        res.status(500).json({
            error: 'Failed to cancel subscription',
            message: error.message
        });
    }
}

/**
 * 구독 이력 조회 API
 * GET /api/users/:user_id/subscription/history
 */
async function getUserSubscriptionHistoryController(req, res) {
    try {
        const { user_id } = req.params;
        
        console.log(`[subscriptionController] Getting subscription history for user: ${user_id}`);
        
        const history = await getUserSubscriptionHistory(user_id);
        res.status(200).json(history);
        
    } catch (error) {
        console.error('[subscriptionController] Error getting subscription history:', error);
        res.status(500).json({
            error: 'Failed to get subscription history',
            message: error.message
        });
    }
}

/**
 * 기능 접근 권한 확인 API
 * GET /api/users/:user_id/subscription/features/:feature_name
 */
async function checkFeatureAccessController(req, res) {
    try {
        const { user_id, feature_name } = req.params;
        
        console.log(`[subscriptionController] Checking feature access for user ${user_id}, feature: ${feature_name}`);
        
        const hasAccess = await checkUserFeatureAccess(user_id, feature_name);
        
        res.status(200).json({
            user_id,
            feature_name,
            has_access: hasAccess
        });
        
    } catch (error) {
        console.error('[subscriptionController] Error checking feature access:', error);
        res.status(500).json({
            error: 'Failed to check feature access',
            message: error.message
        });
    }
}

/**
 * 일일 사용량 확인 API
 * GET /api/users/:user_id/subscription/usage
 */
async function checkDailyUsageController(req, res) {
    try {
        const { user_id } = req.params;
        
        console.log(`[subscriptionController] Checking daily usage for user: ${user_id}`);
        
        const usage = await checkDailyUsage(user_id);
        res.status(200).json(usage);
        
    } catch (error) {
        console.error('[subscriptionController] Error checking daily usage:', error);
        res.status(500).json({
            error: 'Failed to check daily usage',
            message: error.message
        });
    }
}

/**
 * 구독 업그레이드 시뮬레이션 API
 * POST /api/users/:user_id/subscription/upgrade
 */
async function simulateSubscriptionUpgradeController(req, res) {
    try {        const { user_id } = req.params;
        const { tier_name, simulation_type = 'upgrade' } = req.body;
        
        if (!tier_name) {
            return res.status(400).json({
                error: 'tier_name is required'
            });
        }        console.log(`[subscriptionController] Simulating ${simulation_type} for user ${user_id} to tier ${tier_name}`);
        
        // 한국어 구독 등급명을 영어로 변환 (updateUserSubscription과 동일한 매핑 사용)
        const tierMapping = {
            '코멧': 'free',
            '플래닛': 'planet',
            '스타': 'star',
            '갤럭시': 'galaxy'
        };
        const englishTierName = tierMapping[tier_name] || tier_name.toLowerCase();
        console.log(`[subscriptionController] Mapped tier name: ${tier_name} -> ${englishTierName}`);
        
        // 구독 등급 정보 조회
        const tiers = await getSubscriptionTiers();
        console.log(`[subscriptionController] Available tiers:`, tiers.map(t => ({ tier_id: t.tier_id, tier_name: t.tier_name, tier_level: t.tier_level })));
        console.log(`[subscriptionController] Looking for tier_name: ${englishTierName}`);
        
        const targetTier = tiers.find(tier => tier.tier_name === englishTierName);
        console.log(`[subscriptionController] Found target tier:`, targetTier);
          if (!targetTier) {
            return res.status(404).json({
                error: `Subscription tier '${tier_name}' (mapped to '${englishTierName}') not found`
            });
        }
        
        // 현재 구독 조회
        const currentSubscription = await getUserSubscription(user_id);
        
        const simulation = {
            user_id,
            current_tier: currentSubscription?.tier || null,
            target_tier: targetTier,
            upgrade_type: targetTier.tier_level > (currentSubscription?.tier?.tier_level || 0) ? 'upgrade' : 'downgrade',
            estimated_monthly_cost: targetTier.monthly_price,
            estimated_yearly_cost: targetTier.yearly_price,
            new_features: targetTier.features_included,
            payment_simulation: true,
            can_proceed: true,
            simulation_timestamp: new Date().toISOString()
        };
        
        res.status(200).json({
            message: 'Subscription upgrade simulation completed',
            simulation
        });
        
    } catch (error) {
        console.error('[subscriptionController] Error simulating upgrade:', error);
        res.status(500).json({
            error: 'Failed to simulate subscription upgrade',
            message: error.message
        });
    }
}

/**
 * 구독 갱신 시뮬레이션 API
 * POST /api/users/:user_id/subscription/renewal
 */
async function simulateSubscriptionRenewalController(req, res) {
    try {
        const { user_id } = req.params;
        const { renewal_period = 'monthly', apply_discount = false } = req.body;
        
        console.log(`[subscriptionController] Simulating renewal for user: ${user_id}`);
          const currentSubscription = await getUserSubscription(user_id);
        
        // 무료 구독인 경우 시뮬레이션만 제공
        if (!currentSubscription || 
            !currentSubscription.tier || 
            currentSubscription.tier.tier_name === 'free' ||
            currentSubscription.tier.tier_level === 1) {
            
            // 무료 구독에서 유료 구독으로의 갱신 시뮬레이션
            const tiers = await getSubscriptionTiers();
            const defaultPaidTier = tiers.find(tier => tier.tier_level === 2); // 플래닛 등급
            
            if (!defaultPaidTier) {
                return res.status(400).json({
                    error: 'No paid subscription tiers available'
                });
            }
            
            const basePrice = renewal_period === 'yearly' ? defaultPaidTier.yearly_price : defaultPaidTier.monthly_price;
            const discountAmount = apply_discount ? basePrice * 0.1 : 0;
            const finalPrice = basePrice - discountAmount;
            
            const renewalSimulation = {
                user_id,
                current_subscription: {
                    tier: currentSubscription?.tier || { tier_name: 'free', tier_level: 1 }
                },
                suggested_tier: defaultPaidTier,
                renewal_period,
                renewal_date: new Date(Date.now() + (renewal_period === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
                base_price: basePrice,
                discount_applied: apply_discount,
                discount_amount: discountAmount,
                final_price: finalPrice,
                auto_renewal: true,
                payment_simulation: true,
                simulation_type: 'upgrade_from_free',
                simulation_timestamp: new Date().toISOString()
            };
            
            return res.status(200).json({
                message: 'Free to paid subscription renewal simulation completed',
                simulation: renewalSimulation
            });
        }
        
        const tier = currentSubscription.tier;
        const basePrice = renewal_period === 'yearly' ? tier.yearly_price : tier.monthly_price;
        const discountAmount = apply_discount ? basePrice * 0.1 : 0; // 10% 할인
        const finalPrice = basePrice - discountAmount;
          const renewalSimulation = {
            user_id,
            current_subscription: currentSubscription,
            renewal_period,
            renewal_date: new Date(Date.now() + (renewal_period === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
            base_price: basePrice,
            discount_applied: apply_discount,
            discount_amount: discountAmount,
            final_price: finalPrice,
            auto_renewal: currentSubscription.auto_renewal,
            payment_simulation: true,
            simulation_timestamp: new Date().toISOString()
        };
        
        res.status(200).json({
            message: 'Subscription renewal simulation completed',
            simulation: renewalSimulation
        });
        
    } catch (error) {
        console.error('[subscriptionController] Error simulating renewal:', error);
        res.status(500).json({
            error: 'Failed to simulate subscription renewal',
            message: error.message
        });
    }
}

module.exports = {
    getSubscriptionTiersController,
    getUserSubscriptionController,
    updateUserSubscriptionController,
    cancelUserSubscriptionController,
    getUserSubscriptionHistoryController,
    checkFeatureAccessController,
    checkDailyUsageController,
    simulateSubscriptionUpgradeController,
    simulateSubscriptionRenewalController
};
