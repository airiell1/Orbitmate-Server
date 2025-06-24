const userModel = require("../models/user"); // 현재 getTranslationResources는 userModel에 있음
const { withTransaction } = require("../utils/dbUtils");

/**
 * 번역 리소스 조회 서비스
 * @param {string} languageCode - 언어 코드 (예: "ko", "en")
 * @param {string|null} [category] - (선택) 번역 카테고리
 * @returns {Promise<Object>} 번역 리소스 객체
 */
async function getTranslationResourcesService(languageCode, category = null) {
  // 이 작업은 읽기 전용이므로 withTransaction이 필수는 아니지만,
  // 모델 함수가 connection을 받도록 통일했으므로 사용합니다.
  return await withTransaction(async (connection) => {
    // userModel.getTranslationResources 함수가 connection을 첫 번째 인자로 받도록 수정되었다고 가정합니다.
    // (이전 단계에서 userModel 리팩토링 시 반영되었어야 함)
    const translations = await userModel.getTranslationResources(connection, languageCode, category);
    if (!translations || Object.keys(translations).length === 0) {
      // 번역 리소스가 없는 경우 빈 객체를 반환할 수도 있고, 에러를 발생시킬 수도 있습니다.
      // 여기서는 빈 객체 또는 모델에서 처리된 결과를 그대로 반환합니다.
      // 필요하다면 특정 언어/카테고리 부재 시 에러 처리 추가 가능.
    }
    return translations;
  });
}

module.exports = {
  getTranslationResourcesService,
};
