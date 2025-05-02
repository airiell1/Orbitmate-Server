const express = require('express');
const { sendMessageController, editMessageController, addReactionController, deleteMessageController, removeReactionController } = require('../controllers/chatController');
const { 
  createSessionController, 
  updateSessionController, 
  getSessionMessagesController,
  deleteSessionController // 추가
} = require('../controllers/sessionController');
const { verifyToken } = require('../middleware/auth'); // JWT 검증 미들웨어 가져오기

const router = express.Router();

// --- 인증 필요한 라우트 --- (verifyToken 미들웨어 추가)
// 새 채팅 세션 생성
router.post('/sessions', verifyToken, createSessionController);

// 채팅 세션 정보 수정
router.put('/sessions/:session_id', verifyToken, updateSessionController);

// 채팅 세션 삭제 // 추가
router.delete('/sessions/:session_id', verifyToken, deleteSessionController);

// 특정 세션의 메시지 목록 조회
router.get('/sessions/:session_id/messages', verifyToken, getSessionMessagesController);

// 채팅 메시지 전송 및 AI 응답 받기
router.post('/sessions/:session_id/messages', verifyToken, sendMessageController);

// 메시지 편집
router.put('/messages/:message_id', verifyToken, editMessageController);

// 메시지에 리액션 추가
router.post('/messages/:message_id/reaction', verifyToken, addReactionController);

// 채팅 메시지 삭제
router.delete('/messages/:message_id', verifyToken, deleteMessageController);

// 메시지 리액션 제거
router.delete('/messages/:message_id/reaction', verifyToken, removeReactionController);

// 파일 업로드 라우트 추가
// upload.single('file') 미들웨어는 'file'이라는 이름의 필드에서 단일 파일을 처리합니다.
router.post('/sessions/:session_id/files', verifyToken, upload.single('file'), chatController.uploadFile);

module.exports = router;