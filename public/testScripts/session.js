// testScripts/session.js - 세션 관리 기능

import { updateApiResponse } from './utils.js';
import { addMessage, setCurrentSessionId } from './chat.js';

const GUEST_USER_ID = 'guest';
const API_TEST_USER_ID = 'API_TEST_USER_ID';

// *** 채팅 세션 관리 테스트 함수들 ***
export async function createChatSessionTest() {
    const createSessionUserIdInput = document.getElementById('create-session-user-id');
    const createSessionTitleInput = document.getElementById('create-session-title');
    const createSessionCategoryInput = document.getElementById('create-session-category');
    
    const user_id = createSessionUserIdInput.value || API_TEST_USER_ID;
    const title = createSessionTitleInput.value || '새 테스트 세션';
    const category = createSessionCategoryInput.value || '일반';

    try {
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user_id, title, category })
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok && data.session_id) {
            setCurrentSessionId(data.session_id);
            addMessage('시스템', `새 세션이 생성되었습니다 (ID: ${data.session_id})`, null, 'system-message');
            
            // 세션 ID 자동 입력
            const sessionIdInput = document.getElementById('session-id-input');
            const uploadFileSessionIdInput = document.getElementById('upload-file-session-id');
            if (sessionIdInput) sessionIdInput.value = data.session_id;
            if (uploadFileSessionIdInput) uploadFileSessionIdInput.value = data.session_id;
        } else {
            addMessage('시스템', `세션 생성 실패: ${data.message || '알 수 없는 오류'}`, null, 'error-message');
        }
    } catch (error) {
        updateApiResponse({ error: error.message });
        addMessage('시스템', `세션 생성 중 오류: ${error.message}`, null, 'error-message');
        console.error('세션 생성 오류:', error);
    }
}

export async function getUserSessionsTest() {
    const getSessionsUserIdInput = document.getElementById('get-sessions-user-id');
    const user_id = getSessionsUserIdInput.value || API_TEST_USER_ID;
    
    if (!user_id) {
        alert('사용자 ID를 입력해주세요.');
        return;
    }
    
    try {
        console.log('사용자 세션 목록 요청:', user_id);
        const response = await fetch(`/api/sessions/${user_id}/chat/sessions`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`세션 목록 조회 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
        const sessionListDisplay = document.getElementById('session-list-display');
        if (sessionListDisplay) {
            if (data.sessions && data.sessions.length > 0) {
                sessionListDisplay.innerHTML = data.sessions.map(session => 
                    `<div class="session-item" data-session-id="${session.session_id}">
                        <strong>${session.title}</strong> (${session.category}) - ${session.created_at}
                        <button onclick="selectSession('${session.session_id}')">선택</button>
                    </div>`
                ).join('');
            } else {
                sessionListDisplay.innerHTML = '<div>세션이 없습니다.</div>';
            }
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function updateChatSessionTest() {
    const sessionIdInput = document.getElementById('session-id-input');
    const updateSessionPayloadInput = document.getElementById('update-session-payload');
    
    const sessId = sessionIdInput.value;
    const payloadString = updateSessionPayloadInput.value;
    
    if (!sessId) {
        alert('세션 ID를 입력해주세요.');
        return;
    }
    
    try {
        const payload = JSON.parse(payloadString);
        const response = await fetch(`/api/chat/sessions/${sessId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `세션 ${sessId}가 업데이트되었습니다.`, null, 'system-message');
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message, details: '페이로드가 유효한 JSON인지 확인하세요.' } });
        addMessage('error', `세션 업데이트 중 오류: ${error.message}`, null, new Date().toISOString());
    }
}

export async function deleteChatSessionTest() {
    const sessionIdInput = document.getElementById('session-id-input');
    const sessId = sessionIdInput.value;
    
    if (!sessId) {
        alert('삭제할 세션 ID를 입력해주세요.');
        return;
    }
    
    if (!confirm(`정말로 세션 ${sessId}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {        const response = await fetch(`/api/chat/sessions/${sessId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: API_TEST_USER_ID })
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `세션 ${sessId}가 삭제되었습니다.`, null, 'system-message');
            setCurrentSessionId(null);
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        addMessage('시스템', `세션 삭제 중 오류: ${error.message}`, null, 'error-message');
    }
}

export async function getSessionMessagesTest() {
    const { refreshSessionMessages, setCurrentSessionId } = await import('./chat.js');
    const sessionIdInput = document.getElementById('session-id-input');
    const sessId = sessionIdInput.value;
    
    if (!sessId) {
        alert('메시지를 조회할 세션 ID를 입력해주세요.');
        return;
    }
    
    setCurrentSessionId(sessId);
    addMessage('시스템', `세션 ${sessId}의 메시지를 조회합니다.`, null, 'system-message');
    await refreshSessionMessages();
}

// 전역 함수로 세션 선택 기능
window.selectSession = function(sessionId) {
    const sessionIdInput = document.getElementById('session-id-input');
    const uploadFileSessionIdInput = document.getElementById('upload-file-session-id');
    
    if (sessionIdInput) sessionIdInput.value = sessionId;
    if (uploadFileSessionIdInput) uploadFileSessionIdInput.value = sessionId;
    
    setCurrentSessionId(sessionId);
    addMessage('시스템', `세션 ${sessionId}를 선택했습니다.`, null, 'system-message');
}
