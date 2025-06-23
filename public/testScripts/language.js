// testScripts/language.js - 다국어 지원 테스트 함수들

import { updateApiResponse } from './utils.js';

// =========================
// 다국어 지원 테스트
// =========================

export async function getTranslationsTest() {
    const langSelect = document.getElementById('translation-lang');
    const categorySelect = document.getElementById('translation-category');
    
    const lang = langSelect.value || 'ko';
    const category = categorySelect.value || '';
    
    try {
        let url = `/api/users/translations/${lang}`;
        if (category) {
            url += `?category=${category}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        updateApiResponse(data);
        
        // 번역 리소스를 시각적으로 표시
        displayTranslations(data, lang, category);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

export async function updateUserLanguageTest() {
    const userIdInput = document.getElementById('language-user-id');
    const languageSelect = document.getElementById('user-language');
    
    const user_id = userIdInput.value || 'guest';
    const language = languageSelect.value || 'ko';
    
    try {
        const response = await fetch(`/api/users/${user_id}/language`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language })
        });
        const data = await response.json();
        updateApiResponse(data);
    } catch (error) {
        updateApiResponse({ error: { message: error.message } });
    }
}

// 번역 리소스 표시 함수
function displayTranslations(translations, lang, category) {
    let displayHtml = `<div class="translations-display">
        <h4>🌍 번역 리소스 (${lang}${category ? ` - ${category}` : ''})</h4>`;
    
    if (translations && typeof translations === 'object') {
        const keys = Object.keys(translations);
        if (keys.length > 0) {
            displayHtml += '<table style="width: 100%; border-collapse: collapse;">';
            displayHtml += '<tr><th style="border: 1px solid #ddd; padding: 8px;">키</th><th style="border: 1px solid #ddd; padding: 8px;">값</th></tr>';
            
            keys.forEach(key => {
                displayHtml += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace;">${key}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${translations[key]}</td>
                    </tr>
                `;
            });
            
            displayHtml += '</table>';
        } else {
            displayHtml += '<p>해당 언어/카테고리에 대한 번역 리소스가 없습니다.</p>';
        }
    } else {
        displayHtml += '<p>번역 리소스 형식이 올바르지 않습니다.</p>';
    }
    
    displayHtml += '</div>';
    
    // 기존 번역 표시 영역이 있으면 업데이트, 없으면 생성
    let translationsDisplay = document.getElementById('translations-display');
    if (!translationsDisplay) {
        translationsDisplay = document.createElement('div');
        translationsDisplay.id = 'translations-display';
        // 다국어 지원 섹션 찾기
        const languageSection = Array.from(document.querySelectorAll('.api-section')).find(section => 
            section.querySelector('h3').textContent.includes('다국어 지원')
        );
        if (languageSection) {
            languageSection.appendChild(translationsDisplay);
        }
    }
    translationsDisplay.innerHTML = displayHtml;
}
