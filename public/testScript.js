// testScript.js - API 테스트 페이지 전용 스크립트

// DOM Elements for Chat UI in test page
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const apiResponse = document.getElementById('api-response');

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

// 시스템 프롬프트 입력 필드 (test.html에 추가됨)
const systemPromptInput = document.getElementById('system-prompt-input');
// 스트리밍 모드 체크박스 (test.html에 추가됨)
const streamModeCheckbox = document.getElementById('stream-mode-checkbox');

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
    localStorage.setItem('forceNewTestSession', 'true');
    location.reload();
});
if (refreshMessagesButton) refreshMessagesButton.addEventListener('click', refreshSessionMessages);

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
    }
    
    if (messageId) {
        messageElement.dataset.messageId = messageId;
        const idSpan = document.createElement('span');
        idSpan.classList.add('message-id');
        idSpan.textContent = `(ID: ${messageId})`;
        messageElement.appendChild(idSpan);
    }

    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    // 줄바꿈 처리: \n → <br> 변환
    let displayText = text ? String(text).replace(/\n/g, '<br>') : '';
    if (sender === 'user') {
        contentSpan.innerHTML = `나: ${displayText}`;
    } else if (sender === 'ai') {
        contentSpan.innerHTML = `AI: ${displayText}`;
    } else { // 시스템 메시지 등
        contentSpan.innerHTML = `[${sender}] ${displayText}`;
    }
    messageElement.appendChild(contentSpan);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 맨 아래로 스크롤
}

function createMessageElement(sender, text, messageId, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    if (messageId) {
        messageElement.dataset.messageId = messageId;
    }

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender');
    senderSpan.textContent = `${sender === 'user' ? '나' : (sender === 'ai' ? 'AI' : '시스템')}: `;

    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    // 줄바꿈 처리: \n → <br> 변환
    let displayText = text ? String(text).replace(/\\n/g, '<br>') : '(내용 없음)';
    contentSpan.innerHTML = displayText;

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = timestamp ? new Date(timestamp).toLocaleTimeString() : '';

    messageElement.appendChild(senderSpan);
    messageElement.appendChild(contentSpan);
    messageElement.appendChild(timestampSpan);

    if (messageId && sender !== 'system' && sender !== 'error') {
        addEditDeleteButtons(messageElement, messageId, sender);
    }
    return { messageElement, contentSpan }; // contentSpan도 반환하여 스트리밍 시 업데이트 용이하게 함
}

function addEditDeleteButtons(messageElement, messageId, sender) {
    const existingActions = messageElement.querySelector('.message-actions');
    if (existingActions) existingActions.remove();

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
                document.getElementById('edit-message-content').value = newContent;                editMessage(); 
            }
        };
        actionsDiv.appendChild(editButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.classList.add('delete-btn');
    deleteButton.onclick = () => {        if (confirm('정말로 이 메시지를 삭제하시겠습니까?')) {
            document.getElementById('delete-message-id').value = messageId;
            deleteMessage();
        }
    };
    actionsDiv.appendChild(deleteButton);
    messageElement.appendChild(actionsDiv);
}

// Removed duplicate declaration of isMessageSending
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    if (!currentSessionId) {
        alert('세션이 초기화되지 않았습니다. 먼저 세션을 생성하거나 선택해주세요.');
        return;
    }
    if (isMessageSending) {
        console.log("메시지 전송 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    isMessageSending = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '전송 중...';

    const userMessageContent = messageText;
    // 사용자 메시지를 먼저 UI에 추가 (ID는 아직 없음)
    const { messageElement: userMsgElement, contentSpan: userContentSpan } = createMessageElement('user', userMessageContent, null, new Date().toISOString());
    chatBox.appendChild(userMsgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
    messageInput.value = '';

    const systemPrompt = systemPromptInput ? systemPromptInput.value.trim() : '';
    const useStream = streamModeCheckbox ? streamModeCheckbox.checked : false;
    const useCanvas = document.getElementById('canvas-mode-checkbox') ? document.getElementById('canvas-mode-checkbox').checked : false; // 캔버스 모드 체크박스

    try {
        const requestBody = {
            message: userMessageContent,
            systemPrompt: systemPrompt, 
        };
        if (useStream) {
            requestBody.specialModeType = 'stream';
        } else if (useCanvas) {
            requestBody.specialModeType = 'canvas';
        }

        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        updateApiResponse(null); 

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: '메시지 전송에 실패했습니다.' } }));
            console.error('메시지 전송 실패:', errorData);
            const { messageElement: errorMsgElement } = createMessageElement('error', `오류: ${errorData.error.message || errorData.error}`, null, new Date().toISOString());
            chatBox.appendChild(errorMsgElement);
            chatBox.scrollTop = chatBox.scrollHeight;
            updateApiResponse(errorData);
            // 실패한 사용자 메시지에 대한 ID 업데이트는 없으므로, UI에서 사용자 메시지 ID를 업데이트할 필요는 없음
            return;
        }
        
        // 성공 시 사용자 메시지 ID를 받아와서 UI 업데이트 (스트림/일반 공통 로직으로 이동 가능성 검토)
        // 일반 응답의 경우 user_message_id가 반환됨. 스트림의 경우 첫 data 이벤트에서 user_message_id를 받을 수 있음.

        if (useStream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let aiMessageId = null;
            let userMessageIdForStream = null;
            let fullAiResponse = '';
            let tempAiMessageElement = null;
            let tempContentSpan = null;

            // 스트리밍 시작 시 AI 메시지 요소 생성
            const { messageElement, contentSpan } = createMessageElement('ai', 'AI 응답 대기 중...', null, new Date().toISOString());
            tempAiMessageElement = messageElement;
            tempContentSpan = contentSpan;
            chatBox.appendChild(tempAiMessageElement);
            chatBox.scrollTop = chatBox.scrollHeight;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 스트림 종료 처리
                    if (tempAiMessageElement && aiMessageId) {
                        tempAiMessageElement.dataset.messageId = aiMessageId; // 최종 AI 메시지 ID 설정
                        addEditDeleteButtons(tempAiMessageElement, aiMessageId, 'ai');
                    }
                    if (userMsgElement && userMessageIdForStream) {
                         userMsgElement.dataset.messageId = userMessageIdForStream; // 사용자 메시지 ID 설정
                         addEditDeleteButtons(userMsgElement, userMessageIdForStream, 'user');
                    }
                    console.log('Stream ended.');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                let eventEndIndex;
                
                // SSE 이벤트 파싱 (data: JSON\n\n 형식)
                while ((eventEndIndex = buffer.indexOf('\\n\\n')) !== -1) {
                    const eventDataString = buffer.substring(0, eventEndIndex);
                    buffer = buffer.substring(eventEndIndex + 2); // Consume the event and the two newlines

                    if (eventDataString.startsWith('event: error')) {
                        try {
                            const errorJsonString = eventDataString.substring(eventDataString.indexOf('data:') + 5);
                            const errorData = JSON.parse(errorJsonString);
                            console.error('스트리밍 오류 이벤트:', errorData);
                            if (tempContentSpan) {
                                tempContentSpan.innerHTML = `스트리밍 오류: ${errorData.message || JSON.stringify(errorData)}`;
                                tempAiMessageElement.classList.add('error-message');
                            }
                        } catch (e) {
                            console.error('스트리밍 오류 이벤트 파싱 실패:', e, eventDataString);
                            if (tempContentSpan) {
                                tempContentSpan.innerHTML = `스트리밍 오류 수신 (파싱 불가): ${eventDataString}`;
                                tempAiMessageElement.classList.add('error-message');
                            }
                        }
                        // 스트림 종료 또는 오류 처리 후 반복 중단 고려
                        return; // 오류 발생 시 함수 종료
                    } else if (eventDataString.startsWith('event: end')) {
                        try {
                            const endJsonString = eventDataString.substring(eventDataString.indexOf('data:') + 5);
                            const endData = JSON.parse(endJsonString);
                            console.log('스트리밍 종료 이벤트:', endData);
                            if (endData.ai_message_id) {
                                aiMessageId = endData.ai_message_id;
                            }
                             // 스트림 종료 시 사용자 메시지 ID가 있다면 여기서도 업데이트 가능
                            if (userMsgElement && userMessageIdForStream) {
                                userMsgElement.dataset.messageId = userMessageIdForStream;
                                if (!userMsgElement.querySelector('.message-actions')) { // 버튼 중복 방지
                                    addEditDeleteButtons(userMsgElement, userMessageIdForStream, 'user');
                                }
                            }
                            if (tempAiMessageElement && aiMessageId) {
                                tempAiMessageElement.dataset.messageId = aiMessageId;
                                if (!tempAiMessageElement.querySelector('.message-actions')) { // 버튼 중복 방지
                                     addEditDeleteButtons(tempAiMessageElement, aiMessageId, 'ai');
                                }
                            }
                        } catch (e) {
                            console.error('스트리밍 종료 이벤트 파싱 실패:', e, eventDataString);
                        }
                        // 스트림 종료 후 반복 중단
                        // break while; // while 루프를 명시적으로 탈출하려면 레이블 사용 필요 또는 return
                    } else if (eventDataString.startsWith('data:')) {
                        try {
                            const jsonString = eventDataString.substring(5);
                            const data = JSON.parse(jsonString);

                            if (data.user_message_id && !userMessageIdForStream) {
                                userMessageIdForStream = data.user_message_id;
                                if (userMsgElement) {
                                    userMsgElement.dataset.messageId = userMessageIdForStream;
                                    addEditDeleteButtons(userMsgElement, userMessageIdForStream, 'user');
                                }
                            }
                            if (data.chunk) {
                                fullAiResponse += data.chunk;
                                if (tempContentSpan) {
                                    tempContentSpan.innerHTML = String(fullAiResponse).replace(/\\n/g, '<br>'); // 줄바꿈 처리
                                }
                                chatBox.scrollTop = chatBox.scrollHeight;
                            }
                            if (data.ai_message_id) { // 스트림 중간에 ID가 올 수도 있음 (현재 로직에서는 end 이벤트에서 옴)
                                aiMessageId = data.ai_message_id;
                            }
                        } catch (e) {
                            console.error('스트리밍 데이터 파싱 실패:', e, eventDataString);
                            if (tempContentSpan) {
                                tempContentSpan.innerHTML += ` (파싱 오류: ${eventDataString})`.replace(/\\n/g, '<br>');
                            }
                        }
                    }
                }
            }
            // 스트림 디코더의 최종 부분 처리
            if (buffer.length > 0) {
                console.log("스트림 종료 후 남은 버퍼 (처리 시도):", buffer);
                // 필요시 남은 버퍼에 대한 추가 파싱 로직
            }


        } else {
            // 일반 또는 캔버스 모드 응답 처리
            const responseData = await response.json();
            updateApiResponse(responseData);

            if (userMsgElement && responseData.user_message_id) {
                userMsgElement.dataset.messageId = responseData.user_message_id;
                addEditDeleteButtons(userMsgElement, responseData.user_message_id, 'user');
            }
            
            const { messageElement: aiMsgElement } = createMessageElement('ai', responseData.message, responseData.ai_message_id, responseData.created_at);
            chatBox.appendChild(aiMsgElement);

            if (responseData.specialModeType === 'canvas' || (responseData.canvas_html || responseData.canvas_css || responseData.canvas_js)) {
                const canvasPreview = document.createElement('div');
                canvasPreview.classList.add('canvas-preview');
                canvasPreview.innerHTML = '<h4>Canvas 미리보기:</h4>';
                
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.height = '300px';
                iframe.style.border = '1px solid #ccc';
                canvasPreview.appendChild(iframe);
                
                let htmlContent = responseData.canvas_html || '';
                let cssContent = responseData.canvas_css || '';
                let jsContent = responseData.canvas_js || '';

                iframe.onload = () => {
                    const doc = iframe.contentWindow.document;
                    doc.open();
                    doc.write(`
                        <html>
                            <head>
                                <style>${cssContent}</style>
                            </head>
                            <body>
                                ${htmlContent}
                                <script>${jsContent}<\/script>
                            </body>
                        </html>
                    `);
                    doc.close();
                };
                // onload가 먼저 설정된 후 srcdoc 또는 src를 설정해야 함
                // 간단한 방법은 srcdoc을 사용하는 것이지만, 모든 브라우저에서 완벽히 지원되지 않을 수 있음.
                // 여기서는 onload 후 동적으로 내용을 작성하는 방식을 사용.
                // 초기 로드를 위해 빈 src를 설정하거나, about:blank를 사용할 수 있습니다.
                iframe.src = 'about:blank'; 
                
                // 코드를 표시할 영역
                if (htmlContent) {
                    const htmlCodeBlock = document.createElement('pre');
                    htmlCodeBlock.innerHTML = `<strong>HTML:</strong><br><code>${htmlContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, '<br>')}</code>`;
                    canvasPreview.appendChild(htmlCodeBlock);
                }
                if (cssContent) {
                    const cssCodeBlock = document.createElement('pre');
                    cssCodeBlock.innerHTML = `<strong>CSS:</strong><br><code>${cssContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, '<br>')}</code>`;
                    canvasPreview.appendChild(cssCodeBlock);
                }
                if (jsContent) {
                    const jsCodeBlock = document.createElement('pre');
                    jsCodeBlock.innerHTML = `<strong>JavaScript:</strong><br><code>${jsContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, '<br>')}</code>`;
                    canvasPreview.appendChild(jsCodeBlock);
                }
                aiMsgElement.appendChild(canvasPreview); // AI 메시지 요소 하위에 캔버스 미리보기 추가
            }
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch (error) {
        console.error('메시지 전송 중 네트워크 오류 또는 기타 오류:', error);
        const { messageElement: errorMsgElement } = createMessageElement('error', `오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(errorMsgElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        updateApiResponse({ error: { message: error.message } });
    } finally {
        isMessageSending = false;
        sendButton.disabled = false;
        sendButton.innerHTML = '전송';
    }
}

// --- Helper Function to Display API Response ---
function updateApiResponse(data) {
    if (data) {
        apiResponse.textContent = JSON.stringify(data, null, 2);
    } else {
        apiResponse.textContent = ''; // Clear previous response
    }
}

// --- API Call Functions ---

// User Registration
async function registerUser() {
    try {
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: registerUsernameInput.value,
                email: registerEmailInput.value,
                password: registerPasswordInput.value
            })
        });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok && data.user_id) {
            userIdInput.value = data.user_id;
            createSessionUserIdInput.value = data.user_id;
            getSessionsButton.value = data.user_id;
            userSettingsUserIdInput.value = data.user_id;
            profileImageUserIdInput.value = data.user_id;
            addMessage('시스템', `회원가입 성공: ${data.username} (ID: ${data.user_id})`);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// User Login
async function loginUser() {
    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: loginEmailInput.value,
                password: loginPasswordInput.value
            })
        });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok && data.user_id) {
            userIdInput.value = data.user_id;
            createSessionUserIdInput.value = data.user_id;
            getSessionsButton.value = data.user_id;
            userSettingsUserIdInput.value = data.user_id;
            profileImageUserIdInput.value = data.user_id;
            console.log(`로그인 성공: ${data.username} (ID: ${data.user_id})`);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Get User Profile
async function getUserProfile() {
    const user_id = userIdInput.value;
    if (!user_id) {
        displayApiResponse({ error: '사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/users/${user_id}/profile`);
        const data = await response.json();
        displayApiResponse(data);
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Delete User
async function deleteUser() {
    const user_id = userIdInput.value;
    if (!user_id) {
        displayApiResponse({ error: '사용자 ID를 입력하세요.' });
        return;
    }
    if (!confirm(`정말로 사용자 ID '${user_id}' 계정을 삭제하시겠습니까? 모든 관련 데이터가 삭제됩니다.`)) {
        return;
    }
    try {
        const response = await fetch(`/api/users/${user_id}`, { method: 'DELETE' });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok) {
            console.log(`사용자 ${user_id} 계정 삭제됨.`);
            userIdInput.value = '';
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Get User Settings
async function getUserSettings() {
    const user_id = userSettingsUserIdInput.value;
    if (!user_id) {
        displayApiResponse({ error: '설정 조회할 사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/users/${user_id}/settings`);
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok) {
            userSettingsPayloadInput.value = JSON.stringify(data, null, 2);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Update User Settings
async function updateUserSettings() {
    const user_id = userSettingsUserIdInput.value;
    if (!user_id) {
        displayApiResponse({ error: '설정 수정할 사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const payload = JSON.parse(userSettingsPayloadInput.value);
        const response = await fetch(`/api/users/${user_id}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        displayApiResponse(data);
    } catch (error) {
        displayApiResponse({ error: `오류: ${error.message}. Payload가 유효한 JSON인지 확인하세요.` });
    }
}

// Upload Profile Image
async function uploadProfileImage() {
    const user_id = profileImageUserIdInput.value;
    const file = profileImageFileInput.files[0];
    if (!user_id || !file) {
        displayApiResponse({ error: '사용자 ID와 이미지 파일을 선택하세요.' });
        return;
    }
    const formData = new FormData();
    formData.append('profileImage', file);
    try {
        const response = await fetch(`/api/users/${user_id}/profile/image`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        displayApiResponse(data);
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}


// Create Chat Session
async function createChatSession() {
    const user_id = createSessionUserIdInput.value;
    const title = createSessionTitleInput.value;
    if (!user_id || !title) {
        displayApiResponse({ error: '사용자 ID와 세션 제목을 입력하세요.' });
        return;
    }
    try {
        const body = { user_id, title };
        if (createSessionCategoryInput.value) {
            body.category = createSessionCategoryInput.value;
        }
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok && data.session_id) {
            sessionIdInput.value = data.session_id;
            uploadFileSessionIdInput.value = data.session_id;
            console.log(`새 세션 생성됨: ${data.title} (ID: ${data.session_id})`);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Get User Chat Sessions
async function getUserChatSessions() {
    const user_id = getSessionsButton.value;
    if (!user_id) {
        displayApiResponse({ error: '사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/sessions/${user_id}/chat/sessions`);
        const data = await response.json();
        displayApiResponse(data);
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Update Chat Session
async function updateChatSession() {
    const sessionId = sessionIdInput.value;
    if (!sessionId) {
        displayApiResponse({ error: '세션 ID를 입력하세요.' });
        return;
    }
    try {
        const payload = JSON.parse(updateSessionPayloadInput.value);
        const response = await fetch(`/api/chat/sessions/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        displayApiResponse(data);
    } catch (error) {
        displayApiResponse({ error: `오류: ${error.message}. Payload가 유효한 JSON인지 확인하세요.` });
    }
}

// Delete Chat Session
async function deleteChatSession() {
    const sessionId = sessionIdInput.value;
    if (!sessionId) {
        displayApiResponse({ error: '세션 ID를 입력하세요.' });
        return;
    }    if (!confirm(`정말로 세션 ID '${sessionId}'를 삭제하시겠습니까?`)) {
        return;
    }
    try {
        const response = await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
        const data = await response.json();
        displayApiResponse(data);
        
        // 현재 사용 중인 세션이 삭제되면 로컬 스토리지에서도 제거
        if (sessionId === currentSessionId) {
            localStorage.removeItem('currentTestSessionId');
            currentSessionId = null;
            addMessage('시스템', '현재 세션이 삭제되었습니다. 페이지를 새로고침하여 새 세션을 생성하세요.');
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Get Session Messages
async function getSessionMessages() {
    const sessionId = sessionIdInput.value;
    if (!sessionId) {
        displayApiResponse({ error: '세션 ID를 입력하세요.' });
        return;
    }    try {
        const response = await fetch(`/api/chat/sessions/${sessionId}/messages`);
        const data = await response.json();
        displayApiResponse(data);
        
        // 현재 세션 ID 업데이트
        currentSessionId = sessionId;
        
        // UI에 메시지 표시
        refreshSessionMessages(sessionId);
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Edit Message
async function editMessage() {
    const messageId = messageIdInput.value;
    const content = editMessageContentInput.value;
    if (!messageId || !content) {
        displayApiResponse({ error: '메시지 ID와 수정할 내용을 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();
        displayApiResponse(data);
        
        // 메시지가 업데이트되었으면 UI 업데이트
        if (data.updatedMessage) {
            updateMessageInUI(data.updatedMessage);
        }
        
        // 현재 세션이 있으면 메시지 목록 새로고침
        if (currentSessionId) {
            refreshSessionMessages(currentSessionId);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Add Reaction
async function addReaction() {
    const messageId = reactionMessageIdInput.value;
    const reaction = reactionContentInput.value;
    if (!messageId || !reaction) {
        displayApiResponse({ error: '메시지 ID와 리액션 내용을 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/chat/messages/${messageId}/reaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction })
        });
        const data = await response.json();
        displayApiResponse(data);
        
        // UI에 리액션 업데이트
        updateReactionInUI(messageId, reaction);
        
        // 현재 세션이 있으면 메시지 목록 새로고침
        if (currentSessionId) {
            refreshSessionMessages(currentSessionId);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Remove Reaction
async function removeReaction() {
    const messageId = reactionMessageIdInput.value;
    if (!messageId) {
        displayApiResponse({ error: '메시지 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/chat/messages/${messageId}/reaction`, {
            method: 'DELETE'
        });
        const data = await response.json();
        displayApiResponse(data);
        
        // UI에서 리액션 제거
        removeReactionFromUI(messageId);
        
        // 현재 세션이 있으면 메시지 목록 새로고침
        if (currentSessionId) {
            refreshSessionMessages(currentSessionId);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Delete Message
async function deleteMessage() {
    const messageId = deleteMessageIdInput.value;
    if (!messageId) {
        displayApiResponse({ error: '삭제할 메시지 ID를 입력하세요.' });
        return;
    }
    if (!confirm(`정말로 메시지 ID '${messageId}'를 삭제하시겠습니까?`)) {
        return;
    }
    try {
        const response = await fetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
        const data = await response.json();
        displayApiResponse(data);
        
        // UI에서 메시지 제거
        removeMessageFromUI(messageId);
        
        // 현재 세션이 있으면 메시지 목록 새로고침
        if (currentSessionId) {
            refreshSessionMessages(currentSessionId);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Upload File (Chat)
async function uploadChatFile() {
    const sessionId = uploadFileSessionIdInput.value;
    const file = chatFileInput.files[0];
    if (!sessionId || !file) {
        displayApiResponse({ error: '세션 ID와 파일을 선택하세요.' });
        return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch(`/api/chat/sessions/${sessionId}/files`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok && data.uploadedFile) {
             console.log(`파일 업로드 성공: ${data.uploadedFile.filename} (세션: ${sessionId})`);
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// 메시지 UI 업데이트 함수 - 메시지 ID로 메시지 찾아서 내용 업데이트
function updateMessageInUI(message) {
    // message-id 데이터 속성을 가진 메시지 요소 찾기
    const messageElement = document.querySelector(`div.message[data-message-id="${message.MESSAGE_ID}"]`);
    if (messageElement) {
        const contentElement = messageElement.querySelector('.message-content');
        if (contentElement) {
            // 메시지 유형에 따라 내용 업데이트
            if (message.MESSAGE_TYPE === 'user') {
                contentElement.textContent = `나: ${message.MESSAGE_CONTENT}`;
            } else if (message.MESSAGE_TYPE === 'ai') {
                contentElement.textContent = `AI: ${message.MESSAGE_CONTENT}`;
            } else {
                contentElement.textContent = `[${message.MESSAGE_TYPE}] ${message.MESSAGE_CONTENT}`;
            }
            
            // 편집됨 표시 추가
            if (message.IS_EDITED === 1) {
                const editedBadge = document.createElement('span');
                editedBadge.className = 'edited-badge';
                editedBadge.textContent = ' (편집됨)';
                contentElement.appendChild(editedBadge);
            }
        }
    }
}

// 메시지에 리액션 추가하는 UI 함수
function updateReactionInUI(messageId, reaction) {
    const messageElement = document.querySelector(`div.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        const reactionElement = messageElement.querySelector('.message-reaction') || document.createElement('div');
        reactionElement.className = 'message-reaction';
        reactionElement.textContent = reaction;
        messageElement.appendChild(reactionElement);
    }
}

// 메시지에서 리액션 제거하는 UI 함수
function removeReactionFromUI(messageId) {
    const messageElement = document.querySelector(`div.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        const reactionElement = messageElement.querySelector('.message-reaction');
        if (reactionElement) {
            reactionElement.remove();
        }
    }
}

// 메시지 삭제 UI 함수
function removeMessageFromUI(messageId) {
    const messageElement = document.querySelector(`div.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
}

// 세션 메시지 새로고침 함수
async function refreshSessionMessages() {
    if (!currentSessionId) {
        // alert('현재 활성화된 세션이 없습니다.');
        chatBox.innerHTML = '<div class="message system-message">세션을 선택하거나 생성해주세요.</div>';
        return;
    }
    try {
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: {message: '메시지 로드 실패'}}));
            updateApiResponse(errorData);
            const { messageElement } = createMessageElement('error', `메시지 로드 실패: ${errorData.error.message}`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
            return;
        }
        const messages = await response.json();
        chatBox.innerHTML = ''; // 기존 메시지 지우기
        if (messages.length === 0) {
            const { messageElement } = createMessageElement('system', '이 세션에는 아직 메시지가 없습니다.', null, new Date().toISOString());
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
    const user_id = createSessionUserIdInput.value || GUEST_USER_ID;
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
            currentSessionId = data.session_id;
            localStorage.setItem('currentSessionId', currentSessionId);
            if(sessionIdInput) sessionIdInput.value = currentSessionId; 
            const { messageElement } = createMessageElement('system', `새 세션 생성됨: ${currentSessionId}. 이 세션이 활성화됩니다.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
            await refreshSessionMessages(); 
        } else {
            const { messageElement } = createMessageElement('error', `세션 생성 실패: ${data.error.message || '알 수 없는 오류'}`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `세션 생성 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

async function getUserSessionsTest() {
    const user_id = getSessionsUserIdInput.value || GUEST_USER_ID;
    if (!user_id) {
        alert('사용자 ID를 입력해주세요.');
        return;
    }
    try {
        const response = await fetch(`/api/sessions/${user_id}/chat/sessions`);
        const data = await response.json();
        updateApiResponse(data);
        if (response.ok && sessionListDisplay) {
            sessionListDisplay.innerHTML = '<h4>사용자 세션 목록:</h4>';
            if (data.length > 0) {
                const ul = document.createElement('ul');
                data.forEach(session => {
                    const li = document.createElement('li');
                    li.textContent = `ID: ${session.session_id}, 제목: ${session.title || '제목 없음'}, 생성일: ${new Date(session.created_at).toLocaleString()}`;
                    li.style.cursor = 'pointer';
                    li.onclick = () => {
                        currentSessionId = session.session_id;
                        localStorage.setItem('currentSessionId', currentSessionId);
                        if(sessionIdInput) sessionIdInput.value = currentSessionId;
                        const { messageElement } = createMessageElement('system', `세션 ${currentSessionId}가 활성화되었습니다.`, null, new Date().toISOString());
                        chatBox.appendChild(messageElement);
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
        const response = await fetch(`/api/chat/sessions/${sessId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        updateApiResponse(data);
        if (response.ok) {
            const { messageElement } = createMessageElement('system', `세션 ${sessId} 삭제 성공.`, null, new Date().toISOString());
            chatBox.appendChild(messageElement);
            if (currentSessionId === sessId) {
                currentSessionId = null;
                localStorage.removeItem('currentSessionId');
                if(sessionIdInput) sessionIdInput.value = '';
                chatBox.innerHTML = '<div class="message system-message">현재 세션이 삭제되었습니다.</div>';
            }
            if (getSessionsUserIdInput.value) getUserSessionsTest(); 
        }
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
        const { messageElement } = createMessageElement('error', `세션 삭제 중 오류: ${error.message}`, null, new Date().toISOString());
        chatBox.appendChild(messageElement);
    }
}

async function getSessionMessagesTest() {
    const sessId = sessionIdInput.value;
    if (!sessId) {
        alert('메시지를 조회할 세션 ID를 입력해주세요.');
        return;
    }
    currentSessionId = sessId; 
    localStorage.setItem('currentSessionId', currentSessionId);
    const { messageElement } = createMessageElement('system', `세션 ${currentSessionId}의 메시지를 조회합니다.`, null, new Date().toISOString());
    chatBox.appendChild(messageElement);
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

// 메시지 액션 버튼 추가 기능 (편집, 삭제 버튼)
function addMessageActions(messageElement, messageId, sender) {
    const existingActions = messageElement.querySelector('.message-actions');
    if (existingActions) existingActions.remove();

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