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
    submitBugReportTest,
    submitFeedbackTest,
    testParticipationTest,
    upgradeSubscriptionBadgeTest,
    approveBadgeTest,
} from './testScripts/badgeLevel.js';

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
    testCheckDailyUsage,
    testSimulateUpgrade,
    testSimulateRenewal
} from './testScripts/subscription.js';

import { 
    initializeSession, 
    sendMessage, 
    refreshSessionMessages 
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

// 피드백 시스템 import
import {
    testCreateBugReport,
    testCreateFeedback,
    testCreateFeatureRequest,
    testGetUserBugReports,
    testGetUserFeedbacks,
    testGetAllBugReports,
    testGetAllFeedbacks,
    testVoteFeedback,
    testUpdateBugReport,
    testUpdateFeedback,
    testGetBugReportStatistics,
    testGetFeedbackStatistics,
    testFeedbackSystemComplete
} from './testScripts/feedback.js';

// 게시물 관리 시스템 import
import {
    createPost,
    getPostList,
    getPostDetail,
    updatePost,
    deletePost,
    translatePost,
    demonstratePostSystem
} from './testScripts/post.js';

// 관리자 권한 관리 기능 import
import { 
    setupAdminEventListeners 
} from './testScripts/admin.js';

// 유틸리티 함수들 import
import {
    updateApiResponse
} from './testScripts/utils.js';

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

    // 다크모드 토글 기능
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        
        const toggleButton = document.getElementById('dark-mode-toggle');
        if (toggleButton) {
            toggleButton.textContent = isDarkMode ? '☀️ 라이트모드' : '🌓 다크모드';
        }
    }
    
    // 다크모드 상태 복원
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
        document.body.classList.add('dark-mode');
    }
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.textContent = savedDarkMode ? '☀️ 라이트모드' : '🌓 다크모드';
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

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
    
    // 추가 날씨 검색 버튼들
    if (document.getElementById('weather-by-ip-button')) {
        document.getElementById('weather-by-ip-button').addEventListener('click', getWeatherByIpTest);
    }
    if (document.getElementById('weather-by-city-button')) {
        document.getElementById('weather-by-city-button').addEventListener('click', getWeatherByCityTest);
    }
    if (document.getElementById('clear-cache-button')) {
        document.getElementById('clear-cache-button').addEventListener('click', clearCacheTest);
    }
    if (document.getElementById('get-cache-stats-button')) {
        document.getElementById('get-cache-stats-button').addEventListener('click', getCacheStatsTest);
    }
    
    // 구독 관리 이벤트 연결
    const getSubscriptionTiersButton = document.getElementById('get-subscription-tiers-button');
    const getUserSubscriptionButton = document.getElementById('get-user-subscription-button');
    const updateSubscriptionButton = document.getElementById('update-subscription-button');
    const cancelSubscriptionButton = document.getElementById('cancel-subscription-button');
    const getSubscriptionHistoryButton = document.getElementById('get-subscription-history-button');    const checkFeatureAccessButton = document.getElementById('check-feature-access-button');
    const checkDailyUsageButton = document.getElementById('check-daily-usage-button');
      if (getSubscriptionTiersButton) getSubscriptionTiersButton.addEventListener('click', testGetSubscriptionTiers);
    if (getUserSubscriptionButton) getUserSubscriptionButton.addEventListener('click', testGetUserSubscription);
    if (updateSubscriptionButton) updateSubscriptionButton.addEventListener('click', testUpdateSubscription);
    if (cancelSubscriptionButton) cancelSubscriptionButton.addEventListener('click', testCancelSubscription);
    if (getSubscriptionHistoryButton) getSubscriptionHistoryButton.addEventListener('click', testGetSubscriptionHistory);
    if (checkFeatureAccessButton) checkFeatureAccessButton.addEventListener('click', testCheckFeatureAccess);
    if (checkDailyUsageButton) checkDailyUsageButton.addEventListener('click', testCheckDailyUsage);

    // 프로필 꾸미기 & 레벨 시스템 이벤트 연결
    const getCustomizationButton = document.getElementById('get-customization-button');
    const updateCustomizationButton = document.getElementById('update-customization-button');
    const getLevelButton = document.getElementById('get-level-button');
    const addExperienceButton = document.getElementById('add-experience-button');
    const getBadgesButton = document.getElementById('get-badges-button');
    const toggleBadgeButton = document.getElementById('toggle-badge-button');
    
    if (getCustomizationButton) getCustomizationButton.addEventListener('click', getCustomizationTest);
    if (updateCustomizationButton) updateCustomizationButton.addEventListener('click', updateCustomizationTest);
    if (getLevelButton) getLevelButton.addEventListener('click', getLevelTest);
    if (addExperienceButton) addExperienceButton.addEventListener('click', addExperienceTest);
    if (getBadgesButton) getBadgesButton.addEventListener('click', getBadgesTest);
    if (toggleBadgeButton) toggleBadgeButton.addEventListener('click', toggleBadgeTest);

    // 다국어 지원 이벤트 연결
    const getTranslationsButton = document.getElementById('get-translations-button');
    const updateUserLanguageButton = document.getElementById('update-user-language-button');
    
    if (getTranslationsButton) getTranslationsButton.addEventListener('click', getTranslationsTest);
    if (updateUserLanguageButton) updateUserLanguageButton.addEventListener('click', updateUserLanguageTest);    // 채팅 UI 이벤트 연결
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (resetSessionButton) resetSessionButton.addEventListener('click', () => {
        // 강제로 새 세션을 만들도록 플래그 설정
        localStorage.setItem('forceNewTestSession', 'true');
        initializeSession();
    });    if (refreshMessagesButton) refreshMessagesButton.addEventListener('click', refreshSessionMessages);

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

    // 모든 import된 함수들을 window 객체에 추가 (HTML에서 직접 호출하기 위해)
    // 사용자 관리 함수들
    window.registerUserTest = registerUserTest;
    window.loginUserTest = loginUserTest;
    window.getUserProfileTest = getUserProfileTest;
    window.deleteUserTest = deleteUserTest;
    window.getUserSettingsTest = getUserSettingsTest;
    window.updateUserSettingsTest = updateUserSettingsTest;
    window.uploadProfileImageTest = uploadProfileImageTest;

    // 세션 관리 함수들
    window.createSessionTest = createSessionTest;
    window.getUserSessionsTest = getUserSessionsTest;
    window.updateSessionTest = updateSessionTest;
    window.deleteSessionTest = deleteSessionTest;
    window.getSessionMessagesTest = getSessionMessagesTest;

    // 메시지 관리 함수들
    window.editMessageTest = editMessageTest;
    window.addReactionTest = addReactionTest;
    window.removeReactionTest = removeReactionTest;
    window.deleteMessageTest = deleteMessageTest;
    window.uploadFileTest = uploadFileTest;
    window.getMessageHistoryTest = getMessageHistoryTest;
    window.requestAiReresponseTest = requestAiReresponseTest;

    // 검색 기능 함수들
    window.searchWikipediaTest = searchWikipediaTest;
    window.getWeatherByIpTest = getWeatherByIpTest;
    window.getWeatherByCityTest = getWeatherByCityTest;
    window.clearCacheTest = clearCacheTest;
    window.getCacheStatsTest = getCacheStatsTest;

    // 구독 관리 함수들
    window.testGetSubscriptionTiers = testGetSubscriptionTiers;
    window.testGetUserSubscription = testGetUserSubscription;
    window.testUpdateSubscription = testUpdateSubscription;
    window.testCancelSubscription = testCancelSubscription;
    window.testGetSubscriptionHistory = testGetSubscriptionHistory;
    window.testCheckFeatureAccess = testCheckFeatureAccess;
    window.testCheckDailyUsage = testCheckDailyUsage;
    window.testSimulateUpgrade = testSimulateUpgrade;
    window.testSimulateRenewal = testSimulateRenewal;    // 채팅 기능 함수들
    window.initializeSession = initializeSession;
    window.sendMessage = sendMessage;
    window.refreshSessionMessages = refreshSessionMessages;

    // 프로필 꾸미기 함수들
    window.getCustomizationTest = getCustomizationTest;
    window.updateCustomizationTest = updateCustomizationTest;
    window.getLevelTest = getLevelTest;
    window.addExperienceTest = addExperienceTest;
    window.getBadgesTest = getBadgesTest;
    window.toggleBadgeTest = toggleBadgeTest;

    // 다국어 지원 함수들
    window.getTranslationsTest = getTranslationsTest;
    window.updateUserLanguageTest = updateUserLanguageTest;

    // 뱃지 레벨 시스템 함수들    window.getBadgeDetailsTest = getBadgeDetailsTest;
    window.submitBugReportTest = submitBugReportTest;
    window.submitFeedbackTest = submitFeedbackTest;
    window.testParticipationTest = testParticipationTest;
    window.upgradeSubscriptionBadgeTest = upgradeSubscriptionBadgeTest;
    window.approveBadgeTest = approveBadgeTest;

    // 피드백 시스템 이벤트 리스너
    document.getElementById('create-bug-report-button')?.addEventListener('click', testCreateBugReport);
    document.getElementById('create-feedback-button')?.addEventListener('click', testCreateFeedback);
    document.getElementById('create-feature-request-button')?.addEventListener('click', testCreateFeatureRequest);
    document.getElementById('get-user-bug-reports-button')?.addEventListener('click', testGetUserBugReports);
    document.getElementById('get-user-feedbacks-button')?.addEventListener('click', testGetUserFeedbacks);
    document.getElementById('get-all-bug-reports-button')?.addEventListener('click', testGetAllBugReports);
    document.getElementById('get-all-feedbacks-button')?.addEventListener('click', testGetAllFeedbacks);
    document.getElementById('vote-feedback-button')?.addEventListener('click', () => {
        const feedbackId = document.getElementById('feedback-id-input')?.value?.trim();
        testVoteFeedback(feedbackId);
    });
    document.getElementById('update-bug-report-button')?.addEventListener('click', () => {
        const reportId = document.getElementById('bug-report-id-input')?.value?.trim();
        testUpdateBugReport(reportId);
    });
    document.getElementById('update-feedback-button')?.addEventListener('click', () => {
        const feedbackId = document.getElementById('feedback-id-input')?.value?.trim();
        testUpdateFeedback(feedbackId);
    });
    document.getElementById('get-bug-statistics-button')?.addEventListener('click', testGetBugReportStatistics);
    document.getElementById('get-feedback-statistics-button')?.addEventListener('click', testGetFeedbackStatistics);
    document.getElementById('test-feedback-system-complete-button')?.addEventListener('click', testFeedbackSystemComplete);

    // 게시물 관리 시스템 이벤트 리스너
    document.getElementById('create-post-button')?.addEventListener('click', createPost);
    document.getElementById('get-post-list-button')?.addEventListener('click', getPostList);
    document.getElementById('get-post-detail-button')?.addEventListener('click', getPostDetail);
    document.getElementById('update-post-button')?.addEventListener('click', updatePost);
    document.getElementById('delete-post-button')?.addEventListener('click', deletePost);
    document.getElementById('translate-post-button')?.addEventListener('click', translatePost);
    document.getElementById('demonstrate-post-system-button')?.addEventListener('click', demonstratePostSystem);

    // 자동 API 테스트 이벤트 리스너
    document.getElementById('run-auto-api-test')?.addEventListener('click', async function() {
        const button = this;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.textContent = '테스트 실행 중...';
            
            // autoApiTest.js에서 runAutoApiTest 함수 동적 import
            const { runAutoApiTest } = await import('./testScripts/autoApiTest.js');
            await runAutoApiTest();
        } catch (error) {
            console.error('자동 API 테스트 실행 중 오류:', error);
            updateApiResponse('자동 API 테스트', false, `테스트 실행 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    // 테스트 결과 내보내기 이벤트 리스너
    document.getElementById('export-test-results')?.addEventListener('click', async function() {
        try {
            const { exportTestResults } = await import('./testScripts/autoApiTest.js');
            exportTestResults();
        } catch (error) {
            console.error('테스트 결과 내보내기 중 오류:', error);
            alert('테스트 결과를 내보내는 중 오류가 발생했습니다.');
        }
    });

    // 테스트 결과 지우기 이벤트 리스너
    document.getElementById('clear-test-results')?.addEventListener('click', async function() {
        try {
            const { clearTestResults } = await import('./testScripts/autoApiTest.js');
            clearTestResults();
        } catch (error) {
            console.error('테스트 결과 지우기 중 오류:', error);
            alert('테스트 결과를 지우는 중 오류가 발생했습니다.');
        }
    });

    // 기존의 중복된 자동 API 테스트 코드 제거
    // (파일 끝부분에 있던 중복 코드는 제거됨)
    
    // 관리자 권한 관리 기능 이벤트 리스너 설정
    setupAdminEventListeners();
});
