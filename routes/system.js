// routes/system.js - 시스템 관련 라우트

const express = require('express');
const router = express.Router();
const { getModelLockStatusController, getSystemInfoController } = require('../controllers/systemController');

/**
 * 시스템 정보 조회
 * GET /api/system/info
 */
router.get('/info', getSystemInfoController);

/**
 * 모델 락 상태 조회
 * GET /api/system/model-lock-status
 */
router.get('/model-lock-status', getModelLockStatusController);

module.exports = router;
