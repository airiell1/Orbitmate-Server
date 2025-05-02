const express = require('express');
const { registerUserController, loginUserController, getUserSettingsController, updateUserSettingsController } = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth'); // JWT 검증 미들웨어 가져오기

const router = express.Router();

// --- 인증 불필요 ---
// 사용자 등록
router.post('/register', registerUserController);

// 사용자 로그인
router.post('/login', loginUserController);

// --- 인증 필요 --- (verifyToken 미들웨어 추가)
// 사용자 설정 조회
router.get('/:user_id/settings', verifyToken, getUserSettingsController);

// 사용자 설정 업데이트
router.put('/:user_id/settings', verifyToken, updateUserSettingsController);

module.exports = router;