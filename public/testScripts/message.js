// testScripts/message.js - 메시지 관리 기능

import { updateApiResponse } from './utils.js';
import { addMessage, refreshSessionMessages } from './chat.js';

// *** 채팅 메시지 관리 테스트 함수들 ***
export async function editMessageTest() {
    const messageIdInput = document.getElementById('message-id-input');
    const editMessageContentInput = document.getElementById('edit-message-content');
    
    const msgId = messageIdInput.value;
    const content = editMessageContentInput.value;
    
    if (!msgId || !content) {
        alert('메시지 ID와 수정할 내용을 모두 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `메시지 ${msgId}가 수정되었습니다.`, null, 'system-message');
            await refreshSessionMessages(); // 메시지 목록 새로고침
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        addMessage('error', `메시지 수정 중 오류: ${error.message}`, null, new Date().toISOString());
    }
}

export async function addReactionTest() {
    const reactionMessageIdInput = document.getElementById('reaction-message-id');
    const reactionContentInput = document.getElementById('reaction-content');
    
    const msgId = reactionMessageIdInput.value;
    const reaction = reactionContentInput.value;
    
    if (!msgId || !reaction) {
        alert('리액션을 추가할 메시지 ID와 리액션 내용을 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${msgId}/reaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction })
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `메시지 ${msgId}에 리액션이 추가되었습니다.`, null, 'system-message');
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function removeReactionTest() {
    const reactionMessageIdInput = document.getElementById('reaction-message-id');
    const msgId = reactionMessageIdInput.value;
    
    if (!msgId) {
        alert('리액션을 제거할 메시지 ID를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${msgId}/reaction`, {
            method: 'DELETE'
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `메시지 ${msgId}의 리액션이 제거되었습니다.`, null, 'system-message');
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function deleteMessageTest() {
    const deleteMessageIdInput = document.getElementById('delete-message-id');
    const msgId = deleteMessageIdInput.value;
    
    if (!msgId) {
        alert('삭제할 메시지 ID를 입력해주세요.');
        return;
    }
    
    if (!confirm(`정말로 메시지 ${msgId}를 삭제하시겠습니까?`)) return;

    try {
        const response = await fetch(`/api/chat/messages/${msgId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `메시지 ${msgId}가 삭제되었습니다.`, null, 'system-message');
            await refreshSessionMessages(); // 메시지 목록 새로고침
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

// *** 파일 업로드 테스트 함수 ***
export async function uploadFileTest() {
    const uploadFileSessionIdInput = document.getElementById('upload-file-session-id');
    const chatFileInput = document.getElementById('chat-file-input');
    const { getCurrentSessionId } = await import('./chat.js');
    
    const sessId = uploadFileSessionIdInput.value || getCurrentSessionId();
    
    if (!sessId) {
        alert('파일을 업로드할 세션 ID를 입력해주세요.');
        return;
    }
    
    if (chatFileInput.files.length === 0) {
        alert('업로드할 파일을 선택해주세요.');
        return;
    }
    
    const file = chatFileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`/api/chat/sessions/${sessId}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok) {
            addMessage('시스템', `파일 "${file.name}"이 업로드되었습니다.`, null, 'system-message');
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}
