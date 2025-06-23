// testScripts/profile.js - 프로필 꾸미기, 레벨, 뱃지 테스트 함수들

import { updateApiResponse } from './utils.js';

// =========================
// 프로필 꾸미기 테스트
// =========================

export async function getCustomizationTest() {
    const userIdInput = document.getElementById('customization-user-id');
    const user_id = userIdInput.value || 'guest';
    
    try {
        const response = await fetch(`/api/users/${user_id}/customization`);
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function updateCustomizationTest() {
    const userIdInput = document.getElementById('customization-user-id');
    const profileThemeInput = document.getElementById('profile-theme');
    const profileBorderInput = document.getElementById('profile-border');
    const statusMessageInput = document.getElementById('status-message');
    const introductionInput = document.getElementById('introduction-update');
    
    const user_id = userIdInput.value || 'guest';
    
    const customizationData = {};
    if (profileThemeInput.value) customizationData.profile_theme = profileThemeInput.value;
    if (profileBorderInput.value) customizationData.profile_border = profileBorderInput.value;
    if (statusMessageInput.value) customizationData.status_message = statusMessageInput.value;
    if (introductionInput.value) customizationData.introduction = introductionInput.value;
    
    try {
        const response = await fetch(`/api/users/${user_id}/customization`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customizationData)
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

// =========================
// 레벨 & 경험치 테스트
// =========================

export async function getLevelTest() {
    const userIdInput = document.getElementById('level-user-id');
    const user_id = userIdInput.value || 'guest';
    
    try {
        const response = await fetch(`/api/users/${user_id}/level`);
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function addExperienceTest() {
    const userIdInput = document.getElementById('level-user-id');
    const expPointsInput = document.getElementById('exp-points');
    const expTypeInput = document.getElementById('exp-type');
    const expReasonInput = document.getElementById('exp-reason');
    
    const user_id = userIdInput.value || 'guest';
    const points = parseInt(expPointsInput.value) || 50;
    const exp_type = expTypeInput.value || 'manual';
    const reason = expReasonInput.value || '테스트 경험치';
    
    try {
        const response = await fetch(`/api/users/${user_id}/experience`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points, exp_type, reason })
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

// =========================
// 뱃지 시스템 테스트
// =========================

export async function getBadgesTest() {
    const userIdInput = document.getElementById('badge-user-id');
    const user_id = userIdInput.value || 'guest';
    
    try {
        const response = await fetch(`/api/users/${user_id}/badges`);
        const data = await response.json();
        updateApiResponse(data);
        
        // 뱃지 목록을 시각적으로 표시
        displayBadges(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function toggleBadgeTest() {
    const userIdInput = document.getElementById('badge-user-id');
    const badgeIdInput = document.getElementById('toggle-badge-id');
    const equippedCheckbox = document.getElementById('badge-equipped');
    
    const user_id = userIdInput.value || 'guest';
    const badge_id = badgeIdInput.value;
    const is_equipped = equippedCheckbox.checked;
    
    if (!badge_id) {
        alert('뱃지 ID를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${user_id}/badges/${badge_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_equipped })
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

// 뱃지 목록 표시 함수
function displayBadges(badges) {
    let displayHtml = '<div class="badges-display"><h4>🏆 보유 뱃지</h4>';
    
    if (Array.isArray(badges) && badges.length > 0) {
        badges.forEach(badge => {
            const equipped = badge.is_equipped || badge.IS_EQUIPPED ? '👑 착용중' : '';
            displayHtml += `
                <div class="badge-item" style="border: 1px solid #ddd; padding: 10px; margin: 5px; background: ${badge.badge_color || badge.BADGE_COLOR || '#f0f0f0'};">
                    <span style="font-size: 1.5em;">${badge.badge_icon || badge.BADGE_ICON || '🏆'}</span>
                    <strong>${badge.badge_name || badge.BADGE_NAME}</strong> ${equipped}
                    <br><small>${badge.badge_description || badge.BADGE_DESCRIPTION}</small>
                    <br><small>ID: ${badge.badge_id || badge.BADGE_ID}</small>
                </div>
            `;
        });
    } else {
        displayHtml += '<p>보유한 뱃지가 없습니다.</p>';
    }
    
    displayHtml += '</div>';
    
    // 기존 뱃지 표시 영역이 있으면 업데이트, 없으면 생성
    let badgesDisplay = document.getElementById('badges-display');
    if (!badgesDisplay) {
        badgesDisplay = document.createElement('div');
        badgesDisplay.id = 'badges-display';
        document.querySelector('.api-section h4:contains("뱃지 관리")').parentElement.appendChild(badgesDisplay);
    }
    badgesDisplay.innerHTML = displayHtml;
}
