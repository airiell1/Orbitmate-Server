// testScripts/profile.js - 프로필 꾸미기, 레벨, 뱃지 테스트 함수들

import { updateApiResponse } from './utils.js';

// =========================
// 공통 유틸리티 함수들
// =========================

/**
 * DOM 요소를 안전하게 가져오고 값을 반환하는 유틸리티 함수
 * @param {string} elementId - DOM 요소 ID
 * @param {string} defaultValue - 기본값
 * @returns {string} 요소의 값 또는 기본값
 */
function getElementValue(elementId, defaultValue = '') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Element with id '${elementId}' not found`);
        return defaultValue;
    }
    return element.value || defaultValue;
}

/**
 * 사용자 ID 유효성 검사
 * @param {string} userId - 검사할 사용자 ID
 * @returns {boolean} 유효성 여부
 */
function validateUserId(userId) {
    if (!userId || userId === 'guest') {
        updateApiResponse({ 
            error: { message: '유효한 사용자 ID를 입력해주세요.' } 
        });
        return false;
    }
    return true;
}

/**
 * API 요청을 위한 공통 처리 함수
 * @param {Function} apiCall - 실행할 API 호출 함수
 * @param {string} loadingMessage - 로딩 메시지
 */
async function executeApiCall(apiCall, loadingMessage = '처리 중...') {
    try {
        updateApiResponse({ message: loadingMessage });
        await apiCall();
    } catch (error) {
        console.error('API call failed:', error);
        updateApiResponse({ 
            error: { 
                message: error.message,
                timestamp: new Date().toISOString()
            } 
        });
    }
}

// =========================
// 프로필 꾸미기 테스트
// =========================

export async function getCustomizationTest() {
    const user_id = getElementValue('customization-user-id', 'guest');
    
    if (!validateUserId(user_id)) return;
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/customization`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        updateApiResponse(data);
    }, '커스터마이징 정보를 가져오는 중...');
}

export async function updateCustomizationTest() {
    const user_id = getElementValue('customization-user-id', 'guest');
    
    if (!validateUserId(user_id)) return;
    
    // 커스터마이징 데이터 수집
    const customizationData = {};
    const fields = [
        { id: 'profile-theme', key: 'profile_theme' },
        { id: 'profile-border', key: 'profile_border' },
        { id: 'status-message', key: 'status_message' },
        { id: 'introduction-update', key: 'introduction' }
    ];
    
    fields.forEach(field => {
        const value = getElementValue(field.id);
        if (value) {
            customizationData[field.key] = value;
        }
    });
    
    // 빈 데이터 체크
    if (Object.keys(customizationData).length === 0) {
        updateApiResponse({ 
            error: { message: '변경할 커스터마이징 데이터를 입력해주세요.' } 
        });
        return;
    }
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/customization`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customizationData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
    }, '커스터마이징 정보를 업데이트하는 중...');
}

// =========================
// 레벨 & 경험치 테스트
// =========================

export async function getLevelTest() {
    const user_id = getElementValue('level-user-id', 'guest');
    
    if (!validateUserId(user_id)) return;
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/level`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        updateApiResponse(data);
    }, '레벨 정보를 가져오는 중...');
}

export async function addExperienceTest() {
    const user_id = getElementValue('level-user-id', 'guest');
    
    if (!validateUserId(user_id)) return;
    
    const points = parseInt(getElementValue('exp-points')) || 50;
    const exp_type = getElementValue('exp-type') || 'manual';
    const reason = getElementValue('exp-reason') || '테스트 경험치';
    
    // 경험치 유효성 검사
    if (points <= 0 || points > 10000) {
        updateApiResponse({ 
            error: { message: '경험치는 1~10000 사이의 값이어야 합니다.' } 
        });
        return;
    }
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/experience`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points, exp_type, reason })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
    }, `경험치 ${points}점을 추가하는 중...`);
}

// =========================
// 뱃지 시스템 테스트
// =========================

export async function getBadgesTest() {
    const user_id = getElementValue('badge-user-id', 'guest');
    
    if (!validateUserId(user_id)) return;
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/badges`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        updateApiResponse(data);
        
        // 뱃지 목록을 시각적으로 표시
        displayBadges(data);
    }, '뱃지 목록을 가져오는 중...');
}

export async function toggleBadgeTest() {
    const user_id = getElementValue('badge-user-id', 'guest');
    const badge_id = getElementValue('toggle-badge-id');
    
    if (!validateUserId(user_id)) return;
    
    if (!badge_id) {
        updateApiResponse({ 
            error: { message: '뱃지 ID를 입력해주세요.' } 
        });
        return;
    }
    
    const equippedCheckbox = document.getElementById('badge-equipped');
    const is_equipped = equippedCheckbox ? equippedCheckbox.checked : false;
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/badges/${badge_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_equipped })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
    }, `뱃지 상태를 ${is_equipped ? '착용' : '해제'}하는 중...`);
}

// 뱃지 목록 표시 함수 (개선된 버전)
function displayBadges(badgesData) {
    const badges = Array.isArray(badgesData) ? badgesData : 
                  (badgesData.badges ? badgesData.badges : []);
    
    let displayHtml = '<div class="badges-display"><h4>🏆 보유 뱃지</h4>';
    
    if (badges.length > 0) {
        // 착용 중인 뱃지와 일반 뱃지 분리
        const equippedBadges = badges.filter(badge => 
            badge.is_equipped || badge.IS_EQUIPPED
        );
        const unequippedBadges = badges.filter(badge => 
            !(badge.is_equipped || badge.IS_EQUIPPED)
        );
        
        // 착용 중인 뱃지 먼저 표시
        if (equippedBadges.length > 0) {
            displayHtml += '<div class="equipped-badges"><h5>👑 착용 중</h5>';
            equippedBadges.forEach(badge => {
                displayHtml += createBadgeHtml(badge, true);
            });
            displayHtml += '</div>';
        }
        
        // 일반 뱃지 표시
        if (unequippedBadges.length > 0) {
            displayHtml += '<div class="unequipped-badges"><h5>📦 보관함</h5>';
            unequippedBadges.forEach(badge => {
                displayHtml += createBadgeHtml(badge, false);
            });
            displayHtml += '</div>';
        }
    } else {
        displayHtml += '<p style="color: #666; font-style: italic;">보유한 뱃지가 없습니다.</p>';
    }
    
    displayHtml += '</div>';
    
    // 뱃지 표시 영역 업데이트
    updateBadgesDisplay(displayHtml);
}

/**
 * 개별 뱃지 HTML 생성
 * @param {Object} badge - 뱃지 데이터
 * @param {boolean} isEquipped - 착용 여부
 * @returns {string} 뱃지 HTML
 */
function createBadgeHtml(badge, isEquipped) {
    const badgeName = badge.badge_name || badge.BADGE_NAME || '이름 없음';
    const badgeDescription = badge.badge_description || badge.BADGE_DESCRIPTION || '설명 없음';
    const badgeIcon = badge.badge_icon || badge.BADGE_ICON || '🏆';
    const badgeColor = badge.badge_color || badge.BADGE_COLOR || '#f0f0f0';
    const badgeId = badge.badge_id || badge.BADGE_ID || '';
    
    const statusText = isEquipped ? '👑 착용중' : '';
    const borderStyle = isEquipped ? '2px solid #ffd700' : '1px solid #ddd';
    
    return `
        <div class="badge-item" style="
            border: ${borderStyle}; 
            padding: 12px; 
            margin: 8px 0; 
            background: ${badgeColor}; 
            border-radius: 8px;
            box-shadow: ${isEquipped ? '0 2px 8px rgba(255, 215, 0, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)'};
            transition: all 0.3s ease;
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 2em;">${badgeIcon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 1.1em;">
                        ${badgeName} ${statusText}
                    </div>
                    <div style="color: #666; margin: 4px 0;">${badgeDescription}</div>
                    <div style="font-size: 0.8em; color: #999;">ID: ${badgeId}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 뱃지 표시 영역 업데이트
 * @param {string} displayHtml - 표시할 HTML
 */
function updateBadgesDisplay(displayHtml) {
    let badgesDisplay = document.getElementById('badges-display');
    
    if (!badgesDisplay) {
        badgesDisplay = document.createElement('div');
        badgesDisplay.id = 'badges-display';
        badgesDisplay.style.marginTop = '20px';
        
        // 적절한 위치에 추가
        const targetElement = document.querySelector('[data-badge-display-target]') ||
                            document.querySelector('.api-section') ||
                            document.body;
        targetElement.appendChild(badgesDisplay);
    }
    
    badgesDisplay.innerHTML = displayHtml;
}
