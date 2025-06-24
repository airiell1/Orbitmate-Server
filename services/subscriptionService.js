const subscriptionModel = require("../models/subscription");
const { withTransaction } = require("../utils/dbUtils");
// const config = require("../config"); // 필요시 설정값 사용

/**
 * 구독 등급 목록 조회 서비스
 * @returns {Promise<Array>} 구독 등급 목록
 */
async function getSubscriptionTiersService() {
  return await withTransaction(async (connection) => {
    return await subscriptionModel.getSubscriptionTiers(connection);
  });
}

/**
 * 사용자 구독 정보 조회 서비스. 구독이 없으면 기본 무료 구독을 생성.
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 사용자 구독 정보
 */
async function getUserSubscriptionService(userId) {
  return await withTransaction(async (connection) => {
    // 모델의 getUserSubscription은 connection을 인자로 받음
    // 해당 함수는 구독이 없으면 createDefaultSubscription을 호출함
    return await subscriptionModel.getUserSubscription(connection, userId);
  });
}

// createDefaultSubscriptionService는 모델의 createDefaultSubscription이
// getUserSubscriptionService에 의해 호출되는 구조이므로, 서비스 레벨에서 별도로 노출할 필요는 없을 수 있음.
// 모델의 createDefaultSubscription이 connection을 받도록 수정되었는지 확인 필요.

/**
 * 한국어 구독 등급명을 영어로 매핑하는 헬퍼 함수 (모델에도 있지만 서비스에서 사용할 수 있도록 중복 정의 또는 import)
 * @param {string} koreanTierName - 한국어 구독 등급명
 * @returns {string} 영어 구독 등급명
 */
function mapKoreanTierNameToEnglishService(koreanTierName) {
    // 이 함수는 subscriptionModel에서 가져와 사용하거나, 여기서 직접 정의할 수 있습니다.
    // 현재 subscriptionModel에 해당 함수가 export 되어 있지 않다면 여기서 정의합니다.
    const tierMapping = { 코멧: "free", 플래닛: "planet", 스타: "star", 갤럭시: "galaxy" };
    return tierMapping[koreanTierName] || koreanTierName.toLowerCase();
}


/**
 * 구독 업그레이드/다운그레이드 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} newTierName - 새로운 구독 등급 (한국어 또는 영어)
 * @param {Object} options - 구독 옵션 (payment_method, billing_cycle, auto_renewal)
 * @returns {Promise<Object>} 업데이트된 구독 정보
 */
async function updateUserSubscriptionService(userId, newTierName, options = {}) {
  return await withTransaction(async (connection) => {
    // newTierName을 영어로 변환하는 로직은 서비스 내에서 처리 가능
    // const englishTierName = mapKoreanTierNameToEnglishService(newTierName);
    // 모델 함수가 이미 이 변환을 처리한다면 서비스에서는 그냥 전달
    return await subscriptionModel.updateUserSubscription(connection, userId, newTierName, options);
  });
}

/**
 * 구독 취소 서비스 (무료 등급으로 다운그레이드)
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 업데이트된 구독 정보 (무료 등급)
 */
async function cancelUserSubscriptionService(userId) {
  return await withTransaction(async (connection) => {
    // 모델의 cancelUserSubscription이 connection을 받도록 수정되었다고 가정
    return await subscriptionModel.cancelUserSubscription(connection, userId);
  });
}

/**
 * 사용자 구독 이력 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} 구독 이력 목록
 */
async function getUserSubscriptionHistoryService(userId) {
  return await withTransaction(async (connection) => {
    return await subscriptionModel.getUserSubscriptionHistory(connection, userId);
  });
}

/**
 * 사용자 기능 접근 권한 확인 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} featureName - 확인할 기능명
 * @returns {Promise<boolean>} 권한 여부
 */
async function checkUserFeatureAccessService(userId, featureName) {
  // 이 함수는 여러 DB 조회를 포함할 수 있으므로 withTransaction 사용
  return await withTransaction(async (connection) => {
    // 모델의 checkUserFeatureAccess가 connection을 받도록 수정되었다고 가정
    return await subscriptionModel.checkUserFeatureAccess(connection, userId, featureName);
  });
}

/**
 * 일일 AI 요청 사용량 확인 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 사용량 정보
 */
async function checkDailyUsageService(userId) {
  return await withTransaction(async (connection) => {
    // 모델의 checkDailyUsage가 connection을 받도록 수정되었다고 가정
    return await subscriptionModel.checkDailyUsage(connection, userId);
  });
}


/**
 * 구독 업그레이드 시뮬레이션 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} targetTierName - 대상 구독 등급명
 * @returns {Promise<Object>} 시뮬레이션 결과
 */
async function simulateSubscriptionUpgradeService(userId, targetTierName) {
    return await withTransaction(async (connection) => {
        const tiers = await subscriptionModel.getSubscriptionTiers(connection);
        // 모델에 mapKoreanTierNameToEnglish가 있다면 사용, 없다면 여기서 정의한 것 사용
        const englishTargetTierName = subscriptionModel.mapKoreanTierNameToEnglish
            ? subscriptionModel.mapKoreanTierNameToEnglish(targetTierName)
            : mapKoreanTierNameToEnglishService(targetTierName);

        const targetTier = tiers.find(tier => tier.tier_name === englishTargetTierName);

        if (!targetTier) {
            const err = new Error(`Subscription tier '${targetTierName}' (mapped to '${englishTargetTierName}') not found`);
            err.code = "RESOURCE_NOT_FOUND";
            throw err;
        }

        const currentSubscriptionData = await subscriptionModel.getUserSubscription(connection, userId);
        // getUserSubscription은 이미 tier 객체를 포함하여 반환

        return {
            user_id: userId,
            current_tier: currentSubscriptionData?.tier || null, // 현재 구독이 없을 수 있음
            target_tier: targetTier,
            upgrade_type: targetTier.tier_level > (currentSubscriptionData?.tier?.tier_level || 0) ? "upgrade" : "downgrade",
            estimated_monthly_cost: targetTier.monthly_price,
            estimated_yearly_cost: targetTier.yearly_price,
            new_features: targetTier.features_included,
            payment_simulation: true,
            can_proceed: true, // 실제로는 추가 검증 로직 필요
            simulation_timestamp: new Date().toISOString(),
        };
    });
}

/**
 * 구독 갱신 시뮬레이션 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} renewalPeriod - 갱신 주기 ('monthly' or 'yearly')
 * @param {boolean} applyDiscount - 할인 적용 여부
 * @returns {Promise<Object>} 시뮬레이션 결과
 */
async function simulateSubscriptionRenewalService(userId, renewalPeriod = "monthly", applyDiscount = false) {
    return await withTransaction(async (connection) => {
        const currentSubscriptionData = await subscriptionModel.getUserSubscription(connection, userId);

        let simulationResult = {
            user_id: userId,
            renewal_period: renewalPeriod,
            discount_applied: applyDiscount,
            auto_renewal: true, // 시뮬레이션 기본값
            payment_simulation: true,
        };

        if (!currentSubscriptionData || !currentSubscriptionData.tier || currentSubscriptionData.tier.tier_name === "free") {
            const tiers = await subscriptionModel.getSubscriptionTiers(connection);
            const defaultPaidTier = tiers.find(tier => tier.tier_level === 2); // 예시: 플래닛 등급
            if (!defaultPaidTier) {
                const err = new Error("No paid subscription tiers available for renewal simulation from free.");
                err.code = "RESOURCE_NOT_FOUND";
                throw err;
            }
            const basePrice = renewalPeriod === "yearly" ? defaultPaidTier.yearly_price : defaultPaidTier.monthly_price;
            const discountAmount = applyDiscount ? basePrice * 0.1 : 0; // 10% 할인 예시

            simulationResult = {
                ...simulationResult,
                current_subscription_tier_name: currentSubscriptionData?.tier?.tier_name || "free",
                suggested_tier_name: defaultPaidTier.tier_name,
                suggested_tier_details: defaultPaidTier, // 상세 정보 추가
                base_price: basePrice,
                discount_amount: discountAmount,
                final_price: basePrice - discountAmount,
                simulation_type: "upgrade_from_free",
            };
        } else {
            const tier = currentSubscriptionData.tier;
            const basePrice = renewalPeriod === "yearly" ? tier.yearly_price : tier.monthly_price;
            const discountAmount = applyDiscount ? basePrice * 0.1 : 0;

            simulationResult = {
                ...simulationResult,
                current_subscription_tier_name: tier.tier_name,
                current_tier_details: tier, // 현재 등급 상세 정보
                base_price: basePrice,
                discount_amount: discountAmount,
                final_price: basePrice - discountAmount,
                auto_renewal: currentSubscriptionData.auto_renewal, // 실제 값 사용
                simulation_type: "renewal",
            };
        }
        simulationResult.renewal_date = new Date(Date.now() + (renewalPeriod === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString();
        simulationResult.simulation_timestamp = new Date().toISOString();
        return simulationResult;
    });
}


module.exports = {
  getSubscriptionTiersService,
  getUserSubscriptionService,
  updateUserSubscriptionService,
  cancelUserSubscriptionService,
  getUserSubscriptionHistoryService,
  checkUserFeatureAccessService,
  checkDailyUsageService,
  simulateSubscriptionUpgradeService,
  simulateSubscriptionRenewalService,
  mapKoreanTierNameToEnglishService, // 필요시 외부에서 사용 가능하도록 export
};
