const translationService = require("../services/translationService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const config = require("../config"); // For supportedLanguages

/**
 * 번역 리소스 조회 컨트롤러
 */
async function getTranslationResourcesController(req, res, next) {
  const { lang } = req.params; // 라우트에서 :lang 파라미터로 받는다고 가정
  const { category } = req.query; // 쿼리 파라미터로 category를 받을 수 있음

  if (!lang) {
    const err = new Error("Language code is required in path parameter.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // 지원되는 언어인지 확인 (선택 사항, 서비스 계층에서도 검증 가능)
  const supportedLanguages = config.supportedLanguages || ["ko", "en", "ja", "zh"];
  if (!supportedLanguages.includes(lang)) {
    const err = new Error(`Unsupported language: ${lang}. Supported: ${supportedLanguages.join(", ")}`);
    err.code = "INVALID_INPUT";
    return next(err);
  }

  if (category && typeof category !== 'string') {
    const err = new Error("Category query parameter must be a string.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    const translations = await translationService.getTranslationResourcesService(lang, category);
    // 서비스에서 빈 객체를 반환할 수 있으므로, 여기서 별도의 존재 여부 확인은 불필요할 수 있음.
    const apiResponse = standardizeApiResponse(translations);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTranslationResourcesController,
};
