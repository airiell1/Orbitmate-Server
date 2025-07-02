// controllers/logController.js - 로그 조회 및 스트리밍 컨트롤러 (ServiceFactory 패턴)

const fs = require('fs').promises;
const path = require('path');
const { 
  createController
} = require('../utils/serviceFactory');
const { standardizeApiResponse } = require('../utils/apiResponse');

// 로그 파일 경로
const logFilePath = path.join(__dirname, '..', 'logs', 'api.log');

// =========================
// 📝 로그 서비스 함수들 (ServiceFactory와 호환)
// =========================

/**
 * 로그 파일 목록 조회 서비스
 */
async function getLogFilesService() {
  const logDir = path.join(__dirname, '..', 'logs');
  
  try {
    const files = await fs.readdir(logDir);
    const logFiles = files
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logDir, file)
      }));
    
    return logFiles;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * 최근 로그 조회 서비스 (최적화된 구조화 로그 파싱)
 */
async function getRecentLogsService(lines, level, search) {
  try {
    const data = await fs.readFile(logFilePath, 'utf8');
    let logLines = data.split('\n').filter(line => line.trim() !== '');
    
    // 구조화된 로그 파싱
    let logs = [];
    let currentLog = null;
    
    for (const line of logLines) {
      const trimmed = line.trim();
      
      // 메인 로그 라인 감지 (타임스탬프로 시작)
      if (trimmed.startsWith('[') && trimmed.includes('] [')) {
        // 이전 로그 완료
        if (currentLog) {
          logs.push(currentLog);
        }
        
        // 새 로그 파싱
        currentLog = parseStructuredLogLine(trimmed);
      }
      // 추가 정보 라인들 (들여쓰기로 시작)
      else if (trimmed.startsWith('    ') && currentLog) {
        if (trimmed.startsWith('    1.') || trimmed.match(/^\s+\d+\./)) {
          // 스택 트레이스 라인
          if (!currentLog.stack) currentLog.stack = [];
          currentLog.stack.push(trimmed.replace(/^\s+\d+\.\s*/, ''));
        } else if (trimmed.startsWith('    BODY:')) {
          // 기존 응답 바디 (호환성)
          try {
            currentLog.body = JSON.parse(trimmed.replace('    BODY:', '').trim());
          } catch (e) {
            currentLog.body = trimmed.replace('    BODY:', '').trim();
          }
        } else if (trimmed.startsWith('    RES_BODY:')) {
          // 새로운 응답 바디 형식
          try {
            currentLog.responseBody = JSON.parse(trimmed.replace('    RES_BODY:', '').trim());
          } catch (e) {
            currentLog.responseBody = trimmed.replace('    RES_BODY:', '').trim();
          }
        } else if (trimmed.startsWith('    REQ_BODY:')) {
          // 요청 바디
          try {
            currentLog.requestBody = JSON.parse(trimmed.replace('    REQ_BODY:', '').trim());
          } catch (e) {
            currentLog.requestBody = trimmed.replace('    REQ_BODY:', '').trim();
          }
        } else if (trimmed.startsWith('    IP:')) {
          currentLog.ip = trimmed.replace('    IP:', '').trim();
        } else if (trimmed.startsWith('    QUERY:')) {
          try {
            currentLog.query = JSON.parse(trimmed.replace('    QUERY:', '').trim());
          } catch (e) {
            currentLog.query = trimmed.replace('    QUERY:', '').trim();
          }
        } else if (trimmed.startsWith('    PARAMS:')) {
          try {
            currentLog.params = JSON.parse(trimmed.replace('    PARAMS:', '').trim());
          } catch (e) {
            currentLog.params = trimmed.replace('    PARAMS:', '').trim();
          }
        } else if (trimmed.startsWith('    CONTENT_TYPE:')) {
          currentLog.contentType = trimmed.replace('    CONTENT_TYPE:', '').trim();
        } else if (trimmed.startsWith('    META:')) {
          // 메타 정보
          try {
            currentLog.meta = JSON.parse(trimmed.replace('    META:', '').trim());
          } catch (e) {
            currentLog.meta = trimmed.replace('    META:', '').trim();
          }
        }
      }
    }
    
    // 마지막 로그 추가
    if (currentLog) {
      logs.push(currentLog);
    }
    
    // level/type 필터
    if (level !== 'all') {
      logs = logs.filter(l => {
        const logLevel = l.level || l.type || '';
        return logLevel.toUpperCase() === level.toUpperCase();
      });
    }
    
    // 검색 필터
    if (search) {
      logs = logs.filter(l => JSON.stringify(l).toLowerCase().includes(search.toLowerCase()));
    }
    
    logs = logs.slice(-lines);
    
    return {
      total_lines: logLines.length,
      returned_lines: logs.length,
      filters: { level, search, lines },
      logs
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        total_lines: 0,
        returned_lines: 0,
        filters: { level, search, lines },
        logs: [],
        message: '로그 파일이 존재하지 않습니다.'
      };
    }
    throw error;
  }
}

/**
 * 구조화된 로그 라인 파싱 함수
 */
function parseStructuredLogLine(line) {
  // [timestamp] [level] [requestId] method url status duration code "message"
  const parts = [];
  let current = '';
  let inQuotes = false;
  let inBrackets = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '[' && !inQuotes) {
      inBrackets = true;
      current += char;
    } else if (char === ']' && !inQuotes && inBrackets) {
      inBrackets = false;
      current += char;
      if (current.trim()) {
        parts.push(current.trim());
        current = '';
      }
    } else if (char === '"' && !inBrackets) {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ' ' && !inQuotes && !inBrackets) {
      if (current.trim()) {
        parts.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  // 파싱된 결과를 객체로 변환
  const result = {
    type: 'STRUCTURED_LOG'
  };
  
  let partIndex = 0;
  
  // 타임스탬프
  if (parts[partIndex] && parts[partIndex].startsWith('[') && parts[partIndex].endsWith(']')) {
    result.timestamp = parts[partIndex].slice(1, -1);
    partIndex++;
  }
  
  // 레벨
  if (parts[partIndex] && parts[partIndex].startsWith('[') && parts[partIndex].endsWith(']')) {
    result.level = parts[partIndex].slice(1, -1);
    partIndex++;
  }
  
  // 요청 ID (옵션)
  if (parts[partIndex] && parts[partIndex].startsWith('[') && parts[partIndex].endsWith(']')) {
    result.requestId = parts[partIndex].slice(1, -1);
    partIndex++;
  }
  
  // 나머지 파트들 파싱
  const remainingParts = parts.slice(partIndex);
  
  for (const part of remainingParts) {
    if (part.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS)$/)) {
      result.method = part;
    } else if (part.startsWith('/')) {
      result.url = part;
    } else if (part.match(/^\d+$/)) {
      result.status = parseInt(part);
    } else if (part.endsWith('ms')) {
      result.duration = parseInt(part.replace('ms', ''));
    } else if (part.startsWith('"') && part.endsWith('"')) {
      result.message = part.slice(1, -1);
    } else if (part.match(/^[A-Z_]+$/)) {
      result.code = part;
    }
  }
  
  return result;
}

/**
 * 로그 통계 조회 서비스
 */
async function getLogStatsService() {
  try {
    const data = await fs.readFile(logFilePath, 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    // 레벨별 카운트
    const levelCounts = {
      INFO: 0,
      ERROR: 0,
      WARN: 0,
      UNKNOWN: 0
    };
    
    // 시간대별 분석 (최근 24시간)
    const hourlyStats = {};
    
    lines.forEach(line => {
      // 레벨 카운트
      if (line.includes('[INFO]')) levelCounts.INFO++;
      else if (line.includes('[ERROR]')) levelCounts.ERROR++;
      else if (line.includes('[WARN]')) levelCounts.WARN++;
      else levelCounts.UNKNOWN++;
      
      // 시간대별 분석
      const match = line.match(/^\[([^\]]+)\]/);
      if (match) {
        try {
          const timestamp = new Date(match[1]);
          const hourKey = `${timestamp.getHours()}:00`;
          if (!hourlyStats[hourKey]) hourlyStats[hourKey] = 0;
          hourlyStats[hourKey]++;
        } catch (e) {
          // 타임스탬프 파싱 실패 시 무시
        }
      }
    });
    
    const stats = await fs.stat(logFilePath);
    
    return {
      file_info: {
        size_bytes: stats.size,
        size_mb: (stats.size / 1024 / 1024).toFixed(2),
        modified: stats.mtime,
        created: stats.ctime
      },
      log_counts: {
        total_lines: lines.length,
        by_level: levelCounts
      },
      hourly_distribution: hourlyStats
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        file_info: null,
        log_counts: { total_lines: 0, by_level: { INFO: 0, ERROR: 0, WARN: 0, UNKNOWN: 0 } },
        hourly_distribution: {},
        message: '로그 파일이 존재하지 않습니다.'
      };
    }
    throw error;
  }
}

// =========================
// 📝 ServiceFactory 기반 컨트롤러들
// =========================

/**
 * 로그 파일 목록 조회 컨트롤러
 * GET /api/logs/files
 */
const getLogFilesController = createController(
  getLogFilesService,
  {
    dataExtractor: (req) => [],
    errorContext: 'log_files_fetch',
    useTransaction: false  // 파일 시스템 작업이므로 트랜잭션 불필요
  }
);

/**
 * 최근 로그 조회 컨트롤러
 * GET /api/logs/recent?lines=500&level=all&search=
 */
const getRecentLogsController = createController(
  getRecentLogsService,
  {
    dataExtractor: (req) => {
      const lines = parseInt(req.query.lines) || 500;
      const level = req.query.level || 'all';
      const search = req.query.search || '';
      return [lines, level, search];
    },
    errorContext: 'recent_logs_fetch',
    useTransaction: false  // 파일 시스템 작업이므로 트랜잭션 불필요
  }
);

/**
 * 로그 통계 조회 컨트롤러
 * GET /api/logs/stats/summary
 */
const getLogStatsController = createController(
  getLogStatsService,
  {
    dataExtractor: (req) => [],
    errorContext: 'log_stats_fetch',
    useTransaction: false  // 파일 시스템 작업이므로 트랜잭션 불필요
  }
);

/**
 * 로그 파일 다운로드 컨트롤러
 * GET /api/logs/download/:filename
 */
async function downloadLogController(req, res, next) {
  try {
    const filename = req.params.filename;
    const logDir = path.join(__dirname, '..', 'logs');
    const filePath = path.join(logDir, filename);
    
    // 보안: 디렉토리 탐색 방지
    if (!filePath.startsWith(logDir) || !filename.endsWith('.log')) {
      const error = new Error('잘못된 파일 요청입니다.');
      error.code = 'INVALID_REQUEST';
      throw error;
    }
    
    try {
      await fs.access(filePath);
      res.download(filePath, filename);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const err = new Error('로그 파일을 찾을 수 없습니다.');
        err.code = 'FILE_NOT_FOUND';
        throw err;
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
}

/**
 * 실시간 로그 스트리밍 컨트롤러 (SSE)
 * GET /api/logs/stream/live
 */
async function streamLogsController(req, res, next) {
  try {
    // SSE 헤더 설정
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 연결 확인 메시지
    res.write(`data: ${JSON.stringify({ 
      type: 'connected', 
      message: '로그 스트리밍 연결됨',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // 파일 변경 감지를 위한 watcher
    let lastPosition = 0;
    
    // 파일 존재 확인
    try {
      const stats = await fs.stat(logFilePath);
      lastPosition = stats.size;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // 주기적으로 파일 변경 확인 (2초마다 - 로그 블록이 완성될 시간을 줌)
    const checkInterval = setInterval(async () => {
      try {
        const stats = await fs.stat(logFilePath);
        if (stats.size > lastPosition) {
          // 약간의 지연을 두어 로그 블록이 완전히 쓰여질 때까지 기다림
          setTimeout(async () => {
            try {
              // 새로운 내용이 추가됨 - 스트림으로 새로운 부분만 읽기
              const stream = require('fs').createReadStream(logFilePath, {
                start: lastPosition,
                encoding: 'utf8'
              });
              
              let newContent = '';
              
              stream.on('data', (chunk) => {
                newContent += chunk;
              });
              
              stream.on('end', () => {
                if (newContent.trim()) {
                  // 새로운 로그들을 파싱
                  const newLogs = [];
                  const lines = newContent.split('\n');
                  let currentLog = null;
                  
                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    
                    // 메인 로그 라인 감지 (타임스탬프로 시작)
                    if (trimmed.startsWith('[') && trimmed.includes('] [')) {
                      // 이전 로그 완료
                      if (currentLog) {
                        newLogs.push(currentLog);
                      }
                      
                      // 새 로그 파싱
                      currentLog = parseStructuredLogLine(trimmed);
                    }
                    // 추가 정보 라인들 (들여쓰기로 시작)
                    else if (trimmed.startsWith('    ') && currentLog) {
                      if (trimmed.startsWith('    1.') || trimmed.match(/^\s+\d+\./)) {
                        // 스택 트레이스 라인
                        if (!currentLog.stack) currentLog.stack = [];
                        currentLog.stack.push(trimmed.replace(/^\s+\d+\.\s*/, ''));
                      } else if (trimmed.startsWith('    RES_BODY:')) {
                        // 응답 바디
                        try {
                          currentLog.responseBody = JSON.parse(trimmed.replace('    RES_BODY:', '').trim());
                        } catch (e) {
                          currentLog.responseBody = trimmed.replace('    RES_BODY:', '').trim();
                        }
                      } else if (trimmed.startsWith('    REQ_BODY:')) {
                        // 요청 바디
                        try {
                          currentLog.requestBody = JSON.parse(trimmed.replace('    REQ_BODY:', '').trim());
                        } catch (e) {
                          currentLog.requestBody = trimmed.replace('    REQ_BODY:', '').trim();
                        }
                      } else if (trimmed.startsWith('    IP:')) {
                        currentLog.ip = trimmed.replace('    IP:', '').trim();
                      } else if (trimmed.startsWith('    QUERY:')) {
                        try {
                          currentLog.query = JSON.parse(trimmed.replace('    QUERY:', '').trim());
                        } catch (e) {
                          currentLog.query = trimmed.replace('    QUERY:', '').trim();
                        }
                      } else if (trimmed.startsWith('    PARAMS:')) {
                        try {
                          currentLog.params = JSON.parse(trimmed.replace('    PARAMS:', '').trim());
                        } catch (e) {
                          currentLog.params = trimmed.replace('    PARAMS:', '').trim();
                        }
                      } else if (trimmed.startsWith('    CONTENT_TYPE:')) {
                        currentLog.contentType = trimmed.replace('    CONTENT_TYPE:', '').trim();
                      }
                    }
                  }
                  
                  // 모든 완성된 로그들을 전송 (마지막 로그는 다음에 완성될 수도 있으므로 제외)
                  for (const log of newLogs) {
                    res.write(`data: ${JSON.stringify(log)}\n\n`);
                  }
                  
                  // 현재 처리 중인 로그가 완전히 끝난 것 같으면 전송
                  if (currentLog && newContent.includes('\n    ') && !newContent.trim().endsWith('    ')) {
                    res.write(`data: ${JSON.stringify(currentLog)}\n\n`);
                  }
                }
                
                lastPosition = stats.size;
              });
            } catch (error) {
              console.error('지연된 로그 스트리밍 오류:', error);
            }
          }, 200); // 200ms 지연
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('로그 스트리밍 오류:', error);
        }
      }
    }, 2000); // 2초마다 체크

    // 연결 종료 시 정리
    req.on('close', () => {
      clearInterval(checkInterval);
      console.log('로그 스트리밍 연결 종료');
    });

    req.on('end', () => {
      clearInterval(checkInterval);
      console.log('로그 스트리밍 연결 종료');
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLogFilesController,
  getRecentLogsController,
  streamLogsController,
  downloadLogController,
  getLogStatsController
};
