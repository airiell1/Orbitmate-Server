const userSettingsService = require("../services/userSettingsService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const config = require("../config"); // For supportedLanguages

/**
 * 사용자 설정 조회 컨트롤러
 */
async function getUserSettingsController(req, res, next) {
  const { user_id } = req.params;
  if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // 인증된 사용자와 요청된 user_id가 일치하는지 확인하는 로직 (미들웨어 또는 여기서)
  // if (req.user.user_id !== user_id) {
  //   const err = new Error("자신의 설정만 조회할 수 있습니다.");
  //   err.code = "FORBIDDEN";
  //   return next(err);
  // }

  try {
    const settings = await userSettingsService.getUserSettingsService(user_id);
    const apiResponse = standardizeApiResponse(settings);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

/**
 * 사용자 설정 업데이트 컨트롤러
 */
async function updateUserSettingsController(req, res, next) {
  const { user_id } = req.params;
  const settingsData = req.body;

  if (!user_id || !settingsData || Object.keys(settingsData).length === 0) {
    const err = new Error("User ID and settings data are required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // 입력값 상세 유효성 검사 (예시)
  if (settingsData.theme && !config.allowedThemes.includes(settingsData.theme)) {
    const err = new Error(`Invalid theme. Allowed: ${config.allowedThemes.join(', ')}`);
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (settingsData.language && !config.supportedLanguages.includes(settingsData.language)) {
     const err = new Error(`Invalid language. Supported: ${config.supportedLanguages.join(', ')}`);
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (settingsData.font_size && (isNaN(parseInt(settingsData.font_size, 10)) || settingsData.font_size < 10 || settingsData.font_size > 30)) {
    const err = new Error("Font size must be a number between 10 and 30.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
   if (settingsData.notifications_enabled !== undefined && typeof settingsData.notifications_enabled !== 'boolean') {
    const err = new Error("Notifications enabled must be a boolean.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // ai_model_preference는 문자열 검사 정도만
   if (settingsData.ai_model_preference && (typeof settingsData.ai_model_preference !== 'string' || settingsData.ai_model_preference.length > 100)) {
    const err = new Error("AI model preference must be a string up to 100 characters.");
    err.code = "INVALID_INPUT";
    return next(err);
  }


  // 인증된 사용자와 요청된 user_id가 일치하는지 확인하는 로직
  // if (req.user.user_id !== user_id) { ... }

  try {
    const updatedSettings = await userSettingsService.updateUserSettingsService(user_id, settingsData);
    const apiResponse = standardizeApiResponse(updatedSettings);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

/**
 * 사용자 언어 설정 업데이트 컨트롤러
 */
async function updateUserLanguageController(req, res, next) {
  const { user_id } = req.params;
  const { language } = req.body;

  if (!user_id || !language) {
    const err = new Error("User ID and language code are required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // 서비스 계층에서도 지원 언어 검사를 하지만, 컨트롤러에서도 기본적인 검사를 수행할 수 있음.
  // config.supportedLanguages를 사용하여 검증
  if (!config.supportedLanguages.includes(language)) {
    const err = new Error(`지원하지 않는 언어입니다. 지원 언어: ${config.supportedLanguages.join(", ")}`);
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // 인증된 사용자와 요청된 user_id가 일치하는지 확인하는 로직
  // if (req.user.user_id !== user_id) { ... }

  try {
    const result = await userSettingsService.updateUserLanguageService(user_id, language);
    // 서비스에서 { success: true, message: "..." } 또는 업데이트된 전체 설정을 반환할 수 있음.
    // 현재는 모델의 반환값을 그대로 따르므로, 성공 메시지 객체가 반환됨.
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUserSettingsController,
  updateUserSettingsController,
  updateUserLanguageController,
};
