const { handleOracleError } = require("../utils/errorHandler");
const { toSnakeCaseObj, clobToString } = require("../utils/dbUtils");

// =========================
// 🐛 버그 제보 관리 (Bug Report Management)
// =========================

/**
 * 새 버그 제보 생성
 * @param {Object} connection - DB 연결 객체
 * @param {string} userId - 사용자 ID
 * @param {Object} bugData - 버그 제보 데이터
 * @param {string} bugData.title - 제목
 * @param {string} bugData.description - 설명
 * @param {string} [bugData.severity='medium'] - 심각도 (low, medium, high, critical)
 * @param {string} [bugData.category='general'] - 카테고리 (ui, api, performance, security, general)
 * @param {Object} [bugData.browserInfo] - 브라우저 정보
 * @param {string} [bugData.stepsToReproduce] - 재현 단계
 * @param {string} [bugData.expectedBehavior] - 예상 동작
 * @param {string} [bugData.actualBehavior] - 실제 동작
 * @param {Array} [bugData.attachmentUrls] - 첨부파일 URL 배열
 * @returns {Promise<Object>} 생성된 버그 제보 정보
 */
async function createBugReport(connection, userId, bugData) {
    try {
        const {
            title,
            description,
            severity = 'medium',
            category = 'general',
            browserInfo,
            stepsToReproduce,
            expectedBehavior,
            actualBehavior,
            attachmentUrls = []
        } = bugData;

        // 입력값 검증
        if (!title || !description) {
            const error = new Error("제목과 설명은 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        const sql = `
            INSERT INTO bug_reports (
                user_id, title, description, severity, category, 
                browser_info, steps_to_reproduce, expected_behavior, 
                actual_behavior, attachment_urls
            ) VALUES (
                :user_id, :title, :description, :severity, :category,
                :browser_info, :steps_to_reproduce, :expected_behavior,
                :actual_behavior, :attachment_urls
            ) RETURNING report_id INTO :report_id
        `;

        const binds = {
            user_id: userId,
            title: title,
            description: description,
            severity: severity,
            category: category,
            browser_info: browserInfo ? JSON.stringify(browserInfo) : null,
            steps_to_reproduce: stepsToReproduce || null,
            expected_behavior: expectedBehavior || null,
            actual_behavior: actualBehavior || null,
            attachment_urls: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null,
            report_id: { dir: connection.oracledb.BIND_OUT, type: connection.oracledb.STRING, maxSize: 36 }
        };

        const result = await connection.execute(sql, binds, { autoCommit: false });
        const reportId = result.outBinds.report_id;

        // 생성된 버그 제보 정보 조회
        return await getBugReportById(connection, reportId);

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 버그 제보 ID로 조회
 * @param {Object} connection - DB 연결 객체
 * @param {string} reportId - 버그 제보 ID
 * @returns {Promise<Object|null>} 버그 제보 정보
 */
async function getBugReportById(connection, reportId) {
    try {
        const sql = `
            SELECT br.*, u.username, u.email
            FROM bug_reports br
            LEFT JOIN users u ON br.user_id = u.user_id
            WHERE br.report_id = :report_id
        `;

        const result = await connection.execute(sql, { report_id: reportId }, { autoCommit: false });

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        let bugReport = toSnakeCaseObj(row);

        // CLOB 필드 변환
        if (bugReport.description) {
            bugReport.description = await clobToString(bugReport.description);
        }
        if (bugReport.browser_info) {
            bugReport.browser_info = await clobToString(bugReport.browser_info);
            try {
                bugReport.browser_info = JSON.parse(bugReport.browser_info);
            } catch (e) {
                // JSON 파싱 실패 시 문자열 그대로 유지
            }
        }
        if (bugReport.steps_to_reproduce) {
            bugReport.steps_to_reproduce = await clobToString(bugReport.steps_to_reproduce);
        }
        if (bugReport.expected_behavior) {
            bugReport.expected_behavior = await clobToString(bugReport.expected_behavior);
        }
        if (bugReport.actual_behavior) {
            bugReport.actual_behavior = await clobToString(bugReport.actual_behavior);
        }
        if (bugReport.resolution_notes) {
            bugReport.resolution_notes = await clobToString(bugReport.resolution_notes);
        }
        if (bugReport.attachment_urls) {
            bugReport.attachment_urls = await clobToString(bugReport.attachment_urls);
            try {
                bugReport.attachment_urls = JSON.parse(bugReport.attachment_urls);
            } catch (e) {
                bugReport.attachment_urls = [];
            }
        } else {
            bugReport.attachment_urls = [];
        }

        return bugReport;

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 사용자의 버그 제보 목록 조회
 * @param {Object} connection - DB 연결 객체
 * @param {string} userId - 사용자 ID
 * @param {Object} [options] - 조회 옵션
 * @param {number} [options.limit=50] - 최대 조회 개수
 * @param {number} [options.offset=0] - 조회 시작 위치
 * @param {string} [options.status] - 상태 필터 (open, in_progress, resolved, closed, duplicate)
 * @param {string} [options.severity] - 심각도 필터 (low, medium, high, critical)
 * @returns {Promise<Array>} 버그 제보 목록
 */
async function getUserBugReports(connection, userId, options = {}) {
    try {
        const { limit = 50, offset = 0, status, severity } = options;

        let sql = `
            SELECT report_id, title, severity, category, status, created_at, updated_at
            FROM bug_reports
            WHERE user_id = :user_id
        `;

        const binds = { user_id: userId };

        if (status) {
            sql += ` AND status = :status`;
            binds.status = status;
        }

        if (severity) {
            sql += ` AND severity = :severity`;
            binds.severity = severity;
        }

        sql += ` ORDER BY created_at DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = limit;

        const result = await connection.execute(sql, binds, { autoCommit: false });

        return result.rows.map(row => toSnakeCaseObj(row));

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 모든 버그 제보 목록 조회 (관리자용)
 * @param {Object} connection - DB 연결 객체
 * @param {Object} [options] - 조회 옵션
 * @param {number} [options.limit=50] - 최대 조회 개수
 * @param {number} [options.offset=0] - 조회 시작 위치
 * @param {string} [options.status] - 상태 필터
 * @param {string} [options.severity] - 심각도 필터
 * @param {string} [options.category] - 카테고리 필터
 * @param {string} [options.priority] - 우선순위 필터
 * @returns {Promise<Array>} 버그 제보 목록
 */
async function getAllBugReports(connection, options = {}) {
    try {
        const { limit = 50, offset = 0, status, severity, category, priority } = options;

        let sql = `
            SELECT br.*, u.username, u.email
            FROM bug_reports br
            LEFT JOIN users u ON br.user_id = u.user_id
            WHERE 1=1
        `;

        const binds = {};

        if (status) {
            sql += ` AND br.status = :status`;
            binds.status = status;
        }

        if (severity) {
            sql += ` AND br.severity = :severity`;
            binds.severity = severity;
        }

        if (category) {
            sql += ` AND br.category = :category`;
            binds.category = category;
        }

        if (priority) {
            sql += ` AND br.priority = :priority`;
            binds.priority = priority;
        }

        sql += ` ORDER BY br.created_at DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = limit;

        const result = await connection.execute(sql, binds, { autoCommit: false });

        const reports = [];
        for (const row of result.rows) {
            const report = toSnakeCaseObj(row);
            
            // CLOB 필드들 변환 (간단 정보만)
            if (report.description) {
                const description = await clobToString(report.description);
                report.description_preview = description.length > 200 ? 
                    description.substring(0, 200) + '...' : description;
            }

            reports.push(report);
        }

        return reports;

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 버그 제보 상태 업데이트
 * @param {Object} connection - DB 연결 객체
 * @param {string} reportId - 버그 제보 ID
 * @param {Object} updateData - 업데이트 데이터
 * @param {string} [updateData.status] - 상태 (open, in_progress, resolved, closed, duplicate)
 * @param {string} [updateData.priority] - 우선순위 (low, normal, high, urgent)
 * @param {string} [updateData.assignedTo] - 담당자 ID
 * @param {string} [updateData.resolutionNotes] - 해결 메모
 * @returns {Promise<Object>} 업데이트된 버그 제보 정보
 */
async function updateBugReport(connection, reportId, updateData) {
    try {
        const updateFields = [];
        const binds = { report_id: reportId };

        if (updateData.status !== undefined) {
            updateFields.push('status = :status');
            binds.status = updateData.status;
            
            // 해결된 상태로 변경 시 resolved_at 자동 설정
            if (updateData.status === 'resolved' || updateData.status === 'closed') {
                updateFields.push('resolved_at = SYSDATE');
            }
        }

        if (updateData.priority !== undefined) {
            updateFields.push('priority = :priority');
            binds.priority = updateData.priority;
        }

        if (updateData.assignedTo !== undefined) {
            updateFields.push('assigned_to = :assigned_to');
            binds.assigned_to = updateData.assignedTo;
        }

        if (updateData.resolutionNotes !== undefined) {
            updateFields.push('resolution_notes = :resolution_notes');
            binds.resolution_notes = updateData.resolutionNotes;
        }

        if (updateFields.length === 0) {
            const error = new Error("업데이트할 필드가 없습니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        updateFields.push('updated_at = SYSDATE');

        const sql = `
            UPDATE bug_reports 
            SET ${updateFields.join(', ')}
            WHERE report_id = :report_id
        `;

        const result = await connection.execute(sql, binds, { autoCommit: false });

        if (result.rowsAffected === 0) {
            const error = new Error("버그 제보를 찾을 수 없습니다.");
            error.code = "RESOURCE_NOT_FOUND";
            throw error;
        }

        return await getBugReportById(connection, reportId);

    } catch (error) {
        throw handleOracleError(error);
    }
}

// =========================
// 💡 피드백 관리 (Feedback Management)
// =========================

/**
 * 새 피드백 제출
 * @param {Object} connection - DB 연결 객체
 * @param {string} userId - 사용자 ID
 * @param {Object} feedbackData - 피드백 데이터
 * @param {string} feedbackData.title - 제목
 * @param {string} feedbackData.content - 내용
 * @param {string} [feedbackData.feedbackType='general'] - 피드백 유형
 * @param {string} [feedbackData.category='general'] - 카테고리
 * @param {Array} [feedbackData.attachmentUrls] - 첨부파일 URL 배열
 * @returns {Promise<Object>} 생성된 피드백 정보
 */
async function createFeedback(connection, userId, feedbackData) {
    try {
        const {
            title,
            content,
            feedbackType = 'general',
            category = 'general',
            attachmentUrls = []
        } = feedbackData;

        // 입력값 검증
        if (!title || !content) {
            const error = new Error("제목과 내용은 필수입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        const sql = `
            INSERT INTO feedback_reports (
                user_id, title, content, feedback_type, category, attachment_urls
            ) VALUES (
                :user_id, :title, :content, :feedback_type, :category, :attachment_urls
            ) RETURNING feedback_id INTO :feedback_id
        `;

        const binds = {
            user_id: userId,
            title: title,
            content: content,
            feedback_type: feedbackType,
            category: category,
            attachment_urls: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null,
            feedback_id: { dir: connection.oracledb.BIND_OUT, type: connection.oracledb.STRING, maxSize: 36 }
        };

        const result = await connection.execute(sql, binds, { autoCommit: false });
        const feedbackId = result.outBinds.feedback_id;

        return await getFeedbackById(connection, feedbackId);

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 피드백 ID로 조회
 * @param {Object} connection - DB 연결 객체
 * @param {string} feedbackId - 피드백 ID
 * @returns {Promise<Object|null>} 피드백 정보
 */
async function getFeedbackById(connection, feedbackId) {
    try {
        const sql = `
            SELECT fr.*, u.username, u.email
            FROM feedback_reports fr
            LEFT JOIN users u ON fr.user_id = u.user_id
            WHERE fr.feedback_id = :feedback_id
        `;

        const result = await connection.execute(sql, { feedback_id: feedbackId }, { autoCommit: false });

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        let feedback = toSnakeCaseObj(row);

        // CLOB 필드 변환
        if (feedback.content) {
            feedback.content = await clobToString(feedback.content);
        }
        if (feedback.admin_response) {
            feedback.admin_response = await clobToString(feedback.admin_response);
        }
        if (feedback.implementation_notes) {
            feedback.implementation_notes = await clobToString(feedback.implementation_notes);
        }
        if (feedback.attachment_urls) {
            feedback.attachment_urls = await clobToString(feedback.attachment_urls);
            try {
                feedback.attachment_urls = JSON.parse(feedback.attachment_urls);
            } catch (e) {
                feedback.attachment_urls = [];
            }
        } else {
            feedback.attachment_urls = [];
        }

        return feedback;

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 사용자의 피드백 목록 조회
 * @param {Object} connection - DB 연결 객체
 * @param {string} userId - 사용자 ID
 * @param {Object} [options] - 조회 옵션
 * @returns {Promise<Array>} 피드백 목록
 */
async function getUserFeedbacks(connection, userId, options = {}) {
    try {
        const { limit = 50, offset = 0, status, feedbackType } = options;

        let sql = `
            SELECT feedback_id, title, feedback_type, category, status, 
                   upvotes, downvotes, created_at, updated_at
            FROM feedback_reports
            WHERE user_id = :user_id
        `;

        const binds = { user_id: userId };

        if (status) {
            sql += ` AND status = :status`;
            binds.status = status;
        }

        if (feedbackType) {
            sql += ` AND feedback_type = :feedback_type`;
            binds.feedback_type = feedbackType;
        }

        sql += ` ORDER BY created_at DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = limit;

        const result = await connection.execute(sql, binds, { autoCommit: false });

        return result.rows.map(row => toSnakeCaseObj(row));

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 모든 피드백 목록 조회 (관리자용)
 * @param {Object} connection - DB 연결 객체
 * @param {Object} [options] - 조회 옵션
 * @returns {Promise<Array>} 피드백 목록
 */
async function getAllFeedbacks(connection, options = {}) {
    try {
        const { limit = 50, offset = 0, status, feedbackType, category } = options;

        let sql = `
            SELECT fr.*, u.username, u.email
            FROM feedback_reports fr
            LEFT JOIN users u ON fr.user_id = u.user_id
            WHERE 1=1
        `;

        const binds = {};

        if (status) {
            sql += ` AND fr.status = :status`;
            binds.status = status;
        }

        if (feedbackType) {
            sql += ` AND fr.feedback_type = :feedback_type`;
            binds.feedback_type = feedbackType;
        }

        if (category) {
            sql += ` AND fr.category = :category`;
            binds.category = category;
        }

        sql += ` ORDER BY fr.created_at DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        binds.offset = offset;
        binds.limit = limit;

        const result = await connection.execute(sql, binds, { autoCommit: false });

        const feedbacks = [];
        for (const row of result.rows) {
            const feedback = toSnakeCaseObj(row);
            
            // CLOB 필드들 변환 (간단 정보만)
            if (feedback.content) {
                const content = await clobToString(feedback.content);
                feedback.content_preview = content.length > 200 ? 
                    content.substring(0, 200) + '...' : content;
            }

            feedbacks.push(feedback);
        }

        return feedbacks;

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 피드백 업데이트 (관리자용)
 * @param {Object} connection - DB 연결 객체
 * @param {string} feedbackId - 피드백 ID
 * @param {Object} updateData - 업데이트 데이터
 * @returns {Promise<Object>} 업데이트된 피드백 정보
 */
async function updateFeedback(connection, feedbackId, updateData) {
    try {
        const updateFields = [];
        const binds = { feedback_id: feedbackId };

        if (updateData.status !== undefined) {
            updateFields.push('status = :status');
            binds.status = updateData.status;
            
            // 검토된 상태로 변경 시 reviewed_at 자동 설정
            if (updateData.status !== 'submitted') {
                updateFields.push('reviewed_at = SYSDATE');
            }
        }

        if (updateData.priority !== undefined) {
            updateFields.push('priority = :priority');
            binds.priority = updateData.priority;
        }

        if (updateData.adminResponse !== undefined) {
            updateFields.push('admin_response = :admin_response');
            binds.admin_response = updateData.adminResponse;
        }

        if (updateData.implementationNotes !== undefined) {
            updateFields.push('implementation_notes = :implementation_notes');
            binds.implementation_notes = updateData.implementationNotes;
        }

        if (updateFields.length === 0) {
            const error = new Error("업데이트할 필드가 없습니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        updateFields.push('updated_at = SYSDATE');

        const sql = `
            UPDATE feedback_reports 
            SET ${updateFields.join(', ')}
            WHERE feedback_id = :feedback_id
        `;

        const result = await connection.execute(sql, binds, { autoCommit: false });

        if (result.rowsAffected === 0) {
            const error = new Error("피드백을 찾을 수 없습니다.");
            error.code = "RESOURCE_NOT_FOUND";
            throw error;
        }

        return await getFeedbackById(connection, feedbackId);

    } catch (error) {
        throw handleOracleError(error);
    }
}

/**
 * 피드백 추천/비추천
 * @param {Object} connection - DB 연결 객체
 * @param {string} feedbackId - 피드백 ID
 * @param {string} voteType - 추천 유형 ('upvote' 또는 'downvote')
 * @returns {Promise<Object>} 업데이트된 추천수 정보
 */
async function voteFeedback(connection, feedbackId, voteType) {
    try {
        if (!['upvote', 'downvote'].includes(voteType)) {
            const error = new Error("올바르지 않은 추천 유형입니다.");
            error.code = "INVALID_INPUT";
            throw error;
        }

        const field = voteType === 'upvote' ? 'upvotes' : 'downvotes';
        
        const sql = `
            UPDATE feedback_reports 
            SET ${field} = ${field} + 1, updated_at = SYSDATE
            WHERE feedback_id = :feedback_id
            RETURNING upvotes, downvotes INTO :upvotes, :downvotes
        `;

        const binds = {
            feedback_id: feedbackId,
            upvotes: { dir: connection.oracledb.BIND_OUT, type: connection.oracledb.NUMBER },
            downvotes: { dir: connection.oracledb.BIND_OUT, type: connection.oracledb.NUMBER }
        };

        const result = await connection.execute(sql, binds, { autoCommit: false });

        if (result.rowsAffected === 0) {
            const error = new Error("피드백을 찾을 수 없습니다.");
            error.code = "RESOURCE_NOT_FOUND";
            throw error;
        }

        return {
            upvotes: result.outBinds.upvotes,
            downvotes: result.outBinds.downvotes
        };

    } catch (error) {
        throw handleOracleError(error);
    }
}

module.exports = {
    // 버그 제보 관련
    createBugReport,
    getBugReportById,
    getUserBugReports,
    getAllBugReports,
    updateBugReport,
    
    // 피드백 관련
    createFeedback,
    getFeedbackById,
    getUserFeedbacks,
    getAllFeedbacks,
    updateFeedback,
    voteFeedback
};
