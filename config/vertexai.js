const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();
const path = require('path');
const { logError } = require('../utils/errorHandler'); // Import logError

// Vertex AI 설정
let vertex_ai, generativeModel;
const project = process.env.GOOGLE_PROJECT_ID;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const location = 'global'; // Vertex AI의 위치 설정 (global 또는 us-central1 등)

if (project && keyFilename) {
    try {
        vertex_ai = new VertexAI({ project, location, keyFilename });
        const modelId = process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25'; // Consistent model ID var name
        console.log(`Attempting to initialize Vertex AI model: ${modelId}`);

        generativeModel = vertex_ai.getGenerativeModel({
            model: modelId, // Use the variable
            generationConfig: {
              temperature: 0.8,
              topP: 0.95,
              maxOutputTokens: 65535,
            }
            // safetySettings can be configured here if needed, following Vertex AI SDK documentation.
            // Example:
            // safetySettings: [
            //   { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            // ],
        });
        console.log(`Vertex AI model '${modelId}' initialized successfully.`);
    } catch (error) {
        logError('vertexAiConfig:startup', 'Failed to initialize Vertex AI client or model during startup', error);
        // vertex_ai and generativeModel will remain undefined or partially defined.
        // The getVertexAiApiResponse function will handle this.
    }
} else {
    logError('vertexAiConfig:startup', 'Vertex AI credentials (GOOGLE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS) are not set. Vertex AI will not be available.', null);
}

// AI 응답을 가져오는 함수 (Vertex AI 전용)
async function getVertexAiApiResponse(currentUserMessage, history = [], systemMessageText = null, specialModeType = null, streamResponseCallback = null, options = {}) {
    console.log(`Executing Vertex AI (Gemini) logic.`);

    // 1. Check if Vertex AI client is initialized
    if (!vertex_ai) {
        const errorMsg = 'Vertex AI client not initialized. Check GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.';
        logError('getVertexAiApiResponse:init', errorMsg, null);
        if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
            streamResponseCallback(null, new Error(errorMsg));
            return null;
        }
        throw new Error(errorMsg);
    }

    // 2. Determine the model to use and ensure it's available
    const modelIdToUse = options.model_id_override || generativeModel?.model || process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25';
    let currentGenerativeModel;

    if (options.model_id_override && options.model_id_override !== generativeModel?.model) {
        console.log(`Using dynamically configured Vertex AI model: ${modelIdToUse}`);
        try {
            // Ensure generationConfig from original model or defaults is applied if needed
            const baseGenerationConfig = generativeModel?.generationConfig || {
                temperature: 0.8,
                topP: 0.95,
                maxOutputTokens: 65535,
            };
            currentGenerativeModel = vertex_ai.getGenerativeModel({ 
                model: modelIdToUse,
                generationConfig: { // Apply base config to new model instance
                    ...baseGenerationConfig,
                    ...(options.generationConfig || {}) // Allow overriding generationConfig via options
                }
            });
        } catch (error) {
            const errorMsg = `Failed to initialize overridden Vertex AI model '${modelIdToUse}': ${error.message}`;
            logError('getVertexAiApiResponse:modelInit', errorMsg, error);
            if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                streamResponseCallback(null, new Error(errorMsg));
                return null;
            }
            throw new Error(errorMsg);
        }
    } else if (generativeModel) {
        // Use the initially configured model
        currentGenerativeModel = generativeModel;
        // If options specify different generation config for the *same* model, re-get it or adjust.
        // For simplicity, if model ID is same, we assume initial genConfig is fine unless overridden by options.generationConfig
        if (options.generationConfig) {
             console.log(`Applying custom generationConfig for model ${currentGenerativeModel.model}`);
             // This creates a new model instance with updated generation config.
             // This is how the underlying SDK seems to work; it doesn't modify in-place.
             try {
                currentGenerativeModel = vertex_ai.getGenerativeModel({
                    model: currentGenerativeModel.model, // existing model ID
                    generationConfig: {
                        ...currentGenerativeModel.generationConfig,
                        ...options.generationConfig
                    }
                });
             } catch (error) {
                const errorMsg = `Failed to apply new generationConfig to Vertex AI model '${currentGenerativeModel.model}': ${error.message}`;
                logError('getVertexAiApiResponse:genConfig', errorMsg, error);
                if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                    streamResponseCallback(null, new Error(errorMsg));
                    return null;
                }
                throw new Error(errorMsg);
             }
        }
    }
    // Else, generativeModel was not initialized during startup.

    if (!currentGenerativeModel) {
        // This case covers if generativeModel was null (startup failure) AND no override was provided,
        // OR if an override was provided but it failed to initialize.
        const errorMsg = `Vertex AI model '${modelIdToUse}' not available. It might not have been initialized correctly at startup or the override failed.`;
        logError('getVertexAiApiResponse:modelNotAvailable', errorMsg, null);
        if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
            streamResponseCallback(null, new Error(errorMsg));
            return null;
        }
        throw new Error(errorMsg);
    }
    console.log(`Using Vertex AI model: ${currentGenerativeModel.model}`);

    // Vertex AI specific logic starts here directly
    let conversationContents = [];
    
    // Initialize finalSystemMessageText with the base systemMessageText if provided.
    let finalSystemMessageText = systemMessageText ? systemMessageText.trim() : "";

    // Augment system prompt based on specialModeType
    if (specialModeType === 'canvas') {
        const canvasSystemPrompt = 
            "중요: 당신은 HTML, CSS, JavaScript 코드를 생성하는 AI입니다. " +
            "사용자의 요청에 따라 웹 페이지의 구조(HTML)와 스타일(CSS)을 제공해야 합니다. " +
            "각 코드는 반드시 마크다운 코드 블록(예: ```html ... ```, ```css ... ```)으로 감싸서 제공해주세요. " +
            "HTML에는 기본적인 구조를 포함하고, CSS는 해당 HTML을 스타일링하는 내용을 포함해야 합니다. " +
            "JavaScript가 필요하다면 그것도 코드 블록으로 제공해주세요. " +
            "만약 사용자가 '캔버스에 그림 그려줘' 같이 모호하게 요청하면, 구체적으로 어떤 그림인지 되묻거나 간단한 예시를 제시할 수 있습니다. " +
            "생성된 코드는 바로 웹페이지에 적용될 수 있도록 완전한 형태로 제공하는 것을 목표로 합니다.";
        finalSystemMessageText = finalSystemMessageText 
            ? `${finalSystemMessageText}\n\n${canvasSystemPrompt}` 
            : canvasSystemPrompt;
        console.log("Canvas mode: System prompt augmented for HTML/CSS/JS code generation.");
    } else if (specialModeType === 'search') {
        const searchSystemPrompt = "Please answer based on web search results if necessary. Provide concise answers with relevant information found.";
        finalSystemMessageText = finalSystemMessageText 
            ? `${finalSystemMessageText}\n${searchSystemPrompt}` 
            : searchSystemPrompt;
        console.log("Search mode: System prompt augmented for search-based concise answers.");
    } else if (specialModeType === 'stream') {
        // For stream mode, typically no major system prompt augmentation is needed by default,
        // unless a specific streaming behavior instruction is desired.
        console.log("Stream mode: System prompt will be used as is or with minimal stream-specific additions if any.");
        // Example for future:
        // const streamEnhancement = "Provide your response in a continuous stream, ensuring each part is a complete thought or sentence if possible.";
        // finalSystemMessageText = finalSystemMessageText 
        //     ? `${finalSystemMessageText}\n${streamEnhancement}` 
        //     : streamEnhancement;
    }

    // Construct the systemInstruction object for Vertex AI API
    // Only include systemInstruction if finalSystemMessageText has content after trimming.
        const systemInstruction = (finalSystemMessageText && finalSystemMessageText.trim() !== '')
            ? { parts: [{ text: finalSystemMessageText.trim() }] } // Ensure trimmed text
            : null;

        if (systemInstruction) {
            console.log("Final System Instruction being sent to Vertex AI:", JSON.stringify(systemInstruction, null, 2));
        }
        
        // 2. Prepare conversation history (ensure it's an array of {role, parts} objects)
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
            maxOutputTokens: 65535, // Default max, can be overridden by options
        };

        // Override maxOutputTokens if a valid value is provided in options
        if (options.max_output_tokens_override !== undefined) {
            const userMaxTokens = parseInt(options.max_output_tokens_override, 10);
            if (!isNaN(userMaxTokens) && userMaxTokens > 0) {
                generationConfig.maxOutputTokens = userMaxTokens;
                console.log(`Overriding maxOutputTokens to: ${userMaxTokens}`);
            } else {
                logError('getVertexAiApiResponse:genConfig', `Invalid max_output_tokens_override: ${options.max_output_tokens_override}. Using default ${generationConfig.maxOutputTokens}.`, null);
                // Keeps the default 65535 or a previously set valid value.
            }
        }
        
        // Construct the final request object for Vertex AI API
        const request = {
            contents: conversationContents,
            systemInstruction: systemInstruction,
            generationConfig: generationConfig 
        };

        console.log('Vertex AI Request (final):', JSON.stringify(request, null, 2));

        try {
            if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                let streamErrorOccurred = false; // Flag to track if an error was sent via callback during streaming
                const streamResult = await currentGenerativeModel.generateContentStream(request);
                for await (const item of streamResult.stream) {
                    if (item && item.candidates && item.candidates[0] && item.candidates[0].content && item.candidates[0].content.parts && item.candidates[0].content.parts.length > 0) {
                        const chunkText = item.candidates[0].content.parts.map(part => part.text).join("");
                        streamResponseCallback(chunkText); // Send content chunk
                    } else {
                        const streamError = new Error('Malformed stream item from Vertex AI');
                        logError('getVertexAiApiResponse:streamError', 'Malformed stream item received during streaming', { item });
                        streamResponseCallback(null, streamError); // Send error via callback
                        streamErrorOccurred = true;
                        break; // Exit the loop on malformed item
                    }
                }
                
                // After the loop, if no error occurred during streaming, signal successful completion.
                if (!streamErrorOccurred) {
                    streamResponseCallback(null, null); // Signal end of successful stream
                }
                return null; // Indicate that the response was handled via streaming
            } else {
                // Non-streaming call
                const result = await currentGenerativeModel.generateContent(request);
                if (result && result.response && result.response.candidates && result.response.candidates.length > 0 &&
                    result.response.candidates[0].content && result.response.candidates[0].content.parts &&
                    result.response.candidates[0].content.parts.length > 0) {
                    const aiResponseText = result.response.candidates[0].content.parts.map(part => part.text).join("");
                    console.log('Vertex AI 응답 (일반):', aiResponseText);
                    const actual_output_tokens = result.response.usageMetadata?.candidatesTokenCount || 0;
                    const input_tokens_processed = result.response.usageMetadata?.promptTokenCount || 0;
                    return { 
                        content: aiResponseText,
                        actual_output_tokens: actual_output_tokens,
                        input_tokens_processed: input_tokens_processed
                    }; 
                } else {
                    const errorMsg = 'Invalid AI response structure from Vertex AI (non-streaming).';
                    logError('getVertexAiApiResponse:invalidResponse', errorMsg, { response: result.response });
                    throw new Error(errorMsg);
                }
            }
        } catch (error) {
            logError('getVertexAiApiResponse:apiCall', 'Vertex AI API call error', error);
            if (error.message && error.message.includes('<!DOCTYPE')) { 
                // These console.errors provide specific debugging info not easily passed to logError's message
                console.error('HTML 응답을 받았습니다. 인증 또는 네트워크 문제일 수 있습니다.');
                console.error('이 오류는 주로 다음 문제로 발생합니다:');
                console.error('1. Google Cloud 인증 정보가 잘못되었거나 만료됨');
                console.error('2. 네트워크/프록시 설정 문제');
                console.error('3. Vertex AI 서비스 접근 권한 부족');
            }
            if (error.response && error.response.data) { // SDK specific error structure
                console.error('오류 응답 데이터 (SDK):', error.response.data);
            }
            try { if (error.response && error.response.body && typeof error.response.body.toString === 'function') { 
                const bodyText = error.response.body.toString();
                console.error('응답 본문 내용 (SDK):', bodyText.substring(0, 500) + '...');
            } } catch (bodyError) { 
                logError('getVertexAiApiResponse:apiCallBodyError', 'Failed to parse error response body', bodyError);
            }

            // Ensure callback for stream or re-throw for non-stream
            if (specialModeType === 'stream' && typeof streamResponseCallback === 'function') {
                // If streamResponseCallback was already called with an error (e.g., inside the loop), this might be redundant.
                // However, this catch block handles errors from currentGenerativeModel.generateContentStream() itself
                // or errors from currentGenerativeModel.generateContent().
                streamResponseCallback(null, error); // Pass the original error
                return null; // Stop further processing for stream
            } else {
                 // For non-streaming errors, or errors setting up the stream.
                 // Wrapping the original error for context.
                 throw new Error(`Vertex AI API call failed: ${error.message}`);
            }
        }
    // Removed the outer 'else if (providerToUse === 'vertexai')' and 'else' blocks
    // as this function is now solely for Vertex AI.
}

module.exports = {
    getVertexAiApiResponse, // Updated function name
    vertex_ai: vertex_ai, // Export the initialized client (or undefined if failed)
    generativeModel: generativeModel // Export the initially configured model (or undefined)
};