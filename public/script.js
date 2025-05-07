const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// 임시 세션 ID (실제 애플리케이션에서는 로그인 등을 통해 동적으로 관리해야 함)
let currentSessionId = null;
const GUEST_USER_ID = 'guest'; // 게스트 사용자 ID

// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직 (간단하게 구현)
async function initializeSession() {
    try {
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
        console.log('새 게스트 세션 생성됨:', currentSessionId);
        addMessage('시스템', `게스트 세션 시작 (ID: ${currentSessionId})`);
    } catch (error) {
        console.error('세션 초기화 오류:', error);
        addMessage('시스템', '세션 초기화 중 오류가 발생했습니다.');
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
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
        contentSpan.textContent = `AI: ${text}`;
    } else { // 시스템 메시지 등
         contentSpan.textContent = `[${sender}] ${text}`;
    }
    
    messageElement.appendChild(contentSpan);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 맨 아래로 스크롤
}

async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    if (!currentSessionId) {
        addMessage('시스템', '세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    // 사용자 메시지를 먼저 표시 (ID 없이)
    addMessage('user', messageText);
    messageInput.value = ''; // 입력 필드 초기화

    try {
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: messageText,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 전송 실패: ${errorData.error || response.statusText || '알 수 없는 서버 오류'}`);
        }

        const data = await response.json();
        
        if (data && data.message) {
            // AI 응답 표시
            addMessage('ai', data.message);
            
            // 디버깅 정보 콘솔에 출력
            console.log('응답 데이터:', data);
            if (data.ai_message_id) console.log('AI 메시지 ID:', data.ai_message_id);
            if (data.user_message_id) console.log('사용자 메시지 ID:', data.user_message_id);
        } else {
            addMessage('시스템', 'AI로부터 유효한 응답 메시지를 받지 못했습니다.');
            console.warn('서버로부터 받은 응답 데이터:', data);
        }

    } catch (error) {
        console.error('메시지 전송/응답 처리 오류:', error);
        addMessage('시스템', `오류 발생: ${error.message}`);
    }
}

// 페이지 로드 시 세션 초기화
if (sendButton) { // sendButton이 있는 페이지(index.html)에서만 실행
    initializeSession();
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
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
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
        contentSpan.textContent = `AI: ${text}`;
    } else { // 시스템 메시지 등
         contentSpan.textContent = `[${sender}] ${text}`;
    }
    
    messageElement.appendChild(contentSpan);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 맨 아래로 스크롤
}

async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    if (!currentSessionId) {
        addMessage('시스템', '세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    // 사용자 메시지를 먼저 표시 (ID 없이)
    addMessage('user', messageText);
    messageInput.value = ''; // 입력 필드 초기화

    try {
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: messageText,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 전송 실패: ${errorData.error || response.statusText || '알 수 없는 서버 오류'}`);
        }

        const data = await response.json();
        
        if (data && data.message) {
            // AI 응답 표시
            addMessage('ai', data.message);
            
            // 디버깅 정보 콘솔에 출력
            console.log('응답 데이터:', data);
            if (data.ai_message_id) console.log('AI 메시지 ID:', data.ai_message_id);
            if (data.user_message_id) console.log('사용자 메시지 ID:', data.user_message_id);
        } else {
            addMessage('시스템', 'AI로부터 유효한 응답 메시지를 받지 못했습니다.');
            console.warn('서버로부터 받은 응답 데이터:', data);
        }

    } catch (error) {
        console.error('메시지 전송/응답 처리 오류:', error);
        addMessage('시스템', `오류 발생: ${error.message}`);
    }
}
// --- Helper Function to Display API Response ---
// function displayApiResponse(data) { // testScript.js로 이동
//     apiResponse.textContent = JSON.stringify(data, null, 2);
// }

// --- API Call Functions --- (모두 testScript.js로 이동)

// --- Event Listeners for API Test Buttons --- (모두 testScript.js로 이동


// 페이지 로드 시 세션 초기화
if (sendButton) { // sendButton이 있는 페이지(index.html)에서만 실행
    initializeSession();
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}
