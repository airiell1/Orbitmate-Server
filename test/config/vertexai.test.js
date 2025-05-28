const { VertexAI } = require('@google-cloud/vertexai');
const { logError } = require('../../utils/errorHandler');

// Mock the entire @google-cloud/vertexai module
jest.mock('@google-cloud/vertexai');
// Mock the errorHandler utility
jest.mock('../../utils/errorHandler');

// Store original process.env
const originalEnv = { ...process.env };

describe('getVertexAiApiResponse', () => {
  let mockGenerateContent;
  let mockGenerateContentStream;
  let mockGetGenerativeModel;
  let getVertexAiApiResponse; // To load the module after mocks are set up

  const currentUserMessage = 'Test user message';
  const history = [{ role: 'user', parts: [{ text: 'Old message' }] }];

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Setup fresh mocks for each test
    mockGenerateContent = jest.fn();
    mockGenerateContentStream = jest.fn();

    mockGetGenerativeModel = jest.fn(() => ({
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
      model: 'gemini-pro-mocked', // Mocked model name
      generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 2048 }, // Mocked base config
    }));

    VertexAI.mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    }));

    // Reset modules to ensure mocks are picked up and module-level variables are re-initialized
    jest.resetModules();
    // Configure GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_PROJECT_ID for the module to initialize vertex_ai
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'mock-credentials.json';
    process.env.GOOGLE_PROJECT_ID = 'mock-project-id';
    process.env.VERTEX_AI_MODEL = 'gemini-1.0-pro-test'; // Default model for tests

    getVertexAiApiResponse = require('../../config/vertexai').getVertexAiApiResponse;
    
    logError.mockClear();
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Successful Calls', () => {
    it('should return a correctly formatted response for a successful non-streaming call', async () => {
      const mockApiResponse = {
        response: {
          candidates: [{
            content: { parts: [{ text: 'AI response text' }] },
          }],
          usageMetadata: { candidatesTokenCount: 10, promptTokenCount: 5 },
        },
      };
      mockGenerateContent.mockResolvedValue(mockApiResponse);

      const response = await getVertexAiApiResponse(currentUserMessage, history);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(response).toEqual({
        content: 'AI response text',
        actual_output_tokens: 10,
        input_tokens_processed: 5,
      });
    });

    it('should call streamResponseCallback with text chunks for a successful streaming call', async () => {
      const mockStream = (async function* () {
        yield { candidates: [{ content: { parts: [{ text: 'Chunk 1' }] } }] };
        yield { candidates: [{ content: { parts: [{ text: 'Chunk 2' }] } }] };
      })();
      mockGenerateContentStream.mockResolvedValue({ stream: mockStream });
      const streamResponseCallback = jest.fn();

      await getVertexAiApiResponse(currentUserMessage, history, null, 'stream', streamResponseCallback);

      expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
      expect(streamResponseCallback).toHaveBeenCalledWith('Chunk 1');
      expect(streamResponseCallback).toHaveBeenCalledWith('Chunk 2');
      expect(streamResponseCallback).toHaveBeenCalledWith(null, null); // Signal successful end
      expect(streamResponseCallback).toHaveBeenCalledTimes(3); // 2 chunks + 1 success signal
    });
  });

  describe('API Errors', () => {
    it('should throw an error for a non-streaming API call failure', async () => {
      const apiError = new Error('Vertex API Error');
      mockGenerateContent.mockRejectedValue(apiError);

      await expect(getVertexAiApiResponse(currentUserMessage, history))
        .rejects.toThrow('Vertex AI API call failed: Vertex API Error');
      expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:apiCall', 'Vertex AI API call error', apiError);
    });

    it('should call streamResponseCallback with an error for a streaming API call failure', async () => {
      const apiError = new Error('Vertex Stream API Error');
      mockGenerateContentStream.mockRejectedValue(apiError);
      const streamResponseCallback = jest.fn();

      const result = await getVertexAiApiResponse(currentUserMessage, history, null, 'stream', streamResponseCallback);

      expect(result).toBeNull();
      expect(streamResponseCallback).toHaveBeenCalledWith(null, apiError);
      expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:apiCall', 'Vertex AI API call error', apiError);
    });
  });

  describe('Malformed Responses/Stream Items', () => {
    it('should throw an error for a malformed non-streaming API response', async () => {
      mockGenerateContent.mockResolvedValue({ response: { candidates: [] } }); // Invalid structure

      await expect(getVertexAiApiResponse(currentUserMessage, history))
        .rejects.toThrow('Invalid AI response structure from Vertex AI (non-streaming).');
      expect(logError).toHaveBeenCalledWith(
        'getVertexAiApiResponse:invalidResponse',
        'Invalid AI response structure from Vertex AI (non-streaming).',
        { response: { candidates: [] } }
      );
    });

    it('should call streamResponseCallback with an error for a malformed stream item', async () => {
      const mockStream = (async function* () {
        yield { candidates: [{ content: { parts: [{ text: 'Good chunk' }] } }] };
        yield { malformed_item: true }; // Invalid structure
      })();
      mockGenerateContentStream.mockResolvedValue({ stream: mockStream });
      const streamResponseCallback = jest.fn();

      await getVertexAiApiResponse(currentUserMessage, history, null, 'stream', streamResponseCallback);

      expect(streamResponseCallback).toHaveBeenCalledWith('Good chunk');
      expect(streamResponseCallback).toHaveBeenCalledWith(null, expect.any(Error));
      expect(streamResponseCallback.mock.calls[1][1].message).toBe('Malformed stream item from Vertex AI');
      expect(logError).toHaveBeenCalledWith(
        'getVertexAiApiResponse:streamError',
        'Malformed stream item received during streaming',
        { item: { malformed_item: true } }
      );
      // Check that successful end signal (null,null) was NOT called after error.
      expect(streamResponseCallback).not.toHaveBeenCalledWith(null, null);
    });
  });

  describe('Initialization and Configuration Errors', () => {
    it('should throw if vertex_ai client is not initialized (e.g. missing credentials)', async () => {
        jest.resetModules(); // Reset modules to clear vertex_ai instance
        process.env.GOOGLE_APPLICATION_CREDENTIALS = ''; // Remove credentials
        getVertexAiApiResponse = require('../../config/vertexai').getVertexAiApiResponse;

        await expect(getVertexAiApiResponse(currentUserMessage, history))
            .rejects.toThrow('Vertex AI client not initialized. Check GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
        expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:init', 'Vertex AI client not initialized. Check GOOGLE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.', null);
    });
    
    it('should throw if generativeModel is not available and no override is provided', async () => {
        // Simulate generativeModel failing to initialize at startup
        VertexAI.mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockImplementation(() => {
                // Simulate the initial generativeModel failing by having the constructor for it throw
                if (mockGetGenerativeModel.mock.calls.length <= 1) { // Only fail for the initial call
                     throw new Error("Initial model load failed");
                }
                // Subsequent calls for overrides should work for this test case if needed, but we are testing no override
                return { generateContent: jest.fn(), generateContentStream: jest.fn(), model:'fallback-model' };
            })
        }));

        jest.resetModules();
        process.env.GOOGLE_APPLICATION_CREDENTIALS = 'mock-credentials.json';
        process.env.GOOGLE_PROJECT_ID = 'mock-project-id';
        getVertexAiApiResponse = require('../../config/vertexai').getVertexAiApiResponse;
        
        // Expect startup logError for the failed initial model load
        expect(logError).toHaveBeenCalledWith('vertexAiConfig:startup', 'Failed to initialize Vertex AI client or model during startup', expect.any(Error));

        await expect(getVertexAiApiResponse(currentUserMessage, history, null, null, null, {})) // No model_id_override
            .rejects.toThrow(/Vertex AI model 'gemini-1.0-pro-test' not available/);
        expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:modelNotAvailable', expect.stringContaining("not available"), null);
    });


    it('should throw if model_id_override fails to initialize', async () => {
        mockGetGenerativeModel.mockImplementation(({ model }) => {
            if (model === 'fail-this-model') {
                throw new Error('Failed to get overridden model');
            }
            return { generateContent: mockGenerateContent, generateContentStream: mockGenerateContentStream, model: model };
        });
        
        const options = { model_id_override: 'fail-this-model' };
        await expect(getVertexAiApiResponse(currentUserMessage, history, null, null, null, options))
            .rejects.toThrow("Failed to initialize overridden Vertex AI model 'fail-this-model': Failed to get overridden model");
        expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:modelInit', expect.stringContaining("Failed to initialize overridden Vertex AI model 'fail-this-model'"), expect.any(Error));
    });
  });

  describe('System Prompt and Special Mode Handling', () => {
    it('should correctly form systemInstruction for "canvas" mode', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: 'Canvas response' }] } }], usageMetadata: {} },
      });
      const systemPrompt = 'Base prompt.';
      await getVertexAiApiResponse(currentUserMessage, history, systemPrompt, 'canvas', null);

      const sentRequest = mockGenerateContent.mock.calls[0][0];
      expect(sentRequest.systemInstruction.parts[0].text).toContain('Base prompt.');
      expect(sentRequest.systemInstruction.parts[0].text).toContain('중요: 당신은 HTML, CSS, JavaScript 코드를 생성하는 AI입니다.');
    });

    it('should correctly form systemInstruction for "search" mode', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: 'Search response' }] } }], usageMetadata: {} },
      });
      const systemPrompt = 'User query details.';
      await getVertexAiApiResponse(currentUserMessage, history, systemPrompt, 'search', null);

      const sentRequest = mockGenerateContent.mock.calls[0][0];
      expect(sentRequest.systemInstruction.parts[0].text).toContain('User query details.');
      expect(sentRequest.systemInstruction.parts[0].text).toContain('Please answer based on web search results if necessary.');
    });
    
    it('should pass systemPrompt as is if no special mode implies augmentation', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: 'Normal response' }] } }], usageMetadata: {} },
      });
      const systemPrompt = 'Just be a regular AI.';
      await getVertexAiApiResponse(currentUserMessage, history, systemPrompt, null, null); // No special mode

      const sentRequest = mockGenerateContent.mock.calls[0][0];
      expect(sentRequest.systemInstruction.parts[0].text).toBe('Just be a regular AI.');
    });

     it('should handle null systemPrompt correctly', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: 'Response' }] } }], usageMetadata: {} },
      });
      await getVertexAiApiResponse(currentUserMessage, history, null, null, null);
      const sentRequest = mockGenerateContent.mock.calls[0][0];
      expect(sentRequest.systemInstruction).toBeNull();
    });
  });

  describe('max_output_tokens_override', () => {
    it('should set generationConfig.maxOutputTokens when options.max_output_tokens_override is valid', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: '' }] } }], usageMetadata: {} },
      });
      const options = { max_output_tokens_override: 1024 };
      await getVertexAiApiResponse(currentUserMessage, history, null, null, null, options);

      const sentRequest = mockGenerateContent.mock.calls[0][0];
      expect(sentRequest.generationConfig.maxOutputTokens).toBe(1024);
    });

    it('should use default maxOutputTokens if options.max_output_tokens_override is invalid (e.g., string)', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: '' }] } }], usageMetadata: {} },
      });
      const options = { max_output_tokens_override: 'invalid-token-value' };
      await getVertexAiApiResponse(currentUserMessage, history, null, null, null, options);

      const sentRequest = mockGenerateContent.mock.calls[0][0];
      // The default from the mocked generativeModel.generationConfig is 2048, but the code has its own default of 65535
      // and a fallback of 8192 if parseInt fails.
      expect(sentRequest.generationConfig.maxOutputTokens).toBe(8192); 
      expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:genConfig', 'Invalid max_output_tokens_override: invalid-token-value. Using default 8192.', null);
    });

    it('should use default maxOutputTokens if options.max_output_tokens_override is zero or negative', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { candidates: [{ content: { parts: [{ text: '' }] } }], usageMetadata: {} },
      });
      const options = { max_output_tokens_override: 0 };
      await getVertexAiApiResponse(currentUserMessage, history, null, null, null, options);
      
      const sentRequest = mockGenerateContent.mock.calls[0][0];
      expect(sentRequest.generationConfig.maxOutputTokens).toBe(8192);
      expect(logError).toHaveBeenCalledWith('getVertexAiApiResponse:genConfig', 'Invalid max_output_tokens_override: 0. Using default 8192.', null);
    });
  });
});
