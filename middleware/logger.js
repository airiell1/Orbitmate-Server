// middleware/logger.js - 중앙집중식 API 로깅 미들웨어

/**
 * API 요청/응답 로깅 미들웨어
 * 모든 API 요청과 응답을 중앙에서 로깅합니다.
 */

const fs = require('fs');
const path = require('path');

// 로그 파일 경로 설정
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'api.log');

/**
 * 로그 파일에 메시지 기록
 * @param {string} level - 로그 레벨 (INFO, ERROR, WARN)
 * @param {string} message - 로그 메시지
 */
function writeToLogFile(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    try {
        fs.appendFileSync(logFilePath, logEntry);
    } catch (error) {
        console.error('로그 파일 쓰기 실패:', error);
    }
}

/**
 * 요청 데이터를 안전하게 문자열로 변환
 * @param {any} data - 변환할 데이터
 * @returns {string} 문자열화된 데이터
 */
function safeStringify(data) {
    try {
        if (typeof data === 'string') return data;
        if (data === null || data === undefined) return '';
        
        // 비밀번호 등 민감한 정보 마스킹
        const sanitized = JSON.parse(JSON.stringify(data));
        if (sanitized.password) sanitized.password = '***';
        if (sanitized.new_password) sanitized.new_password = '***';
        if (sanitized.old_password) sanitized.old_password = '***';
        
        return JSON.stringify(sanitized);
    } catch (error) {
        return '[JSON 변환 실패]';
    }
}

/**
 * 클라이언트 IP 주소 추출
 * @param {Object} req - Express 요청 객체
 * @returns {string} IP 주소
 */
function getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
}

/**
 * 요청 로깅 미들웨어
 * 모든 API 요청을 로깅합니다.
 */
function logApiRequest(req, res, next) {
    const startTime = Date.now();
    const clientIP = getClientIP(req);
    
    // 요청 정보 로깅
    const requestInfo = {
        method: req.method,
        url: req.originalUrl,
        ip: clientIP,
        userAgent: req.headers['user-agent'] || 'unknown',
        contentType: req.headers['content-type'] || 'none',
        body: req.body ? safeStringify(req.body) : '',
        query: Object.keys(req.query).length > 0 ? safeStringify(req.query) : '',
        params: Object.keys(req.params).length > 0 ? safeStringify(req.params) : ''
    };
    
    const requestMessage = `REQUEST: ${req.method} ${req.originalUrl} | IP: ${clientIP} | Body: ${requestInfo.body} | Query: ${requestInfo.query} | Params: ${requestInfo.params}`;
    
    // 콘솔과 파일에 모두 로깅
    console.log(`🔵 [API REQUEST] ${requestMessage}`);
    writeToLogFile('INFO', `REQUEST: ${requestMessage}`);
    
    // 원본 res.json 메서드 저장
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;
    
    let responseStatusCode = 200;
    
    // res.status 메서드 오버라이드
    res.status = function(code) {
        responseStatusCode = code;
        return originalStatus.call(this, code);
    };
    
    // res.json 메서드 오버라이드하여 응답 로깅
    res.json = function(body) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const responseInfo = {
            statusCode: responseStatusCode,
            duration: `${duration}ms`,
            body: safeStringify(body)
        };
        
        const responseMessage = `RESPONSE: ${req.method} ${req.originalUrl} | Status: ${responseStatusCode} | Duration: ${duration}ms | Body: ${responseInfo.body}`;
        
        // 성공/실패에 따라 다른 색상으로 로깅
        if (responseStatusCode >= 200 && responseStatusCode < 300) {
            console.log(`🟢 [API RESPONSE] ${responseMessage}`);
            writeToLogFile('INFO', `RESPONSE: ${responseMessage}`);
        } else if (responseStatusCode >= 400) {
            console.log(`🔴 [API ERROR] ${responseMessage}`);
            writeToLogFile('ERROR', `ERROR: ${responseMessage}`);
        } else {
            console.log(`🟡 [API RESPONSE] ${responseMessage}`);
            writeToLogFile('WARN', `RESPONSE: ${responseMessage}`);
        }
        
        return originalJson.call(this, body);
    };
    
    // res.send 메서드도 오버라이드 (json이 아닌 응답용)
    res.send = function(body) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const responseMessage = `SEND: ${req.method} ${req.originalUrl} | Status: ${responseStatusCode} | Duration: ${duration}ms | Body: ${safeStringify(body)}`;
        
        if (responseStatusCode >= 200 && responseStatusCode < 300) {
            console.log(`🟢 [API SEND] ${responseMessage}`);
            writeToLogFile('INFO', `SEND: ${responseMessage}`);
        } else if (responseStatusCode >= 400) {
            console.log(`🔴 [API ERROR] ${responseMessage}`);
            writeToLogFile('ERROR', `ERROR: ${responseMessage}`);
        } else {
            console.log(`🟡 [API SEND] ${responseMessage}`);
            writeToLogFile('WARN', `SEND: ${responseMessage}`);
        }
        
        return originalSend.call(this, body);
    };
    
    // 요청 타임아웃 처리
    req.on('close', () => {
        if (!res.headersSent) {
            const duration = Date.now() - startTime;
            console.log(`⚠️ [API TIMEOUT] ${req.method} ${req.originalUrl} | Duration: ${duration}ms | Client disconnected`);
            writeToLogFile('WARN', `TIMEOUT: ${req.method} ${req.originalUrl} | Duration: ${duration}ms | Client disconnected`);
        }
    });
    
    next();
}

/**
 * 에러 로깅 미들웨어
 * 모든 에러를 중앙에서 로깅합니다.
 */
function logApiError(err, req, res, next) {
    const clientIP = getClientIP(req);
    
    const errorInfo = {
        method: req.method,
        url: req.originalUrl,
        ip: clientIP,
        error: {
            name: err.name || 'UnknownError',
            message: err.message || 'Unknown error occurred',
            code: err.code || 'UNKNOWN_ERROR',
            stack: err.stack || 'No stack trace available'
        },
        body: req.body ? safeStringify(req.body) : '',
        query: Object.keys(req.query).length > 0 ? safeStringify(req.query) : '',
        params: Object.keys(req.params).length > 0 ? safeStringify(req.params) : ''
    };
    
    const errorMessage = `ERROR: ${req.method} ${req.originalUrl} | IP: ${clientIP} | Error: ${err.name} - ${err.message} | Code: ${err.code || 'UNKNOWN'}`;
    
    // 콘솔과 파일에 에러 로깅
    console.error(`💥 [API ERROR] ${errorMessage}`);
    console.error(`💥 [ERROR STACK] ${err.stack}`);
    
    writeToLogFile('ERROR', `ERROR: ${errorMessage}`);
    writeToLogFile('ERROR', `ERROR STACK: ${err.stack}`);
    
    // 에러를 다음 미들웨어로 전달
    next(err);
}

/**
 * 로그 파일 정리 함수 (선택적)
 * 오래된 로그 파일을 삭제합니다.
 */
function cleanupLogs(daysToKeep = 7) {
    try {
        const files = fs.readdirSync(logDir);
        const now = Date.now();
        const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // 일을 밀리초로 변환
        
        files.forEach(file => {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ 오래된 로그 파일 삭제: ${file}`);
            }
        });
    } catch (error) {
        console.error('로그 파일 정리 중 오류:', error);
    }
}

/**
 * 서버 시작 시 로그 시스템 초기화
 */
function initializeLogger() {
    console.log(`📝 API 로깅 시스템 초기화됨`);
    console.log(`📂 로그 파일 위치: ${logFilePath}`);
    
    // 서버 시작 로그
    writeToLogFile('INFO', 'API 로깅 시스템 시작됨');
    
    // 주기적으로 로그 파일 정리 (매일 자정)
    setInterval(() => {
        cleanupLogs(7); // 7일 이상 된 로그 파일 삭제
    }, 24 * 60 * 60 * 1000); // 24시간마다 실행
}

module.exports = {
    logApiRequest,
    logApiError,
    initializeLogger,
    cleanupLogs
};
