const express = require('express');
const { getUserSessionsController } = require('../controllers/sessionController');

const router = express.Router();

// 사용자의 채팅 세션 목록 조회 (인증 필요 - verifyToken 미들웨어 제거)
router.get('/:user_id/chat/sessions', getUserSessionsController);

module.exports = router;