/**
 * AI Provider selection and request logic utility.
 */

// Import the correctly named function from vertexai.js
const { getVertexAiApiResponse } = require('../config/vertexai'); 
const { getOllamaResponse } = require('../config/ollama');
const { getGeminiApiResponse } = require('../config/geminiapi'); // 새로 추가

/**
 * 지정된 AI 제공자로부터 채팅 완성을 가져옵니다.
 * @param {string} aiProvider - 사용할 AI 제공자 ('geminiapi', 'vertexai' 또는 'ollama'). 기본값은 'geminiapi'입니다.
 * @param {string} currentUserMessage - 현재 사용자의 메시지.
 * @param {Array} history - 대화 기록.
 * @param {string|null} systemMessageText - 시스템 프롬프트 텍스트.
 * @param {string|null} specialModeType - 특수 모드 타입 ('stream', 'canvas' 등).
 * @param {function|null} streamResponseCallback - 스트리밍 응답을 위한 콜백 함수.
 * @param {Object} options - AI 제공자를 위한 추가 옵션.
 * @param {string} [options.ollamaModel='gemma3:4b'] - 제공자가 'ollama'인 경우 사용할 모델 이름.
 * @param {string} [options.vertexModelId=undefined] - Vertex AI에 사용할 모델 ID (getVertexAiApiResponse의 기본값을 재정의).
 * @param {string} [options.geminiModel='gemini-2.0-flash-thinking-exp-01-21'] - Gemini API에 사용할 모델 ID.
 * @param {number} [options.maxOutputTokens=undefined] - 모델에서 요청할 최대 출력 토큰 수.
 * @returns {Promise<Object|null>} AI 응답 객체, 또는 스트리밍인 경우 null.
 * @throws {Error} 지원되지 않는 AI 제공자가 지정된 경우.
 */
async function fetchChatCompletion(
  aiProvider = 'geminiapi', // 기본 제공자를 geminiapi로 변경
  currentUserMessage,
  history = [],
  systemMessageText = null,
  specialModeType = null,
  streamResponseCallback = null,
  options = {} // Added options parameter
) {  // Consolidate model selection for logging
  let modelToLog;
  if (aiProvider === 'geminiapi') {
    modelToLog = options.model_id_override || options.geminiModel || 'gemini-2.0-flash-thinking-exp-01-21';
  } else if (aiProvider === 'vertexai') {
    modelToLog = options.vertexModelId || `Vertex AI default (${process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25'})`;
  } else if (aiProvider === 'ollama') {
    modelToLog = options.ollamaModel || 'gemma3:4b';
  }
  
  console.log(`[aiProviderUtils] Requesting chat completion. Provider: ${aiProvider}, Model: ${modelToLog}`);
  if (aiProvider === 'geminiapi') {
    console.log(`[aiProviderUtils] Using Gemini API provider.`);
    return await getGeminiApiResponse(
      currentUserMessage,
      history,
      systemMessageText,
      specialModeType,
      streamResponseCallback,
      options // Pass all options to Gemini API
    );
  } else if (aiProvider === 'vertexai') {
    console.log(`[aiProviderUtils] Using Vertex AI provider.`);
    // Prepare options for Vertex AI, separating Gemini-specific ones.
    const vertexOptions = { ...options };
    delete vertexOptions.geminiModel; // Remove geminiModel if it exists in options for Vertex call
    
    return await getVertexAiApiResponse(
      currentUserMessage,
      history,
      systemMessageText,
      specialModeType,
      streamResponseCallback,
      vertexOptions // Pass the filtered options object
    );
  } else if (aiProvider === 'ollama') {
    const ollamaModelToUse = options.ollamaModel || 'gemma3:4b'; // Default if not provided in options
    console.log(`[aiProviderUtils] Using Ollama provider with model: ${ollamaModelToUse}`);
    // Note: getOllamaResponse might also need an options parameter if it needs to handle maxOutputTokens etc.
    // For now, assuming it takes ollamaModel directly as its first argument.
    return await getOllamaResponse(
      ollamaModelToUse,
      currentUserMessage,
      history,
      systemMessageText,
      specialModeType === 'stream' ? streamResponseCallback : null,
      options // Pass through options to Ollama in case it can use them (e.g. max_output_tokens)
    );
  } else {
    console.error(`[aiProviderUtils] Unsupported AI provider: ${aiProvider}`);
    throw new Error(`Unsupported AI provider: ${aiProvider}. Must be 'geminiapi', 'vertexai' or 'ollama'.`);
  }
}

module.exports = {
  fetchChatCompletion // Export the renamed function
};
