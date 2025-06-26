// services/searchService.js
const { searchWikipedia, getWeatherByIP } = require("../models/search");

/**
 * Wikipedia 검색 서비스
 */
async function searchWikipediaService(query, limit = 5, language = 'ko') {
  try {
    return await searchWikipedia(query, limit, language);
  } catch (error) {
    const err = new Error(`Wikipedia 검색 중 오류가 발생했습니다: ${error.message}`);
    err.code = "EXTERNAL_API_ERROR";
    throw err;
  }
}

/**
 * 날씨 검색 서비스 (IP 기반)
 */
async function getWeatherByIPService(ip) {
  try {
    return await getWeatherByIP(ip);
  } catch (error) {
    const err = new Error(`날씨 정보 조회 중 오류가 발생했습니다: ${error.message}`);
    err.code = "EXTERNAL_API_ERROR";
    throw err;
  }
}

/**
 * 뉴스 검색 서비스 (플레이스홀더)
 */
async function searchNewsService(query, options = {}) {
  // 현재 뉴스 API가 구현되지 않음
  const err = new Error("뉴스 검색 기능은 현재 구현되지 않았습니다.");
  err.code = "FEATURE_NOT_IMPLEMENTED";
  throw err;
}

/**
 * 일반 검색 서비스 (플레이스홀더)
 */
async function generalSearchService(query, options = {}) {
  // 현재 일반 검색 API가 구현되지 않음
  const err = new Error("일반 검색 기능은 현재 구현되지 않았습니다.");
  err.code = "FEATURE_NOT_IMPLEMENTED";
  throw err;
}

module.exports = {
  searchWikipediaService,
  getWeatherByIPService,
  searchNewsService,
  generalSearchService,
};
