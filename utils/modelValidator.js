// utils/modelValidator.js - AI 모델 검증 및 락 기능

const config = require('../config');

/**
 * AI 모델이 허용된 모델인지 검증
 * @param {string} provider - AI 제공자 (geminiapi, vertexai, ollama)
 * @param {string} modelId - 사용하려는 모델 ID
 * @returns {Object} 검증 결과 { isValid: boolean, reason?: string, suggestedModel?: string }
 */
function validateAiModel(provider, modelId) {
  // 모델 락이 비활성화된 경우 모든 모델 허용
  if (!config.ai.modelLock.enabled) {
    return { isValid: true };
  }

  // 금지된 모델 체크
  if (config.ai.modelLock.blockedModels.includes(modelId)) {
    const suggestedModel = getSuggestedModel(provider);
    return {
      isValid: false,
      reason: `모델 '${modelId}'는 비용 절약을 위해 차단된 모델입니다.`,
      suggestedModel
    };
  }

  // 허용된 모델 체크
  const allowedModels = config.ai.modelLock.allowedModels[provider] || [];
  
  // ollama는 로컬이므로 제한 없음
  if (provider === 'ollama') {
    return { isValid: true };
  }

  // 허용 목록이 비어있으면 모든 모델 허용 (단, 금지 목록은 여전히 적용)
  if (allowedModels.length === 0) {
    return { isValid: true };
  }

  // 허용 목록에 있는지 확인
  if (allowedModels.includes(modelId)) {
    return { isValid: true };
  }

  const suggestedModel = getSuggestedModel(provider);
  return {
    isValid: false,
    reason: `모델 '${modelId}'는 허용되지 않는 모델입니다. 비용 절약을 위해 무료/저비용 모델만 사용 가능합니다.`,
    suggestedModel
  };
}

/**
 * 제공자별 권장 모델 반환
 * @param {string} provider - AI 제공자
 * @returns {string} 권장 모델 ID
 */
function getSuggestedModel(provider) {
  const allowedModels = config.ai.modelLock.allowedModels[provider] || [];
  
  if (allowedModels.length > 0) {
    return allowedModels[0]; // 첫 번째 허용 모델 반환
  }

  // 기본 모델 반환
  switch (provider) {
    case 'geminiapi':
      return config.ai.gemini.defaultModel;
    case 'vertexai':
      return config.ai.vertexAi.defaultModel;
    case 'ollama':
      return config.ai.ollama.defaultModel;
    default:
      return 'gemini-2.0-flash-thinking-exp-01-21';
  }
}

/**
 * 모델 ID를 안전한 모델로 강제 변환
 * @param {string} provider - AI 제공자
 * @param {string} modelId - 원본 모델 ID
 * @returns {string} 검증된 안전한 모델 ID
 */
function sanitizeModelId(provider, modelId) {
  const validation = validateAiModel(provider, modelId);
  
  if (validation.isValid) {
    return modelId;
  }

  console.warn(`[ModelValidator] 모델 '${modelId}' 차단됨: ${validation.reason}`);
  const safeModel = validation.suggestedModel || getSuggestedModel(provider);
  console.warn(`[ModelValidator] 대신 안전한 모델 '${safeModel}' 사용`);
  
  return safeModel;
}

/**
 * 허용된 모델 목록 조회
 * @param {string} provider - AI 제공자
 * @returns {Array<string>} 허용된 모델 목록
 */
function getAllowedModels(provider) {
  if (!config.ai.modelLock.enabled) {
    return ['모든 모델 허용 (모델 락 비활성화)'];
  }

  const allowedModels = config.ai.modelLock.allowedModels[provider] || [];
  
  if (provider === 'ollama') {
    return ['모든 로컬 모델 허용'];
  }

  if (allowedModels.length === 0) {
    return ['모든 모델 허용 (단, 금지 목록 제외)'];
  }

  return allowedModels;
}

/**
 * 모델 락 상태 조회
 * @returns {Object} 모델 락 설정 정보
 */
function getModelLockStatus() {
  return {
    enabled: config.ai.modelLock.enabled,
    allowedModels: config.ai.modelLock.allowedModels,
    blockedModels: config.ai.modelLock.blockedModels,
    defaultProvider: config.ai.defaultProvider
  };
}

module.exports = {
  validateAiModel,
  sanitizeModelId,
  getSuggestedModel,
  getAllowedModels,
  getModelLockStatus
};
