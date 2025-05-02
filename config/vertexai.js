const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

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
      { category: 'HATE_SPEECH', threshold: 'BLOCK' },
      { category: 'SELF_HARM', threshold: 'BLOCK' },
      { category: 'SEXUAL_CONTENT', threshold: 'BLOCK' },
      { category: 'VIOLENCE', threshold: 'BLOCK' },
      { category: 'TOXICITY', threshold: 'BLOCK' },
      { category: 'DRUGS', threshold: 'BLOCK' },
      { category: 'DANGEROUS_CONTENT', threshold: 'BLOCK' },
    ],
});

// Vertex AI에 요청 보내고 응답 받는 함수
async function getAiResponse(prompt, history = []) {
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
            if (resp && resp.response && resp.response.promptFeedback) {
              console.error('차단 사유:', resp.response.promptFeedback);
              throw new Error('콘텐츠 생성 요청이 안전 설정에 의해 차단되었습니다.');
            }
            throw new Error('Vertex AI로부터 유효한 응답을 받지 못했습니다.');
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