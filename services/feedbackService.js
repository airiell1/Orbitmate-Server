const { withTransaction } = require("../utils/dbUtils");
const feedbackModel = require("../models/feedback");

// =========================
// 🐛 버그 제보 서비스 (Bug Report Service)
// =========================

/**
 * 새 버그 제보 생성 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} bugData - 버그 제보 데이터
 * @returns {Promise<Object>} 생성된 버그 제보 정보
 */
async function createBugReportService(userId, bugData) {
    return await withTransaction(async (connection) => {
        // 입력값 검증
        if (!userId || !bugData || !bugData.title || !bugData.description) {
            const error = new Error("사용자 ID, 제목, 설명은 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        // 브라우저 정보 자동 수집 (클라이언트에서 전달받은 경우)
        const enhancedBugData = {
            ...bugData,
            browserInfo: bugData.browserInfo || {
                userAgent: bugData.userAgent || 'Unknown',
                timestamp: new Date().toISOString(),
                url: bugData.currentUrl || 'Unknown'
            }
        };

        const bugReport = await feedbackModel.createBugReport(connection, userId, enhancedBugData);
        
        // TODO: 알림 시스템 연동 (관리자에게 새 버그 제보 알림)
        // await notificationService.notifyAdmins('new_bug_report', bugReport);
        
        return bugReport;
    });
}

/**
 * 버그 제보 조회 서비스
 * @param {string} reportId - 버그 제보 ID
 * @returns {Promise<Object|null>} 버그 제보 정보
 */
async function getBugReportService(reportId) {
    return await withTransaction(async (connection) => {
        if (!reportId) {
            const error = new Error("버그 제보 ID는 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        return await feedbackModel.getBugReportById(connection, reportId);
    });
}

/**
 * 사용자의 버그 제보 목록 조회 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} [options] - 조회 옵션
 * @returns {Promise<Array>} 버그 제보 목록
 */
async function getUserBugReportsService(userId, options = {}) {
    return await withTransaction(async (connection) => {
        if (!userId) {
            const error = new Error("사용자 ID는 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        return await feedbackModel.getUserBugReports(connection, userId, options);
    });
}

/**
 * 모든 버그 제보 목록 조회 서비스 (관리자용)
 * @param {Object} [options] - 조회 옵션
 * @returns {Promise<Array>} 버그 제보 목록
 */
async function getAllBugReportsService(options = {}) {
    return await withTransaction(async (connection) => {
        return await feedbackModel.getAllBugReports(connection, options);
    });
}

/**
 * 버그 제보 상태 업데이트 서비스 (관리자용)
 * @param {string} reportId - 버그 제보 ID
 * @param {Object} updateData - 업데이트 데이터
 * @returns {Promise<Object>} 업데이트된 버그 제보 정보
 */
async function updateBugReportService(reportId, updateData) {
    return await withTransaction(async (connection) => {
        if (!reportId || !updateData || Object.keys(updateData).length === 0) {
            const error = new Error("버그 제보 ID와 업데이트 데이터는 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        const updatedReport = await feedbackModel.updateBugReport(connection, reportId, updateData);
        
        // TODO: 상태 변경 시 제보자에게 알림
        // if (updateData.status) {
        //     await notificationService.notifyUser(updatedReport.user_id, 'bug_report_status_changed', updatedReport);
        // }
        
        return updatedReport;
    });
}

// =========================
// 💡 피드백 서비스 (Feedback Service)
// =========================

/**
 * 새 피드백 제출 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} feedbackData - 피드백 데이터
 * @returns {Promise<Object>} 생성된 피드백 정보
 */
async function createFeedbackService(userId, feedbackData) {
    return await withTransaction(async (connection) => {
        // 입력값 검증
        if (!userId || !feedbackData || !feedbackData.title || !feedbackData.content) {
            const error = new Error("사용자 ID, 제목, 내용은 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        const feedback = await feedbackModel.createFeedback(connection, userId, feedbackData);
        
        // TODO: 알림 시스템 연동 (관리자에게 새 피드백 알림)
        // await notificationService.notifyAdmins('new_feedback', feedback);
        
        return feedback;
    });
}

/**
 * 피드백 조회 서비스
 * @param {string} feedbackId - 피드백 ID
 * @returns {Promise<Object|null>} 피드백 정보
 */
async function getFeedbackService(feedbackId) {
    return await withTransaction(async (connection) => {
        if (!feedbackId) {
            const error = new Error("피드백 ID는 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        return await feedbackModel.getFeedbackById(connection, feedbackId);
    });
}

/**
 * 사용자의 피드백 목록 조회 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} [options] - 조회 옵션
 * @returns {Promise<Array>} 피드백 목록
 */
async function getUserFeedbacksService(userId, options = {}) {
    return await withTransaction(async (connection) => {
        if (!userId) {
            const error = new Error("사용자 ID는 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        return await feedbackModel.getUserFeedbacks(connection, userId, options);
    });
}

/**
 * 모든 피드백 목록 조회 서비스 (관리자용)
 * @param {Object} [options] - 조회 옵션
 * @returns {Promise<Array>} 피드백 목록
 */
async function getAllFeedbacksService(options = {}) {
    return await withTransaction(async (connection) => {
        return await feedbackModel.getAllFeedbacks(connection, options);
    });
}

/**
 * 피드백 업데이트 서비스 (관리자용)
 * @param {string} feedbackId - 피드백 ID
 * @param {Object} updateData - 업데이트 데이터
 * @returns {Promise<Object>} 업데이트된 피드백 정보
 */
async function updateFeedbackService(feedbackId, updateData) {
    return await withTransaction(async (connection) => {
        if (!feedbackId || !updateData || Object.keys(updateData).length === 0) {
            const error = new Error("피드백 ID와 업데이트 데이터는 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        const updatedFeedback = await feedbackModel.updateFeedback(connection, feedbackId, updateData);
        
        // TODO: 상태 변경 시 제출자에게 알림
        // if (updateData.status) {
        //     await notificationService.notifyUser(updatedFeedback.user_id, 'feedback_status_changed', updatedFeedback);
        // }
        
        return updatedFeedback;
    });
}

/**
 * 피드백 추천/비추천 서비스
 * @param {string} feedbackId - 피드백 ID
 * @param {string} voteType - 추천 유형 ('upvote' 또는 'downvote')
 * @returns {Promise<Object>} 업데이트된 추천수 정보
 */
async function voteFeedbackService(feedbackId, voteType) {
    return await withTransaction(async (connection) => {
        if (!feedbackId || !voteType) {
            const error = new Error("피드백 ID와 추천 유형은 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        if (!['upvote', 'downvote'].includes(voteType)) {
            const error = new Error("추천 유형은 'upvote' 또는 'downvote'여야 합니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        return await feedbackModel.voteFeedback(connection, feedbackId, voteType);
    });
}

// =========================
// 📊 통계 서비스 (Statistics Service)
// =========================

/**
 * 버그 제보 통계 조회 서비스
 * @returns {Promise<Object>} 버그 제보 통계
 */
async function getBugReportStatisticsService() {
    return await withTransaction(async (connection) => {
        // 상태별 버그 제보 수
        const statusSql = `
            SELECT status, COUNT(*) as count
            FROM bug_reports
            GROUP BY status
        `;

        // 심각도별 버그 제보 수
        const severitySql = `
            SELECT severity, COUNT(*) as count
            FROM bug_reports
            GROUP BY severity
        `;

        // 카테고리별 버그 제보 수
        const categorySql = `
            SELECT category, COUNT(*) as count
            FROM bug_reports
            GROUP BY category
        `;

        // 최근 30일 버그 제보 추이
        const trendSql = `
            SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count
            FROM bug_reports
            WHERE created_at >= SYSDATE - 30
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
            ORDER BY date
        `;

        const [statusResult, severityResult, categoryResult, trendResult] = await Promise.all([
            connection.execute(statusSql, {}, { autoCommit: false }),
            connection.execute(severitySql, {}, { autoCommit: false }),
            connection.execute(categorySql, {}, { autoCommit: false }),
            connection.execute(trendSql, {}, { autoCommit: false })
        ]);

        return {
            status_distribution: statusResult.rows.map(row => ({ 
                status: row[0], 
                count: row[1] 
            })),
            severity_distribution: severityResult.rows.map(row => ({ 
                severity: row[0], 
                count: row[1] 
            })),
            category_distribution: categoryResult.rows.map(row => ({ 
                category: row[0], 
                count: row[1] 
            })),
            recent_trend: trendResult.rows.map(row => ({ 
                date: row[0], 
                count: row[1] 
            }))
        };
    });
}

/**
 * 피드백 통계 조회 서비스
 * @returns {Promise<Object>} 피드백 통계
 */
async function getFeedbackStatisticsService() {
    return await withTransaction(async (connection) => {
        // 상태별 피드백 수
        const statusSql = `
            SELECT status, COUNT(*) as count
            FROM feedback_reports
            GROUP BY status
        `;

        // 피드백 유형별 수
        const typeSql = `
            SELECT feedback_type, COUNT(*) as count
            FROM feedback_reports
            GROUP BY feedback_type
        `;

        // 인기 피드백 (추천수 높은 순)
        const popularSql = `
            SELECT feedback_id, title, upvotes, downvotes, 
                   (upvotes - downvotes) as score
            FROM feedback_reports
            WHERE upvotes > 0
            ORDER BY score DESC, upvotes DESC
            FETCH FIRST 10 ROWS ONLY
        `;

        const [statusResult, typeResult, popularResult] = await Promise.all([
            connection.execute(statusSql, {}, { autoCommit: false }),
            connection.execute(typeSql, {}, { autoCommit: false }),
            connection.execute(popularSql, {}, { autoCommit: false })
        ]);

        return {
            status_distribution: statusResult.rows.map(row => ({ 
                status: row[0], 
                count: row[1] 
            })),
            type_distribution: typeResult.rows.map(row => ({ 
                type: row[0], 
                count: row[1] 
            })),
            popular_feedbacks: popularResult.rows.map(row => ({
                feedback_id: row[0],
                title: row[1],
                upvotes: row[2],
                downvotes: row[3],
                score: row[4]
            }))
        };
    });
}

module.exports = {
    // 버그 제보 서비스
    createBugReportService,
    getBugReportService,
    getUserBugReportsService,
    getAllBugReportsService,
    updateBugReportService,
    
    // 피드백 서비스
    createFeedbackService,
    getFeedbackService,
    getUserFeedbacksService,
    getAllFeedbacksService,
    updateFeedbackService,
    voteFeedbackService,
    
    // 통계 서비스
    getBugReportStatisticsService,
    getFeedbackStatisticsService
};
