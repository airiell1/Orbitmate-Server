const { VertexAI } = require("@google-cloud/vertexai");
const config = require("./index"); // 중앙 설정 파일 import
const { logError } = require("../utils/errorHandler");

// Vertex AI 설정 (중앙 설정 파일에서 가져옴)
let vertex_ai, generativeModel;
const project = config.ai.vertexAi.projectId;
const keyFilename = config.ai.vertexAi.applicationCredentials;
const location = config.ai.vertexAi.location;
const defaultModelId = config.ai.vertexAi.defaultModel;

// 기본 generationConfig, 필요시 중앙 설정으로 이동 가능
const defaultGenerationConfig = {
  temperature: 0.8,
  topP: 0.95,
  maxOutputTokens: 65535, // Vertex AI의 기본 최대값 또는 서비스 한도에 따름
};

// 안전성 설정 (완화된 검열 설정)
const safetySettings = [
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_ONLY_HIGH",
  },
];

if (project && keyFilename) {
  try {
    vertex_ai = new VertexAI({ project, location, keyFilename });

    generativeModel = vertex_ai.getGenerativeModel({
      model: defaultModelId,
      generationConfig: defaultGenerationConfig,
      safetySettings: safetySettings,
    });
  } catch (error) {
    logError(
      "vertexAiConfig:startup",
      new Error(`Failed to initialize Vertex AI client or model '${defaultModelId}' during startup: ${error.message}`), // Error 객체로 전달
      { originalError: error } // 상세 오류는 context로
    );
  }
} else {
   const message = "Vertex AI credentials (GOOGLE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS) are not set. Vertex AI will not be available.";
   if (config.ai.defaultProvider === 'vertexai') {
    console.error(`[VertexAI] ${message}`);
   } else {
    console.warn(`[VertexAI] ${message}`);
   }
}

// AI 응답을 가져오는 함수 (Vertex AI 전용)
async function getVertexAiApiResponse(
  currentUserMessage,
  history = [],
  systemMessageText = null,
  specialModeType = null,
  streamResponseCallback = null,
  options = {} // options 객체에 model_id_override, generationConfig, max_output_tokens_override 포함 가능
) {
  console.log(`[VertexAI] Executing Vertex AI (Gemini) logic.`);

  if (!vertex_ai) {
    const errorMsg = "Vertex AI client not initialized. Check credentials and logs.";
    logError("getVertexAiApiResponse:init", new Error(errorMsg));
    if (streamResponseCallback && typeof streamResponseCallback === "function") {
      streamResponseCallback(null, new Error(errorMsg));
      return null;
    }
    throw new Error(errorMsg);
  }

  const modelIdToUse = options.model_id_override || defaultModelId;
  let currentGenerativeModel = generativeModel; // 기본적으로 시작 시 초기화된 모델 사용

  // 모델 ID가 다르거나, 현재 모델이 초기화되지 않은 경우 (시작 시 실패) 동적으로 모델 가져오기
  if (modelIdToUse !== defaultModelId || !currentGenerativeModel) {
    console.log(`[VertexAI] Using dynamically configured model: ${modelIdToUse}`);
    try {
      currentGenerativeModel = vertex_ai.getGenerativeModel({
        model: modelIdToUse,
        generationConfig: { // options.generationConfig가 있으면 그것을 우선 사용, 없으면 기본값
          ...defaultGenerationConfig,
          ...(options.generationConfig || {}),
        },
      });
    } catch (error) {
      const errorMsg = `Failed to initialize overridden Vertex AI model '${modelIdToUse}': ${error.message}`;
      logError("getVertexAiApiResponse:modelInit", new Error(errorMsg), { originalError: error });
      if (streamResponseCallback && typeof streamResponseCallback === "function") {
        streamResponseCallback(null, new Error(errorMsg));
        return null;
      }
      throw new Error(errorMsg);
    }
  } else if (options.generationConfig) { // 같은 모델이지만 generationConfig만 변경하는 경우
     console.log(`[VertexAI] Applying custom generationConfig for model ${modelIdToUse}`);
     try {
        currentGenerativeModel = vertex_ai.getGenerativeModel({
          model: modelIdToUse,
          generationConfig: {
            ...currentGenerativeModel.generationConfig, // 기존 모델의 generationConfig를 기본으로
            ...options.generationConfig, // options에 있는 값으로 덮어쓰기
          },
        });
     } catch (error) {
        const errorMsg = `Failed to apply new generationConfig to Vertex AI model '${modelIdToUse}': ${error.message}`;
        logError("getVertexAiApiResponse:genConfig", new Error(errorMsg), { originalError: error });
        if (streamResponseCallback && typeof streamResponseCallback === "function") {
          streamResponseCallback(null, new Error(errorMsg));
          return null;
        }
        throw new Error(errorMsg);
     }
  }


  if (!currentGenerativeModel) {
    const errorMsg = `Vertex AI model '${modelIdToUse}' not available.`;
    logError("getVertexAiApiResponse:modelNotAvailable", new Error(errorMsg));
    if (streamResponseCallback && typeof streamResponseCallback === "function") {
      streamResponseCallback(null, new Error(errorMsg));
      return null;
    }
    throw new Error(errorMsg);
  }
  console.log(`[VertexAI] Using model: ${currentGenerativeModel.model}`);

  let conversationContents = [];
  let finalSystemMessageText = systemMessageText ? systemMessageText.trim() : "";

  if (specialModeType === "canvas") {
    const canvasSystemPrompt = "중요: 당신은 HTML, CSS, JavaScript 코드를 생성하는 AI입니다. 사용자의 요청에 따라 웹 페이지의 구조(HTML)와 스타일(CSS)을 제공해야 합니다. 각 코드는 반드시 마크다운 코드 블록(예: ```html ... ```, ```css ... ```)으로 감싸서 제공해주세요. HTML에는 기본적인 구조를 포함하고, CSS는 해당 HTML을 스타일링하는 내용을 포함해야 합니다. JavaScript가 필요하다면 그것도 코드 블록으로 제공해주세요. 만약 사용자가 '캔버스에 그림 그려줘' 같이 모호하게 요청하면, 구체적으로 어떤 그림인지 되묻거나 간단한 예시를 제시할 수 있습니다. 생성된 코드는 바로 웹페이지에 적용될 수 있도록 완전한 형태로 제공하는 것을 목표로 합니다.";
    finalSystemMessageText = finalSystemMessageText ? `${finalSystemMessageText}\n\n${canvasSystemPrompt}` : canvasSystemPrompt;
  } else if (specialModeType === "search") {
    const searchSystemPrompt = "Please answer based on web search results if necessary. Provide concise answers with relevant information found.";
    finalSystemMessageText = finalSystemMessageText ? `${finalSystemMessageText}\n${searchSystemPrompt}` : searchSystemPrompt;
  } else if (specialModeType === "chatbot") {
    const chatbotSystemPrompt = "공지사항/QnA 에러해결용 챗봇 프롬프트 - 정확하고 친절한 기술 지원을 제공하며, 단계별 해결 방법을 안내해주세요. 문제의 원인을 분석하고 실용적인 해결책을 제시합니다.";
    finalSystemMessageText = finalSystemMessageText ? `${finalSystemMessageText}\n\n${chatbotSystemPrompt}` : chatbotSystemPrompt;
  }

  const systemInstruction = finalSystemMessageText && finalSystemMessageText.trim() !== ""
    ? { parts: [{ text: finalSystemMessageText.trim() }] }
    : null;

  conversationContents = [...history];
  
  // 🔧 중복 방지: 대화 이력의 마지막 메시지가 현재 사용자 메시지와 같으면 제거
  if (conversationContents.length > 0) {
    const lastMsg = conversationContents[conversationContents.length - 1];
    if (lastMsg.role === "user" && 
        lastMsg.parts && 
        lastMsg.parts[0] && 
        lastMsg.parts[0].text === currentUserMessage) {
      console.log(`[VertexAI] 중복된 사용자 메시지 발견, 이력에서 제거: "${currentUserMessage.substring(0, 50)}..."`);
      conversationContents.pop(); // 마지막 중복 메시지 제거
    }
  }
  
  // 현재 사용자 메시지 추가
  conversationContents.push({ role: "user", parts: [{ text: currentUserMessage }] });

  // generationConfig를 currentGenerativeModel에서 가져오고, options.max_output_tokens_override로 덮어쓰기
  const finalGenerationConfig = { ...currentGenerativeModel.generationConfig };
  if (options.max_output_tokens_override !== undefined) {
    const userMaxTokens = parseInt(options.max_output_tokens_override, 10);
    if (!isNaN(userMaxTokens) && userMaxTokens > 0) {
      finalGenerationConfig.maxOutputTokens = userMaxTokens;
      console.log(`[VertexAI] Overriding maxOutputTokens to: ${userMaxTokens}`);
    } else {
      logError("getVertexAiApiResponse:genConfig", new Error(`Invalid max_output_tokens_override: ${options.max_output_tokens_override}. Using default ${finalGenerationConfig.maxOutputTokens}.`));
    }
  }

  const request = {
    contents: conversationContents,
    systemInstruction: systemInstruction,
    generationConfig: finalGenerationConfig, // 최종적으로 결정된 generationConfig 사용
  };

  console.log("[VertexAI] Request (final):", JSON.stringify(request, null, 2).substring(0, 500) + "...");


  try {
    if (streamResponseCallback && typeof streamResponseCallback === "function") {
      let streamErrorOccurred = false;
      const streamResult = await currentGenerativeModel.generateContentStream(request);
      for await (const item of streamResult.stream) {
        if (item && item.candidates && item.candidates[0] && item.candidates[0].content && item.candidates[0].content.parts && item.candidates[0].content.parts.length > 0) {
          const chunkText = item.candidates[0].content.parts.map((part) => part.text).join("");
          streamResponseCallback(chunkText);
        } else {
          const streamError = new Error("Malformed stream item from Vertex AI");
          logError("getVertexAiApiResponse:streamError", streamError, { item });
          streamResponseCallback(null, streamError);
          streamErrorOccurred = true;
          break;
        }
      }
      if (!streamErrorOccurred) {
        streamResponseCallback(null, null); // 스트림 성공적 종료 알림
      }
      // 스트리밍 응답의 경우, 전체 content를 반환하지 않고 콜백으로 처리했음을 나타내기 위해 null 또는 특정 객체 반환
      return { streaming_handled: true, model_used: currentGenerativeModel.model, provider: "vertexai" };
    } else {
      const result = await currentGenerativeModel.generateContent(request);
      if (result && result.response && result.response.candidates && result.response.candidates.length > 0 &&
          result.response.candidates[0].content && result.response.candidates[0].content.parts &&
          result.response.candidates[0].content.parts.length > 0) {
        const aiResponseText = result.response.candidates[0].content.parts.map((part) => part.text).join("");
        return {
          content: aiResponseText,
          actual_output_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          input_tokens_processed: result.response.usageMetadata?.promptTokenCount || 0,
          model_used: currentGenerativeModel.model,
          provider: "vertexai",
        };
      } else {
        const errorMsg = "Invalid AI response structure from Vertex AI (non-streaming).";
        logError("getVertexAiApiResponse:invalidResponse", new Error(errorMsg), { response: result.response });
        throw new Error(errorMsg);
      }
    }
  } catch (error) {
    logError("getVertexAiApiResponse:apiCall", new Error(`Vertex AI API call failed: ${error.message}`), { originalError: error, requestDetails: { modelIdToUse, systemInstructionIsSet: !!systemInstruction } });
    if (error.message && error.message.includes("<!DOCTYPE")) {
      console.error("[VertexAI] HTML response received. This often indicates authentication or network issues.");
    }
    if (streamResponseCallback && typeof streamResponseCallback === "function") {
      streamResponseCallback(null, error);
      return { streaming_handled: true, error: true, model_used: modelIdToUse, provider: "vertexai" };
    } else {
      throw error; // Re-throw for non-streaming errors
    }
  }
}

module.exports = {
  getVertexAiApiResponse,
  // vertex_ai 및 generativeModel은 내부적으로만 사용하고 직접 export하지 않음
};
