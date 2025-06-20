/**
 * AI 도구 함수들 (Function Calling)
 * AI가 필요에 따라 호출할 수 있는 도구들을 정의합니다.
 */

const { searchWikipedia, getWeatherByIP, getWeatherByLocation } = require('../models/search');

/**
 * AI가 사용할 수 있는 도구들의 정의
 */
const AI_TOOLS = {
  search_wikipedia: {
    name: "search_wikipedia",
    description: "위키피디아에서 정보를 검색합니다. 백과사전적 지식, 역사, 인물, 개념 등을 찾을 때 사용하세요.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색할 키워드나 주제"
        },
        language: {
          type: "string",
          description: "검색 언어 (ko: 한국어, en: 영어)",
          enum: ["ko", "en", "ja", "zh"],
          default: "ko"
        },
        limit: {
          type: "integer",
          description: "검색 결과 개수 (1-10)",
          minimum: 1,
          maximum: 10,
          default: 5
        }
      },
      required: ["query"]
    }
  },
  
  get_weather: {
    name: "get_weather",
    description: "현재 날씨 정보를 조회합니다. 도시명이 제공되면 해당 도시의 날씨를, 없으면 사용자 IP 기반으로 현재 위치 날씨를 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "날씨를 조회할 도시명 (예: 서울, Seoul, 도쿄)"
        },
        units: {
          type: "string",
          description: "온도 단위",
          enum: ["metric", "imperial", "kelvin"],
          default: "metric"
        },
        language: {
          type: "string",
          description: "날씨 설명 언어",
          enum: ["ko", "en"],
          default: "ko"
        }
      },
      required: []
    }
  }
};

/**
 * AI 도구 실행 함수
 * @param {string} toolName - 실행할 도구 이름
 * @param {Object} parameters - 도구 실행에 필요한 매개변수
 * @param {Object} context - 요청 컨텍스트 (IP 주소 등)
 * @returns {Promise<Object>} 도구 실행 결과
 */
async function executeAiTool(toolName, parameters, context = {}) {
  try {
    console.log(`[AI Tool] Executing ${toolName} with parameters:`, JSON.stringify(parameters, null, 2));
    console.log(`[AI Tool] Context:`, JSON.stringify(context, null, 2));

    switch (toolName) {      case 'search_wikipedia':
        console.log(`[AI Tool] Starting Wikipedia search for: "${parameters.query}"`);
        const wikiResult = await searchWikipedia(
          parameters.query,
          parameters.limit || 5,
          parameters.language || 'ko'
        );
        
        console.log(`[AI Tool] Wikipedia search completed. Found ${wikiResult?.length || 0} results`);
        if (wikiResult?.length > 0) {
          console.log(`[AI Tool] First result:`, {
            title: wikiResult[0].title,
            extract: wikiResult[0].extract?.substring(0, 100) + '...'
          });
        }
        
        // AI가 이해하기 쉬운 형태로 결과 포맷팅
        const formattedWikiResult = {
          success: true,
          tool: 'search_wikipedia',
          query: parameters.query,
          results: wikiResult?.map(item => ({
            title: item.title,
            summary: item.snippet || item.extract,
            url: item.url,
            wordcount: item.wordcount
          })) || [],
          count: wikiResult?.length || 0,
          source: 'Wikipedia'
        };
        
        console.log(`[AI Tool] Returning formatted Wikipedia result:`, {
          success: formattedWikiResult.success,
          query: formattedWikiResult.query,
          count: formattedWikiResult.count
        });
        
        return formattedWikiResult;

      case 'get_weather':
        let weatherResult;
        
        if (parameters.city) {
          // 도시명이 제공된 경우
          weatherResult = await getWeatherByLocation({
            city: parameters.city,
            units: parameters.units || 'metric',
            lang: parameters.language || 'ko'
          });
        } else {
          // IP 기반 위치 감지
          weatherResult = await getWeatherByIP(
            context.clientIp || '127.0.0.1',
            parameters.units || 'metric',
            parameters.language || 'ko'
          );
        }

        // AI가 이해하기 쉬운 형태로 결과 포맷팅
        return {
          success: true,
          tool: 'get_weather',
          location: weatherResult.location,
          current: {
            temperature: weatherResult.current.temperature,
            description: weatherResult.current.description,
            feels_like: weatherResult.current.feels_like,
            humidity: weatherResult.current.humidity,
            wind_speed: weatherResult.current.wind.speed,
            wind_direction: weatherResult.current.wind.direction
          },
          units: weatherResult.units,
          source: 'OpenWeatherMap'
        };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`[AI Tool] Error executing ${toolName}:`, error);
    return {
      success: false,
      tool: toolName,
      error: error.message,
      source: 'System Error'
    };
  }
}

/**
 * Gemini API용 Function Calling 형식으로 도구 정의 변환
 * @returns {Array} Gemini API Function Calling 형식의 도구 배열
 */
function getGeminiTools() {
  return [{
    functionDeclarations: Object.values(AI_TOOLS).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))
  }];
}

/**
 * 시스템 프롬프트에 도구 사용법 추가
 * @param {string} originalPrompt - 기존 시스템 프롬프트
 * @returns {string} 도구 사용법이 추가된 시스템 프롬프트
 */
function enhancePromptWithTools(originalPrompt = '') {
  const toolInstructions = `

**사용 가능한 도구들:**
1. search_wikipedia: 위키피디아에서 정보를 검색할 때 사용하세요. 역사, 인물, 개념, 기술 등에 대한 정확한 정보가 필요할 때 활용하세요.
2. get_weather: 날씨 정보가 필요할 때 사용하세요. 도시명을 지정하거나 현재 위치 기반으로 조회할 수 있습니다.

**도구 사용 가이드라인:**
- 사용자가 특정 정보를 요청하거나 질문할 때, 관련 도구를 적극적으로 활용하세요.
- "인공지능", "대한민국", "서울", "날씨" 등의 키워드가 나오면 반드시 해당 도구를 사용하세요.
- 검색어나 정보 요청이 명확하지 않더라도, 관련성이 있다면 도구를 사용해서 정확한 정보를 제공하세요.
- 검색 결과를 바탕으로 정확하고 유용한 답변을 제공하세요.
- 여러 출처의 정보를 종합하여 균형잡힌 답변을 만드세요.
- 도구 사용 결과를 인용할 때는 출처를 명시하세요.

**중요: 사용자가 "검색", "찾아봐", "알려줘", "무엇인가", "언제", "어디", "누구" 등의 질문을 하면 반드시 관련 도구를 사용하세요.**`;

  return originalPrompt + toolInstructions;
}

module.exports = {
  AI_TOOLS,
  executeAiTool,
  getGeminiTools,
  enhancePromptWithTools
};
