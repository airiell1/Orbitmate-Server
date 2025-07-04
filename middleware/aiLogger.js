// middleware/aiLogger.js - AI 전용 로깅 시스템
const fs = require('fs');
const path = require('path');

// AI 로그 파일 경로
const AI_LOG_FILE = path.join(__dirname, '../logs/ai.log');

// 로그 디렉토리가 없으면 생성
const logDir = path.dirname(AI_LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * AI 관련 정보를 상세 로깅하는 함수
 * @param {Object} logData - 로깅할 데이터
 */
function logAiActivity(logData) {
    const timestamp = new Date().toISOString();
    
    // 로그 엔트리 구성
    const logEntry = {
        timestamp,
        type: 'AI_ACTIVITY',
        ...logData
    };
    
    // JSON 형태로 로그 기록 (한 줄씩)
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
        // 파일에 비동기 쓰기 (blocking 방지)
        fs.appendFile(AI_LOG_FILE, logLine, (err) => {
            if (err) {
                console.error('[AI Logger] 로그 파일 쓰기 실패:', err);
            }
        });
        
        // 콘솔에도 출력 (개발 환경용) - 간소화
        if (logData.action === 'AI_REQUEST_START') {
            console.log(`[AI] 요청 시작 - ${logData.userNickname || logData.userId}@${logData.sessionId?.substring(0, 8)} | ${logData.aiProvider}:${logData.aiModel}`);
        } else if (logData.action === 'AI_REQUEST_COMPLETE' && logData.success) {
            console.log(`[AI] 응답 완료 - ${logData.processingTimeMs}ms | 토큰: ${logData.tokenUsage?.totalTokens || 'N/A'} | 도구: ${logData.toolsUsed?.length || 0}개`);
        } else if (logData.action === 'AI_TOOL_USAGE') {
            console.log(`[AI Tool] ${logData.toolName} - ${logData.executionTimeMs}ms | ${logData.toolResult?.success ? '성공' : '실패'}`);
        }
    } catch (error) {
        console.error('[AI Logger] 로깅 중 오류:', error);
    }
}

/**
 * AI 요청 시작 로깅
 */
function logAiRequestStart(data) {
    logAiActivity({
        action: 'AI_REQUEST_START',
        sessionId: data.sessionId,
        userId: data.userId,
        userNickname: data.userNickname,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        userMessage: data.userMessage,
        systemPrompt: data.systemPrompt ? {
            length: data.systemPrompt.length,
            hasCustomPrompt: !!data.customPrompt,
            contextType: data.contextType
        } : null,
        requestOptions: {
            maxTokens: data.maxTokens,
            temperature: data.temperature,
            specialMode: data.specialMode,
            toolsEnabled: data.toolsEnabled
        },
        clientInfo: {
            ip: data.clientIp,
            userAgent: data.userAgent
        }
    });
}

/**
 * AI 응답 완료 로깅
 */
function logAiRequestComplete(data) {
    logAiActivity({
        action: 'AI_REQUEST_COMPLETE',
        sessionId: data.sessionId,
        userId: data.userId,
        userNickname: data.userNickname,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        userMessageId: data.userMessageId,
        aiMessageId: data.aiMessageId,
        aiResponse: data.aiResponse ? {
            length: data.aiResponse.length,
            preview: data.aiResponse.substring(0, 100) + (data.aiResponse.length > 100 ? '...' : '')
        } : null,
        tokenUsage: {
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            totalTokens: data.totalTokens
        },
        toolsUsed: data.toolsUsed || [],
        toolResults: data.toolResults || [],
        performance: {
            processingTimeMs: data.processingTimeMs,
            streamingMode: data.streamingMode
        },
        success: data.success,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage
    });
}

/**
 * AI 도구 사용 로깅
 */
function logAiToolUsage(data) {
    logAiActivity({
        action: 'AI_TOOL_USAGE',
        sessionId: data.sessionId,
        userId: data.userId,
        userNickname: data.userNickname,
        toolName: data.toolName,
        toolArgs: data.toolArgs,
        toolResult: data.toolResult ? {
            success: data.toolResult.success,
            dataLength: JSON.stringify(data.toolResult).length,
            preview: JSON.stringify(data.toolResult).substring(0, 200) + '...'
        } : null,
        executionTimeMs: data.executionTimeMs,
        error: data.error
    });
}

/**
 * AI 시스템 프롬프트 로깅
 */
function logSystemPrompt(data) {
    logAiActivity({
        action: 'SYSTEM_PROMPT_PROCESSED',
        sessionId: data.sessionId,
        userId: data.userId,
        userNickname: data.userNickname,
        promptInfo: {
            finalLength: data.finalPrompt?.length,
            originalLength: data.originalPrompt?.length,
            hasUserProfile: !!data.userProfile,
            hasUserSettings: !!data.userSettings,
            hasCustomPrompt: !!data.customPrompt,
            contextType: data.contextType,
            toolsEnhanced: data.toolsEnhanced
        }
    });
}

/**
 * Express 미들웨어: AI 관련 요청 자동 로깅
 */
function aiLoggingMiddleware(req, res, next) {
    // AI 관련 엔드포인트만 처리
    if (!req.path.includes('/chat/sessions/') || !req.path.includes('/messages')) {
        return next();
    }
    
    const startTime = Date.now();
    
    // 응답 완료 시 로깅
    const originalSend = res.send;
    res.send = function(data) {
        const processingTime = Date.now() - startTime;
        
        try {
            const responseData = typeof data === 'string' ? JSON.parse(data) : data;
            
            if (responseData.status === 'success' && responseData.data) {
                // 성공적인 AI 응답 로깅
                logAiActivity({
                    action: 'API_RESPONSE_SUCCESS',
                    method: req.method,
                    path: req.path,
                    sessionId: req.params.session_id,
                    userId: req.body?.user_id,
                    processingTimeMs: processingTime,
                    statusCode: res.statusCode,
                    responseSize: JSON.stringify(data).length
                });
            } else if (responseData.status === 'error') {
                // 에러 응답 로깅
                logAiActivity({
                    action: 'API_RESPONSE_ERROR',
                    method: req.method,
                    path: req.path,
                    sessionId: req.params.session_id,
                    userId: req.body?.user_id,
                    processingTimeMs: processingTime,
                    statusCode: res.statusCode,
                    errorCode: responseData.error?.code,
                    errorMessage: responseData.error?.message
                });
            }
        } catch (parseError) {
            // JSON 파싱 실패는 무시 (스트리밍 응답 등)
        }
        
        return originalSend.call(this, data);
    };
    
    next();
}

/**
 * 로그 파일 정리 (7일 이상된 로그 삭제)
 */
function cleanupOldLogs() {
    const logDir = path.dirname(AI_LOG_FILE);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    try {
        fs.readdir(logDir, (err, files) => {
            if (err) return;
            
            files.forEach(file => {
                if (file.startsWith('ai-backup-') && file.endsWith('.log')) {
                    const filePath = path.join(logDir, file);
                    fs.stat(filePath, (statErr, stats) => {
                        if (!statErr && stats.mtime.getTime() < sevenDaysAgo) {
                            fs.unlink(filePath, (unlinkErr) => {
                                if (!unlinkErr) {
                                    console.log(`[AI Logger] 오래된 로그 파일 삭제: ${file}`);
                                }
                            });
                        }
                    });
                }
            });
        });
    } catch (error) {
        console.error('[AI Logger] 로그 정리 중 오류:', error);
    }
}

// 서버 시작 시 로그 정리 실행
cleanupOldLogs();

// 매일 자정에 로그 정리 실행
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
    logAiActivity,
    logAiRequestStart,
    logAiRequestComplete,
    logAiToolUsage,
    logSystemPrompt,
    aiLoggingMiddleware
};
