// routes/logs.js - 로그 조회 및 스트리밍 라우트

const express = require('express');
const router = express.Router();
const {
    getLogFilesController,
    getRecentLogsController,
    streamLogsController,
    downloadLogController,
    getLogStatsController
} = require('../controllers/logController');

// 기본 로그 라우트 (API 설명)
router.get('/', (req, res) => {
    res.json({
        status: 'success',
        data: {
            message: 'Orbitmate 로그 API',
            available_endpoints: [
                'GET /api/logs/files - 로그 파일 목록',
                'GET /api/logs/recent - 최근 로그 조회',
                'GET /api/logs/stream/live - 실시간 로그 스트리밍',
                'GET /api/logs/download/:filename - 로그 파일 다운로드',
                'GET /api/logs/stats/summary - 로그 통계'
            ],
            log_viewer: 'http://localhost:3000/log'
        }
    });
});

// 로그 파일 목록 조회
router.get('/files', getLogFilesController);

// 최근 로그 조회 (필터링 지원)
router.get('/recent', getRecentLogsController);

// 실시간 로그 스트리밍 (SSE)
router.get('/stream/live', streamLogsController);

// 로그 파일 다운로드
router.get('/download/:filename', downloadLogController);

// 로그 통계 정보
router.get('/stats/summary', getLogStatsController);

module.exports = router;
