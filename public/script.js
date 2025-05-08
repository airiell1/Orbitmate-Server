const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// 임시 세션 ID (실제 애플리케이션에서는 로그인 등을 통해 동적으로 관리해야 함)
let currentSessionId = null;
const GUEST_USER_ID = 'guest'; // 게스트 사용자 ID
// 메시지 전송 중 상태 추적
let isMessageSending = false;

// 세션 초기화 상태 추적 - 전역 변수로 만들어 다른 스크립트에서도 접근 가능하게 함
window.sessionInitialized = false;

// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직 (간단하게 구현)
async function initializeSession() {
    try {
        // 로컬 스토리지에서 세션 ID 확인
        const savedSessionId = localStorage.getItem('currentSessionId');
        
        if (savedSessionId) {
            // 저장된 세션이 있으면 유효성 확인
            try {
                const checkResponse = await fetch(`/api/chat/sessions/${savedSessionId}/messages`);
                
                if (checkResponse.ok) {
                    currentSessionId = savedSessionId;
                    console.log('기존 세션 사용:', currentSessionId);
                    addMessage('시스템', `저장된 세션 사용 중 (ID: ${currentSessionId})`);
                    
                    // 저장된 메시지 불러오기
                    refreshMessages();
                    return; // 세션 재사용 성공, 함수 종료
                }
            } catch (error) {
                console.warn('세션 유효성 검사 실패:', error);
                localStorage.removeItem('currentSessionId');
            }
        }
        
        // GUEST_USER_ID를 사용하여 세션 생성
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // userId를 GUEST_USER_ID로 설정
            body: JSON.stringify({ userId: GUEST_USER_ID, title: 'Guest Session' })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentSessionId = data.session_id;
        
        // 세션 ID 저장
        localStorage.setItem('currentSessionId', currentSessionId);
        
        console.log('새 게스트 세션 생성됨:', currentSessionId);
        addMessage('시스템', `게스트 세션 시작 (ID: ${currentSessionId})`);
    } catch (error) {
        console.error('세션 초기화 오류:', error);
        addMessage('시스템', '세션 초기화 중 오류가 발생했습니다: ' + error.message);
    }
}

function addMessage(sender, text, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (messageId) {
        messageElement.dataset.messageId = messageId;
    }

    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    
    if (sender === 'user') {
        messageElement.classList.add('user-message');
        contentSpan.textContent = `나: ${text}`;
        
        // 사용자 메시지에만 편집/삭제 버튼 추가
        if (messageId) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const editButton = document.createElement('button');
            editButton.className = 'edit-button';
            editButton.textContent = '편집';
            editButton.addEventListener('click', () => startEditing(messageElement, text));
            actionsDiv.appendChild(editButton);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '삭제';
            deleteButton.addEventListener('click', () => deleteMessage(messageId));
            actionsDiv.appendChild(deleteButton);
            
            messageElement.appendChild(actionsDiv);
            
            // 편집 입력 컨테이너 추가
            const editInputContainer = document.createElement('div');
            editInputContainer.className = 'edit-input-container';
            
            const editInput = document.createElement('input');
            editInput.className = 'edit-input';
            editInput.type = 'text';
            editInput.value = text;
            editInputContainer.appendChild(editInput);
            
            const saveButton = document.createElement('button');
            saveButton.className = 'save-edit-button';
            saveButton.textContent = '저장';
            saveButton.addEventListener('click', () => saveEdit(messageId, editInput.value, messageElement));
            editInputContainer.appendChild(saveButton);
            
            const cancelButton = document.createElement('button');
            cancelButton.className = 'cancel-edit-button';
            cancelButton.textContent = '취소';
            cancelButton.addEventListener('click', () => cancelEditing(messageElement));
            editInputContainer.appendChild(cancelButton);
            
            messageElement.appendChild(editInputContainer);
        }
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
        contentSpan.textContent = `AI: ${text || '응답 없음'}`;
    } else { // 시스템 메시지 등
         contentSpan.textContent = `[${sender}] ${text}`;
    }
    
    messageElement.appendChild(contentSpan);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 맨 아래로 스크롤
}

// 메시지 편집 시작 함수
function startEditing(messageElement, text) {
    messageElement.classList.add('editing');
    const editInput = messageElement.querySelector('.edit-input');
    if (editInput) {
        editInput.value = text;
        editInput.focus();
    }
}

// 메시지 편집 취소 함수
function cancelEditing(messageElement) {
    messageElement.classList.remove('editing');
}

// 메시지 편집 저장 함수
async function saveEdit(messageId, newContent, messageElement) {
    try {
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: newContent
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 편집 실패: ${errorData.error || response.statusText || '알 수 없는 서버 오류'}`);
        }

        const data = await response.json();
        
        // 메시지 내용 업데이트
        messageElement.classList.remove('editing');
        const contentSpan = messageElement.querySelector('.message-content');
        if (contentSpan) {
            contentSpan.textContent = `나: ${newContent}`;
            
            // 편집됨 표시 추가
            const editedBadge = document.createElement('span');
            editedBadge.className = 'edited-badge';
            editedBadge.textContent = ' (편집됨)';
            contentSpan.appendChild(editedBadge);
        }
        
    } catch (error) {
        console.error('메시지 편집 오류:', error);
        addMessage('시스템', `메시지 편집 오류: ${error.message}`);
        messageElement.classList.remove('editing');
    }
}

// 메시지 삭제 함수
async function deleteMessage(messageId) {
    if (!confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 삭제 실패: ${errorData.error || response.statusText || '알 수 없는 서버 오류'}`);
        }

        // UI에서 메시지 삭제
        const messageElement = document.querySelector(`div.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
        
    } catch (error) {
        console.error('메시지 삭제 오류:', error);
        addMessage('시스템', `메시지 삭제 오류: ${error.message}`);
    }
}

async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    if (!currentSessionId) {
        addMessage('시스템', '세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    if (isMessageSending) {
        console.log('메시지 전송 중입니다. 잠시 기다려주세요.');
        return;
    }
    
    isMessageSending = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '전송 중...';
    
    const originalMessageText = messageText; // 서버로 보낼 메시지 텍스트
    messageInput.value = ''; // 입력 필드 초기화

    // promptFeature.js에서 설정한 selectedPrompt 값을 가져옴
    const selectedPrompt = messageInput.dataset.selectedPrompt;
    if (selectedPrompt) {
        console.log('Using prompt from dataset:', selectedPrompt);
        // 더 이상 필요 없으므로 dataset에서 제거 (선택적)
        // delete messageInput.dataset.selectedPrompt;
    }

    try {
        const requestBody = {
            message: originalMessageText,
        };

        if (selectedPrompt) {
            requestBody.prompt = selectedPrompt; // 프롬프트가 있으면 요청 본문에 추가
        }

        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody), // 수정된 요청 본문 사용
        });

        if (!response.ok) {
            const errorData = await response.json();
            // 오류 발생 시에도 사용자 입력은 화면에 표시 (선택적)
            // addMessage('user', originalMessageText);
            throw new Error(`메시지 전송 실패: ${errorData.error || response.statusText || '알 수 없는 서버 오류'}`);
        }

        const data = await response.json();
        
        // 서버 응답 후 사용자 메시지 추가 (ID와 함께)
        if (data.user_message_id) {
            addMessage('user', originalMessageText, data.user_message_id);
        } else {
            // 만약 user_message_id가 없다면 (정상적인 경우라면 없어야 함)
            addMessage('user', originalMessageText);
        }
        
        if (data && data.message) {
            addMessage('ai', data.message, data.ai_message_id);
            
            console.log('응답 데이터:', data);
            if (data.ai_message_id) console.log('AI 메시지 ID:', data.ai_message_id);
            if (data.user_message_id) console.log('사용자 메시지 ID:', data.user_message_id);
        } else {
            addMessage('시스템', 'AI로부터 유효한 응답 메시지를 받지 못했습니다.');
            console.warn('서버로부터 받은 응답 데이터:', data);
        }

    } catch (error) {
        console.error('메시지 전송/응답 처리 오류:', error);
        // 오류 시 사용자 메시지를 표시하려면 여기서도 추가 가능
        // addMessage('user', originalMessageText); 
        addMessage('시스템', `오류 발생: ${error.message}`);
    } finally {
        isMessageSending = false;
        sendButton.disabled = false;
        sendButton.innerHTML = '전송';
    }
}

// 페이지 로드 시 세션 초기화
// DOMContentLoaded 이벤트에서 한 번만 실행되도록 처리
let sessionInitialized = false;

// 서버에서 메시지 새로고침 함수
async function refreshMessages() {
    if (!currentSessionId) {
        addMessage('시스템', '세션이 아직 준비되지 않았습니다.');
        return;
    }
    try {
        const refreshButton = document.getElementById('refresh-messages-button');
        if (refreshButton) {
            refreshButton.textContent = '로딩 중...';
            refreshButton.disabled = true;
        }
        
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`);
        if (!response.ok) {
            throw new Error('메시지 목록을 불러오지 못했습니다.');
        }
        
        chatBox.innerHTML = '';
        addMessage('시스템', `채팅 세션 ID: ${currentSessionId}`);
        
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {        data.forEach(msg => {                // 대문자 또는 소문자 필드 모두 처리
                const messageType = msg.MESSAGE_TYPE || msg.message_type; 
                const messageContent = msg.MESSAGE_CONTENT || msg.message_content;
                const messageId = msg.MESSAGE_ID || msg.message_id;
                
                if (messageContent === undefined || messageContent === null) { 
                    console.warn('메시지 내용이 없는 메시지 발견:', msg);
                    return; 
                }
                  // 객체인 경우 JSON 형식으로 변환 시도
                let textContent;
                if (typeof messageContent === 'object') {
                    try {
                        textContent = JSON.stringify(messageContent, null, 2);
                        console.warn('메시지 내용이 객체 형태라서 문자열로 변환:', textContent);
                    } catch (err) {
                        console.error('객체를 문자열로 변환 중 오류:', err);
                        textContent = '(표시할 수 없는 형식)';
                    }
                } else {
                    // 문자열이 아닌 경우 안전하게 문자열로 변환
                    textContent = typeof messageContent === 'string' ? messageContent : 
                                 (messageContent === null || messageContent === undefined) ? 
                                 '(내용 없음)' : String(messageContent);
                }

                const sender = messageType === 'user' ? 'user' : 'ai';
                addMessage(sender, textContent, messageId);
            });
        } else {
            addMessage('시스템', '이 세션에는 아직 메시지가 없습니다.');
        }
    } catch (error) {
        console.error('메시지 새로고침 오류:', error);
        addMessage('시스템', `메시지 새로고침 오류: ${error.message}`);
    } finally {
        // 새로고침 버튼 상태 복원
        const refreshButton = document.getElementById('refresh-messages-button');
        if (refreshButton) {
            refreshButton.textContent = '새로고침';
            refreshButton.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // 세션이 이미 초기화되어 있으면 중복 실행 방지
    if (window.sessionInitialized) {
        console.log('세션이 이미 초기화되어 있습니다. script.js에서 초기화를 건너뜁니다.');
        return;
    }
    
    if (sendButton) { // sendButton이 있는 페이지(index.html)에서만 실행
        initializeSession();
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // 새로고침 버튼 이벤트 연결
        const refreshButton = document.getElementById('refresh-messages-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', refreshMessages);
        }
        
        // 세션 초기화 버튼 이벤트 연결
        const resetSessionButton = document.getElementById('reset-session-button');
        if (resetSessionButton) {
            resetSessionButton.addEventListener('click', async function() {
                if (confirm('현재 세션을 초기화하고 새로운 대화를 시작하시겠습니까?')) {
                    // 로컬 스토리지에서 세션 ID 제거
                    localStorage.removeItem('currentSessionId');
                    // 채팅창 초기화
                    chatBox.innerHTML = '';
                    // 새 세션 시작
                    await initializeSession();
                }
            });        }
        
        window.sessionInitialized = true;
        console.log('세션 초기화 완료');
    }
});
