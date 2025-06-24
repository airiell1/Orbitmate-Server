// controllers/subscriptionController.js
const subscriptionService = require("../services/subscriptionService"); // 서비스 계층 사용
const { standardizeApiResponse } = require("../utils/apiResponse");
// const { withTransaction } = require("../utils/dbUtils"); // 컨트롤러에서 직접 사용 안 함

/**
 * 구독 등급 목록 조회 API
 * GET /api/subscriptions/tiers
 */
async function getSubscriptionTiersController(req, res, next) {
  try {
    // 서비스 계층 함수 호출 시에는 connection 객체를 전달하지 않음
    const tiers = await subscriptionService.getSubscriptionTiersService();
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
    const subscription = await subscriptionService.getUserSubscriptionService(user_id);
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
    // 상세 유효성 검사는 서비스 계층 또는 여기서 추가 가능

    const options = { payment_method, billing_cycle, auto_renewal };
    const updatedSubscription = await subscriptionService.updateUserSubscriptionService(user_id, tier_name, options);

    const apiResponse = standardizeApiResponse({
      message: "Subscription updated successfully",
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

    const canceledSubscription = await subscriptionService.cancelUserSubscriptionService(user_id);

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
    const history = await subscriptionService.getUserSubscriptionHistoryService(user_id);
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
    // 서비스 계층 함수 호출
    const hasAccess = await subscriptionService.checkUserFeatureAccessService(user_id, feature_name);

    const apiResponse = standardizeApiResponse({ user_id, feature_name, has_access: hasAccess });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
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
    const usage = await subscriptionService.checkDailyUsageService(user_id);
    const apiResponse = standardizeApiResponse(usage);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

/**
 * 구독 업그레이드 시뮬레이션 API
 * POST /api/users/:user_id/subscription/upgrade
 */
async function simulateSubscriptionUpgradeController(req, res, next) {
  try {
    const { user_id } = req.params;
    const { tier_name } = req.body;

    if (!user_id || !tier_name) {
      const err = new Error("User ID and Tier Name are required for simulation.");
      err.code = "INVALID_INPUT";
      return next(err);
    }

    const simulationResult = await subscriptionService.simulateSubscriptionUpgradeService(user_id, tier_name);

    const apiResponse = standardizeApiResponse({
        message: "Subscription upgrade simulation completed",
        simulation: simulationResult
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 구독 갱신 시뮬레이션 API
 * POST /api/users/:user_id/subscription/renewal
 */
async function simulateSubscriptionRenewalController(req, res, next) {
  try {
    const { user_id } = req.params;
    const { renewal_period = "monthly", apply_discount = false } = req.body;

     if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }

    const renewalSimulation = await subscriptionService.simulateSubscriptionRenewalService(user_id, renewal_period, apply_discount);

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
