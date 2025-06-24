const userActivityService = require("../services/userActivityService");
const { standardizeApiResponse } = require("../utils/apiResponse");

// --- 프로필 꾸미기 ---
async function getUserCustomizationController(req, res, next) {
    const { user_id } = req.params;
    if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const customization = await userActivityService.getUserCustomizationService(user_id);
        const apiResponse = standardizeApiResponse(customization);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function updateUserCustomizationController(req, res, next) {
    const { user_id } = req.params;
    const customizationData = req.body;
    if (!user_id || !customizationData) { const err = new Error("User ID and customization data are required."); err.code = "INVALID_INPUT"; return next(err); }
    // Add detailed validation for customizationData fields if necessary
    try {
        const result = await userActivityService.updateUserCustomizationService(user_id, customizationData);
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

// --- 레벨 및 경험치 ---
async function getUserLevelController(req, res, next) {
    const { user_id } = req.params;
    if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const levelInfo = await userActivityService.getUserLevelService(user_id);
        const apiResponse = standardizeApiResponse(levelInfo);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function addUserExperienceController(req, res, next) {
    const { user_id } = req.params;
    const { points, exp_type = "manual", reason } = req.body;
    if (!user_id || typeof points !== "number" || points <= 0) {
        const err = new Error("User ID and valid points (positive number) are required.");
        err.code = "INVALID_INPUT";
        return next(err);
    }
    if (exp_type && typeof exp_type !== 'string' || exp_type.length > 50) {
        const err = new Error("Experience type must be a string up to 50 characters.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    if (reason && (typeof reason !== 'string' || reason.length > 255)) {
        const err = new Error("Reason must be a string up to 255 characters.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const result = await userActivityService.addUserExperienceService(user_id, points, exp_type, reason);
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

// --- 뱃지 시스템 ---
async function getUserBadgesController(req, res, next) {
    const { user_id } = req.params;
    if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const badges = await userActivityService.getUserBadgesService(user_id);
        const apiResponse = standardizeApiResponse(badges);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function toggleUserBadgeController(req, res, next) {
    const { user_id, badge_id } = req.params;
    const { is_equipped } = req.body;
    if (!user_id || !badge_id || is_equipped === undefined || typeof is_equipped !== 'boolean') {
        const err = new Error("User ID, Badge ID, and is_equipped (boolean) are required.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const result = await userActivityService.toggleUserBadgeService(user_id, badge_id, is_equipped);
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function upgradeBadgeLevelController(req, res, next) {
    const { user_id } = req.params; // 또는 req.body에서 user_id를 받을 수도 있음
    const { badge_name, action_reason } = req.body;
    if (!user_id || !badge_name) {
        const err = new Error("User ID and badge name are required.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    if (action_reason && (typeof action_reason !== 'string' || action_reason.length > 255)) {
        const err = new Error("Action reason must be a string up to 255 characters.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const result = await userActivityService.upgradeBadgeLevelService(user_id, badge_name, action_reason);
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function upgradeSubscriptionBadgeController(req, res, next) {
    const { user_id } = req.params;
    const { tier_name, months_count } = req.body;
    if (!user_id || !tier_name || typeof months_count !== 'number' || months_count <=0) {
        const err = new Error("User ID, tier name, and a positive months count are required.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const result = await userActivityService.upgradeSubscriptionBadgeService(user_id, tier_name, months_count);
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function approveBadgeUpgradeController(req, res, next) {
    const { user_id } = req.params;
    const { badge_name, reason } = req.body;
    if (!user_id || !badge_name) {
        const err = new Error("User ID and badge name are required.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    // const approvableBadges = config.badges.approvableBadges || ["버그 헌터", "피드백 전문가"];
    // if (!approvableBadges.includes(badge_name)) {
    //     const err = new Error("승인할 수 없는 뱃지입니다."); err.code = "INVALID_INPUT"; return next(err);
    // }
    try {
        const result = await userActivityService.approveBadgeUpgradeService(user_id, badge_name, reason);
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function getUserBadgeDetailsController(req, res, next) {
    const { user_id } = req.params;
    const { badge_name } = req.query; // 쿼리 파라미터로 뱃지 이름 받기
     if (!user_id) {
        const err = new Error("User ID is required.");
        err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const resultData = await userActivityService.getUserBadgeDetailsService(user_id, badge_name); // 서비스 함수 호출
        const apiResponse = standardizeApiResponse(resultData);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) {
        next(error);
    }
}


// --- 사용자 활동 처리 (버그 리포트, 피드백 등) ---
async function handleBugReportController(req, res, next) {
  const { user_id } = req.params;
  const { bug_description, severity = 'medium' } = req.body;
  if (!user_id || !bug_description || bug_description.trim().length < 10) {
    const err = new Error("User ID and bug description (min 10 chars) are required.");
    err.code = "INVALID_INPUT"; return next(err);
  }
  try {
    const result = await userActivityService.handleBugReportService(user_id, bug_description, severity);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch(error){
    next(error);
  }
}

async function handleFeedbackSubmissionController(req, res, next) {
  const { user_id } = req.params;
  const { feedback_content, feedback_type = 'general' } = req.body;
   if (!user_id || !feedback_content || feedback_content.trim().length < 5) {
    const err = new Error("User ID and feedback content (min 5 chars) are required.");
    err.code = "INVALID_INPUT"; return next(err);
  }
  try {
    const result = await userActivityService.handleFeedbackSubmissionService(user_id, feedback_content, feedback_type);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch(error){
    next(error);
  }
}

async function handleTestParticipationController(req, res, next) {
   const { user_id } = req.params;
   const { test_type, test_details = '' } = req.body;
   if (!user_id || !test_type || !["alpha", "beta"].includes(test_type)) { // 예시: alpha, beta만 허용
    const err = new Error("User ID and valid test type ('alpha' or 'beta') are required.");
    err.code = "INVALID_INPUT"; return next(err);
  }
  try {
    const result = await userActivityService.handleTestParticipationService(user_id, test_type, test_details);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch(error){
    next(error);
  }
}


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
