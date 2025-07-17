const express = require('express');
const { getUserSessionsController, getAllSessionsForAdminController } = require('../controllers/sessionController');

const router = express.Router();

// 사용자의 채팅 세션 목록 조회 (MVP - 인증 없음)
router.get('/:user_id/chat/sessions', getUserSessionsController);

// 관리자용 전체 세션 조회 (관리자 권한은 컨트롤러에서 확인)
router.post('/admin/all', getAllSessionsForAdminController);

module.exports = router;