// testScripts/chat.js - 채팅 관련 기능

import { updateApiResponse, appendToApiResponse, addMessageActions } from './utils.js';

// 게스트 사용자 ID
const GUEST_USER_ID = 'guest';

// 전역 변수
let currentSessionId = null;
let isMessageSending = false;

// 스트리밍 메시지 처리
let currentStreamingElement = null;
let currentStreamingContentSpan = null;

// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직
export async function initializeSession() {
    try {
        // 로컬 스토리지에서 세션 ID 확인
        const savedSessionId = localStorage.getItem('currentTestSessionId');
        const forceNewSession = localStorage.getItem('forceNewTestSession') === 'true';
        
        // 강제로 새 세션을 만들어야 하는 경우 저장된 세션 ID를 무시
        if (forceNewSession) {
            localStorage.removeItem('forceNewTestSession');
        } else if (savedSessionId) {
            currentSessionId = savedSessionId;
            console.log('기존 테스트 세션 사용:', currentSessionId);
            addMessage('시스템', `기존 테스트 세션 연결됨 (ID: ${currentSessionId})`, null, 'system-message');
            
            // 세션 ID 자동 입력
            const sessionIdInput = document.getElementById('session-id-input');
            const uploadFileSessionIdInput = document.getElementById('upload-file-session-id');
            if (sessionIdInput) sessionIdInput.value = currentSessionId;
            if (uploadFileSessionIdInput) uploadFileSessionIdInput.value = currentSessionId;
            return;
        }
        
        // 새 세션 생성
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                user_id: GUEST_USER_ID, 
                title: `Test Session ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`세션 생성 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        currentSessionId = data.session_id;        
        // 세션 ID 저장
        localStorage.setItem('currentTestSessionId', currentSessionId);
        console.log('새 테스트 세션 생성됨:', currentSessionId);
        addMessage('시스템', `새로운 테스트 세션 시작 (ID: ${currentSessionId})`, null, 'system-message');
        
        // 세션 ID 자동 입력
        const sessionIdInput = document.getElementById('session-id-input');
        const uploadFileSessionIdInput = document.getElementById('upload-file-session-id');
        if (sessionIdInput) sessionIdInput.value = currentSessionId;
        if (uploadFileSessionIdInput) uploadFileSessionIdInput.value = currentSessionId;
    } catch (error) {
        console.error('세션 초기화 오류:', error);
        addMessage('시스템', '세션 초기화 중 오류가 발생했습니다: ' + error.message, null, 'system-message');
    }
}

export function addMessage(sender, text, messageId = null, className = null) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (className) {
        messageElement.classList.add(className);
    } else if (sender === 'user') {
        messageElement.classList.add('user_message');
    } else if (sender === 'ai') {
        messageElement.classList.add('ai_message');
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

export async function sendMessage() {
    console.log('[sendMessage] 함수 호출됨, isMessageSending:', isMessageSending);
    
    if (isMessageSending) {
        console.warn("[sendMessage] 메시지 전송 중입니다. 중복 호출을 차단합니다.");
        return;
    }
    
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messageText = messageInput.value.trim();
    
    if (!messageText) {
        console.warn('[sendMessage] 빈 메시지는 전송하지 않습니다.');
        return;
    }

    if (!currentSessionId) {
        alert("세션이 초기화되지 않았습니다. 페이지를 새로고침하거나 새 세션을 시작해주세요.");
        return;
    }

    console.log('[sendMessage] 메시지 전송 시작:', messageText.substring(0, 50) + '...');
    
    // 즉시 플래그 설정으로 중복 호출 차단
    isMessageSending = true;
    sendButton.disabled = true;
    sendButton.textContent = '전송 중...';
    
    try {
        // 사용자 메시지를 먼저 UI에 추가 (ID는 스트리밍 응답에서 받아서 업데이트)
        const userMessageObj = addMessage('user', messageText, null, 'user_message');
        const userMessageElement = userMessageObj.messageElement;
        messageInput.value = '';

        // AI Provider 선택
        let selectedAiProvider = 'geminiapi';
        const aiProviderRadios = document.querySelectorAll('input[name="aiProvider"]');
        aiProviderRadios.forEach(radio => {
            if (radio.checked) {
                // gemini 값을 geminiapi로 변환
                selectedAiProvider = radio.value === 'gemini' ? 'geminiapi' : radio.value;
            }
        });

        // Ollama 모델 선택
        let selectedOllamaModel = 'gemma3:4b';
        if (selectedAiProvider === 'ollama') {
            const ollamaModelRadios = document.querySelectorAll('input[name="ollamaModel"]');
            const qatCheckbox = document.getElementById('it-qat');
            ollamaModelRadios.forEach(radio => {
                if (radio.checked) {
                    selectedOllamaModel = radio.value;
                }
            });
            if (qatCheckbox.checked && selectedOllamaModel) {
                selectedOllamaModel += ':q8_0';
            }
        }

        // 시스템 프롬프트 및 스트리밍 모드
        const systemPromptInput = document.getElementById('system-prompt-input');
        const streamModeCheckbox = document.getElementById('stream-mode-checkbox');
        const systemPrompt = systemPromptInput.value.trim();
        const streamMode = streamModeCheckbox.checked;
        const specialModeType = streamMode ? 'stream' : null;

        const requestBody = {
            message: messageText,
            ai_provider_override: selectedAiProvider,
            model_id_override: selectedAiProvider === 'ollama' ? selectedOllamaModel : undefined,
            specialModeType: specialModeType
        };
        
        if (systemPrompt && systemPrompt.length > 0) {
            requestBody.systemPrompt = systemPrompt;
        }

        console.log('전송할 요청 본문:', requestBody);
        
        let aiMessageElement = null;
        let aiMessageContentSpan = null;

        // HTTP 요청 전송
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const apiResponse = document.getElementById('api-response');
        apiResponse.textContent = '';
        
        if (streamMode && response.ok && response.headers.get('Content-Type')?.includes('text/event-stream')) {
            // Server-Sent Events 스트리밍
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let eolIndex;
            
            // AI 응답 메시지 요소 미리 생성
            const aiMessageObj = addMessage('ai', 'AI 응답 대기 중...', null, 'ai_message');
            aiMessageElement = aiMessageObj.messageElement;
            aiMessageContentSpan = aiMessageObj.contentSpan;
            
            console.log('[SSE 스트리밍] 스트리밍 시작');
            updateApiResponse({ status: 'streaming_started', timestamp: new Date().toISOString() });

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[SSE 스트리밍] 스트리밍 완료');
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                
                while ((eolIndex = buffer.indexOf('\n\n')) >= 0) {
                    const chunk = buffer.slice(0, eolIndex);
                    buffer = buffer.slice(eolIndex + 2);
                    
                    console.log('[SSE 스트리밍] 받은 청크:', chunk);
                    
                    // SSE 이벤트 파싱
                    const lines = chunk.split('\n');
                    let eventType = null;
                    let data = null;
                    
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7);
                        } else if (line.startsWith('data: ')) {
                            data = line.slice(6);
                        }
                    }
                    
                    // 데이터가 없으면 건너뛰기
                    if (!data) continue;
                    
                    // [DONE] 신호 처리
                    if (data === '[DONE]') {
                        console.log('[SSE 스트리밍] 완료 신호 수신');
                        break;
                    }
                    
                    try {
                        const chunkData = JSON.parse(data);
                        console.log('[SSE 스트리밍] 파싱된 데이터:', { eventType, data: chunkData });
                        
                        // 이벤트 타입별 처리
                        if (eventType === 'ids' && chunkData.userMessageId) {
                            console.log('[SSE 스트리밍] 사용자 메시지 ID 수신:', chunkData.userMessageId);
                            // 사용자 메시지에 ID 설정 및 액션 버튼 추가
                            if (userMessageElement) {
                                userMessageElement.dataset.messageId = chunkData.userMessageId;
                                addMessageActions(userMessageElement, chunkData.userMessageId, 'user');
                            }
                        } else if (eventType === 'ai_message_id' && chunkData.aiMessageId) {
                            console.log('[SSE 스트리밍] AI 메시지 ID 수신:', chunkData.aiMessageId);
                            if (aiMessageElement) {
                                aiMessageElement.dataset.messageId = chunkData.aiMessageId;
                                addMessageActions(aiMessageElement, chunkData.aiMessageId, 'ai');
                            }
                        } else if (eventType === 'end') {
                            console.log('[SSE 스트리밍] 종료 이벤트 수신');
                            break;
                        } else if (!eventType && chunkData.delta) {
                            // 일반 데이터 (delta) 처리
                            // 첫 번째 청크인 경우 "AI 응답 대기 중..." 텍스트 제거
                            if (aiMessageContentSpan.textContent === 'AI 응답 대기 중...') {
                                aiMessageContentSpan.textContent = '';
                            }
                            
                            aiMessageContentSpan.textContent += chunkData.delta;
                            const chatBox = document.getElementById('chat-box');
                            chatBox.scrollTop = chatBox.scrollHeight;
                            appendToApiResponse(chunkData.delta);
                        }
                    } catch (e) {
                        console.error('[SSE 스트리밍] 청크 파싱 오류:', e, data);
                    }
                }
            }
        } else {
            // 일반 응답 처리
            const data = await response.json();
            updateApiResponse(data);
            
            if (response.ok && data.message) {
                // 일반 API 응답 형식 처리
                const aiMessageObj = addMessage('ai', data.message, data.ai_message_id, 'ai_message');
                aiMessageElement = aiMessageObj.messageElement;
                aiMessageContentSpan = aiMessageObj.contentSpan;
                
                // 사용자 메시지에도 ID 설정 및 액션 버튼 추가
                if (data.user_message_id && userMessageElement) {
                    userMessageElement.dataset.messageId = data.user_message_id;
                    addMessageActions(userMessageElement, data.user_message_id, 'user');
                }
            } else {
                addMessage('시스템', `오류: ${data.error?.message || data.message || '알 수 없는 오류'}`, null, 'error-message');
            }
        }
    } catch (error) {
        console.error('네트워크 오류 또는 요청 실패:', error);
        updateApiResponse({ error: { message: error.message } });
        addMessage('시스템', `네트워크 오류: ${error.message}`, null, 'error-message');
    } finally {
        isMessageSending = false;        sendButton.disabled = false;
        sendButton.textContent = '전송';
    }
}

// 세션 메시지 새로고침 함수
export async function refreshSessionMessages() {
    const chatBox = document.getElementById('chat-box');
    
    if (!currentSessionId) {
        chatBox.innerHTML = '<div class="message system-message">세션을 선택하거나 생성해주세요.</div>';
        return;
    }
    
    try {
        console.log('메시지 새로고침 요청:', currentSessionId);
        
        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`메시지 로드 실패: ${errorData.message || response.statusText}`);
        }
        
        const messages = await response.json();
        console.log('받은 메시지 데이터:', messages);
        
        updateApiResponse({success: true, message_count: messages.length, data: messages});
        
        chatBox.innerHTML = '';
        
        if (messages.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'message system-message';
            emptyMsg.textContent = '이 세션에는 메시지가 없습니다.';
            chatBox.appendChild(emptyMsg);
        } else {
            messages.forEach(msg => {
                console.log('메시지 처리 중:', msg);
                
                // 백엔드 응답 형식 확인: message_type, message_content 또는 MESSAGE_TYPE, MESSAGE_CONTENT
                const messageType = msg.message_type || msg.MESSAGE_TYPE;
                const messageContent = msg.message_content || msg.MESSAGE_CONTENT;
                const messageId = msg.message_id || msg.MESSAGE_ID;
                
                if (!messageType || !messageContent) {
                    console.warn('메시지 형식 오류:', msg);
                    return;
                }
                
                const sender = messageType === 'user' ? 'user' : 'ai';
                
                // 메시지 내용이 비어있거나 '(내용 없음)'인 경우 처리
                let displayContent = messageContent;
                if (!displayContent || displayContent.trim() === '' || displayContent === '(내용 없음)') {
                    displayContent = `[${sender === 'user' ? '사용자' : 'AI'} 메시지 - 내용 없음]`;
                }
                
                console.log(`메시지 추가: ${sender} - ${displayContent.substring(0, 50)}...`);
                addMessage(sender, displayContent, messageId);
            });
        }
        
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch (error) {
        console.error('메시지 새로고침 중 오류:', error);
        updateApiResponse({ error: { message: error.message } });
        addMessage('error', `메시지 로드 중 오류: ${error.message}`, null, new Date().toISOString());
    }
}

// AI Provider 변경 시 Ollama 옵션 비활성화/활성화
function toggleOllamaOptions() {
    const aiProviderRadios = document.querySelectorAll('input[name="aiProvider"]');
    const ollamaModelRadios = document.querySelectorAll('input[name="ollamaModel"]');
    const qatCheckbox = document.getElementById('it-qat');
    
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
        radio.parentElement.style.cursor = isOllamaSelected ? 'pointer' : 'not-allowed';
    });
    
    // 양자화 체크박스 비활성화/활성화
    if (qatCheckbox) {
        qatCheckbox.disabled = !isOllamaSelected;
        qatCheckbox.parentElement.style.opacity = isOllamaSelected ? '1' : '0.5';
        qatCheckbox.parentElement.style.cursor = isOllamaSelected ? 'pointer' : 'not-allowed';
    }
    
    // "Ollama Model:" 레이블 비활성화/활성화
    const ollamaModelSpan = document.querySelector('#ai-selector span[style*="margin-left: 15px"]');
    if (ollamaModelSpan && ollamaModelSpan.textContent.includes('Ollama Model:')) {
        ollamaModelSpan.style.opacity = isOllamaSelected ? '1' : '0.5';
    }
}

// AI Provider 변경 이벤트 리스너
export function initializeAiProviderToggle() {
    const aiProviderRadios = document.querySelectorAll('input[name="aiProvider"]');
    aiProviderRadios.forEach(radio => {
        radio.addEventListener('change', toggleOllamaOptions);
    });
    
    // 초기 상태 설정
    toggleOllamaOptions();
}

// getter 함수들
export function getCurrentSessionId() {
    return currentSessionId;
}

export function setCurrentSessionId(sessionId) {
    currentSessionId = sessionId;
    localStorage.setItem('currentTestSessionId', sessionId);
}
