// testScripts/utils.js - 공통 유틸리티 함수들

// API 응답 패널 업데이트 함수
export function updateApiResponse(data) {
    const apiResponse = document.getElementById('api-response');
    if (!apiResponse) return;
    
    try {
        apiResponse.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        apiResponse.textContent = `JSON 직렬화 오류: ${e.message}`;
    }
}

// 스트림 청크를 API 응답 패널에 추가하는 함수
export function appendToApiResponse(chunk) {
    const apiResponse = document.getElementById('api-response');
    if (!apiResponse) return;
    
    try {
        apiResponse.textContent += chunk;
    } catch (e) {
        apiResponse.textContent += `\n[청크 추가 오류: ${e.message}]`;
    }
}

// 메시지 액션 버튼 추가 기능 (편집, 삭제 버튼)
export function addMessageActions(messageElement, messageId, sender) {
    const existingActions = messageElement.querySelector('.message-actions');
    if (existingActions) return;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('message-actions');

    if (sender === 'user') {
        const editButton = document.createElement('button');
        editButton.textContent = '편집';
        editButton.classList.add('edit-btn');
        editButton.onclick = () => {
            const messageIdInput = document.getElementById('message-id-input');
            const editMessageContentInput = document.getElementById('edit-message-content');
            if (messageIdInput) messageIdInput.value = messageId;
            if (editMessageContentInput) {
                const contentSpan = messageElement.querySelector('.message-content');
                editMessageContentInput.value = contentSpan ? contentSpan.textContent : '';
            }
        };
        actionsDiv.appendChild(editButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.classList.add('delete-btn');
    deleteButton.onclick = () => {
        const deleteMessageIdInput = document.getElementById('delete-message-id');
        if (deleteMessageIdInput) deleteMessageIdInput.value = messageId;
    };
    actionsDiv.appendChild(deleteButton);
    messageElement.appendChild(actionsDiv);
}

// 공통 상수
export const GUEST_USER_ID = 'test-guest';
export const API_TEST_USER_ID = 'API_TEST_USER_ID';
