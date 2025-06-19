// config/geminiapi.js - Google Gemini API (AI Studio) 연동

const { GoogleGenerativeAI } = require('@google/generative-ai');

// 환경 변수에서 API 키 가져오기
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
}

// Google Generative AI 인스턴스 초기화
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// 기본 모델 설정
const defaultModel = 'gemini-2.0-flash-thinking-exp-01-21';
const defaultConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

// 안전성 설정
const safetySettings = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
];

/**
 * Gemini API로 채팅 완성 요청
 * @param {string} currentUserMessage - 현재 사용자 메시지
 * @param {Array} history - 대화 기록 배열
 * @param {string} systemMessageText - 시스템 프롬프트
 * @param {string} specialModeType - 특수 모드 ('stream', 'canvas' 등)
 * @param {Function} streamResponseCallback - 스트리밍 응답 콜백 (현재 미지원)
 * @param {Object} options - 추가 옵션 객체
 * @returns {Object} AI 응답 객체
 */
async function getGeminiApiResponse(currentUserMessage, history, systemMessageText, specialModeType, streamResponseCallback, options = {}) {
  if (!genAI) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  try {
    // 모델 설정
    const modelName = options.model_id_override || defaultModel;
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: options.temperature || defaultConfig.temperature,
        topP: options.topP || defaultConfig.topP,
        topK: options.topK || defaultConfig.topK,
        maxOutputTokens: options.max_output_tokens_override || defaultConfig.maxOutputTokens,
      },
      safetySettings,
    });

    // 대화 기록 변환 (Gemini API 형식으로)
    const chatHistory = [];
      // 시스템 메시지가 있는 경우 첫 번째 메시지로 추가
    if (systemMessageText && systemMessageText.trim()) {
      chatHistory.push({
        role: 'user',
        parts: [{ text: `시스템 지시사항: ${systemMessageText.trim()}` }]
      });
      chatHistory.push({
        role: 'model',
        parts: [{ text: '네, 이해했습니다. 지시사항에 따라 도움을 드리겠습니다.' }]
      });
    }    // 기존 대화 기록 추가
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        // DB 형식 (parts[0].text) 또는 기존 형식 (content) 둘 다 지원
        const messageText = (msg.parts && msg.parts[0] && msg.parts[0].text) || msg.content;
        if (messageText && messageText.trim()) {
          if (msg.role === 'user') {
            chatHistory.push({
              role: 'user',
              parts: [{ text: messageText.trim() }]
            });
          } else if (msg.role === 'assistant' || msg.role === 'model') {
            chatHistory.push({
              role: 'model',
              parts: [{ text: messageText.trim() }]
            });
          }
        }
      });
    }

    // 특수 모드 처리
    let enhancedMessage = currentUserMessage;
    if (specialModeType === 'canvas') {
      enhancedMessage = `${currentUserMessage}\n\n[Canvas 모드] HTML, CSS, JavaScript 코드를 생성할 때는 다음 형식을 사용해주세요:\n\`\`\`html\n(HTML 코드)\n\`\`\`\n\`\`\`css\n(CSS 코드)\n\`\`\`\n\`\`\`javascript\n(JavaScript 코드)\n\`\`\``;
    } else if (specialModeType === 'search') {
      enhancedMessage = `${currentUserMessage}\n\n[검색 모드] 최신 정보가 필요한 질문입니다. 가능한 한 정확하고 최신의 정보를 제공해주세요.`;
    }    console.log(`[GeminiAPI] 요청 시작 - 모델: ${modelName}, 기록 개수: ${chatHistory.length}, 메시지 길이: ${enhancedMessage.length}`);
    console.log(`[GeminiAPI] 대화 기록:`, chatHistory.map((msg, i) => `${i+1}. ${msg.role}: ${msg.parts[0].text.substring(0, 50)}...`));
    
    // 채팅 세션 시작 - 대화 기록이 비어있으면 빈 배열로 시작
    const chat = model.startChat({
      history: chatHistory.length > 0 ? chatHistory : [],
    });    // 현재 메시지가 비어있지 않은지 확인
    if (!enhancedMessage || enhancedMessage.trim() === '') {
      throw new Error('메시지 내용이 비어있습니다.');
    }

    // 스트리밍 모드 처리
    if (streamResponseCallback && typeof streamResponseCallback === 'function') {
      console.log(`[GeminiAPI] 스트리밍 모드로 요청 처리 중...`);
      
      try {
        // 스트리밍으로 메시지 전송
        const result = await chat.sendMessageStream(enhancedMessage);
        let fullText = '';
        
        // 스트림 청크 처리
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            fullText += chunkText;
            // 콜백으로 청크 전송
            streamResponseCallback(chunkText);
          }
        }
        
        // 최종 결과 가져오기
        const finalResult = await result.response;
        const usageMetadata = finalResult.usageMetadata || {};
        
        console.log(`[GeminiAPI] 스트리밍 완료 - 총 길이: ${fullText.length}`);
        
        return {
          content: fullText,
          actual_input_tokens: usageMetadata.promptTokenCount || 0,
          actual_output_tokens: usageMetadata.candidatesTokenCount || 0,
          total_tokens: usageMetadata.totalTokenCount || 0,
          model_used: modelName,
          provider: 'geminiapi',
          finish_reason: 'stop',
          streaming: true
        };
      } catch (streamError) {
        console.error('Gemini API 스트리밍 오류:', streamError);
        throw streamError;
      }
    }

    // 일반 모드 처리 (스트리밍 아님)
    console.log(`[GeminiAPI] 일반 모드로 요청 처리 중...`);
    
    // 메시지 전송 및 응답 받기
    const result = await chat.sendMessage(enhancedMessage);
    const response = await result.response;
    const content = response.text();

    // 토큰 정보 추출 (사용 가능한 경우)
    const usageMetadata = response.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || 0;

    console.log(`[GeminiAPI] 모델: ${modelName}, 입력 토큰: ${inputTokens}, 출력 토큰: ${outputTokens}, 총 토큰: ${totalTokens}`);

    return {
      content: content,
      actual_input_tokens: inputTokens,
      actual_output_tokens: outputTokens,
      total_tokens: totalTokens,
      model_used: modelName,
      provider: 'geminiapi',
      finish_reason: 'stop'
    };

  } catch (error) {
    console.error('Gemini API 오류:', error);
    
    // API 에러 메시지 구체화
    if (error.message?.includes('API_KEY')) {
      throw new Error('Gemini API 키가 유효하지 않습니다.');
    } else if (error.message?.includes('QUOTA')) {
      throw new Error('Gemini API 할당량을 초과했습니다.');
    } else if (error.message?.includes('SAFETY')) {
      throw new Error('안전성 필터에 의해 응답이 차단되었습니다.');
    } else {
      throw new Error(`Gemini API 요청 실패: ${error.message}`);
    }
  }
}

module.exports = {
  getGeminiApiResponse,
  genAI,
  defaultModel,
  defaultConfig
};
