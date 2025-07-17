// 민감정보 마스킹 유틸
function maskSensitiveData(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveData);
  const masked = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') || lowerKey.includes('passwd') || lowerKey.includes('pwd') ||
      lowerKey.includes('token') || lowerKey.includes('jwt') || lowerKey.includes('auth') ||
      lowerKey.includes('bearer') || lowerKey.includes('secret') || lowerKey.includes('credential') ||
      lowerKey.includes('ssn') || lowerKey.includes('social') || lowerKey.includes('credit') || lowerKey.includes('card')
    ) {
      masked[key] = '***';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      masked[key] = maskSensitiveData(obj[key]);
    } else {
      masked[key] = obj[key];
    }
  }
  return masked;
}

// 요청 ID 생성 (요청-응답 연결용)
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9);
}

// 요청/응답 통합 로깅 미들웨어 (REQUEST-RESPONSE 합치기)
function logApiRequest(req, res, next) {
  if (req.originalUrl.startsWith('/api/logs')) return next(); // 로그 API는 제외
  
  const requestId = generateRequestId();
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // 사용자 ID 추출 (여러 소스에서 시도)
  const userId = req.params?.user_id || req.user?.user_id || req.body?.user_id || 'unknown';
  
  // 요청 정보 수집
  const requestData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    contentType: req.headers['content-type'] || 'none',
    userId: userId,
    body: req.body ? maskSensitiveData(req.body) : undefined,
    query: req.query && Object.keys(req.query).length > 0 ? maskSensitiveData(req.query) : undefined,
    params: req.params && Object.keys(req.params).length > 0 ? maskSensitiveData(req.params) : undefined
  };

  // 응답 로깅
  const originalJson = res.json;
  const originalSend = res.send;
  let responseLogged = false;

  function logCombinedRequestResponse(body, statusCode) {
    if (responseLogged) return;
    responseLogged = true;
    const duration = Date.now() - startTime;
    
    // 통합 API 로그의 요청/응답 바디 표시 (더 상세하게)
    const combinedData = {
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      duration,
      ip: requestData.ip,
      userId: requestData.userId,
      requestBody: requestData.body,
      responseBody: body,
      query: requestData.query,
      params: requestData.params,
      contentType: requestData.contentType
    };

    // 통합 로그 출력
    writeCombinedRequestResponseBlock(requestId, new Date().toISOString(), 'API', combinedData);
  }

  res.json = function (body) {
    logCombinedRequestResponse(body, res.statusCode);
    return originalJson.call(this, body);
  };

  res.send = function (body) {
    logCombinedRequestResponse(body, res.statusCode);
    return originalSend.call(this, body);
  };

  next();
}

// 에러 자동 로깅 미들웨어 (개선된 스택 트레이스 블록 로깅)
function logApiError(err, req, res, next) {
  if (req.originalUrl && req.originalUrl.startsWith('/api/logs')) return next(err);
  
  const timestamp = new Date().toISOString();
  const userId = req.params?.user_id || req.user?.user_id || req.body?.user_id || 'unknown';
  
  const errorData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    userId: userId,
    message: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    stack: err.stack || undefined
  };

  // 에러 로그 출력 (블록 형태 - 스택 트레이스 포함)
  writeErrorBlock(timestamp, errorData);
  next(err);
}
// 효율적인 구조화된 로깅 시스템
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
const logFilePath = path.join(logDir, 'api.log');

function ensureLogDir() {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
}

// 구조화된 로그 작성 (코드 추출 최적화)
function writeStructuredLog(logEntry) {
  ensureLogDir();
  
  // 구분자와 함께 한 줄로 작성 (파싱 최적화)
  const logLine = [
    `[${logEntry.timestamp}]`,
    `[UserID: ${logEntry.userId || 'unknown'}]`,
    `[Path: ${logEntry.method || ''} ${logEntry.url || ''}]`,
    `[Handler: ${logEntry.handler || logEntry.url || 'unknown'}]`,
    `[${logEntry.level || logEntry.type}]`,
    logEntry.requestId ? `[${logEntry.requestId}]` : '',
    logEntry.status ? `${logEntry.status}` : '',
    logEntry.duration ? `${logEntry.duration}ms` : '',
    logEntry.code ? `${logEntry.code}` : '',
    logEntry.message ? `${logEntry.message}` : ''
  ].filter(Boolean).join(' ');
  
  fs.appendFileSync(logFilePath, logLine + '\n', 'utf8');
  
  // 스택 트레이스나 바디는 별도로 추가 (들여쓰기로 구분)
  if (logEntry.stack) {
    const stackLines = logEntry.stack.split('\n');
    stackLines.forEach((line, index) => {
      fs.appendFileSync(logFilePath, `    ${index + 1}. ${line.trim()}\n`, 'utf8');
    });
  }
  
  // 요청 바디 (있는 경우)
  if (logEntry.requestBody) {
    fs.appendFileSync(logFilePath, `    REQ_BODY: ${JSON.stringify(logEntry.requestBody)}\n`, 'utf8');
  }
  
  // 응답 바디 (있는 경우)
  if (logEntry.responseBody || (logEntry.body && logEntry.level !== 'REQUEST')) {
    const bodyToLog = logEntry.responseBody || logEntry.body;
    fs.appendFileSync(logFilePath, `    RES_BODY: ${JSON.stringify(bodyToLog)}\n`, 'utf8');
  }
  
  // 기타 메타 정보 (IP, Query, Params 등)
  if (logEntry.ip && logEntry.ip !== 'unknown') {
    fs.appendFileSync(logFilePath, `    IP: ${logEntry.ip}\n`, 'utf8');
  }
  
  if (logEntry.query) {
    fs.appendFileSync(logFilePath, `    QUERY: ${JSON.stringify(logEntry.query)}\n`, 'utf8');
  }
  
  if (logEntry.params) {
    fs.appendFileSync(logFilePath, `    PARAMS: ${JSON.stringify(logEntry.params)}\n`, 'utf8');
  }
  
  if (logEntry.contentType && logEntry.contentType !== 'none') {
    fs.appendFileSync(logFilePath, `    CONTENT_TYPE: ${logEntry.contentType}\n`, 'utf8');
  }
}

// 통합 요청/응답 로그 작성 (REQUEST + RESPONSE 합치기)
function writeCombinedRequestResponseBlock(requestId, timestamp, type, data) {
  const logEntry = {
    timestamp,
    level: type,
    requestId,
    method: data.method,
    url: data.url,
    userId: data.userId,
    status: data.status,
    duration: data.duration,
    ip: data.ip,
    requestBody: data.requestBody,
    responseBody: data.responseBody,
    query: data.query,
    params: data.params,
    contentType: data.contentType
  };
  
  writeStructuredLog(logEntry);
}

// 요청/응답 로그 작성 (기존 함수 - 호환성 유지)
function writeRequestResponseBlock(requestId, timestamp, type, data) {
  const logEntry = {
    timestamp,
    level: type,
    requestId,
    method: data.method,
    url: data.url,
    status: data.status,
    duration: data.duration,
    ip: data.ip,
    userAgent: data.userAgent?.substring(0, 50) + '...', // UA 축약
    body: data.body,
    requestBody: data.body && type === 'REQUEST' ? data.body : undefined
  };
  
  writeStructuredLog(logEntry);
}

// 에러 블록 로그 작성
function writeErrorBlock(timestamp, errorData) {
  const logEntry = {
    timestamp,
    level: 'ERROR',
    method: errorData.method,
    url: errorData.url,
    userId: errorData.userId,
    status: errorData.status,
    code: errorData.code,
    message: errorData.message,
    stack: errorData.stack
  };
  
  writeStructuredLog(logEntry);
}

function logInfo(message, meta) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message
  };
  
  if (meta) {
    fs.appendFileSync(logFilePath, `    META: ${JSON.stringify(meta)}\n`, 'utf8');
  }
  
  writeStructuredLog(logEntry);
}

function logWarn(message, meta) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    message
  };
  
  if (meta) {
    fs.appendFileSync(logFilePath, `    META: ${JSON.stringify(meta)}\n`, 'utf8');
  }
  
  writeStructuredLog(logEntry);
}

function logError(message, error, meta) {
  writeErrorBlock(new Date().toISOString(), {
    method: 'MANUAL',
    url: 'N/A',
    status: 'N/A',
    code: error?.code || 'MANUAL_ERROR',
    message,
    stack: error?.stack
  });
  
  if (meta) {
    ensureLogDir();
    fs.appendFileSync(logFilePath, `    META: ${JSON.stringify(meta)}\n`, 'utf8');
  }
}
function logResponse(req, resBody, status, duration) {
  const requestId = req.requestId || 'manual';
  writeRequestResponseBlock(requestId, new Date().toISOString(), 'RESPONSE', {
    method: req.method,
    url: req.originalUrl,
    status,
    duration,
    body: resBody
  });
}

function logTimeout(req, duration) {
  writeErrorBlock(new Date().toISOString(), {
    method: req.method,
    url: req.originalUrl,
    status: 'TIMEOUT',
    code: 'REQUEST_TIMEOUT',
    message: `Request timeout after ${duration}ms`,
    stack: undefined
  });
}

function initializeLogger() {
  ensureLogDir();
  
  // 로그 파일 새로 시작 (기존 로그는 백업)
  if (fs.existsSync(logFilePath)) {
    const backupPath = logFilePath.replace('.log', `-backup-${Date.now()}.log`);
    fs.copyFileSync(logFilePath, backupPath);
  }
  
  fs.writeFileSync(logFilePath, '', 'utf8');
  
  // 시스템 시작 로그 (간단한 형태)
  const timestamp = new Date().toISOString();
  writeStructuredLog({
    timestamp,
    level: 'SYSTEM',
    message: 'API 로깅 시스템 재시작됨 - 최적화된 구조화 로깅 활성화'
  });
  
  // 자동 로그 정리 스케줄링
  setInterval(() => cleanupLogs(7), 24 * 60 * 60 * 1000);
}

function cleanupLogs(daysToKeep = 7) {
  try {
    const files = fs.readdirSync(logDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
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

module.exports = {
  logInfo,
  logWarn,
  logError,
  logResponse,
  logTimeout,
  initializeLogger,
  cleanupLogs,
  logFilePath,
  logApiRequest,
  logApiError
};
