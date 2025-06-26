// testScripts/user.js - 사용자 관리 기능 (개선된 버전)

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
 * 이메일 유효성 검사
 * @param {string} email - 검사할 이메일
 * @returns {boolean} 유효성 여부
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 비밀번호 유효성 검사
 * @param {string} password - 검사할 비밀번호
 * @returns {object} 유효성 검사 결과
 */
function validatePassword(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    return {
        isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
        message: password.length < minLength ? 
            `비밀번호는 최소 ${minLength}자 이상이어야 합니다.` :
            !hasUpperCase || !hasLowerCase || !hasNumbers ?
            '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다.' :
            ''
    };
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
// 사용자 관리 테스트 함수들
// =========================
export async function registerUserTest() {
    const username = getElementValue('register-username');
    const email = getElementValue('register-email');
    const password = getElementValue('register-password');
    
    // 입력값 검증
    if (!username) {
        updateApiResponse({ error: { message: '사용자명을 입력해주세요.' } });
        return;
    }
    
    if (!email || !validateEmail(email)) {
        updateApiResponse({ error: { message: '유효한 이메일 주소를 입력해주세요.' } });
        return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        updateApiResponse({ error: { message: passwordValidation.message } });
        return;
    }
    
    await executeApiCall(async () => {
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse({
            ...data,
            message: `사용자 '${username}' 등록이 완료되었습니다.`
        });
        
        // 입력 필드 초기화
        clearInputFields(['register-username', 'register-email', 'register-password']);
        
    }, '사용자를 등록하는 중...');
}

export async function loginUserTest() {
    const email = getElementValue('login-email');
    const password = getElementValue('login-password');
    
    // 입력값 검증
    if (!email || !validateEmail(email)) {
        updateApiResponse({ error: { message: '유효한 이메일 주소를 입력해주세요.' } });
        return;
    }
    
    if (!password) {
        updateApiResponse({ error: { message: '비밀번호를 입력해주세요.' } });
        return;
    }
    
    await executeApiCall(async () => {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse({
            ...data,
            message: `로그인 성공! 환영합니다, ${data.user?.username || '사용자'}님.`
        });
        
        // 로그인 성공 시 사용자 ID를 다른 폼에 자동 입력
        if (data.token && data.user && data.user.user_id) {
            const userIdFields = [
                'user-id-input',
                'customization-user-id',
                'level-user-id',
                'badge-user-id',
                'user-settings-user-id',
                'profile-image-user-id'
            ];
            
            userIdFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = data.user.user_id;
                }
            });
        }
        
        // 로그인 필드 초기화
        clearInputFields(['login-email', 'login-password']);
        
    }, '로그인하는 중...');
}

export async function getUserProfileTest() {
    const user_id = getElementValue('user-id-input');
    
    if (!user_id) { 
        updateApiResponse({ error: { message: '사용자 ID를 입력해주세요.' } });
        return; 
    }
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/profile`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
    }, '사용자 프로필을 가져오는 중...');
}

export async function deleteUserTest() {
    const user_id = getElementValue('user-id-input');
    
    if (!user_id) { 
        updateApiResponse({ error: { message: '삭제할 사용자 ID를 입력해주세요.' } });
        return; 
    }
    
    // 확인 대화상자 표시
    const confirmMessage = `정말로 사용자 ID '${user_id}'를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`;
    if (!confirm(confirmMessage)) {
        updateApiResponse({ message: '사용자 삭제가 취소되었습니다.' });
        return;
    }
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}`, { 
            method: 'DELETE' 
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse({
            ...data,
            message: `사용자 ID '${user_id}' 삭제가 완료되었습니다.`
        });
        
        // 삭제 완료 후 입력 필드 초기화
        clearInputFields(['user-id-input']);
        
    }, '사용자를 삭제하는 중...');
}

export async function getUserSettingsTest() {
    const user_id = getElementValue('user-settings-user-id');
    
    if (!user_id) { 
        updateApiResponse({ error: { message: '설정을 조회할 사용자 ID를 입력해주세요.' } });
        return; 
    }
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/settings`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
    }, '사용자 설정을 가져오는 중...');
}

export async function updateUserSettingsTest() {
    const user_id = getElementValue('user-settings-user-id');
    const payloadString = getElementValue('user-settings-payload');
    
    if (!user_id) { 
        updateApiResponse({ error: { message: '사용자 ID를 입력해주세요.' } });
        return; 
    }
    
    if (!payloadString) { 
        updateApiResponse({ error: { message: '설정 페이로드를 입력해주세요.' } });
        return; 
    }
    
    // JSON 유효성 검사
    let payload;
    try {
        payload = JSON.parse(payloadString);
    } catch (jsonError) {
        updateApiResponse({ 
            error: { 
                message: 'JSON 형식이 올바르지 않습니다.',
                details: jsonError.message 
            } 
        });
        return;
    }
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse({
            ...data,
            message: '사용자 설정이 성공적으로 업데이트되었습니다.'
        });
    }, '사용자 설정을 업데이트하는 중...');
}

export async function uploadProfileImageTest() {
    const user_id = getElementValue('profile-image-user-id');
    const profileImageFileInput = document.getElementById('profile-image-file');
    
    if (!user_id) { 
        updateApiResponse({ error: { message: '사용자 ID를 입력해주세요.' } });
        return; 
    }
    
    if (!profileImageFileInput || !profileImageFileInput.files[0]) { 
        updateApiResponse({ error: { message: '프로필 이미지 파일을 선택해주세요.' } });
        return; 
    }
    
    const file = profileImageFileInput.files[0];
    
    // 파일 유효성 검사
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
        updateApiResponse({ 
            error: { 
                message: '지원되는 이미지 형식이 아닙니다.',
                details: 'JPEG, PNG, GIF, WebP 형식만 지원됩니다.'
            } 
        });
        return;
    }
    
    // 파일 크기 검사 (5MB 제한)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        updateApiResponse({ 
            error: { 
                message: '파일 크기가 너무 큽니다.',
                details: '최대 5MB까지 업로드 가능합니다.'
            } 
        });
        return;
    }
    
    const formData = new FormData();
    formData.append('profileImage', file);
    
    await executeApiCall(async () => {
        const response = await fetch(`/api/users/${user_id}/profile/image`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse({
            ...data,
            message: '프로필 이미지가 성공적으로 업로드되었습니다.'
        });
        
        // 파일 입력 필드 초기화
        if (profileImageFileInput) {
            profileImageFileInput.value = '';
        }
        
    }, `이미지 파일 "${file.name}"을 업로드하는 중...`);
}

// =========================
// 유틸리티 함수들
// =========================

/**
 * 여러 입력 필드를 한번에 초기화하는 함수
 * @param {Array<string>} fieldIds - 초기화할 필드 ID 배열
 */
function clearInputFields(fieldIds) {
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.value = '';
        }
    });
}
