const express = require('express');
const { getUserSessionsController } = require('../controllers/sessionController');
const { verifyToken } = require('../middleware/auth'); // JWT 검증 미들웨어 가져오기

const router = express.Router();

// 사용자의 채팅 세션 목록 조회 (인증 필요 - verifyToken 미들웨어 추가)
router.get('/:user_id/chat/sessions', verifyToken, getUserSessionsController);

module.exports = router;