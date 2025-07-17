// controllers/searchController.js
const {
  createController,
  createExternalApiController
} = require("../utils/serviceFactory");
const searchService = require("../services/searchService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const config = require("../config");

// =========================
// 🔍 검색 기능 (Search Functions)
// =========================

/**
 * 위키피디아 검색 컨트롤러 - ServiceFactory 패턴 적용
 * GET /api/search/wikipedia?q=검색어&limit=10&language=ko
 */
const searchWikipediaController = createExternalApiController(
  searchService.searchWikipediaService,
  {
    dataExtractor: (req) => {
      const { q: query, limit = config.wikipedia.maxResults, language = config.wikipedia.defaultLanguage } = req.query;
      const limitNum = parseInt(limit, 10);
      return [query, limitNum, language];
    },
    validations: [
      (req) => {
        const { q, query, limit, language } = req.query;
        
        // q 또는 query 파라미터 중 하나는 필수
        const searchQuery = q || query;
        if (!searchQuery || searchQuery.trim().length === 0) {
          const err = new Error("Search query is required.");
          err.code = "INVALID_INPUT";
          err.details = "Query parameter 'q' or 'query' cannot be empty.";
          throw err;
        }
        
        // 쿼리 길이 제한
        if (searchQuery.length > 500) {
          const err = new Error("Search query is too long (max 500 characters).");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // req.query에 정규화된 query 설정
        req.query.q = searchQuery;
        
        // 제한 개수 유효성 검사
        const limitNum = parseInt(limit, 10);
        if (limit && (isNaN(limitNum) || limitNum < 1 || limitNum > 50)) {
          const err = new Error("Limit must be a number between 1 and 50.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 언어 코드 검증 제거 - 사용자가 원하는 언어로 검색 가능
        // (만우절 특별 언어도 허용 🎉)
      }
    ],
    responseTransformer: (results, req) => {
      const { q: query, limit, language = config.wikipedia.defaultLanguage } = req.query;
      const limitNum = parseInt(limit, 10) || config.wikipedia.maxResults;
      
      return {
        query: query,
        language: language,
        limit: limitNum,
        results: results,
        total_found: results.length,
        message: "Wikipedia search completed successfully"
      };
    },
    errorHandler: async (error, req, res, next) => {
      // 외부 API 에러 특별 처리
      error.code = error.code || "EXTERNAL_API_ERROR";
      if (error.message.includes("timeout")) error.code = "REQUEST_TIMEOUT";
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") error.code = "SERVICE_UNAVAILABLE";
      throw error;
    },
    errorContext: 'wikipedia_search'
  }
);

/**
 * 날씨 검색 컨트롤러 - ServiceFactory 패턴 적용
 * GET /api/search/weather?units=metric&lang=ko
 */
const searchWeatherController = createController(
  searchService.getWeatherByIPService,
  {
    dataExtractor: (req) => {
      const clientIP = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
      return [clientIP];
    },
    validations: [
      (req) => {
        const { units, lang, lat, lon } = req.query;
        
        // 단위 유효성 검사
        const validUnits = ["metric", "imperial", "standard"];
        if (units && !validUnits.includes(units)) {
          const err = new Error(`Invalid units: ${units}. Supported: ${validUnits.join(", ")}`);
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 좌표 유효성 검사
        if (lat && lon) {
          const latitude = parseFloat(lat);
          const longitude = parseFloat(lon);
          if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            const err = new Error("Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.");
            err.code = "INVALID_INPUT";
            throw err;
          }
        }
      }
    ],
    responseTransformer: (weatherData, req) => {
      const { units = "metric", lang = 'ko' } = req.query;
      
      return {
        location: weatherData.location,
        current: weatherData.current,
        forecast: weatherData.forecast,
        units: units,
        language: lang,
        timestamp: new Date().toISOString(),
        ip_detected_info: weatherData.ip_detected,
        message: "Weather data retrieved successfully"
      };
    },
    errorHandler: async (error, req, res, next) => {
      // 날씨 API 에러 특별 처리
      error.code = error.code || "EXTERNAL_API_ERROR";
      if (error.message.includes("timeout")) error.code = "REQUEST_TIMEOUT";
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") error.code = "SERVICE_UNAVAILABLE";
      throw error;
    },
    errorContext: 'weather_search'
  }
);

/**
 * 뉴스 검색 컨트롤러 - ServiceFactory 패턴 적용
 * GET /api/search/news?q=검색어&limit=10
 */
const searchNewsController = createController(
  searchService.searchNewsService,
  {
    dataExtractor: (req) => {
      const { q: query, limit = 10 } = req.query;
      const options = { limit: parseInt(limit, 10) };
      return [query, options];
    },
    validations: [
      (req) => {
        const { q: query } = req.query;
        if (!query || query.trim().length === 0) {
          const err = new Error("Search query is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'news_search'
  }
);

/**
 * 일반 검색 컨트롤러 - ServiceFactory 패턴 적용
 * GET /api/search/general?q=검색어&type=web
 */
const generalSearchController = createController(
  searchService.generalSearchService,
  {
    dataExtractor: (req) => {
      const { q: query, type = 'web', limit = 10 } = req.query;
      const options = { type, limit: parseInt(limit, 10) };
      return [query, options];
    },
    validations: [
      (req) => {
        const { q: query } = req.query;
        if (!query || query.trim().length === 0) {
          const err = new Error("Search query is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'general_search'
  }
);

module.exports = {
  searchWikipediaController,
  searchWeatherController,
  searchNewsController,
  generalSearchController,
};
