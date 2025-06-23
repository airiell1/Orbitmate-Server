// config/geminiapi.js - Google Gemini API (AI Studio) 연동

const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  getGeminiTools,
  executeAiTool,
  enhancePromptWithTools,
} = require("../utils/aiTools");

// 환경 변수에서 API 키 가져오기
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
}

// Google Generative AI 인스턴스 초기화
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// 기본 모델 설정
const defaultModel = "gemini-2.0-flash-thinking-exp-01-21";
const defaultConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

// 안전성 설정
const safetySettings = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
];

/**
 * Gemini API로 채팅 완성 요청
 * @param {string} currentUserMessage - 현재 사용자 메시지
 * @param {Array} history - 대화 기록 배열
 * @param {string} systemMessageText - 시스템 프롬프트
 * @param {string} specialModeType - 특수 모드 ('stream', 'canvas' 등)
 * @param {Function} streamResponseCallback - 스트리밍 응답 콜백 (현재 미지원) * @param {Object} options - 추가 옵션 객체
 * @param {Object} context - 요청 컨텍스트 (IP 주소 등)
 * @returns {Object} AI 응답 객체
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
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
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

    // 도구가 있으면 추가
    if (tools.length > 0) {
      modelConfig.tools = tools;
    }

    const model = genAI.getGenerativeModel(modelConfig); // 대화 기록 변환 (Gemini API 형식으로)
    const chatHistory = [];

    // 시스템 메시지가 있는 경우 첫 번째 메시지로 추가 (도구 사용법 포함)
    if (systemMessageText && systemMessageText.trim()) {
      const enhancedSystemPrompt = useTools
        ? enhancePromptWithTools(systemMessageText.trim())
        : systemMessageText.trim();

      chatHistory.push({
        role: "user",
        parts: [{ text: `시스템 지시사항: ${enhancedSystemPrompt}` }],
      });
      chatHistory.push({
        role: "model",
        parts: [
          { text: "네, 이해했습니다. 지시사항에 따라 도움을 드리겠습니다." },
        ],
      });
    } else if (useTools) {
      // 시스템 메시지가 없어도 도구 사용법을 추가
      const toolsOnlyPrompt = enhancePromptWithTools("");
      chatHistory.push({
        role: "user",
        parts: [{ text: `시스템 지시사항: ${toolsOnlyPrompt}` }],
      });
      chatHistory.push({
        role: "model",
        parts: [
          {
            text: "네, 이해했습니다. 필요시 검색 도구와 날씨 도구를 활용하여 도움을 드리겠습니다.",
          },
        ],
      });
    } // 기존 대화 기록 추가
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        // DB 형식 (parts[0].text) 또는 기존 형식 (content) 둘 다 지원
        const messageText =
          (msg.parts && msg.parts[0] && msg.parts[0].text) || msg.content;
        if (messageText && messageText.trim()) {
          if (msg.role === "user") {
            chatHistory.push({
              role: "user",
              parts: [{ text: messageText.trim() }],
            });
          } else if (msg.role === "assistant" || msg.role === "model") {
            chatHistory.push({
              role: "model",
              parts: [{ text: messageText.trim() }],
            });
          }
        }
      });
    }

    // 특수 모드 처리
    let enhancedMessage = currentUserMessage;
    if (specialModeType === "canvas") {
      enhancedMessage = `${currentUserMessage}\n\n[Canvas 모드] HTML, CSS, JavaScript 코드를 생성할 때는 다음 형식을 사용해주세요:\n\`\`\`html\n(HTML 코드)\n\`\`\`\n\`\`\`css\n(CSS 코드)\n\`\`\`\n\`\`\`javascript\n(JavaScript 코드)\n\`\`\``;
    } else if (specialModeType === "search") {
      enhancedMessage = `${currentUserMessage}\n\n[검색 모드] 최신 정보가 필요한 질문입니다. 가능한 한 정확하고 최신의 정보를 제공해주세요.`;
    }
    console.log(
      `[GeminiAPI] 요청 시작 - 모델: ${modelName}, 기록 개수: ${chatHistory.length}, 메시지 길이: ${enhancedMessage.length}`
    );
    console.log(
      `[GeminiAPI] 대화 기록:`,
      chatHistory.map(
        (msg, i) =>
          `${i + 1}. ${msg.role}: ${msg.parts[0].text.substring(0, 50)}...`
      )
    );

    // 채팅 세션 시작 - 대화 기록이 비어있으면 빈 배열로 시작
    const chat = model.startChat({
      history: chatHistory.length > 0 ? chatHistory : [],
    }); // 현재 메시지가 비어있지 않은지 확인
    if (!enhancedMessage || enhancedMessage.trim() === "") {
      throw new Error("메시지 내용이 비어있습니다.");
    } // 스트리밍 모드 처리
    if (
      streamResponseCallback &&
      typeof streamResponseCallback === "function"
    ) {
      console.log(`[GeminiAPI] 스트리밍 모드로 요청 처리 중...`);

      try {
        // 스트리밍으로 메시지 전송
        const result = await chat.sendMessageStream(enhancedMessage);
        let fullText = "";
        let hasFunctionCalls = false;
        let finalResult = null;

        // 스트림 청크 처리
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullText += chunkText;
            // 콜백으로 청크 전송
            streamResponseCallback(chunkText);
          }

          // Function call 체크
          if (chunk.candidates && chunk.candidates.length > 0) {
            const candidate = chunk.candidates[0];
            if (candidate.content && candidate.content.parts) {
              const functionCallParts = candidate.content.parts.filter(
                (part) => part.functionCall
              );
              if (functionCallParts.length > 0) {
                hasFunctionCalls = true;
                console.log(
                  `[GeminiAPI] Function calls detected in stream:`,
                  functionCallParts.length
                );
                break; // Function call이 발견되면 스트리밍 중단
              }
            }
          }
        }

        // 최종 결과 가져오기
        finalResult = await result.response;

        // Function Call 처리 (스트리밍 중 발견되었거나 최종 결과에 있는 경우)
        if (
          hasFunctionCalls ||
          (finalResult.candidates && finalResult.candidates.length > 0)
        ) {
          const candidate = finalResult.candidates[0];
          if (candidate.content && candidate.content.parts) {
            const functionCallParts = candidate.content.parts.filter(
              (part) => part.functionCall
            );

            if (functionCallParts.length > 0) {
              console.log(
                `[GeminiAPI] Processing function calls in streaming mode...`
              );

              // 각 Function Call 실행
              const functionResponses = [];
              for (const part of functionCallParts) {
                const functionCall = part.functionCall;
                const { name, args } = functionCall;
                console.log(
                  `[GeminiAPI] Executing function: ${name} with args:`,
                  args
                );

                try {
                  const toolResult = await executeAiTool(name, args, context);
                  functionResponses.push({
                    functionResponse: {
                      name: name,
                      response: toolResult,
                    },
                  });
                } catch (toolError) {
                  console.error(
                    `[GeminiAPI] Function call error for ${name}:`,
                    toolError
                  );
                  functionResponses.push({
                    functionResponse: {
                      name: name,
                      response: {
                        success: false,
                        error: toolError.message,
                      },
                    },
                  });
                }
              }

              // Function Call 결과로 다시 스트리밍 요청
              console.log(
                `[GeminiAPI] Sending function results back to model (streaming)...`
              );
              const followUpResult = await chat.sendMessageStream(
                functionResponses
              );
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

              console.log(
                `[GeminiAPI] Function calling streaming completed - 총 길이: ${followUpText.length}`
              );

              return {
                content: followUpText,
                actual_input_tokens: usageMetadata.promptTokenCount || 0,
                actual_output_tokens: usageMetadata.candidatesTokenCount || 0,
                total_tokens: usageMetadata.totalTokenCount || 0,
                model_used: modelName,
                provider: "geminiapi",
                finish_reason: "stop",
                streaming: true,
                function_calls_used: functionCallParts.map(
                  (part) => part.functionCall.name
                ),
              };
            }
          }
        }

        // Function Call이 없는 경우 일반 스트리밍 응답 처리
        const usageMetadata = finalResult.usageMetadata || {};

        console.log(`[GeminiAPI] 스트리밍 완료 - 총 길이: ${fullText.length}`);

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
    } // 일반 모드 처리 (스트리밍 아님)
    console.log(`[GeminiAPI] 일반 모드로 요청 처리 중...`);

    // 메시지 전송 및 응답 받기
    const result = await chat.sendMessage(enhancedMessage);
    const response = await result.response;
    // Function Call 처리
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const candidate = candidates[0];
      const content = candidate.content;

      // Function Call이 있는지 확인
      if (content && content.parts) {
        const functionCallParts = content.parts.filter(
          (part) => part.functionCall
        );

        if (functionCallParts.length > 0) {
          console.log(
            `[GeminiAPI] Function calls detected:`,
            functionCallParts.length
          );

          // 각 Function Call 실행
          const functionResponses = [];
          for (const part of functionCallParts) {
            const functionCall = part.functionCall;
            const { name, args } = functionCall;
            console.log(
              `[GeminiAPI] Executing function: ${name} with args:`,
              args
            );

            try {
              const toolResult = await executeAiTool(name, args, context);
              functionResponses.push({
                functionResponse: {
                  name: name,
                  response: toolResult,
                },
              });
            } catch (toolError) {
              console.error(
                `[GeminiAPI] Function call error for ${name}:`,
                toolError
              );
              functionResponses.push({
                functionResponse: {
                  name: name,
                  response: {
                    success: false,
                    error: toolError.message,
                  },
                },
              });
            }
          }

          // Function Call 결과로 다시 요청
          console.log(`[GeminiAPI] Sending function results back to model...`);
          const followUpResult = await chat.sendMessage(functionResponses);
          const followUpResponse = await followUpResult.response;
          const finalContent = followUpResponse.text();

          // 토큰 정보 추출
          const usageMetadata = followUpResponse.usageMetadata || {};
          const inputTokens = usageMetadata.promptTokenCount || 0;
          const outputTokens = usageMetadata.candidatesTokenCount || 0;
          const totalTokens = usageMetadata.totalTokenCount || 0;

          console.log(
            `[GeminiAPI] Function calling completed - 모델: ${modelName}, 입력 토큰: ${inputTokens}, 출력 토큰: ${outputTokens}`
          );

          return {
            content: finalContent,
            actual_input_tokens: inputTokens,
            actual_output_tokens: outputTokens,
            total_tokens: totalTokens,
            model_used: modelName,
            provider: "geminiapi",
            finish_reason: "stop",
            streaming: false,
            function_calls_used: functionCallParts.map(
              (part) => part.functionCall.name
            ),
          };
        }
      }
    }

    // Function Call이 없는 경우 일반 응답 처리
    const content = response.text();
    const usageMetadata = response.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || 0;

    console.log(
      `[GeminiAPI] 모델: ${modelName}, 입력 토큰: ${inputTokens}, 출력 토큰: ${outputTokens}, 총 토큰: ${totalTokens}`
    );

    return {
      content: content,
      actual_input_tokens: inputTokens,
      actual_output_tokens: outputTokens,
      total_tokens: totalTokens,
      model_used: modelName,
      provider: "geminiapi",
      finish_reason: "stop",
    };
  } catch (error) {
    console.error("Gemini API 오류:", error);

    // API 에러 메시지 구체화
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
  genAI,
  defaultModel,
  defaultConfig,
};
