/**
 * AI 제공자 선택 및 요청 로직을 처리하는 유틸리티
 */

const { getVertexAiResponse } = require('../config/vertexai');
const { getOllamaResponse } = require('../config/ollama');

/**
 * AI 제공자와 모델에 따라 적절한 AI 서비스를 호출합니다.
 * @param {string} aiProvider - AI 제공자 이름 ('vertexai' 또는 'ollama')
 * @param {string} ollamaModel - ollama 제공자일 경우 사용할 모델 이름 
 * @param {string} currentUserMessage - 현재 사용자 메시지
 * @param {Array} history - 대화 기록
 * @param {string|null} systemMessageText - 시스템 프롬프트
 * @param {string|null} specialModeType - 특수 모드 타입 ('stream', 'canvas' 등)
 * @param {function|null} streamResponseCallback - 스트리밍 응답 처리 콜백
 * @returns {Promise<{content: string}>} AI 응답 객체
 */
async function getAiResponse(
  aiProvider = 'vertexai',
  ollamaModel = 'gemma3:4b',
  currentUserMessage,
  history = [],
  systemMessageText = null,
  specialModeType = null,
  streamResponseCallback = null
) {
  console.log(`[aiProviderUtils] 요청 처리 중... 선택된 제공자: ${aiProvider}, 모델: ${ollamaModel || 'N/A'}`);

  // AI 제공자 선택에 따라 분기
  if (aiProvider === 'ollama') {
    console.log(`[aiProviderUtils] Ollama 제공자(${ollamaModel}) 사용`);
    return await getOllamaResponse(
      ollamaModel,
      currentUserMessage,
      history,
      systemMessageText,
      specialModeType === 'stream' ? streamResponseCallback : null
    );
  } else {
    // 기본값은 Vertex AI
    console.log(`[aiProviderUtils] Vertex AI 제공자 사용`);
    return await getVertexAiResponse(
      currentUserMessage, 
      history, 
      systemMessageText, 
      specialModeType,
      streamResponseCallback
    );
  }
}

module.exports = {
  getAiResponse
};
