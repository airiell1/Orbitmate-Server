/**
 * AI 도구 함수들 (Function Calling)
 * AI가 필요에 따라 호출할 수 있는 도구들을 정의합니다.
 */

const {
  searchWikipedia,
  getWeatherByIP,
  getWeatherByLocation,
} = require("../models/search");

// 코드 실행을 위한 추가 모듈
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * AI가 사용할 수 있는 도구들의 정의
 */
const AI_TOOLS = {
  search_wikipedia: {
    name: "search_wikipedia",
    description:
      "위키피디아에서 정보를 검색합니다. 백과사전적 지식, 역사, 인물, 개념 등을 찾을 때 사용하세요.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색할 키워드나 주제",
        },
        language: {
          type: "string",
          description: "검색 언어 (ko: 한국어, en: 영어)",
          enum: ["ko", "en", "ja", "zh"],
          default: "ko",
        },
        limit: {
          type: "integer",
          description: "검색 결과 개수 (1-10)",
          minimum: 1,
          maximum: 10,
          default: 5,
        },
      },
      required: ["query"],
    },
  },

  get_weather: {
    name: "get_weather",
    description:
      "현재 날씨 정보를 조회합니다. 도시명이 제공되면 해당 도시의 날씨를, 없으면 사용자 IP 기반으로 현재 위치 날씨를 조회합니다.",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "날씨를 조회할 도시명 (예: 서울, Seoul, 도쿄)",
        },
        units: {
          type: "string",
          description: "온도 단위",
          enum: ["metric", "imperial", "kelvin"],
          default: "metric",
        },
        language: {
          type: "string",
          description: "날씨 설명 언어",
          enum: ["ko", "en"],
          default: "ko",
        },
      },
      required: [],
    },
  },

  execute_code: {
    name: "execute_code",
    description: "코드를 실행하고 결과를 반환합니다. Python, JavaScript, SQL 등을 지원합니다. 계산, 데이터 처리, 알고리즘 실행 등에 사용하세요.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "실행할 코드"
        },
        language: {
          type: "string",
          description: "코드 언어",
          enum: ["python", "javascript", "sql", "shell"],
          default: "python"
        },
        timeout: {
          type: "integer",
          description: "실행 제한 시간 (초)",
          minimum: 1,
          maximum: 30,
          default: 10
        }
      },
      required: ["code"]
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
    console.log(
      `[AI Tool] Executing ${toolName} with parameters:`,
      JSON.stringify(parameters, null, 2)
    );
    console.log(`[AI Tool] Context:`, JSON.stringify(context, null, 2));

    switch (toolName) {
      case "search_wikipedia":
        console.log(
          `[AI Tool] Starting Wikipedia search for: "${parameters.query}"`
        );
        const wikiResult = await searchWikipedia(
          parameters.query,
          parameters.limit || 5,
          parameters.language || "ko"
        );

        console.log(
          `[AI Tool] Wikipedia search completed. Found ${
            wikiResult?.length || 0
          } results`
        );
        if (wikiResult?.length > 0) {
          console.log(`[AI Tool] First result:`, {
            title: wikiResult[0].title,
            extract: wikiResult[0].extract?.substring(0, 100) + "...",
          });
        }

        // AI가 이해하기 쉬운 형태로 결과 포맷팅
        const formattedWikiResult = {
          success: true,
          tool: "search_wikipedia",
          query: parameters.query,
          results:
            wikiResult?.map((item) => ({
              title: item.title,
              summary: item.snippet || item.extract,
              url: item.url,
              wordcount: item.wordcount,
            })) || [],
          count: wikiResult?.length || 0,
          source: "Wikipedia",
        };

        console.log(`[AI Tool] Returning formatted Wikipedia result:`, {
          success: formattedWikiResult.success,
          query: formattedWikiResult.query,
          count: formattedWikiResult.count,
        });

        return formattedWikiResult;

      case "get_weather":
        let weatherResult;

        if (parameters.city) {
          // 도시명이 제공된 경우
          weatherResult = await getWeatherByLocation({
            city: parameters.city,
            units: parameters.units || "metric",
            lang: parameters.language || "ko",
          });
        } else {
          // IP 기반 위치 감지
          weatherResult = await getWeatherByIP(
            context.clientIp || "127.0.0.1",
            {
              units: parameters.units || "metric",
              lang: parameters.language || "ko"
            }
          );
        }

        // AI가 이해하기 쉬운 형태로 결과 포맷팅
        return {
          success: true,
          tool: "get_weather",
          location: weatherResult.location,
          current: {
            temperature: weatherResult.current.temperature,
            description: weatherResult.current.description,
            feels_like: weatherResult.current.feels_like,
            humidity: weatherResult.current.humidity,
            wind_speed: weatherResult.current.wind.speed,
            wind_direction: weatherResult.current.wind.direction,
          },
          units: weatherResult.units,
          source: "OpenWeatherMap",
        };

      case "execute_code":
        console.log(`[AI Tool] Executing ${parameters.language || 'python'} code`);
        const codeResult = await executeCode(
          parameters.code,
          parameters.language || 'python',
          parameters.timeout || 10
        );
        
        console.log(`[AI Tool] Code execution completed:`, {
          success: codeResult.success,
          language: codeResult.language,
          outputLength: codeResult.output?.length || 0
        });

        return {
          success: codeResult.success,
          tool: "execute_code",
          language: codeResult.language,
          code: parameters.code,
          output: codeResult.output,
          error: codeResult.error,
          executionTime: codeResult.executionTime,
          source: "Code Executor"
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
      source: "System Error",
    };
  }
}

/**
 * Gemini API용 Function Calling 형식으로 도구 정의 변환
 * @returns {Array} Gemini API Function Calling 형식의 도구 배열
 */
function getGeminiTools() {
  return [
    {
      functionDeclarations: Object.values(AI_TOOLS).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

/**
 * 시스템 프롬프트에 도구 사용법 추가
 * @param {string} originalPrompt - 기존 시스템 프롬프트
 * @returns {string} 도구 사용법이 추가된 시스템 프롬프트
 */
function enhancePromptWithTools(originalPrompt = "") {
  const toolInstructions = `

**사용 가능한 도구들:**
1. search_wikipedia: 위키피디아에서 정보를 검색할 때 사용하세요. 역사, 인물, 개념, 기술 등에 대한 정확한 정보가 필요할 때 활용하세요.
2. get_weather: 날씨 정보가 필요할 때 사용하세요. 도시명을 지정하거나 현재 위치 기반으로 조회할 수 있습니다.
3. execute_code: 코드를 실행하고 결과를 반환할 때 사용하세요. Python, JavaScript, SQL 등의 언어를 지원합니다. 계산, 데이터 처리, 알고리즘 실행, 예제 코드 실행 등에 활용하세요.

**코드 실행기 사용법:**
- Python: 수학 계산, 데이터 분석, 알고리즘 구현 등
- JavaScript: 프론트엔드 로직, JSON 처리, 문자열 조작 등  
- SQL: 데이터베이스 쿼리, 데이터 조작 등 (테스트용 테이블 제공)
- 실행 시간 제한: 10초 (기본값)
- 보안: 파일 시스템 접근, 외부 네트워크, 시스템 명령어 실행 불가

**도구 사용 가이드라인:**
- 사용자가 특정 정보를 요청하거나 질문할 때, 관련 도구를 적극적으로 활용하세요.
- "계산해줘", "코드 실행", "결과 보여줘", "예제 실행" 등의 요청 시 execute_code 도구를 사용하세요.
- "대한민국", "서울", "날씨" 등의 키워드가 나오면 관련 도구를 사용하세요.
- 검색어나 정보 요청이 명확하지 않더라도, 관련성이 있다면 도구를 사용해서 정확한 정보를 제공하세요.
- 검색 결과를 바탕으로 정확하고 유용한 답변을 제공하세요.
- 여러 출처의 정보를 종합하여 균형잡힌 답변을 만드세요.
- 도구 사용 결과를 인용할 때는 출처를 명시하세요.

**중요: 사용자가 "검색", "찾아봐", "알려줘", "무엇인가", "언제", "어디", "누구", "계산", "실행", "코드", "결과" 등의 키워드를 사용하면 관련 도구를 사용하세요.**`;

  return originalPrompt + toolInstructions;
}

/**
 * 코드 실행 함수
 * @param {string} code - 실행할 코드
 * @param {string} language - 코드 언어 (python, javascript, sql, shell)
 * @param {number} timeout - 실행 제한 시간 (초)
 * @returns {Promise<Object>} 실행 결과
 */
async function executeCode(code, language = 'python', timeout = 10) {
  const startTime = Date.now();
  let tempFilePath = null;

  try {
    console.log(`[Code Executor] Starting execution of ${language} code`);
    
    // 보안: 위험한 명령어 체크
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /del\s+\/[sf]/i,
      /format\s+[cd]:/i,
      /shutdown/i,
      /reboot/i,
      /kill/i,
      /import\s+os/i,
      /subprocess/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /file\s*\(/i,
      /open\s*\(/i,
      /__import__/i,
    ];

    if (dangerousPatterns.some(pattern => pattern.test(code))) {
      return {
        success: false,
        language,
        output: null,
        error: "보안상 위험한 코드가 감지되었습니다. 파일 시스템 접근, 시스템 명령어, 외부 프로세스 실행 등은 허용되지 않습니다.",
        executionTime: 0
      };
    }

    // temp 디렉토리 생성
    const tempDir = path.join(__dirname, '../temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // 디렉토리가 이미 존재하는 경우 무시
    }

    // 임시 파일 생성
    const fileId = crypto.randomBytes(8).toString('hex');
    const fileExtension = getFileExtension(language);
    tempFilePath = path.join(tempDir, `temp_${fileId}.${fileExtension}`);

    // 코드 파일 작성
    if (language === 'sql') {
      // SQL의 경우 간단한 메모리 DB 스키마 추가
      const sqlCode = `
-- 테스트용 간단한 테이블 생성
CREATE TABLE IF NOT EXISTS test_table (id INTEGER, name TEXT, value REAL);
INSERT INTO test_table VALUES (1, 'Test1', 10.5);
INSERT INTO test_table VALUES (2, 'Test2', 20.3);
INSERT INTO test_table VALUES (3, 'Test3', 30.7);

-- 사용자 코드 실행
${code}
`;
      await fs.writeFile(tempFilePath, sqlCode);
    } else {
      await fs.writeFile(tempFilePath, code);
    }

    // 실행 명령어 결정
    const command = getExecutionCommand(language, tempFilePath);
    
    console.log(`[Code Executor] Executing command: ${command}`);

    // Promise 기반 코드 실행
    const result = await new Promise((resolve, reject) => {
      const timeoutMs = timeout * 1000;
      let stdout = '';
      let stderr = '';

      const child = spawn(command.cmd, command.args, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs
      });

      // 표준 출력 캡처
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // 에러 출력 캡처
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 프로세스 종료 처리
      child.on('close', (code) => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      // 에러 처리
      child.on('error', (error) => {
        reject(error);
      });

      // 타임아웃 처리
      setTimeout(() => {
        child.kill();
        reject(new Error(`코드 실행이 ${timeout}초 시간 제한을 초과했습니다.`));
      }, timeoutMs);
    });

    const executionTime = Date.now() - startTime;

    // 결과 처리
    if (result.code === 0) {
      return {
        success: true,
        language,
        output: result.stdout || '(출력 없음)',
        error: null,
        executionTime
      };
    } else {
      return {
        success: false,
        language,
        output: result.stdout || null,
        error: result.stderr || `프로세스가 코드 ${result.code}로 종료되었습니다.`,
        executionTime
      };
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[Code Executor] Error:`, error);
    
    return {
      success: false,
      language,
      output: null,
      error: error.message || '알 수 없는 오류가 발생했습니다.',
      executionTime
    };
  } finally {
    // 임시 파일 정리
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log(`[Code Executor] Cleaned up temp file: ${tempFilePath}`);
      } catch (err) {
        console.warn(`[Code Executor] Failed to clean up temp file: ${tempFilePath}`, err);
      }
    }
  }
}

/**
 * 언어별 파일 확장자 반환
 */
function getFileExtension(language) {
  switch (language.toLowerCase()) {
    case 'python': return 'py';
    case 'javascript': return 'js';
    case 'sql': return 'sql';
    case 'shell': return 'bat';
    default: return 'txt';
  }
}

/**
 * 언어별 실행 명령어 반환
 */
function getExecutionCommand(language, filePath) {
  switch (language.toLowerCase()) {
    case 'python':
      return { cmd: 'python', args: [filePath] };
    case 'javascript':
      return { cmd: 'node', args: [filePath] };
    case 'sql':
      return { cmd: 'sqlite3', args: [':memory:', '.read', filePath] };
    case 'shell':
      return { cmd: 'cmd', args: ['/c', filePath] };
    default:
      throw new Error(`지원하지 않는 언어입니다: ${language}`);
  }
}

module.exports = {
  AI_TOOLS,
  executeAiTool,
  getGeminiTools,
  enhancePromptWithTools,
  executeCode, // 코드 실행 함수도 export
};
