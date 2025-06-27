const {
    createController
} = require("../utils/serviceFactory");
const feedbackService = require("../services/feedbackService");
const { standardizeApiResponse } = require("../utils/apiResponse");

// =========================
// 🐛 버그 제보 컨트롤러 (Bug Report Controller)
// =========================

/**
 * 새 버그 제보 생성 컨트롤러
 */
const createBugReportController = createController(
    feedbackService.createBugReportService,
    {
        dataExtractor: (req) => {
            const { user_id } = req.body;
            const bugData = {
                title: req.body.title,
                description: req.body.description,
                severity: req.body.severity || 'medium',
                category: req.body.category || 'general',
                browserInfo: req.body.browser_info,
                stepsToReproduce: req.body.steps_to_reproduce,
                expectedBehavior: req.body.expected_behavior,
                actualBehavior: req.body.actual_behavior,
                attachmentUrls: req.body.attachment_urls || [],
                userAgent: req.get('User-Agent'),
                currentUrl: req.body.current_url
            };
            return [user_id, bugData];
        },
        validations: [
            (req) => {
                const { user_id, title, description } = req.body;
                
                if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
                    const err = new Error("사용자 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (!title || typeof title !== "string" || title.trim() === "" || title.length > 200) {
                    const err = new Error("제목은 필수이며 최대 200자입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (!description || typeof description !== "string" || description.trim() === "") {
                    const err = new Error("설명은 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                const { severity, category } = req.body;
                const validSeverities = ['low', 'medium', 'high', 'critical'];
                const validCategories = ['ui', 'api', 'performance', 'security', 'general'];
                
                if (severity && !validSeverities.includes(severity)) {
                    const err = new Error("올바르지 않은 심각도입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (category && !validCategories.includes(category)) {
                    const err = new Error("올바르지 않은 카테고리입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ],
        successStatusCode: 201
    }
);

/**
 * 버그 제보 조회 컨트롤러
 */
const getBugReportController = createController(
    feedbackService.getBugReportService,
    {
        dataExtractor: (req) => {
            const { report_id } = req.params;
            return [report_id];
        },
        validations: [
            (req) => {
                const { report_id } = req.params;
                
                if (!report_id || typeof report_id !== "string" || report_id.trim() === "") {
                    const err = new Error("버그 제보 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

/**
 * 사용자의 버그 제보 목록 조회 컨트롤러
 */
const getUserBugReportsController = createController(
    feedbackService.getUserBugReportsService,
    {
        dataExtractor: (req) => {
            const { user_id } = req.params;
            const options = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0,
                status: req.query.status,
                severity: req.query.severity
            };
            return [user_id, options];
        },
        validations: [
            (req) => {
                const { user_id } = req.params;
                
                if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
                    const err = new Error("사용자 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                const { limit, offset } = req.query;
                if (limit && (isNaN(limit) || parseInt(limit) <= 0 || parseInt(limit) > 100)) {
                    const err = new Error("limit은 1-100 사이의 숫자여야 합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (offset && (isNaN(offset) || parseInt(offset) < 0)) {
                    const err = new Error("offset은 0 이상의 숫자여야 합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

/**
 * 모든 버그 제보 목록 조회 컨트롤러 (관리자용)
 */
const getAllBugReportsController = createController(
    feedbackService.getAllBugReportsService,
    {
        dataExtractor: (req) => {
            const options = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0,
                status: req.query.status,
                severity: req.query.severity,
                category: req.query.category,
                priority: req.query.priority
            };
            return [options];
        },
        validations: [
            (req) => {
                const { limit, offset } = req.query;
                
                if (limit && (isNaN(limit) || parseInt(limit) <= 0 || parseInt(limit) > 100)) {
                    const err = new Error("limit은 1-100 사이의 숫자여야 합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (offset && (isNaN(offset) || parseInt(offset) < 0)) {
                    const err = new Error("offset은 0 이상의 숫자여야 합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

/**
 * 버그 제보 상태 업데이트 컨트롤러 (관리자용)
 */
const updateBugReportController = createController(
    feedbackService.updateBugReportService,
    {
        dataExtractor: (req) => {
            const { report_id } = req.params;
            const updateData = {};
            
            if (req.body.status !== undefined) updateData.status = req.body.status;
            if (req.body.priority !== undefined) updateData.priority = req.body.priority;
            if (req.body.assigned_to !== undefined) updateData.assignedTo = req.body.assigned_to;
            if (req.body.resolution_notes !== undefined) updateData.resolutionNotes = req.body.resolution_notes;
            
            return [report_id, updateData];
        },
        validations: [
            (req) => {
                const { report_id } = req.params;
                
                if (!report_id || typeof report_id !== "string" || report_id.trim() === "") {
                    const err = new Error("버그 제보 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                const { status, priority } = req.body;
                const validStatuses = ['open', 'in_progress', 'resolved', 'closed', 'duplicate'];
                const validPriorities = ['low', 'normal', 'high', 'urgent'];
                
                if (status && !validStatuses.includes(status)) {
                    const err = new Error("올바르지 않은 상태입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (priority && !validPriorities.includes(priority)) {
                    const err = new Error("올바르지 않은 우선순위입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (Object.keys(req.body).length === 0) {
                    const err = new Error("업데이트할 필드가 필요합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

// =========================
// 💡 피드백 컨트롤러 (Feedback Controller)
// =========================

/**
 * 새 피드백 제출 컨트롤러
 */
const createFeedbackController = createController(
    feedbackService.createFeedbackService,
    {
        dataExtractor: (req) => {
            const { user_id } = req.body;
            const feedbackData = {
                title: req.body.title,
                content: req.body.content,
                feedbackType: req.body.feedback_type || 'general',
                category: req.body.category || 'general',
                attachmentUrls: req.body.attachment_urls || []
            };
            return [user_id, feedbackData];
        },
        validations: [
            (req) => {
                const { user_id, title, content } = req.body;
                
                if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
                    const err = new Error("사용자 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (!title || typeof title !== "string" || title.trim() === "" || title.length > 200) {
                    const err = new Error("제목은 필수이며 최대 200자입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (!content || typeof content !== "string" || content.trim() === "") {
                    const err = new Error("내용은 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                const { feedback_type, category } = req.body;
                const validFeedbackTypes = ['feature_request', 'improvement', 'general', 'ui_ux', 'performance', 'content'];
                const validCategories = ['chat', 'search', 'ui', 'mobile', 'api', 'general'];
                
                if (feedback_type && !validFeedbackTypes.includes(feedback_type)) {
                    const err = new Error("올바르지 않은 피드백 유형입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (category && !validCategories.includes(category)) {
                    const err = new Error("올바르지 않은 카테고리입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ],
        successStatusCode: 201
    }
);

/**
 * 피드백 조회 컨트롤러
 */
const getFeedbackController = createController(
    feedbackService.getFeedbackService,
    {
        dataExtractor: (req) => {
            const { feedback_id } = req.params;
            return [feedback_id];
        },
        validations: [
            (req) => {
                const { feedback_id } = req.params;
                
                if (!feedback_id || typeof feedback_id !== "string" || feedback_id.trim() === "") {
                    const err = new Error("피드백 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

/**
 * 사용자의 피드백 목록 조회 컨트롤러
 */
const getUserFeedbacksController = createController(
    feedbackService.getUserFeedbacksService,
    {
        dataExtractor: (req) => {
            const { user_id } = req.params;
            const options = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0,
                status: req.query.status,
                feedbackType: req.query.feedback_type
            };
            return [user_id, options];
        },
        validations: [
            (req) => {
                const { user_id } = req.params;
                
                if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
                    const err = new Error("사용자 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

/**
 * 모든 피드백 목록 조회 컨트롤러 (관리자용)
 */
const getAllFeedbacksController = createController(
    feedbackService.getAllFeedbacksService,
    {
        dataExtractor: (req) => {
            const options = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0,
                status: req.query.status,
                feedbackType: req.query.feedback_type,
                category: req.query.category
            };
            return [options];
        },
        validations: []
    }
);

/**
 * 피드백 업데이트 컨트롤러 (관리자용)
 */
const updateFeedbackController = createController(
    feedbackService.updateFeedbackService,
    {
        dataExtractor: (req) => {
            const { feedback_id } = req.params;
            const updateData = {};
            
            if (req.body.status !== undefined) updateData.status = req.body.status;
            if (req.body.priority !== undefined) updateData.priority = req.body.priority;
            if (req.body.admin_response !== undefined) updateData.adminResponse = req.body.admin_response;
            if (req.body.implementation_notes !== undefined) updateData.implementationNotes = req.body.implementation_notes;
            
            return [feedback_id, updateData];
        },
        validations: [
            (req) => {
                const { feedback_id } = req.params;
                
                if (!feedback_id || typeof feedback_id !== "string" || feedback_id.trim() === "") {
                    const err = new Error("피드백 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                const { status, priority } = req.body;
                const validStatuses = ['submitted', 'under_review', 'planned', 'in_development', 'completed', 'rejected'];
                const validPriorities = ['low', 'normal', 'high', 'urgent'];
                
                if (status && !validStatuses.includes(status)) {
                    const err = new Error("올바르지 않은 상태입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (priority && !validPriorities.includes(priority)) {
                    const err = new Error("올바르지 않은 우선순위입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (Object.keys(req.body).length === 0) {
                    const err = new Error("업데이트할 필드가 필요합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

/**
 * 피드백 추천/비추천 컨트롤러
 */
const voteFeedbackController = createController(
    feedbackService.voteFeedbackService,
    {
        dataExtractor: (req) => {
            const { feedback_id } = req.params;
            const { vote_type } = req.body;
            return [feedback_id, vote_type];
        },
        validations: [
            (req) => {
                const { feedback_id } = req.params;
                const { vote_type } = req.body;
                
                if (!feedback_id || typeof feedback_id !== "string" || feedback_id.trim() === "") {
                    const err = new Error("피드백 ID는 필수입니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
                
                if (!vote_type || !['upvote', 'downvote'].includes(vote_type)) {
                    const err = new Error("vote_type은 'upvote' 또는 'downvote'여야 합니다.");
                    err.code = "INVALID_INPUT";
                    throw err;
                }
            }
        ]
    }
);

// =========================
// 📊 통계 컨트롤러 (Statistics Controller)
// =========================

/**
 * 버그 제보 통계 조회 컨트롤러
 */
const getBugReportStatisticsController = createController(
    feedbackService.getBugReportStatisticsService,
    {
        dataExtractor: (req) => [],
        validations: []
    }
);

/**
 * 피드백 통계 조회 컨트롤러
 */
const getFeedbackStatisticsController = createController(
    feedbackService.getFeedbackStatisticsService,
    {
        dataExtractor: (req) => [],
        validations: []
    }
);

module.exports = {
    // 버그 제보 컨트롤러
    createBugReportController,
    getBugReportController,
    getUserBugReportsController,
    getAllBugReportsController,
    updateBugReportController,
    
    // 피드백 컨트롤러
    createFeedbackController,
    getFeedbackController,
    getUserFeedbacksController,
    getAllFeedbacksController,
    updateFeedbackController,
    voteFeedbackController,
    
    // 통계 컨트롤러
    getBugReportStatisticsController,
    getFeedbackStatisticsController
};
