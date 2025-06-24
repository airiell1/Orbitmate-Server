const express = require("express");
const authController = require("../controllers/authController");
const userProfileController = require("../controllers/userProfileController");
const userSettingsController = require("../controllers/userSettingsController");
const userActivityController = require("../controllers/userActivityController");
// const translationController = require("../controllers/translationController"); // Will be in a separate router

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
    const user_id = req.params.user_id || req.user?.user_id || "temp"; // 인증된 사용자 ID 또는 파라미터 사용
    cb(null, `${user_id}-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: profileStorage });

// --- 인증 관련 라우트 (authController) ---
router.post("/register", authController.registerUserController);
router.post("/login", authController.loginUserController);
router.post("/check-email", authController.checkEmailExistsController);


// --- 사용자 프로필 관련 라우트 (userProfileController) ---
// (주의: :user_id 파라미터를 사용하는 라우트는 인증 미들웨어 뒤에 오는 것이 일반적)
// (MVP에서는 인증 미들웨어가 모든 라우트에 적용되지 않았을 수 있으므로, 우선 그대로 둠)
router.get("/:user_id/profile", userProfileController.getUserProfileController);
router.put("/:user_id/profile", userProfileController.updateUserProfileController);
router.post(
  "/:user_id/profile/image",
  upload.single("profile_image"), // multer 미들웨어는 해당 라우트에만 적용
  userProfileController.uploadProfileImageController
);
// 사용자 삭제(회원 탈퇴)는 중요한 작업이므로, user_id를 명시적으로 받고, 강력한 인증/인가 필요
router.delete("/:user_id", userProfileController.deleteUserController);


// --- 사용자 설정 관련 라우트 (userSettingsController) ---
router.get("/:user_id/settings", userSettingsController.getUserSettingsController);
router.put("/:user_id/settings", userSettingsController.updateUserSettingsController);
router.put("/:user_id/language", userSettingsController.updateUserLanguageController);


// --- 사용자 활동/참여 관련 라우트 (userActivityController) ---
// 프로필 꾸미기
router.get("/:user_id/customization", userActivityController.getUserCustomizationController);
router.put("/:user_id/customization", userActivityController.updateUserCustomizationController);

// 레벨 및 경험치
router.get("/:user_id/level", userActivityController.getUserLevelController);
router.post("/:user_id/experience", userActivityController.addUserExperienceController); // 관리자용 또는 특정 액션용

// 뱃지 시스템
router.get("/:user_id/badges", userActivityController.getUserBadgesController);
router.put("/:user_id/badges/:badge_id", userActivityController.toggleUserBadgeController);
router.get("/:user_id/badge-details", userActivityController.getUserBadgeDetailsController); // 특정 뱃지 조회 또는 전체
router.post("/:user_id/badges/upgrade", userActivityController.upgradeBadgeLevelController); // 개발/테스트용

// 사용자 활동 (버그리포트, 피드백 등)
router.post("/:user_id/bug-report", userActivityController.handleBugReportController);
router.post("/:user_id/feedback", userActivityController.handleFeedbackSubmissionController);
router.post("/:user_id/test-participation", userActivityController.handleTestParticipationController);

// 구독 관련 뱃지 (이 부분은 subscriptionController로 가는 것이 더 적절할 수 있으나, userActivity의 결과로 볼 수도 있음)
router.post("/:user_id/subscription-badge", userActivityController.upgradeSubscriptionBadgeController);
router.post("/:user_id/approve-badge", userActivityController.approveBadgeUpgradeController); // 관리자용


// 번역 리소스 조회 라우트는 여기서 제거하고, 별도의 translations.js 라우터 파일로 이동합니다.
// router.get("/translations/:lang", translationController.getTranslationResourcesController);


module.exports = router;
