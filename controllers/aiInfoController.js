// controllers/aiInfoController.js
const config = require("../config"); // 중앙 설정 파일 import
const { standardizeApiResponse } = require("../utils/apiResponse");
// const { logError } = require("../utils/errorHandler"); // 에러는 중앙 핸들러로

async function getModelsInfoController(req, res, next) { // next 추가
  try {
    const { defaultProvider, gemini, ollama, vertexAi } = config.ai;

    // 모델 정보 구성 시, config/index.js에 정의된 값을 사용
    // 토큰 정보 등은 예시이며, 실제 모델의 정확한 스펙은 해당 AI 공급자의 문서를 참조해야 합니다.
    // config/index.js 에 각 모델별 상세 스펙(토큰 등)을 추가하는 것도 고려할 수 있습니다.
    const models = [
      {
        provider: "geminiapi",
        id: gemini.defaultModel,
        name: `Google AI Studio (${gemini.defaultModel})`,
        max_input_tokens: gemini.maxInputTokens || 1048576, // 예시값, 실제 값으로 대체 필요
        max_output_tokens: gemini.maxOutputTokens || 8192,  // 예시값
        is_default: defaultProvider === "geminiapi",
        description: "Google의 AI Studio를 통해 제공되는 모델입니다. 균형 잡힌 성능과 다양한 기능을 제공합니다.",
        strengths: ["일반 대화", "창의적 글쓰기", "요약"],
        availability: gemini.apiKey ? "available" : "unavailable (API Key missing)",
      },
      {
        provider: "ollama",
        id: ollama.defaultModel,
        name: `Ollama (${ollama.defaultModel})`,
        max_input_tokens: ollama.maxInputTokens || 128000, // 예시값
        max_output_tokens: ollama.maxOutputTokens || 8192, // 예시값
        is_default: defaultProvider === "ollama",
        description: "로컬 환경에서 실행 가능한 오픈소스 모델입니다. 데이터 보안 및 커스터마이징에 유리합니다.",
        strengths: ["오프라인 사용", "빠른 응답(로컬 환경 최적화 시)", "특정 작업 फाइन-튜닝 가능"],
        availability: ollama.apiUrl ? "available" : "unavailable (API URL missing)",
      },
      {
        provider: "vertexai",
        id: vertexAi.defaultModel,
        name: `Vertex AI (${vertexAi.defaultModel})`,
        max_input_tokens: vertexAi.maxInputTokens || 1048576, // 예시값
        max_output_tokens: vertexAi.maxOutputTokens || 65535, // 예시값
        is_default: defaultProvider === "vertexai",
        description: "Google Cloud Vertex AI를 통해 제공되는 강력한 모델입니다. 엔터프라이즈 수준의 확장성과 안정성을 제공합니다.",
        strengths: ["고성능", "대규모 데이터 처리", "Google Cloud 생태계 연동"],
        availability: vertexAi.projectId && vertexAi.applicationCredentials ? "available" : "unavailable (Credentials missing)",
      },
    ];

    // standardizeApiResponse는 { statusCode, body }를 반환
    const response = standardizeApiResponse(models);
    res.status(response.statusCode).json(response.body);

  } catch (err) {
    // logError("aiInfoController:getModelsInfoController", err, { req }); // 중앙 핸들러에서 로깅
    // 에러 객체에 코드와 메시지를 명확히 설정하여 전달하는 것이 좋음
    err.code = err.code || "SERVER_ERROR"; // 기본 에러 코드 설정
    err.message = err.message || "AI 모델 정보 조회 중 서버 오류가 발생했습니다.";
    next(err); // 중앙 에러 핸들러로 전달
  }
}

module.exports = {
  getModelsInfoController,
};
