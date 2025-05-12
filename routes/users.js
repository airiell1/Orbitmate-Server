const express = require('express');
const { registerUserController, loginUserController, getUserSettingsController, updateUserSettingsController, uploadProfileImageController, deleteUserController, getUserProfileController, updateUserProfileController } = require('../controllers/userController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 프로필 이미지 업로드용 Multer 설정
const profileUploadDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(profileUploadDir)) {
    fs.mkdirSync(profileUploadDir, { recursive: true });
}

const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, profileUploadDir);
    },
    filename: function (req, file, cb) {
        // 사용자 ID와 타임스탬프를 조합하여 파일 이름 생성 (덮어쓰기 방지)
        const user_id = req.params.user_id || 'temp'; // user_id가 없는 경우 대비
        cb(null, `${user_id}-${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: profileStorage });

// --- 인증 불필요 ---
// 사용자 등록
router.post('/register', registerUserController);

// 사용자 로그인
router.post('/login', loginUserController);

// --- 인증 필요 --- (verifyToken 미들웨어 제거)
// 사용자 설정 조회
router.get('/:user_id/settings', getUserSettingsController);

// 사용자 설정 업데이트
router.put('/:user_id/settings', updateUserSettingsController);

// 사용자 프로필 이미지 업로드 (신규) - verifyToken 제거
router.post('/:user_id/profile/image', upload.single('profileImage'), uploadProfileImageController);

// 회원 탈퇴 (계정 데이터 삭제) (신규) - verifyToken 제거
router.delete('/:user_id', deleteUserController);

// 사용자 프로필 조회 (신규) - verifyToken 제거
router.get('/:user_id/profile', getUserProfileController);

// 사용자 프로필 업데이트 (신규) - verifyToken 제거
router.put('/:user_id/profile', updateUserProfileController);

module.exports = router;