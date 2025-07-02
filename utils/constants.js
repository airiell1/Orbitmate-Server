// utils/constants.js - 시스템 전체에서 사용하는 상수 정의

// =========================
// 🧪 테스트 관련 상수
// =========================

// API 테스트용 고정 ID들 (API 문서에서 테스트 편의성을 위함)
const API_TEST_USER_ID = "API_TEST_USER_ID";
const API_TEST_SESSION_ID = "API_TEST_SESSION_ID";
const API_TEST_USER_MESSAGE_ID = "API_TEST_USER_MESSAGE_ID";
const API_TEST_AI_MESSAGE_ID = "API_TEST_AI_MESSAGE_ID";

// =========================
// 🏆 구독 관련 상수
// =========================

// 구독 등급
const SUBSCRIPTION_TIERS = {
  COMET: 'comet',        // ☄️ 코멧 (무료)
  PLANET: 'planet',      // 🪐 플래닛 (월 1.5만원)
  STAR: 'star',          // ☀️ 스타 (월 15만원)
  GALAXY: 'galaxy'       // 🌌 갤럭시 (기업용 월 300만원)
};

// 구독 등급별 제한
const SUBSCRIPTION_LIMITS = {
  [SUBSCRIPTION_TIERS.COMET]: {
    dailyAiRequests: 30,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    canUseAdvancedFeatures: false
  },
  [SUBSCRIPTION_TIERS.PLANET]: {
    dailyAiRequests: 200,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    canUseAdvancedFeatures: true
  },
  [SUBSCRIPTION_TIERS.STAR]: {
    dailyAiRequests: 2000,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    canUseAdvancedFeatures: true
  },
  [SUBSCRIPTION_TIERS.GALAXY]: {
    dailyAiRequests: -1, // 무제한
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
    canUseAdvancedFeatures: true
  }
};

// =========================
// 🚫 에러 코드 상수
// =========================

const ERROR_CODES = {
  // 일반 에러
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // 인증/인가 에러
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // 리소스 에러
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // 구독/권한 에러
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  
  // 외부 서비스 에러
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  SEARCH_SERVICE_ERROR: 'SEARCH_SERVICE_ERROR',
  
  // 파일 관련 에러
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  
  // 데이터베이스 에러
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR'
};

// =========================
// 🎯 사용자 활동 타입
// =========================

const USER_ACTIVITY_TYPES = {
  BUG_REPORT: 'bug_report',
  FEEDBACK_SUBMISSION: 'feedback_submission',
  TEST_PARTICIPATION: 'test_participation',
  MESSAGE_SENT: 'message_sent',
  SESSION_CREATED: 'session_created',
  FILE_UPLOADED: 'file_uploaded'
};

// =========================
// 🌐 언어 지원
// =========================

const SUPPORTED_LANGUAGES = {
  KOREAN: 'ko',
  ENGLISH: 'en', 
  JAPANESE: 'ja',
  CHINESE: 'zh'
};

// =========================
// 🎨 테마 설정
// =========================

const THEME_OPTIONS = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// =========================
// 📁 파일 업로드 설정
// =========================

const FILE_UPLOAD = {
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword'],
  MAX_FILENAME_LENGTH: 255,
  UPLOAD_TIMEOUT: 30000 // 30초
};

// =========================
// 🤖 AI 관련 설정
// =========================

const AI_PROVIDERS = {
  GEMINIAPI: 'geminiapi',
  VERTEXAI: 'vertexai', 
  OLLAMA: 'ollama'
};

const DEFAULT_AI_MODELS = {
  [AI_PROVIDERS.GEMINIAPI]: 'gemini-2.0-flash-thinking-exp-01-21',
  [AI_PROVIDERS.VERTEXAI]: 'gemini-2.5-pro-exp-03-25',
  [AI_PROVIDERS.OLLAMA]: 'gemma3:4b'
};

module.exports = {
  // 테스트 상수
  API_TEST_USER_ID,
  API_TEST_SESSION_ID,
  API_TEST_USER_MESSAGE_ID,
  API_TEST_AI_MESSAGE_ID,
  
  // 구독 관련
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_LIMITS,
  
  // 에러 코드
  ERROR_CODES,
  
  // 사용자 활동
  USER_ACTIVITY_TYPES,
  
  // 다국어
  SUPPORTED_LANGUAGES,
  
  // 테마
  THEME_OPTIONS,
  
  // 파일 업로드
  FILE_UPLOAD,
  
  // AI 관련
  AI_PROVIDERS,
  DEFAULT_AI_MODELS
};
