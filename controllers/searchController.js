// controllers/searchController.js
const { searchWikipedia, getWeatherByIP } = require("../models/search");
const { standardizeApiResponse } = require("../utils/apiResponse");
const config = require("../config"); // 설정값 사용을 위해 추가

/**
 * 위키피디아 검색 컨트롤러
 * GET /api/search/wikipedia?q=검색어&limit=10&language=ko
 */
async function searchWikipediaController(req, res, next) { // next 추가
  try {
    const { q: query, limit = config.wikipedia.maxResults, language = config.wikipedia.defaultLanguage } = req.query;

    if (!query || query.trim().length === 0) {
      const err = new Error("Search query is required.");
      err.code = "INVALID_INPUT";
      err.details = "Query parameter 'q' cannot be empty.";
      return next(err);
    }
    if (query.length > 500) { // 예시: 최대 길이 제한
      const err = new Error("Search query is too long (max 500 characters).");
      err.code = "INVALID_INPUT";
      return next(err);
    }

    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) { // 최대 50개로 제한
      const err = new Error("Limit must be a number between 1 and 50.");
      err.code = "INVALID_INPUT";
      return next(err);
    }

    // 언어 코드 유효성 검사 (config 또는 별도 유틸리티에서 관리 가능)
    const validLanguages = config.wikipedia.supportedLanguages || ["ko", "en", "ja", "zh", "fr", "de", "es", "ru"];
    if (!validLanguages.includes(language)) {
      const err = new Error(`Unsupported language: ${language}. Supported: ${validLanguages.join(", ")}`);
      err.code = "INVALID_INPUT";
      return next(err);
    }

    // console.log 제거 또는 logger 사용
    const results = await searchWikipedia(query, limitNum, language);

    const responsePayload = {
        query: query,
        language: language,
        limit: limitNum,
        results: results,
        total_found: results.length,
        message: "Wikipedia search completed successfully"
    };
    const apiResponse = standardizeApiResponse(responsePayload);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    // 모델에서 발생한 특정 에러 코드(예: TIMEOUT, SERVICE_UNAVAILABLE)를 그대로 사용하거나,
    // 여기서 새로운 에러 코드로 매핑할 수 있음.
    // 중앙 에러 핸들러가 HTTP 상태 코드를 결정하므로, 여기서는 에러 객체만 잘 전달.
    error.code = error.code || "EXTERNAL_API_ERROR"; // 기본 외부 API 에러 코드
    if (error.message.includes("timeout")) error.code = "REQUEST_TIMEOUT";
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") error.code = "SERVICE_UNAVAILABLE";

    next(error); // 중앙 에러 핸들러로 전달
  }
}

/**
 * 날씨 검색 컨트롤러 - IP 기반 위치 자동 감지
 * GET /api/search/weather?units=metric&lang=ko
 */
async function searchWeatherController(req, res, next) { // next 추가
  try {
    const { units = "metric", lang = (config.weather.supportedLanguages?.includes(req.query.lang) ? req.query.lang : 'ko'), city, lat, lon } = req.query;

    const clientIP = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;

    const validUnits = ["metric", "imperial", "standard"]; // OpenWeatherMap은 'kelvin' 대신 'standard'
    if (!validUnits.includes(units)) {
      const err = new Error(`Invalid units: ${units}. Supported: ${validUnits.join(", ")}`);
      err.code = "INVALID_INPUT";
      return next(err);
    }

    // 언어 코드 유효성 검사 (config 또는 별도 유틸리티에서 관리 가능)
    // const validWeatherLanguages = config.weather.supportedLanguages || ["ko", "en", "ja", "zh", "fr", "de", "es", "ru"];
    // if (!validWeatherLanguages.includes(lang)) {
    //   const err = new Error(`Unsupported language for weather: ${lang}. Supported: ${validWeatherLanguages.join(", ")}`);
    //   err.code = "INVALID_INPUT";
    //   return next(err);
    // } // 위에서 기본값 처리로 변경

    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        const err = new Error("Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.");
        err.code = "INVALID_INPUT";
        return next(err);
      }
    }

    const weatherData = await getWeatherByIP(clientIP, { units, lang, city, lat, lon });

    const responsePayload = {
        location: weatherData.location,
        current: weatherData.current,
        forecast: weatherData.forecast, // 모델에서 이미 필요한 만큼 가공되었다고 가정
        units: units,
        language: lang,
        timestamp: new Date().toISOString(),
        ip_detected_info: weatherData.ip_detected, // 필드명 변경 또는 유지
        message: "Weather data retrieved successfully"
    };
    const apiResponse = standardizeApiResponse(responsePayload);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    // 모델에서 발생한 특정 에러 코드(예: LOCATION_NOT_FOUND, INVALID_API_KEY)를 그대로 사용.
    error.code = error.code || "EXTERNAL_API_ERROR";
    if (error.message.includes("timeout")) error.code = "REQUEST_TIMEOUT";
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") error.code = "SERVICE_UNAVAILABLE";

    next(error);
  }
}

module.exports = {
  searchWikipediaController,
  searchWeatherController,
};
