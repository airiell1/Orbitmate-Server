const userModel = require("../models/user");
const { withTransaction } = require("../utils/dbUtils");
const config = require("../config"); // For supportedLanguages etc.

/**
 * 사용자 설정 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 사용자 설정 정보 또는 null (설정 없음)
 */
async function getUserSettingsService(userId) {
  return await withTransaction(async (connection) => {
    const settings = await userModel.getUserSettings(connection, userId);
    // 모델에서 RESOURCE_NOT_FOUND 에러를 throw 할 수 있음
    return settings;
  });
}

/**
 * 사용자 설정 업데이트 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} settingsData - 업데이트할 설정 데이터
 * @returns {Promise<Object>} 업데이트된 설정 정보
 */
async function updateUserSettingsService(userId, settingsData) {
  // 입력값에 대한 상세 유효성 검사는 컨트롤러에서 수행하거나,
  // 서비스 계층에서 비즈니스 규칙에 따른 추가 검증을 수행할 수 있습니다.
  // 예: theme 값이 허용된 목록에 있는지, font_size가 특정 범위 내에 있는지 등.
  // 이 예제에서는 모델에서 RETURNING 절을 통해 업데이트된 값을 반환하므로, 별도 조회가 필요 없을 수 있습니다.
  return await withTransaction(async (connection) => {
    const updatedSettings = await userModel.updateUserSettings(connection, userId, settingsData);
    return updatedSettings;
  });
}

/**
 * 사용자 언어 설정 업데이트 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} language - 새로운 언어 코드
 * @returns {Promise<Object>} 업데이트 결과 (예: { success: true, message: "..." })
 */
async function updateUserLanguageService(userId, language) {
  // 언어 코드가 지원되는 목록에 있는지 여기서 한번 더 검증할 수 있습니다.
  // (컨트롤러에서도 검증하지만, 서비스 계층의 방어적 프로그래밍)
  const supportedLanguages = config.supportedLanguages || ["ko", "en", "ja", "zh"];
  if (!supportedLanguages.includes(language)) {
    const error = new Error(`지원하지 않는 언어 코드입니다: ${language}`);
    error.code = "INVALID_INPUT";
    // 이 에러는 컨트롤러로 전파되어 처리됨
    throw error;
  }

  return await withTransaction(async (connection) => {
    // userModel.updateUserLanguage 함수는 { success: true, message: "..." } 형태를 반환했었음.
    // 서비스 계층에서는 실제 업데이트된 설정 객체를 반환하거나, 성공 여부만 반환할 수 있음.
    // 여기서는 모델의 반환값을 그대로 따르되, 컨트롤러에서 standardizeApiResponse로 한번 더 감싸게 됨.
    // 또는, 서비스에서 직접 업데이트된 설정을 조회하여 반환할 수도 있음.
    // 예: await userModel.updateUserLanguage(connection, userId, language);
    //     return await userModel.getUserSettings(connection, userId);
    const result = await userModel.updateUserLanguage(connection, userId, language);
    return result; // 모델이 반환하는 { success: true, message: "..." } 객체
  });
}

module.exports = {
  getUserSettingsService,
  updateUserSettingsService,
  updateUserLanguageService,
};
