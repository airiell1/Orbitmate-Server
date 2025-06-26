// =========================
// 뱃지 레벨 시스템 테스트 함수들
// =========================

// utils.js에서 함수 import (동적 import 사용)
let updateApiResponse;

// 초기화 함수
async function initBadgeLevel() {
    try {
        const utilsModule = await import('./utils.js');
        updateApiResponse = utilsModule.updateApiResponse;
    } catch (error) {
        console.error('utils.js 로드 실패:', error);
        // 대체 함수
        updateApiResponse = (message) => {
            console.log(message);
            const responseDiv = document.getElementById('api-response');
            if (responseDiv) {
                responseDiv.innerHTML = `<pre>${message}</pre>`;
            }
        };
    }
}

// 페이지 로드 시 초기화
if (typeof window !== 'undefined') {
    initBadgeLevel();
}

// 호환성을 위한 displayApiResponse 함수
function displayApiResponse(title, data) {
    const message = `${title}: ${JSON.stringify(data, null, 2)}`;
    if (updateApiResponse) {
        updateApiResponse(message);
    } else {
        console.log(message);
    }
}

// 호환성을 위한 displayError 함수
function displayError(title, error) {
    const message = `${title} 오류: ${error.message || error}`;
    if (updateApiResponse) {
        updateApiResponse(message);
    } else {
        console.error(message);
    }
}

const API_BASE_URL = 'http://localhost:3000/api'; // 포트를 3000으로 수정

/**
 * 뱃지 상세 조회 테스트
 */
export async function getBadgeDetailsTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/badge-details`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('뱃지 상세 조회', data);
            
            // 뱃지 레벨 시각화
            if (data.all_badges && data.all_badges.length > 0) {
                let badgeHtml = '<div style="margin-top: 10px; padding: 10px; border: 1px solid #ddd; background: #f9f9f9;">';
                badgeHtml += '<h4>🏆 뱃지 레벨 현황</h4>';
                
                data.all_badges.forEach(badge => {
                    const level = badge.badge_level || 1;
                    const progressBar = '█'.repeat(level) + '░'.repeat(Math.max(0, 5 - level));
                    
                    badgeHtml += `
                        <div style="margin: 5px 0; padding: 5px; border-left: 3px solid ${badge.badge_color};">
                            <strong>${badge.badge_icon} ${badge.badge_name}</strong> 
                            <span style="color: #666;">레벨 ${level}</span><br>
                            <small style="color: #888;">${badge.badge_description}</small><br>
                            <span style="font-family: monospace; color: ${badge.badge_color};">${progressBar}</span>
                        </div>
                    `;
                });
                
                badgeHtml += '</div>';
                document.getElementById('api-response').innerHTML += badgeHtml;
            }
        } else {
            displayError('뱃지 상세 조회 실패', data);
        }
    } catch (error) {
        displayError('뱃지 상세 조회 오류', { message: error.message });
    }
}

/**
 * 버그 제보 테스트
 */
export async function submitBugReportTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        const bugDescription = document.getElementById('bug-description').value;
        const severity = document.getElementById('bug-severity').value;
        
        if (!bugDescription || bugDescription.length < 10) {
            displayError('버그 제보 실패', { message: '버그 설명은 최소 10자 이상이어야 합니다.' });
            return;
        }
        
        const requestData = {
            bug_description: bugDescription,
            severity: severity,
            steps_to_reproduce: '테스트 페이지에서 버그 제보 테스트',
            expected_behavior: '정상적인 동작 예상',
            actual_behavior: '실제 버그 발생'
        };
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/bug-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('버그 제보 성공', data);
            
            // 뱃지 업그레이드 정보 표시
            if (data.badge_upgrade) {
                const upgrade = data.badge_upgrade;
                let upgradeHtml = `
                    <div style="margin-top: 10px; padding: 10px; border: 2px solid #4CAF50; background: #f0f8ff; border-radius: 5px;">
                        <h4>🎉 뱃지 레벨 업!</h4>
                        <p><strong>${upgrade.icon} ${upgrade.badge_name}</strong></p>
                        <p>레벨 ${upgrade.old_level} → <strong style="color: #4CAF50;">레벨 ${upgrade.new_level}</strong></p>
                        <p><em>${upgrade.description}</em></p>
                        <p>💎 경험치 보상: +${upgrade.exp_reward}점</p>
                    </div>
                `;
                document.getElementById('api-response').innerHTML += upgradeHtml;
            }
            
            // 입력 필드 초기화
            document.getElementById('bug-description').value = '';
        } else {
            displayError('버그 제보 실패', data);
        }
    } catch (error) {
        displayError('버그 제보 오류', { message: error.message });
    }
}

/**
 * 피드백 제출 테스트
 */
export async function submitFeedbackTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        const feedbackContent = document.getElementById('feedback-content').value;
        const feedbackType = document.getElementById('feedback-type').value;
        
        if (!feedbackContent || feedbackContent.length < 5) {
            displayError('피드백 제출 실패', { message: '피드백 내용은 최소 5자 이상이어야 합니다.' });
            return;
        }
        
        const requestData = {
            feedback_content: feedbackContent,
            feedback_type: feedbackType,
            rating: 5,
            suggestion: '테스트 페이지에서 제출된 피드백입니다.'
        };
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('피드백 제출 성공', data);
            
            // 뱃지 업그레이드 정보 표시
            if (data.badge_upgrade) {
                const upgrade = data.badge_upgrade;
                let upgradeHtml = `
                    <div style="margin-top: 10px; padding: 10px; border: 2px solid #2196F3; background: #f0f8ff; border-radius: 5px;">
                        <h4>🎉 뱃지 레벨 업!</h4>
                        <p><strong>${upgrade.icon} ${upgrade.badge_name}</strong></p>
                        <p>레벨 ${upgrade.old_level} → <strong style="color: #2196F3;">레벨 ${upgrade.new_level}</strong></p>
                        <p><em>${upgrade.description}</em></p>
                        <p>💎 경험치 보상: +${upgrade.exp_reward}점</p>
                    </div>
                `;
                document.getElementById('api-response').innerHTML += upgradeHtml;
            }
            
            // 입력 필드 초기화
            document.getElementById('feedback-content').value = '';
        } else {
            displayError('피드백 제출 실패', data);
        }
    } catch (error) {
        displayError('피드백 제출 오류', { message: error.message });
    }
}

/**
 * 테스트 참여 테스트
 */
export async function testParticipationTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        const testType = document.getElementById('test-type').value;
        const testDetails = document.getElementById('test-details').value || '테스트 페이지에서 참여';
        
        const requestData = {
            test_type: testType,
            test_details: testDetails,
            completion_status: '완료'
        };
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/test-participation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('테스트 참여 기록 성공', data);
            
            // 뱃지 업그레이드 정보 표시
            if (data.badge_upgrade) {
                const upgrade = data.badge_upgrade;
                let upgradeHtml = `
                    <div style="margin-top: 10px; padding: 10px; border: 2px solid #FF9800; background: #f0f8ff; border-radius: 5px;">
                        <h4>🎉 뱃지 레벨 업!</h4>
                        <p><strong>${upgrade.icon} ${upgrade.badge_name}</strong></p>
                        <p>레벨 ${upgrade.old_level} → <strong style="color: #FF9800;">레벨 ${upgrade.new_level}</strong></p>
                        <p><em>${upgrade.description}</em></p>
                        <p>💎 경험치 보상: +${upgrade.exp_reward}점</p>
                    </div>
                `;
                document.getElementById('api-response').innerHTML += upgradeHtml;
            }
            
            // 입력 필드 초기화
            document.getElementById('test-details').value = '';
        } else {
            displayError('테스트 참여 기록 실패', data);
        }
    } catch (error) {
        displayError('테스트 참여 기록 오류', { message: error.message });
    }
}

/**
 * 뱃지 레벨 업그레이드 직접 호출 (개발/테스트용)
 */
export async function upgradeBadgeLevelDirectTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        const badgeName = prompt('업그레이드할 뱃지 이름 (예: 버그 헌터, 피드백 전문가)');
        
        if (!badgeName) return;
        
        const requestData = {
            badge_name: badgeName,
            action_reason: '직접 업그레이드 테스트'
        };
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/badges/upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('뱃지 레벨 업그레이드 성공', data);
        } else {
            displayError('뱃지 레벨 업그레이드 실패', data);
        }
    } catch (error) {
        displayError('뱃지 레벨 업그레이드 오류', { message: error.message });
    }
}

/**
 * 구독 기간 뱃지 업그레이드 테스트
 */
export async function upgradeSubscriptionBadgeTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        const tierName = document.getElementById('subscription-tier').value;
        const monthsCount = parseInt(document.getElementById('subscription-months').value);
        
        if (!monthsCount || monthsCount < 1 || monthsCount > 60) {
            displayError('구독 뱃지 업그레이드 실패', { message: '구독 기간은 1-60개월 사이여야 합니다.' });
            return;
        }
        
        const requestData = {
            tier_name: tierName,
            months_count: monthsCount
        };
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/subscription-badge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('구독 뱃지 업그레이드 성공', data);
            
            // 뱃지 업그레이드 정보 표시
            if (data.badge_upgrade) {
                const upgrade = data.badge_upgrade;
                let upgradeHtml = `
                    <div style="margin-top: 10px; padding: 10px; border: 2px solid #FF9800; background: #fff3e0; border-radius: 5px;">
                        <h4>🎖️ 구독 뱃지 업그레이드!</h4>
                        <p><strong>${upgrade.icon} ${upgrade.badge_name}</strong></p>
                        <p>레벨 ${upgrade.old_level} → <strong style="color: #FF9800;">레벨 ${upgrade.new_level}</strong></p>
                        <p><em>${upgrade.description}</em></p>
                        <p>📅 구독 기간: ${monthsCount}개월 (${tierName})</p>
                        <p>💎 경험치 보상: +${upgrade.exp_reward}점</p>
                    </div>
                `;
                document.getElementById('api-response').innerHTML += upgradeHtml;
            }
        } else {
            displayError('구독 뱃지 업그레이드 실패', data);
        }
    } catch (error) {
        displayError('구독 뱃지 업그레이드 오류', { message: error.message });
    }
}

/**
 * 개발자 뱃지 승인 테스트
 */
export async function approveBadgeTest() {
    try {
        const userId = document.getElementById('badge-level-user-id').value || 'guest';
        const badgeName = document.getElementById('approve-badge-name').value;
        const reason = document.getElementById('approve-reason').value || '개발자 승인';
        
        const requestData = {
            badge_name: badgeName,
            reason: reason
        };
        
        const response = await fetch(`${API_BASE_URL}/users/${userId}/approve-badge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayApiResponse('뱃지 승인 성공', data);
            
            // 승인 정보 표시
            if (data.badge_upgrade) {
                const upgrade = data.badge_upgrade;
                let approvalHtml = `
                    <div style="margin-top: 10px; padding: 10px; border: 2px solid #9C27B0; background: #f3e5f5; border-radius: 5px;">
                        <h4>✅ 개발자 승인 완료!</h4>
                        <p><strong>${upgrade.icon} ${upgrade.badge_name}</strong></p>
                        <p>레벨 ${upgrade.old_level} → <strong style="color: #9C27B0;">레벨 ${upgrade.new_level}</strong></p>
                        <p><em>${upgrade.description}</em></p>
                        <p>🔐 승인자: ${data.approved_by}</p>
                        <p>📝 승인 사유: ${reason}</p>
                        <p>💎 승인 보너스: +${data.bonus_exp}점</p>
                    </div>
                `;
                document.getElementById('api-response').innerHTML += approvalHtml;
            }
            
            // 입력 필드 초기화
            document.getElementById('approve-reason').value = '';
        } else {
            displayError('뱃지 승인 실패', data);
        }
    } catch (error) {
        displayError('뱃지 승인 오류', { message: error.message });
    }
}
