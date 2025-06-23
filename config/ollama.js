const axios = require("axios");
const config = require("./index"); // 중앙 설정 파일 import

const OLLAMA_API_URL = config.ai.ollama.apiUrl;
const DEFAULT_OLLAMA_MODEL = config.ai.ollama.defaultModel;

if (!OLLAMA_API_URL && config.ai.defaultProvider === 'ollama') {
  // 기본 제공자가 ollama일 때만 에러 출력, 아니면 경고
  const message = "OLLAMA_API_URL 환경 변수가 설정되지 않았습니다. Ollama API를 사용할 수 없습니다.";
   if (config.ai.defaultProvider === 'ollama') {
    console.error(message);
  } else {
    console.warn(message);
  }
}

/**
 * 로컬 Ollama 모델에 대화 요청을 보냅니다.
 * @param {string} modelName 사용할 Ollama 모델 이름 (예: "gemma3:4b"). 제공되지 않으면 기본 모델 사용.
 * @param {string} currentUserMessage 현재 사용자 메시지
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history Vertex AI 형식의 대화 기록
 * @param {string | null} systemMessageText 시스템 프롬프트 메시지
 * @param {function(string): void} [streamResponseCallback] 스트리밍 응답 청크를 처리할 콜백 함수
 * @param {Object} options 추가 옵션 (현재 Ollama에서는 특별히 사용되지 않음, 향후 확장 가능)
 * @returns {Promise<{content: string, model_used: string, provider: string} | null>} AI 응답 또는 오류 시 null
 */
async function getOllamaResponse(
  modelName, // modelName이 첫 번째 인자로 유지 (aiProvider.js 호출 시그니처와 일관성)
  currentUserMessage,
  history = [],
  systemMessageText = null,
  streamResponseCallback = null,
  options = {} // options 인자 추가
) {
  const messages = [];
  const effectiveModelName = modelName || DEFAULT_OLLAMA_MODEL; // modelName이 없으면 기본값 사용

  if (systemMessageText && systemMessageText.trim() !== "") {
    messages.push({ role: "system", content: systemMessageText });
  }

  history.forEach((entry) => {
    if (entry.parts && entry.parts.length > 0 && entry.parts[0].text) {
      messages.push({
        role: entry.role === "model" ? "assistant" : "user",
        content: entry.parts[0].text,
      });
    }
  });

  messages.push({ role: "user", content: currentUserMessage });

  if (!OLLAMA_API_URL) {
    const errorMsg = "Ollama API URL이 설정되지 않아 요청을 보낼 수 없습니다.";
    console.error(`[Ollama] ${errorMsg}`);
    // 스트리밍 콜백이 있으면 오류를 전달하고, 아니면 에러 객체를 포함한 응답 반환
    if (streamResponseCallback) {
        streamResponseCallback(null, new Error(errorMsg)); // 스트리밍 콜백에 에러 전달 방식 통일 필요
        return null; // 또는 Promise.reject(new Error(errorMsg));
    }
    return { content: `오류: ${errorMsg}`, model_used: effectiveModelName, provider: "ollama" };
  }

  try {
    console.log(
      `[Ollama] Requesting API with model: ${effectiveModelName}, streaming: ${!!streamResponseCallback}`
    );

    const requestPayload = {
      model: effectiveModelName,
      messages: messages,
      stream: !!streamResponseCallback,
      // options.max_output_tokens 등 Ollama가 지원하는 파라미터가 있다면 여기에 추가
      // 예: options: { num_predict: options.max_output_tokens_override || -1 } // -1은 무제한
    };
     if (options.max_output_tokens_override && Number.isInteger(options.max_output_tokens_override)) {
      requestPayload.options = requestPayload.options || {};
      requestPayload.options.num_predict = options.max_output_tokens_override;
    }


    const response = await axios.post(OLLAMA_API_URL, requestPayload, {
      responseType: streamResponseCallback ? "stream" : "json",
    });

    if (streamResponseCallback) {
      let accumulatedContent = "";
      return new Promise((resolve, reject) => {
        response.data.on("data", (chunk) => {
          try {
            const chunkStr = chunk.toString();
            chunkStr.split("\n").forEach((line) => {
              if (line.trim()) {
                const parsedLine = JSON.parse(line);
                if (parsedLine.message && parsedLine.message.content) {
                  const contentPart = parsedLine.message.content;
                  accumulatedContent += contentPart;
                  streamResponseCallback(contentPart);
                }
                // 스트리밍 중 토큰 수 등의 메타데이터는 parsedLine.total_duration 등으로 제공될 수 있음
                if (parsedLine.done) {
                    // 스트림 완료 시, 누적된 내용과 메타데이터로 resolve
                    // console.log('[Ollama] Stream finished. Accumulated:', accumulatedContent);
                    // resolve({ content: accumulatedContent, model_used: effectiveModelName, provider: "ollama" });
                }
              }
            });
          } catch (e) {
            console.error("[Ollama] Error parsing stream chunk:", e, chunk.toString());
            // 스트림 파싱 오류 발생 시, 현재까지 수집된 내용으로 resolve 하거나 reject 할 수 있음
            // 여기서는 reject하지 않고 계속 진행 (부분적인 데이터라도 전달 시도)
          }
        });

        response.data.on("end", () => {
          // console.log('[Ollama] Stream ended. Final accumulated:', accumulatedContent);
          // 스트림이 정상적으로 'end'되면, 누적된 전체 내용을 resolve
           resolve({ content: accumulatedContent, model_used: effectiveModelName, provider: "ollama", streaming: true });
        });

        response.data.on("error", (err) => {
          console.error("[Ollama] Error during stream:", err);
          reject(err); // 스트림 자체에서 에러 발생 시 reject
        });
      });
    } else {
      // Non-streaming response
      if (response.data && response.data.message && response.data.message.content) {
        return {
          content: response.data.message.content,
          // 비스트리밍 응답에서도 토큰 수 등의 메타데이터가 있다면 추가
          // 예: actual_input_tokens: response.data.prompt_eval_count,
          //     actual_output_tokens: response.data.eval_count,
          model_used: effectiveModelName,
          provider: "ollama",
        };
      } else {
        console.error("[Ollama] Invalid non-streaming response structure:", response.data);
        return { content: "Ollama로부터 유효한 응답을 받지 못했습니다.", model_used: effectiveModelName, provider: "ollama" };
      }
    }
  } catch (error) {
    const errorData = error.response ? (error.response.data || error.message) : error.message;
    console.error("[Ollama] Error calling API:", errorData);
    const errorMessage = (error.response && error.response.data && error.response.data.error)
      ? error.response.data.error
      : "Ollama API 호출 중 오류가 발생했습니다.";

    if (streamResponseCallback) {
        streamResponseCallback(null, new Error(errorMessage));
        return null;
    }
    return { content: `오류: ${errorMessage}`, model_used: effectiveModelName, provider: "ollama" };
  }
}

module.exports = { getOllamaResponse };
