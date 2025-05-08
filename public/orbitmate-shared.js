// Orbitmate 공유 기능 및 상태 관리
let currentPromptSystem = {
    label: "기본 모드",
    prompt: ""
};

// 현재 선택된 프롬프트 시스템을 설정
function setCurrentPrompt(label, prompt) {
    currentPromptSystem = { label, prompt };
    console.log(`프롬프트 모드 변경: ${label}`);
    
    // 로컬 스토리지에 저장 (세션 유지)
    try {
        localStorage.setItem('orbitmate_promptMode', JSON.stringify(currentPromptSystem));
    } catch (e) {
        console.warn('로컬 스토리지 저장 실패:', e);
    }
    
    return currentPromptSystem;
}

// 현재 선택된 프롬프트 시스템 가져오기
function getCurrentPrompt() {
    // 로컬 스토리지에서 복원 시도
    try {
        const savedPrompt = localStorage.getItem('orbitmate_promptMode');
        if (savedPrompt) {
            currentPromptSystem = JSON.parse(savedPrompt);
        }
    } catch (e) {
        console.warn('로컬 스토리지 로드 실패:', e);
    }
    
    return currentPromptSystem;
}
