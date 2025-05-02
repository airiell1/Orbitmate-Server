const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// 임시 세션 ID (실제 애플리케이션에서는 로그인 등을 통해 동적으로 관리해야 함)
let currentSessionId = null; 

// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직 (간단하게 구현)
async function initializeSession() {
    try {
        // 실제로는 사용자 ID 기반으로 세션을 가져오거나 생성해야 합니다.
        // 여기서는 테스트를 위해 간단히 새 세션을 생성합니다.
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 실제로는 로그인된 사용자 ID를 보내야 합니다. 임시 ID 사용.
            body: JSON.stringify({ userId: 'test-user-frontend', title: 'Frontend Test Session' }) 
        });
        if (!response.ok) {
            throw new Error(`세션 생성 실패: ${response.statusText}`);
        }
        const data = await response.json();
        currentSessionId = data.session_id;
        console.log('새 세션 생성됨:', currentSessionId);
        addMessage('시스템', `테스트 세션 시작 (ID: ${currentSessionId})`);
    } catch (error) {
        console.error('세션 초기화 오류:', error);
        addMessage('시스템', '세션 초기화 중 오류가 발생했습니다.');
    }
}

function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    if (sender === 'user') {
        messageElement.classList.add('user-message');
        messageElement.textContent = `나: ${text}`;
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
        messageElement.textContent = `AI: ${text}`;
    } else { // 시스템 메시지 등
         messageElement.textContent = `[${sender}] ${text}`;
    }
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

    addMessage('user', messageText);
    messageInput.value = ''; // 입력 필드 초기화

    try {
        // 서버의 채팅 메시지 엔드포인트로 요청 전송
        // 엔드포인트 경로 확인 필요 ('/api/chat/message' 또는 다른 경로일 수 있음)
        const response = await fetch('/api/chat/message', { // 엔드포인트 확인 필요
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: currentSessionId,
                message: messageText,
                // 실제로는 사용자 인증 정보 (예: 토큰)도 포함해야 할 수 있음
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 전송 실패: ${response.statusText} - ${errorData.error || '알 수 없는 오류'}`);
        }

        const data = await response.json();
        
        // AI 응답 표시 (응답 형식 확인 필요)
        // 응답 객체 구조에 따라 data.aiResponse 또는 다른 필드를 사용해야 할 수 있습니다.
        if (data && data.aiResponse) {
             addMessage('ai', data.aiResponse);
        } else {
             addMessage('시스템', 'AI로부터 응답을 받지 못했습니다.');
             console.warn('예상치 못한 응답 형식:', data);
        }

    } catch (error) {
        console.error('메시지 전송/응답 처리 오류:', error);
        addMessage('시스템', `오류 발생: ${error.message}`);
    }
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// 페이지 로드 시 세션 초기화
initializeSession();
