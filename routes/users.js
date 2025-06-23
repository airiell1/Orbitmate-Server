const express = require("express");
const {
  registerUserController,
  loginUserController,
  getUserSettingsController,
  updateUserSettingsController,
  uploadProfileImageController,
  deleteUserController,
  getUserProfileController,
  updateUserProfileController,
  checkEmailExistsController, // 수정됨
  getUserCustomizationController,
  updateUserCustomizationController,
  getUserLevelController,
  addUserExperienceController,
  getUserBadgesController,
  toggleUserBadgeController,
  getTranslationResourcesController,
  updateUserLanguageController,
  upgradeBadgeLevelController,
  handleBugReportController,
  handleFeedbackSubmissionController,
  handleTestParticipationController,
  getUserBadgeDetailsController,
  upgradeSubscriptionBadgeController,
  approveBadgeUpgradeController,
} = require("../controllers/userController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// 프로필 이미지 업로드용 Multer 설정
const profileUploadDir = path.join(__dirname, "..", "uploads", "profiles");
if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileUploadDir);
  },
  filename: function (req, file, cb) {
    // 사용자 ID와 타임스탬프를 조합하여 파일 이름 생성 (덮어쓰기 방지)
    const user_id = req.params.user_id || "temp"; // user_id가 없는 경우 대비
    cb(null, `${user_id}-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: profileStorage });

// --- 인증 불필요 ---
// 사용자 등록
router.post("/register", registerUserController);

// 이메일 중복 체크
router.post("/check-email", checkEmailExists);

// 사용자 로그인
router.post("/login", loginUserController);

// --- 인증 필요 --- (verifyToken 미들웨어 제거)
// 사용자 설정 조회
router.get("/:user_id/settings", getUserSettingsController);

// 사용자 설정 업데이트
router.put("/:user_id/settings", updateUserSettingsController);

// 프로필 이미지 업로드
router.post(
  "/:user_id/profile/image",
  upload.single("profile_image"),
  uploadProfileImageController
);

// 사용자 프로필 조회
router.get("/:user_id/profile", getUserProfileController);

// 사용자 프로필 업데이트
router.put("/:user_id/profile", updateUserProfileController);

// 사용자 삭제 (회원 탈퇴)
router.delete("/:user_id", deleteUserController);

// =========================
// 7. 프로필 꾸미기 API
// =========================

// 프로필 꾸미기 설정 조회
router.get("/:user_id/customization", getUserCustomizationController);

// 프로필 꾸미기 설정 업데이트
router.put("/:user_id/customization", updateUserCustomizationController);

// =========================
// 8. 레벨 및 경험치 API
// =========================

// 사용자 레벨 정보 조회
router.get("/:user_id/level", getUserLevelController);

// 사용자 경험치 추가 (관리자용)
router.post("/:user_id/experience", addUserExperienceController);

// =========================
// 뱃지 시스템 API
// =========================

// 사용자 뱃지 목록 조회
router.get("/:user_id/badges", getUserBadgesController);

// 뱃지 착용/해제
router.put("/:user_id/badges/:badge_id", toggleUserBadgeController);

// =========================
// 10. 다국어 지원 API
// =========================

// 번역 리소스 조회
router.get("/translations/:lang", getTranslationResourcesController);

// 사용자 언어 설정 업데이트
router.put("/:user_id/language", updateUserLanguageController);

// =========================
// 11. 뱃지 레벨 시스템 API
// =========================

// 뱃지 상세 조회
router.get("/:user_id/badge-details", getUserBadgeDetailsController);

// 버그 제보 (승인 대기)
router.post("/:user_id/bug-report", handleBugReportController);

// 피드백 제출 (승인 대기)
router.post("/:user_id/feedback", handleFeedbackSubmissionController);

// 테스트 참여 (단순 뱃지)
router.post("/:user_id/test-participation", handleTestParticipationController);

// 구독 기간 뱃지 업그레이드
router.post("/:user_id/subscription-badge", upgradeSubscriptionBadgeController);

// 개발자 뱃지 승인 (개발/관리자용)
router.post("/:user_id/approve-badge", approveBadgeUpgradeController);

// 뱃지 레벨 직접 업그레이드 (개발/테스트용)
router.post("/:user_id/badges/upgrade", upgradeBadgeLevelController);

module.exports = router;
