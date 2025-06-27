// 게스트 사용자 ID
const GUEST_USER_ID = 'guest';

// 전역 변수
let currentSessionId = null;

// Markdown 처리 함수
function parseMarkdown(text) {
    if (typeof marked === 'undefined') {
        console.warn('Marked.js 라이브러리가 로드되지 않았습니다. 일반 텍스트로 표시합니다.');
        return text.replace(/\n/g, '<br>');
    }
    
    try {
        // Marked.js 설정
        marked.setOptions({
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.warn('Syntax highlighting 오류:', err);
                    }
                }
                return code;
            },
            breaks: true,
            gfm: true
        });
        
        return marked.parse(text);
    } catch (e) {
        console.error('Markdown 파싱 오류:', e);
        return text.replace(/\n/g, '<br>');
    }
}

// 메시지 내용을 Markdown으로 렌더링하는 함수
function renderMessageContent(content, isMarkdown = true) {
    if (!isMarkdown) {
        return content.replace(/\n/g, '<br>');
    }
    
    return parseMarkdown(content);
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
            // HTML 태그가 아닌 순수 텍스트 내용을 가져오기 위해 innerText 또는 textContent 사용
            // '나: ' 또는 'AI: ' 같은 접두사 제거 필요
            let currentContent = currentContentElement.textContent || currentContentElement.innerText;
            if (currentContent.startsWith('나: ')) {
                currentContent = currentContent.substring(3);
            }
            
            const newContent = prompt('메시지 수정:', currentContent.trim());
            if (newContent !== null && newContent.trim() !== '') {
                // saveEdit 함수는 messageElement를 직접 조작하므로 전달
                saveEdit(messageId, newContent.trim(), messageElement);
            }
        };
        actionsDiv.appendChild(editButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '삭제';
    deleteButton.classList.add('delete-btn');
    deleteButton.onclick = () => {
        // deleteMessage 함수는 messageId만 필요함
        deleteMessage(messageId); 
    };
    actionsDiv.appendChild(deleteButton);

    // 메시지 내용 뒤에, 메시지 요소의 자식으로 추가
    messageElement.appendChild(actionsDiv);
}
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// 메시지 전송 중 상태 추적
let isMessageSending = false;

// 세션 초기화 상태 추적 - 전역 변수로 만들어 다른 스크립트에서도 접근 가능하게 함
window.sessionInitialized = false;

// 페이지 로드 시 새 세션 생성 또는 기존 세션 ID 사용 로직 (간단하게 구현)
async function initializeSession() {
    try {
        console.log('세션 초기화 시작...');
        // 로컬 스토리지에서 세션 ID 확인
        const savedSessionId = localStorage.getItem('currentSessionId');
          if (savedSessionId) {
            console.log('저장된 세션 ID 발견:', savedSessionId);
            // 저장된 세션이 있으면 유효성 확인
            try {
                console.log('세션 유효성 확인 중...');
                const checkResponse = await fetch(`/api/chat/sessions/${savedSessionId}/messages`);
                console.log('세션 유효성 확인 응답:', checkResponse.status);
                  if (checkResponse.ok) {
                    currentSessionId = savedSessionId;
                    console.log('기존 세션 사용:', currentSessionId);
                    addMessage('시스템', `저장된 세션 사용 중 (ID: ${currentSessionId})`);
                    
                    // 저장된 메시지 불러오기
                    refreshMessages();
                    return; // 세션 재사용 성공, 함수 종료
                } else {
                    console.warn('저장된 세션이 유효하지 않음:', checkResponse.status);
                    localStorage.removeItem('currentSessionId');
                }
            } catch (error) {
                console.warn('세션 유효성 검사 실패:', error);
                localStorage.removeItem('currentSessionId');
            }
        }
        
        console.log('새 세션 생성 시작...');
        // GUEST_USER_ID를 사용하여 세션 생성
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // user_id를 GUEST_USER_ID로 설정
            body: JSON.stringify({ user_id: GUEST_USER_ID, title: 'Guest Session' })
        });
        
        console.log('세션 생성 응답 상태:', response.status);
        
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.error || `HTTP 오류! 상태: ${response.status}`;
            } catch (e) {
                errorMessage = `HTTP 오류! 상태: ${response.status}, 응답을 파싱할 수 없습니다.`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (!result || result.status !== 'success' || !result.data || !result.data.session_id) {
            throw new Error('서버 응답에 세션 ID가 없습니다.');
        }
        
        currentSessionId = result.data.session_id;
        console.log('새 게스트 세션 생성됨:', currentSessionId);
        
        // 세션 ID 저장
        localStorage.setItem('currentSessionId', currentSessionId);
        
        addMessage('시스템', `게스트 세션 시작 (ID: ${currentSessionId})`);
    } catch (error) {
        console.error('세션 초기화 오류:', error);
        addMessage('시스템', '세션 초기화 중 오류가 발생했습니다: ' + error.message);
    }
}

function addMessage(sender, text, messageId = null, isEdited = false, isRealtime = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // 실시간 메시지 표시
    if (isRealtime) {
        messageElement.classList.add('realtime-message');
        messageElement.title = '실시간으로 수신된 메시지';
    }
    
    if (messageId) {
        messageElement.dataset.messageId = messageId; // 메시지 ID를 data 속성으로 저장
    }    const contentSpan = document.createElement('span');
    contentSpan.classList.add('message-content');
    
    if (sender === 'user') {
        messageElement.classList.add('user-message');
        // 사용자 메시지는 일반 텍스트로 처리
        const escapedText = text ? String(text).replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        }) : '';
        const formattedText = escapedText.replace(/\\n/g, '<br>');
        contentSpan.innerHTML = `나: ${formattedText}`;
    } else if (sender === 'ai') {
        messageElement.classList.add('ai-message');
        // AI 메시지는 Markdown으로 렌더링
        const renderedContent = renderMessageContent(text || '', true);
        contentSpan.innerHTML = `AI: ${renderedContent}`;
        
        // 코드 하이라이팅 적용
        if (typeof hljs !== 'undefined') {
            setTimeout(() => {
                const codeBlocks = contentSpan.querySelectorAll('pre code');
                codeBlocks.forEach((block) => {
                    hljs.highlightElement(block);
                });
            }, 0);
        }
    } else { // 시스템 메시지 등
        messageElement.classList.add('system-message');
        const escapedText = text ? String(text).replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        }) : '';
        const formattedText = escapedText.replace(/\\n/g, '<br>');
        contentSpan.innerHTML = `[${sender}] ${formattedText}`;
    }
    messageElement.appendChild(contentSpan);

    if (isEdited) {
        const editedIndicator = document.createElement('span');
        editedIndicator.classList.add('edited-indicator');
        editedIndicator.textContent = '(편집됨)';
        messageElement.appendChild(editedIndicator);
    }

    // 메시지 ID가 있고, 시스템 메시지가 아닌 경우 버튼 추가
    if (messageId && sender !== 'system') {
        addMessageActions(messageElement, messageId, sender); // text 인자 제거
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // 맨 아래로 스크롤

    return messageElement; // 스트리밍 업데이트를 위해 요소 반환
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

        const result = await response.json();
        
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
        addMessage('system', '세션이 초기화되지 않았습니다. 페이지를 새로고침하거나 새 세션을 시작해주세요.');
        return;
    }

    if (isMessageSending) {
        console.log("메시지 전송 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    isMessageSending = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '전송 중...';

    const originalMessageText = messageText;
    // 사용자 메시지를 먼저 UI에 추가 (ID는 응답 후 업데이트)
    const userMessageElement = addMessage('user', originalMessageText); 
    messageInput.value = '';
    
    const selectedPrompt = messageInput.dataset.selectedPrompt || ''; // 저장된 프롬프트 사용
    const systemPromptToSend = selectedPrompt; 
    if (selectedPrompt) {
        console.log("선택된 시스템 프롬프트 적용:", systemPromptToSend);
        messageInput.dataset.selectedPrompt = ''; // 사용 후 초기화
        // 프롬프트 버튼 UI 초기화 (선택 사항)
        const promptButtons = document.querySelectorAll('.prompt-button.selected');
        promptButtons.forEach(btn => btn.classList.remove('selected'));
    }


    // 스트리밍 모드 확인 (UI 요소가 있다면 해당 값 사용, 여기서는 false로 고정)
    const useStream = true; // Force streaming for this fix
    const useCanvas = false; // 기본 채팅 페이지에서는 캔버스 모드 미사용 또는 별도 UI 필요

    try {
        const requestBody = {
            message: originalMessageText,
            user_id: GUEST_USER_ID,
            systemPrompt: systemPromptToSend,
            max_output_tokens_override: currentMaxOutputTokens,
            context_message_limit: currentContextLimit
            // ai_provider_override: selectedAiProvider,
            // model_id_override: selectedModelId
            // user_message_token_count can be added here if calculated on frontend
        };

        // Conditionally add ai_provider_override and model_id_override
        if (selectedAiProvider && typeof selectedAiProvider === 'string' && selectedAiProvider.trim() !== '') {
            requestBody.ai_provider_override = selectedAiProvider;
        }
        if (selectedModelId && typeof selectedModelId === 'string' && selectedModelId.trim() !== '') {
            requestBody.model_id_override = selectedModelId;
        }

        if (useStream) { 
            requestBody.specialModeType = 'stream';
        }
        // 스트림 또는 캔버스 모드 설정 (testScript.js와 유사하게 UI 요소 확인 필요)
        // 예: const streamCheckbox = document.getElementById('stream-mode-checkbox-main');
        // if (streamCheckbox && streamCheckbox.checked) requestBody.specialModeType = 'stream';

        const response = await fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 필요시 인증 토큰 추가
                // 'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: '메시지 전송에 실패했습니다.' }));
            console.error('메시지 전송 실패:', errorData);
            addMessage('system', `오류: ${errorData.error.message || errorData.error}`);
            // 실패한 사용자 메시지에 대한 처리가 필요할 수 있음 (예: 재전송 버튼)
            if(userMessageElement) userMessageElement.classList.add('message-error');
            return;
        }
          // 스트리밍 응답 처리
        if (useStream && response.body && response.headers.get('Content-Type')?.includes('text/event-stream')) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let aiMessageId = null;
            let userMessageIdForStream = null;
            let fullAiResponse = '';
            
            const aiMessageElement = addMessage('ai', 'AI 응답 대기 중...');
            const aiContentSpan = aiMessageElement.querySelector('.message-content');
            let isFirstChunk = true;

            console.log('[메인 페이지 SSE] 스트리밍 시작');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[메인 페이지 SSE] 스트리밍 완료');
                    // 최종 ID 설정 및 액션 버튼 추가
                    if (aiMessageElement && aiMessageId) {
                        aiMessageElement.dataset.messageId = aiMessageId;
                        if (!aiMessageElement.querySelector('.message-actions')) {
                            addMessageActions(aiMessageElement, aiMessageId, 'ai');
                        }
                    }
                    if (userMessageElement && userMessageIdForStream) {
                        userMessageElement.dataset.messageId = userMessageIdForStream;
                        if (!userMessageElement.querySelector('.message-actions')) {
                            addMessageActions(userMessageElement, userMessageIdForStream, 'user');
                        }
                    }
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                
                // SSE 이벤트 구분자: \n\n
                let boundaryIndex;
                while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
                    const chunk = buffer.slice(0, boundaryIndex);
                    buffer = buffer.slice(boundaryIndex + 2);

                    if (!chunk.trim()) continue; // 빈 청크 무시
                    
                    console.log('[메인 페이지 SSE] 받은 청크:', chunk);

                    // SSE 이벤트 파싱
                    const lines = chunk.split('\n');
                    let eventType = '';
                    let data = '';
                    
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7).trim();
                        } else if (line.startsWith('data: ')) {
                            data = line.slice(6);
                        }
                    }

                    // 데이터가 없으면 건너뛰기
                    if (!data) {
                        console.log('[메인 페이지 SSE] 데이터가 없는 청크, 건너뛰기');
                        continue;
                    }

                    try {
                        const chunkData = JSON.parse(data);
                        console.log('[메인 페이지 SSE] 파싱된 데이터:', { eventType, data: chunkData });

                        // 완료 신호 처리
                        if (chunkData.done === true) {
                            console.log('[메인 페이지 SSE] 완료 신호 수신');
                            continue; // 다음 데이터를 기다림 (최종 응답)
                        }

                        // 새로운 응답 형식에서 데이터 추출
                        const actualData = chunkData.status === 'success' && chunkData.data ? chunkData.data : chunkData;

                        // done 신호 후 첫 번째 데이터를 최종 응답으로 처리
                        if (!eventType && (actualData.message_id || actualData.user_message_id || actualData.ai_message_id)) {
                            console.log('[메인 페이지 SSE] 최종 응답 수신:', actualData);
                            
                            // 최종 응답 처리 (메시지 ID 업데이트 등)
                            if (actualData.user_message_id && userMessageElement) {
                                userMessageElement.dataset.messageId = actualData.user_message_id;
                                if (!userMessageElement.querySelector('.message-actions')) {
                                    addMessageActions(userMessageElement, actualData.user_message_id, 'user');
                                }
                            }
                            
                            if (actualData.ai_message_id && aiMessageElement) {
                                aiMessageElement.dataset.messageId = actualData.ai_message_id;
                            }
                            
                            break; // 스트리밍 완료
                        }

                        // 이벤트 타입별 처리
                        if (eventType === 'ids' && actualData.userMessageId) {
                            console.log('[메인 페이지 SSE] 사용자 메시지 ID 수신:', actualData.userMessageId);
                            userMessageIdForStream = actualData.userMessageId;
                            if (userMessageElement) {
                                userMessageElement.dataset.messageId = userMessageIdForStream;
                                if (!userMessageElement.querySelector('.message-actions')) {
                                    addMessageActions(userMessageElement, userMessageIdForStream, 'user');
                                }
                            }
                        } else if (eventType === 'ai_message_id' && actualData.aiMessageId) {
                            console.log('[메인 페이지 SSE] AI 메시지 ID 수신:', actualData.aiMessageId);
                            aiMessageId = actualData.aiMessageId;
                            if (aiMessageElement) {
                                aiMessageElement.dataset.messageId = aiMessageId;
                            }                        } else if (eventType === 'end') {
                            console.log('[메인 페이지 SSE] 종료 이벤트 수신');
                            // 스트리밍 완료 후 Markdown 렌더링 적용
                            if (aiContentSpan) {
                                const aiPrefix = 'AI: ';
                                const currentContent = aiContentSpan.textContent;
                                
                                if (currentContent.startsWith(aiPrefix)) {
                                    const actualContent = currentContent.substring(aiPrefix.length);
                                    const renderedContent = renderMessageContent(actualContent, true);
                                    aiContentSpan.innerHTML = aiPrefix + renderedContent;
                                    
                                    // 코드 하이라이팅 적용
                                    if (typeof hljs !== 'undefined') {
                                        const codeBlocks = aiContentSpan.querySelectorAll('pre code');
                                        codeBlocks.forEach((block) => {
                                            hljs.highlightElement(block);
                                        });
                                    }
                                }
                            }
                            break;
                        } else if (eventType === 'message' || (!eventType && actualData.delta)) {
                            // 메시지 데이터 처리 (delta 또는 직접 텍스트)
                            const deltaText = actualData.delta || actualData.text || actualData.content || actualData.chunk || '';
                            

                            if (deltaText) {
                                console.log('[메인 페이지 SSE] 텍스트 추가:', deltaText.substring(0, 50) + '...');
                                
                                // HTML 이스케이프 처리
                                const escapedChunk = deltaText.replace(/[&<>"']/g, function (match) {
                                    return { 
                                        '&': '&amp;', 
                                        '<': '&lt;', 
                                        '>': '&gt;', 
                                        '"': '&quot;', 
                                        "'": '&#39;' 
                                    }[match];
                                }).replace(/\n/g, '<br>');

                                // 첫 번째 청크인 경우 "AI 응답 대기 중..." 텍스트 제거
                                if (isFirstChunk && aiContentSpan) {
                                    aiContentSpan.innerHTML = 'AI: ' + escapedChunk;
                                    fullAiResponse = deltaText;
                                    isFirstChunk = false;
                                } else if (aiContentSpan) {
                                    aiContentSpan.innerHTML += escapedChunk;
                                    fullAiResponse += deltaText;
                                }
                                
                                // 스크롤 자동 이동
                                chatBox.scrollTop = chatBox.scrollHeight;
                            }
                        } else {
                            console.log('[메인 페이지 SSE] 처리되지 않은 이벤트:', eventType, chunkData);
                        }
                    } catch (e) {
                        console.error('[메인 페이지 SSE] 청크 파싱 오류:', e, '원본 데이터:', data);
                        // 파싱 실패 시에도 텍스트로 표시 (JSON이 아닌 경우)
                        if (data && typeof data === 'string') {
                            if (isFirstChunk && aiContentSpan) {
                                aiContentSpan.innerHTML = 'AI: ' + data;
                                isFirstChunk = false;
                            } else if (aiContentSpan) {
                                aiContentSpan.innerHTML += data;
                            }
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    }
                }
            }

        } else {
            // 일반 응답 처리
            const responseData = await response.json();
            // 새 응답 형식에 맞게 데이터 추출
            const actualData = responseData.status === 'success' ? responseData.data : responseData;
            
            if (userMessageElement && actualData.user_message_id) {
                userMessageElement.dataset.messageId = actualData.user_message_id;
                // 사용자 메시지 전송 성공 후 버튼 추가
                addMessageActions(userMessageElement, actualData.user_message_id, 'user'); // Removed text
            }
            const aiMessageElement = addMessage('ai', actualData.message, actualData.ai_message_id);
             // Display AI token count if available
            if (actualData.ai_message_token_count !== undefined && actualData.ai_message_token_count !== null) {
                const lastAiTokensSpan = document.getElementById('last-ai-tokens');
                if (lastAiTokensSpan) {
                    lastAiTokensSpan.textContent = actualData.ai_message_token_count;
                }
            } else {
                 const lastAiTokensSpan = document.getElementById('last-ai-tokens');
                 if (lastAiTokensSpan) lastAiTokensSpan.textContent = 'N/A'; // Reset if not provided
            }
            
            // 캔버스 모드 처리 (기본 채팅 페이지에서는 현재 미구현, 필요시 testScript.js 참고)
            if (responseData.specialModeType === 'canvas' || (responseData.canvas_html || responseData.canvas_css || responseData.canvas_js)) {
                // 기본 페이지에서는 콘솔에만 로그를 남기거나 간단한 텍스트로 표시
                console.log("Canvas data received:", responseData);
                let canvasInfo = "AI가 Canvas 콘텐츠를 생성했습니다: ";
                if(responseData.canvas_html) canvasInfo += "[HTML] ";
                if(responseData.canvas_css) canvasInfo += "[CSS] ";
                if(responseData.canvas_js) canvasInfo += "[JS] ";
                addMessage('system', canvasInfo.trim());
            }
        }

    } catch (error) {
        console.error('메시지 전송 중 네트워크 오류 또는 기타 오류:', error);
        addMessage('error', `오류: ${error.message}`);
    } finally {
        isMessageSending = false;
        sendButton.disabled = false;
        sendButton.innerHTML = '전송';
    }
}

// 페이지 로드 시 세션 초기화
// DOMContentLoaded 이벤트에서 한 번만 실행되도록 처리
let sessionInitialized = false;

// Global variables for sidebar control values
let currentMaxOutputTokens = 8192; // Default value from HTML
let currentContextLimit = 10;   // Default value from HTML
let selectedAiProvider = null;
let selectedModelId = null;
let availableModels = []; // To store fetched model data

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
    
    // Sidebar toggle logic
    const toggleSidebarButton = document.getElementById('toggle-sidebar-button');
    const sidebar = document.getElementById('ai-settings-sidebar');

    if (toggleSidebarButton && sidebar) {
        toggleSidebarButton.addEventListener('click', function() {
            if (sidebar.style.display === 'none' || sidebar.style.display === '') {
                sidebar.style.display = 'block'; 
            } else {
                sidebar.style.display = 'none';
            }
        });
    }

    // Fetch AI Models and populate selector
    const modelSelectionArea = document.getElementById('model-selection-area');
    const selectedModelNameSpan = document.getElementById('selected-model-name');
    const modelMaxInputSpan = document.getElementById('model-max-input-tokens');
    const modelMaxOutputSpan = document.getElementById('model-max-output-tokens');
    const maxOutputControl = document.getElementById('max-output-tokens-control');
    const contextLimitControl = document.getElementById('context-limit-control');

    async function fetchAiModelsAndPopulateSelector() {
        try {
            const response = await fetch('/api/ai/models');
            if (!response.ok) {
                throw new Error(`Failed to fetch AI models: ${response.statusText}`);
            }
            const modelsData = await response.json();
            availableModels = modelsData.data; // Assuming data is nested under a 'data' key from standardizeApiResponse
            
            if (modelSelectionArea && Array.isArray(availableModels)) {
                modelSelectionArea.innerHTML = ''; // Clear placeholder
                const selectElement = document.createElement('select');
                selectElement.id = 'ai-model-selector-dropdown';
                
                availableModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = `${model.provider}:${model.id}`; // Store combined value
                    option.textContent = `${model.name}`; // Display name already includes provider
                    option.dataset.provider = model.provider;
                    option.dataset.id = model.id; // Store individual id
                    option.dataset.maxInput = model.max_input_tokens;
                    option.dataset.maxOutput = model.max_output_tokens;
                    if (model.is_default) {
                        option.selected = true;
                    }
                    selectElement.appendChild(option);
                });
                
                modelSelectionArea.appendChild(selectElement);
                updateDisplayedModelInfo(selectElement); // Initial display update

                selectElement.addEventListener('change', function() {
                    updateDisplayedModelInfo(this);
                });
            }
        } catch (error) {
            console.error('Error fetching AI models:', error);
            if (modelSelectionArea) modelSelectionArea.innerHTML = '<p>Error loading models.</p>';
        }
    }

    function updateDisplayedModelInfo(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption) {
            selectedAiProvider = selectedOption.dataset.provider;
            selectedModelId = selectedOption.dataset.id;
            
            if (selectedModelNameSpan) selectedModelNameSpan.textContent = selectedOption.textContent;
            if (modelMaxInputSpan) modelMaxInputSpan.textContent = selectedOption.dataset.maxInput || 'N/A';
            if (modelMaxOutputSpan) modelMaxOutputSpan.textContent = selectedOption.dataset.maxOutput || 'N/A';
            
            const modelMaxOut = parseInt(selectedOption.dataset.maxOutput, 10);
            if (maxOutputControl && !isNaN(modelMaxOut)) {
                maxOutputControl.value = modelMaxOut; 
                currentMaxOutputTokens = modelMaxOut; 
            }
        }
    }

    if (maxOutputControl) {
        maxOutputControl.addEventListener('change', function() {
            currentMaxOutputTokens = parseInt(this.value, 10);
            if (isNaN(currentMaxOutputTokens) || currentMaxOutputTokens <= 0) {
                const selectedOption = document.getElementById('ai-model-selector-dropdown')?.options[document.getElementById('ai-model-selector-dropdown')?.selectedIndex];
                currentMaxOutputTokens = selectedOption ? parseInt(selectedOption.dataset.maxOutput, 10) : 8192; // Fallback to a default or model's max
                this.value = currentMaxOutputTokens;
                alert("최대 출력 토큰은 양의 정수여야 합니다.");
            }
             // Ensure it doesn't exceed the selected model's max output tokens, if a model is selected
            const selectedOption = document.getElementById('ai-model-selector-dropdown')?.options[document.getElementById('ai-model-selector-dropdown')?.selectedIndex];
            if (selectedOption) {
                const modelMax = parseInt(selectedOption.dataset.maxOutput, 10);
                if (!isNaN(modelMax) && currentMaxOutputTokens > modelMax) {
                    currentMaxOutputTokens = modelMax;
                    this.value = currentMaxOutputTokens;
                    alert(`최대 출력 토큰은 현재 모델의 최대치(${modelMax})를 초과할 수 없습니다.`);
                }
            }
        });
        // Initialize with default or model's default (if models are loaded before this runs)
        currentMaxOutputTokens = parseInt(maxOutputControl.value, 10);
    }

    if (contextLimitControl) {
        contextLimitControl.addEventListener('change', function() {
            currentContextLimit = parseInt(this.value, 10);
             if (isNaN(currentContextLimit) || currentContextLimit < 0) {
                currentContextLimit = 10; // Default value
                this.value = currentContextLimit;
                alert("컨텍스트 제한은 0 이상의 정수여야 합니다.");
            }
        });
         // Initialize with default
        currentContextLimit = parseInt(contextLimitControl.value, 10);
    }    if (sendButton) { // sendButton이 있는 페이지(index.html)에서만 실행        
        initializeSession().then(() => {
             fetchAiModelsAndPopulateSelector(); // Fetch models after session is initialized
        });
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
                console.log('세션 초기화 버튼 클릭됨');
                if (confirm('현재 세션을 초기화하고 새로운 대화를 시작하시겠습니까?')) {
                    try {
                        // 로컬 스토리지에서 세션 ID 제거
                        localStorage.removeItem('currentSessionId');
                        // 현재 세션 ID 초기화
                        currentSessionId = null;
                        // 채팅창 초기화
                        chatBox.innerHTML = '';
                        // 상태 메시지 추가
                        addMessage('시스템', '새 세션을 시작합니다...');
                        // 새 세션 시작
                        await initializeSession();
                        
                        console.log('새 세션 생성 완료:', currentSessionId);
                    } catch (error) {
                        console.error('새 세션 생성 오류:', error);
                        addMessage('시스템', `세션 생성 중 오류 발생: ${error.message}`);
                    }
                }
            });
        }        window.sessionInitialized = true;
        console.log('세션 초기화 완료');
    }
});
