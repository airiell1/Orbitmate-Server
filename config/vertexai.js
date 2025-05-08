const { VertexAI, HarmCategory, HarmBlockThreshold } = require('@google-cloud/vertexai'); // HarmCategory와 HarmBlockThreshold 추가!
require('dotenv').config();
const path = require('path');

// Vertex AI 설정
const project = process.env.GOOGLE_PROJECT_ID;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const location = 'us-central1';

// Vertex AI 클라이언트 초기화
const vertex_ai = new VertexAI({ project, location, keyFilename });

// AI 모델 설정
const model = 'gemini-2.5-pro-exp-03-25';

const generativeModel = vertex_ai.getGenerativeModel({
    model: model,
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, // 증오 발언 관련
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, // 성적 콘텐츠 관련
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, // 위험한 콘텐츠 관련
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, // 학대, 독성, 괴롭힘 관련
      // { category: HarmCategory.HARM_CATEGORY_UNSPECIFIED, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE } // 매우 포괄적 (신중하게 사용)
    ],
});

// Vertex AI에 요청 보내고 응답 받는 함수
async function getAiResponse(prompt, history = []) { // sessionId 파라미터 제거
    const contents = [...history, { role: 'user', parts: [{ text: prompt }] }];

    const request = {
        contents: contents,
    };

    console.log('Vertex AI 요청 내용:', JSON.stringify(request, null, 2));

    try {
        const resp = await generativeModel.generateContent(request);

        if (resp && resp.response && resp.response.candidates && resp.response.candidates.length > 0
            && resp.response.candidates[0].content && resp.response.candidates[0].content.parts && resp.response.candidates[0].content.parts.length > 0)
        {
            const aiText = resp.response.candidates[0].content.parts[0].text;
            console.log('Vertex AI 응답:', aiText);
            return aiText;
        } else {
            console.error('Vertex AI로부터 유효한 응답을 받지 못했습니다.', resp.response);
            // promptFeedback을 확인하여 차단 여부 및 사유 확인
            if (resp && resp.response && resp.response.promptFeedback && resp.response.promptFeedback.blockReason) {
                console.error('차단 사유:', resp.response.promptFeedback.blockReason);
                console.error('차단 관련 안전 등급:', resp.response.promptFeedback.safetyRatings);
                throw new Error(`콘텐츠 생성 요청이 안전 설정에 의해 차단되었습니다. 사유: ${resp.response.promptFeedback.blockReason}`);
            }
            throw new Error('Vertex AI로부터 유효한 응답을 받지 못했습니다 (응답 구조 확인 필요).');
        }
    } catch (error) {
        console.error('Vertex AI 호출 중 오류 발생:', error);
        throw error;
    } 
}

module.exports = {
    getAiResponse,
    vertex_ai,
    generativeModel
};