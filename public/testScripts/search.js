// testScripts/search.js - 검색 기능 (위키피디아, 날씨 등)

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

// 날씨 검색 테스트 함수 (IP 기반 자동 위치 감지)
export async function searchWeatherTest() {
    const weatherUnitsInput = document.getElementById('weather-units');
    const weatherLangInput = document.getElementById('weather-lang');
    const weatherCityInput = document.getElementById('weather-city');
    const weatherLatInput = document.getElementById('weather-lat');
    const weatherLonInput = document.getElementById('weather-lon');
    
    const units = weatherUnitsInput?.value || 'metric';
    const lang = weatherLangInput?.value || 'ko';
    const city = weatherCityInput?.value?.trim() || '';
    const lat = weatherLatInput?.value?.trim() || '';
    const lon = weatherLonInput?.value?.trim() || '';
    
    try {
        const searchParams = new URLSearchParams({
            units: units,
            lang: lang
        });
        
        // 도시명이 제공된 경우
        if (city) {
            searchParams.append('city', city);
        }
        
        // 좌표가 제공된 경우
        if (lat && lon) {
            searchParams.append('lat', lat);
            searchParams.append('lon', lon);
        }
        
        console.log('날씨 검색 요청:', `/api/search/weather?${searchParams}`);
        
        const response = await fetch(`/api/search/weather?${searchParams}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`날씨 검색 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
        // 날씨 결과를 시각적으로 표시
        displayWeatherResults(data);
        
    } catch (error) {
        console.error('날씨 검색 오류:', error);
        updateApiResponse({ error: { message: error.message } });
        
        // 에러 표시
        const resultsDisplay = document.getElementById('weather-results-display');
        if (resultsDisplay) {
            resultsDisplay.innerHTML = `<div class="error-results">날씨 검색 중 오류가 발생했습니다: ${error.message}</div>`;
        }
    }
}

// 날씨 검색 결과 표시 함수
function displayWeatherResults(data) {
    const resultsDisplay = document.getElementById('weather-results-display');
    if (!resultsDisplay) return;
    
    // 에러 응답 처리
    if (data.message && data.error_code) {
        resultsDisplay.innerHTML = `<div class="error-results">날씨 검색 중 오류가 발생했습니다: ${data.message}</div>`;
        return;
    }
    
    // 성공 응답 처리
    if (data.location && data.current) {
        const current = data.current;
        const location = data.location;
        const forecast = data.forecast || [];
        
        // 단위 표시 설정
        const tempUnit = data.units === 'metric' ? '°C' : data.units === 'imperial' ? '°F' : 'K';
        const speedUnit = data.units === 'metric' ? 'm/s' : 'mph';
        
        resultsDisplay.innerHTML = `
            <div class="weather-results">
                <h4>🌤️ ${location.name}${location.country ? `, ${location.country}` : ''} 날씨</h4>
                
                ${data.ip_detected ? `
                    <div class="ip-detection-info" style="background: #e8f4fd; padding: 8px; border-radius: 4px; margin-bottom: 15px; font-size: 0.9em;">
                        <strong>📍 위치 감지:</strong> IP ${data.ip_detected.ip}에서 ${data.ip_detected.detected_city}, ${data.ip_detected.detected_country} 감지
                        ${data.ip_detected.is_local_ip ? ' (로컬 IP - 서울 기본값 사용)' : ''}
                        ${data.ip_detected.used_fallback ? ' (대체 서비스 사용)' : ''}
                    </div>
                ` : ''}
                
                <div class="current-weather" style="background: linear-gradient(135deg, #74b9ff, #0984e3); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <h3 style="margin: 0; font-size: 2.5em;">${current.temperature}${tempUnit}</h3>
                            <p style="margin: 5px 0; font-size: 1.1em; text-transform: capitalize;">${current.description}</p>
                            <p style="margin: 5px 0; opacity: 0.9;">체감온도: ${current.feels_like}${tempUnit}</p>
                        </div>
                        <div style="text-align: center;">
                            <img src="https://openweathermap.org/img/wn/${current.icon}@2x.png" alt="${current.description}" style="width: 80px; height: 80px;">
                        </div>
                    </div>
                </div>
                
                <div class="weather-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div class="detail-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h5 style="margin: 0 0 10px 0; color: #495057;">💨 바람</h5>
                        <p style="margin: 0;">속도: ${current.wind.speed} ${speedUnit}</p>
                        <p style="margin: 0;">방향: ${current.wind.direction}°</p>
                    </div>
                    
                    <div class="detail-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h5 style="margin: 0 0 10px 0; color: #495057;">💧 습도 & 기압</h5>
                        <p style="margin: 0;">습도: ${current.humidity}%</p>
                        <p style="margin: 0;">기압: ${current.pressure} hPa</p>
                    </div>
                    
                    <div class="detail-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h5 style="margin: 0 0 10px 0; color: #495057;">☁️ 구름 & 가시거리</h5>
                        <p style="margin: 0;">구름: ${current.clouds}%</p>
                        ${current.visibility ? `<p style="margin: 0;">가시거리: ${(current.visibility/1000).toFixed(1)} km</p>` : ''}
                    </div>
                    
                    <div class="detail-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        <h5 style="margin: 0 0 10px 0; color: #495057;">🌅 일출 & 일몰</h5>
                        <p style="margin: 0;">일출: ${new Date(current.sunrise).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p style="margin: 0;">일몰: ${new Date(current.sunset).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
                
                ${forecast.length > 0 ? `
                    <div class="forecast-section">
                        <h4 style="margin-bottom: 15px;">📅 시간별 예보</h4>
                        <div class="forecast-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                            ${forecast.map(item => `
                                <div class="forecast-item" style="background: #ffffff; border: 1px solid #dee2e6; padding: 12px; border-radius: 6px; text-align: center;">
                                    <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 0.9em;">
                                        ${new Date(item.datetime).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                        ${new Date(item.datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <img src="https://openweathermap.org/img/wn/${item.icon}.png" alt="${item.description}" style="width: 40px; height: 40px;">
                                    <p style="margin: 5px 0; font-weight: bold;">${item.temperature.current}${tempUnit}</p>
                                    <p style="margin: 0; font-size: 0.8em; text-transform: capitalize;">${item.description}</p>
                                    <p style="margin: 0; font-size: 0.8em; color: #666;">습도: ${item.humidity}%</p>
                                    ${item.rain > 0 ? `<p style="margin: 0; font-size: 0.8em; color: #007bff;">🌧️ ${item.rain}mm</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="weather-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #666;">
                    <p style="margin: 0;">마지막 업데이트: ${new Date(current.timestamp).toLocaleString('ko-KR')}</p>
                    <p style="margin: 0;">데이터 제공: OpenWeatherMap</p>
                </div>
            </div>
        `;
    } else {
        resultsDisplay.innerHTML = '<div class="error-results">날씨 데이터를 표시할 수 없습니다.</div>';
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

// 캐시 삭제 테스트 함수
export async function clearCacheTest() {
    try {
        const response = await fetch('/api/search/cache/clear', {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`캐시 삭제 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        alert('캐시가 성공적으로 삭제되었습니다.');
        
    } catch (error) {
        console.error('캐시 삭제 오류:', error);
        updateApiResponse({ error: { message: error.message } });
    }
}

// 캐시 통계 조회 테스트 함수
export async function getCacheStatsTest() {
    try {
        const response = await fetch('/api/search/cache/stats');
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`캐시 통계 조회 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
    } catch (error) {
        console.error('캐시 통계 조회 오류:', error);
        updateApiResponse({ error: { message: error.message } });
    }
}

// IP 기반 날씨 조회 테스트 함수 (getWeatherByIpTest 별칭)
export async function getWeatherByIpTest() {
    try {
        const response = await fetch('/api/search/weather/ip');
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`IP 기반 날씨 조회 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
    } catch (error) {
        console.error('IP 기반 날씨 조회 오류:', error);
        updateApiResponse({ error: { message: error.message } });
    }
}

// 도시명 기반 날씨 조회 테스트 함수 (getWeatherByCityTest 별칭)
export async function getWeatherByCityTest() {
    const cityInput = document.getElementById('weather-city-input');
    const city = cityInput?.value?.trim() || 'Seoul';
    
    try {
        const searchParams = new URLSearchParams({ city });
        const response = await fetch(`/api/search/weather/city?${searchParams}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`도시 날씨 조회 실패: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        updateApiResponse(data);
        
    } catch (error) {
        console.error('도시 날씨 조회 오류:', error);
        updateApiResponse({ error: { message: error.message } });
    }
}
