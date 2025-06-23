// middleware/subscription.js
const {
  getUserSubscription,
  checkDailyUsage,
} = require("../models/subscription");

/**
 * 기능 접근 권한 체크 미들웨어
 * @param {string} requiredFeature - 필요한 기능명
 * @returns {Function} 미들웨어 함수
 */
function requireFeature(requiredFeature) {
  return async (req, res, next) => {
    try {
      const user_id = req.params.user_id || req.body.user_id || "guest";

      console.log(
        `[subscriptionMiddleware] Checking feature access: ${requiredFeature} for user: ${user_id}`
      );

      const subscription = await getUserSubscription(user_id);

      if (!subscription.data || !subscription.data.tier) {
        return res.status(403).json({
          error: "Subscription required",
          message: "No active subscription found",
          required_feature: requiredFeature,
        });
      }

      const features = subscription.data.tier.features_included || [];
      const hasAccess = features.includes(requiredFeature);

      if (!hasAccess) {
        return res.status(403).json({
          error: "Feature not available",
          message: `This feature requires a higher subscription tier`,
          required_feature: requiredFeature,
          current_tier: subscription.data.tier.tier_name,
          available_features: features,
        });
      }

      // 구독 정보를 req에 추가하여 다음 미들웨어/컨트롤러에서 사용 가능
      req.userSubscription = subscription.data;
      next();
    } catch (error) {
      console.error(
        "[subscriptionMiddleware] Error checking feature access:",
        error
      );
      res.status(500).json({
        error: "Failed to check feature access",
        message: error.message,
      });
    }
  };
}

/**
 * 일일 사용량 제한 체크 미들웨어
 * @returns {Function} 미들웨어 함수
 */
function checkDailyLimit() {
  return async (req, res, next) => {
    try {
      const user_id = req.params.user_id || req.body.user_id || "guest";

      console.log(
        `[subscriptionMiddleware] Checking daily usage limit for user: ${user_id}`
      );

      const usage = await checkDailyUsage(user_id);

      if (!usage.data.can_make_request) {
        return res.status(429).json({
          error: "Daily limit exceeded",
          message: "You have reached your daily AI request limit",
          usage_info: usage.data,
        });
      }

      // 사용량 정보를 req에 추가
      req.dailyUsage = usage.data;
      next();
    } catch (error) {
      console.error(
        "[subscriptionMiddleware] Error checking daily limit:",
        error
      );
      res.status(500).json({
        error: "Failed to check daily limit",
        message: error.message,
      });
    }
  };
}

/**
 * 구독 등급 레벨 체크 미들웨어
 * @param {number} minTierLevel - 최소 필요 등급 레벨
 * @returns {Function} 미들웨어 함수
 */
function requireTierLevel(minTierLevel) {
  return async (req, res, next) => {
    try {
      const user_id = req.params.user_id || req.body.user_id || "guest";

      console.log(
        `[subscriptionMiddleware] Checking tier level: ${minTierLevel} for user: ${user_id}`
      );

      const subscription = await getUserSubscription(user_id);

      if (!subscription.data || !subscription.data.tier) {
        return res.status(403).json({
          error: "Subscription required",
          message: "No active subscription found",
          required_tier_level: minTierLevel,
        });
      }

      const userTierLevel = subscription.data.tier.tier_level;

      if (userTierLevel < minTierLevel) {
        return res.status(403).json({
          error: "Insufficient subscription tier",
          message: `This feature requires tier level ${minTierLevel} or higher`,
          current_tier_level: userTierLevel,
          required_tier_level: minTierLevel,
          current_tier: subscription.data.tier.tier_name,
        });
      }

      req.userSubscription = subscription.data;
      next();
    } catch (error) {
      console.error(
        "[subscriptionMiddleware] Error checking tier level:",
        error
      );
      res.status(500).json({
        error: "Failed to check tier level",
        message: error.message,
      });
    }
  };
}

/**
 * 파일 업로드 크기 제한 체크 미들웨어
 * @param {number} fileSize - 업로드할 파일 크기 (bytes)
 * @returns {Function} 미들웨어 함수
 */
function checkFileUploadLimit(fileSize) {
  return async (req, res, next) => {
    try {
      const user_id = req.params.user_id || req.body.user_id || "guest";

      console.log(
        `[subscriptionMiddleware] Checking file upload limit for user: ${user_id}, file size: ${fileSize} bytes`
      );

      const subscription = await getUserSubscription(user_id);

      if (!subscription.data || !subscription.data.tier) {
        return res.status(403).json({
          error: "Subscription required",
          message: "No active subscription found",
        });
      }

      const maxFileSize =
        subscription.data.tier.max_file_upload_size * 1024 * 1024; // MB to bytes

      if (fileSize > maxFileSize) {
        return res.status(413).json({
          error: "File too large",
          message: `File size exceeds your subscription limit`,
          file_size_bytes: fileSize,
          max_file_size_bytes: maxFileSize,
          max_file_size_mb: subscription.data.tier.max_file_upload_size,
          current_tier: subscription.data.tier.tier_name,
        });
      }

      req.userSubscription = subscription.data;
      next();
    } catch (error) {
      console.error(
        "[subscriptionMiddleware] Error checking file upload limit:",
        error
      );
      res.status(500).json({
        error: "Failed to check file upload limit",
        message: error.message,
      });
    }
  };
}

module.exports = {
  requireFeature,
  checkDailyLimit,
  requireTierLevel,
  checkFileUploadLimit,
};
