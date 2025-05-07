// testScript.js - API 테스트 페이지 전용 스크립트

// DOM Elements for Chat UI in test page
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const apiResponse = document.getElementById('api-response');

// 임시 세션 ID (실제 애플리케이션에서는 로그인 등을 통해 동적으로 관리해야 함)
let currentSessionId = null;
const GUEST_USER_ID = 'test-user-frontend'; // 테스트용 사용자 ID - 이미 데이터베이스에 존재하는 ID 사용

// DOM Elements for API testing
const registerUsernameInput = document.getElementById('register-username');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const userIdInput = document.getElementById('user-id-input');
const userSettingsUserIdInput = document.getElementById('user-settings-user-id'); // ID 수정
const userSettingsPayloadInput = document.getElementById('user-settings-payload');
const profileImageUserIdInput = document.getElementById('profile-image-user-id');
const profileImageFileInput = document.getElementById('profile-image-file');

const createSessionUserIdInput = document.getElementById('create-session-user-id');
const createSessionTitleInput = document.getElementById('create-session-title');
const createSessionCategoryInput = document.getElementById('create-session-category');
const getSessionsUserIdInput = document.getElementById('get-sessions-user-id');
const sessionIdInput = document.getElementById('session-id-input');
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

// --- Chat Functions ---
// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직 (간단하게 구현)
async function initializeSession() {
    try {
        // GUEST_USER_ID를 사용하여 세션 생성 (테스트용)
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // userId를 GUEST_USER_ID로 설정
            body: JSON.stringify({ userId: GUEST_USER_ID, title: 'Test Session' })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentSessionId = data.session_id;
        console.log('새 테스트 세션 생성됨:', currentSessionId);
        addMessage('시스템', `테스트 세션 시작 (ID: ${currentSessionId})`);
        
        // 세션 ID 자동 입력
        if (sessionIdInput) {
            sessionIdInput.value = currentSessionId;
        }
        if (uploadFileSessionIdInput) {
            uploadFileSessionIdInput.value = currentSessionId;
        }
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
        const idSpan = document.createElement('span');
        idSpan.classList.add('message-id');
        idSpan.textContent = `(ID: ${messageId})`;
        messageElement.appendChild(idSpan);
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
                // user_id: GUEST_USER_ID // sendMessageController에서 처리하도록 수정
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 전송 실패: ${errorData.error || response.statusText || '알 수 없는 서버 오류'}`);
        }

        const data = await response.json();
        
        // API 응답 패널에도 표시
        displayApiResponse(data);
        
        if (data && data.message) {
            // AI 응답 표시 (AI 메시지 ID와 함께)
            addMessage('ai', data.message, data.ai_message_id);
            
            // 이전에 추가된 사용자 메시지 ID 업데이트
            const userMessages = chatBox.querySelectorAll('.user-message');
            if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1];
                if (!lastUserMessage.dataset.messageId) {
                    lastUserMessage.dataset.messageId = data.user_message_id;
                    const idSpan = document.createElement('span');
                    idSpan.classList.add('message-id');
                    idSpan.textContent = `(ID: ${data.user_message_id})`;
                    lastUserMessage.insertBefore(idSpan, lastUserMessage.firstChild);
                }
            }
            
            // 메시지 ID 폼에 자동 입력
            if (messageIdInput) {
                messageIdInput.value = data.ai_message_id;
            }
            if (reactionMessageIdInput) {
                reactionMessageIdInput.value = data.ai_message_id;
            }
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
function displayApiResponse(data) {
    apiResponse.textContent = JSON.stringify(data, null, 2);
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
            getSessionsUserIdInput.value = data.user_id;
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
            getSessionsUserIdInput.value = data.user_id;
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
    const userId = userIdInput.value;
    if (!userId) {
        displayApiResponse({ error: '사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/users/${userId}/profile`);
        const data = await response.json();
        displayApiResponse(data);
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Delete User
async function deleteUser() {
    const userId = userIdInput.value;
    if (!userId) {
        displayApiResponse({ error: '사용자 ID를 입력하세요.' });
        return;
    }
    if (!confirm(`정말로 사용자 ID '${userId}' 계정을 삭제하시겠습니까? 모든 관련 데이터가 삭제됩니다.`)) {
        return;
    }
    try {
        const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok) {
            console.log(`사용자 ${userId} 계정 삭제됨.`);
            userIdInput.value = '';
        }
    } catch (error) {
        displayApiResponse({ error: error.message });
    }
}

// Get User Settings
async function getUserSettings() {
    const userId = userSettingsUserIdInput.value;
    if (!userId) {
        displayApiResponse({ error: '설정 조회할 사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/users/${userId}/settings`);
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
    const userId = userSettingsUserIdInput.value;
    if (!userId) {
        displayApiResponse({ error: '설정 수정할 사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const payload = JSON.parse(userSettingsPayloadInput.value);
        const response = await fetch(`/api/users/${userId}/settings`, {
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
    const userId = profileImageUserIdInput.value;
    const file = profileImageFileInput.files[0];
    if (!userId || !file) {
        displayApiResponse({ error: '사용자 ID와 이미지 파일을 선택하세요.' });
        return;
    }
    const formData = new FormData();
    formData.append('profileImage', file);
    try {
        const response = await fetch(`/api/users/${userId}/profile/image`, {
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
    const userId = createSessionUserIdInput.value;
    const title = createSessionTitleInput.value;
    if (!userId || !title) {
        displayApiResponse({ error: '사용자 ID와 세션 제목을 입력하세요.' });
        return;
    }
    try {
        const body = { userId, title };
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
    const userId = getSessionsUserIdInput.value;
    if (!userId) {
        displayApiResponse({ error: '사용자 ID를 입력하세요.' });
        return;
    }
    try {
        const response = await fetch(`/api/sessions/${userId}/chat/sessions`);
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
    }
    if (!confirm(`정말로 세션 ID '${sessionId}'를 삭제하시겠습니까? 모든 관련 메시지가 삭제됩니다.`)) {
        return;
    }
    try {
        const response = await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
        const data = await response.json();
        displayApiResponse(data);
        if (response.ok) {
            console.log(`세션 ${sessionId} 삭제됨.`);
            if (sessionIdInput.value === sessionId) sessionIdInput.value = '';
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
async function refreshSessionMessages(sessionId) {
    if (!sessionId) return;
    
    try {
        const response = await fetch(`/api/chat/sessions/${sessionId}/messages`);
        const data = await response.json();
        
        // 기존 메시지 목록 비우기
        const messagesContainer = document.getElementById('chat-box');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // 메시지 추가
        if (data && Array.isArray(data)) {
            data.forEach(msg => {
                const sender = msg.MESSAGE_TYPE === 'user' ? 'user' : 'ai';
                addMessage(sender, msg.MESSAGE_CONTENT, msg.MESSAGE_ID);
                
                // 리액션이 있으면 추가
                if (msg.REACTION) {
                    const messageElement = document.querySelector(`div.message[data-message-id="${msg.MESSAGE_ID}"]`);
                    if (messageElement) {
                        let reactionElement = messageElement.querySelector('.message-reaction');
                        if (!reactionElement) {
                            reactionElement = document.createElement('div');
                            reactionElement.className = 'message-reaction';
                            messageElement.appendChild(reactionElement);
                        }
                        reactionElement.textContent = msg.REACTION;
                    }
                }
                
                // 편집된 메시지인 경우 표시
                if (msg.IS_EDITED === 1) {
                    const messageElement = document.querySelector(`div.message[data-message-id="${msg.MESSAGE_ID}"]`);
                    if (messageElement) {
                        const contentElement = messageElement.querySelector('.message-content');
                        if (contentElement) {
                            const editedBadge = document.createElement('span');
                            editedBadge.className = 'edited-badge';
                            editedBadge.textContent = ' (편집됨)';
                            contentElement.appendChild(editedBadge);
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('메시지 새로고침 오류:', error);
    }
}

// --- Event Listeners for API Test Buttons ---
if (registerButton) registerButton.addEventListener('click', registerUser);
if (loginButton) loginButton.addEventListener('click', loginUser);
if (getUserProfileButton) getUserProfileButton.addEventListener('click', getUserProfile);
if (deleteUserButton) deleteUserButton.addEventListener('click', deleteUser);
if (getUserSettingsButton) getUserSettingsButton.addEventListener('click', getUserSettings);
if (updateUserSettingsButton) updateUserSettingsButton.addEventListener('click', updateUserSettings);
if (uploadProfileImageButton) uploadProfileImageButton.addEventListener('click', uploadProfileImage);

if (createSessionButton) createSessionButton.addEventListener('click', createChatSession);
if (getUserSessionsButton) getUserSessionsButton.addEventListener('click', getUserChatSessions);
if (updateSessionButton) updateSessionButton.addEventListener('click', updateChatSession);
if (deleteSessionButton) deleteSessionButton.addEventListener('click', deleteChatSession);
if (getSessionMessagesButton) getSessionMessagesButton.addEventListener('click', getSessionMessages);

if (editMessageButton) editMessageButton.addEventListener('click', editMessage);
if (addReactionButton) addReactionButton.addEventListener('click', addReaction);
if (removeReactionButton) removeReactionButton.addEventListener('click', removeReaction);
if (deleteMessageButton) deleteMessageButton.addEventListener('click', deleteMessage);
if (uploadFileButton) uploadFileButton.addEventListener('click', uploadChatFile);

if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// 페이지 로드 시 세션 초기화
if (chatBox && sendButton) {
    initializeSession();
}
