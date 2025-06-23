// controllers/searchController.js
const { searchWikipedia, getWeatherByIP } = require("../models/search");
const { createSearchApiResponse } = require("../utils/apiResponse");

/**
 * 위키피디아 검색 컨트롤러
 * GET /api/search/wikipedia?q=검색어&limit=10&language=ko
 */
async function searchWikipediaController(req, res) {
  try {
    const { q: query, limit = 10, language = "ko" } = req.query;
    // 검색어 유효성 검사
    if (!query || query.trim().length === 0) {
      return res
        .status(400)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Search query is required",
            "MISSING_QUERY"
          )
        );
    }

    // 검색어 길이 제한 (너무 긴 검색어 방지)
    if (query.length > 500) {
      return res
        .status(400)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Search query is too long (max 500 characters)",
            "QUERY_TOO_LONG"
          )
        );
    }

    // limit 유효성 검사
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res
        .status(400)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Limit must be a number between 1 and 50",
            "INVALID_LIMIT"
          )
        );
    }

    // 언어 코드 유효성 검사 (간단한 검사)
    const validLanguages = ["ko", "en", "ja", "zh", "fr", "de", "es", "ru"];
    if (!validLanguages.includes(language)) {
      return res
        .status(400)
        .json(
          createSearchApiResponse(
            false,
            null,
            `Unsupported language: ${language}. Supported: ${validLanguages.join(
              ", "
            )}`,
            "INVALID_LANGUAGE"
          )
        );
    }

    console.log(
      `[searchController] Searching Wikipedia: query="${query}", limit=${limitNum}, language=${language}`
    );

    // 위키피디아 검색 실행
    const results = await searchWikipedia(query, limitNum, language);

    console.log(
      `[searchController] Wikipedia search completed: ${results.length} results found`
    ); // 성공 응답
    return res.status(200).json(
      createSearchApiResponse(
        true,
        {
          query: query,
          language: language,
          limit: limitNum,
          results: results,
          total_found: results.length,
        },
        "Wikipedia search completed successfully"
      )
    );
  } catch (error) {
    console.error("[searchController] Wikipedia search error:", error);

    // 타임아웃 에러 처리
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return res
        .status(408)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Wikipedia search request timed out",
            "REQUEST_TIMEOUT"
          )
        );
    }

    // 네트워크 에러 처리
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res
        .status(503)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Wikipedia service is currently unavailable",
            "SERVICE_UNAVAILABLE"
          )
        );
    }

    // 위키피디아 API 에러 처리
    if (error.status >= 400 && error.status < 500) {
      return res
        .status(error.status)
        .json(
          createSearchApiResponse(
            false,
            null,
            error.message || "Wikipedia API error",
            "WIKIPEDIA_API_ERROR"
          )
        );
    }

    // 일반적인 서버 에러
    return res
      .status(500)
      .json(
        createSearchApiResponse(
          false,
          null,
          "Internal server error during Wikipedia search",
          "INTERNAL_SERVER_ERROR"
        )
      );
  }
}

/**
 * 날씨 검색 컨트롤러 - IP 기반 위치 자동 감지
 * GET /api/search/weather?units=metric&lang=ko
 */
async function searchWeatherController(req, res) {
  try {
    const { units = "metric", lang = "ko", city, lat, lon } = req.query;

    // 클라이언트 IP 주소 추출 (프록시 고려)
    const clientIP =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      req.ip;

    console.log(
      `[searchController] Weather search requested from IP: ${clientIP}`
    );

    // units 유효성 검사
    const validUnits = ["metric", "imperial", "kelvin"];
    if (!validUnits.includes(units)) {
      return res
        .status(400)
        .json(
          createSearchApiResponse(
            false,
            null,
            `Invalid units: ${units}. Supported: ${validUnits.join(", ")}`,
            "INVALID_UNITS"
          )
        );
    }

    // 언어 코드 유효성 검사
    const validLanguages = ["ko", "en", "ja", "zh", "fr", "de", "es", "ru"];
    if (!validLanguages.includes(lang)) {
      return res
        .status(400)
        .json(
          createSearchApiResponse(
            false,
            null,
            `Unsupported language: ${lang}. Supported: ${validLanguages.join(
              ", "
            )}`,
            "INVALID_LANGUAGE"
          )
        );
    }

    // 좌표가 직접 제공된 경우 유효성 검사
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res
          .status(400)
          .json(
            createSearchApiResponse(
              false,
              null,
              "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180",
              "INVALID_COORDINATES"
            )
          );
      }
    }

    console.log(
      `[searchController] Getting weather: units=${units}, lang=${lang}, city=${
        city || "auto"
      }`
    );

    // 날씨 정보 조회
    const weatherData = await getWeatherByIP(clientIP, {
      units,
      lang,
      city,
      lat,
      lon,
    });

    console.log(
      `[searchController] Weather data retrieved successfully for location: ${
        weatherData.location?.name || "Unknown"
      }`
    );

    // 성공 응답
    return res.status(200).json(
      createSearchApiResponse(
        true,
        {
          location: weatherData.location,
          current: weatherData.current,
          forecast: weatherData.forecast,
          units: units,
          language: lang,
          timestamp: new Date().toISOString(),
          ip_detected: weatherData.ip_detected,
        },
        "Weather data retrieved successfully"
      )
    );
  } catch (error) {
    console.error("[searchController] Weather search error:", error);

    // 위치 정보 에러 처리
    if (error.code === "LOCATION_NOT_FOUND") {
      return res
        .status(404)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Location not found. Please provide city name or coordinates",
            "LOCATION_NOT_FOUND"
          )
        );
    }

    // API 키 에러 처리
    if (error.code === "INVALID_API_KEY") {
      return res
        .status(503)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Weather service is temporarily unavailable",
            "SERVICE_UNAVAILABLE"
          )
        );
    }

    // 타임아웃 에러 처리
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return res
        .status(408)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Weather service request timed out",
            "REQUEST_TIMEOUT"
          )
        );
    }

    // 네트워크 에러 처리
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res
        .status(503)
        .json(
          createSearchApiResponse(
            false,
            null,
            "Weather service is currently unavailable",
            "SERVICE_UNAVAILABLE"
          )
        );
    }

    // 외부 API 에러 처리
    if (error.status >= 400 && error.status < 500) {
      return res
        .status(error.status)
        .json(
          createSearchApiResponse(
            false,
            null,
            error.message || "Weather API error",
            "WEATHER_API_ERROR"
          )
        );
    }

    // 일반적인 서버 에러
    return res
      .status(500)
      .json(
        createSearchApiResponse(
          false,
          null,
          "Internal server error during weather search",
          "INTERNAL_SERVER_ERROR"
        )
      );
  }
}

module.exports = {
  searchWikipediaController,
  searchWeatherController,
};
