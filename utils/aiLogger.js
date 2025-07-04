// utils/aiLogger.js - AI 전용 로깅 시스템
const fs = require('fs').promises;
const path = require('path');

// AI 로그 파일 경로
const AI_LOG_DIR = path.join(__dirname, '../logs');
const AI_LOG_FILE = path.join(AI_LOG_DIR, 'ai.log');

/**
 * AI 로그 파일 초기화
 */
async function initializeAiLogging() {
  try {
    await fs.mkdir(AI_LOG_DIR, { recursive: true });
    
    // 로그 파일이 없으면 생성
    try {
      await fs.access(AI_LOG_FILE);
    } catch {
      await fs.writeFile(AI_LOG_FILE, '');
      console.log('[AI Logger] AI 로그 파일 초기화 완료');
    }
  } catch (error) {
    console.error('[AI Logger] 초기화 실패:', error);
  }
}

/**
 * AI 로그 기록
 * @param {string} level - 로그 레벨 (INFO, ERROR, DEBUG)
 * @param {string} event - 이벤트 타입 (REQUEST, RESPONSE, TOOL_CALL, SYSTEM_PROMPT, etc.)
 * @param {Object} data - 로그 데이터
 */
async function writeAiLog(level, event, data) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      event,
      ...data
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    // 파일에 비동기로 기록
    await fs.appendFile(AI_LOG_FILE, logLine);
    
    // 콘솔에도 출력 (개발 환경)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AI ${level}] ${event}:`, data);
    }
  } catch (error) {
    console.error('[AI Logger] 로그 기록 실패:', error);
  }
}

/**
 * AI 요청 시작 로그
 */
async function logAiRequest(sessionId, userId, provider, model, messageLength, systemPromptLength, tools = []) {
  await writeAiLog('INFO', 'AI_REQUEST_START', {
    session_id: sessionId,
    user_id: userId,
    ai_provider: provider,
    model_id: model,
    message_length: messageLength,
    system_prompt_length: systemPromptLength,
    tools_available: tools.length,
    tools_list: tools
  });
}

/**
 * AI 응답 완료 로그
 */
async function logAiResponse(sessionId, userId, provider, model, responseLength, tokens, functionCalls = null, success = true, error = null) {
  await writeAiLog(success ? 'INFO' : 'ERROR', 'AI_RESPONSE_COMPLETE', {
    session_id: sessionId,
    user_id: userId,
    ai_provider: provider,
    model_id: model,
    response_length: responseLength,
    input_tokens: tokens?.input || 0,
    output_tokens: tokens?.output || 0,
    total_tokens: tokens?.total || 0,
    function_calls_used: functionCalls,
    success,
    error: error?.message || null
  });
}

/**
 * 시스템 프롬프트 로그
 */
async function logSystemPrompt(sessionId, userId, promptType, promptLength, personalized = false, contextType = null) {
  await writeAiLog('DEBUG', 'SYSTEM_PROMPT', {
    session_id: sessionId,
    user_id: userId,
    prompt_type: promptType,
    prompt_length: promptLength,
    personalized,
    context_type: contextType
  });
}

/**
 * 도구 사용 로그
 */
async function logToolUsage(sessionId, userId, toolName, parameters, result, executionTime, success = true, error = null) {
  await writeAiLog(success ? 'INFO' : 'ERROR', 'TOOL_USAGE', {
    session_id: sessionId,
    user_id: userId,
    tool_name: toolName,
    parameters: JSON.stringify(parameters),
    result_summary: typeof result === 'object' ? `${Object.keys(result).length} properties` : `${String(result).length} chars`,
    execution_time_ms: executionTime,
    success,
    error: error?.message || null
  });
}

/**
 * 스트리밍 상태 로그
 */
async function logStreamingStatus(sessionId, userId, event, chunkCount = null, totalChars = null) {
  await writeAiLog('DEBUG', 'STREAMING', {
    session_id: sessionId,
    user_id: userId,
    streaming_event: event,
    chunk_count: chunkCount,
    total_characters: totalChars
  });
}

/**
 * 에러 로그
 */
async function logAiError(sessionId, userId, errorType, errorMessage, stackTrace = null, context = {}) {
  await writeAiLog('ERROR', 'AI_ERROR', {
    session_id: sessionId,
    user_id: userId,
    error_type: errorType,
    error_message: errorMessage,
    stack_trace: stackTrace,
    context
  });
}

/**
 * 사용량 통계 로그
 */
async function logUsageStats(userId, provider, model, dailyCount, monthlyTokens, subscriptionTier) {
  await writeAiLog('INFO', 'USAGE_STATS', {
    user_id: userId,
    ai_provider: provider,
    model_id: model,
    daily_request_count: dailyCount,
    monthly_token_usage: monthlyTokens,
    subscription_tier: subscriptionTier
  });
}

/**
 * 최근 AI 로그 조회
 */
async function getRecentAiLogs(lines = 100, filter = null) {
  try {
    const content = await fs.readFile(AI_LOG_FILE, 'utf8');
    const logLines = content.trim().split('\n').filter(line => line.length > 0);
    
    let filteredLines = logLines;
    if (filter) {
      filteredLines = logLines.filter(line => {
        try {
          const logEntry = JSON.parse(line);
          return logEntry.event?.toLowerCase().includes(filter.toLowerCase()) ||
                 logEntry.level?.toLowerCase().includes(filter.toLowerCase());
        } catch {
          return false;
        }
      });
    }
    
    return filteredLines.slice(-lines).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (error) {
    console.error('[AI Logger] 로그 조회 실패:', error);
    return [];
  }
}

/**
 * AI 로그 파일 정리 (7일 이상된 로그 아카이브)
 */
async function cleanupAiLogs() {
  try {
    const stats = await fs.stat(AI_LOG_FILE);
    const fileAgeMs = Date.now() - stats.mtime.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    if (fileAgeMs > sevenDaysMs) {
      const backupFileName = `ai-backup-${Date.now()}.log`;
      const backupPath = path.join(AI_LOG_DIR, backupFileName);
      
      // 백업 생성
      await fs.copyFile(AI_LOG_FILE, backupPath);
      
      // 현재 파일 초기화
      await fs.writeFile(AI_LOG_FILE, '');
      
      console.log(`[AI Logger] 로그 파일 정리 완료: ${backupFileName}`);
    }
  } catch (error) {
    console.error('[AI Logger] 로그 정리 실패:', error);
  }
}

module.exports = {
  initializeAiLogging,
  writeAiLog,
  logAiRequest,
  logAiResponse,
  logSystemPrompt,
  logToolUsage,
  logStreamingStatus,
  logAiError,
  logUsageStats,
  getRecentAiLogs,
  cleanupAiLogs
};