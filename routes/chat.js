const express = require('express');
const multer = require('multer'); // multer 추가
const path = require('path'); // path 추가
const fs = require('fs'); // fs 추가
const { 
  sendMessageController, 
  editMessageController, 
  addReactionController, 
  deleteMessageController, 
  removeReactionController,
  getMessageEditHistoryController,
  requestAiReresponseController,
  uploadFile,
  getSessionMessagesController
} = require('../controllers/chatController');
const { 
  createSessionController, 
  updateSessionController, 
  deleteSessionController
} = require('../controllers/sessionController');

// 구독 관리 미들웨어 import
const { requireFeature } = require('../middleware/subscription');

const router = express.Router();

// 업로드 디렉토리 설정 (app.js와 동일하게 설정)
const uploadDir = path.join(__dirname, '..', 'uploads'); // 경로 수정
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // recursive 옵션 추가
}

// Multer 설정 (파일 저장 위치 및 이름 지정)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // 파일 저장 경로
    },
    filename: function (req, file, cb) {
        // 파일 이름 중복 방지를 위해 타임스탬프 사용
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// --- 인증 없는 라우트 (MVP) ---
// 새 채팅 세션 생성
router.post('/sessions', createSessionController);

// 채팅 세션 정보 수정
router.put('/sessions/:session_id', updateSessionController);

// 채팅 세션 삭제
router.delete('/sessions/:session_id', deleteSessionController);

// 특정 세션의 메시지 목록 조회
router.get('/sessions/:session_id/messages', getSessionMessagesController);

// 채팅 메시지 전송 및 AI 응답 받기
router.post('/sessions/:session_id/messages', sendMessageController);

// 메시지 편집
router.put('/messages/:message_id', editMessageController);

// 메시지에 리액션 추가
router.post('/messages/:message_id/reaction', addReactionController);

// 채팅 메시지 삭제
router.delete('/messages/:message_id', deleteMessageController);

// 메시지 리액션 제거
router.delete('/messages/:message_id/reaction', removeReactionController);

// 메시지 편집 기록 조회
router.get('/messages/:message_id/history', getMessageEditHistoryController);

// 편집된 메시지에 대한 AI 재응답 요청
router.post('/sessions/:session_id/messages/:message_id/reresponse', requestAiReresponseController);

// 파일 업로드 라우트 추가 (구독 제한 적용)
// upload.single('file') 미들웨어는 'file'이라는 이름의 필드에서 단일 파일을 처리합니다.
router.post('/sessions/:session_id/upload', requireFeature('file_upload'), upload.single('file'), uploadFile);
router.post('/sessions/:session_id/files', upload.single('file'), uploadFile);

module.exports = router;