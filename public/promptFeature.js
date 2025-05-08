// 채팅 프롬프트 기능을 위한 코드
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.sessionInitialized !== 'undefined' && window.sessionInitialized) {
        console.log('세션이 이미 초기화되어 있습니다. promptFeature.js에서는 초기화를 건너뜁니다.');
    }
    
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    
    // 프롬프트 버튼 목록 (프롬프트 추가시 이 배열에 추가)
    const promptOptions = [
        { label: "기본 모드", prompt: "" },
        { label: "Orbitmate 2.5", prompt: "당신은 Orbitmate의 mate 2.5입니다. 항상 정확하고 도움이 되는 답변을 제공해주세요." },
        { label: "코딩 전문가", prompt: "당신은 코딩 전문가입니다. 코드와 프로그래밍 질문에 구체적인 예시를 포함하여 답변해주세요." },
        { label: "문학 작가", prompt: "당신은 문학 작가입니다. 질문에 대해 창의적이고 문학적인 표현으로 답변해주세요." },
        { label: "비즈니스 컨설턴트", prompt: "당신은 비즈니스 컨설턴트입니다. 비즈니스와 관련된 질문에 전문적이고 실용적인 조언을 제공해주세요." },
        { label: "철학자", prompt: "당신은 철학자입니다. 질문에 대해 깊은 통찰력을 가지고 철학적으로 답변해주세요." }
    ];
    
    // 기존 프롬프트 토글 상태
    let activePromptIndex = 0;
    let isPromptPanelVisible = false;

    // 현재 채팅 프롬프트를 표시할 버튼
    const promptToggleBtn = document.createElement('button');
    promptToggleBtn.className = 'prompt-toggle-btn';
    promptToggleBtn.textContent = '💬 ' + promptOptions[activePromptIndex].label;
    promptToggleBtn.title = '채팅 프롬프트 선택';
    
    // 프롬프트 옵션 패널 (처음에는 숨김)
    const promptPanel = document.createElement('div');
    promptPanel.className = 'prompt-panel';
    promptPanel.style.display = 'none';
    
    // 프롬프트 옵션 생성
    promptOptions.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'prompt-option';
        if (index === activePromptIndex) {
            optionElement.classList.add('active');
        }
        
        const radioBtn = document.createElement('input');
        radioBtn.type = 'radio';
        radioBtn.name = 'prompt-option';
        radioBtn.id = `prompt-option-${index}`;
        radioBtn.checked = index === activePromptIndex;
        
        const label = document.createElement('label');
        label.htmlFor = `prompt-option-${index}`;
        label.textContent = option.label;
        
        optionElement.appendChild(radioBtn);
        optionElement.appendChild(label);
        
        optionElement.addEventListener('click', () => {
            // 이전 활성화 상태 제거
            document.querySelectorAll('.prompt-option').forEach(el => el.classList.remove('active'));
            // 현재 옵션 활성화
            optionElement.classList.add('active');
            radioBtn.checked = true;
            activePromptIndex = index;
            
            // 버튼 텍스트 업데이트
            promptToggleBtn.textContent = '💬 ' + option.label;
            
            // 프롬프트 패널 숨기기
            promptPanel.style.display = 'none';
            isPromptPanelVisible = false;

            // 선택된 프롬프트를 messageInput의 dataset에 저장
            if (messageInput) {
                if (option.prompt && activePromptIndex > 0) { // 기본 모드가 아니고 프롬프트가 있을 경우
                    messageInput.dataset.selectedPrompt = option.prompt;
                    console.log('Prompt selected and stored in dataset:', option.prompt);
                } else {
                    delete messageInput.dataset.selectedPrompt; // 기본 모드이거나 프롬프트가 없으면 dataset에서 제거
                    console.log('Prompt dataset removed.');
                }
            }
        });
        
        promptPanel.appendChild(optionElement);
    });
    
    // 프롬프트 토글 버튼 클릭 이벤트
    promptToggleBtn.addEventListener('click', () => {
        isPromptPanelVisible = !isPromptPanelVisible;
        promptPanel.style.display = isPromptPanelVisible ? 'block' : 'none';
    });
    
    // 채팅 입력 영역 앞에 프롬프트 버튼 컨테이너 삽입
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        const promptContainer = document.createElement('div');
        promptContainer.className = 'prompt-container';
        promptContainer.appendChild(promptToggleBtn);
        
        // 프롬프트 관련 요소 추가
        chatContainer.appendChild(promptPanel);
        
        const inputArea = document.getElementById('input-area');
        if (inputArea) {
            inputArea.parentNode.insertBefore(promptContainer, inputArea);
        }
          // 채팅 메시지 전송 시 선택된 프롬프트 추가
        // const sendButton = document.getElementById('send-button'); // script.js에서 이미 처리하므로 직접 참조 불필요
        // const originalSendFunction = window.sendMessage; // window.sendMessage 덮어쓰기 제거

        // activePromptIndex가 변경될 때 messageInput.dataset에 선택된 프롬프트 저장
        promptOptions.forEach((option, index) => {
            const optionElement = promptPanel.querySelector(`#prompt-option-${index}`).parentElement; // radio 버튼의 부모 div
            optionElement.addEventListener('click', () => {
                // ... 기존 로직 ...
                activePromptIndex = index;
                promptToggleBtn.textContent = '💬 ' + option.label;
                promptPanel.style.display = 'none';
                isPromptPanelVisible = false;

                // 선택된 프롬프트를 messageInput의 dataset에 저장
                if (messageInput) {
                    if (option.prompt && activePromptIndex > 0) { // 기본 모드가 아니고 프롬프트가 있을 경우
                        messageInput.dataset.selectedPrompt = option.prompt;
                        console.log('Prompt selected and stored in dataset:', option.prompt);
                    } else {
                        delete messageInput.dataset.selectedPrompt; // 기본 모드이거나 프롬프트가 없으면 dataset에서 제거
                        console.log('Prompt dataset removed.');
                    }
                }
            });
        });
        
        // if (originalSendFunction && sendButton) { // window.sendMessage 덮어쓰기 제거
        // window.sendMessage = async function() { // window.sendMessage 덮어쓰기 제거
        // ... 기존 sendMessage 덮어쓰기 로직 전체 제거 ...
        // }; // window.sendMessage 덮어쓰기 제거
        // } // window.sendMessage 덮어쓰기 제거
    }
    
    // 클릭 외부 영역 클릭 시 패널 닫기
    document.addEventListener('click', (event) => {
        if (isPromptPanelVisible && !promptPanel.contains(event.target) && event.target !== promptToggleBtn) {
            promptPanel.style.display = 'none';
            isPromptPanelVisible = false;
        }
    });
});
