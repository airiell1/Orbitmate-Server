const express = require("express");
const userController = require("../controllers/userController");
const userActivityController = require("../controllers/userActivityController");
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
    const user_id = req.params.user_id || req.user?.user_id || "temp";
    cb(null, `${user_id}-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage: profileStorage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

// =========================
// 🔥 Phase 1: 핵심 기능 (사용자 인증 & 기본 정보)
// =========================

// 인증 관련 라우트
router.post("/register", userController.registerUserController);
router.post("/login", userController.loginUserController);
router.post("/check-email", userController.checkEmailExistsController);

// 프로필 관련 라우트
router.get("/:user_id/profile", userController.getUserProfileController);
router.put("/:user_id/profile", userController.updateUserProfileController);
router.post("/:user_id/profile/image", upload.any(), userController.uploadProfileImageController);
router.delete("/:user_id", userController.deleteUserController);

// 설정 관련 라우트
router.get("/:user_id/settings", userController.getUserSettingsController);
router.put("/:user_id/settings", userController.updateUserSettingsController);
router.put("/:user_id/language", userController.updateUserLanguageController);

// =========================
// 🔥 Phase 2: 중요 기능 (레벨 & 뱃지)
// =========================

// 레벨 및 경험치
router.get("/:user_id/level", userController.getUserLevelController);
router.post("/:user_id/experience", userController.addUserExperienceController);

// 뱃지 시스템
router.get("/:user_id/badges", userController.getUserBadgesController);
router.put("/:user_id/badges/:badge_id", userController.toggleUserBadgeController);

// =========================
// 🔥 Phase 3: 부가 기능 (커스터마이징 & 번역)
// =========================

// 프로필 꾸미기
router.get("/:user_id/customization", userController.getUserCustomizationController);
router.put("/:user_id/customization", userController.updateUserCustomizationController);

// =========================
// 🔥 Phase 3: 부가 기능 (사용자 활동 & 뱃지 관리)
// =========================

// 사용자 활동 관련 라우트 (userActivityController 사용)
router.post("/:user_id/bug-report", userActivityController.handleBugReportController);
router.post("/:user_id/feedback", userActivityController.handleFeedbackSubmissionController);
router.post("/:user_id/test-participation", userActivityController.handleTestParticipationController);

// 뱃지 관리 관련 라우트 (userActivityController 사용)
router.post("/:user_id/badges/upgrade", userActivityController.upgradeBadgeLevelController);
router.get("/:user_id/badge-details", userActivityController.getUserBadgeDetailsController);
router.post("/:user_id/subscription-badge", userActivityController.upgradeSubscriptionBadgeController);
router.post("/:user_id/approve-badge", userActivityController.approveBadgeUpgradeController);

module.exports = router;
