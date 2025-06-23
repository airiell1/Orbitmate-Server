// controllers/aiInfoController.js
const { standardizeApiResponse } = require("../utils/apiResponse");
const {
  createErrorResponse,
  getHttpStatusByErrorCode,
  logError,
} = require("../utils/errorHandler");

async function getModelsInfoController(req, res) {
  try {
    const defaultProvider = process.env.DEFAULT_AI_PROVIDER || "geminiapi"; // Default to 'geminiapi' if not set
    const defaultOllamaModel = process.env.OLLAMA_MODEL || "gemma3:4b"; // Example if Ollama has submodels
    const defaultVertexModel =
      process.env.VERTEX_AI_MODEL || "gemini-2.5-pro-exp-03-25";
    const defaultGeminiModel =
      process.env.GEMINI_MODEL || "gemini-2.0-flash-thinking-exp-01-21";

    const models = [
      {
        provider: "geminiapi",
        id: defaultGeminiModel,
        name: `Google AI Studio (${defaultGeminiModel})`, // Display name
        max_input_tokens: 1048576,
        max_output_tokens: 8192,
        is_default: defaultProvider === "geminiapi",
      },
      {
        provider: "ollama",
        id: defaultOllamaModel, // This might need to be more dynamic if multiple Ollama models are selectable
        name: `Ollama (${defaultOllamaModel})`, // Display name
        max_input_tokens: 128000, // Example for a common Ollama model size, can be refined
        max_output_tokens: 8192,
        is_default: defaultProvider === "ollama",
      },
      {
        provider: "vertexai",
        id: defaultVertexModel,
        name: `Vertex AI (${defaultVertexModel})`, // Display name
        max_input_tokens: 1048576,
        max_output_tokens: 65535,
        is_default: defaultProvider === "vertexai",
      },
      // Add more Ollama models here if they are selectable by the user eventually
      // e.g., { provider: 'ollama', id: 'codellama', name: 'Ollama CodeLlama', ... }
    ];

    // Return standardized response without nesting under 'data'
    res.status(200).json(standardizeApiResponse(models));
  } catch (err) {
    logError("aiInfoController", err);
    const errorPayload = createErrorResponse(
      "SERVER_ERROR",
      `AI 모델 정보 조회 중 오류 발생: ${err.message}`
    );
    res
      .status(getHttpStatusByErrorCode("SERVER_ERROR"))
      .json(standardizeApiResponse(errorPayload));
  }
}

module.exports = {
  getModelsInfoController,
};
