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
        
        // 데이터가 이미 객체인 경우 바로 사용
        let sanitized = data;
        
        // 재귀적으로 객체 내부의 민감한 정보 마스킹
        function maskSensitiveData(obj) {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            // 배열 처리
            if (Array.isArray(obj)) {
                return obj.map(item => maskSensitiveData(item));
            }
            
            // 객체 처리
            const masked = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const lowerKey = key.toLowerCase();
                    
                    // 민감한 필드 마스킹
                    if (lowerKey.includes('password') || 
                        lowerKey.includes('passwd') || 
                        lowerKey.includes('pwd') ||
                        lowerKey.includes('token') || 
                        lowerKey.includes('jwt') || 
                        lowerKey.includes('auth') ||
                        lowerKey.includes('bearer') ||
                        lowerKey.includes('secret') || 
                        lowerKey.includes('credential') ||
                        lowerKey.includes('ssn') || 
                        lowerKey.includes('social') || 
                        lowerKey.includes('credit') ||
                        lowerKey.includes('card')) {
                        masked[key] = '***';
                    }
                    // 중첩된 객체나 배열 재귀 처리
                    else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        masked[key] = maskSensitiveData(obj[key]);
                    }
                    else {
                        masked[key] = obj[key];
                    }
                }
            }
            return masked;
        }
        
        const maskedData = maskSensitiveData(sanitized);
        return JSON.stringify(maskedData, null, 0); // 한 번만 stringify
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
    
    // 로그 API 자체는 로깅하지 않음 (무한 루프 방지)
    if (req.originalUrl.startsWith('/api/logs')) {
        return next();
    }
    
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
    
    // 요청은 일단 저장만 하고 응답과 함께 로깅
    req.requestStartTime = startTime;
    req.requestInfo = requestInfo;
    
    // 원본 메서드 저장
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;
    
    let responseStatusCode = 200;
    let responseLogged = false; // 중복 로깅 방지 플래그
    
    // res.status 메서드 오버라이드
    res.status = function(code) {
        responseStatusCode = code;
        return originalStatus.call(this, code);
    };
    
    // 응답 로깅 공통 함수
    function logResponse(body, method = 'RESPONSE') {
        if (responseLogged) return; // 이미 로깅했다면 중복 방지
        responseLogged = true;
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const responseMessage = `${req.method} ${req.originalUrl} | Status: ${responseStatusCode} | Duration: ${duration}ms | Body: ${safeStringify(body)}`;
        
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
    }
    
    // res.json 메서드 오버라이드 (JSON 응답)
    res.json = function(body) {
        logResponse(body, 'JSON');
        return originalJson.call(this, body);
    };
    
    // res.send 메서드 오버라이드 (일반 응답)
    res.send = function(body) {
        // res.json이 내부적으로 res.send를 호출하므로 중복 방지
        if (!responseLogged) {
            logResponse(body, 'SEND');
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
    
    // 로그 API 자체는 에러 로깅하지 않음 (무한 루프 방지)
    if (req.originalUrl.startsWith('/api/logs')) {
        return next(err);
    }
    
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
    
    // 콘솔과 파일에 에러 로깅 (스택 트레이스 포함)
    console.error(`💥 [API ERROR] ${errorMessage}`);
    console.error(`💥 [ERROR STACK] ${err.stack}`);
    
    // 파일에는 멀티라인으로 기록
    writeToLogFile('ERROR', `${errorMessage}\n${err.stack}`);
    
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
    writeToLogFile('INFO', 'API 로깅 시스템 재시작됨');
    
    // 테스트 로그 (로그 레벨별 색상 확인용, 실제 운영 포맷과 동일하게)
    writeToLogFile('INFO', '✅ INFO 레벨 테스트 - 정상 작동 중입니다');
    writeToLogFile('WARN', '⚠️ WARN 레벨 테스트 - 경고 메시지입니다');
    // 에러+스택트레이스 블록 예시
    writeToLogFile('ERROR', 'ERROR: POST /api/test | IP: 127.0.0.1 | Error: TestError - 테스트 에러 | Code: TEST_ERR');
    writeToLogFile('ERROR', '    at testFunction (C:\\Users\\test\\file.js:123:45)');
    writeToLogFile('ERROR', '    at anotherFunction (C:\\Users\\test\\another.js:67:89)');
    writeToLogFile('ERROR', '    at mainFunction (C:\\Users\\test\\main.js:12:34)');
    writeToLogFile('ERROR', 'Status: 500');
    writeToLogFile('ERROR', 'Body: {"error":"테스트"}');

    // 진짜 에러 객체로 스택 트레이스 테스트 (운영 포맷과 동일하게)
    const testError = new Error('테스트 에러 - 스택 트레이스 확인용');
    writeToLogFile('ERROR', `ERROR: GET /api/test2 | IP: 127.0.0.1 | Error: ${testError.name} - ${testError.message} | Code: TEST_ERR2`);
    if (testError.stack) {
      const stackLines = testError.stack.split('\n').slice(1); // 첫 줄은 에러 메시지
      stackLines.forEach(line => {
        writeToLogFile('ERROR', `    ${line.trim()}`);
      });
    }
    writeToLogFile('ERROR', 'Status: 500');
    
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
