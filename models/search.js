// models/search.js
const axios = require("axios");

// 메모리 캐시 (간단한 구현)
const searchCache = new Map();

/**
 * 위키피디아 검색 함수
 * @param {string} query - 검색어
 * @param {number} limit - 결과 개수 제한
 * @param {string} language - 언어 코드 (ko, en 등)
 * @returns {Promise<Array>} 검색 결과 배열
 */
async function searchWikipedia(query, limit = 10, language = "ko") {
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
    console.log(
      `[searchModel] Fetching from Wikipedia API: ${language}.wikipedia.org`
    );

    // 1단계: 검색어로 페이지 제목들 찾기
    const searchUrl = `https://${language}.wikipedia.org/w/api.php`;
    const searchParams = {
      action: "query",
      format: "json",
      list: "search",
      srsearch: query,
      srlimit: Math.min(limit * 2, 50), // 더 많이 가져와서 필터링
      srprop: "snippet|titlesnippet|size|wordcount|timestamp",
      utf8: 1, // UTF-8 인코딩 명시
      origin: "*" // CORS 허용
    };

    console.log(`[searchModel] Request URL: ${searchUrl}`);
    console.log(`[searchModel] Request params:`, searchParams);

    const searchResponse = await axios.get(searchUrl, {
      params: searchParams,
      timeout: parseInt(process.env.WIKIPEDIA_REQUEST_TIMEOUT) || 10000, // 타임아웃 증가
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br"
      },
    });

    console.log(`[searchModel] Wikipedia API response:`, {
      url: searchResponse.config.url,
      status: searchResponse.status,
      query: searchResponse.data.query,
      searchResultsCount: searchResponse.data.query?.search?.length || 0
    });

    const searchResults = searchResponse.data.query?.search || [];

    if (searchResults.length === 0) {
      // 한국어에서 결과가 없으면 영어로 재시도 (원본 검색어 그대로)
      if (language === "ko") {
        const fallbackLanguage =
          process.env.WIKIPEDIA_FALLBACK_LANGUAGE || "en";
        console.log(
          `[searchModel] No results in Korean, trying ${fallbackLanguage} with original query`
        );
        return await searchWikipedia(query, limit, fallbackLanguage);
      }
      console.log(`[searchModel] No results found for query: "${query}" in language: ${language}`);
      return [];
    }

    // 2단계: 상위 결과들의 상세 정보 가져오기
    const pageIds = searchResults
      .slice(0, limit)
      .map((result) => result.pageid);
    const detailsUrl = `https://${language}.wikipedia.org/w/api.php`;
    const detailsParams = {
      action: "query",
      format: "json",
      prop: "extracts|pageimages|info",
      pageids: pageIds.join("|"),
      exintro: true,
      explaintext: true,
      exsectionformat: "plain",
      piprop: "thumbnail|original",
      pithumbsize: 300,
      inprop: "url",
      utf8: 1,
      origin: "*"
    };

    const detailsResponse = await axios.get(detailsUrl, {
      params: detailsParams,
      timeout: parseInt(process.env.WIKIPEDIA_REQUEST_TIMEOUT) || 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br"
      },
    });

    const pages = detailsResponse.data.query?.pages || {};

    // 3단계: 결과 포맷팅
    const formattedResults = searchResults
      .slice(0, limit)
      .map((searchResult) => {
        const pageDetails = pages[searchResult.pageid] || {};

        // 스니펫에서 HTML 태그 제거
        const cleanSnippet = searchResult.snippet
          ? searchResult.snippet
              .replace(/<[^>]*>/g, "")
              .replace(/&[^;]+;/g, " ")
              .trim()
          : "";

        // 추출문에서 너무 긴 내용 요약
        let extract = pageDetails.extract || cleanSnippet || "";
        if (extract.length > 500) {
          extract = extract.substring(0, 500) + "...";
        }

        return {
          title: searchResult.title,
          pageid: searchResult.pageid,
          url:
            pageDetails.fullurl ||
            `https://${language}.wikipedia.org/wiki/${encodeURIComponent(
              searchResult.title.replace(/ /g, "_")
            )}`,
          extract: extract,
          snippet: cleanSnippet,
          thumbnail: pageDetails.thumbnail?.source || null,
          image: pageDetails.original?.source || null,
          size: searchResult.size,
          wordcount: searchResult.wordcount,
          timestamp: searchResult.timestamp,
          language: language,
        };
      });

    // 캐시에 저장
    searchCache.set(cacheKey, {
      data: formattedResults,
      timestamp: Date.now(),
    });

    // 캐시 크기 관리 (최대 1000개 항목)
    if (searchCache.size > 1000) {
      const oldestKey = searchCache.keys().next().value;
      searchCache.delete(oldestKey);
    }

    console.log(
      `[searchModel] Wikipedia search completed: ${formattedResults.length} results for "${query}"`
    );
    return formattedResults;
  } catch (error) {
    console.error(`[searchModel] Wikipedia API error for "${query}" (${language}):`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      params: error.config?.params
    });

    // 네트워크 오류 시 캐시된 오래된 결과라도 반환 시도
    if (searchCache.has(cacheKey)) {
      console.log(`[searchModel] Returning stale cached result due to error`);
      return searchCache.get(cacheKey).data;
    }

    // 한국어에서 에러가 발생하면 영어로 재시도 (한 번만)
    if (language === "ko") {
      console.log(`[searchModel] Error in Korean, attempting English fallback`);
      try {
        return await searchWikipedia(query, limit, "en");
      } catch (fallbackError) {
        console.error(`[searchModel] Fallback to English also failed:`, fallbackError.message);
      }
    }

    // 최종적으로 빈 배열 반환 (에러를 throw하지 않음)
    console.log(`[searchModel] Returning empty results due to persistent errors`);
    return [];
  }
}

/**
 * IP 주소를 기반으로 위치 정보 조회
 * @param {string} ip - 클라이언트 IP 주소
 * @returns {Promise<Object>} 위치 정보 객체
 */
async function getLocationByIP(ip) {
  const cacheKey = `location:${ip}`;
  const cacheDuration =
    parseInt(process.env.GEOLOCATION_CACHE_DURATION) || 3600; // 1시간

  // 로컬호스트 IP 처리
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    console.log(
      `[searchModel] Local IP detected (${ip}), using default location (Seoul)`
    );
    return {
      ip: ip,
      country: "KR",
      country_name: "South Korea",
      region: "Seoul",
      city: "Seoul",
      latitude: 37.5665,
      longitude: 126.978,
      timezone: "Asia/Seoul",
      is_local: true,
    };
  }

  // 캐시 확인
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    if (now - cached.timestamp < cacheDuration * 1000) {
      console.log(`[searchModel] Using cached location for IP: ${ip}`);
      return cached.data;
    } else {
      searchCache.delete(cacheKey);
    }
  }

  try {
    console.log(`[searchModel] Fetching location for IP: ${ip}`);

    // ipapi.co 무료 서비스 사용 (월 1000회 제한)
    const response = await axios.get(`https://ipapi.co/${ip}/json/`, {
      timeout: parseInt(process.env.GEOLOCATION_REQUEST_TIMEOUT) || 5000,
      headers: {
        "User-Agent":
          "Orbitmate/1.0 (https://orbitmate.com; contact@orbitmate.com)",
      },
    });

    const data = response.data;

    if (data.error) {
      console.warn(`[searchModel] IP geolocation error: ${data.reason}`);
      throw new Error(`IP geolocation failed: ${data.reason}`);
    }

    const locationData = {
      ip: data.ip,
      country: data.country_code,
      country_name: data.country_name,
      region: data.region,
      city: data.city,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      timezone: data.timezone,
      is_local: false,
    };

    // 결과 캐싱
    searchCache.set(cacheKey, {
      data: locationData,
      timestamp: Date.now(),
    });

    console.log(
      `[searchModel] Location found: ${data.city}, ${data.country_name}`
    );
    return locationData;
  } catch (error) {
    console.error(
      `[searchModel] IP geolocation error for ${ip}:`,
      error.message
    );

    // 대체 서비스 시도 (ip-api.com - 무료, 월 1000회)
    try {
      console.log(
        `[searchModel] Trying fallback geolocation service for IP: ${ip}`
      );
      const fallbackResponse = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 3000,
        headers: {
          "User-Agent": "Orbitmate/1.0",
        },
      });

      const fallbackData = fallbackResponse.data;

      if (fallbackData.status === "fail") {
        throw new Error(`Fallback geolocation failed: ${fallbackData.message}`);
      }

      const locationData = {
        ip: fallbackData.query,
        country: fallbackData.countryCode,
        country_name: fallbackData.country,
        region: fallbackData.regionName,
        city: fallbackData.city,
        latitude: fallbackData.lat,
        longitude: fallbackData.lon,
        timezone: fallbackData.timezone,
        is_local: false,
      };

      // 결과 캐싱
      searchCache.set(cacheKey, {
        data: locationData,
        timestamp: Date.now(),
      });

      console.log(
        `[searchModel] Fallback location found: ${fallbackData.city}, ${fallbackData.country}`
      );
      return locationData;
    } catch (fallbackError) {
      console.error(
        `[searchModel] Fallback geolocation also failed:`,
        fallbackError.message
      );

      // 모든 지리적 위치 서비스가 실패한 경우 서울을 기본값으로 사용
      return {
        ip: ip,
        country: "KR",
        country_name: "South Korea",
        region: "Seoul",
        city: "Seoul",
        latitude: 37.5665,
        longitude: 126.978,
        timezone: "Asia/Seoul",
        is_local: false,
        fallback: true,
      };
    }
  }
}

/**
 * 좌표를 기반으로 날씨 정보 조회
 * @param {number} lat - 위도
 * @param {number} lon - 경도
 * @param {Object} options - 옵션 (units, lang)
 * @returns {Promise<Object>} 날씨 정보
 */
async function getWeatherByCoordinates(lat, lon, options = {}) {
  const { units = "metric", lang = "ko" } = options;
  const cacheKey = `weather:${lat},${lon}:${units}:${lang}`;
  const cacheDuration = parseInt(process.env.WEATHER_CACHE_DURATION) || 1800; // 30분

  // 캐시 확인
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    if (now - cached.timestamp < cacheDuration * 1000) {
      console.log(
        `[searchModel] Using cached weather for coordinates: ${lat}, ${lon}`
      );
      return cached.data;
    } else {
      searchCache.delete(cacheKey);
    }
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw {
        code: "INVALID_API_KEY",
        message: "OpenWeatherMap API key not configured",
      };
    }

    console.log(
      `[searchModel] Fetching weather for coordinates: ${lat}, ${lon}`
    );

    // 현재 날씨 조회
    const currentWeatherUrl = "https://api.openweathermap.org/data/2.5/weather";
    const currentParams = {
      lat: lat,
      lon: lon,
      appid: apiKey,
      units: units,
      lang: lang,
    };

    const currentResponse = await axios.get(currentWeatherUrl, {
      params: currentParams,
      timeout: parseInt(process.env.WEATHER_REQUEST_TIMEOUT) || 5000,
      headers: {
        "User-Agent":
          "Orbitmate/1.0 (https://orbitmate.com; contact@orbitmate.com)",
      },
    });

    // 5일 예보 조회
    const forecastUrl = "https://api.openweathermap.org/data/2.5/forecast";
    const forecastParams = {
      lat: lat,
      lon: lon,
      appid: apiKey,
      units: units,
      lang: lang,
    };

    const forecastResponse = await axios.get(forecastUrl, {
      params: forecastParams,
      timeout: parseInt(process.env.WEATHER_REQUEST_TIMEOUT) || 5000,
      headers: {
        "User-Agent": "Orbitmate/1.0",
      },
    });

    const currentData = currentResponse.data;
    const forecastData = forecastResponse.data;

    // 데이터 가공
    const weatherData = {
      location: {
        name: currentData.name,
        country: currentData.sys.country,
        coordinates: {
          latitude: currentData.coord.lat,
          longitude: currentData.coord.lon,
        },
        timezone: currentData.timezone,
      },
      current: {
        temperature: Math.round(currentData.main.temp),
        feels_like: Math.round(currentData.main.feels_like),
        description: currentData.weather[0].description,
        main: currentData.weather[0].main,
        icon: currentData.weather[0].icon,
        humidity: currentData.main.humidity,
        pressure: currentData.main.pressure,
        visibility: currentData.visibility,
        wind: {
          speed: currentData.wind.speed,
          direction: currentData.wind.deg,
        },
        clouds: currentData.clouds.all,
        sunrise: new Date(currentData.sys.sunrise * 1000).toISOString(),
        sunset: new Date(currentData.sys.sunset * 1000).toISOString(),
        timestamp: new Date(currentData.dt * 1000).toISOString(),
      },
      forecast: forecastData.list.slice(0, 8).map((item) => ({
        datetime: new Date(item.dt * 1000).toISOString(),
        temperature: {
          current: Math.round(item.main.temp),
          min: Math.round(item.main.temp_min),
          max: Math.round(item.main.temp_max),
        },
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        wind_speed: item.wind.speed,
        clouds: item.clouds.all,
        rain: item.rain ? item.rain["3h"] : 0,
      })),
    };

    // 결과 캐싱
    searchCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now(),
    });

    console.log(
      `[searchModel] Weather data retrieved for: ${weatherData.location.name}`
    );
    return weatherData;
  } catch (error) {
    console.error(
      `[searchModel] Weather API error:`,
      error.response?.data || error.message
    );

    if (error.response?.status === 401) {
      throw {
        code: "INVALID_API_KEY",
        message: "Invalid OpenWeatherMap API key",
      };
    }

    if (error.response?.status === 404) {
      throw {
        code: "LOCATION_NOT_FOUND",
        message: "Weather data not found for this location",
      };
    }

    throw error;
  }
}

/**
 * IP 주소를 기반으로 날씨 정보 조회 (메인 함수)
 * @param {string} ip - 클라이언트 IP 주소
 * @param {Object} options - 옵션 (units, lang, city, lat, lon)
 * @returns {Promise<Object>} 날씨 정보
 */
async function getWeatherByIP(ip, options = {}) {
  const { units = "metric", lang = "ko", city, lat, lon } = options;

  try {
    let location;
    let coordinates;

    // 직접 좌표가 제공된 경우
    if (lat && lon) {
      coordinates = { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      console.log(`[searchModel] Using provided coordinates: ${lat}, ${lon}`);
    }
    // 도시명이 제공된 경우
    else if (city) {
      console.log(`[searchModel] Geocoding city: ${city}`);
      coordinates = await geocodeCity(city);
    }
    // IP 기반 위치 감지
    else {
      console.log(`[searchModel] Getting location from IP: ${ip}`);
      location = await getLocationByIP(ip);
      coordinates = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }

    // 날씨 정보 조회
    const weatherData = await getWeatherByCoordinates(
      coordinates.latitude,
      coordinates.longitude,
      { units, lang }
    );

    // IP 기반 감지 정보 추가
    if (location) {
      weatherData.ip_detected = {
        ip: location.ip,
        detected_city: location.city,
        detected_country: location.country_name,
        is_local_ip: location.is_local,
        used_fallback: location.fallback || false,
      };
    }

    return weatherData;
  } catch (error) {
    console.error(`[searchModel] Weather search failed:`, error);
    throw error;
  }
}

/**
 * 도시명을 좌표로 변환
 * @param {string} cityName - 도시명
 * @returns {Promise<Object>} 좌표 정보
 */
async function geocodeCity(cityName) {
  const cacheKey = `geocode:${cityName}`;
  const cacheDuration = parseInt(process.env.GEOCODING_CACHE_DURATION) || 86400; // 24시간

  // 캐시 확인
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    const now = Date.now();
    if (now - cached.timestamp < cacheDuration * 1000) {
      console.log(`[searchModel] Using cached geocoding for city: ${cityName}`);
      return cached.data;
    } else {
      searchCache.delete(cacheKey);
    }
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw {
        code: "INVALID_API_KEY",
        message: "OpenWeatherMap API key not configured",
      };
    }

    console.log(`[searchModel] Geocoding city: ${cityName}`);

    const geocodingUrl = "https://api.openweathermap.org/geo/1.0/direct";
    const params = {
      q: cityName,
      limit: 1,
      appid: apiKey,
    };

    const response = await axios.get(geocodingUrl, {
      params: params,
      timeout: parseInt(process.env.WEATHER_REQUEST_TIMEOUT) || 5000,
      headers: {
        "User-Agent": "Orbitmate/1.0",
      },
    });

    if (!response.data || response.data.length === 0) {
      throw {
        code: "LOCATION_NOT_FOUND",
        message: `City not found: ${cityName}`,
      };
    }

    const result = response.data[0];
    const coordinates = {
      latitude: result.lat,
      longitude: result.lon,
      name: result.name,
      country: result.country,
    };

    // 결과 캐싱
    searchCache.set(cacheKey, {
      data: coordinates,
      timestamp: Date.now(),
    });

    console.log(
      `[searchModel] Geocoded ${cityName} to: ${result.lat}, ${result.lon}`
    );
    return coordinates;
  } catch (error) {
    console.error(
      `[searchModel] Geocoding error for ${cityName}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * 캐시 통계 정보 조회
 * @returns {Object} 캐시 통계 (키 개수, 메모리 사용량 등)
 */
function getCacheStats() {
  const stats = {
    totalKeys: searchCache.size,
    keys: Array.from(searchCache.keys()),
    memoryUsage: 0,
  };

  // 대략적인 메모리 사용량 계산
  for (const [key, value] of searchCache) {
    const keySize = Buffer.byteLength(key, "utf8");
    const valueSize = Buffer.byteLength(JSON.stringify(value), "utf8");
    stats.memoryUsage += keySize + valueSize;
  }

  // 만료된 캐시 개수 확인
  const now = Date.now();
  const cacheDuration = parseInt(process.env.WIKIPEDIA_CACHE_DURATION) || 3600;
  let expiredCount = 0;

  for (const [key, cached] of searchCache) {
    if (now - cached.timestamp >= cacheDuration * 1000) {
      expiredCount++;
    }
  }

  stats.expiredKeys = expiredCount;
  stats.cacheHitRate = `Cache contains ${stats.totalKeys} entries, ${expiredCount} expired`;

  return stats;
}

/**
 * 캐시 완전 삭제
 * @returns {Object} 삭제된 캐시 정보
 */
function clearCache() {
  const deletedCount = searchCache.size;
  const deletedKeys = Array.from(searchCache.keys());

  searchCache.clear();

  console.log(`[searchModel] Cleared ${deletedCount} cache entries`);

  return {
    success: true,
    deletedCount: deletedCount,
    deletedKeys: deletedKeys,
    message: `Successfully cleared ${deletedCount} cache entries`,
  };
}

/**
 * 도시명으로 날씨 조회 함수 (AI 도구용)
 * @param {Object} params - 검색 매개변수
 * @param {string} params.city - 도시명
 * @param {string} params.units - 온도 단위 (metric, imperial, kelvin)
 * @param {string} params.lang - 언어 코드
 * @returns {Promise<Object>} 날씨 정보 객체
 */
async function getWeatherByLocation(params) {
  const { city, units = "metric", lang = "ko" } = params;

  try {
    console.log(`[searchModel] Getting weather for city: ${city}`);

    // 도시명으로 좌표 조회
    const coords = await geocodeCity(city);
    if (!coords) {
      throw new Error(`도시를 찾을 수 없습니다: ${city}`);
    }

    // 좌표로 날씨 조회
    const weatherData = await getWeatherByCoordinates(
      coords.latitude,
      coords.longitude,
      { units, lang }
    );

    return {
      ...weatherData,
      location: {
        ...weatherData.location,
        name: coords.name || city,
        country: coords.country,
      },
    };
  } catch (error) {
    console.error(`[searchModel] Error getting weather for ${city}:`, error);
    throw error;
  }
}

module.exports = {
  searchWikipedia,
  getWeatherByIP,
  getLocationByIP,
  getWeatherByCoordinates,
  geocodeCity,
  getCacheStats,
  clearCache,
  getWeatherByLocation,
};
