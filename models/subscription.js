// models/subscription.js
// const { getConnection } = require("../config/database"); // Removed
const { oracledb } = require("../config/database");
// const { standardizeApiResponse } = require("../utils/apiResponse"); // Removed, controller will handle
const { handleOracleError } = require("../utils/errorHandler");
const { toSnakeCaseObj, clobToString } = require("../utils/dbUtils");


/**
 * 구독 등급 목록 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @returns {Promise<Array>} 구독 등급 목록
 */
async function getSubscriptionTiers(connection) {
  try {
    const query = `
            SELECT 
                tier_id, tier_name, tier_display_name, tier_emoji,
                tier_description, monthly_price, yearly_price, tier_level,
                max_ai_requests_per_day, max_file_upload_size,
                features_included, is_enterprise, is_active
            FROM subscription_tiers
            WHERE is_active = 1
            ORDER BY tier_level ASC
        `;

    const result = await connection.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return result.rows.map((row) => {
      let featuresIncluded = [];
      if (row.FEATURES_INCLUDED) {
        try {
          if (typeof row.FEATURES_INCLUDED === "object") { // CLOB might be pre-fetched as object by some driver versions/settings
            featuresIncluded = Array.isArray(row.FEATURES_INCLUDED) ? row.FEATURES_INCLUDED : JSON.parse(row.FEATURES_INCLUDED.toString());
          } else if (typeof row.FEATURES_INCLUDED === "string") {
            featuresIncluded = JSON.parse(row.FEATURES_INCLUDED);
          }
        } catch (parseError) {
          // console.warn(`[SubscriptionModel] Failed to parse features_included for tier ${row.TIER_NAME}:`, row.FEATURES_INCLUDED, parseError);
          // Instead of console.warn, consider logging via a logger utility if available
          // For now, keep it simple and default to empty array.
          featuresIncluded = [];
        }
      }
      
      // CLOB 필드 변환 - tier_description 처리 (getSubscriptionTiers)
      let tierDescription = '';
      if (row.TIER_DESCRIPTION) {
        if (typeof row.TIER_DESCRIPTION === 'string') {
          tierDescription = row.TIER_DESCRIPTION;
        } else if (Buffer.isBuffer(row.TIER_DESCRIPTION)) {
          tierDescription = row.TIER_DESCRIPTION.toString('utf8');
        } else if (row.TIER_DESCRIPTION && typeof row.TIER_DESCRIPTION.toString === 'function') {
          try {
            const result = row.TIER_DESCRIPTION.toString();
            tierDescription = result === '[object Object]' ? '' : result;
          } catch (e) {
            tierDescription = '';
          }
        } else {
          tierDescription = '';
        }
      }
      
      // Return snake_case directly from model, or let controller handle it.
      // For consistency, models should return data as close to DB as possible, or a defined DTO.
      // Here, returning a mapped object is fine. Controller will ensure final snake_case.
      return {
        tier_id: row.TIER_ID,
        tier_name: row.TIER_NAME,
        tier_display_name: row.TIER_DISPLAY_NAME,
        tier_emoji: row.TIER_EMOJI,
        tier_description: tierDescription,
        monthly_price: row.MONTHLY_PRICE,
        yearly_price: row.YEARLY_PRICE,
        tier_level: row.TIER_LEVEL,
        max_ai_requests_per_day: row.MAX_AI_REQUESTS_PER_DAY,
        max_file_upload_size: row.MAX_FILE_UPLOAD_SIZE,
        features_included: featuresIncluded,
        is_enterprise: row.IS_ENTERPRISE === 1,
        is_active: row.IS_ACTIVE === 1,
      };
    });
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 사용자 구독 정보 조회. 구독이 없으면 기본 무료 구독을 생성 시도.
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object|null>} 사용자 구독 정보 또는 null (무료 구독 생성 실패 시)
 */
async function getUserSubscription(connection, user_id) {
  try {
    const query = `
            SELECT 
                us.subscription_id, us.user_id, us.tier_id,
                us.subscription_start, us.subscription_end, us.is_active,
                us.payment_method, us.auto_renewal,
                us.created_at, us.updated_at,
                st.tier_name, st.tier_display_name, st.tier_emoji,
                st.tier_description, st.monthly_price, st.yearly_price, st.tier_level,
                st.max_ai_requests_per_day, st.max_file_upload_size,
                st.features_included, st.is_enterprise
            FROM user_subscriptions us
            JOIN subscription_tiers st ON us.tier_id = st.tier_id
            WHERE us.user_id = :user_id 
            AND us.is_active = 1
            AND ROWNUM = 1
            ORDER BY us.created_at DESC
        `;
    const result = await connection.execute(query, { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (result.rows.length === 0) {
      // 구독이 없으면 무료 등급으로 자동 설정 (새로운 connection으로 시도하지 않음, 같은 트랜잭션 내에서)
      return await createDefaultSubscription(connection, user_id);
    }

    const row = result.rows[0];
    let featuresIncluded = [];
    if (row.FEATURES_INCLUDED) {
        try {
          if (typeof row.FEATURES_INCLUDED === "object") {
            featuresIncluded = Array.isArray(row.FEATURES_INCLUDED) ? row.FEATURES_INCLUDED : JSON.parse(row.FEATURES_INCLUDED.toString());
          } else if (typeof row.FEATURES_INCLUDED === "string") {
            featuresIncluded = JSON.parse(row.FEATURES_INCLUDED);
          }
        } catch (parseError) {
          // console.warn(`[SubscriptionModel] Failed to parse features_included for user ${user_id}:`, row.FEATURES_INCLUDED, parseError);
          featuresIncluded = [];
        }
    }

    // CLOB 필드 변환 - tier_description 처리 (getUserSubscription)
    let tierDescription = '';
    if (row.TIER_DESCRIPTION) {
      if (typeof row.TIER_DESCRIPTION === 'string') {
        tierDescription = row.TIER_DESCRIPTION;
      } else if (Buffer.isBuffer(row.TIER_DESCRIPTION)) {
        tierDescription = row.TIER_DESCRIPTION.toString('utf8');
      } else if (row.TIER_DESCRIPTION && typeof row.TIER_DESCRIPTION.toString === 'function') {
        try {
          const result = row.TIER_DESCRIPTION.toString();
          tierDescription = result === '[object Object]' ? '' : result;
        } catch (e) {
          tierDescription = '';
        }
      } else {
        tierDescription = '';
      }
    }

    return {
      subscription_id: row.SUBSCRIPTION_ID,
      user_id: row.USER_ID,
      tier_id: row.TIER_ID,
      subscription_start: row.SUBSCRIPTION_START ? row.SUBSCRIPTION_START.toISOString() : null,
      subscription_end: row.SUBSCRIPTION_END ? row.SUBSCRIPTION_END.toISOString() : null,
      is_active: row.IS_ACTIVE === 1,
      payment_method: row.PAYMENT_METHOD,
      auto_renewal: row.AUTO_RENEWAL === 1,
      created_at: row.CREATED_AT ? row.CREATED_AT.toISOString() : null,
      updated_at: row.UPDATED_AT ? row.UPDATED_AT.toISOString() : null,
      tier: {
        tier_id: row.TIER_ID, // tier 객체에도 tier_id 포함
        tier_name: row.TIER_NAME,
        tier_display_name: row.TIER_DISPLAY_NAME,
        tier_emoji: row.TIER_EMOJI,
        tier_description: tierDescription,
        monthly_price: row.MONTHLY_PRICE,
        yearly_price: row.YEARLY_PRICE,
        tier_level: row.TIER_LEVEL,
        max_ai_requests_per_day: row.MAX_AI_REQUESTS_PER_DAY,
        max_file_upload_size: row.MAX_FILE_UPLOAD_SIZE,
        features_included: featuresIncluded,
        is_enterprise: row.IS_ENTERPRISE === 1,
      },
    };
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 기본 무료 구독 생성
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object|null>} 생성된 구독 정보, 실패 시 null 또는 에러 throw
 */
async function createDefaultSubscription(connection, user_id) {
  try {
    const tierResult = await connection.execute(
        `SELECT tier_id FROM subscription_tiers WHERE tier_name = 'free' AND is_active = 1`,
        {}, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (tierResult.rows.length === 0) {
      const err = new Error("Free tier not found or not active.");
      err.code = "RESOURCE_NOT_FOUND";
      throw err;
    }
    const freeTierId = tierResult.rows[0].TIER_ID;

    await connection.execute(
        `INSERT INTO user_subscriptions (user_id, tier_id, subscription_start, subscription_end, is_active, payment_method, auto_renewal)
         VALUES (:user_id, :tier_id, SYSTIMESTAMP, NULL, 1, 'free', 0)`,
        { user_id, tier_id: freeTierId },
        { autoCommit: false } // Part of a transaction
    );
    // commit은 withTransaction에서 처리

    // 생성된 구독 정보 다시 조회하여 반환
    // 주의: 이 함수가 다른 함수의 일부로 호출될 때, 여기서 다시 getUserSubscription을 호출하면
    //       동일 connection을 사용해야 하며, 순환 호출이 발생하지 않도록 주의해야 함.
    //       여기서는 createDefaultSubscription이 getUserSubscription 내부에서만 호출되므로,
    //       getUserSubscription을 다시 호출하는 대신, 생성된 기본 정보를 직접 구성하여 반환하거나,
    //       getUserSubscription이 이 함수를 호출하지 않도록 로직 분리.
    //       일단은 직접 구성하여 반환.
     const freeTierDetails = (await getSubscriptionTiers(connection)).find(t => t.tier_id === freeTierId);
     if (!freeTierDetails) { // 이론상 발생하면 안됨
        const err = new Error("Failed to retrieve details for the created free tier.");
        err.code = "INTERNAL_ERROR"; // 또는 다른 적절한 코드
        throw err;
     }

    return {
        user_id: user_id,
        tier_id: freeTierId,
        subscription_start: new Date().toISOString(),
        subscription_end: null,
        is_active: true,
        payment_method: 'free',
        auto_renewal: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tier: freeTierDetails
    };

  } catch (error) {
    if (error.code === "RESOURCE_NOT_FOUND" || error.code === "INTERNAL_ERROR") throw error;
    throw handleOracleError(error);
  }
}


function mapKoreanTierNameToEnglish(koreanTierName) {
  const tierMapping = { 코멧: "free", 플래닛: "planet", 스타: "star", 갤럭시: "galaxy" };
  return tierMapping[koreanTierName] || koreanTierName.toLowerCase();
}

/**
 * 구독 업그레이드/다운그레이드
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @param {string} new_tier_name - 새로운 구독 등급 (한국어 또는 영어)
 * @param {Object} options - 구독 옵션 (payment_method, billing_cycle, auto_renewal)
 * @returns {Promise<Object>} 업데이트된 구독 정보
 */
async function updateUserSubscription(connection, user_id, new_tier_name, options = {}) {
  try {
    const {
      payment_method = "card",
      billing_cycle = "monthly", // 'monthly' or 'yearly'
      auto_renewal = true,
    } = options;

    const englishTierName = mapKoreanTierNameToEnglish(new_tier_name);

    const tierResult = await connection.execute(
        `SELECT tier_id FROM subscription_tiers WHERE tier_name = :tier_name AND is_active = 1`,
        { tier_name: englishTierName }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (tierResult.rows.length === 0) {
      const err = new Error(`Subscription tier '${new_tier_name}' (mapped to '${englishTierName}') not found or not active.`);
      err.code = "RESOURCE_NOT_FOUND";
      throw err;
    }
    const newTierId = tierResult.rows[0].TIER_ID;

    // 기존 활성 구독 비활성화
    await connection.execute(
        `UPDATE user_subscriptions SET is_active = 0, updated_at = SYSTIMESTAMP
         WHERE user_id = :user_id AND is_active = 1`,
        { user_id }, { autoCommit: false }
    );

    let subscription_end = null;
    if (englishTierName !== "free") {
      const now = new Date();
      subscription_end = new Date(now);
      if (billing_cycle === "yearly") {
        subscription_end.setFullYear(now.getFullYear() + 1);
      } else {
        subscription_end.setMonth(now.getMonth() + 1); // 기본 월간
      }
    }

    // 새 구독 생성
    await connection.execute(
        `INSERT INTO user_subscriptions
            (user_id, tier_id, subscription_start, subscription_end, is_active, payment_method, auto_renewal)
         VALUES
            (:user_id, :tier_id, SYSTIMESTAMP, :subscription_end, 1, :payment_method, :auto_renewal)`,
        { user_id, tier_id: newTierId, subscription_end, payment_method, auto_renewal: auto_renewal ? 1 : 0 },
        { autoCommit: false }
    );
    // commit은 withTransaction에서 처리

    // 업데이트된 구독 정보 반환 (새로운 connection 대신 현재 connection 사용)
    return await getUserSubscription(connection, user_id);
  } catch (error) {
    if (error.code === "RESOURCE_NOT_FOUND") throw error;
    throw handleOracleError(error);
  }
}

/**
 * 구독 취소 (무료 등급으로 다운그레이드)
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object>} 업데이트된 구독 정보 (무료 등급)
 */
async function cancelUserSubscription(connection, user_id) {
  // updateUserSubscription 내부에서 getUserSubscription을 호출하므로, connection을 전달해야 함.
  return await updateUserSubscription(connection, user_id, "free", {
    payment_method: "canceled",
    auto_renewal: false,
  });
}

/**
 * 사용자 구독 이력 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Array>} 구독 이력 목록
 */
async function getUserSubscriptionHistory(connection, user_id) {
  try {
    const query = `
            SELECT 
                us.subscription_id, us.subscription_start, us.subscription_end,
                us.is_active, us.payment_method, us.auto_renewal, us.created_at,
                st.tier_name, st.tier_display_name, st.tier_emoji, st.tier_level, st.tier_description
            FROM user_subscriptions us
            JOIN subscription_tiers st ON us.tier_id = st.tier_id
            WHERE us.user_id = :user_id
            ORDER BY us.created_at DESC
        `;
    const result = await connection.execute(query, { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return result.rows.map((row) => {
      // CLOB 필드 변환 - tier_description 처리 (getUserSubscriptionHistory)
      let tierDescription = '';
      if (row.TIER_DESCRIPTION) {
        if (typeof row.TIER_DESCRIPTION === 'string') {
          tierDescription = row.TIER_DESCRIPTION;
        } else if (Buffer.isBuffer(row.TIER_DESCRIPTION)) {
          tierDescription = row.TIER_DESCRIPTION.toString('utf8');
        } else if (row.TIER_DESCRIPTION && typeof row.TIER_DESCRIPTION.toString === 'function') {
          try {
            const result = row.TIER_DESCRIPTION.toString();
            tierDescription = result === '[object Object]' ? '' : result;
          } catch (e) {
            tierDescription = '';
          }
        } else {
          tierDescription = '';
        }
      }
      
      return { // 직접 snake_case로 변환 또는 DTO 사용
        subscription_id: row.SUBSCRIPTION_ID,
        subscription_start: row.SUBSCRIPTION_START ? row.SUBSCRIPTION_START.toISOString() : null,
        subscription_end: row.SUBSCRIPTION_END ? row.SUBSCRIPTION_END.toISOString() : null,
        is_active: row.IS_ACTIVE === 1,
        payment_method: row.PAYMENT_METHOD,
        auto_renewal: row.AUTO_RENEWAL === 1,
        created_at: row.CREATED_AT ? row.CREATED_AT.toISOString() : null,
        tier: {
          tier_name: row.TIER_NAME,
          tier_display_name: row.TIER_DISPLAY_NAME,
          tier_emoji: row.TIER_EMOJI,
          tier_level: row.TIER_LEVEL,
          tier_description: tierDescription,
        },
      };
    });
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 사용자 기능 권한 확인.
 * 이 함수는 내부적으로 getUserSubscription을 호출하므로, connection 객체를 받아야 합니다.
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @param {string} feature_name - 확인할 기능명
 * @returns {Promise<boolean>} 권한 여부
 */
async function checkUserFeatureAccess(connection, user_id, feature_name) {
  try {
    const subscription = await getUserSubscription(connection, user_id); // connection 전달

    if (!subscription || !subscription.tier) { // standardizeApiResponse 제거로 인해 .data 접근 제거
      return false;
    }
    const features = subscription.tier.features_included || [];
    return features.includes(feature_name);
  } catch (error) {
    // console.error("[SubscriptionModel] Error checking feature access:", error); // 중앙 로깅
    // 여기서 에러를 다시 throw하거나, false를 반환할지 결정.
    // 기능 접근 확인 실패는 false로 처리하는 것이 사용자 경험에 나을 수 있음.
    return false;
  }
}

/**
 * 일일 AI 요청 사용량 확인.
 * 이 함수는 내부적으로 getUserSubscription을 호출하므로, connection 객체를 받아야 합니다.
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} user_id - 사용자 ID
 * @returns {Promise<Object>} 사용량 정보
 */
async function checkDailyUsage(connection, user_id) {
  try {
    const subscription = await getUserSubscription(connection, user_id); // connection 전달
    const maxRequests = subscription?.tier?.max_ai_requests_per_day;

    const usageQuery = `
            SELECT COUNT(*) as today_requests
            FROM chat_messages 
            WHERE user_id = :user_id 
            AND message_type = 'user'
            AND TRUNC(created_at) = TRUNC(SYSDATE)
        `;
    const result = await connection.execute(usageQuery, { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const todayRequests = result.rows[0]?.TODAY_REQUESTS || 0;

    return { // standardizeApiResponse 호출 제거
      user_id,
      today_requests: todayRequests,
      max_requests_per_day: maxRequests,
      has_unlimited: maxRequests === null || maxRequests === undefined, // maxRequests가 null 또는 undefined일 수 있음
      requests_remaining: (maxRequests !== null && maxRequests !== undefined)
        ? Math.max(0, maxRequests - todayRequests)
        : null, // 무제한이면 null
      can_make_request: (maxRequests === null || maxRequests === undefined) || todayRequests < maxRequests,
    };
  } catch (error) {
    // console.error("[SubscriptionModel] Error checking daily usage:", error); // 중앙 로깅
    throw handleOracleError(error); // 또는 기본값/에러 상태 반환
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
