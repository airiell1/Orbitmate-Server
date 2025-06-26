const {
  createController,
  createReadController,
  createUpdateController
} = require("../utils/serviceFactory");
const userActivityService = require("../services/userActivityService");
const { standardizeApiResponse } = require("../utils/apiResponse");

// =========================
// 🎨 사용자 활동 관리 (User Activity Management)
// =========================

// --- 프로필 꾸미기 ---

/**
 * 사용자 커스터마이징 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserCustomizationController = createReadController(
  userActivityService.getUserCustomizationService,
  {
    dataExtractor: (req) => [req.params.user_id],
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
    errorContext: 'customization_read'
  }
);

/**
 * 사용자 커스터마이징 업데이트 컨트롤러 - ServiceFactory 패턴 적용
 */
const updateUserCustomizationController = createUpdateController(
  userActivityService.updateUserCustomizationService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const customizationData = req.body;
      return [user_id, customizationData];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const customizationData = req.body;
        
        if (!user_id || !customizationData) {
          const err = new Error("User ID and customization data are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'customization_update'
  }
);

// --- 레벨 및 경험치 ---

/**
 * 사용자 레벨 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserLevelController = createReadController(
  userActivityService.getUserLevelService,
  {
    dataExtractor: (req) => [req.params.user_id],
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
    errorContext: 'level_read'
  }
);

/**
 * 사용자 경험치 추가 컨트롤러 - ServiceFactory 패턴 적용
 */
const addUserExperienceController = createController(
  userActivityService.addUserExperienceService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { points, exp_type = "manual", reason } = req.body;
      return [user_id, points, exp_type, reason];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { points, exp_type, reason } = req.body;
        
        if (!user_id || typeof points !== "number" || points <= 0) {
          const err = new Error("User ID and valid points (positive number) are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        if (exp_type && (typeof exp_type !== 'string' || exp_type.length > 50)) {
          const err = new Error("Experience type must be a string up to 50 characters.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        if (reason && (typeof reason !== 'string' || reason.length > 255)) {
          const err = new Error("Reason must be a string up to 255 characters.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'experience_add'
  }
);

// --- 뱃지 시스템 ---

/**
 * 사용자 뱃지 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserBadgesController = createReadController(
  userActivityService.getUserBadgesService,
  {
    dataExtractor: (req) => [req.params.user_id],
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
    errorContext: 'badges_read'
  }
);

/**
 * 사용자 뱃지 토글 컨트롤러 - ServiceFactory 패턴 적용
 */
const toggleUserBadgeController = createController(
  userActivityService.toggleUserBadgeService,
  {
    dataExtractor: (req) => {
      const { user_id, badge_id } = req.params;
      const { is_equipped } = req.body;
      return [user_id, badge_id, is_equipped];
    },
    validations: [
      (req) => {
        const { user_id, badge_id } = req.params;
        const { is_equipped } = req.body;
        
        if (!user_id || !badge_id || is_equipped === undefined || typeof is_equipped !== 'boolean') {
          const err = new Error("User ID, Badge ID, and is_equipped (boolean) are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'badge_toggle'
  }
);

/**
 * 뱃지 레벨 업그레이드 컨트롤러 - ServiceFactory 패턴 적용
 */
const upgradeBadgeLevelController = createController(
  userActivityService.upgradeBadgeLevelService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { badge_name, action_reason } = req.body;
      return [user_id, badge_name, action_reason];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { badge_name, action_reason } = req.body;
        
        if (!user_id || !badge_name) {
          const err = new Error("User ID and badge name are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        if (action_reason && (typeof action_reason !== 'string' || action_reason.length > 255)) {
          const err = new Error("Action reason must be a string up to 255 characters.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'badge_upgrade'
  }
);

/**
 * 구독 뱃지 업그레이드 컨트롤러 - ServiceFactory 패턴 적용
 */
const upgradeSubscriptionBadgeController = createController(
  userActivityService.upgradeSubscriptionBadgeService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { tier_name, months_count } = req.body;
      return [user_id, tier_name, months_count];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { tier_name, months_count } = req.body;
        
        if (!user_id || !tier_name || typeof months_count !== 'number' || months_count <= 0) {
          const err = new Error("User ID, tier name, and a positive months count are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'subscription_badge_upgrade'
  }
);

/**
 * 뱃지 업그레이드 승인 컨트롤러 - ServiceFactory 패턴 적용
 */
const approveBadgeUpgradeController = createController(
  userActivityService.approveBadgeUpgradeService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { badge_name, reason } = req.body;
      return [user_id, badge_name, reason];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { badge_name } = req.body;
        
        if (!user_id || !badge_name) {
          const err = new Error("User ID and badge name are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'badge_approve'
  }
);

/**
 * 사용자 뱃지 상세 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserBadgeDetailsController = createController(
  userActivityService.getUserBadgeDetailsService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { badge_name } = req.query;
      return [user_id, badge_name];
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
    errorContext: 'badge_details'
  }
);

// --- 사용자 활동 처리 (버그 리포트, 피드백 등) ---

/**
 * 버그 리포트 처리 컨트롤러 - ServiceFactory 패턴 적용
 */
const handleBugReportController = createController(
  userActivityService.handleBugReportService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { bug_description, severity = 'medium' } = req.body;
      return [user_id, bug_description, severity];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { bug_description } = req.body;
        
        if (!user_id || !bug_description || bug_description.trim().length < 10) {
          const err = new Error("User ID and bug description (min 10 chars) are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'bug_report'
  }
);

/**
 * 피드백 제출 처리 컨트롤러 - ServiceFactory 패턴 적용
 */
const handleFeedbackSubmissionController = createController(
  userActivityService.handleFeedbackSubmissionService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { feedback_content, feedback_type = 'general' } = req.body;
      return [user_id, feedback_content, feedback_type];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { feedback_content } = req.body;
        
        if (!user_id || !feedback_content || feedback_content.trim().length < 5) {
          const err = new Error("User ID and feedback content (min 5 chars) are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'feedback_submission'
  }
);

/**
 * 테스트 참여 처리 컨트롤러 - ServiceFactory 패턴 적용
 */
const handleTestParticipationController = createController(
  userActivityService.handleTestParticipationService,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { test_type, test_details = '' } = req.body;
      return [user_id, test_type, test_details];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { test_type } = req.body;
        
        if (!user_id || !test_type || !["alpha", "beta"].includes(test_type)) {
          const err = new Error("User ID and valid test type ('alpha' or 'beta') are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201,
    errorContext: 'test_participation'
  }
);

module.exports = {
  getUserCustomizationController,
  updateUserCustomizationController,
  getUserLevelController,
  addUserExperienceController,
  getUserBadgesController,
  toggleUserBadgeController,
  upgradeBadgeLevelController,
  upgradeSubscriptionBadgeController,
  approveBadgeUpgradeController,
  getUserBadgeDetailsController,
  handleBugReportController,
  handleFeedbackSubmissionController,
  handleTestParticipationController,
};
