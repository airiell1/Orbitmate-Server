const {
  createController,
  createReadService
} = require("../utils/serviceFactory");
const translationService = require("../services/translationService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const config = require("../config");

// =========================
// 🔄 번역 리소스 관리 (Translation Resources)
// =========================

/**
 * 번역 리소스 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getTranslationResourcesController = createController(
  translationService.getTranslationResourcesService,
  {
    dataExtractor: (req) => {
      const { lang } = req.params;
      const { category } = req.query;
      return [lang, category];
    },
    validations: [
      (req) => {
        const { lang } = req.params;
        const { category } = req.query;
        
        // 언어 코드 필수 체크
        if (!lang) {
          const err = new Error("Language code is required in path parameter.");
          err.code = "INVALID_INPUT";
          throw err;
        }

        // 지원 언어 체크
        const supportedLanguages = config.supportedLanguages || ["ko", "en", "ja", "zh"];
        if (!supportedLanguages.includes(lang)) {
          const err = new Error(`Unsupported language: ${lang}. Supported: ${supportedLanguages.join(", ")}`);
          err.code = "INVALID_INPUT";
          throw err;
        }

        // 카테고리 타입 체크
        if (category && typeof category !== 'string') {
          const err = new Error("Category query parameter must be a string.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ]
  }
);

module.exports = {
  getTranslationResourcesController,
};
