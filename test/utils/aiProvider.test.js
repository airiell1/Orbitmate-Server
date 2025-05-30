// Mock dependencies
jest.mock('../../config/vertexai', () => ({
  getVertexAiApiResponse: jest.fn(),
}));
jest.mock('../../config/ollama', () => ({
  getOllamaResponse: jest.fn(),
}));

const { fetchChatCompletion } = require('../../utils/aiProvider');
const { getVertexAiApiResponse } = require('../../config/vertexai');
const { getOllamaResponse } = require('../../config/ollama');

describe('fetchChatCompletion', () => {
  const currentUserMessage = 'Hello, AI!';
  const history = [{ role: 'user', parts: [{ text: 'Previous message' }] }];
  const systemMessageText = 'Be a helpful assistant.';
  const streamResponseCallback = jest.fn();

  beforeEach(() => {
    // Clear mock calls and implementations before each test
    getVertexAiApiResponse.mockClear();
    getOllamaResponse.mockClear();
    streamResponseCallback.mockClear();
  });

  describe('Vertex AI Dispatch', () => {
    it('should call getVertexAiApiResponse when aiProvider is "vertexai"', async () => {
      const mockResponse = { content: 'Vertex AI response' };
      getVertexAiApiResponse.mockResolvedValue(mockResponse);

      const options = { model_id_override: 'gemini-2.5-pro-exp-03-25', max_output_tokens_override: 1000 };
      const result = await fetchChatCompletion(
        'vertexai',
        currentUserMessage,
        history,
        systemMessageText,
        null,
        null,
        options
      );

      expect(getVertexAiApiResponse).toHaveBeenCalledTimes(1);
      expect(getVertexAiApiResponse).toHaveBeenCalledWith(
        currentUserMessage,
        history,
        systemMessageText,
        null,
        null,
        expect.objectContaining({
          model_id_override: 'gemini-2.5-pro-exp-03-25',
          max_output_tokens_override: 1000,
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should default to "vertexai" if aiProvider is not provided', async () => {
      const mockResponse = { content: 'Default Vertex AI response' };
      getVertexAiApiResponse.mockResolvedValue(mockResponse);
      
      // process.env.VERTEX_AI_MODEL needs to be set for the default model logging in fetchChatCompletion
      process.env.VERTEX_AI_MODEL = 'gemini-default';


      await fetchChatCompletion(
        undefined, // aiProvider is undefined
        currentUserMessage,
        history,
        systemMessageText
      );

      expect(getVertexAiApiResponse).toHaveBeenCalledTimes(1);
      expect(getVertexAiApiResponse).toHaveBeenCalledWith(
        currentUserMessage,
        history,
        systemMessageText,
        null, // specialModeType
        null, // streamResponseCallback
        expect.any(Object) // options
      );
       delete process.env.VERTEX_AI_MODEL; // Clean up env var
    });
  });

  describe('Ollama Dispatch', () => {
    it('should call getOllamaResponse when aiProvider is "ollama"', async () => {
      const mockResponse = { content: 'Ollama response' };
      getOllamaResponse.mockResolvedValue(mockResponse);

      const options = { ollamaModel: 'llama3-custom', max_output_tokens_override: 500 };
      const result = await fetchChatCompletion(
        'ollama',
        currentUserMessage,
        history,
        systemMessageText,
        'stream',
        streamResponseCallback,
        options
      );

      expect(getOllamaResponse).toHaveBeenCalledTimes(1);
      expect(getOllamaResponse).toHaveBeenCalledWith(
        'llama3-custom',
        currentUserMessage,
        history,
        systemMessageText,
        streamResponseCallback, // Stream callback passed directly
        expect.objectContaining({
            ollamaModel: 'llama3-custom',
            max_output_tokens_override: 500
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default ollamaModel if not provided in options for ollama provider', async () => {
        getOllamaResponse.mockResolvedValue({ content: 'Ollama default model response'});
        await fetchChatCompletion(
            'ollama',
            currentUserMessage,
            history,
            systemMessageText,
            null,
            null,
            {} // Empty options
        );
        expect(getOllamaResponse).toHaveBeenCalledWith(
            'gemma3:4b', // Default model defined in fetchChatCompletion
            currentUserMessage,
            history,
            systemMessageText,
            null,
            expect.any(Object)
        );
    });
  });

  describe('Unsupported Provider', () => {
    it('should throw an error for an unsupported aiProvider', async () => {
      await expect(
        fetchChatCompletion(
          'unsupported_provider',
          currentUserMessage,
          history,
          systemMessageText
        )
      ).rejects.toThrow('Unsupported AI provider: unsupported_provider. Must be \'vertexai\' or \'ollama\'.');
      expect(getVertexAiApiResponse).not.toHaveBeenCalled();
      expect(getOllamaResponse).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Passing (Options)', () => {
    it('should correctly pass options.model_id_override and options.max_output_tokens_override to Vertex AI', async () => {
      getVertexAiApiResponse.mockResolvedValue({});
      const options = { model_id_override: 'vertex-model-test', max_output_tokens_override: 1234 };
      
      await fetchChatCompletion(
        'vertexai',
        currentUserMessage,
        history,
        systemMessageText,
        null,
        null,
        options
      );

      expect(getVertexAiApiResponse).toHaveBeenCalledWith(
        currentUserMessage,
        history,
        systemMessageText,
        null,
        null,
        expect.objectContaining({
          model_id_override: 'vertex-model-test',
          max_output_tokens_override: 1234,
        })
      );
    });

    it('should correctly pass options.ollamaModel to Ollama provider', async () => {
      getOllamaResponse.mockResolvedValue({});
      const options = { ollamaModel: 'ollama-model-test', unrelatedOption: 'test' };

      await fetchChatCompletion(
        'ollama',
        currentUserMessage,
        history,
        systemMessageText,
        null,
        null,
        options
      );

      expect(getOllamaResponse).toHaveBeenCalledWith(
        'ollama-model-test',
        currentUserMessage,
        history,
        systemMessageText,
        null,
        expect.objectContaining({
            ollamaModel: 'ollama-model-test',
            unrelatedOption: 'test'
        })
      );
    });

    it('Vertex AI call should not receive ollamaModel in its options', async () => {
        getVertexAiApiResponse.mockResolvedValue({});
        const options = { model_id_override: 'vertex-model', ollamaModel: 'should-be-filtered' };
        
        await fetchChatCompletion(
            'vertexai',
            currentUserMessage,
            history,
            systemMessageText,
            null,
            null,
            options
        );

        const calledWithOptions = getVertexAiApiResponse.mock.calls[0][5];
        expect(calledWithOptions).toBeDefined();
        expect(calledWithOptions.ollamaModel).toBeUndefined();
        expect(calledWithOptions.model_id_override).toBe('vertex-model');
    });
  });
});
