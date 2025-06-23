const axios = require("axios");
const OLLAMA_API_URL =
  process.env.OLLAMA_API_URL || "http://localhost:11434/api/chat";

/**
 * 로컬 Ollama 모델에 대화 요청을 보냅니다.
 * @param {string} modelName 사용할 Ollama 모델 이름 (예: "gemma3:1b", "gemma3:4b")
 * @param {string} currentUserMessage 현재 사용자 메시지
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history Vertex AI 형식의 대화 기록
 * @param {string | null} systemMessageText 시스템 프롬프트 메시지
 * @param {function(string): void} [streamResponseCallback] 스트리밍 응답 청크를 처리할 콜백 함수
 * @returns {Promise<{content: string} | null>} AI 응답 또는 오류 시 null
 */
async function getOllamaResponse(
  modelName,
  currentUserMessage,
  history = [],
  systemMessageText = null,
  streamResponseCallback = null
) {
  const messages = [];

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

  try {
    console.log(
      `Requesting Ollama API with model: ${modelName}, streaming: ${!!streamResponseCallback}`
    );

    const requestPayload = {
      model: modelName,
      messages: messages,
      stream: !!streamResponseCallback, // 스트리밍 콜백이 있으면 true, 없으면 false
    };

    const response = await axios.post(OLLAMA_API_URL, requestPayload, {
      responseType: streamResponseCallback ? "stream" : "json", // 스트리밍 시 responseType을 stream으로 설정
    });

    if (streamResponseCallback) {
      let accumulatedContent = "";
      return new Promise((resolve, reject) => {
        response.data.on("data", (chunk) => {
          try {
            // Ollama 스트림은 각 줄이 JSON 객체이므로, 버퍼를 문자열로 변환 후 파싱
            const chunkStr = chunk.toString();
            // 여러 JSON 객체가 한 청크에 올 수 있으므로 줄 단위로 분리하여 처리
            chunkStr.split("\\n").forEach((line) => {
              if (line.trim()) {
                const parsedLine = JSON.parse(line);
                if (parsedLine.message && parsedLine.message.content) {
                  const contentPart = parsedLine.message.content;
                  accumulatedContent += contentPart;
                  streamResponseCallback(contentPart);
                }
                if (parsedLine.done) {
                  // 스트림의 마지막 부분에서 done:true를 받으면 전체 내용을 resolve
                  // console.log('Ollama stream finished. Accumulated content:', accumulatedContent);
                }
              }
            });
          } catch (e) {
            console.error(
              "Error parsing Ollama stream chunk:",
              e,
              chunk.toString()
            );
            // 파싱 오류가 발생해도 스트림을 계속 시도하거나, 여기서 reject 할 수 있음
          }
        });

        response.data.on("end", () => {
          // console.log('Ollama stream ended. Final accumulated content:', accumulatedContent);
          resolve({ content: accumulatedContent });
        });

        response.data.on("error", (err) => {
          console.error("Error during Ollama stream:", err);
          reject(err);
        });
      });
    } else {
      // Non-streaming response
      if (
        response.data &&
        response.data.message &&
        response.data.message.content
      ) {
        return { content: response.data.message.content };
      } else {
        console.error(
          "Invalid non-streaming response structure from Ollama:",
          response.data
        );
        return { content: "Ollama로부터 유효한 응답을 받지 못했습니다." };
      }
    }
  } catch (error) {
    console.error(
      "Error calling Ollama API:",
      error.response
        ? error.response.data
          ? error.response.data
          : error.message
        : error.message
    );
    const errorMessage =
      error.response && error.response.data && error.response.data.error
        ? error.response.data.error
        : "Ollama API 호출 중 오류가 발생했습니다.";
    // 스트리밍 오류 시에는 이미 콜백으로 오류를 전파했거나, 여기서 reject해야 할 수 있음
    // 여기서는 일반적인 오류 반환 구조를 따름
    return { content: `오류: ${errorMessage}` };
  }
}

module.exports = { getOllamaResponse };
