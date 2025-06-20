// testScripts/utils.js - 테스트 페이지 유틸리티 함수들

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
        editButton.onclick = async () => {
            const contentSpan = messageElement.querySelector('.message-content');
            const currentText = contentSpan ? contentSpan.textContent : '';
            // '나: ' 또는 'AI: ' 접두사 제거
            const cleanText = currentText.replace(/^(나|AI): /, '');
            
            const newContent = prompt('메시지 편집:', cleanText);
            if (newContent !== null && newContent.trim() !== '') {
                try {
                    // editMessageTest 함수를 직접 호출하는 대신 API 직접 호출
                    const response = await fetch(`/api/chat/messages/${messageId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: newContent.trim() })
                    });
                    const data = await response.json();
                    updateApiResponse(data);
                    
                    if (response.ok) {
                        // 메시지 내용 업데이트
                        contentSpan.textContent = `${sender === 'user' ? '나' : 'AI'}: ${newContent.trim()}`;
                        
                        // 편집됨 표시 추가 (이미 있으면 제거 후 추가)
                        const existingBadge = messageElement.querySelector('.edited-badge');
                        if (existingBadge) existingBadge.remove();
                        
                        const editedBadge = document.createElement('span');
                        editedBadge.className = 'edited-badge';
                        editedBadge.textContent = ' (편집됨)';
                        editedBadge.style.fontSize = '0.8em';
                        editedBadge.style.color = '#666';
                        contentSpan.appendChild(editedBadge);
                    }
                } catch (error) {
                    updateApiResponse({ error: { message: error.message } });
                    alert(`편집 중 오류가 발생했습니다: ${error.message}`);
                }
            }
        };
        actionsDiv.appendChild(editButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.classList.add('delete-btn');
    deleteButton.onclick = async () => {
        if (confirm(`정말로 이 메시지를 삭제하시겠습니까? (ID: ${messageId})`)) {
            try {
                // deleteMessageTest 함수를 직접 호출하는 대신 API 직접 호출
                const response = await fetch(`/api/chat/messages/${messageId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                updateApiResponse(data);
                
                if (response.ok) {
                    // UI에서 메시지 제거
                    messageElement.remove();
                } else {
                    alert(`삭제 실패: ${data.error?.message || '알 수 없는 오류'}`);
                }
            } catch (error) {
                updateApiResponse({ error: { message: error.message } });
                alert(`삭제 중 오류가 발생했습니다: ${error.message}`);
            }
        }
    };
    actionsDiv.appendChild(deleteButton);
    
    // 리액션 버튼 추가
    const reactionButton = document.createElement('button');
    reactionButton.textContent = '👍';
    reactionButton.classList.add('reaction-btn');
    reactionButton.onclick = async () => {
        const reaction = prompt('리액션을 입력하세요 (예: 👍, ❤️, 😊):', '👍');
        if (reaction !== null && reaction.trim() !== '') {
            try {
                const response = await fetch(`/api/chat/messages/${messageId}/reaction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reaction: reaction.trim() })
                });
                const data = await response.json();
                updateApiResponse(data);
                
                if (response.ok) {
                    // 리액션 표시 업데이트
                    let reactionSpan = messageElement.querySelector('.message-reaction');
                    if (!reactionSpan) {
                        reactionSpan = document.createElement('span');
                        reactionSpan.className = 'message-reaction';
                        reactionSpan.style.marginLeft = '10px';
                        reactionSpan.style.fontSize = '1.2em';
                        messageElement.appendChild(reactionSpan);
                    }
                    reactionSpan.textContent = reaction.trim();
                }
            } catch (error) {
                updateApiResponse({ error: { message: error.message } });
                alert(`리액션 추가 중 오류가 발생했습니다: ${error.message}`);
            }
        }
    };
    actionsDiv.appendChild(reactionButton);
    
    messageElement.appendChild(actionsDiv);
}

// Markdown 처리 함수
export function parseMarkdown(text) {
    if (typeof marked === 'undefined') {
        console.warn('Marked.js 라이브러리가 로드되지 않았습니다. 일반 텍스트로 표시합니다.');
        return text.replace(/\n/g, '<br>');
    }
    
    try {
        // Marked.js 설정
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.warn('Syntax highlighting 오류:', err);
                    }
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
        
        return marked.parse(text);
    } catch (e) {
        console.error('Markdown 파싱 오류:', e);
        return text.replace(/\n/g, '<br>');
    }
}

// 메시지 내용을 Markdown으로 렌더링하는 함수
export function renderMessageContent(content, isMarkdown = true) {
    if (!isMarkdown) {
        return content.replace(/\n/g, '<br>');
    }
    
    return parseMarkdown(content);
}
