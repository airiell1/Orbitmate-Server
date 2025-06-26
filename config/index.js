require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  testPagePassword: process.env.TEST_PAGE_PASSWORD,

  // Database Configuration
  database: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 10,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    poolIncrement: parseInt(process.env.DB_POOL_INCREMENT, 10) || 0,
    oracleClientLibDir: process.env.ORACLE_CLIENT_LIB_DIR || null, // 기본값 null
    thickModeRequired: process.env.THICK_MODE_REQUIRED === 'true', // 명시적으로 true일 때만
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'verysecretkey', // 실제 운영에서는 강력한 키 사용
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  // AI Provider Configuration
  ai: {
    defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'geminiapi',
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      defaultModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-thinking-exp-01-21',
      // 추가적인 Gemini 설정 가능
    },
    ollama: {
      apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434/api/chat',
      defaultModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
      // 추가적인 Ollama 설정 가능
    },
    vertexAi: {
      projectId: process.env.GOOGLE_PROJECT_ID,
      applicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      location: process.env.VERTEX_AI_LOCATION || 'global', // 기본값 global
      defaultModel: process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25',
      // 추가적인 Vertex AI 설정 가능
    },
  },

  // Wikipedia API Configuration
  wikipedia: {
    apiBaseUrl: process.env.WIKIPEDIA_API_BASE_URL || 'https://ko.wikipedia.org/api/rest_v1',
    searchApiUrl: process.env.WIKIPEDIA_SEARCH_API_URL || 'https://ko.wikipedia.org/w/api.php',
    defaultLanguage: process.env.WIKIPEDIA_DEFAULT_LANGUAGE || 'ko',
    fallbackLanguage: process.env.WIKIPEDIA_FALLBACK_LANGUAGE || 'en',
    requestTimeout: parseInt(process.env.WIKIPEDIA_REQUEST_TIMEOUT, 10) || 5000,
    maxResults: parseInt(process.env.WIKIPEDIA_MAX_RESULTS, 10) || 10,
    cacheDuration: parseInt(process.env.WIKIPEDIA_CACHE_DURATION, 10) || 3600, // seconds
  },

  // Geocoding (used by weather search if city name is provided)
  geocoding: {
    cacheDuration: parseInt(process.env.GEOCODING_CACHE_DURATION, 10) || 86400, // seconds
  },

  // Geolocation (IP based)
  geolocation: {
    cacheDuration: parseInt(process.env.GEOLOCATION_CACHE_DURATION, 10) || 3600, // seconds
    requestTimeout: parseInt(process.env.GEOLOCATION_REQUEST_TIMEOUT, 10) || 5000,
  },

  // OpenWeather API Configuration
  weather: {
    apiKey: process.env.OPENWEATHER_API_KEY,
    cacheDuration: parseInt(process.env.WEATHER_CACHE_DURATION, 10) || 1800, // seconds
    requestTimeout: parseInt(process.env.WEATHER_REQUEST_TIMEOUT, 10) || 5000,
  },

  // External API Keys (Naver, Kakao - currently dummy)
  externalApis: {
    naver: {
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
    },
    kakao: {
      apiKey: process.env.KAKAO_API_KEY,
    },
  },

  // User Settings Configuration
  userSettings: {
    allowedThemes: ['light', 'dark', 'auto'],
    supportedLanguages: ['ko', 'en', 'ja', 'zh'],
    fontSizeRange: { min: 10, max: 30 },
    allowedAiProviders: ['geminiapi', 'vertexai', 'ollama'],
  },
};

// 개발 환경에서는 일부 설정을 하드코딩하거나 기본값을 사용할 수 있도록 함
if (config.nodeEnv === 'development') {
  // 예: 개발용 JWT 시크릿 명시적 설정
  if (!config.jwt.secret || config.jwt.secret === 'secret') {
    // console.warn("개발 환경에서 JWT 시크릿이 기본값('secret')으로 설정되어 있습니다. 프로덕션에서는 반드시 변경하세요.");
  }
  // 개발용 DB 설정을 다르게 하고 싶다면 여기에 추가
}

// 프로덕션 환경에서는 필수 환경 변수 누락 시 에러 발생 또는 경고
if (config.nodeEnv === 'production') {
  const requiredEnvVars = [
    'DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING', 'JWT_SECRET',
    // AI Provider에 따라 필수 키 추가 (예: GEMINI_API_KEY if defaultProvider is gemini)
  ];
  if (config.ai.defaultProvider === 'geminiapi' && !config.ai.gemini.apiKey) {
    requiredEnvVars.push('GEMINI_API_KEY (if default AI provider is Gemini)');
  }
  // ... 다른 AI 제공자 키도 유사하게 추가

  for (const envVar of requiredEnvVars) {
    // process.env에 직접 접근하는 대신, config 객체를 통해 확인
    const path = envVar.split('.'); // 예: 'database.user'
    let value = config;
    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        // 환경변수 이름에 .이 없는 경우 (예: JWT_SECRET)
        value = config[envVar.split(' ')[0]]; // 'JWT_SECRET (if ...)' 같은 경우 대비
        break;
      }
    }
    if (!value) {
      // console.error(`프로덕션 환경 필수 환경 변수 누락: ${envVar}`);
      // process.exit(1); // 또는 throw new Error(...)
    }
  }
}

module.exports = config;
