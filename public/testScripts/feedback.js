// =========================
// 🐛 버그 제보 및 피드백 관리 테스트 스크립트
// =========================

const API_BASE_URL = "http://localhost:3000/api";

// 테스트용 사용자 ID
const TEST_USER_ID = "guest";

/**
 * 새 버그 제보 생성 테스트
 */
async function testCreateBugReport() {
    try {
        const bugData = {
            user_id: TEST_USER_ID,
            title: "채팅 입력창에서 한글 입력 시 커서 위치 오류",
            description: "한글을 입력할 때 커서가 이상한 위치로 이동하며, 텍스트가 제대로 입력되지 않는 문제가 발생합니다.",
            severity: "medium",
            category: "ui",
            browser_info: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                screenResolution: `${screen.width}x${screen.height}`,
                viewportSize: `${window.innerWidth}x${window.innerHeight}`
            },
            steps_to_reproduce: "1. 채팅 입력창 클릭\n2. 한글 입력 시작\n3. 조합문자 입력 중 커서 이동 확인",
            expected_behavior: "한글 입력 시에도 커서가 정상적인 위치에 유지되어야 함",
            actual_behavior: "한글 조합문자 입력 중 커서가 예상치 못한 위치로 이동함",
            current_url: window.location.href
        };

        const response = await fetch(`${API_BASE_URL}/feedback/bug-reports`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bugData)
        });

        const result = await response.json();
        console.log("버그 제보 생성 결과:", result);
        
        if (result.status === "success") {
            console.log("✅ 버그 제보가 성공적으로 생성되었습니다.");
            return result.data.report_id;
        } else {
            console.error("❌ 버그 제보 생성 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 버그 제보 생성 중 오류:", error);
    }
}

/**
 * 새 피드백 제출 테스트
 */
async function testCreateFeedback() {
    try {
        const feedbackData = {
            user_id: TEST_USER_ID,
            title: "AI 응답 속도 개선 요청",
            content: "AI 응답이 조금 느린 것 같습니다. 스트리밍은 빠르지만 첫 응답이 시작되기까지 시간이 좀 걸리는 것 같아요. 모델을 더 빠른 것으로 바꾸거나 캐싱을 적용하면 좋겠습니다.",
            feedback_type: "improvement",
            category: "performance"
        };

        const response = await fetch(`${API_BASE_URL}/feedback/feedbacks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(feedbackData)
        });

        const result = await response.json();
        console.log("피드백 제출 결과:", result);
        
        if (result.status === "success") {
            console.log("✅ 피드백이 성공적으로 제출되었습니다.");
            return result.data.feedback_id;
        } else {
            console.error("❌ 피드백 제출 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 피드백 제출 중 오류:", error);
    }
}

/**
 * 기능 요청 피드백 테스트
 */
async function testCreateFeatureRequest() {
    try {
        const feedbackData = {
            user_id: TEST_USER_ID,
            title: "다크 모드 지원 요청",
            content: "밤에 사용할 때 너무 밝아서 눈이 아픕니다. 다크 모드를 지원해주시면 좋겠습니다. 시스템 설정을 따르는 자동 모드도 있으면 더 좋겠어요.",
            feedback_type: "feature_request",
            category: "ui"
        };

        const response = await fetch(`${API_BASE_URL}/feedback/feedbacks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(feedbackData)
        });

        const result = await response.json();
        console.log("기능 요청 결과:", result);
        
        if (result.status === "success") {
            console.log("✅ 기능 요청이 성공적으로 제출되었습니다.");
            return result.data.feedback_id;
        } else {
            console.error("❌ 기능 요청 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 기능 요청 중 오류:", error);
    }
}

/**
 * 사용자의 버그 제보 목록 조회 테스트
 */
async function testGetUserBugReports() {
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/users/${TEST_USER_ID}/bug-reports?limit=10`);
        const result = await response.json();
        
        console.log("사용자 버그 제보 목록:", result);
        
        if (result.status === "success") {
            console.log(`✅ 버그 제보 ${result.data.length}건을 조회했습니다.`);
            return result.data;
        } else {
            console.error("❌ 버그 제보 목록 조회 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 버그 제보 목록 조회 중 오류:", error);
    }
}

/**
 * 사용자의 피드백 목록 조회 테스트
 */
async function testGetUserFeedbacks() {
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/users/${TEST_USER_ID}/feedbacks?limit=10`);
        const result = await response.json();
        
        console.log("사용자 피드백 목록:", result);
        
        if (result.status === "success") {
            console.log(`✅ 피드백 ${result.data.length}건을 조회했습니다.`);
            return result.data;
        } else {
            console.error("❌ 피드백 목록 조회 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 피드백 목록 조회 중 오류:", error);
    }
}

/**
 * 모든 버그 제보 목록 조회 테스트 (관리자용)
 */
async function testGetAllBugReports() {
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/bug-reports?limit=20&status=open`);
        const result = await response.json();
        
        console.log("전체 버그 제보 목록:", result);
        
        if (result.status === "success") {
            console.log(`✅ 전체 버그 제보 ${result.data.length}건을 조회했습니다.`);
            return result.data;
        } else {
            console.error("❌ 전체 버그 제보 목록 조회 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 전체 버그 제보 목록 조회 중 오류:", error);
    }
}

/**
 * 모든 피드백 목록 조회 테스트 (관리자용)
 */
async function testGetAllFeedbacks() {
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/feedbacks?limit=20&status=submitted`);
        const result = await response.json();
        
        console.log("전체 피드백 목록:", result);
        
        if (result.status === "success") {
            console.log(`✅ 전체 피드백 ${result.data.length}건을 조회했습니다.`);
            return result.data;
        } else {
            console.error("❌ 전체 피드백 목록 조회 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 전체 피드백 목록 조회 중 오류:", error);
    }
}

/**
 * 피드백 추천 테스트
 */
async function testVoteFeedback(feedbackId) {
    try {
        if (!feedbackId) {
            console.log("⚠️ 피드백 ID가 필요합니다. 먼저 피드백을 생성하거나 목록에서 ID를 확인하세요.");
            return;
        }

        const voteData = {
            vote_type: "upvote"
        };

        const response = await fetch(`${API_BASE_URL}/feedback/feedbacks/${feedbackId}/vote`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(voteData)
        });

        const result = await response.json();
        console.log("피드백 추천 결과:", result);
        
        if (result.status === "success") {
            console.log(`✅ 피드백 추천 완료. 현재 추천수: ${result.data.upvotes}, 비추천수: ${result.data.downvotes}`);
        } else {
            console.error("❌ 피드백 추천 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 피드백 추천 중 오류:", error);
    }
}

/**
 * 버그 제보 상태 업데이트 테스트 (관리자용)
 */
async function testUpdateBugReport(reportId) {
    try {
        if (!reportId) {
            console.log("⚠️ 버그 제보 ID가 필요합니다. 먼저 버그 제보를 생성하거나 목록에서 ID를 확인하세요.");
            return;
        }

        const updateData = {
            status: "in_progress",
            priority: "high",
            resolution_notes: "개발팀에서 검토 중입니다. 재현이 확인되었고 다음 패치에서 수정 예정입니다."
        };

        const response = await fetch(`${API_BASE_URL}/feedback/bug-reports/${reportId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();
        console.log("버그 제보 업데이트 결과:", result);
        
        if (result.status === "success") {
            console.log("✅ 버그 제보가 성공적으로 업데이트되었습니다.");
        } else {
            console.error("❌ 버그 제보 업데이트 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 버그 제보 업데이트 중 오류:", error);
    }
}

/**
 * 피드백 상태 업데이트 테스트 (관리자용)
 */
async function testUpdateFeedback(feedbackId) {
    try {
        if (!feedbackId) {
            console.log("⚠️ 피드백 ID가 필요합니다. 먼저 피드백을 생성하거나 목록에서 ID를 확인하세요.");
            return;
        }

        const updateData = {
            status: "planned",
            priority: "normal",
            admin_response: "좋은 제안 감사합니다. 다크 모드는 다음 버전에서 추가될 예정입니다."
        };

        const response = await fetch(`${API_BASE_URL}/feedback/feedbacks/${feedbackId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();
        console.log("피드백 업데이트 결과:", result);
        
        if (result.status === "success") {
            console.log("✅ 피드백이 성공적으로 업데이트되었습니다.");
        } else {
            console.error("❌ 피드백 업데이트 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 피드백 업데이트 중 오류:", error);
    }
}

/**
 * 버그 제보 통계 조회 테스트
 */
async function testGetBugReportStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/statistics/bug-reports`);
        const result = await response.json();
        
        console.log("버그 제보 통계:", result);
        
        if (result.status === "success") {
            console.log("✅ 버그 제보 통계 조회 완료");
            console.log("📊 상태별 분포:", result.data.status_distribution);
            console.log("📊 심각도별 분포:", result.data.severity_distribution);
            console.log("📊 카테고리별 분포:", result.data.category_distribution);
        } else {
            console.error("❌ 버그 제보 통계 조회 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 버그 제보 통계 조회 중 오류:", error);
    }
}

/**
 * 피드백 통계 조회 테스트
 */
async function testGetFeedbackStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/statistics/feedbacks`);
        const result = await response.json();
        
        console.log("피드백 통계:", result);
        
        if (result.status === "success") {
            console.log("✅ 피드백 통계 조회 완료");
            console.log("📊 상태별 분포:", result.data.status_distribution);
            console.log("📊 유형별 분포:", result.data.type_distribution);
            console.log("📊 인기 피드백:", result.data.popular_feedbacks);
        } else {
            console.error("❌ 피드백 통계 조회 실패:", result.error);
        }
    } catch (error) {
        console.error("❌ 피드백 통계 조회 중 오류:", error);
    }
}

/**
 * 전체 피드백 시스템 테스트
 */
async function testFeedbackSystemComplete() {
    console.log("🚀 피드백 시스템 전체 테스트 시작");
    
    try {
        // 1. 버그 제보 생성
        console.log("\n1️⃣ 버그 제보 생성 테스트");
        const bugReportId = await testCreateBugReport();
        
        // 2. 피드백 생성
        console.log("\n2️⃣ 피드백 생성 테스트");
        const feedbackId = await testCreateFeedback();
        
        // 3. 기능 요청 생성
        console.log("\n3️⃣ 기능 요청 생성 테스트");
        const featureRequestId = await testCreateFeatureRequest();
        
        // 4. 사용자별 목록 조회
        console.log("\n4️⃣ 사용자별 목록 조회 테스트");
        await testGetUserBugReports();
        await testGetUserFeedbacks();
        
        // 5. 전체 목록 조회
        console.log("\n5️⃣ 전체 목록 조회 테스트");
        await testGetAllBugReports();
        await testGetAllFeedbacks();
        
        // 6. 피드백 추천
        if (feedbackId) {
            console.log("\n6️⃣ 피드백 추천 테스트");
            await testVoteFeedback(feedbackId);
        }
        
        // 7. 상태 업데이트 (관리자 기능)
        if (bugReportId) {
            console.log("\n7️⃣ 버그 제보 상태 업데이트 테스트");
            await testUpdateBugReport(bugReportId);
        }
        
        if (featureRequestId) {
            console.log("\n8️⃣ 피드백 상태 업데이트 테스트");
            await testUpdateFeedback(featureRequestId);
        }
        
        // 8. 통계 조회
        console.log("\n9️⃣ 통계 조회 테스트");
        await testGetBugReportStatistics();
        await testGetFeedbackStatistics();
        
        console.log("\n✅ 피드백 시스템 전체 테스트 완료!");
        
    } catch (error) {
        console.error("❌ 피드백 시스템 테스트 중 오류:", error);
    }
}

// 전역으로 함수들을 노출
window.testCreateBugReport = testCreateBugReport;
window.testCreateFeedback = testCreateFeedback;
window.testCreateFeatureRequest = testCreateFeatureRequest;
window.testGetUserBugReports = testGetUserBugReports;
window.testGetUserFeedbacks = testGetUserFeedbacks;
window.testGetAllBugReports = testGetAllBugReports;
window.testGetAllFeedbacks = testGetAllFeedbacks;
window.testVoteFeedback = testVoteFeedback;
window.testUpdateBugReport = testUpdateBugReport;
window.testUpdateFeedback = testUpdateFeedback;
window.testGetBugReportStatistics = testGetBugReportStatistics;
window.testGetFeedbackStatistics = testGetFeedbackStatistics;
window.testFeedbackSystemComplete = testFeedbackSystemComplete;

export {
    testCreateBugReport,
    testCreateFeedback,
    testCreateFeatureRequest,
    testGetUserBugReports,
    testGetUserFeedbacks,
    testGetAllBugReports,
    testGetAllFeedbacks,
    testVoteFeedback,
    testUpdateBugReport,
    testUpdateFeedback,
    testGetBugReportStatistics,
    testGetFeedbackStatistics,
    testFeedbackSystemComplete
};
