// models/subscription.js
const { getConnection } = require("../config/database");
const { standardizeApiResponse } = require("../utils/apiResponse");

/**
 * 구독 등급 목록 조회
 * @returns {Promise<Array>} 구독 등급 목록
 */
async function getSubscriptionTiers() {
  let connection;
  try {
    connection = await getConnection();

    const query = `
            SELECT 
                tier_id,
                tier_name,
                tier_display_name,
                tier_emoji,
                monthly_price,
                yearly_price,
                tier_level,
                max_ai_requests_per_day,
                max_file_upload_size,
                features_included,
                is_enterprise,
                is_active
            FROM subscription_tiers
            WHERE is_active = 1
            ORDER BY tier_level ASC
        `;

    const result = await connection.execute(query);
    const tiers = result.rows.map((row) => {
      let featuresIncluded = [];

      // features_included 필드 안전하게 파싱
      if (row[9]) {
        try {
          // 이미 객체인 경우 그대로 사용
          if (typeof row[9] === "object") {
            featuresIncluded = Array.isArray(row[9]) ? row[9] : [];
          }
          // 문자열인 경우 JSON 파싱
          else if (typeof row[9] === "string") {
            featuresIncluded = JSON.parse(row[9]);
          }
        } catch (parseError) {
          console.warn(
            "[subscriptionModel] Failed to parse features_included:",
            row[9],
            parseError
          );
          featuresIncluded = [];
        }
      }

      const tierData = {
        tier_id: row[0],
        tier_name: row[1],
        tier_display_name: row[2],
        tier_emoji: row[3],
        monthly_price: row[4],
        yearly_price: row[5],
        tier_level: row[6],
        max_ai_requests_per_day: row[7],
        max_file_upload_size: row[8],
        features_included: featuresIncluded,
        is_enterprise: row[10] === 1,
        is_active: row[11] === 1,
      };
      return tierData;
    });

    return standardizeApiResponse(tiers);
  } catch (error) {
    console.error(
      "[subscriptionModel] Error getting subscription tiers:",
      error
    );
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

/**
 * 사용자 구독 정보 조회
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object>} 사용자 구독 정보
 */
async function getUserSubscription(user_id) {
  let connection;
  try {
    connection = await getConnection();
    const query = `
            SELECT 
                us.subscription_id,
                us.user_id,
                us.tier_id,
                us.subscription_start,
                us.subscription_end,
                us.is_active,
                us.payment_method,
                us.auto_renewal,
                us.created_at,
                us.updated_at,
                st.tier_name,
                st.tier_display_name,
                st.tier_emoji,
                st.monthly_price,
                st.yearly_price,
                st.tier_level,
                st.max_ai_requests_per_day,
                st.max_file_upload_size,
                st.features_included,
                st.is_enterprise
            FROM user_subscriptions us
            JOIN subscription_tiers st ON us.tier_id = st.tier_id
            WHERE us.user_id = :user_id 
            AND us.is_active = 1
            AND ROWNUM = 1
            ORDER BY us.created_at DESC
        `;

    const result = await connection.execute(query, { user_id });

    if (result.rows.length === 0) {
      // 구독이 없으면 무료 등급으로 자동 설정
      return await createDefaultSubscription(user_id);
    }

    const row = result.rows[0]; // features_included 필드 안전하게 파싱
    let featuresIncluded = [];
    if (row[18]) {
      try {
        // 이미 객체인 경우 그대로 사용
        if (typeof row[18] === "object") {
          featuresIncluded = Array.isArray(row[18]) ? row[18] : [];
        }
        // 문자열인 경우 JSON 파싱
        else if (typeof row[18] === "string") {
          featuresIncluded = JSON.parse(row[18]);
        }
      } catch (parseError) {
        console.warn(
          "[subscriptionModel] Failed to parse features_included:",
          row[18],
          parseError
        );
        featuresIncluded = [];
      }
    }

    const subscription = {
      subscription_id: row[0],
      user_id: row[1],
      tier_id: row[2],
      subscription_start: row[3],
      subscription_end: row[4],
      is_active: row[5] === 1,
      payment_method: row[6],
      auto_renewal: row[7] === 1,
      created_at: row[8],
      updated_at: row[9],
      tier: {
        tier_name: row[10],
        tier_display_name: row[11],
        tier_emoji: row[12],
        monthly_price: row[13],
        yearly_price: row[14],
        tier_level: row[15],
        max_ai_requests_per_day: row[16],
        max_file_upload_size: row[17],
        features_included: featuresIncluded,
        is_enterprise: row[19] === 1,
      },
    };

    return standardizeApiResponse(subscription);
  } catch (error) {
    console.error(
      "[subscriptionModel] Error getting user subscription:",
      error
    );
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

/**
 * 기본 무료 구독 생성
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object>} 생성된 구독 정보
 */
async function createDefaultSubscription(user_id) {
  let connection;
  try {
    connection = await getConnection();

    // 무료 등급 ID 조회
    const tierQuery = `
            SELECT tier_id FROM subscription_tiers 
            WHERE tier_name = 'free' AND is_active = 1
        `;
    const tierResult = await connection.execute(tierQuery);

    if (tierResult.rows.length === 0) {
      throw new Error("Free tier not found");
    }

    const freeTierId = tierResult.rows[0][0];

    // 무료 구독 생성
    const insertQuery = `
            INSERT INTO user_subscriptions (
                user_id, tier_id, subscription_start, 
                subscription_end, is_active, payment_method, auto_renewal
            ) VALUES (
                :user_id, :tier_id, SYSTIMESTAMP, 
                NULL, 1, 'free', 0
            )
        `;

    await connection.execute(insertQuery, {
      user_id,
      tier_id: freeTierId,
    });

    await connection.commit();

    // 생성된 구독 정보 반환
    return await getUserSubscription(user_id);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error(
      "[subscriptionModel] Error creating default subscription:",
      error
    );
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// 한국어 구독 등급명을 영어로 매핑하는 함수
function mapKoreanTierNameToEnglish(koreanTierName) {
  const tierMapping = {
    코멧: "free",
    플래닛: "planet",
    스타: "star",
    갤럭시: "galaxy",
  };

  // 한국어 이름이면 영어로 변환, 아니면 그대로 반환
  return tierMapping[koreanTierName] || koreanTierName.toLowerCase();
}

/**
 * 구독 업그레이드/다운그레이드
 * @param {string} user_id - 사용자 ID
 * @param {string} new_tier_name - 새로운 구독 등급
 * @param {Object} options - 구독 옵션
 * @returns {Promise<Object>} 업데이트된 구독 정보
 */
async function updateUserSubscription(user_id, new_tier_name, options = {}) {
  let connection;
  try {
    connection = await getConnection();

    const {
      payment_method = "card",
      billing_cycle = "monthly",
      auto_renewal = true,
    } = options;

    // 한국어 구독 등급명을 영어로 변환
    const englishTierName = mapKoreanTierNameToEnglish(new_tier_name);
    console.log(
      `[subscriptionModel] Mapped tier name: ${new_tier_name} -> ${englishTierName}`
    );

    // 새로운 등급 정보 조회
    const tierQuery = `
            SELECT tier_id, tier_level, monthly_price, yearly_price
            FROM subscription_tiers 
            WHERE tier_name = :tier_name AND is_active = 1
        `;
    const tierResult = await connection.execute(tierQuery, {
      tier_name: englishTierName,
    });
    if (tierResult.rows.length === 0) {
      throw new Error(
        `Subscription tier '${new_tier_name}' (mapped to '${englishTierName}') not found`
      );
    }

    const [new_tier_id, tier_level, monthly_price, yearly_price] =
      tierResult.rows[0];

    // 기존 구독 비활성화
    const deactivateQuery = `
            UPDATE user_subscriptions 
            SET is_active = 0, updated_at = SYSTIMESTAMP
            WHERE user_id = :user_id AND is_active = 1
        `;
    await connection.execute(deactivateQuery, { user_id });

    // 구독 종료일 계산
    let subscription_end = null;
    if (new_tier_name !== "free") {
      const now = new Date();
      subscription_end = new Date(now);
      if (billing_cycle === "yearly") {
        subscription_end.setFullYear(now.getFullYear() + 1);
      } else {
        subscription_end.setMonth(now.getMonth() + 1);
      }
    }

    // 새로운 구독 생성
    const insertQuery = `
            INSERT INTO user_subscriptions (
                user_id, tier_id, subscription_start, subscription_end,
                is_active, payment_method, auto_renewal
            ) VALUES (
                :user_id, :tier_id, SYSTIMESTAMP, :subscription_end,
                1, :payment_method, :auto_renewal
            )
        `;

    await connection.execute(insertQuery, {
      user_id,
      tier_id: new_tier_id,
      subscription_end,
      payment_method,
      auto_renewal: auto_renewal ? 1 : 0,
    });

    await connection.commit();

    console.log(
      `[subscriptionModel] User ${user_id} subscription updated to ${new_tier_name}`
    );

    // 업데이트된 구독 정보 반환
    return await getUserSubscription(user_id);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error(
      "[subscriptionModel] Error updating user subscription:",
      error
    );
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

/**
 * 구독 취소 (다운그레이드를 무료로)
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object>} 업데이트된 구독 정보
 */
async function cancelUserSubscription(user_id) {
  return await updateUserSubscription(user_id, "free", {
    payment_method: "canceled",
    auto_renewal: false,
  });
}

/**
 * 사용자 구독 이력 조회
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Array>} 구독 이력 목록
 */
async function getUserSubscriptionHistory(user_id) {
  let connection;
  try {
    connection = await getConnection();

    const query = `
            SELECT 
                us.subscription_id,
                us.subscription_start,
                us.subscription_end,
                us.is_active,
                us.payment_method,
                us.auto_renewal,
                us.created_at,
                st.tier_name,
                st.tier_display_name,
                st.tier_emoji,
                st.tier_level
            FROM user_subscriptions us
            JOIN subscription_tiers st ON us.tier_id = st.tier_id
            WHERE us.user_id = :user_id
            ORDER BY us.created_at DESC
        `;

    const result = await connection.execute(query, { user_id });

    const history = result.rows.map((row) => ({
      subscription_id: row[0],
      subscription_start: row[1],
      subscription_end: row[2],
      is_active: row[3] === 1,
      payment_method: row[4],
      auto_renewal: row[5] === 1,
      created_at: row[6],
      tier: {
        tier_name: row[7],
        tier_display_name: row[8],
        tier_emoji: row[9],
        tier_level: row[10],
      },
    }));

    return standardizeApiResponse(history);
  } catch (error) {
    console.error(
      "[subscriptionModel] Error getting subscription history:",
      error
    );
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

/**
 * 사용자 기능 권한 확인
 * @param {string} user_id - 사용자 ID
 * @param {string} feature_name - 확인할 기능명
 * @returns {Promise<boolean>} 권한 여부
 */
async function checkUserFeatureAccess(user_id, feature_name) {
  try {
    const subscription = await getUserSubscription(user_id);

    if (!subscription.data || !subscription.data.tier) {
      return false;
    }

    const features = subscription.data.tier.features_included || [];
    return features.includes(feature_name);
  } catch (error) {
    console.error("[subscriptionModel] Error checking feature access:", error);
    return false;
  }
}

/**
 * 일일 AI 요청 사용량 확인
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object>} 사용량 정보
 */
async function checkDailyUsage(user_id) {
  let connection;
  try {
    connection = await getConnection();

    // 사용자 구독 정보 조회
    const subscription = await getUserSubscription(user_id);
    const maxRequests = subscription.data?.tier?.max_ai_requests_per_day; // 오늘 사용한 요청 수 조회 (사용자 메시지만 카운트)
    const usageQuery = `
            SELECT COUNT(*) as today_requests
            FROM chat_messages 
            WHERE user_id = :user_id 
            AND message_type = 'user'
            AND TRUNC(created_at) = TRUNC(SYSDATE)
        `;

    const result = await connection.execute(usageQuery, { user_id });
    const todayRequests = result.rows[0][0] || 0;

    return standardizeApiResponse({
      user_id,
      today_requests: todayRequests,
      max_requests_per_day: maxRequests,
      has_unlimited: maxRequests === null,
      requests_remaining: maxRequests
        ? Math.max(0, maxRequests - todayRequests)
        : null,
      can_make_request: maxRequests === null || todayRequests < maxRequests,
    });
  } catch (error) {
    console.error("[subscriptionModel] Error checking daily usage:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = {
  getSubscriptionTiers,
  getUserSubscription,
  createDefaultSubscription,
  updateUserSubscription,
  cancelUserSubscription,
  getUserSubscriptionHistory,
  checkUserFeatureAccess,
  checkDailyUsage,
};
