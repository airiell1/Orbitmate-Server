/**
 * AI Provider selection and request logic utility.
 */

// Import the correctly named function from vertexai.js
const { getVertexAiApiResponse } = require('../config/vertexai'); 
const { getOllamaResponse } = require('../config/ollama');

/**
 * Fetches a chat completion from the specified AI provider.
 * @param {string} aiProvider - The AI provider to use ('vertexai' or 'ollama'). Defaults to 'vertexai'.
 * @param {string} currentUserMessage - The current user's message.
 * @param {Array} history - The conversation history.
 * @param {string|null} systemMessageText - The system prompt text.
 * @param {string|null} specialModeType - Special mode type ('stream', 'canvas', etc.).
 * @param {function|null} streamResponseCallback - Callback for streaming responses.
 * @param {Object} options - Additional options for the AI provider.
 * @param {string} [options.ollamaModel='gemma3:4b'] - Model name to use if provider is 'ollama'.
 * @param {string} [options.vertexModelId=undefined] - Model ID to use for Vertex AI (overrides default in getVertexAiApiResponse).
 * @param {number} [options.maxOutputTokens=undefined] - Max output tokens to request from the model.
 * @returns {Promise<Object|null>} The AI response object, or null if streaming.
 * @throws {Error} If an unsupported AI provider is specified.
 */
async function fetchChatCompletion(
  aiProvider = 'ollama', // Default provider
  currentUserMessage,
  history = [],
  systemMessageText = null,
  specialModeType = null,
  streamResponseCallback = null,
  options = {} // Added options parameter
) {
  // Consolidate model selection for logging. Ollama uses options.ollamaModel, Vertex uses options.vertexModelId or its internal default.
  const modelToLog = aiProvider === 'vertexai' 
    ? (options.ollamaModel || 'gemma3:4b') // Default Ollama model if not specified in options
    : (options.vertexModelId || `Vertex AI default (${process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25'})`);
  console.log(`[aiProviderUtils] Requesting chat completion. Provider: ${aiProvider}, Model: ${modelToLog}`);

  // Prepare options for Vertex AI, separating Ollama-specific ones.
  const vertexOptions = { ...options };
  delete vertexOptions.ollamaModel; // Remove ollamaModel if it exists in options for Vertex call

  if (aiProvider === 'vertexai') {
    console.log(`[aiProviderUtils] Using Vertex AI provider.`);
    // Pass relevant options to getVertexAiApiResponse
    return await getVertexAiApiResponse(
      currentUserMessage,
      history,
      systemMessageText,
      specialModeType,
      streamResponseCallback,
      vertexOptions // Pass the filtered options object
    );
  } else if (aiProvider === 'ollama') {
    const ollamaModelToUse = options.ollamaModel || 'gemma3:4b'; // Default if not provided in options
    console.log(`[aiProviderUtils] Using Ollama provider with model: ${ollamaModelToUse}`);
    // Note: getOllamaResponse might also need an options parameter if it needs to handle maxOutputTokens etc.
    // For now, assuming it takes ollamaModel directly as its first argument.
    return await getOllamaResponse(
      ollamaModelToUse,
      currentUserMessage,
      history,
      systemMessageText,
      specialModeType === 'stream' ? streamResponseCallback : null,
      options // Pass through options to Ollama in case it can use them (e.g. max_output_tokens)
    );
  } else {
    console.error(`[aiProviderUtils] Unsupported AI provider: ${aiProvider}`);
    throw new Error(`Unsupported AI provider: ${aiProvider}. Must be 'vertexai' or 'ollama'.`);
  }
}

module.exports = {
  fetchChatCompletion // Export the renamed function
};
