// controllers/subscriptionController.js
const subscriptionModel = require("../models/subscription");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { withTransaction } = require("../utils/dbUtils");

/**
 * 구독 등급 목록 조회 API
 * GET /api/subscriptions/tiers
 */
async function getSubscriptionTiersController(req, res, next) {
  try {
    const tiers = await withTransaction(async (connection) => {
      return await subscriptionModel.getSubscriptionTiers(connection);
    });
    const apiResponse = standardizeApiResponse(tiers);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 구독 정보 조회 API
 * GET /api/users/:user_id/subscription
 */
async function getUserSubscriptionController(req, res, next) {
  try {
    const { user_id } = req.params;
    if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }
    const subscription = await withTransaction(async (connection) => {
      return await subscriptionModel.getUserSubscription(connection, user_id);
    });
    const apiResponse = standardizeApiResponse(subscription);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

/**
 * 구독 업그레이드/다운그레이드 API
 * PUT /api/users/:user_id/subscription
 */
async function updateUserSubscriptionController(req, res, next) {
  try {
    const { user_id } = req.params;
    const { tier_name, payment_method, billing_cycle, auto_renewal } = req.body;

    if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }
    if (!tier_name) {
      const err = new Error("Tier name is required to update subscription.");
      err.code = "INVALID_INPUT";
      return next(err);
    }

    const options = {
      payment_method: payment_method, // 모델에서 기본값 처리
      billing_cycle: billing_cycle,   // 모델에서 기본값 처리
      auto_renewal: auto_renewal,     // 모델에서 기본값 처리
    };

    const updatedSubscription = await withTransaction(async (connection) => {
      return await subscriptionModel.updateUserSubscription(connection, user_id, tier_name, options);
    });

    const apiResponse = standardizeApiResponse({
      message: "Subscription updated successfully", // 컨트롤러에서 메시지 추가 가능
      subscription: updatedSubscription,
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 구독 취소 API
 * DELETE /api/users/:user_id/subscription
 */
async function cancelUserSubscriptionController(req, res, next) {
  try {
    const { user_id } = req.params;
     if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }

    const canceledSubscription = await withTransaction(async (connection) => {
      return await subscriptionModel.cancelUserSubscription(connection, user_id);
    });

    const apiResponse = standardizeApiResponse({
      message: "Subscription canceled successfully",
      subscription: canceledSubscription,
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

/**
 * 구독 이력 조회 API
 * GET /api/users/:user_id/subscription/history
 */
async function getUserSubscriptionHistoryController(req, res, next) {
  try {
    const { user_id } = req.params;
    if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }
    const history = await withTransaction(async (connection) => {
      return await subscriptionModel.getUserSubscriptionHistory(connection, user_id);
    });
    const apiResponse = standardizeApiResponse(history);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

/**
 * 기능 접근 권한 확인 API
 * GET /api/users/:user_id/subscription/features/:feature_name
 */
async function checkFeatureAccessController(req, res, next) {
  try {
    const { user_id, feature_name } = req.params;
    if (!user_id || !feature_name) {
        const err = new Error("User ID and Feature Name are required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }
    // 이 함수는 DB 쓰기 작업이 없으므로 withTransaction이 필수는 아님.
    // 하지만 일관성 또는 getUserSubscription 내부 로직에 따라 필요할 수 있음.
    // 모델에서 connection을 받도록 수정했으므로 여기서도 withTransaction 사용.
    const hasAccess = await withTransaction(async (connection) => {
        return await subscriptionModel.checkUserFeatureAccess(connection, user_id, feature_name);
    });

    const apiResponse = standardizeApiResponse({ user_id, feature_name, has_access: hasAccess });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    // checkUserFeatureAccess 모델 함수가 false를 반환하므로, 여기서 에러는 DB 문제일 가능성
    next(error);
  }
}

/**
 * 일일 사용량 확인 API
 * GET /api/users/:user_id/subscription/usage
 */
async function checkDailyUsageController(req, res, next) {
  try {
    const { user_id } = req.params;
     if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }
    const usage = await withTransaction(async (connection) => {
        return await subscriptionModel.checkDailyUsage(connection, user_id);
    });
    const apiResponse = standardizeApiResponse(usage);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}


// 시뮬레이션 API들은 실제 DB 변경이 없으므로 withTransaction을 사용하지 않을 수 있으나,
// 내부적으로 getSubscriptionTiers, getUserSubscription 등을 호출하므로 DB 접근이 필요.
// 따라서 이들도 withTransaction으로 감싸거나, 해당 모델 함수들이 connection을 받도록 해야 함.
// 모델 함수들이 이미 connection을 받도록 수정되었으므로 withTransaction 사용.

async function simulateSubscriptionUpgradeController(req, res, next) {
  try {
    const { user_id } = req.params;
    const { tier_name, simulation_type = "upgrade" } = req.body;

    if (!user_id || !tier_name) {
      const err = new Error("User ID and Tier Name are required for simulation.");
      err.code = "INVALID_INPUT";
      return next(err);
    }

    const simulationResult = await withTransaction(async (connection) => {
        const tiers = await subscriptionModel.getSubscriptionTiers(connection);
        const englishTierName = subscriptionModel.mapKoreanTierNameToEnglish(tier_name); // 모델의 헬퍼 함수 사용
        const targetTier = tiers.find((tier) => tier.tier_name === englishTierName);

        if (!targetTier) {
            const err = new Error(`Subscription tier '${tier_name}' (mapped to '${englishTierName}') not found`);
            err.code = "RESOURCE_NOT_FOUND";
            throw err;
        }

        const currentSubscriptionData = await subscriptionModel.getUserSubscription(connection, user_id);
        // currentSubscriptionData는 standardizeApiResponse를 거치지 않은 순수 객체여야 함.
        // 모델에서 이미 그렇게 반환하고 있음.

        return { // 시뮬레이션 결과 직접 구성
            user_id,
            current_tier: currentSubscriptionData?.tier || null,
            target_tier: targetTier,
            upgrade_type: targetTier.tier_level > (currentSubscriptionData?.tier?.tier_level || 0) ? "upgrade" : "downgrade",
            estimated_monthly_cost: targetTier.monthly_price,
            estimated_yearly_cost: targetTier.yearly_price,
            new_features: targetTier.features_included,
            payment_simulation: true, // 이 값은 실제 의미가 없음, 예시
            can_proceed: true, // 이 값도 실제 의미가 없음, 예시
            simulation_timestamp: new Date().toISOString(),
        };
    });

    const apiResponse = standardizeApiResponse({
        message: "Subscription upgrade simulation completed",
        simulation: simulationResult
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

async function simulateSubscriptionRenewalController(req, res, next) {
  try {
    const { user_id } = req.params;
    const { renewal_period = "monthly", apply_discount = false } = req.body;

     if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }

    const renewalSimulation = await withTransaction(async (connection) => {
        const currentSubscriptionData = await subscriptionModel.getUserSubscription(connection, user_id);

        if (!currentSubscriptionData || !currentSubscriptionData.tier || currentSubscriptionData.tier.tier_name === "free") {
            const tiers = await subscriptionModel.getSubscriptionTiers(connection);
            const defaultPaidTier = tiers.find((tier) => tier.tier_level === 2); // Example: Planet Tier
            if (!defaultPaidTier) {
                 const err = new Error("No paid subscription tiers available for renewal simulation from free.");
                 err.code = "RESOURCE_NOT_FOUND";
                 throw err;
            }
            const basePrice = renewal_period === "yearly" ? defaultPaidTier.yearly_price : defaultPaidTier.monthly_price;
            const discountAmount = apply_discount ? basePrice * 0.1 : 0;
            return {
                user_id,
                current_subscription_tier_name: currentSubscriptionData?.tier?.tier_name || "free",
                suggested_tier_name: defaultPaidTier.tier_name,
                renewal_period,
                renewal_date: new Date(Date.now() + (renewal_period === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
                base_price: basePrice,
                discount_applied: apply_discount,
                discount_amount: discountAmount,
                final_price: basePrice - discountAmount,
                auto_renewal: true, // Default for simulation
                simulation_type: "upgrade_from_free",
            };
        }

        const tier = currentSubscriptionData.tier;
        const basePrice = renewal_period === "yearly" ? tier.yearly_price : tier.monthly_price;
        const discountAmount = apply_discount ? basePrice * 0.1 : 0;
        return {
            user_id,
            current_subscription_tier_name: tier.tier_name,
            renewal_period,
            renewal_date: new Date(Date.now() + (renewal_period === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
            base_price: basePrice,
            discount_applied: apply_discount,
            discount_amount: discountAmount,
            final_price: basePrice - discountAmount,
            auto_renewal: currentSubscriptionData.auto_renewal,
        };
    });

    renewalSimulation.simulation_timestamp = new Date().toISOString(); // 타임스탬프 추가
    const apiResponse = standardizeApiResponse({
        message: "Subscription renewal simulation completed",
        simulation: renewalSimulation
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
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
  simulateSubscriptionRenewalController,
};
