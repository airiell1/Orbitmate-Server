// controllers/subscriptionController.js
const {
  createController,
  createSubscriptionController,
  createReadController
} = require("../utils/serviceFactory");
const subscriptionService = require("../services/subscriptionService");
const { standardizeApiResponse } = require("../utils/apiResponse");

// =========================
// 💳 구독 관리 (Subscription Management)
// =========================

/**
 * 구독 등급 목록 조회 API - ServiceFactory 패턴 적용
 * GET /api/subscriptions/tiers
 */
const getSubscriptionTiersController = createReadController(
  subscriptionService.getSubscriptionTiersService,
  {
    dataExtractor: () => [], // 파라미터 없음
    validations: [], // 유효성 검사 없음
    errorContext: 'subscription_tiers'
  }
);

/**
 * 사용자 구독 정보 조회 API - ServiceFactory 패턴 적용
 * GET /api/users/:user_id/subscription
 */
const getUserSubscriptionController = createSubscriptionController(
  subscriptionService.getUserSubscriptionService,
  {
    dataExtractor: (req) => [req.params.user_id],
    errorContext: 'user_subscription'
  }
);

/**
 * 구독 업그레이드/다운그레이드 API - ServiceFactory 패턴 적용
 * PUT /api/users/:user_id/subscription
 */
const updateUserSubscriptionController = createSubscriptionController(
  subscriptionService.updateUserSubscriptionService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { tier_name, payment_method, billing_cycle, auto_renewal } = req.body;
      const options = { payment_method, billing_cycle, auto_renewal };
      return [user_id, tier_name, options];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { tier_name } = req.body;
        
        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        if (!tier_name) {
          const err = new Error("Tier name is required to update subscription.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    responseTransformer: (result) => ({
      message: "Subscription updated successfully",
      subscription: result,
    }),
    errorContext: 'subscription_update'
  }
);

/**
 * 구독 취소 API - ServiceFactory 패턴 적용
 * DELETE /api/users/:user_id/subscription
 */
const cancelUserSubscriptionController = createSubscriptionController(
  subscriptionService.cancelUserSubscriptionService,
  {
    dataExtractor: (req) => [req.params.user_id],
    responseTransformer: (result) => ({
      message: "Subscription canceled successfully",
      subscription: result,
    }),
    errorContext: 'subscription_cancel'
  }
);

/**
 * 구독 이력 조회 API - ServiceFactory 패턴 적용
 * GET /api/users/:user_id/subscription/history
 */
const getUserSubscriptionHistoryController = createSubscriptionController(
  subscriptionService.getUserSubscriptionHistoryService,
  {
    dataExtractor: (req) => [req.params.user_id],
    errorContext: 'subscription_history'
  }
);

/**
 * 기능 접근 권한 확인 API - ServiceFactory 패턴 적용
 * GET /api/users/:user_id/subscription/features/:feature_name
 */
const checkFeatureAccessController = createController(
  subscriptionService.checkFeatureAccessService,
  {
    dataExtractor: (req) => {
      const { user_id, feature_name } = req.params;
      return [user_id, feature_name];
    },
    validations: [
      (req) => {
        const { user_id, feature_name } = req.params;
        
        if (!user_id || !feature_name) {
          const err = new Error("User ID and Feature Name are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    responseTransformer: (result, req) => ({
      user_id: req.params.user_id,
      feature_name: req.params.feature_name,
      has_access: result
    }),
    errorContext: 'feature_access'
  }
);

/**
 * 일일 사용량 확인 API - ServiceFactory 패턴 적용
 * GET /api/users/:user_id/subscription/usage
 */
const checkDailyUsageController = createSubscriptionController(
  subscriptionService.checkDailyUsageService,
  {
    dataExtractor: (req) => [req.params.user_id],
    errorContext: 'daily_usage'
  }
);

/**
 * 구독 업그레이드 시뮬레이션 API - ServiceFactory 패턴 적용
 * POST /api/users/:user_id/subscription/upgrade
 */
const simulateSubscriptionUpgradeController = createController(
  subscriptionService.simulateSubscriptionUpgradeService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { tier_name } = req.body;
      return [user_id, tier_name];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { tier_name } = req.body;

        if (!user_id || !tier_name) {
          const err = new Error("User ID and Tier Name are required for simulation.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    responseTransformer: (result) => ({
      message: "Subscription upgrade simulation completed",
      simulation: result
    }),
    successStatusCode: 201,
    errorContext: 'subscription_simulation'
  }
);

/**
 * 구독 갱신 시뮬레이션 API - ServiceFactory 패턴 적용
 * POST /api/users/:user_id/subscription/renewal
 */
const simulateSubscriptionRenewalController = createController(
  subscriptionService.simulateSubscriptionRenewalService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { renewal_period = "monthly", apply_discount = false } = req.body;
      return [user_id, renewal_period, apply_discount];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        
        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    responseTransformer: (result) => ({
      message: "Subscription renewal simulation completed",
      simulation: result
    }),
    successStatusCode: 201,
    errorContext: 'subscription_renewal'
  }
);

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
