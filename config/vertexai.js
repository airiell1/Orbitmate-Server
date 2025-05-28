const { VertexAI } = require('@google-cloud/vertexai')
require('dotenv').config();
const path = require('path');

// AI Provider 설정
const defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'vertexai';
console.log(`Default AI Provider: ${defaultProvider}`);

// Vertex AI 설정 (defaultProvider가 'vertexai'일 경우 사용)
let vertex_ai, generativeModel;
if (defaultProvider === 'vertexai') {
    const project = process.env.GOOGLE_PROJECT_ID;
    const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const location = 'global'; // Vertex AI의 위치 설정 (global 또는 us-central1 등)

    if (project && keyFilename) {
        vertex_ai = new VertexAI({ project, location, keyFilename });
        const model = process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25';
        console.log(`Using Vertex AI model: ${model}`);

        generativeModel = vertex_ai.getGenerativeModel({
            model: model,
            generationConfig: {
              temperature: 0.8,
              topP: 0.95,
              maxOutputTokens: 65535, // 최대 출력 토큰 수 (최대값 65535)
            },
            // safetySettings: [
            //    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            //    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            //    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            //    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            // ],
        });
    } else {
        console.warn('Vertex AI credentials (GOOGLE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS) are not set. Vertex AI will not be available.');
        // generativeModel will remain undefined, getAiResponse will need to handle this if Vertex is chosen but not configured
    }
} else if (defaultProvider === 'ollama') {
    // Ollama 클라이언트 설정 및 모델 이름은 Ollama 로직 내에서 처리 (필요한 경우)
    console.log('Ollama is configured as the default AI provider. Specific Ollama client setup would go here if needed.');
    // Example: const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
}

// AI 응답을 가져오는 함수
async function getAiResponse(currentUserMessage, history = [], systemMessageText = null, specialModeType = null, streamResponseCallback = null, options = {}) {
    const providerToUse = options.ai_provider_override || defaultProvider;
    console.log(`Attempting to use AI provider: ${providerToUse}`);

    if (providerToUse === 'ollama') {
        // --- OLLAMA LOGIC PLACEHOLDER ---
        console.log("Executing Ollama logic (Placeholder)...");
        // IMPORTANT: This is a placeholder. Actual Ollama integration code is needed here.
        // This includes initializing an Ollama client if necessary,
        // formatting the request (currentUserMessage, history, systemMessageText)
        // for Ollama, making the API call, and adapting Ollama's response.

        // Example of how it *might* look (replace with actual implementation):
        const ollamaModel = options.model_id_override || process.env.OLLAMA_MODEL || "llama2";
        console.log(`Using Ollama model: ${ollamaModel}`);
        
        // Simulate history formatting for Ollama (adjust as needed)
        const ollamaHistory = history.map(h => ({ 
            role: h.role === 'model' ? 'assistant' : h.role, 
            content: h.parts.map(p => p.text).join(' ') 
        }));

        if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
            console.log(`Ollama streaming for model: ${ollamaModel} (Placeholder)`);
            // Example: streamResponseCallback("Ollama chunk 1...");
            // await new Promise(resolve => setTimeout(resolve, 100));
            // streamResponseCallback("Ollama chunk 2...");
            // streamResponseCallback(null, null); // Signal end of stream (null error, null data means success)
            
            // Simulate returning IDs (these would come from DB save in controller, not AI)
            // This part of SSE is handled by the controller after AI response.
            // The AI function's role is just to stream text chunks.
            
            // For now, let's simulate a simple stream for placeholder
            const simulatedChunks = ["Ollama says: ", "This ", "is ", "a ", "streamed ", "response. "];
            for (const chunk of simulatedChunks) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
                streamResponseCallback(chunk);
            }
            streamResponseCallback(null, null); // End of stream
            return null; // Streaming handled via callback
        } else {
            console.log(`Ollama non-streaming for model: ${ollamaModel} (Placeholder)`);
            // Include max_output_tokens_override in placeholder payload if provided
            const ollamaPayload = {
                currentUserMessage,
                model: ollamaModel,
                systemPrompt: systemMessageText,
                maxOutputTokens: options.max_output_tokens_override // Placeholder usage
            };
            console.log("Ollama placeholder payload:", ollamaPayload);
            return { 
                content: `Placeholder: Ollama response to '${currentUserMessage}' using model ${ollamaModel}. System prompt: ${systemMessageText || 'none'}. Max Output Tokens: ${options.max_output_tokens_override || 'default'}`,
                actual_output_tokens: 0, // Placeholder
                input_tokens_processed: 0  // Placeholder
            };
        }
        // --- END OLLAMA LOGIC PLACEHOLDER ---
    } else if (providerToUse === 'vertexai') {
        // --- EXISTING VERTEX AI (GEMINI) LOGIC ---
        const vertexModelId = options.model_id_override || process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25';
        console.log(`Executing Vertex AI (Gemini) logic with model: ${vertexModelId}`);

        // Potentially re-initialize or select model if options.model_id_override is different and matters
        // For this iteration, we assume 'generativeModel' is correctly initialized or options.model_id_override matches it.
        // If generativeModel was initialized with a specific model ID, and options.model_id_override is different,
        // a new model instance might be needed. For now, we'll use the initially configured generativeModel
        // and just adjust generationConfig.maxOutputTokens.

        if (!generativeModel && defaultProvider === 'vertexai') { // Check specific generativeModel if vertex was the default
            const errorMsg = 'Vertex AI (Gemini) model is not initialized. Check GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.';
            console.error(errorMsg);
            if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                streamResponseCallback(null, new Error(errorMsg)); // Send error via callback
                return null;
            }
            throw new Error(errorMsg);
        } else if (!vertex_ai && providerToUse === 'vertexai') { // If vertex is chosen via override but client not init
             const errorMsg = 'Vertex AI client is not initialized. Cannot use vertexai_provider_override.';
             console.error(errorMsg);
             if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                streamResponseCallback(null, new Error(errorMsg));
                return null;
            }
            throw new Error(errorMsg);
        }
        
        // Use a dynamically configured generative model if model_id_override is present
        const currentGenerativeModel = options.model_id_override 
            ? vertex_ai.getGenerativeModel({ model: options.model_id_override }) 
            : generativeModel;

        if (!currentGenerativeModel) {
             const errorMsg = `Vertex AI model '${options.model_id_override || process.env.VERTEX_AI_MODEL}' could not be initialized.`;
             console.error(errorMsg);
             if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                streamResponseCallback(null, new Error(errorMsg));
                return null;
            }
            throw new Error(errorMsg);
        }


        let conversationContents = [];
        let finalSystemMessageText = systemMessageText;

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

        const generationConfig = { // Default generation config
            temperature: 0.8,
            topP: 0.95,
            maxOutputTokens: 65535, // Default max
        };

        if (options.max_output_tokens_override !== undefined) {
            generationConfig.maxOutputTokens = parseInt(options.max_output_tokens_override, 10);
            if (isNaN(generationConfig.maxOutputTokens) || generationConfig.maxOutputTokens <= 0) {
                // Revert to a safe default or throw error if invalid value is critical
                console.warn(`Invalid max_output_tokens_override: ${options.max_output_tokens_override}. Using default.`);
                generationConfig.maxOutputTokens = 8192; // A common default if process.env one is too large
            }
        }
        
        const request = {
            contents: conversationContents,
            systemInstruction: systemInstruction, // Pass systemInstruction directly
            generationConfig: generationConfig // Pass the potentially modified generationConfig
        };

        console.log('Vertex AI 요청 내용 (systemInstruction 방식):', JSON.stringify(request, null, 2));

        try {
            if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                const streamResult = await currentGenerativeModel.generateContentStream(request); // Use currentGenerativeModel
                for await (const item of streamResult.stream) {
                    if (item.candidates && item.candidates[0].content && item.candidates[0].content.parts) {
                        const chunkText = item.candidates[0].content.parts.map(part => part.text).join("");
                        streamResponseCallback(chunkText);
                    }
                }
                return null; // 스트리밍의 경우 전체 응답을 반환하지 않음, token count handling TBD for stream
            } else {
                const result = await currentGenerativeModel.generateContent(request); // Use currentGenerativeModel
                if (result && result.response && result.response.candidates && result.response.candidates.length > 0 &&
                    result.response.candidates[0].content && result.response.candidates[0].content.parts &&
                    result.response.candidates[0].content.parts.length > 0) {
                    const aiResponseText = result.response.candidates[0].content.parts.map(part => part.text).join("");
                    console.log('Vertex AI 응답 (일반):', aiResponseText);
                    // Placeholder token counts
                    const actual_output_tokens = result.response.usageMetadata?.candidatesTokenCount || 0;
                    const input_tokens_processed = result.response.usageMetadata?.promptTokenCount || 0;
                    return { 
                        content: aiResponseText,
                        actual_output_tokens: actual_output_tokens,
                        input_tokens_processed: input_tokens_processed
                    }; 
                } else {
                    console.error('Vertex AI로부터 유효한 응답을 받지 못했습니다. 응답 구조:', JSON.stringify(result, null, 2));
                    return { 
                        content: 'AI로부터 유효한 응답을 받지 못했습니다.',
                        actual_output_tokens: 0,
                        input_tokens_processed: 0
                    }; 
                }
            }
        } catch (error) {
            // ... (existing Vertex AI error handling) ...
            console.error('Vertex AI 요청 중 오류 발생:', error);
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
            try { if (error.response && error.response.body) { 
                const bodyText = error.response.body.toString();
                console.error('응답 본문 내용:', bodyText.substring(0, 500) + '...');
            } } catch (bodyError) { 
                console.error('응답 본문 확인 실패:', bodyError);
            }
            if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                streamResponseCallback(null, error); 
            }
            const errorMessage = `Vertex AI API 호출 실패: ${error.message}`;
            throw new Error(errorMessage);
        }
        // --- END EXISTING VERTEX AI (GEMINI) LOGIC ---
    } else {
        const errorMsg = `Unsupported AI provider: ${providerToUse}`;
        console.error(errorMsg);
        if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
            streamResponseCallback(null, new Error(errorMsg));
            return null;
        }
        throw new Error(errorMsg);
    }
}

module.exports = {
    getAiResponse,
    // vertex_ai and generativeModel might be undefined if Ollama is default or Vertex AI fails to init
    // Consumers of this module should be aware or this module should handle it more gracefully.
    vertex_ai: defaultProvider === 'vertexai' ? vertex_ai : undefined,
    generativeModel: defaultProvider === 'vertexai' ? generativeModel : undefined
};