// testScript.js - API 테스트 페이지 전용 스크립트

// DOM Elements for Chat UI in test page
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const apiResponse = document.getElementById('api-response');

// AI Provider 및 모델 선택 라디오 버튼
const aiProviderRadios = document.querySelectorAll('input[name="aiProvider"]');
const ollamaModelRadios = document.querySelectorAll('input[name="ollamaModel"]');
const qatCheckbox = document.getElementById('it-qat'); // 양자화 체크박스

// 시스템 프롬프트 입력 필드 및 스트리밍 모드 체크박스
const systemPromptInput = document.getElementById('system-prompt-input');
const streamModeCheckbox = document.getElementById('stream-mode-checkbox');

// 임시 세션 ID (실제 애플리케이션에서는 로그인 등을 통해 동적으로 관리해야 함)
let currentSessionId = null;
const GUEST_USER_ID = 'guest';
// 메시지 중복 전송 방지 플래그
let isMessageSending = false;

// DOM Elements for API testing
const registerUsernameInput = document.getElementById('register-username');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const userIdInput = document.getElementById('user-id-input'); // test.html에 해당 ID가 있는지 확인 필요
const userSettingsUserIdInput = document.getElementById('user-settings-user-id');
const userSettingsPayloadInput = document.getElementById('user-settings-payload');
const profileImageUserIdInput = document.getElementById('profile-image-user-id');
const profileImageFileInput = document.getElementById('profile-image-file');

const createSessionUserIdInput = document.getElementById('create-session-user-id');
const createSessionTitleInput = document.getElementById('create-session-title');
const createSessionCategoryInput = document.getElementById('create-session-category');
const getSessionsUserIdInput = document.getElementById('get-sessions-user-id');
const sessionIdInput = document.getElementById('session-id-input'); // 공용 세션 ID 입력 필드
const updateSessionPayloadInput = document.getElementById('update-session-payload');

const messageIdInput = document.getElementById('message-id-input');
const editMessageContentInput = document.getElementById('edit-message-content');
const reactionMessageIdInput = document.getElementById('reaction-message-id');
const reactionContentInput = document.getElementById('reaction-content');
const deleteMessageIdInput = document.getElementById('delete-message-id');
const uploadFileSessionIdInput = document.getElementById('upload-file-session-id');
const chatFileInput = document.getElementById('chat-file-input');


// Buttons for API testing
const registerButton = document.getElementById('register-button');
const loginButton = document.getElementById('login-button');
const getUserProfileButton = document.getElementById('get-user-profile-button');
const deleteUserButton = document.getElementById('delete-user-button');
const getUserSettingsButton = document.getElementById('get-user-settings-button');
const updateUserSettingsButton = document.getElementById('update-user-settings-button');
const uploadProfileImageButton = document.getElementById('upload-profile-image-button');

const createSessionButton = document.getElementById('create-session-button');
const getUserSessionsButton = document.getElementById('get-user-sessions-button');
const updateSessionButton = document.getElementById('update-session-button');
const deleteSessionButton = document.getElementById('delete-session-button');
const getSessionMessagesButton = document.getElementById('get-session-messages-button');

const editMessageButton = document.getElementById('edit-message-button');
const addReactionButton = document.getElementById('add-reaction-button');
const removeReactionButton = document.getElementById('remove-reaction-button');
const deleteMessageButton = document.getElementById('delete-message-button');
const uploadFileButton = document.getElementById('upload-file-button');

// 테스트 페이지용 채팅 UI 버튼
const resetSessionButton = document.getElementById('reset-session-button');
const refreshMessagesButton = document.getElementById('refresh-messages-button');

// 세션 목록 표시 영역 (test.html에 추가됨)
const sessionListDisplay = document.getElementById('session-list-display');

// =========================
// 이벤트 리스너 연결 (버튼 동작 연결)
// =========================
if (registerButton) registerButton.addEventListener('click', registerUserTest);
if (loginButton) loginButton.addEventListener('click', loginUserTest);
if (getUserProfileButton) getUserProfileButton.addEventListener('click', getUserProfileTest);
if (deleteUserButton) deleteUserButton.addEventListener('click', deleteUserTest);
if (getUserSettingsButton) getUserSettingsButton.addEventListener('click', getUserSettingsTest);
if (updateUserSettingsButton) updateUserSettingsButton.addEventListener('click', updateUserSettingsTest);
if (uploadProfileImageButton) uploadProfileImageButton.addEventListener('click', uploadProfileImageTest);

if (createSessionButton) createSessionButton.addEventListener('click', createChatSessionTest);
if (getUserSessionsButton) getUserSessionsButton.addEventListener('click', getUserSessionsTest);
if (updateSessionButton) updateSessionButton.addEventListener('click', updateChatSessionTest);
if (deleteSessionButton) deleteSessionButton.addEventListener('click', deleteChatSessionTest);
if (getSessionMessagesButton) getSessionMessagesButton.addEventListener('click', getSessionMessagesTest);

if (editMessageButton) editMessageButton.addEventListener('click', editMessageTest);
if (addReactionButton) addReactionButton.addEventListener('click', addReactionTest);
if (removeReactionButton) removeReactionButton.addEventListener('click', removeReactionTest);
if (deleteMessageButton) deleteMessageButton.addEventListener('click', deleteMessageTest);
if (uploadFileButton) uploadFileButton.addEventListener('click', uploadFileTest);

if (resetSessionButton) resetSessionButton.addEventListener('click', () => {
    initializeSession();
});
if (refreshMessagesButton) refreshMessagesButton.addEventListener('click', refreshSessionMessages);

if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
}
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// --- Chat Functions ---
// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직
async function initializeSession() {
    try {
        // 로컬 스토리지에서 세션 ID 확인
        const savedSessionId = localStorage.getItem('currentTestSessionId');
        const forceNewSession = localStorage.getItem('forceNewTestSession') === 'true';
        
        // 강제로 새 세션을 만들어야 하는 경우 저장된 세션 ID를 무시
        if (forceNewSession) {
            localStorage.removeItem('currentTestSessionId');
            localStorage.removeItem('forceNewTestSession');
            console.log('새 세션 생성 요청이 있습니다. 저장된 세션 무시.');
        } else if (savedSessionId) {
            // 저장된 세션이 있으면 재사용 시도
            try {
                // 세션이 유효한지 확인 (세션 정보 조회)
                const checkResponse = await fetch(`/api/chat/sessions/${savedSessionId}/messages`);
                
                if (checkResponse.ok) {
                    currentSessionId = savedSessionId;
                    console.log('기존 테스트 세션 사용:', currentSessionId);
                    addMessage('시스템', `저장된 테스트 세션 사용 중 (ID: ${currentSessionId})`, null, 'system-message');
                    
                    // 세션 ID 자동 입력
                    if (sessionIdInput) {
                        sessionIdInput.value = currentSessionId;
                    }
                    if (uploadFileSessionIdInput) {
                        uploadFileSessionIdInput.value = currentSessionId;
                    }
                    return; // 세션 재사용 성공, 함수 종료
                } else {
                    console.warn('저장된 세션이 유효하지 않습니다. 새 세션을 생성합니다.');
                    localStorage.removeItem('currentTestSessionId'); // 유효하지 않은 세션 ID 제거
                }
            } catch (error) {
                console.warn('세션 유효성 검사 실패:', error);
                localStorage.removeItem('currentTestSessionId'); // 오류 발생 시 세션 ID 제거
            }
        }
        
        // 새 세션 생성
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // user_id를 GUEST_USER_ID로 설정
            body: JSON.stringify({ 
                user_id: GUEST_USER_ID, 
                title: `Test Session ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` 
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentSessionId = data.session_id;
        
        // 세션 ID 저장
        localStorage.setItem('currentTestSessionId', currentSessionId);
        
        console.log('새 테스트 세션 생성됨:', currentSessionId);
        addMessage('시스템', `새로운 테스트 세션 시작 (ID: ${currentSessionId})`, null, 'system-message');
        
        // 세션 ID 자동 입력
        if (sessionIdInput) {
            sessionIdInput.value = currentSessionId;
        }
        if (uploadFileSessionIdInput) {
            uploadFileSessionIdInput.value = currentSessionId;
        }
    } catch (error) {
        console.error('세션 초기화 오류:', error);
        addMessage('시스템', '세션 초기화 중 오류가 발생했습니다: ' + error.message, null, 'system-message');
    }
}

function addMessage(sender, text, messageId = null, className = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (className) {
        messageElement.classList.add(className);
    } else if (sender === 'user') {
        messageElement.classList.add('user-message');
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
    } else if (sender === 'system') {
        messageElement.classList.add('system-message');
    }
    
    if (messageId) {
        messageElement.dataset.messageId = messageId;
    }

    // 메시지 내용을 담을 컨테이너
    const contentContainer = document.createElement('div');
    contentContainer.classList.add('message-container');

    // 발신자 표시
    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = `${sender === 'user' ? '나' : (sender === 'ai' ? 'AI' : sender)}: `;
    contentContainer.appendChild(senderSpan);

    // 메시지 내용
    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    contentSpan.textContent = text || '';
    contentContainer.appendChild(contentSpan);

    // AI 소스 정보 표시 (있을 경우)
    if (sender === 'ai' && (aiSource || ai_provider || ollama_model)) {
        const sourceInfo = document.createElement('div');
        sourceInfo.classList.add('ai-source-info');
        sourceInfo.textContent = `${aiSource || (ai_provider === 'ollama' ? `Ollama (${ollama_model || 'gemma3:4b'})` : 'Gemini')}`;
        contentContainer.appendChild(sourceInfo);
    }

    messageElement.appendChild(contentContainer);
    
    // 메시지 ID가 있는 경우 액션 버튼 추가
    if (messageId && sender !== 'system') {
        addMessageActions(messageElement, messageId, sender);
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 스크롤 자동으로 아래로

    return {
        messageElement,
        contentSpan
    };
}

// Removed duplicate declaration of isMessageSending
async function sendMessage() {
    if (isMessageSending) {
        console.warn("메시지 전송 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    if (!currentSessionId) {
        alert("세션이 초기화되지 않았습니다. 페이지를 새로고침하거나 새 세션을 시작해주세요.");
        return;
    }

    isMessageSending = true;
    sendButton.disabled = true;
    addMessageToChatBox('user', messageText, null, 'user_message'); // 사용자 메시지 먼저 표시
    messageInput.value = '';

    // AI Provider 선택
    let selectedAiProvider = 'ollama'; // 기본값
    aiProviderRadios.forEach(radio => {
        if (radio.checked) {
            selectedAiProvider = radio.value;
        }
    });

    // Ollama 모델 선택 (aiProvider가 ollama일 경우에만 유효)
    let selectedOllamaModel = 'gemma3:4b'; // 기본값
    if (selectedAiProvider === 'ollama') {
        ollamaModelRadios.forEach(radio => {
            if (radio.checked) {
                selectedOllamaModel = radio.value;
            }
        });
        if (qatCheckbox.checked && selectedOllamaModel) { // 양자화 모델명 처리
            selectedOllamaModel += '-it-qat';
        }
    }

    // 시스템 프롬프트 및 스트리밍 모드
    const systemPrompt = systemPromptInput.value.trim();
    const streamMode = streamModeCheckbox.checked;
    const specialModeType = streamMode ? 'stream' : null;

    const requestBody = {
        message: messageText,
        ai_provider: selectedAiProvider,
        ollama_model: selectedAiProvider === 'ollama' ? selectedOllamaModel : undefined, // ollama일 때만 모델 전송
        specialModeType: specialModeType
    };
    
    // systemPrompt가 존재할 경우에만 요청에 포함
    if (systemPrompt && systemPrompt.length > 0) {
        requestBody.systemPrompt = systemPrompt;
    }

    console.log('전송할 요청 본문:', requestBody);
    
    let aiMessageElement = null;
    let aiMessageContentSpan = null;
    let userMessageId = null;
    let aiMessageId = null;

    try {
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${localStorage.getItem('authToken')}` // 필요시 토큰 추가
            },
            body: JSON.stringify(requestBody)
        });

        apiResponse.textContent = ''; // 이전 API 응답 내용 초기화

        if (streamMode && response.ok && response.headers.get('Content-Type')?.includes('text/event-stream')) {
            // 스트리밍 응답 처리
            console.log('스트리밍 응답 시작. Content-Type:', response.headers.get('Content-Type'));
            apiResponse.textContent = '=== 스트리밍 응답 시작 ===\n';
            
            // AI 메시지 표시를 위한 초기 요소 생성 (ID 없이)
            const tempAiElement = addMessageToChatBox('ai', 'AI 응답 대기 중...', null, 'ai_message_streaming', true, selectedAiProvider, selectedOllamaModel);
            aiMessageElement = tempAiElement.messageElement;
            aiMessageContentSpan = tempAiElement.contentSpan;
            aiMessageContentSpan.textContent = ''; // 실제 내용으로 채우기 위해 초기화

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    console.log('스트림 읽기 완료 (reader done)');
                    // 스트림 종료 시, 최종적으로 누적된 내용으로 messageElement 업데이트 (필요하다면)
                    if (aiMessageElement && aiMessageId && !aiMessageElement.querySelector('.message-actions')) {
                        // 아직 액션 버튼이 없는 경우에만 추가
                        addMessageActions(aiMessageElement, aiMessageId, 'ai');
                    }
                    break;
                }
                
                // 수신된 데이터를 버퍼에 추가
                const chunk = decoder.decode(value, { stream: true });
                console.log('수신된 데이터 청크:', chunk);
                buffer += chunk;
                
                // 줄 단위로 이벤트 처리
                let eolIndex;
                while ((eolIndex = buffer.indexOf('\n\n')) >= 0) {
                    const eventDataString = buffer.substring(0, eolIndex).trim();
                    buffer = buffer.substring(eolIndex + 2);

                    // 로그 추가 - 수신된 데이터 내용 확인
                    console.log('스트림 이벤트 데이터:', eventDataString);

                    if (eventDataString.startsWith('event: ids')) {
                        const jsonData = eventDataString.substring(eventDataString.indexOf('data:') + 5).trim();
                        try {
                            const ids = JSON.parse(jsonData);
                            userMessageId = ids.userMessageId;
                            aiMessageId = ids.aiMessageId; // AI 메시지 ID도 받음
                            
                            // API 응답 패널에 IDs 데이터 표시
                            appendToApiResponse(`IDs 이벤트: ${JSON.stringify(ids)}`);
                            
                            // 사용자 메시지에 ID 업데이트 (이미 표시된 메시지를 찾아 업데이트해야 함 - 복잡도 증가)
                            // AI 메시지 요소에 ID 설정
                            if (aiMessageElement && aiMessageId) {
                                aiMessageElement.dataset.messageId = aiMessageId;
                                // 액션 버튼은 스트림 종료 시점에 추가하는 것이 더 안정적일 수 있음
                            }
                        } catch (e) {
                            console.error('Error parsing IDs JSON:', e, jsonData);
                            appendToApiResponse(`ID 파싱 오류: ${e.message} - 원본 데이터: ${jsonData}`);
                        }
                    } else if (eventDataString.startsWith('data:')) {
                        // 수정: 이벤트 타입이 없는 경우의 데이터 처리 방식 개선
                        const jsonData = eventDataString.substring(eventDataString.indexOf('data:') + 5).trim();
                        try {
                            const data = JSON.parse(jsonData);
                            // API 응답 패널에 청크 데이터 표시
                            appendToApiResponse(`청크: ${JSON.stringify(data)}`);
                            
                            // 스트림 종료 메시지 확인
                            if (data.message === 'Stream ended') {
                                console.log('Received stream end signal from data event.');
                                appendToApiResponse('=== 스트림 종료 ===');
                                // 스트림 종료 시 최종 작업 (예: 액션 버튼 추가)
                                if (aiMessageElement && aiMessageId) {
                                    addMessageActions(aiMessageElement, aiMessageId, 'ai');
                                }
                            } 
                            // 청크 타입인 경우
                            else if (data.type === 'chunk' && data.content) {
                                if (aiMessageContentSpan) {
                                    aiMessageContentSpan.textContent += data.content;
                                    chatBox.scrollTop = chatBox.scrollHeight; // 스크롤 자동 내림
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing chunk JSON:', e, jsonData);
                            appendToApiResponse(`파싱 오류: ${e.message} - 원본 데이터: ${jsonData}`);
                        }
                    } else if (eventDataString.startsWith('event: end')) {
                        console.log('Received stream end event.');
                        appendToApiResponse('=== 스트림 종료 이벤트 ===');
                        // 스트림 종료 시 최종 작업 (예: 액션 버튼 추가)
                        if (aiMessageElement && aiMessageId) {
                           addMessageActions(aiMessageElement, aiMessageId, 'ai');
                        }
                        break; // while 루프 종료
                    } else if (eventDataString.startsWith('event: error')) {
                        const jsonData = eventDataString.substring(eventDataString.indexOf('data:') + 5).trim();
                        try {
                            const errorData = JSON.parse(jsonData);
                            console.error('Stream error from server:', errorData.message);
                            appendToApiResponse(`스트림 오류 이벤트: ${JSON.stringify(errorData)}`);
                            
                            if (aiMessageContentSpan) {
                                aiMessageContentSpan.textContent = `스트림 오류: ${errorData.message}`;
                                aiMessageContentSpan.classList.add('error-message');
                            }
                        } catch (e) {
                            console.error('Error parsing stream error JSON:', e, jsonData);
                            appendToApiResponse(`오류 이벤트 파싱 실패: ${e.message} - 원본 데이터: ${jsonData}`);
                            
                            if (aiMessageContentSpan) {
                                 aiMessageContentSpan.textContent = '스트림 중 알 수 없는 오류 발생';
                                 aiMessageContentSpan.classList.add('error-message');
                            }
                        }
                        break; // while 루프 종료
                    }
                }
            }
        } else if (response.ok) {
            // 비스트리밍 응답 처리
            const data = await response.json();
            apiResponse.textContent = JSON.stringify(data, null, 2);
            if (data.message) {
                const aiMsgElement = addMessageToChatBox('ai', data.message, data.ai_message_id, 'ai_message', false, selectedAiProvider, selectedOllamaModel, data.ai_source);
                if (data.ai_message_id) {
                    addMessageActions(aiMsgElement.messageElement, data.ai_message_id, 'ai');
                }
            }
            // 사용자 메시지 ID 업데이트 (필요한 경우)
            if (data.user_message_id) {
                // 이전에 표시된 사용자 메시지를 찾아 ID를 설정하는 로직 추가 가능
            }

        } else {
            // 오류 응답 처리
            const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류', message: response.statusText }));
            console.error('Error sending message:', errorData);
            apiResponse.textContent = `Error: ${response.status} ${response.statusText}\n${JSON.stringify(errorData, null, 2)}`;
            addMessageToChatBox('system', `오류: ${errorData.message || response.statusText}`, null, 'error-message');
        }
    } catch (error) {
        console.error('네트워크 오류 또는 요청 실패:', error);
        apiResponse.textContent = `네트워크 오류: ${error.message}`;
        addMessageToChatBox('system', `네트워크 오류: ${error.message}`, null, 'error-message');
    } finally {
        isMessageSending = false;
        sendButton.disabled = false;
    }
}

// 메시지를 채팅창에 추가하는 함수 (sendMessage 함수에서 사용중이지만 정의가 없음)
function addMessageToChatBox(sender, text, messageId = null, className = null, isStream = false, ai_provider = null, ollama_model = null, aiSource = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (className) {
        messageElement.classList.add(className);
    } else if (sender === 'user') {
        messageElement.classList.add('user-message');
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
    } else if (sender === 'system') {
        messageElement.classList.add('system-message');
    }
    
    if (messageId) {
        messageElement.dataset.messageId = messageId;
    }

    // 메시지 내용을 담을 컨테이너
    const contentContainer = document.createElement('div');
    contentContainer.classList.add('message-container');

    // 발신자 표시
    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = `${sender === 'user' ? '나' : (sender === 'ai' ? 'AI' : sender)}: `;
    contentContainer.appendChild(senderSpan);

    // 메시지 내용
    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    contentSpan.textContent = text || '';
    contentContainer.appendChild(contentSpan);

    // AI 소스 정보 표시 (있을 경우)
    if (sender === 'ai' && (aiSource || ai_provider || ollama_model)) {
        const sourceInfo = document.createElement('div');
        sourceInfo.classList.add('ai-source-info');
        sourceInfo.textContent = `${aiSource || (ai_provider === 'ollama' ? `Ollama (${ollama_model || 'gemma3:4b'})` : 'Gemini')}`;
        contentContainer.appendChild(sourceInfo);
    }

    messageElement.appendChild(contentContainer);
    
    // 메시지 ID가 있는 경우 액션 버튼 추가
    if (messageId && sender !== 'system') {
        addMessageActions(messageElement, messageId, sender);
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 스크롤 자동으로 아래로

    return {
        messageElement,
        contentSpan
    };
}

// 세션 메시지 새로고침 함수
async function refreshSessionMessages() {
    if (!currentSessionId) {
        // alert('현재 활성화된 세션이 없습니다.');
        chatBox.innerHTML = '<div class="message system-message">세션을 선택하거나 생성해주세요.</div>';
        return;
    }
    
    try {
        console.log('메시지 새로고침 요청:', currentSessionId);
        
        // 새로운 각주: 메시지 로드 오류 시 상세 정보 추가
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`);
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = {error: errorText || '메시지 로드 실패'};
            }
            
            console.error('메시지 로드 실패:', errorData);
            updateApiResponse(errorData);
            
            chatBox.innerHTML = ''; // 기존 메시지 지우기
            const messageElement = document.createElement('div');
            messageElement.className = 'message system-message error';
            messageElement.textContent = `메시지 로드 실패: ${errorData.error || response.status}`;
            chatBox.appendChild(messageElement);
            return;
        }
        
        const messages = await response.json();
        updateApiResponse({success: true, message_count: messages.length, data: messages});
        
        chatBox.innerHTML = ''; // 기존 메시지 지우기
        
        if (messages.length === 0) {
            const messageElement = document.createElement('div');
            messageElement.className = 'message system-message';
            messageElement.textContent = '이 세션에는 아직 메시지가 없습니다.';
            chatBox.appendChild(messageElement);
        } else {
            messages.forEach(msg => {
                // message_type이 'user' 또는 'ai'인지, 아니면 다른 값인지 확인 필요
                // API 응답에 sender 정보가 없으므로 message_type으로 구분
                const sender = msg.message_type === 'user' ? 'user' : 'ai';
                const { messageElement } = createMessageElement(sender, msg.message_content, msg.message_id, msg.created_at);
                chatBox.appendChild(messageElement);
            });
        }
        chatBox.scrollTop = chatBox.scrollHeight;
        updateApiResponse({ success: true, message_count: messages.length, messages: messages });
    } catch (error) {
        console.error('메시지 새로고침 중 오류:', error);
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `메시지 로드 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

// createMessageElement 함수 추가 - 기존 addMessage 함수와 동일한 역할
function createMessageElement(sender, text, messageId = null, timestamp = null) {
    // 추가한 요소를 바로 반환하지 않고 먼저 addMessage를 통해 화면에 표시합니다
    const messageObj = addMessage(sender, text, messageId, sender === 'error' ? 'error-message' : null);
    return messageObj; // 필요한 요소 반환
}

// --- 사용자 관리 테스트 함수들 ---
async function registerUserTest() {
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

async function loginUserTest() {
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
            // 로그인 성공 시 사용자 ID를 관련 필드에 자동 입력 (선택적)
            if(userIdInput) userIdInput.value = data.user.user_id;
            if(userSettingsUserIdInput) userSettingsUserIdInput.value = data.user.user_id;
            if(profileImageUserIdInput) profileImageUserIdInput.value = data.user.user_id;
            if(createSessionUserIdInput) createSessionUserIdInput.value = data.user.user_id;
            if(getSessionsUserIdInput) getSessionsUserIdInput.value = data.user.user_id;
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

async function getUserProfileTest() {
    const user_idToTest = userIdInput.value;
    if (!user_idToTest) { alert('사용자 ID를 입력하세요.'); return; }
    try {
        const response = await fetch(`/api/users/${user_idToTest}/profile`);
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}

async function deleteUserTest() {
    const user_idToTest = userIdInput.value;
    if (!user_idToTest) { alert('삭제할 사용자 ID를 입력하세요.'); return; }
    if (!confirm(`정말로 사용자 ID ${user_idToTest}를 삭제하시겠습니까?`)) return;
    try {
        const response = await fetch(`/api/users/${user_idToTest}`, { method: 'DELETE' });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}

async function getUserSettingsTest() {
    const user_idToTest = userSettingsUserIdInput.value;
    if (!user_idToTest) { alert('설정을 조회할 사용자 ID를 입력하세요.'); return; }
    try {
        const response = await fetch(`/api/users/${user_idToTest}/settings`);
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: error.message });
    }
}

async function updateUserSettingsTest() {
    const user_idToTest = userSettingsUserIdInput.value;
    const payloadString = userSettingsPayloadInput.value;
    if (!user_idToTest || !payloadString) { alert('사용자 ID와 설정 페이로드를 입력하세요.'); return; }
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

async function uploadProfileImageTest() {
    const user_idToTest = profileImageUserIdInput.value;
    const file = profileImageFileInput.files[0];
    if (!user_idToTest || !file) { alert('사용자 ID와 프로필 이미지를 선택하세요.'); return; }
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


// *** 채팅 세션 관리 테스트 함수들 ***
async function createChatSessionTest() {
    // API_TEST_USER_ID를 사용하도록 변경
    const user_id = createSessionUserIdInput.value || 'API_TEST_USER_ID'; // 고정 테스트 유저 ID 사용
    const title = createSessionTitleInput.value || '새 테스트 세션';
    const category = createSessionCategoryInput.value || '일반';

    try {
        // API 호출
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user_id, title, category })
        });
        const data = await response.json();
        updateApiResponse(data);
        
        if (response.ok && data.session_id) {
            // 성공 시 세션 ID 저장 및 UI 업데이트
            currentSessionId = data.session_id;
            localStorage.setItem('currentTestSessionId', currentSessionId);
            
            // 모든 세션 ID 입력 필드 업데이트
            if(sessionIdInput) sessionIdInput.value = currentSessionId;
            if(uploadFileSessionIdInput) uploadFileSessionIdInput.value = currentSessionId;
            
            // 시스템 메시지 추가
            addMessage('시스템', `새 세션 생성됨: ${currentSessionId}. 이 세션이 활성화됩니다.`, null, 'system-message');
            
            // 세션 메시지 새로고침 - API_TEST_USER_ID를 사용했으므로 테스트 메시지가 있어야 함
            await refreshSessionMessages(); 
            
            // 세션 정보를 표시하는 추가 메시지
            console.log('세션 생성 성공:', data);
            // 세션 목록 갱신
            if (user_id === 'API_TEST_USER_ID') {
                getUserSessionsTest();
            }
        } else {
            // 실패 시 오류 메시지 표시
            addMessage('시스템', `세션 생성 실패: ${data.error || '알 수 없는 오류'}`, null, 'error-message');
        }
    } catch (error) {
        updateApiResponse({ error: error.message });
        addMessage('시스템', `세션 생성 중 오류: ${error.message}`, null, 'error-message');
        console.error('세션 생성 오류:', error);
    }
}

async function getUserSessionsTest() {
    // API_TEST_USER_ID를 기본값으로 설정
    const user_id = getSessionsUserIdInput.value || 'API_TEST_USER_ID'; 
    if (!user_id) {
        alert('사용자 ID를 입력해주세요.');
        return;
    }
    try {
        console.log('사용자 세션 목록 요청:', user_id);
          // API 경로 수정 - 올바른 API 엔드포인트 사용 (sessions.js 라우터에 맞춤)
        const response = await fetch(`/api/sessions/${user_id}/chat/sessions`);
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = {error: errorText || '세션 목록 로드 실패'};
            }
            
            console.error('세션 목록 로드 실패:', errorData);
            updateApiResponse(errorData);
            return;
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
        if (sessionListDisplay) {
            sessionListDisplay.innerHTML = '<h4>사용자 세션 목록:</h4>';
            if (data && data.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'session-list';
                
                data.forEach(session => {
                    const li = document.createElement('li');
                    li.className = 'session-item';
                    li.textContent = `ID: ${session.session_id}, 제목: ${session.title || '제목 없음'}, 생성일: ${new Date(session.created_at).toLocaleString()}`;
                    
                    // 클릭시 세션 선택 기능 강화
                    li.style.cursor = 'pointer';
                    li.style.padding = '8px';
                    li.style.margin = '4px 0';
                    li.style.backgroundColor = '#f5f5f5';
                    li.style.border = '1px solid #ddd';
                    li.style.borderRadius = '4px';
                    
                    // 현재 세션인 경우 강조
                    if (session.session_id === currentSessionId) {
                        li.style.backgroundColor = '#e3f2fd';
                        li.style.fontWeight = 'bold';
                        li.style.borderColor = '#2196F3';
                    }
                    
                    li.onclick = () => {
                        currentSessionId = session.session_id;
                        localStorage.setItem('currentTestSessionId', currentSessionId);
                        
                        // 모든 세션 ID 입력 필드 업데이트
                        if(sessionIdInput) sessionIdInput.value = currentSessionId;
                        if(uploadFileSessionIdInput) uploadFileSessionIdInput.value = currentSessionId;
                        
                        // UI 강조 효과
                        document.querySelectorAll('.session-list .session-item').forEach(item => {
                            item.style.backgroundColor = '#f5f5f5';
                            item.style.fontWeight = 'normal';
                            item.style.borderColor = '#ddd';
                        });
                        li.style.backgroundColor = '#e3f2fd';
                        li.style.fontWeight = 'bold';
                        li.style.borderColor = '#2196F3';
                        
                        addMessage('시스템', `세션 ${currentSessionId}가 활성화되었습니다.`, null, 'system-message');
                        refreshSessionMessages();
                    };
                    ul.appendChild(li);
                });
                sessionListDisplay.appendChild(ul);
            } else {
                sessionListDisplay.innerHTML += '<p>이 사용자의 세션이 없습니다.</p>';
            }
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

async function updateChatSessionTest() {
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
            const { messageElement } = createMessageElement('system', `세션 ${sessId} 정보 업데이트 성공.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message, details: '페이로드가 유효한 JSON인지 확인하세요.' } });
        const { messageElement } = createMessageElement('error', `세션 업데이트 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

async function deleteChatSessionTest() {
    const sessId = sessionIdInput.value;
    if (!sessId) {
        alert('삭제할 세션 ID를 입력해주세요.');
        return;
    }
    if (!confirm(`정말로 세션 ${sessId}를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
        // API 요청 오류 수정 - user_id를 요청 본문에 포함
        const response = await fetch(`/api/chat/sessions/${sessId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: GUEST_USER_ID }) // API 문서에 따라 user_id 필요
        });
        const data = await response.json();
        updateApiResponse(data);
        if (response.ok) {
            addMessage('시스템', `세션 ${sessId} 삭제 성공.`, null, 'system-message');
            if (currentSessionId === sessId) {
                currentSessionId = null;
                localStorage.removeItem('currentTestSessionId'); // 수정: 올바른 키 이름 사용
                if(sessionIdInput) sessionIdInput.value = '';
                if(uploadFileSessionIdInput) uploadFileSessionIdInput.value = ''; // 추가: 파일 업로드 필드도 초기화
                chatBox.innerHTML = '<div class="message system-message">현재 세션이 삭제되었습니다.</div>';
            }
            if (getSessionsUserIdInput.value) getUserSessionsTest(); 
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        addMessage('시스템', `세션 삭제 중 오류: ${error.message}`, null, 'error-message');
    }
}

async function getSessionMessagesTest() {
    const sessId = sessionIdInput.value;
    if (!sessId) {
        alert('메시지를 조회할 세션 ID를 입력해주세요.');
        return;
    }
    currentSessionId = sessId; 
    localStorage.setItem('currentTestSessionId', currentSessionId); // 수정: 올바른 키 이름 사용
    addMessage('시스템', `세션 ${currentSessionId}의 메시지를 조회합니다.`, null, 'system-message');
    await refreshSessionMessages();
}

// *** 채팅 메시지 관리 테스트 함수들 ***
async function editMessageTest() {
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
            const { messageElement } = createMessageElement('system', `메시지 ${msgId} 수정 성공.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
            await refreshSessionMessages(); 
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `메시지 수정 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

async function addReactionTest() {
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
            const { messageElement } = createMessageElement('system', `메시지 ${msgId}에 리액션 '${reaction}' 추가 성공.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `리액션 추가 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

async function removeReactionTest() {
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
            const { messageElement } = createMessageElement('system', `메시지 ${msgId}의 리액션 제거 성공.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `리액션 제거 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

async function deleteMessageTest() {
    const msgId = deleteMessageIdInput.value;
    if (!msgId) {
        alert('삭제할 메시지 ID를 입력하세요.');
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
            const { messageElement } = createMessageElement('system', `메시지 ${msgId} 삭제 성공.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
            await refreshSessionMessages(); 
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `메시지 삭제 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

// *** 파일 업로드 테스트 함수 ***
async function uploadFileTest() {
    const sessId = uploadFileSessionIdInput.value || currentSessionId;
    const fileInput = chatFileInput;
    if (!sessId) {
        alert('파일을 업로드할 세션 ID를 입력하거나 현재 세션을 활성화해주세요.');
        return;
    }
    if (fileInput.files.length === 0) {
        alert('업로드할 파일을 선택해주세요.');
        return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`/api/chat/sessions/${sessId}/files`, {
            method: 'POST',
            body: formData 
        });
        const data = await response.json();
        updateApiResponse(data);
        if (response.ok) {
            const { messageElement } = createMessageElement('system', `파일 '${file.name}' 업로드 성공 (메시지 ID: ${data.messageId}).`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
            await refreshSessionMessages(); 
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `파일 업로드 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

// API 응답 패널 업데이트 함수
function updateApiResponse(data) {
    if (!apiResponse) return;
    
    try {
        // null이나 undefined인 경우 빈 객체로 대체
        data = data || {};
        
        // 오류 표시 여부에 따라 스타일 설정
        if (data.error) {
            apiResponse.classList.add('api-error');
        } else {
            apiResponse.classList.remove('api-error');
        }
        
        // 객체를 보기 좋게 포맷팅된 JSON으로 변환
        const formattedJson = JSON.stringify(data, null, 2);
        apiResponse.textContent = formattedJson;
    } catch (e) {
        console.error('API 응답 업데이트 오류:', e);
        apiResponse.textContent = `응답 표시 오류: ${e.message}`;
        apiResponse.classList.add('api-error');
    }
}

// 스트림 청크를 API 응답 패널에 추가하는 함수
function appendToApiResponse(chunk) {
    if (!apiResponse) return;
    
    try {
        // 이미 내용이 있으면 줄바꿈으로 구분
        if (apiResponse.textContent && apiResponse.textContent.trim() !== '') {
            apiResponse.textContent += '\n';
        }
        
        // 청크 내용 추가
        apiResponse.textContent += chunk;
        
        // 스크롤 자동 내림
        apiResponse.scrollTop = apiResponse.scrollHeight;
    } catch (e) {
        console.error('API 응답 청크 추가 오류:', e);
    }
}

// 메시지 액션 버튼 추가 기능 (편집, 삭제 버튼)
function addMessageActions(messageElement, messageId, sender) {
    const existingActions = messageElement.querySelector('.message-actions');
    if (existingActions) existingActions.remove(); // 중복 방지

    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('message-actions');

    if (sender === 'user') { // 사용자 메시지만 수정 가능
        const editButton = document.createElement('button');
        editButton.textContent = '수정';
        editButton.classList.add('edit-btn');
        editButton.onclick = () => {
            const currentContentElement = messageElement.querySelector('.message-content');
            const currentContent = currentContentElement.textContent;
            const newContent = prompt('메시지 수정:', currentContent);
            if (newContent !== null && newContent.trim() !== '') {
                document.getElementById('message-id-input').value = messageId;
                document.getElementById('edit-message-content').value = newContent;
                editMessage(); 
            }
        };
        actionsDiv.appendChild(editButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.classList.add('delete-btn');
    deleteButton.onclick = () => {
        if (confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
            document.getElementById('delete-message-id').value = messageId;
            deleteMessage();
        }
    };
    actionsDiv.appendChild(deleteButton);
    messageElement.appendChild(actionsDiv);
}