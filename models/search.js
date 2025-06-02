// models/search.js
const axios = require('axios');

// 메모리 캐시 (간단한 구현)
const searchCache = new Map();

/**
 * 위키피디아 검색 함수
 * @param {string} query - 검색어
 * @param {number} limit - 결과 개수 제한
 * @param {string} language - 언어 코드 (ko, en 등)
 * @returns {Promise<Array>} 검색 결과 배열
 */
async function searchWikipedia(query, limit = 10, language = 'ko') {
    const cacheKey = `${language}:${query}:${limit}`;
    const cacheDuration = parseInt(process.env.WIKIPEDIA_CACHE_DURATION) || 3600; // 1시간
    
    // 캐시 확인
    if (searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey);
        const now = Date.now();
        if (now - cached.timestamp < cacheDuration * 1000) {
            console.log(`[searchModel] Using cached result for: ${query}`);
            return cached.data;
        } else {
            // 만료된 캐시 삭제
            searchCache.delete(cacheKey);
        }
    }

    try {
        console.log(`[searchModel] Fetching from Wikipedia API: ${language}.wikipedia.org`);
        
        // 1단계: 검색어로 페이지 제목들 찾기
        const searchUrl = `https://${language}.wikipedia.org/w/api.php`;
        const searchParams = {
            action: 'query',
            format: 'json',
            list: 'search',
            srsearch: query,
            srlimit: Math.min(limit * 2, 50), // 더 많이 가져와서 필터링
            srprop: 'snippet|titlesnippet|size|wordcount|timestamp'
        };

        const searchResponse = await axios.get(searchUrl, {
            params: searchParams,
            timeout: parseInt(process.env.WIKIPEDIA_REQUEST_TIMEOUT) || 5000,
            headers: {
                'User-Agent': 'Orbitmate/1.0 (https://orbitmate.com; contact@orbitmate.com)'
            }
        });

        const searchResults = searchResponse.data.query?.search || [];
        
        if (searchResults.length === 0) {
            // 한국어에서 결과가 없으면 영어로 재시도
            if (language === 'ko') {
                const fallbackLanguage = process.env.WIKIPEDIA_FALLBACK_LANGUAGE || 'en';
                console.log(`[searchModel] No results in Korean, trying ${fallbackLanguage}`);
                return await searchWikipedia(query, limit, fallbackLanguage);
            }
            return [];
        }

        // 2단계: 상위 결과들의 상세 정보 가져오기
        const pageIds = searchResults.slice(0, limit).map(result => result.pageid);
        const detailsUrl = `https://${language}.wikipedia.org/w/api.php`;
        const detailsParams = {
            action: 'query',
            format: 'json',
            prop: 'extracts|pageimages|info',
            pageids: pageIds.join('|'),
            exintro: true,
            explaintext: true,
            exsectionformat: 'plain',
            piprop: 'thumbnail|original',
            pithumbsize: 300,
            inprop: 'url'
        };

        const detailsResponse = await axios.get(detailsUrl, {
            params: detailsParams,
            timeout: parseInt(process.env.WIKIPEDIA_REQUEST_TIMEOUT) || 5000,
            headers: {
                'User-Agent': 'Orbitmate/1.0 (https://orbitmate.com; contact@orbitmate.com)'
            }
        });

        const pages = detailsResponse.data.query?.pages || {};
        
        // 3단계: 결과 포맷팅
        const formattedResults = searchResults.slice(0, limit).map(searchResult => {
            const pageDetails = pages[searchResult.pageid] || {};
            
            // 스니펫에서 HTML 태그 제거
            const cleanSnippet = searchResult.snippet
                ? searchResult.snippet.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
                : '';
            
            // 추출문에서 너무 긴 내용 요약
            let extract = pageDetails.extract || cleanSnippet || '';
            if (extract.length > 500) {
                extract = extract.substring(0, 500) + '...';
            }

            return {
                title: searchResult.title,
                pageid: searchResult.pageid,
                url: pageDetails.fullurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(searchResult.title.replace(/ /g, '_'))}`,
                extract: extract,
                snippet: cleanSnippet,
                thumbnail: pageDetails.thumbnail?.source || null,
                image: pageDetails.original?.source || null,
                size: searchResult.size,
                wordcount: searchResult.wordcount,
                timestamp: searchResult.timestamp,
                language: language
            };
        });

        // 캐시에 저장
        searchCache.set(cacheKey, {
            data: formattedResults,
            timestamp: Date.now()
        });

        // 캐시 크기 관리 (최대 1000개 항목)
        if (searchCache.size > 1000) {
            const oldestKey = searchCache.keys().next().value;
            searchCache.delete(oldestKey);
        }

        console.log(`[searchModel] Wikipedia search completed: ${formattedResults.length} results for "${query}"`);
        return formattedResults;

    } catch (error) {
        console.error(`[searchModel] Wikipedia API error:`, error.message);
        
        // 네트워크 오류 시 캐시된 오래된 결과라도 반환 시도
        if (searchCache.has(cacheKey)) {
            console.log(`[searchModel] Returning stale cached result due to error`);
            return searchCache.get(cacheKey).data;
        }
        
        throw error;
    }
}

/**
 * 캐시 통계 조회 (디버깅용)
 */
function getCacheStats() {
    return {
        size: searchCache.size,
        keys: Array.from(searchCache.keys()).slice(0, 10) // 최근 10개만
    };
}

/**
 * 캐시 초기화 (필요시)
 */
function clearCache() {
    searchCache.clear();
    console.log('[searchModel] Cache cleared');
}

module.exports = {
    searchWikipedia,
    getCacheStats,
    clearCache
};
