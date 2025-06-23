const bcrypt = require("bcrypt");
// const { getConnection, oracledb } = require("../config/database"); // Removed
const { oracledb } = require("../config/database"); // For oracledb.CLOB type if needed by model
const { generateToken } = require("../middleware/auth"); // Assuming this is correctly set up
const userModel = require("../models/user");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { withTransaction } = require("../utils/dbUtils");
const fs = require("fs");
const path = require("path"); // For upload path construction if needed, though typically handled by multer/storage config
const config = require("../config"); // For NODE_ENV checks, etc.

// 사용자 등록 컨트롤러
async function registerUserController(req, res, next) {
  const { username, email, password } = req.body;
  // Basic validation (more comprehensive validation can be done with a library like express-validator)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/; // 길이 제한 포함
  const passwordRegex = /^.{8,128}$/; // 길이 제한 포함

  if (!username || !usernameRegex.test(username)) {
    const err = new Error("사용자명은 3~30자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!email || email.length > 254 || !emailRegex.test(email)) {
    const err = new Error("유효한 이메일 주소를 입력해주세요 (최대 254자).");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!password || !passwordRegex.test(password)) {
    const err = new Error("비밀번호는 8자 이상 128자 이하이어야 합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    const user = await withTransaction(async (connection) => {
      return await userModel.registerUser(connection, username, email, password);
    });

    if (user && user.already_registered) {
      const apiResponse = standardizeApiResponse({
        message: "이미 가입된 이메일입니다.",
        user_id: user.user_id, // Ensure these are snake_case if that's the standard
        username: user.username,
        email: user.email,
        already_registered: true,
      });
      return res.status(200).json(apiResponse.body); // Not 201
    }

    const apiResponse = standardizeApiResponse(user);
    res.status(201).json(apiResponse.body); // 201 Created for new resource
  } catch (err) {
    next(err); // Central error handler will take care of it
  }
}

// 사용자 로그인 컨트롤러
async function loginUserController(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    const err = new Error("이메일과 비밀번호를 모두 입력해주세요.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    const user = await withTransaction(async (connection) => { // 로그인도 DB 업데이트(last_login)가 있으므로 트랜잭션 사용
      return await userModel.loginUser(connection, email, password);
    });

    const tokenPayload = { user_id: user.user_id, email: user.email };
    const token = generateToken(tokenPayload); // JWT 생성

    const apiResponse = standardizeApiResponse({ ...user, token });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 사용자 설정 조회 컨트롤러
async function getUserSettingsController(req, res, next) {
  const { user_id } = req.params;
   if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const settings = await withTransaction(async (connection) => {
      return await userModel.getUserSettings(connection, user_id);
    });
    const apiResponse = standardizeApiResponse(settings);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 사용자 설정 업데이트 컨트롤러
async function updateUserSettingsController(req, res, next) {
  const { user_id } = req.params;
  // const authenticatedUserId = req.user.user_id; // Assuming auth middleware sets req.user
  // if (user_id !== authenticatedUserId) {
  //   const err = new Error("자신의 설정만 수정할 수 있습니다."); err.code = "FORBIDDEN"; return next(err);
  // }
  const settings = req.body;
  if (!user_id || !settings || Object.keys(settings).length === 0) {
    const err = new Error("User ID and settings data are required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // Add detailed validation for each setting field if necessary

  try {
    const updatedSettings = await withTransaction(async (connection) => {
      return await userModel.updateUserSettings(connection, user_id, settings);
    });
    const apiResponse = standardizeApiResponse(updatedSettings);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 사용자 프로필 이미지 업로드 컨트롤러
async function uploadProfileImageController(req, res, next) {
  const { user_id } = req.params;
  const file = req.file; // Assuming multer middleware is used and sets req.file

  if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){} // Clean up uploaded file
    return next(err);
  }
  if (!file) {
    const err = new Error("프로필 이미지가 업로드되지 않았습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // Add file type/size validation here if not handled by multer

  const profileImagePath = `/uploads/profiles/${file.filename}`; // Example, adjust as per your storage strategy

  try {
    await withTransaction(async (connection) => {
      return await userModel.updateUserProfileImage(connection, user_id, profileImagePath);
    });
    const apiResponse = standardizeApiResponse({
      message: "프로필 이미지가 성공적으로 업데이트되었습니다.",
      user_id: user_id,
      profile_image_path: profileImagePath,
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){} // Clean up on error
    next(err);
  }
}

// 회원 탈퇴 컨트롤러
async function deleteUserController(req, res, next) {
  const { user_id } = req.params;
  // Add authorization: ensure user can only delete their own account or admin
  if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const result = await withTransaction(async (connection) => {
      return await userModel.deleteUser(connection, user_id);
    });
    const apiResponse = standardizeApiResponse(result); // result should contain { message: "..." }
    res.status(apiResponse.statusCode).json(apiResponse.body); // Typically 200 or 204
  } catch (err) {
    next(err);
  }
}

// 사용자 프로필 조회 컨트롤러
async function getUserProfileController(req, res, next) {
  const { user_id } = req.params;
   if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const userProfile = await withTransaction(async (connection) => { // Read-only, but for consistency
        // getUserProfile in model was modified to take connection
        return await userModel.getUserProfile(connection, user_id);
    });
    // Model's getUserProfile already handles CLOB and date conversions, and toSnakeCaseObj
    const apiResponse = standardizeApiResponse(userProfile);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 사용자 프로필 업데이트 컨트롤러
async function updateUserProfileController(req, res, next) {
  const { user_id } = req.params;
  const profileData = req.body;
  // Add authorization
  if (!user_id || !profileData || Object.keys(profileData).length === 0) {
     const err = new Error("User ID and profile data are required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // Add detailed validation for profileData fields

  try {
    const updatedProfile = await withTransaction(async (connection) => {
      return await userModel.updateUserProfile(connection, user_id, profileData);
    });
    const apiResponse = standardizeApiResponse(updatedProfile);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 이메일 중복 체크 컨트롤러
async function checkEmailExistsController(req, res, next) { // Renamed from checkEmailExists
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email)) {
    const err = new Error("유효한 이메일을 입력해주세요.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    // This is a read-only operation, withTransaction might be optional but used for consistency
    const exists = await withTransaction(async (connection) => {
        return await userModel.checkEmailExists(connection, email);
    });
    const apiResponse = standardizeApiResponse({ email_exists: exists });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}


// --- 프로필 꾸미기, 레벨, 뱃지, 다국어, 활동 관련 컨트롤러들 ---
// 이 함수들도 모두 connection 인자를 받고, withTransaction으로 감싸고,
// standardizeApiResponse 사용, next(err)로 에러 처리하는 패턴을 적용해야 합니다.
// 분량이 매우 많으므로, 대표적인 패턴만 적용하고 나머지는 유사하게 수정한다고 가정합니다.

async function getUserCustomizationController(req, res, next) {
    const { user_id } = req.params;
    if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const customization = await withTransaction(async c => userModel.getUserCustomization(c, user_id));
        const apiResponse = standardizeApiResponse(customization);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function updateUserCustomizationController(req, res, next) {
    const { user_id } = req.params;
    const customizationData = req.body;
    if (!user_id || !customizationData) { const err = new Error("User ID and customization data are required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const result = await withTransaction(async c => userModel.updateUserCustomization(c, user_id, customizationData));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function getUserLevelController(req, res, next) {
    const { user_id } = req.params;
    if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const levelInfo = await withTransaction(async c => userModel.getUserLevel(c, user_id));
        const apiResponse = standardizeApiResponse(levelInfo);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function addUserExperienceController(req, res, next) {
    const { user_id } = req.params;
    const { points, exp_type = "manual", reason } = req.body;
    if (!user_id || typeof points !== "number" || points <= 0) { const err = new Error("User ID and valid points are required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const result = await withTransaction(async c => userModel.addUserExperience(c, user_id, points, exp_type, reason));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function getUserBadgesController(req, res, next) {
    const { user_id } = req.params;
    if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const badges = await withTransaction(async c => userModel.getUserBadges(c, user_id));
        const apiResponse = standardizeApiResponse(badges);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function toggleUserBadgeController(req, res, next) {
    const { user_id, badge_id } = req.params;
    const { is_equipped } = req.body;
    if (!user_id || !badge_id || is_equipped === undefined) { const err = new Error("User ID, Badge ID, and is_equipped are required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const result = await withTransaction(async c => userModel.toggleUserBadge(c, user_id, badge_id, is_equipped));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}


async function getTranslationResourcesController(req, res, next) {
    const { lang } = req.params;
    const { category } = req.query;
    if (!lang) { const err = new Error("Language code is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const translations = await withTransaction(async c => userModel.getTranslationResources(c, lang, category));
        const apiResponse = standardizeApiResponse(translations);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function updateUserLanguageController(req, res, next) {
    const { user_id } = req.params;
    const { language } = req.body;
    if (!user_id || !language) { const err = new Error("User ID and language code are required."); err.code = "INVALID_INPUT"; return next(err); }
    const supportedLanguages = config.supportedLanguages || ["ko", "en", "ja", "zh"]; // config에서 관리
    if (!supportedLanguages.includes(language)) {
        const err = new Error(`Unsupported language. Supported: ${supportedLanguages.join(", ")}`);
        err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const result = await withTransaction(async c => userModel.updateUserLanguage(c, user_id, language));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

// 래퍼 함수들은 그대로 유지 (내부적으로 호출하는 함수들이 connection을 받도록 수정되었으므로)
async function handleBugReportController(req, res, next) {
  // 이 함수는 handleUserActivityController를 호출하므로, handleUserActivityController가 next를 받도록 해야 함
  // 또는 여기서 직접 모델 함수를 호출하도록 변경
  // 여기서는 handleUserActivityController가 다음 단계에서 수정된다고 가정
  try {
    const { user_id } = req.params;
    const { bug_description, severity = 'medium' } = req.body;
    // 입력값 검증...
    const result = await withTransaction(async c => userModel.handleBugReport(c, user_id, bug_description, severity));
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch(error){
    next(error);
  }
}
async function handleFeedbackSubmissionController(req, res, next) {
  try {
    const { user_id } = req.params;
    const { feedback_content, feedback_type = 'general' } = req.body;
    // 입력값 검증...
    const result = await withTransaction(async c => userModel.handleFeedbackSubmission(c, user_id, feedback_content, feedback_type));
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch(error){
    next(error);
  }
}
async function handleTestParticipationController(req, res, next) {
   try {
    const { user_id } = req.params;
    const { test_type, test_details = '' } = req.body;
    // 입력값 검증...
    const result = await withTransaction(async c => userModel.handleTestParticipation(c, user_id, test_type, test_details));
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch(error){
    next(error);
  }
}

async function upgradeBadgeLevelController(req, res, next) {
    const { user_id } = req.params;
    const { badge_name, action_reason } = req.body;
    if (!user_id || !badge_name) { const err = new Error("User ID and badge name are required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const result = await withTransaction(async c => userModel.upgradeBadgeLevel(c, user_id, badge_name, action_reason));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function upgradeSubscriptionBadgeController(req, res, next) {
    const { user_id } = req.params;
    const { tier_name, months_count } = req.body;
    if (!user_id || !tier_name || !months_count) { const err = new Error("User ID, tier name, and months count are required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const result = await withTransaction(async c => userModel.upgradeSubscriptionBadge(c, user_id, tier_name, months_count));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

async function approveBadgeUpgradeController(req, res, next) {
    const { user_id } = req.params;
    const { badge_name, reason } = req.body;
    if (!user_id || !badge_name) { const err = new Error("User ID and badge name are required."); err.code = "INVALID_INPUT"; return next(err); }
    const approvableBadges = ["버그 헌터", "피드백 전문가"]; // config로 이동 가능
    if (!approvableBadges.includes(badge_name)) {
        const err = new Error("승인할 수 없는 뱃지입니다."); err.code = "INVALID_INPUT"; return next(err);
    }
    try {
        const result = await withTransaction(async c => userModel.approveBadgeUpgrade(c, user_id, badge_name, reason));
        const apiResponse = standardizeApiResponse(result);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) { next(error); }
}

// getUserBadgeDetailsController는 조회이므로 withTransaction이 필수는 아니지만, 일관성을 위해 적용
async function getUserBadgeDetailsController(req, res, next) {
    const { user_id } = req.params;
    const { badge_name } = req.query;
     if (!user_id) { const err = new Error("User ID is required."); err.code = "INVALID_INPUT"; return next(err); }
    try {
        const resultData = await withTransaction(async (connection) => {
            const allBadges = await userModel.getUserBadges(connection, user_id);
            if (badge_name) {
                const specificBadge = allBadges.find(b => b.badge_name === badge_name);
                if (!specificBadge) {
                    const err = new Error("해당 뱃지를 찾을 수 없습니다.");
                    err.code = "RESOURCE_NOT_FOUND";
                    throw err;
                }
                return { badge: specificBadge };
            }
            const badgesByType = {
                special: allBadges.filter((b) => b.badge_type === "special"),
                achievement: allBadges.filter((b) => b.badge_type === "achievement"),
                premium: allBadges.filter((b) => b.badge_type === "premium"),
                activity: allBadges.filter((b) => b.badge_type === "activity"),
            };
            return { total_badges: allBadges.length, badges_by_type: badgesByType, all_badges: allBadges };
        });
        const apiResponse = standardizeApiResponse(resultData);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) {
        next(error);
    }
}


module.exports = {
  registerUserController,
  loginUserController,
  getUserSettingsController, // Already done
  updateUserSettingsController,
  uploadProfileImageController,
  deleteUserController,
  getUserProfileController,
  updateUserProfileController,
  checkEmailExistsController, // Renamed
  getUserCustomizationController,
  updateUserCustomizationController,
  getUserLevelController,
  addUserExperienceController,
  getUserBadgesController,
  toggleUserBadgeController,
  getTranslationResourcesController,
  updateUserLanguageController,
  upgradeBadgeLevelController,
  handleBugReportController,
  handleFeedbackSubmissionController,
  handleTestParticipationController,
  getUserBadgeDetailsController,
  upgradeSubscriptionBadgeController,
  approveBadgeUpgradeController,
};
