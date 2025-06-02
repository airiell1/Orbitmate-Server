// testScripts/user.js - 사용자 관리 기능

import { updateApiResponse } from './utils.js';

// --- 사용자 관리 테스트 함수들 ---
export async function registerUserTest() {
    const registerUsernameInput = document.getElementById('register-username');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    
    const username = registerUsernameInput.value;
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    
    try {
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function loginUserTest() {
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    
    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (data.token && data.user && data.user.user_id) {
            const userIdInput = document.getElementById('user-id-input');
            if (userIdInput) userIdInput.value = data.user.user_id;
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function getUserProfileTest() {
    const userIdInput = document.getElementById('user-id-input');
    const user_idToTest = userIdInput.value;
    
    if (!user_idToTest) { 
        alert('사용자 ID를 입력하세요.'); 
        return; 
    }
    
    try {
        const response = await fetch(`/api/users/${user_idToTest}/profile`);
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}

export async function deleteUserTest() {
    const userIdInput = document.getElementById('user-id-input');
    const user_idToTest = userIdInput.value;
    
    if (!user_idToTest) { 
        alert('삭제할 사용자 ID를 입력하세요.'); 
        return; 
    }
    
    if (!confirm(`정말로 사용자 ID ${user_idToTest}를 삭제하시겠습니까?`)) return;
    
    try {
        const response = await fetch(`/api/users/${user_idToTest}`, { method: 'DELETE' });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}

export async function getUserSettingsTest() {
    const userSettingsUserIdInput = document.getElementById('user-settings-user-id');
    const user_idToTest = userSettingsUserIdInput.value;
    
    if (!user_idToTest) { 
        alert('설정을 조회할 사용자 ID를 입력하세요.'); 
        return; 
    }
    
    try {
        const response = await fetch(`/api/users/${user_idToTest}/settings`);
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}

export async function updateUserSettingsTest() {
    const userSettingsUserIdInput = document.getElementById('user-settings-user-id');
    const userSettingsPayloadInput = document.getElementById('user-settings-payload');
    
    const user_idToTest = userSettingsUserIdInput.value;
    const payloadString = userSettingsPayloadInput.value;
    
    if (!user_idToTest || !payloadString) { 
        alert('사용자 ID와 설정 페이로드를 입력하세요.'); 
        return; 
    }
    
    try {
        const payload = JSON.parse(payloadString);
        const response = await fetch(`/api/users/${user_idToTest}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message, details: '페이로드가 유효한 JSON인지 확인하세요.' } });
    }
}

export async function uploadProfileImageTest() {
    const profileImageUserIdInput = document.getElementById('profile-image-user-id');
    const profileImageFileInput = document.getElementById('profile-image-file');
    
    const user_idToTest = profileImageUserIdInput.value;
    const file = profileImageFileInput.files[0];
    
    if (!user_idToTest || !file) { 
        alert('사용자 ID와 프로필 이미지를 선택하세요.'); 
        return; 
    }
    
    const formData = new FormData();
    formData.append('profileImage', file);
    
    try {
        const response = await fetch(`/api/users/${user_idToTest}/profile/image`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}
