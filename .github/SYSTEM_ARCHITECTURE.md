# 🚀 Orbitmate-Server 시스템 아키텍처 종합 문서

> **최종 업데이트**: 2025-06-25 | **버전**: 2.5 | **상태**: Production Ready

---

## 📋 시스템 개요

### 🎯 핵심 기능
- **AI 채팅 시스템**: HTTP SSE 스트리밍, Gemini/Vertex AI/Ollama 지원
- **사용자 관리**: JWT 인증, 프로필/설정, 레벨/뱃지 시스템
- **구독 관리**: 4단계 구독 (코멧→플래닛→스타→갤럭시), 기능 제한
- **데이터베이스**: Oracle DB, 트랜잭션 자동 관리, CLOB 처리
- **외부 API**: 위키피디아 검색, 날씨 정보, 공공데이터 연동

### 🏗️ 아키텍처 패턴
- **ServiceFactory Pattern**: 모든 컨트롤러 표준화
- **Repository Pattern**: 모델 계층 DB 추상화
- **Middleware Pattern**: 인증, 구독, 에러 처리
- **Provider Pattern**: AI 서비스 추상화

---

## 🗄️ 데이터베이스 (Oracle DB)

### `config/database.js` - DB 연결 관리
```javascript
// 🔧 주요 함수들
initOracleClient()     // Oracle Instant Client 초기화 (Thick 모드)
initializeDbPool()     // 연결 풀 생성 (poolMin: 10, poolMax: 10)
getConnection()        // 풀에서 연결 획득 (자동 반납 필요)
oracledb              // Oracle 타입/상수 참조용

// 📊 연결 설정
{
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  poolMin: 10, poolMax: 10, poolIncrement: 0
}
```

### `utils/dbUtils.js` - DB 유틸리티
```javascript
// 🔄 트랜잭션 관리
withTransaction(callback)           // 자동 commit/rollback, 연결 해제
  ├─ connection = await getConnection()
  ├─ result = await callback(connection)
  ├─ await connection.commit()
  └─ await connection.close()

// 📝 데이터 변환
clobToString(clob)                 // Oracle CLOB → 문자열
convertClobFields(data)            // 객체/배열의 모든 CLOB 필드 변환
toSnakeCaseObj(obj)               // Oracle 컬럼명 → snake_case
```

### 📊 주요 테이블 구조
```sql
-- 👤 사용자 시스템
users                    // 기본 정보 (user_id, username, email, password_hash)
user_settings           // 설정 (theme, language, font_size, ai_model_preference)
user_profiles          // 프로필 (nickname, bio, experience, level, badges)

-- 💬 채팅 시스템
chat_sessions          // 세션 (session_id, user_id, title, category, archived)
chat_messages         // 메시지 (message_id, session_id, content CLOB, sender)
attachments          // 첨부파일 (file_name, file_path, file_size, mime_type)

-- 💳 구독 시스템
subscription_tiers    // 등급 정의 (tier_name, level, monthly_price, features)
user_subscriptions   // 사용자 구독 (user_id, current_tier, start_date, end_date)

-- 🏆 레벨/뱃지 시스템
level_requirements   // 레벨별 필요 경험치
user_experience_log // 경험치 획득 이력
user_badges        // 사용자 뱃지 상태

-- 🌍 다국어/커스터마이징
translation_resources // 번역 리소스 (language, category, key, value)
user_items          // 사용자 아이템 (premium decorations)
message_edit_history // 메시지 편집 기록
```

---

## 🎯 ServiceFactory 시스템

### `utils/serviceFactory.js` - 핵심 팩토리
```javascript
// 🏭 기본 팩토리
createController(modelFunction, options)     // 기본 컨트롤러 생성
createService(modelFunction, options)        // 기본 서비스 생성

// 📝 CRUD 헬퍼
createReadController(modelFunction, options)    // GET 요청용
createUpdateController(modelFunction, options)  // PUT 요청용  
createDeleteController(modelFunction, options)  // DELETE 요청용
createCreateController(modelFunction, options)  // POST 요청용

// 👥 도메인별 헬퍼
createUserService()           // 사용자 ID 기반 서비스
createUserProfileService()    // 프로필 관련 (민감정보 제거)
createUserSettingsService()   // 설정 관련
createSubscriptionService()   // 구독 관련
createMessageService()        // 메시지 관련 (세션+사용자 ID)
createExternalApiService()    // 외부 API 연동

// 🚀 고급 기능
createStreamController()      // HTTP SSE 스트리밍
createFileUploadController()  // 파일 업로드 (크기/타입 검증)
createCachedService()        // 캐싱 지원
```

### 💡 ServiceFactory 사용 패턴
```javascript
// ✅ 표준 패턴
const getUserController = createReadController(
  userModel.getUserProfile,
  {
    dataExtractor: (req) => [req.params.user_id],
    validations: [(req) => {
      if (!req.params.user_id) {
        const err = new Error("User ID required");
        err.code = "INVALID_INPUT";
        throw err;
      }
    }],
    errorContext: 'get_user_profile'
  }
);

// 🔄 자동 트랜잭션 처리
result = await withTransaction(async (connection) => {
  return await modelFunction(connection, ...args);
});
```

---

## 🎮 컨트롤러 계층

### `controllers/userController.js` - 사용자 관리 (🔥 핵심)
```javascript
// 🔐 인증
registerUserController        // 회원가입 (중복체크, 기본설정 생성)
loginUserController          // 로그인 (JWT 발급)
checkEmailExistsController   // 이메일 중복 확인

// 👤 프로필/설정
getUserProfileController     // 프로필 조회
updateUserProfileController  // 프로필 수정 (nickname, bio, birth_date)
getUserSettingsController    // 설정 조회 (theme, language, font_size)
updateUserSettingsController // 설정 수정
uploadProfileImageController // 프로필 이미지 업로드 (직접 구현)

// 🏆 레벨/뱃지
getUserLevelController       // 레벨/경험치 조회
addUserExperienceController  // 경험치 추가 (0-10000)
getUserBadgesController      // 뱃지 목록 조회
toggleUserBadgeController    // 뱃지 착용/해제

// 🎨 커스터마이징/다국어
getUserCustomizationController    // 프로필 꾸미기 설정
updateUserCustomizationController // 테마/테두리/배경/상태메시지
getTranslationResourcesController // 번역 리소스 조회
updateUserLanguageController     // 언어 설정 변경

// 🗑️ 계정 관리
deleteUserController        // 회원 탈퇴 (CASCADE 삭제)
```

### `controllers/userActivityController.js` - 사용자 활동
```javascript
// 📝 통합 활동 처리
handleUserActivityController      // 버그제보/피드백/테스트참여 통합
handleBugReportController        // 버그 제보 (래퍼)
handleFeedbackSubmissionController // 피드백 제출 (래퍼)  
handleTestParticipationController // 테스트 참여 (래퍼)

// 🏅 뱃지 업그레이드
upgradeSubscriptionBadgeController // 구독 뱃지 업그레이드 요청
approveBadgeUpgradeController     // 뱃지 업그레이드 승인
```

### `controllers/chatController.js` - 채팅 시스템 (🔥 핵심)
```javascript
// 💬 메시지 관리
sendMessageController        // AI 응답 + HTTP SSE 스트리밍 + DB 저장
editMessageController       // 메시지 편집 + 편집 기록 저장
deleteMessageController     // 메시지 삭제 (soft delete)
getSessionMessagesController // 세션별 메시지 조회 (CLOB 변환)

// 😊 리액션
addReactionController       // 메시지 리액션 추가
removeReactionController    // 메시지 리액션 제거

// 📎 파일 업로드
uploadFileController        // 파일 업로드 + 첨부파일 DB 저장
```

### `controllers/sessionController.js` - 세션 관리
```javascript
createSessionController     // 세션 생성
getUserSessionsController   // 사용자 세션 목록 조회
updateSessionController     // 세션 정보 수정 (제목, 카테고리, 보관)
deleteSessionController     // 세션 삭제 (연관 메시지/첨부파일 CASCADE)
```

### `controllers/subscriptionController.js` - 구독 관리 (💳 중요)
```javascript
// 💳 구독 등급 (코멧→플래닛→스타→갤럭시)
getSubscriptionTiersController   // 구독 등급 목록
getUserSubscriptionController    // 사용자 구독 정보
updateUserSubscriptionController // 구독 업그레이드/다운그레이드
cancelUserSubscriptionController // 구독 취소

// 🔒 권한/사용량 관리
checkFeatureAccessController    // 기능 접근 권한 확인
checkDailyUsageController       // 일일 사용량 확인
simulateSubscriptionUpgradeController // 업그레이드 시뮬레이션
simulateSubscriptionRenewalController // 갱신 시뮬레이션
```

---

## 📊 모델 계층

### `models/user.js` - 사용자 데이터 모델 (🔥 핵심)
```javascript
// 🔐 인증 함수 (모든 함수는 connection을 첫 매개변수로 받음)
registerUser(connection, username, email, password)
  ├─ bcrypt 해싱 (saltRounds: 10)
  ├─ 이메일 중복 체크
  ├─ 테스트 사용자 특별 처리 (API_TEST_USER_ID)
  ├─ 기본 설정/프로필 생성
  └─ 트랜잭션 처리

loginUser(connection, email, password)
  ├─ 이메일로 사용자 조회
  ├─ 계정 활성화 상태 체크
  ├─ bcrypt 비밀번호 검증
  └─ 마지막 로그인 시간 업데이트

checkEmailExists(connection, email)  // COUNT(*) 쿼리로 중복 체크

// 👤 프로필/설정 함수
getUserProfile(connection, user_id)         // 프로필 조회
updateUserProfile(connection, user_id, data) // 프로필 수정
getUserSettings(connection, user_id)        // 설정 조회  
updateUserSettings(connection, user_id, settings) // 설정 수정 (RETURNING 절 사용)
updateUserProfileImage(connection, user_id, path) // 프로필 이미지 경로 저장

// 🏆 레벨/경험치 함수
getUserLevel(connection, user_id)           // 현재 레벨/경험치
addUserExperience(connection, user_id, points, type, reason)
  ├─ 경험치 로그 저장
  ├─ 프로필 경험치 업데이트  
  ├─ 레벨업 체크 및 처리
  └─ 레벨업 시 뱃지 자동 지급

// 🏅 뱃지 함수
getUserBadges(connection, user_id)          // 뱃지 목록 조회
toggleUserBadge(connection, user_id, badge_id, equipped) // 뱃지 착용/해제

// 🎨 커스터마이징 함수
getUserCustomization(connection, user_id)    // 프로필 꾸미기 설정
updateUserCustomization(connection, user_id, data) // 테마/테두리/배경 설정

// 🌍 다국어 함수
getTranslationResources(connection, lang, category) // 번역 리소스
updateUserLanguage(connection, user_id, language)  // 언어 설정

// 🗑️ 계정 삭제
deleteUser(connection, user_id)             // CASCADE 삭제 (모든 연관 데이터)
```

### `models/chat.js` - 채팅 데이터 모델
```javascript
// 💬 메시지 함수
getChatHistoryFromDB(connection, sessionId, includeCurrentUserMessage)
  ├─ 세션별 대화 기록 조회
  ├─ AI Provider 포맷 변환 (Vertex AI format)
  └─ CLOB 자동 변환

saveUserMessageToDB(connection, sessionId, user_id, message)
  ├─ CLOB으로 저장
  ├─ sequence 기반 ID 생성
  └─ 메시지 ID 반환

saveAiMessageToDB(connection, sessionId, user_id, message)
  ├─ CLOB으로 저장
  ├─ RETURNING으로 ID 반환
  └─ 스트리밍 지원

// 📎 첨부파일 함수
saveAttachmentToDB(messageId, file)         // 파일 정보 DB 저장

// ✏️ 편집/삭제 함수  
editUserMessage(connection, messageId, newContent, user_id)
  ├─ 권한 체크 (메시지 소유자만)
  ├─ 편집 기록 저장
  └─ 메시지 내용 업데이트

deleteUserMessageFromDB(messageId, user_id) // soft delete
getSessionMessagesForClient(sessionId)      // 클라이언트용 메시지 조회 (CLOB 변환)

// 🔧 유틸리티
clobToString(clob)                          // Oracle CLOB → 문자열 변환
```

### `models/session.js` - 세션 데이터 모델
```javascript
createChatSession(connection, user_id, title, category)     // 세션 생성
getUserChatSessions(connection, user_id)                    // 세션 목록 (보관 포함)
updateChatSession(connection, sessionId, updates)          // 세션 정보 수정
deleteChatSession(connection, sessionId, user_id)          // CASCADE 삭제
getUserIdBySessionId(connection, sessionId)                // 권한 체크용
```

### `models/subscription.js` - 구독 데이터 모델
```javascript
// 💳 구독 등급: ☄️코멧(무료) → 🪐플래닛(1.5만) → ☀️스타(15만) → 🌌갤럭시(300만)
getSubscriptionTiers(connection)                           // 등급 목록
getUserSubscription(connection, user_id)                   // 사용자 구독 (없으면 무료 생성)
updateUserSubscription(connection, user_id, tier_name, options) // 구독 변경
cancelUserSubscription(connection, user_id)               // 무료로 다운그레이드

// 🔒 권한/사용량 체크
checkUserFeatureAccess(connection, user_id, feature_name)  // 기능 접근 권한
checkDailyUsage(connection, user_id)                      // 일일 사용량 (자동 초기화)
```

---

## 🛡️ 미들웨어 계층

### `middleware/auth.js` - JWT 인증
```javascript
authenticateToken(req, res, next)    // JWT 토큰 검증 (Bearer scheme)
generateToken(payload)               // JWT 토큰 생성
// 설정: secret, expiresIn (1h)
```

### `middleware/subscription.js` - 구독 제한
```javascript
requireFeature(featureName)          // 기능별 접근 권한 체크 → HTTP 403
checkDailyLimit()                    // 일일 AI 요청 사용량 제한 → HTTP 429  
requireTierLevel(minLevel)           // 최소 구독 등급 체크 → HTTP 403
checkFileUploadLimit(fileSize)       // 파일 크기 제한 체크 → HTTP 413
```

---

## 🤖 AI 시스템

### `utils/aiProvider.js` - AI Provider 추상화 (🔥 핵심)
```javascript
// 🎯 지원 Provider
fetchChatCompletion(aiProvider, currentUserMessage, history, systemMessageText, specialModeType, streamResponseCallback, options)
  ├─ 'geminiapi': Google AI Studio (기본값, 무료)
  ├─ 'vertexai': Google Cloud Vertex AI (고급 기능)  
  └─ 'ollama': 로컬 Ollama 서버

// 🚀 특수 모드
specialModeType: 'stream' | 'canvas' | 'search' | null
streamResponseCallback: HTTP SSE 콜백 함수
```

### `config/geminiapi.js` - Google AI Studio (기본값)
```javascript
// 📡 무료 API 연동
defaultModel: 'gemini-2.0-flash-thinking-exp-01-21'
apiKey: process.env.GEMINI_API_KEY
안전성 필터: 괴롭힘/증오/성적/위험 콘텐츠 차단
지원 기능: 스트리밍, 캔버스 모드, 안전성 필터
```

### `config/vertexai.js` - Google Cloud Vertex AI (백업)
```javascript
// ☁️ 클라우드 API 연동
defaultModel: 'gemini-2.5-pro-exp-03-25'  
location: 'global' (exp 모델 전용)
credentials: Google Cloud Service Account
지원 기능: 엔터프라이즈, 고급 안전성, 커스텀 모델
```

---

## 🔗 라우트 계층

### API 엔드포인트 맵
```javascript
// 👤 사용자 관리 (/api/users)
POST /register                     // 회원가입
POST /login                       // 로그인  
POST /check-email                 // 이메일 중복확인
GET /:user_id/profile            // 프로필 조회
PUT /:user_id/profile            // 프로필 수정
POST /:user_id/profile/image     // 프로필 이미지 업로드
GET /:user_id/settings           // 설정 조회
PUT /:user_id/settings           // 설정 수정
DELETE /:user_id                 // 회원 탈퇴

// 🏆 레벨/뱃지 (/api/users/:user_id)
GET /level                       // 레벨 조회
POST /experience                 // 경험치 추가
GET /badges                      // 뱃지 목록
PUT /badges/:badge_id            // 뱃지 착용/해제

// 🎨 커스터마이징/다국어 (/api/users)  
GET /:user_id/customization      // 프로필 꾸미기 설정
PUT /:user_id/customization      // 프로필 꾸미기 수정
GET /translations/:lang          // 번역 리소스
PUT /:user_id/language           // 언어 설정

// 📝 사용자 활동 (/api/users/:user_id/activity)
POST /bug-report                 // 버그 제보
POST /feedback                   // 피드백 제출
POST /test-participation         // 테스트 참여

// 🏅 뱃지 업그레이드 (/api/users/:user_id/badges)
POST /upgrade                    // 업그레이드 요청
PUT /approve                     // 업그레이드 승인

// 💬 채팅 (/api/chat)
POST /sessions/:session_id/messages      // AI 응답 + 스트리밍
PUT /messages/:message_id                // 메시지 편집
DELETE /messages/:message_id             // 메시지 삭제
POST /messages/:message_id/reaction      // 리액션 추가
DELETE /messages/:message_id/reaction    // 리액션 제거
POST /sessions/:session_id/upload        // 파일 업로드
GET /sessions/:session_id/messages       // 메시지 조회

// 📋 세션 (/api/sessions)
POST /                          // 세션 생성
GET /user/:user_id             // 사용자 세션 목록
PUT /:session_id               // 세션 정보 수정
DELETE /:session_id            // 세션 삭제

// 💳 구독 (/api/subscriptions)
GET /tiers                     // 구독 등급 목록
GET /user/:user_id            // 사용자 구독 정보
PUT /user/:user_id            // 구독 업그레이드/다운그레이드
DELETE /user/:user_id         // 구독 취소
GET /user/:user_id/history    // 구독 이력
GET /user/:user_id/access/:feature_name  // 기능 접근 권한
GET /user/:user_id/usage      // 일일 사용량
POST /user/:user_id/simulate/upgrade    // 업그레이드 시뮬레이션
POST /user/:user_id/simulate/renewal    // 갱신 시뮬레이션

// 🔍 검색 (/api/search)
GET /wikipedia                // 위키피디아 검색

// 🤖 AI 정보 (/api/ai-info)
GET /models                  // 사용 가능한 AI 모델 목록
```

---

## 🔧 설정 시스템

### `config/index.js` - 중앙 설정 (🔥 핵심)
```javascript
// 🌐 서버 설정
port: 3000
nodeEnv: 'development' | 'production'
testPagePassword: 환경변수

// 🗄️ 데이터베이스 설정  
database: {
  user, password, connectString,
  poolMin: 10, poolMax: 10, poolIncrement: 0,
  oracleClientLibDir: Instant Client 경로,
  thickModeRequired: true/false
}

// 🔐 JWT 설정
jwt: {
  secret: 'verysecretkey',
  expiresIn: '1h'
}

// 🤖 AI Provider 설정
ai: {
  defaultProvider: 'geminiapi',
  gemini: { apiKey, defaultModel: 'gemini-2.0-flash-thinking-exp-01-21' },
  vertexAi: { projectId, location: 'global', defaultModel: 'gemini-2.5-pro-exp-03-25' },
  ollama: { apiUrl: 'http://localhost:11434/api/chat', defaultModel: 'gemma3:4b' }
}

// 👤 사용자 설정 허용값
userSettings: {
  allowedThemes: ['light', 'dark', 'auto'],
  supportedLanguages: ['ko', 'en', 'ja', 'zh'],
  fontSizeRange: { min: 10, max: 30 },
  allowedAiProviders: ['geminiapi', 'vertexai', 'ollama']
}

// 🌍 외부 API 설정
wikipedia: { apiBaseUrl, defaultLanguage: 'ko', cacheDuration: 3600 }
weather: { apiKey, cacheDuration: 1800 }
externalApis: { naver: {clientId, clientSecret}, kakao: {apiKey} }
```

---

## 🎨 프론트엔드

### `public/script.js` - 메인 채팅 UI
```javascript
// 🚀 핵심 기능
initializeSession()              // 세션 초기화 (로컬 스토리지 기반)
sendMessage()                   // HTTP SSE 스트리밍 메시지 전송
addMessage(sender, text, messageId, isEdited) // 채팅 메시지 UI 추가
parseMarkdown(text)             // Marked.js + Highlight.js 변환
refreshMessages()               // 서버에서 메시지 새로고침

// 📱 전역 변수
currentSessionId, selectedAiProvider, selectedModelId, 
currentMaxOutputTokens, currentContextLimit
```

### `public/test.html` + `testScript.js` - API 테스트 도구
```javascript
// 📁 모듈 구조 (testScripts/)
user.js          // 사용자 API 테스트 (회원가입, 로그인, 프로필, 설정)
chat.js          // 채팅 API 테스트 (메시지 전송, 편집, 삭제, 리액션)
session.js       // 세션 API 테스트 (생성, 조회, 수정, 삭제)
subscription.js  // 구독 API 테스트 (등급, 업그레이드, 취소, 이력)
badgeLevel.js    // 레벨/뱃지 API 테스트
language.js      // 다국어 API 테스트
profile.js       // 프로필 커스터마이징 테스트
search.js        // 검색 API 테스트
utils.js         // 공통 유틸리티 (Markdown 파싱, API 응답 표시)
```

### `public/promptFeature.js` - 프롬프트 시스템
```javascript
// 🎭 역할 프롬프트 옵션
promptOptions: [
  'Orbitmate 2.5', 'mate-star', 'mate-search', 
  '문학작가', '비즈니스 컨설턴트', '철학자', 
  '과학자', '기술 전문가', '교육자'
]
// 프롬프트 선택 시 data-system-prompt 속성에 저장
```

---

## 🚨 에러 처리 시스템

### `utils/errorHandler.js` - 통합 에러 처리
```javascript
// 🎯 표준 에러 코드
INVALID_INPUT    → HTTP 400 (입력값 오류)
UNAUTHORIZED     → HTTP 401 (인증 실패)  
FORBIDDEN        → HTTP 403 (권한 부족)
NOT_FOUND        → HTTP 404 (리소스 없음)
RATE_LIMITED     → HTTP 429 (사용량 초과)
DATABASE_ERROR   → HTTP 500 (DB 작업 오류)

// 🔧 Oracle DB 에러 변환
handleOracleError(err) // 사용자 친화적 메시지 변환
Global Error Handler   // Express 미들웨어로 모든 에러 캐치
```

### `utils/apiResponse.js` - API 응답 표준화
```javascript
// ✅ 성공 응답 형식
{
  statusCode: 200,
  body: {
    user_id: "123",
    username: "testuser"  // snake_case 통일
  }
}

// ❌ 에러 응답 형식  
{
  statusCode: 400,
  body: {
    error: "사용자 친화적 에러 메시지",
    code: "INVALID_INPUT"
  }
}
```

---

## 🔍 외부 API 연동

### 현재 구현된 API
```javascript
// 📚 위키피디아 (무료, 무제한)
GET /api/search/wikipedia
  ├─ 한국어 우선 검색 → 영어 대체
  ├─ 캐싱: 1시간
  └─ AI 답변 참조 자료 활용

// 🌤️ OpenWeatherMap (계획됨)
일 1,000회 무료, 위치별 현재/예보 날씨

// 🏛️ 한국 공공데이터 (계획됨)  
대기질, 문화행사, 교통정보 (정부 제공 무료)

// 🔍 네이버/카카오 검색 (계획됨)
네이버: 일 25,000회, 카카오: 일 30,000회
```

---

## 📊 성능 최적화

### 🚀 현재 최적화 사항
```javascript
// 🔄 데이터베이스
커넥션 풀 관리 (10개 풀)
자동 트랜잭션 관리 (commit/rollback)
CLOB 스트림 처리 (메모리 효율적)
Oracle Thick 모드 (성능 향상)

// 📡 HTTP 통신
HTTP SSE 스트리밍 (WebSocket 대신 단순화)
AI 응답 청크별 처리
Markdown 렌더링 최적화

// 💾 캐싱 (계획됨)
외부 API 결과 캐싱 (Redis)
검색 결과 1시간 캐싱
날씨 데이터 30분 캐싱
```

### 🎯 구독 기반 제한 시스템
```javascript
// 💳 구독 등급별 제한
☄️ 코멧 (무료):     일일 30회 AI 요청, 10MB 파일 업로드
🪐 플래닛 (1.5만):   일일 300회 AI 요청, 100MB 파일 업로드  
☀️ 스타 (15만):     일일 3000회 AI 요청, 1GB 파일 업로드
🌌 갤럭시 (300만):   무제한 AI 요청, 10GB 파일 업로드

// 🔒 자동 제한 적용
미들웨어에서 요청 전 사용량 체크
HTTP 429 (사용량 초과) 자동 반환
구독 업그레이드 안내 포함
```

---

## 🛠️ 개발/운영 도구

### 📊 로깅 시스템
```javascript
// 🔍 상세 로깅 (개발 환경)
[TIMESTAMP] [UserID] [Path] [Handler] 오류 발생
Error Code, Details, Stack Trace 포함
ServiceFactory 패턴 기반 에러 컨텍스트

// 📈 사용량 추적
AI 요청 횟수, 파일 업로드 크기
일일 사용량 자동 초기화 (자정)
구독 등급별 제한 모니터링
```

### 🧪 테스트 환경  
```javascript
// 🎯 테스트 계정
API_TEST_USER_ID: 특별 처리 계정
test.html: 모든 API 엔드포인트 테스트 UI
testScripts/: 모듈화된 테스트 함수들

// 🔄 자동화
ServiceFactory 패턴으로 일관된 에러 처리
DB 트랜잭션 자동 관리
API 응답 형식 자동 표준화
```

---

## 🚀 배포 및 확장성

### 📦 현재 배포 구성
```javascript
// 🎯 단일 서버 구성
Node.js + Express + Oracle DB
HTTP SSE 스트리밍 (WebSocket 제거로 단순화)
파일 업로드 로컬 저장 (/uploads)

// 🔧 환경 설정
.env 파일 기반 설정 관리
개발/프로덕션 환경 분기
Oracle Instant Client 자동 설정
```

### 🔮 확장 계획
```javascript
// ☁️ 클라우드 확장  
Redis 캐싱 추가
파일 업로드 → AWS S3/Google Cloud Storage
로드 밸런서 + 다중 서버 인스턴스

// 📊 모니터링 강화
API 응답 시간 추적
DB 커넥션 풀 사용률 모니터링  
AI Provider 사용량/비용 추적
사용자 행동 패턴 분석

// 🔒 보안 강화
API Rate Limiting (express-rate-limit)
CORS 정책 세분화
JWT 토큰 rotation
DB 접근 권한 최소화
```

---

## 💡 핵심 설계 원칙

### 🎯 아키텍처 철학
```javascript
// 🏭 ServiceFactory Pattern
모든 컨트롤러 표준화 → 코드 중복 제거
자동 트랜잭션 관리 → 데이터 무결성 보장
통일된 에러 처리 → 일관된 사용자 경험

// 🔄 관심사 분리 (Separation of Concerns)
컨트롤러: 요청/응답 처리
서비스: 비즈니스 로직
모델: 데이터 접근
미들웨어: 횡단 관심사 (인증, 권한, 로깅)

// 📡 API 설계 원칙
RESTful 설계 + HTTP 표준 상태 코드
snake_case 응답 형식 통일
성공 시 데이터 직접 반환, 실패 시 에러 메시지
```

### 🚨 안정성 보장
```javascript
// 🛡️ DB 안정성
자동 트랜잭션 (commit/rollback)
커넥션 풀 관리 (자동 반납)
SQL 인젝션 방지 (바인드 변수)
Oracle CLOB 안전 처리

// 🔐 보안
bcrypt 비밀번호 해싱 (saltRounds: 10)
JWT 토큰 기반 인증
구독 기반 기능 제한
파일 업로드 검증 (크기, 타입)

// 🎯 사용자 경험
HTTP SSE 스트리밍 (실시간 AI 응답)
Markdown 렌더링 (가독성 향상)
다국어 지원 (ko, en, ja, zh)
프로필 커스터마이징 (개인화)
```

---

## 📚 학습 리소스

### 🎓 핵심 기술 스택 학습 포인트
```javascript
// 🏗️ 백엔드 아키텍처
ServiceFactory Pattern 구현 방법
Oracle DB + Node.js 연동 (oracledb)
HTTP SSE 스트리밍 vs WebSocket
트랜잭션 관리 모범 사례

// 🤖 AI 통합
Google AI Studio vs Vertex AI 차이점
다중 AI Provider 추상화 패턴
스트리밍 응답 처리 방법
Prompt Engineering 기법

// 💳 비즈니스 로직
구독 기반 SaaS 모델 구현
사용량 추적 및 제한 시스템
레벨/뱃지 게이미피케이션
다국어 지원 시스템

// 🔧 개발 운영
Express.js 고급 패턴
에러 처리 표준화
API 설계 모범 사례
성능 최적화 기법
```

---

## 📈 미래 발전 방향

### 🚀 단기 계획
```javascript
// 🔍 외부 API 확장
네이버/카카오 검색 API 연동
OpenWeatherMap 날씨 위젯
한국 공공데이터 활용 (대기질, 문화행사)

// 🎮 기능 강화  
음성 인식/TTS 연동
실시간 검색 순위
AI 대화 요약 기능
추천 검색 시스템
```

### 🔮 장기 계획
```javascript
// ☁️ 인프라 현대화
Microservices 아키텍처 전환
Container 기반 배포 (Docker)
Kubernetes 오케스트레이션  
GraphQL API 도입

// 🧠 AI 고도화
다중 AI 모델 추가
사용자별 개인화 AI
실시간 웹 크롤링 통합
벡터 DB 기반 장기 기억

// 💼 비즈니스 확장
실제 결제 게이트웨이 연동
기업용 기능 (팀 관리, SSO)
API 제공 서비스 (Developer API)
모바일 앱 연동
```

---

## 🎯 결론

Orbitmate-Server는 **ServiceFactory 패턴**을 중심으로 한 현대적이고 확장 가능한 AI 채팅 플랫폼입니다.

### 🏆 주요 강점
- **표준화된 아키텍처**: ServiceFactory로 모든 컨트롤러 통일
- **안정적인 DB 관리**: Oracle + 자동 트랜잭션 처리  
- **유연한 AI 통합**: 다중 Provider 지원 + HTTP SSE 스트리밍
- **완성도 높은 기능**: 구독, 레벨, 뱃지, 다국어, 커스터마이징
- **개발자 친화적**: 종합 테스트 도구 + 상세 문서화

### 🎨 기술적 혁신  
- WebSocket → HTTP SSE로 단순화
- 수동 트랜잭션 → ServiceFactory 자동화
- 개별 컨트롤러 → 팩토리 패턴 표준화
- Oracle CLOB 완벽 처리
- 실시간 Markdown 렌더링

**이 시스템은 학습, 확장, 상용화 모든 측면에서 우수한 현대적 백엔드 아키텍처의 완성형입니다. 🚀**

---

*© 2025 Orbitmate-Server | ServiceFactory Pattern Architecture*
