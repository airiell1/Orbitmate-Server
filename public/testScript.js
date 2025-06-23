// testScript.js - API 테스트 페이지 전용 스크립트 (모듈화된 버전)

// 모듈 import
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
    createSessionTest, 
    getUserSessionsTest, 
    updateSessionTest, 
    deleteSessionTest, 
    getSessionMessagesTest 
} from './testScripts/session.js';

import { 
    editMessageTest, 
    addReactionTest, 
    removeReactionTest, 
    deleteMessageTest, 
    uploadFileTest,
    getMessageHistoryTest,
    requestAiReresponseTest
} from './testScripts/message.js';

import { 
    searchWikipediaTest, 
    getWeatherByIpTest, 
    getWeatherByCityTest,
    clearCacheTest,
    getCacheStatsTest 
} from './testScripts/search.js';

// 구독 관리 시스템 import
import {
    testGetSubscriptionTiers,
    testGetUserSubscription,
    testUpdateSubscription,
    testCancelSubscription,
    testGetSubscriptionHistory,
    testCheckFeatureAccess,
    testCheckDailyUsage
} from './testScripts/subscription.js';

import { 
    initializeChatTest, 
    sendMessageTest, 
    refreshMessagesTest 
} from './testScripts/chat.js';

import {
    getCustomizationTest,
    updateCustomizationTest,
    getLevelTest,
    addExperienceTest,
    getBadgesTest,
    toggleBadgeTest
} from './testScripts/profile.js';

import {
    getTranslationsTest,
    updateUserLanguageTest
} from './testScripts/language.js';

// =========================
// 이벤트 리스너 연결 (버튼 동작 연결)
// =========================

// DOMContentLoaded 이벤트로 초기화
document.addEventListener('DOMContentLoaded', function() {
    // AI Provider 변경 시 Ollama 옵션 비활성화/활성화
    function toggleOllamaOptions() {
        const aiProviderRadios = document.querySelectorAll('input[name="aiProvider"]');
        const ollamaModelRadios = document.querySelectorAll('input[name="ollamaModel"]');
        const qatCheckbox = document.getElementById('it-qat');
        const ollamaModelSpan = document.querySelector('#ai-selector span:nth-of-type(2)'); // "Ollama Model:" 스팬
        
        let selectedProvider = 'vertexai'; // 기본값
        aiProviderRadios.forEach(radio => {
            if (radio.checked) {
                selectedProvider = radio.value;
            }
        });
        
        const isOllamaSelected = (selectedProvider === 'ollama');
        
        // Ollama 모델 라디오 버튼들 비활성화/활성화
        ollamaModelRadios.forEach(radio => {
            radio.disabled = !isOllamaSelected;
            radio.parentElement.style.opacity = isOllamaSelected ? '1' : '0.5';
        });
        
        // 양자화 체크박스 비활성화/활성화
        if (qatCheckbox) {
            qatCheckbox.disabled = !isOllamaSelected;
            qatCheckbox.parentElement.style.opacity = isOllamaSelected ? '1' : '0.5';
        }
        
        // "Ollama Model:" 레이블 비활성화/활성화
        if (ollamaModelSpan) {
            ollamaModelSpan.style.opacity = isOllamaSelected ? '1' : '0.5';
        }
    }
    
    // AI Provider 라디오 버튼에 이벤트 리스너 추가
    const aiProviderRadios = document.querySelectorAll('input[name="aiProvider"]');
    aiProviderRadios.forEach(radio => {
        radio.addEventListener('change', toggleOllamaOptions);
    });
    
    // 초기 상태 설정
    toggleOllamaOptions();

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
    const getSessionMessagesButton = document.getElementById('get-session-messages-button');    // 메시지 관리 버튼들 (누락된 버튼들 추가)
    const editMessageButton = document.getElementById('edit-message-button');
    const getMessageHistoryButton = document.getElementById('get-message-history-button');
    const addReactionButton = document.getElementById('add-reaction-button');
    const removeReactionButton = document.getElementById('remove-reaction-button');
    const deleteMessageButton = document.getElementById('delete-message-button');
    const uploadFileButton = document.getElementById('upload-file-button');
    const requestAiReresponseButton = document.getElementById('request-ai-reresponse-button');// 검색 기능 버튼들
    const searchWikipediaButton = document.getElementById('wikipedia-search-button');
    const searchNaverButton = document.getElementById('search-naver-button');
    const searchKakaoButton = document.getElementById('search-kakao-button');
    const searchWeatherButton = document.getElementById('weather-search-button');

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
    if (createSessionButton) createSessionButton.addEventListener('click', createSessionTest);
    if (getUserSessionsButton) getUserSessionsButton.addEventListener('click', getUserSessionsTest);
    if (updateSessionButton) updateSessionButton.addEventListener('click', updateSessionTest);
    if (deleteSessionButton) deleteSessionButton.addEventListener('click', deleteSessionTest);
    if (getSessionMessagesButton) getSessionMessagesButton.addEventListener('click', getSessionMessagesTest);    // 메시지 관리 이벤트 연결
    if (editMessageButton) editMessageButton.addEventListener('click', editMessageTest);
    if (getMessageHistoryButton) getMessageHistoryButton.addEventListener('click', getMessageHistoryTest);
    if (addReactionButton) addReactionButton.addEventListener('click', addReactionTest);
    if (removeReactionButton) removeReactionButton.addEventListener('click', removeReactionTest);
    if (deleteMessageButton) deleteMessageButton.addEventListener('click', deleteMessageTest);
    if (uploadFileButton) uploadFileButton.addEventListener('click', uploadFileTest);
    if (requestAiReresponseButton) requestAiReresponseButton.addEventListener('click', requestAiReresponseTest);    // 검색 기능 이벤트 연결
    if (document.getElementById('search-wikipedia-button')) {
        document.getElementById('search-wikipedia-button').addEventListener('click', searchWikipediaTest);
    }
    if (document.getElementById('search-naver-button')) {
        document.getElementById('search-naver-button').addEventListener('click', () => {
            updateApiResponse('네이버 검색 API는 아직 구현되지 않았습니다.');
        });
    }
    if (document.getElementById('search-kakao-button')) {
        document.getElementById('search-kakao-button').addEventListener('click', () => {
            updateApiResponse('카카오 검색 API는 아직 구현되지 않았습니다.');
        });
    }
    if (document.getElementById('search-weather-button')) {
        document.getElementById('search-weather-button').addEventListener('click', getWeatherByIpTest);
    }
    
    // 구독 관리 이벤트 연결
    const getSubscriptionTiersButton = document.getElementById('get-subscription-tiers-button');
    const getUserSubscriptionButton = document.getElementById('get-user-subscription-button');
    const updateSubscriptionButton = document.getElementById('update-subscription-button');
    const cancelSubscriptionButton = document.getElementById('cancel-subscription-button');
    const getSubscriptionHistoryButton = document.getElementById('get-subscription-history-button');    const checkFeatureAccessButton = document.getElementById('check-feature-access-button');
    const checkDailyUsageButton = document.getElementById('check-daily-usage-button');
    
    if (getSubscriptionTiersButton) getSubscriptionTiersButton.addEventListener('click', window.testGetSubscriptionTiers);
    if (getUserSubscriptionButton) getUserSubscriptionButton.addEventListener('click', window.testGetUserSubscription);
    if (updateSubscriptionButton) updateSubscriptionButton.addEventListener('click', window.testUpdateSubscription);
    if (cancelSubscriptionButton) cancelSubscriptionButton.addEventListener('click', window.testCancelSubscription);
    if (getSubscriptionHistoryButton) getSubscriptionHistoryButton.addEventListener('click', window.testGetSubscriptionHistory);
    if (checkFeatureAccessButton) checkFeatureAccessButton.addEventListener('click', window.testCheckFeatureAccess);
    if (checkDailyUsageButton) checkDailyUsageButton.addEventListener('click', window.testCheckDailyUsage);    // 채팅 UI 이벤트 연결
    if (sendButton) sendButton.addEventListener('click', sendMessageTest);
    if (resetSessionButton) resetSessionButton.addEventListener('click', () => {
        // 강제로 새 세션을 만들도록 플래그 설정
        localStorage.setItem('forceNewTestSession', 'true');
        initializeChatTest();
    });
    if (refreshMessagesButton) refreshMessagesButton.addEventListener('click', refreshMessagesTest);

    // 메시지 입력 Enter 키 이벤트
    if (messageInput) {        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageTest();
            }
        });
    }

    // 페이지 로드 시 세션 초기화
    initializeChatTest();
});

console.log('모듈화된 testScript.js 로드 완료');
