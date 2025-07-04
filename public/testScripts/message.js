// testScripts/message.js - 메시지 관리 기능

import { updateApiResponse } from './utils.js';
import { addMessage, refreshSessionMessages } from './chat.js';

// *** 채팅 메시지 관리 테스트 함수들 ***

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

// =========================
// 9. 메시지 편집 기능 테스트
// =========================

export async function editMessageTest() {
    const messageIdInput = document.getElementById('message-id-input');
    const editContentInput = document.getElementById('edit-message-content');
    const editReasonInput = document.getElementById('edit-message-reason');
    
    const message_id = messageIdInput.value;
    const new_content = editContentInput.value;
    const edit_reason = editReasonInput.value || null;
    
    if (!message_id || !new_content) {
        alert('메시지 ID와 새로운 내용을 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${message_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: new_content,
                edit_reason
            })
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function getMessageHistoryTest() {
    const messageIdInput = document.getElementById('message-id-input');
    const message_id = messageIdInput.value;
    
    if (!message_id) {
        alert('메시지 ID를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${message_id}/history`);
        const data = await response.json();
        updateApiResponse(data);
        
        // 편집 기록을 시각적으로 표시
        displayMessageHistory(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function requestAiReresponseTest() {
    const sessionIdInput = document.getElementById('reresponse-session-id');
    const messageIdInput = document.getElementById('reresponse-message-id');
    
    const session_id = sessionIdInput.value;
    const message_id = messageIdInput.value;
    
    if (!session_id || !message_id) {
        alert('세션 ID와 메시지 ID를 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/sessions/${session_id}/messages/${message_id}/reresponse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

// 메시지 편집 기록 표시 함수
function displayMessageHistory(editHistory) {
    let displayHtml = '<div class="message-history-display"><h4>📝 메시지 편집 기록</h4>';
    
    if (Array.isArray(editHistory) && editHistory.length > 0) {
        editHistory.forEach((edit, index) => {
            const editDate = new Date(edit.edited_at || edit.EDITED_AT).toLocaleString();
            displayHtml += `
                <div class="edit-history-item" style="border: 1px solid #ddd; padding: 10px; margin: 5px; background: #f9f9f9;">
                    <strong>편집 #${index + 1}</strong> - ${editDate}
                    <br><strong>편집자:</strong> ${edit.edited_by || edit.EDITED_BY}
                    ${edit.edit_reason || edit.EDIT_REASON ? `<br><strong>편집 이유:</strong> ${edit.edit_reason || edit.EDIT_REASON}` : ''}
                    <br><strong>이전 내용:</strong> <pre style="background: #ffe6e6; padding: 5px; margin: 5px 0;">${edit.old_content || edit.OLD_CONTENT}</pre>
                    <br><strong>새 내용:</strong> <pre style="background: #e6ffe6; padding: 5px; margin: 5px 0;">${edit.new_content || edit.NEW_CONTENT}</pre>
                </div>
            `;
        });
    } else {
        displayHtml += '<p>편집 기록이 없습니다.</p>';
    }
    
    displayHtml += '</div>';
    
    // 기존 편집 기록 표시 영역이 있으면 업데이트, 없으면 생성
    let historyDisplay = document.getElementById('message-history-display');
    if (!historyDisplay) {
        historyDisplay = document.createElement('div');
        historyDisplay.id = 'message-history-display';
        // 메시지 관리 섹션 찾기
        const messageSection = Array.from(document.querySelectorAll('.api-section')).find(section => 
            section.querySelector('h3').textContent.includes('채팅 메시지 관리')
        );
        if (messageSection) {
            messageSection.appendChild(historyDisplay);
        }
    }
    historyDisplay.innerHTML = displayHtml;
}
