const { VertexAI } = require('@google-cloud/vertexai')
require('dotenv').config();
const path = require('path');

// Vertex AI 설정
const project = process.env.GOOGLE_PROJECT_ID;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const location = 'global'; // Vertex AI의 위치 설정 (global 또는 us-central1 등)

// Vertex AI 클라이언트 초기화
const vertex_ai = new VertexAI({ project, location, keyFilename });

// AI 모델 설정
const model = process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25';
console.log(`Using Vertex AI model: ${model}`); // Optional: log the model being used

const generativeModel = vertex_ai.getGenerativeModel({
    model: model,
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 65535, // 최대 출력 토큰 수 (최대값 65535)
    }
});

// AI 응답을 가져오는 함수
async function getVertexAiResponse(currentUserMessage, history = [], systemMessageText = null, specialModeType = null, streamResponseCallback = null) { // 새 시그니처 + specialModeType + streamResponseCallback
    let conversationContents = [];
    let finalSystemMessageText = systemMessageText; // systemMessageText가 prompt와 systemPrompt를 통합한 값으로 간주

    if (specialModeType === 'canvas') {
        // 캔버스 모드일 때 시스템 프롬프트 강화
        finalSystemMessageText = (finalSystemMessageText ? finalSystemMessageText + "\n\n" : "") +
            "중요: 당신은 HTML, CSS, JavaScript 코드를 생성하는 AI입니다. " +
            "사용자의 요청에 따라 웹 페이지의 구조(HTML)와 스타일(CSS)을 제공해야 합니다. " +
            "각 코드는 반드시 마크다운 코드 블록(예: ```html ... ```, ```css ... ```)으로 감싸서 제공해주세요. " +
            "HTML에는 기본적인 구조를 포함하고, CSS는 해당 HTML을 스타일링하는 내용을 포함해야 합니다. " +
            "JavaScript가 필요하다면 그것도 코드 블록으로 제공해주세요. " +
            "만약 사용자가 '캔버스에 그림 그려줘' 같이 모호하게 요청하면, 구체적으로 어떤 그림인지 되묻거나 간단한 예시를 제시할 수 있습니다. " +
            "생성된 코드는 바로 웹페이지에 적용될 수 있도록 완전한 형태로 제공하는 것을 목표로 합니다.";
        console.log("캔버스 모드 활성화. 강화된 시스템 프롬프트 적용.");
    } else if (specialModeType === 'search') {
        const searchPrompt = "Please answer based on web search results if necessary. Provide concise answers with relevant information found.";
        finalSystemMessageText = finalSystemMessageText ? `${finalSystemMessageText}\n${searchPrompt}` : searchPrompt;
    } else if (specialModeType === 'stream') {
        console.log("Stream mode activated. System prompt will be used as is. Specific stream-related prompt adjustments can be added here if needed.");
        // 예: const streamPrompt = "Provide your response in a continuous stream.";
        // finalSystemMessageText = finalSystemMessageText ? `${finalSystemMessageText}\n${streamPrompt}` : streamPrompt;
    }


    // 1. 시스템 메시지 (선택 사항, systemInstruction으로 전달)
    const systemInstruction = (finalSystemMessageText && typeof finalSystemMessageText === 'string' && finalSystemMessageText.trim() !== '')
        ? { parts: [{ text: finalSystemMessageText }] }
        : null;

    if (systemInstruction) {
        console.log("적용된 시스템 지침:", JSON.stringify(systemInstruction, null, 2));
    }
    
    // 2. 이전 대화 내역 (history는 {role, parts} 객체의 배열이어야 함)
    conversationContents = [...history];

    // 3. 현재 사용자 입력 중복 방지
    const lastMsg = conversationContents[conversationContents.length - 1];
    if (
        !lastMsg ||
        lastMsg.role !== 'user' ||
        !lastMsg.parts ||
        !lastMsg.parts[0] ||
        lastMsg.parts[0].text !== currentUserMessage
    ) {
        conversationContents.push({ role: 'user', parts: [{ text: currentUserMessage }] });
    }

    const request = {
        contents: conversationContents,
        ...(systemInstruction && { system: systemInstruction }),
    };

    console.log('Vertex AI 요청 내용 (systemInstruction 방식):', JSON.stringify(request, null, 2));

    try {
        if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
            const streamResult = await generativeModel.generateContentStream(request);
            for await (const item of streamResult.stream) {
                if (item.candidates && item.candidates[0].content && item.candidates[0].content.parts) {
                    const chunkText = item.candidates[0].content.parts.map(part => part.text).join("");
                    streamResponseCallback(chunkText);
                }
            }
            return null; // 스트리밍의 경우 전체 응답을 반환하지 않음
        } else {
            const result = await generativeModel.generateContent(request);
            if (result && result.response && result.response.candidates && result.response.candidates.length > 0 &&
                result.response.candidates[0].content && result.response.candidates[0].content.parts &&
                result.response.candidates[0].content.parts.length > 0) {
                const aiResponseText = result.response.candidates[0].content.parts.map(part => part.text).join("");
                console.log('Vertex AI 응답 (일반):', aiResponseText);
                return { content: aiResponseText };
            } else {
                console.error('Vertex AI로부터 유효한 응답을 받지 못했습니다. 응답 구조:', JSON.stringify(result, null, 2));
                return 'AI로부터 유효한 응답을 받지 못했습니다.';
            }
        }
    } catch (error) {
        console.error('Vertex AI 요청 중 오류 발생:', error);
        
        // HTML 응답 감지 및 디버깅 정보 향상
        if (error.message && error.message.includes('<!DOCTYPE')) {
            console.error('HTML 응답을 받았습니다. 인증 또는 네트워크 문제일 수 있습니다.');
            console.error('이 오류는 주로 다음 문제로 발생합니다:');
            console.error('1. Google Cloud 인증 정보가 잘못되었거나 만료됨');
            console.error('2. 네트워크/프록시 설정 문제');
            console.error('3. Vertex AI 서비스 접근 권한 부족');
        }
        
        if (error.response && error.response.data) {
            console.error('오류 응답 데이터:', error.response.data);
        }
        
        // 응답 본문 확인 시도
        try {
            if (error.response && error.response.body) {
                const bodyText = error.response.body.toString();
                console.error('응답 본문 내용:', bodyText.substring(0, 500) + '...');
            }
        } catch (bodyError) {
            console.error('응답 본문 확인 실패:', bodyError);
        }
        
        // 스트리밍 콜백이 있다면 오류도 전달할 수 있도록 처리
        if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
            streamResponseCallback(null, error); // 오류 객체를 콜백으로 전달
        }
        
        const errorMessage = `Vertex AI API 호출 실패: ${error.message}`;
        throw new Error(errorMessage);
    }
}

module.exports = {
    getVertexAiResponse,
    vertex_ai,
    generativeModel
};