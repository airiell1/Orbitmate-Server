// config/geminiapi.js - Google Gemini API (AI Studio) 연동
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("./index"); // 중앙 설정 파일 import
const {
  getGeminiTools,
  executeAiTool,
  enhancePromptWithTools,
} = require("../utils/aiTools");
const {
  generateSystemPrompt,
  validateAndCleanPrompt,
  enhancePromptWithContext,
  enhanceUserMessageWithMode,
} = require("../utils/systemPrompt");

const GEMINI_API_KEY = config.ai.gemini.apiKey;

if (!GEMINI_API_KEY && config.ai.defaultProvider === 'geminiapi') {
  // 기본 제공자가 geminiapi일 때만 에러 출력, 아니면 경고
  const message = "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Gemini API를 사용할 수 없습니다.";
  if (config.ai.defaultProvider === 'geminiapi') {
    console.error(message);
  } else {
    console.warn(message);
  }
}

// Google Generative AI 인스턴스 초기화
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// 기본 모델 및 설정 (중앙 설정 파일에서 가져옴)
const defaultModel = config.ai.gemini.defaultModel;
const defaultConfig = {
  temperature: config.ai.gemini.temperature || 0.7,
  topP: config.ai.gemini.topP || 0.95,
  topK: config.ai.gemini.topK || 40,
  maxOutputTokens: config.ai.gemini.maxOutputTokens || 8192,
};

// 안전성 설정 (완화된 검열 설정)
const safetySettings = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_ONLY_HIGH",
  },
];

/**
 * Gemini API로 채팅 완성 요청
 * @param {string} currentUserMessage - 현재 사용자 메시지
 * @param {Array} history - 대화 기록 배열
 * @param {string} systemMessageText - 시스템 프롬프트 (utils/systemPrompt.js로 처리됨)
 * @param {string} specialModeType - 특수 모드 ('stream', 'canvas', 'search' 등)
 * @param {Function} streamResponseCallback - 스트리밍 응답 콜백
 * @param {Object} options - 추가 옵션 객체
 * @param {Object} context - 요청 컨텍스트 (IP 주소 등)
 * @returns {Promise<Object>} AI 응답 객체
 */
async function getGeminiApiResponse(
  currentUserMessage,
  history,
  systemMessageText,
  specialModeType,
  streamResponseCallback,
  options = {},
  context = {}
) {
  if (!genAI) {
    // 이 시점에서 genAI가 null이면 API 키가 없거나 초기화 실패
    throw new Error("Gemini API 클라이언트가 초기화되지 않았습니다. API 키를 확인하세요.");
  }

  try {
    // 모델 설정
    const modelName = options.model_id_override || defaultModel;

    // Function Calling 도구 사용 여부 결정
    const useTools = options.enableTools !== false; // 기본적으로 도구 사용 활성화
    const tools = useTools ? getGeminiTools() : [];

    const modelConfig = {
      model: modelName,
      generationConfig: {
        temperature: options.temperature || defaultConfig.temperature,
        topP: options.topP || defaultConfig.topP,
        topK: options.topK || defaultConfig.topK,
        maxOutputTokens:
          options.max_output_tokens_override || defaultConfig.maxOutputTokens,
      },
      safetySettings,
    };

    if (tools.length > 0) {
      modelConfig.tools = tools;
    }

    const model = genAI.getGenerativeModel(modelConfig);
    const chatHistory = [];

    // 시스템 프롬프트 처리 개선
    if (systemMessageText) {
      // systemMessageText가 문자열인지 확인하고 변환
      const systemText = typeof systemMessageText === 'string' ? systemMessageText : 
                        (systemMessageText && systemMessageText.content ? systemMessageText.content : String(systemMessageText));
      
      if (systemText && systemText.trim()) {
        // 시스템 프롬프트 검증 및 정리
        const cleanedSystemPrompt = validateAndCleanPrompt(systemText.trim());
      
      // 특수 모드에 따른 컨텍스트 확장
      let contextType = null;
      if (specialModeType === "canvas") {
        contextType = "canvas";
      } else if (specialModeType === "search") {
        contextType = "analysis";
      } else if (specialModeType === "chatbot") {
        contextType = "support";
      }
      
      // 컨텍스트 확장 적용
      const contextEnhancedPrompt = enhancePromptWithContext(cleanedSystemPrompt, contextType);
      
      // 도구 사용 가능 시 도구 관련 프롬프트 추가
      const finalSystemPrompt = useTools
        ? enhancePromptWithTools(contextEnhancedPrompt)
        : contextEnhancedPrompt;

      chatHistory.push({
        role: "user",
        parts: [{ text: `시스템 지시사항: ${finalSystemPrompt}` }],
      });
      chatHistory.push({
        role: "model",
        parts: [{ text: "네, 이해했습니다. 지시사항에 따라 도움을 드리겠습니다." }],
      });
      }
    } else if (useTools) {
      // 시스템 프롬프트가 없을 때 도구만 사용하는 경우
      const toolsOnlyPrompt = enhancePromptWithTools("");
      chatHistory.push({
        role: "user",
        parts: [{ text: `시스템 지시사항: ${toolsOnlyPrompt}` }],
      });
      chatHistory.push({
        role: "model",
        parts: [{ text: "네, 이해했습니다. 필요시 도구를 활용하여 도움을 드리겠습니다." }],
      });
    }

    // 대화 이력 처리 (중복 방지 로직 추가)
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        const messageText = (msg.parts && msg.parts[0] && msg.parts[0].text) || msg.content;
        if (messageText && messageText.trim() && !chatHistory.some(h => h.parts[0].text === messageText.trim())) {
          if (msg.role === "user") {
            chatHistory.push({ role: "user", parts: [{ text: messageText.trim() }] });
          } else if (msg.role === "assistant" || msg.role === "model") {
            chatHistory.push({ role: "model", parts: [{ text: messageText.trim() }] });
          }
        }
      });
    }

    // 메시지 전처리 및 특수 모드 처리 (utils/systemPrompt.js로 이동)
    const enhancedMessage = enhanceUserMessageWithMode(currentUserMessage, specialModeType);

    // 메시지 검증
    if (!enhancedMessage || enhancedMessage.trim() === "") {
      throw new Error("메시지 내용이 비어있습니다.");
    }

    // 🔧 중복 방지: 대화 이력의 마지막 메시지가 현재 사용자 메시지와 같으면 제거
    if (chatHistory.length > 0) {
      const lastMessage = chatHistory[chatHistory.length - 1];
      if (lastMessage.role === "user" && 
          lastMessage.parts && 
          lastMessage.parts[0] && 
          lastMessage.parts[0].text === enhancedMessage.trim()) {
        console.log(`[GeminiAPI] 중복된 사용자 메시지 발견, 이력에서 제거: "${enhancedMessage.substring(0, 50)}..."`);
        chatHistory.pop(); // 마지막 중복 메시지 제거
      }
    }

    const chat = model.startChat({
      history: chatHistory.length > 0 ? chatHistory : [],
    });

    if (streamResponseCallback && typeof streamResponseCallback === "function") {
      console.log(`[GeminiAPI] 스트리밍 모드로 요청 처리 중...`);
      try {
        const result = await chat.sendMessageStream(enhancedMessage);
        let fullText = "";
        let hasFunctionCalls = false;
        let finalResult = null;

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullText += chunkText;
            streamResponseCallback(chunkText);
          }
          if (chunk.candidates && chunk.candidates.length > 0) {
            const candidate = chunk.candidates[0];
            if (candidate.content && candidate.content.parts) {
              const functionCallParts = candidate.content.parts.filter(part => part.functionCall);
              if (functionCallParts.length > 0) {
                hasFunctionCalls = true;
                break;
              }
            }
          }
        }
        finalResult = await result.response;

        if (hasFunctionCalls || (finalResult.candidates && finalResult.candidates.length > 0)) {
          const candidate = finalResult.candidates[0];
          if (candidate.content && candidate.content.parts) {
            const functionCallParts = candidate.content.parts.filter(part => part.functionCall);
            if (functionCallParts.length > 0) {
              const functionResponses = [];
              for (const part of functionCallParts) {
                const functionCall = part.functionCall;
                const { name, args } = functionCall;
                try {
                  const toolResult = await executeAiTool(name, args, context);
                  functionResponses.push({ functionResponse: { name, response: toolResult } });
                } catch (toolError) {
                  functionResponses.push({ functionResponse: { name, response: { success: false, error: toolError.message } } });
                }
              }
              const followUpResult = await chat.sendMessageStream(functionResponses);
              let followUpText = "";
              for await (const chunk of followUpResult.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                  followUpText += chunkText;
                  streamResponseCallback(chunkText);
                }
              }
              const followUpFinal = await followUpResult.response;
              const usageMetadata = followUpFinal.usageMetadata || {};
              return {
                content: followUpText,
                actual_input_tokens: usageMetadata.promptTokenCount || 0,
                actual_output_tokens: usageMetadata.candidatesTokenCount || 0,
                total_tokens: usageMetadata.totalTokenCount || 0,
                model_used: modelName,
                provider: "geminiapi",
                finish_reason: "stop",
                streaming: true,
                function_calls_used: functionCallParts.map(part => part.functionCall.name),
              };
            }
          }
        }
        const usageMetadata = finalResult.usageMetadata || {};
        return {
          content: fullText,
          actual_input_tokens: usageMetadata.promptTokenCount || 0,
          actual_output_tokens: usageMetadata.candidatesTokenCount || 0,
          total_tokens: usageMetadata.totalTokenCount || 0,
          model_used: modelName,
          provider: "geminiapi",
          finish_reason: "stop",
          streaming: true,
        };
      } catch (streamError) {
        console.error("Gemini API 스트리밍 오류:", streamError);
        throw streamError;
      }
    } else {
      const result = await chat.sendMessage(enhancedMessage);
      const response = await result.response;
      const candidates = response.candidates;

      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        const content = candidate.content;
        if (content && content.parts) {
          const functionCallParts = content.parts.filter(part => part.functionCall);
          if (functionCallParts.length > 0) {
            const functionResponses = [];
            for (const part of functionCallParts) {
              const functionCall = part.functionCall;
              const { name, args } = functionCall;
              try {
                const toolResult = await executeAiTool(name, args, context);
                functionResponses.push({ functionResponse: { name, response: toolResult } });
              } catch (toolError) {
                 functionResponses.push({ functionResponse: { name, response: { success: false, error: toolError.message } } });
              }
            }
            const followUpResult = await chat.sendMessage(functionResponses);
            const followUpResponse = await followUpResult.response;
            const finalContent = followUpResponse.text();
            const usageMetadata = followUpResponse.usageMetadata || {};
            return {
              content: finalContent,
              actual_input_tokens: usageMetadata.promptTokenCount || 0,
              actual_output_tokens: usageMetadata.candidatesTokenCount || 0,
              total_tokens: usageMetadata.totalTokenCount || 0,
              model_used: modelName,
              provider: "geminiapi",
              finish_reason: "stop",
              streaming: false,
              function_calls_used: functionCallParts.map(part => part.functionCall.name),
            };
          }
        }
      }

      const responseContent = response.text();
      const usageMetadata = response.usageMetadata || {};
      return {
        content: responseContent,
        actual_input_tokens: usageMetadata.promptTokenCount || 0,
        actual_output_tokens: usageMetadata.candidatesTokenCount || 0,
        total_tokens: usageMetadata.totalTokenCount || 0,
        model_used: modelName,
        provider: "geminiapi",
        finish_reason: "stop",
      };
    }
  } catch (error) {
    console.error("Gemini API 오류:", error);
    if (error.message?.includes("API_KEY")) {
      throw new Error("Gemini API 키가 유효하지 않습니다.");
    } else if (error.message?.includes("QUOTA")) {
      throw new Error("Gemini API 할당량을 초과했습니다.");
    } else if (error.message?.includes("SAFETY")) {
      throw new Error("안전성 필터에 의해 응답이 차단되었습니다.");
    } else {
      throw new Error(`Gemini API 요청 실패: ${error.message}`);
    }
  }
}

module.exports = {
  getGeminiApiResponse,
  // 시스템 프롬프트 관리는 utils/systemPrompt.js에서 담당
  // 도구 관리는 utils/aiTools.js에서 담당
  // genAI 인스턴스는 내부적으로만 사용
};
