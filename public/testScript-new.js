// testScript.js - API 테스트 페이지 전용 스크립트 (모듈화된 버전)

// 모듈 import
import { initializeSession, sendMessage, refreshSessionMessages } from './testScripts/chat.js';
import { 
    registerUserTest, 
    loginUserTest, 
    getUserProfileTest, 
    deleteUserTest, 
    getUserSettingsTest, 
    updateUserSettingsTest, 
    uploadProfileImageTest 
} from './testScripts/user.js';
import { 
    createChatSessionTest, 
    getUserSessionsTest, 
    updateChatSessionTest, 
    deleteChatSessionTest, 
    getSessionMessagesTest 
} from './testScripts/session.js';
import { 
    editMessageTest, 
    addReactionTest, 
    removeReactionTest, 
    deleteMessageTest, 
    uploadFileTest 
} from './testScripts/message.js';
import { 
    searchWikipediaTest, 
    searchNaverTest, 
    searchKakaoTest 
} from './testScripts/search.js';

// =========================
// 이벤트 리스너 연결 (버튼 동작 연결)
// =========================

// DOMContentLoaded 이벤트로 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 사용자 관리 버튼들
    const registerButton = document.getElementById('register-button');
    const loginButton = document.getElementById('login-button');
    const getUserProfileButton = document.getElementById('get-user-profile-button');
    const deleteUserButton = document.getElementById('delete-user-button');
    const getUserSettingsButton = document.getElementById('get-user-settings-button');
    const updateUserSettingsButton = document.getElementById('update-user-settings-button');
    const uploadProfileImageButton = document.getElementById('upload-profile-image-button');

    // 세션 관리 버튼들
    const createSessionButton = document.getElementById('create-session-button');
    const getUserSessionsButton = document.getElementById('get-user-sessions-button');
    const updateSessionButton = document.getElementById('update-session-button');
    const deleteSessionButton = document.getElementById('delete-session-button');
    const getSessionMessagesButton = document.getElementById('get-session-messages-button');

    // 메시지 관리 버튼들
    const editMessageButton = document.getElementById('edit-message-button');
    const addReactionButton = document.getElementById('add-reaction-button');
    const removeReactionButton = document.getElementById('remove-reaction-button');
    const deleteMessageButton = document.getElementById('delete-message-button');
    const uploadFileButton = document.getElementById('upload-file-button');

    // 검색 기능 버튼들
    const searchWikipediaButton = document.getElementById('search-wikipedia-button');
    const searchNaverButton = document.getElementById('search-naver-button');
    const searchKakaoButton = document.getElementById('search-kakao-button');

    // 채팅 UI 버튼들
    const sendButton = document.getElementById('send-button');
    const resetSessionButton = document.getElementById('reset-session-button');
    const refreshMessagesButton = document.getElementById('refresh-messages-button');

    // 입력 요소들
    const messageInput = document.getElementById('message-input');

    // 사용자 관리 이벤트 연결
    if (registerButton) registerButton.addEventListener('click', registerUserTest);
    if (loginButton) loginButton.addEventListener('click', loginUserTest);
    if (getUserProfileButton) getUserProfileButton.addEventListener('click', getUserProfileTest);
    if (deleteUserButton) deleteUserButton.addEventListener('click', deleteUserTest);
    if (getUserSettingsButton) getUserSettingsButton.addEventListener('click', getUserSettingsTest);
    if (updateUserSettingsButton) updateUserSettingsButton.addEventListener('click', updateUserSettingsTest);
    if (uploadProfileImageButton) uploadProfileImageButton.addEventListener('click', uploadProfileImageTest);

    // 세션 관리 이벤트 연결
    if (createSessionButton) createSessionButton.addEventListener('click', createChatSessionTest);
    if (getUserSessionsButton) getUserSessionsButton.addEventListener('click', getUserSessionsTest);
    if (updateSessionButton) updateSessionButton.addEventListener('click', updateChatSessionTest);
    if (deleteSessionButton) deleteSessionButton.addEventListener('click', deleteChatSessionTest);
    if (getSessionMessagesButton) getSessionMessagesButton.addEventListener('click', getSessionMessagesTest);

    // 메시지 관리 이벤트 연결
    if (editMessageButton) editMessageButton.addEventListener('click', editMessageTest);
    if (addReactionButton) addReactionButton.addEventListener('click', addReactionTest);
    if (removeReactionButton) removeReactionButton.addEventListener('click', removeReactionTest);
    if (deleteMessageButton) deleteMessageButton.addEventListener('click', deleteMessageTest);
    if (uploadFileButton) uploadFileButton.addEventListener('click', uploadFileTest);

    // 검색 기능 이벤트 연결
    if (searchWikipediaButton) searchWikipediaButton.addEventListener('click', searchWikipediaTest);
    if (searchNaverButton) searchNaverButton.addEventListener('click', searchNaverTest);
    if (searchKakaoButton) searchKakaoButton.addEventListener('click', searchKakaoTest);

    // 채팅 UI 이벤트 연결
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (resetSessionButton) resetSessionButton.addEventListener('click', () => {
        initializeSession();
    });
    if (refreshMessagesButton) refreshMessagesButton.addEventListener('click', refreshSessionMessages);

    // 메시지 입력 Enter 키 이벤트
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // 페이지 로드 시 세션 초기화
    initializeSession();
});

console.log('모듈화된 testScript.js 로드 완료');
