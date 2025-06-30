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
 * 최근 로그 조회 서비스
 */
async function getRecentLogsService(lines, level, search) {
  try {
    const data = await fs.readFile(logFilePath, 'utf8');
    let logLines = data.split('\n').filter(line => line.trim() !== '');

    // 레벨/검색 필터링은 블록 파싱 후 적용 (블록 단위 UX)
    // 최근 N줄만 가져오기는 블록 파싱 후 적용

    // 블록 파싱: 에러+스택트레이스, 응답(RESPONSE/TIMEOUT), 일반(INFO/WARN)
    const blocks = [];
    let i = 0;
    while (i < logLines.length) {
      const line = logLines[i];
      const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
      if (match) {
        let [_, timestamp, lvl, message] = match;
        // TIMEOUT은 WARN으로 강제
        if (/^TIMEOUT:/i.test(message)) lvl = 'WARN';
        if (lvl === 'ERROR') {
          // 에러 블록: 연속된 스택트레이스/에러/바디 등 포함
          const errorBlock = {
            type: 'ERROR_BLOCK',
            timestamp,
            level: lvl,
            main: message,
            stack: [],
            etc: []
          };
          let j = i + 1;
          while (j < logLines.length) {
            const next = logLines[j];
            // 스택트레이스(들여쓰기, at, Error: 등) 또는 바디/상태 등
            if (/^\s+at /.test(next) || /^\s*Error:/.test(next) || /^\s*TypeError:/.test(next) || /^\s*ReferenceError:/.test(next) || /^\s*\^/.test(next) || /^\s*~/.test(next) || /node_modules/.test(next) || /\(.*:\d+:\d+\)/.test(next)) {
              errorBlock.stack.push(next.trim());
              j++;
            } else if (/^\[.*\] \[ERROR\]/.test(next)) {
              // 연속된 ERROR: 상태/바디 등만 etc로
              const m2 = next.match(/^\[([^\]]+)\] \[ERROR\] (.+)$/);
              if (m2) {
                const msg2 = m2[2];
                if (/^(Status:|Duration:|Body:)/.test(msg2.trim())) {
                  errorBlock.etc.push(msg2.trim());
                  j++;
                  continue;
                }
              }
              break;
            } else {
              break;
            }
          }
          blocks.push(errorBlock);
          i = j;
          continue;
        } else if (/^(RESPONSE:|TIMEOUT:)/.test(message)) {
          // 응답/타임아웃 블록
          blocks.push({
            type: 'RESPONSE_BLOCK',
            timestamp,
            level: lvl,
            message
          });
          i++;
          continue;
        } else if (lvl === 'CONTINUATION' || lvl === 'STACK_TRACE') {
          // CONTINUATION/STACK_TRACE 등은 무시 (이미 블록에 포함됨)
          i++;
          continue;
        } else {
          // 일반 블록
          blocks.push({
            type: 'LOG',
            timestamp,
            level: lvl,
            message
          });
          i++;
          continue;
        }
      } else {
        // 스택트레이스/들여쓰기 등은 직전 에러에 포함됨(위에서 처리)
        i++;
      }
    }

    // 필터/검색/라인 제한 적용 (블록 단위)
    let filteredBlocks = blocks;
    if (level !== 'all') {
      filteredBlocks = filteredBlocks.filter(b => (b.level || '').toUpperCase() === level.toUpperCase());
    }
    if (search) {
      filteredBlocks = filteredBlocks.filter(b => {
        return Object.values(b).some(v => typeof v === 'string' && v.toLowerCase().includes(search.toLowerCase()))
          || (Array.isArray(b.stack) && b.stack.some(s => s.toLowerCase().includes(search.toLowerCase())))
          || (Array.isArray(b.etc) && b.etc.some(s => s.toLowerCase().includes(search.toLowerCase())));
      });
    }
    // 최근 N개 블록만
    filteredBlocks = filteredBlocks.slice(-lines);

    return {
      total_lines: logLines.length,
      returned_lines: filteredBlocks.length,
      filters: { level, search, lines },
      logs: filteredBlocks
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

    // 주기적으로 파일 변경 확인 (1초마다)
    const checkInterval = setInterval(async () => {
      try {
        const stats = await fs.stat(logFilePath);
        if (stats.size > lastPosition) {
          // 새로운 내용이 추가됨
          const stream = require('fs').createReadStream(logFilePath, {
            start: lastPosition,
            encoding: 'utf8'
          });
          let buffer = '';
          let blockBuffer = [];
          stream.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 마지막 불완전한 줄은 버퍼에 보관
            for (let idx = 0; idx < lines.length; idx++) {
              const line = lines[idx];
              if (!line.trim()) continue;
              // CONTINUATION, STACK_TRACE 등 불필요한 라인 무시
              if (line.startsWith('CONTINUATION') || line.startsWith('STACK_TRACE')) continue;
              const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
              if (match) {
                let [_, timestamp, lvl, message] = match;
                // TIMEOUT은 WARN으로 강제
                if (/^TIMEOUT:/i.test(message)) lvl = 'WARN';
                if (lvl === 'ERROR') {
                  // 에러 블록 시작
                  const errorBlock = {
                    type: 'ERROR_BLOCK',
                    timestamp,
                    level: lvl,
                    main: message,
                    stack: [],
                    etc: []
                  };
                  let j = idx + 1;
                  while (j < lines.length) {
                    const next = lines[j];
                    if (/^\s+at /.test(next) || /^\s*Error:/.test(next) || /^\s*TypeError:/.test(next) || /^\s*ReferenceError:/.test(next) || /^\s*\^/.test(next) || /^\s*~/.test(next) || /node_modules/.test(next) || /\(.*:\d+:\d+\)/.test(next)) {
                      errorBlock.stack.push(next.trim());
                      j++;
                    } else if (/^\[.*\] \[ERROR\]/.test(next)) {
                      const m2 = next.match(/^\[([^\]]+)\] \[ERROR\] (.+)$/);
                      if (m2) {
                        const msg2 = m2[2];
                        if (/^(Status:|Duration:|Body:)/.test(msg2.trim())) {
                          errorBlock.etc.push(msg2.trim());
                          j++;
                          continue;
                        }
                      }
                      break;
                    } else {
                      break;
                    }
                  }
                  res.write(`data: ${JSON.stringify(errorBlock)}\n\n`);
                  idx = j - 1;
                  continue;
                } else if (/^(RESPONSE:|TIMEOUT:)/.test(message)) {
                  // 응답/타임아웃 블록
                  res.write(`data: ${JSON.stringify({
                    type: 'RESPONSE_BLOCK',
                    timestamp,
                    level: lvl,
                    message
                  })}\n\n`);
                  continue;
                } else {
                  // 일반 블록
                  res.write(`data: ${JSON.stringify({
                    type: 'LOG',
                    timestamp,
                    level: lvl,
                    message
                  })}\n\n`);
                  continue;
                }
              } // else: 스택트레이스/들여쓰기 등은 위에서 처리
            }
            lastPosition = stats.size;
          });
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('로그 스트리밍 오류:', error);
        }
      }
    }, 1000);

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
