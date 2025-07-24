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
    description: "코드를 실행하고 결과를 반환합니다. Python, JavaScript, shell 등을 지원합니다. 계산, 데이터 처리, 알고리즘 실행 등에 사용하세요.",
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
          enum: ["python", "javascript", "shell"],
          default: "python"
        },
        timeout: {
          type: "integer",
          description: "실행 제한 시간 (초)",
          minimum: 1,
          maximum: 60,
          default: 10
        }
      },
      required: ["code"]
    }
  }
};

/**
 * AI 도구 실행 함수 (단일 도구)
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
 * AI 도구 병렬 실행 함수 (여러 도구 동시 실행)
 * 
 * 사용 예시:
 * const toolCalls = [
 *   { toolName: 'search_wikipedia', parameters: { query: '인공지능' } },
 *   { toolName: 'get_weather', parameters: { city: '서울' } },
 *   { toolName: 'execute_code', parameters: { code: 'print("Hello")', language: 'python' } }
 * ];
 * const results = await executeMultipleAiTools(toolCalls, context);
 * 
 * @param {Array} toolCalls - 실행할 도구들의 배열 [{toolName, parameters}, ...]
 * @param {Object} context - 요청 컨텍스트 (IP 주소 등)
 * @returns {Promise<Array>} 도구 실행 결과 배열
 */
async function executeMultipleAiTools(toolCalls, context = {}) {
  console.log(`[AI Tool] Executing ${toolCalls.length} tools in parallel`);
  
  try {
    // 모든 도구를 병렬로 실행
    const promises = toolCalls.map((toolCall, index) => {
      const { toolName, parameters } = toolCall;
      console.log(`[AI Tool] Starting parallel execution ${index + 1}/${toolCalls.length}: ${toolName}`);
      
      return executeAiTool(toolName, parameters, context)
        .then(result => ({
          index,
          toolName,
          success: true,
          result
        }))
        .catch(error => ({
          index,
          toolName,
          success: false,
          error: error.message
        }));
    });

    // 모든 결과 대기
    const results = await Promise.all(promises);
    
    console.log(`[AI Tool] Parallel execution completed. ${results.length} results ready`);
    
    return results.map(item => ({
      toolName: item.toolName,
      success: item.success,
      result: item.success ? item.result : null,
      error: item.success ? null : item.error
    }));
    
  } catch (error) {
    console.error(`[AI Tool] Error in parallel execution:`, error);
    return toolCalls.map(toolCall => ({
      toolName: toolCall.toolName,
      success: false,
      result: null,
      error: 'Parallel execution failed'
    }));
  }
}

/**
 * AI 도구 순차 실행 함수 (여러 도구 순서대로 실행)
 * @param {Array} toolCalls - 실행할 도구들의 배열 [{toolName, parameters}, ...]
 * @param {Object} context - 요청 컨텍스트 (IP 주소 등)
 * @returns {Promise<Array>} 도구 실행 결과 배열
 */
async function executeSequentialAiTools(toolCalls, context = {}) {
  console.log(`[AI Tool] Executing ${toolCalls.length} tools sequentially`);
  
  const results = [];
  
  for (let i = 0; i < toolCalls.length; i++) {
    const { toolName, parameters } = toolCalls[i];
    console.log(`[AI Tool] Sequential execution ${i + 1}/${toolCalls.length}: ${toolName}`);
    
    try {
      const result = await executeAiTool(toolName, parameters, context);
      results.push({
        toolName,
        success: true,
        result,
        error: null
      });
    } catch (error) {
      console.error(`[AI Tool] Error in sequential execution of ${toolName}:`, error);
      results.push({
        toolName,
        success: false,
        result: null,
        error: error.message
      });
    }
  }
  
  console.log(`[AI Tool] Sequential execution completed. ${results.length} results ready`);
  return results;
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

**코드 실행기 사용법 (샌드박스 환경):**
- Python: 수학 계산, 데이터 분석, 알고리즘 구현 등 (제한된 내장 모듈만 사용 가능)
- JavaScript: 프론트엔드 로직, JSON 처리, 문자열 조작 등 (기본 모듈만 허용)
- SQL: 데이터베이스 쿼리, 데이터 조작 등 (메모리 내 SQLite, 테스트용 테이블 제공)
- 실행 시간 제한: 10초 (기본값)
- **보안 제한사항**: 
  * 파일 시스템 접근 완전 차단
  * 외부 네트워크 접근 완전 차단 (requests, urllib, http, socket 등 불가)
  * 시스템 명령어 실행 불가 (os, subprocess 등 불가)
  * 격리된 환경에서 실행 (temp 디렉토리 내에서만 동작)
  * 위험한 내장 함수 제거 (eval, exec, __import__ 등)

**도구 사용 가이드라인:**
- 사용자가 특정 정보를 요청하거나 질문할 때, 관련 도구를 적극적으로 활용하세요.
- "계산해줘", "코드 실행", "결과 보여줘", "예제 실행" 등의 요청 시 execute_code 도구를 사용하세요.
- "대한민국", "서울", "날씨" 등의 키워드가 나오면 관련 도구를 사용하세요.
- 검색어나 정보 요청이 명확하지 않더라도, 관련성이 있다면 도구를 사용해서 정확한 정보를 제공하세요.
- 검색 결과를 바탕으로 정확하고 유용한 답변을 제공하세요.
- 여러 출처의 정보를 종합하여 균형잡힌 답변을 만드세요.
- 도구 사용 결과를 인용할 때는 출처를 명시하세요.

**도구 사용 사이클 정책:**
- 기본: 한 번에 하나의 도구만 순차적으로 호출
- 예외: 반드시 병렬 호출이 필요한 경우(여러 데이터 동시 처리 등)에만 여러 도구를 동시에 호출
- 사용자가 "동시 병렬 실행"을 명확히 요청한 경우에만 executeMultipleAiTools 등 병렬 호출 허용

**중요: 사용자가 "검색", "찾아봐", "알려줘", "무엇인가", "언제", "어디", "누구", "계산", "실행", "코드", "결과" 등의 키워드를 사용하면 관련 도구를 사용하세요.**`;

  return originalPrompt + toolInstructions;
}

/**
 * Windows 환경에서 프로세스 메모리 사용량 모니터링 (Docker 사용 시 불필요)
 * @param {Object} child - child_process 객체
 * @param {number} maxMemoryMB - 최대 메모리 사용량 (MB)
 */
function _monitorProcessMemory(child, maxMemoryMB = 100) {
  const interval = setInterval(() => {
    try {
      // Windows에서 tasklist 명령어로 메모리 사용량 체크
      const { execSync } = require('child_process');
      const result = execSync(`tasklist /FI "PID eq ${child.pid}" /FO CSV`, { encoding: 'utf8' });
      
      if (result.includes(child.pid.toString())) {
        const lines = result.split('\n');
        const processLine = lines.find(line => line.includes(child.pid.toString()));
        if (processLine) {
          const memoryMatch = processLine.match(/(\d+,?\d*)\s*K/);
          if (memoryMatch) {
            const memoryKB = parseInt(memoryMatch[1].replace(',', ''));
            const memoryMB = memoryKB / 1024;
            
            if (memoryMB > maxMemoryMB) {
              console.log(`[Code Executor] Memory limit exceeded: ${memoryMB.toFixed(1)}MB > ${maxMemoryMB}MB`);
              child.kill('SIGTERM');
              clearInterval(interval);
            }
          }
        }
      }
    } catch {
      // 프로세스가 이미 종료된 경우 등
      clearInterval(interval);
    }
  }, 500); // 0.5초마다 체크

  // 프로세스 종료 시 인터벌 정리
  child.on('exit', () => clearInterval(interval));

  return interval;
}

/**
 * 코드 실행 함수 (Docker 샌드박스 환경)
 * @param {string} code - 실행할 코드
 * @param {string} language - 코드 언어 (python, javascript, sql, shell)
 * @param {number} timeout - 실행 제한 시간 (초)
 * @returns {Promise<Object>} 실행 결과
 */
async function executeCode(code, language = 'python', timeout = 10) {
  const startTime = Date.now();
  let tempFilePath = null;

  try {
    console.log(`[Code Executor] Starting Docker sandboxed execution of ${language} code`);
    
    // 코드 길이 제한 (5000자)
    if (code.length > 5000) {
      return {
        success: false,
        language,
        output: null,
        error: "코드가 너무 깁니다. 5000자 이하로 작성해주세요.",
        executionTime: 0
      };
    }
    
    // 보안: Docker를 사용하면 대부분의 위험한 패턴을 무력화할 수 있지만 여전히 체크
    const dangerousPatterns = [
      // 무한 루프나 과도한 자원 사용 패턴만 체크
      /while\s+True\s*:/i, // 무한 루프
      /for.*in.*range\s*\(\s*\d{7,}/i, // 매우 큰 범위 반복 (천만 이상)
    ];

    if (dangerousPatterns.some(pattern => pattern.test(code))) {
      return {
        success: false,
        language,
        output: null,
        error: "무한 루프나 과도한 자원 사용이 감지되었습니다.",
        executionTime: 0
      };
    }

    // temp 디렉토리 생성
    const tempDir = path.join(__dirname, '../temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch {
      // 디렉토리가 이미 존재하는 경우 무시
    }

    // 임시 파일 생성
    const fileId = crypto.randomBytes(8).toString('hex');
    const fileExtension = getFileExtension(language);
    tempFilePath = path.join(tempDir, `temp_${fileId}.${fileExtension}`);

    // 코드 파일 작성
    await fs.writeFile(tempFilePath, code);

    // Docker 명령어 생성
    const dockerCommand = getDockerCommand(language, tempFilePath, timeout);
    
    console.log(`[Code Executor] Executing Docker command: ${dockerCommand.cmd} ${dockerCommand.args.join(' ')}`);

    // Docker 컨테이너에서 코드 실행
    const result = await new Promise((resolve, reject) => {
      const timeoutMs = (timeout + 5) * 1000; // Docker 자체 timeout보다 5초 여유
      let stdout = '';
      let stderr = '';

      const child = spawn(dockerCommand.cmd, dockerCommand.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
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
        reject(new Error(`Docker 컨테이너 실행이 ${timeout + 5}초 시간 제한을 초과했습니다.`));
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
        error: result.stderr || `Docker 컨테이너가 코드 ${result.code}로 종료되었습니다.`,
        executionTime
      };
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[Code Executor] Docker execution error:`, error);
    
    return {
      success: false,
      language,
      output: null,
      error: error.message || 'Docker 실행 중 알 수 없는 오류가 발생했습니다.',
      executionTime
    };
  } finally {
    // 임시 파일 정리
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log(`[Code Executor] Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`[Code Executor] Failed to clean up temp file: ${tempFilePath}`, cleanupError);
      }
    }
  }
}

/**
 * 언어별 Docker 실행 명령어 반환 (완전한 격리 환경)
 * @param {string} language - 코드 언어
 * @param {string} filePath - 실행할 파일 경로
 * @param {number} timeout - 실행 제한 시간
 */
function getDockerCommand(language, filePath, _timeout = 10) {
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);
  
  // Docker 공통 옵션
  const commonOptions = [
    'run',
    '--rm', // 컨테이너 실행 후 자동 삭제
    '--network=none', // 네트워크 접근 완전 차단
    '--memory=100m', // 메모리 100MB 제한
    '--cpus=0.5', // CPU 0.5 코어 제한
    '--read-only', // 파일 시스템 읽기 전용
    '--tmpfs=/tmp:noexec,nosuid,size=50m', // 임시 파일 시스템 (50MB, 실행 불가)
    '-v', `${dirPath}:/workspace:ro`, // 코드 파일을 읽기 전용으로 마운트
    '-w', '/workspace', // 작업 디렉토리 설정
  ];

  switch (language.toLowerCase()) {
    case 'python':
      return { 
        cmd: 'docker', 
        args: [
          ...commonOptions,
          '--user=1000:1000', // 비권한 사용자로 실행
          'python:3.9-alpine', // 경량 Python 이미지
          'timeout', '30s', // 30초 timeout (컨테이너 내부 명령어)
          'python', fileName
        ]
      };
    case 'javascript':
      return { 
        cmd: 'docker', 
        args: [
          ...commonOptions,
          '--user=1000:1000',
          'node:18-alpine', // 경량 Node.js 이미지
          'timeout', '30s', // 30초 timeout
          'node', fileName
        ]
      };
    case 'sql':
      return { 
        cmd: 'docker', 
        args: [
          ...commonOptions,
          '--user=1000:1000',
          'alpine:latest', // SQLite가 포함된 경량 이미지
          'timeout', '30s',
          'sh', '-c', `sqlite3 :memory: ".read ${fileName}"`
        ]
      };
    default:
      throw new Error(`Docker에서 지원하지 않는 언어입니다: ${language}`);
  }
}
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
 * Docker 사용 가능 여부 확인
 * @returns {Promise<boolean>} Docker 사용 가능 여부
 */
async function checkDockerAvailability() {
  try {
    const { execSync } = require('child_process');
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.warn('[Docker] Docker is not available:', error.message);
    return false;
  }
}

/**
 * Function Calling 루프: AI가 연속적으로 여러 도구를 호출할 수 있도록 지원
 * @param {function} aiPromptFunc - AI에게 프롬프트를 전달하는 함수 (예: Gemini/ChatGPT API 래퍼)
 * @param {Object} initialPrompt - 최초 프롬프트 및 컨텍스트
 * @param {number} maxSteps - 최대 반복 횟수(무한 루프 방지)
 * @returns {Promise<Object>} 최종 AI 답변 및 메타데이터
 */
async function runFunctionCallingLoop(aiPromptFunc, initialPrompt, maxSteps = 10) {
  let step = 0;
  let aiResponse = null;
  let allToolResults = [];
  let currentMessage = initialPrompt.message;
  let conversationHistory = [...(initialPrompt.chatHistory || [])];

  console.log(`[Function Calling Loop] 시작 - 최대 ${maxSteps}단계`);

  while (step < maxSteps) {
    step++;
    console.log(`[Function Calling Loop] 단계 ${step}/${maxSteps} 시작`);

    // 1. AI에게 프롬프트 전달
    const prompt = {
      ...initialPrompt,
      message: currentMessage,
      chatHistory: conversationHistory
    };

    try {
      aiResponse = await aiPromptFunc(
        prompt.aiProvider,
        prompt.message,
        prompt.chatHistory,
        prompt.systemPrompt,
        prompt.specialModeType,
        prompt.streamResponseCallback,
        {
          model_id_override: prompt.modelId,
          max_output_tokens_override: prompt.maxOutputTokens
        },
        { clientIp: prompt.clientIp }
      );

      console.log(`[Function Calling Loop] AI 응답 받음 - 도구 호출 개수: ${aiResponse?.toolCalls?.length || 0}`);

    } catch (error) {
      console.error(`[Function Calling Loop] AI 호출 실패 (단계 ${step}):`, error);
      break;
    }

    // 2. AI 응답에서 도구 호출 필요 여부 판단
    if (aiResponse && aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      console.log(`[Function Calling Loop] ${aiResponse.toolCalls.length}개 도구 실행 중...`);
      
      // 3. 도구 호출 실행 (순차적)
      const toolResults = await executeSequentialAiTools(
        aiResponse.toolCalls, 
        { clientIp: prompt.clientIp, ...prompt.context }
      );
      
      // 도구 결과 저장
      allToolResults.push(...toolResults);
      
      // 4. 도구 결과를 바탕으로 다음 메시지 구성
      const toolResultsText = toolResults.map((result, index) => {
        if (result.success) {
          return `도구 ${index + 1} (${result.toolName}) 결과:\n${JSON.stringify(result.result, null, 2)}`;
        } else {
          return `도구 ${index + 1} (${result.toolName}) 오류:\n${result.error}`;
        }
      }).join('\n\n');

      // 5. 대화 히스토리에 AI 응답과 도구 결과 추가
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse.content || `도구를 호출했습니다: ${aiResponse.toolCalls.map(tc => tc.toolName).join(', ')}`,
        toolCalls: aiResponse.toolCalls
      });

      conversationHistory.push({
        role: 'system',
        content: `도구 실행 결과:\n\n${toolResultsText}\n\n위 결과를 바탕으로 사용자에게 최종 답변을 제공하거나 추가 도구가 필요하면 호출하세요.`
      });

      // 6. 다음 메시지는 도구 결과를 기반으로 계속 진행하도록 설정
      currentMessage = "위의 도구 실행 결과를 바탕으로 답변을 완성해주세요. 필요하면 추가 도구를 호출할 수도 있습니다.";
      
      console.log(`[Function Calling Loop] 단계 ${step} 완료 - 다음 단계로 진행`);
      continue;
    }

    // 7. 도구 호출이 더 이상 없으면 최종 답변으로 간주
    console.log(`[Function Calling Loop] 단계 ${step}에서 완료 - 도구 호출 없음`);
    break;
  }

  console.log(`[Function Calling Loop] 완료 - 총 ${step}단계, 도구 호출 ${allToolResults.length}개`);

  // 8. 최종 결과 반환
  return {
    finalAnswer: aiResponse?.content || aiResponse,
    aiResponseFull: aiResponse,
    functionCallsUsed: allToolResults.length > 0,
    steps: step,
    toolResults: allToolResults,
    conversationSteps: conversationHistory.length
  };
}

module.exports = {
  AI_TOOLS,
  executeAiTool, // 단일 도구 실행
  executeMultipleAiTools, // 병렬 도구 실행 (새로 추가)
  executeSequentialAiTools, // 순차 도구 실행 (새로 추가)
  getGeminiTools,
  enhancePromptWithTools,
  executeCode, // Docker 기반 코드 실행 함수
  checkDockerAvailability, // Docker 사용 가능 여부 체크
  runFunctionCallingLoop, // Function Calling 루프 지원 (새로 추가)
};
