// testScripts/search.js - 검색 기능 (위키피디아 등)

import { updateApiResponse } from './utils.js';

// 위키피디아 검색 테스트 함수
export async function searchWikipediaTest() {
    const wikipediaQueryInput = document.getElementById('wikipedia-search-query');
    const wikipediaLimitInput = document.getElementById('wikipedia-search-limit');
    const wikipediaLanguageInput = document.getElementById('wikipedia-search-language');
    
    const query = wikipediaQueryInput.value.trim();
    const limit = wikipediaLimitInput.value || '10';
    const language = wikipediaLanguageInput.value || 'ko';
    
    if (!query) {
        alert('검색어를 입력해주세요.');
        return;
    }
    
    try {
        const searchParams = new URLSearchParams({
            q: query,
            limit: limit,
            language: language
        });
        
        const response = await fetch(`/api/search/wikipedia?${searchParams}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`위키피디아 검색 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
        // 검색 결과를 시각적으로 표시
        displayWikipediaResults(data);
        
    } catch (error) {
        console.error('위키피디아 검색 오류:', error);
        updateApiResponse({ error: { message: error.message } });
    }
}

// 위키피디아 검색 결과 표시 함수
function displayWikipediaResults(data) {
    const resultsDisplay = document.getElementById('wikipedia-results-display');
    if (!resultsDisplay) return;
    
    // 새로운 응답 형식: 성공시 데이터 직접 반환, 실패시 에러 메시지
    if (data.message && data.error_code) {
        // 에러 응답
        resultsDisplay.innerHTML = `<div class="error-results">검색 중 오류가 발생했습니다: ${data.message}</div>`;
    } else if (data.results && data.results.length > 0) {
        // 성공 응답 - 검색 결과 있음
        resultsDisplay.innerHTML = `
            <h4>위키피디아 검색 결과 (${data.results.length}개)</h4>
            <div class="search-results">
                ${data.results.map(result => `
                    <div class="search-result-item">
                        <h5><a href="${result.url}" target="_blank">${result.title}</a></h5>
                        <p class="result-snippet">${result.snippet || result.extract || '요약 정보 없음'}</p>
                        ${result.thumbnail ? `<img src="${result.thumbnail}" alt="썸네일" class="result-thumbnail">` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } else if (data.results && data.results.length === 0) {
        // 성공 응답 - 검색 결과 없음
        resultsDisplay.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
    } else {
        // 예상치 못한 응답 형식
        resultsDisplay.innerHTML = '<div class="error-results">알 수 없는 응답 형식입니다.</div>';
    }
}

// 네이버 검색 테스트 함수 (향후 추가 예정)
export async function searchNaverTest() {
    // TODO: 네이버 검색 API 구현 후 추가
    alert('네이버 검색 기능은 아직 구현되지 않았습니다.');
}

// 카카오 검색 테스트 함수 (향후 추가 예정)  
export async function searchKakaoTest() {
    // TODO: 카카오 검색 API 구현 후 추가
    alert('카카오 검색 기능은 아직 구현되지 않았습니다.');
}
