const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");

// =========================
// 🐛 버그 제보 라우트 (Bug Report Routes)
// =========================

/**
 * 새 버그 제보 생성
 * POST /api/feedback/bug-reports
 * Body: { user_id, title, description, severity?, category?, browser_info?, steps_to_reproduce?, expected_behavior?, actual_behavior?, attachment_urls?, current_url? }
 */
router.post("/bug-reports", feedbackController.createBugReportController);

/**
 * 버그 제보 조회
 * GET /api/feedback/bug-reports/:report_id
 */
router.get("/bug-reports/:report_id", feedbackController.getBugReportController);

/**
 * 사용자의 버그 제보 목록 조회
 * GET /api/feedback/users/:user_id/bug-reports?limit=50&offset=0&status=open&severity=high
 */
router.get("/users/:user_id/bug-reports", feedbackController.getUserBugReportsController);

/**
 * 모든 버그 제보 목록 조회 (관리자용)
 * GET /api/feedback/bug-reports?limit=50&offset=0&status=open&severity=high&category=ui&priority=urgent
 */
router.get("/bug-reports", feedbackController.getAllBugReportsController);

/**
 * 버그 제보 상태 업데이트 (관리자용)
 * PUT /api/feedback/bug-reports/:report_id
 * Body: { status?, priority?, assigned_to?, resolution_notes? }
 */
router.put("/bug-reports/:report_id", feedbackController.updateBugReportController);

// =========================
// 💡 피드백 라우트 (Feedback Routes)
// =========================

/**
 * 새 피드백 제출
 * POST /api/feedback/feedbacks
 * Body: { user_id, title, content, feedback_type?, category?, attachment_urls? }
 */
router.post("/feedbacks", feedbackController.createFeedbackController);

/**
 * 피드백 조회
 * GET /api/feedback/feedbacks/:feedback_id
 */
router.get("/feedbacks/:feedback_id", feedbackController.getFeedbackController);

/**
 * 사용자의 피드백 목록 조회
 * GET /api/feedback/users/:user_id/feedbacks?limit=50&offset=0&status=submitted&feedback_type=feature_request
 */
router.get("/users/:user_id/feedbacks", feedbackController.getUserFeedbacksController);

/**
 * 모든 피드백 목록 조회 (관리자용)
 * GET /api/feedback/feedbacks?limit=50&offset=0&status=submitted&feedback_type=feature_request&category=ui
 */
router.get("/feedbacks", feedbackController.getAllFeedbacksController);

/**
 * 피드백 업데이트 (관리자용)
 * PUT /api/feedback/feedbacks/:feedback_id
 * Body: { status?, priority?, admin_response?, implementation_notes? }
 */
router.put("/feedbacks/:feedback_id", feedbackController.updateFeedbackController);

/**
 * 피드백 추천/비추천
 * POST /api/feedback/feedbacks/:feedback_id/vote
 * Body: { vote_type: 'upvote' | 'downvote' }
 */
router.post("/feedbacks/:feedback_id/vote", feedbackController.voteFeedbackController);

// =========================
// 📊 통계 라우트 (Statistics Routes)
// =========================

/**
 * 버그 제보 통계 조회
 * GET /api/feedback/statistics/bug-reports
 */
router.get("/statistics/bug-reports", feedbackController.getBugReportStatisticsController);

/**
 * 피드백 통계 조회
 * GET /api/feedback/statistics/feedbacks
 */
router.get("/statistics/feedbacks", feedbackController.getFeedbackStatisticsController);

module.exports = router;
