const userModel = require("../models/user");
const { withTransaction } = require("../utils/dbUtils");
const config = require("../config");

// --- 프로필 꾸미기 ---
/**
 * 사용자 프로필 꾸미기 설정 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 프로필 꾸미기 설정
 */
async function getUserCustomizationService(userId) {
  return await withTransaction(async (connection) => {
    // getUserCustomization 모델 함수는 프로필이 없으면 기본값을 생성하고 반환하거나,
    // 기본값을 직접 반환하도록 수정되었음. 따라서 여기서 별도 에러 처리는 불필요.
    return await userModel.getUserCustomization(connection, userId);
  });
}

/**
 * 사용자 프로필 꾸미기 설정 업데이트 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} customizationData - 업데이트할 꾸미기 데이터
 * @returns {Promise<Object>} 업데이트 결과
 */
async function updateUserCustomizationService(userId, customizationData) {
  return await withTransaction(async (connection) => {
    // 입력값 유효성 검사는 컨트롤러 레벨에서 수행되었다고 가정.
    // 서비스는 비즈니스 규칙 검증 (예: 특정 아이템 사용 권한 등)을 할 수 있음.
    return await userModel.updateUserCustomization(connection, userId, customizationData);
  });
}

// --- 레벨 및 경험치 ---
/**
 * 사용자 레벨 및 경험치 정보 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 레벨 및 경험치 정보
 */
async function getUserLevelService(userId) {
  return await withTransaction(async (connection) => {
    return await userModel.getUserLevel(connection, userId);
  });
}

/**
 * 사용자 경험치 추가 서비스
 * @param {string} userId - 사용자 ID
 * @param {number} points - 추가할 경험치 포인트
 * @param {string} [expType="manual"] - 경험치 획득 유형
 * @param {string|null} [reason=null] - 경험치 획득 사유
 * @returns {Promise<Object>} 경험치 추가 및 레벨업 결과
 */
async function addUserExperienceService(userId, points, expType = "manual", reason = null) {
  return await withTransaction(async (connection) => {
    // addUserExperience 모델 함수는 내부적으로 프로필 존재 확인 및 생성 로직을 포함할 수 있음.
    // 또는 여기서 해당 로직을 처리할 수도 있음. 현재 모델은 USER_NOT_FOUND 에러를 throw.
    return await userModel.addUserExperience(connection, userId, points, expType, reason);
  });
}

// --- 뱃지 시스템 ---
/**
 * 사용자 뱃지 목록 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} 뱃지 목록
 */
async function getUserBadgesService(userId) {
  return await withTransaction(async (connection) => {
    return await userModel.getUserBadges(connection, userId);
  });
}

/**
 * 뱃지 착용/해제 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} badgeId - 뱃지 ID
 * @param {boolean} isEquipped - 착용 여부
 * @returns {Promise<Object>} 작업 결과
 */
async function toggleUserBadgeService(userId, badgeId, isEquipped) {
  return await withTransaction(async (connection) => {
    return await userModel.toggleUserBadge(connection, userId, badgeId, isEquipped);
  });
}

/**
 * 뱃지 레벨 업그레이드 서비스 (버그 제보, 피드백 등으로 인한 자동 또는 수동 업그레이드)
 * @param {string} userId - 사용자 ID
 * @param {string} badgeName - 뱃지 이름
 * @param {string} [actionReason=""] - 업그레이드 사유
 * @returns {Promise<Object>} 업그레이드 결과
 */
async function upgradeBadgeLevelService(userId, badgeName, actionReason = "") {
    return await withTransaction(async (connection) => {
        // 이 서비스는 모델의 upgradeBadgeLevel을 직접 호출하거나,
        // approveBadgeUpgrade와 같은 더 구체적인 모델 함수를 호출할 수 있음.
        // 현재 모델에는 upgradeBadgeLevel이 직접 DB 연결을 관리하므로, 해당 모델 함수 수정 필요.
        // 여기서는 모델 함수가 connection을 받는다고 가정하고 호출.
        return await userModel.upgradeBadgeLevel(connection, userId, badgeName, actionReason);
    });
}

/**
 * 구독 기간 뱃지 업그레이드 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} tierName - 구독 등급명
 * @param {number} monthsCount - 구독 개월 수
 * @returns {Promise<Object>} 업그레이드 결과
 */
async function upgradeSubscriptionBadgeService(userId, tierName, monthsCount) {
    return await withTransaction(async (connection) => {
        // 모델의 upgradeSubscriptionBadge 함수가 connection을 받도록 수정되었다고 가정.
        return await userModel.upgradeSubscriptionBadge(connection, userId, tierName, monthsCount);
    });
}

/**
 * 개발자 뱃지 승인 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} badgeName - 승인할 뱃지 이름
 * @param {string} [reason="개발자 승인"] - 승인 사유
 * @returns {Promise<Object>} 승인 결과
 */
async function approveBadgeUpgradeService(userId, badgeName, reason = "개발자 승인") {
    return await withTransaction(async (connection) => {
        // 모델의 approveBadgeUpgrade 함수가 connection을 받도록 수정되었다고 가정.
        return await userModel.approveBadgeUpgrade(connection, userId, badgeName, reason);
    });
}

// --- 사용자 활동 처리 (버그 리포트, 피드백 등) ---
// 기존 컨트롤러의 handleUserActivityController 로직을 서비스로 가져옴.
// 모델의 handleBugReport, handleFeedbackSubmission, handleTestParticipation 함수들은
// 내부적으로 handleUserActivity 모델 함수를 호출하거나, 각자 로직을 가질 수 있음.
// 여기서는 해당 모델 함수들이 connection을 받는다고 가정.

/**
 * 버그 리포트 처리 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} bugDescription - 버그 설명
 * @param {string} [severity="medium"] - 심각도
 * @returns {Promise<Object>} 처리 결과
 */
async function handleBugReportService(userId, bugDescription, severity = 'medium') {
    return await withTransaction(async (connection) => {
        // userModel.handleBugReport는 connection을 받도록 수정되었다고 가정
        return await userModel.handleBugReport(connection, userId, bugDescription, severity);
    });
}

/**
 * 피드백 제출 처리 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} feedbackContent - 피드백 내용
 * @param {string} [feedbackType="general"] - 피드백 유형
 * @returns {Promise<Object>} 처리 결과
 */
async function handleFeedbackSubmissionService(userId, feedbackContent, feedbackType = 'general') {
    return await withTransaction(async (connection) => {
        return await userModel.handleFeedbackSubmission(connection, userId, feedbackContent, feedbackType);
    });
}

/**
 * 테스트 참여 처리 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} testType - 테스트 유형 (e.g., "alpha", "beta")
 * @param {string} [testDetails=""] - 테스트 상세 내용
 * @returns {Promise<Object>} 처리 결과
 */
async function handleTestParticipationService(userId, testType, testDetails = '') {
    return await withTransaction(async (connection) => {
        return await userModel.handleTestParticipation(connection, userId, testType, testDetails);
    });
}


module.exports = {
  getUserCustomizationService,
  updateUserCustomizationService,
  getUserLevelService,
  addUserExperienceService,
  getUserBadgesService,
  toggleUserBadgeService,
  upgradeBadgeLevelService,
  upgradeSubscriptionBadgeService,
  approveBadgeUpgradeService,
  handleBugReportService,
  handleFeedbackSubmissionService,
  handleTestParticipationService,
};

/**
 * 사용자 뱃지 상세 정보 조회 (특정 뱃지 또는 전체) 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} [badgeName] - (선택) 특정 뱃지 이름
 * @returns {Promise<Object>} 뱃지 정보
 */
async function getUserBadgeDetailsService(userId, badgeName) {
    return await withTransaction(async (connection) => {
        const allBadges = await userModel.getUserBadges(connection, userId);
        if (badgeName) {
            const specificBadge = allBadges.find(b => b.badge_name === badgeName);
            if (!specificBadge) {
                const error = new Error("해당 뱃지를 찾을 수 없습니다.");
                error.code = "RESOURCE_NOT_FOUND";
                throw error;
            }
            return { badge: specificBadge };
        }

        // 뱃지 타입별로 분류 (모델에서 이미 toSnakeCaseObj 처리됨)
        const badgesByType = {
            special: allBadges.filter((b) => b.badge_type === "special"),
            achievement: allBadges.filter((b) => b.badge_type === "achievement"),
            premium: allBadges.filter((b) => b.badge_type === "premium"),
            activity: allBadges.filter((b) => b.badge_type === "activity"),
        };
        return {
            total_badges: allBadges.length,
            badges_by_type: badgesByType,
            all_badges: allBadges
        };
    });
}

module.exports = {
  // ... (기존 exports)
  getUserCustomizationService,
  updateUserCustomizationService,
  getUserLevelService,
  addUserExperienceService,
  getUserBadgesService,
  toggleUserBadgeService,
  upgradeBadgeLevelService,
  upgradeSubscriptionBadgeService,
  approveBadgeUpgradeService,
  getUserBadgeDetailsService, // 추가
  handleBugReportService,
  handleFeedbackSubmissionService,
  handleTestParticipationService,
};
