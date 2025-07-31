// controllers/aiInfoController.js
const {
  createController
} = require("../utils/serviceFactory");
const config = require("../config");

// =========================
// 🤖 AI 모델 정보 (AI Information)
// =========================

/**
 * AI 모델 정보 서비스 함수 (동기식)
 */
function getModelsInfoService() {
  const { defaultProvider, gemini, ollama, vertexAi } = config.ai;

  // 모델 정보 구성
  const models = [
    {
      provider: "geminiapi",
      id: gemini.defaultModel,
      name: `Google AI Studio (${gemini.defaultModel})`,
      max_input_tokens: gemini.maxInputTokens || 1048576,
      max_output_tokens: gemini.maxOutputTokens || 8192,
      is_default: defaultProvider === "geminiapi",
      description: "Google의 AI Studio를 통해 제공되는 모델입니다. 균형 잡힌 성능과 다양한 기능을 제공합니다.",
      strengths: ["일반 대화", "창의적 글쓰기", "요약"],
      availability: gemini.apiKey ? "available" : "unavailable (API Key missing)",
    },
    {
      provider: "ollama",
      id: ollama.defaultModel,
      name: `Ollama (${ollama.defaultModel})`,
      max_input_tokens: ollama.maxInputTokens || 128000,
      max_output_tokens: ollama.maxOutputTokens || 8192,
      is_default: defaultProvider === "ollama",
      description: "로컬 환경에서 실행 가능한 오픈소스 모델입니다. 데이터 보안 및 커스터마이징에 유리합니다.",
      strengths: ["오프라인 사용", "빠른 응답(로컬 환경 최적화 시)", "특정 작업 파인-튜닝 가능"],
      availability: ollama.apiUrl ? "available" : "unavailable (API URL missing)",
    },
    {
      provider: "vertexai",
      id: vertexAi.defaultModel,
      name: `Vertex AI (${vertexAi.defaultModel})`,
      max_input_tokens: vertexAi.maxInputTokens || 1048576,
      max_output_tokens: vertexAi.maxOutputTokens || 65535,
      is_default: defaultProvider === "vertexai",
      description: "Google Cloud Vertex AI를 통해 제공되는 강력한 모델입니다. 엔터프라이즈 수준의 확장성과 안정성을 제공합니다.",
      strengths: ["고성능", "대규모 데이터 처리", "Google Cloud 생태계 연동"],
      availability: vertexAi.projectId && vertexAi.applicationCredentials ? "available" : "unavailable (Credentials missing)",
    },
  ];

  return models;
}

/**
 * AI 모델 정보 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getModelsInfoController = createController(
  async () => getModelsInfoService(), // 동기 함수를 비동기로 래핑
  {
    dataExtractor: () => [], // 파라미터 없음
    validations: [], // 유효성 검사 없음
    errorHandler: (err) => {
      err.code = err.code || "SERVER_ERROR";
      err.message = err.message || "AI 모델 정보 조회 중 서버 오류가 발생했습니다.";
      return err;
    }
  }
);

module.exports = {
  getModelsInfoController,
};