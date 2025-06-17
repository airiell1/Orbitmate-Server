````instructions
# Orbitmate Copilot Instructions

이 문서는 Orbitmate 프로젝트 운영 가이드, 구조 요약, 버그 트래킹, 작업 목록을 포함합니다.
이 문서는 언제든 수정이 가능합니다.

---

## 1. 프로젝트 구조 및 주요 진입점

- **서버 진입점**
  - `server.js`: 단순한 모듈 진입점, app.js를 require하여 모듈로 내보냄
  - `app.js`: 실제 서버 로직 - Express 앱 설정, 미들웨어 구성, 라우트 연결, DB 초기화 및 서버 시작

- **DB/외부 연동 (config/)**
  - `config/database.js`:
    - Oracle DB 연결, 커넥션 풀 관리, Thick 모드(Instant Client) 지원
    - 환경변수 기반 설정 (user, password, connectString)
    - 주요 함수 및 내보내기:
      - `initOracleClient()`: Oracle Instant Client 경로로 Thick 모드 초기화 (윈도우 환경 등에서 필수)
      - `initializeDbPool()`: 커넥션 풀 생성 및 초기화
      - `getConnection()`: 커넥션 획득 (풀에서)
      - `oracledb`: oracledb 인스턴스 전체 내보내기 (트랜잭션, CLOB 등 활용)
    - 참고: 커넥션 풀은 app.js/server.js에서 최초 1회만 초기화 필요. 각 모델/컨트롤러에서는 getConnection()으로 커넥션 획득 후 사용/반납  - `config/vertexai.js`:
    - Vertex AI 연동, Google Cloud Gemini 2.5 pro 모델 사용
    - **리전 설정: `global` exp는 이 리전에서만 사용 가능
    - 안전성 필터(증오/성적/위험/학대), 스트림/캔버스/검색 등 특수 모드 지원
    - 주요 함수 및 내보내기:
      - `getVertexAiApiResponse(currentUserMessage, history, systemMessageText, specialModeType, streamResponseCallback, options)`: Vertex AI에 대화 요청, 스트림/캔버스/검색 등 특수 모드 지원 (systemPrompt, specialModeType, stream 콜백, options 객체로 model_id_override, max_output_tokens_override 등 다양한 옵션 지원)
      - `vertex_ai`: VertexAI 인스턴스 (직접 모델 생성/설정 가능)
      - `generativeModel`: Gemini 2.5 pro 모델 인스턴스 (기본 설정)
    - 참고: specialModeType에 따라 systemPrompt가 자동 강화(캔버스/검색 등), streamResponseCallback으로 스트리밍 응답 처리 가능
  - `config/geminiapi.js`:
    - Google AI Studio 연동, Gemini 2.0 Flash Exp 모델 사용
    - **API 키 설정: `GEMINI_API_KEY` 환경변수 필요**
    - 안전성 필터(괴롭힘/증오/성적/위험 콘텐츠), 스트림/캔버스 등 특수 모드 지원
    - 주요 함수 및 내보내기:
      - `getGeminiApiResponse(currentUserMessage, history, systemMessageText, specialModeType, streamResponseCallback, options)`: Google AI Studio에 대화 요청, 스트림/캔버스 등 특수 모드 지원
      - `genAI`: GoogleGenerativeAI 인스턴스 (직접 모델 생성/설정 가능)
      - `defaultModel`: 기본 모델 이름 ('gemini-2.0-flash-thinking-exp-01-21')
    - 참고: specialModeType에 따라 systemPrompt가 자동 강화(캔버스/검색 등), 토큰 사용량 추적 기능 제공

- **AI 제공자 및 유틸리티 (utils/)**
  - `utils/aiProvider.js`: AI 제공자 추상화 레이어
    - **기본 provider: `'geminiapi'` (Google AI Studio)** - 2025년 6월 17일 vertexai에서 변경
    - 주요 함수:      - `fetchChatCompletion(aiProvider, currentUserMessage, history, systemMessageText, specialModeType, streamResponseCallback, options)`: AI 제공자별 요청 라우팅
    - Google AI Studio, Vertex AI, Ollama 간 통합 인터페이스 제공
    - 옵션을 통한 모델별 설정 지원 (ollamaModel, vertexModelId, geminiModel, max_output_tokens_override 등)

- **컨트롤러**

  - `controllers/userController.js`: 사용자 회원가입, 로그인, 설정/프로필 조회·수정, 프로필 이미지 업로드, 회원 탈퇴 등 사용자 관련 API 처리
    - 주요 함수:
      - `registerUserController()`: 회원가입 (이미 등록된 이메일은 200으로 반환)
      - `loginUserController()`: 로그인 (JWT 발급)
      - `getUserSettingsController()`, `updateUserSettingsController()`: 사용자 설정 조회/수정 (테마, 언어, 폰트 크기, AI 모델 선호도 등)
      - `getUserProfileController()`, `updateUserProfileController()`: 프로필 조회/수정
      - `uploadProfileImageController()`: 프로필 이미지 업로드
      - `deleteUserController()`: 회원 탈퇴
      - `checkEmailExists()`: 이메일 중복 확인 API 처리

  - `controllers/chatController.js`: 채팅 메시지 전송, AI 응답, 메시지 편집/삭제/리액션, 파일 업로드 등 채팅 관련 API 처리
    - **기본 AI Provider: `'vertexai'`, 테스트 사용자 ID: `'test-guest'`**
    - 주요 함수:
      - `sendMessageController()`: 메시지 전송 및 AI 응답 처리 (aiProvider 추상화를 통한 Vertex AI/Ollama 연동, 스트림/캔버스 모드 지원)
      - `editMessageController()`: 메시지 편집
      - `addReactionController()`, `removeReactionController()`: 메시지 리액션 추가/제거
      - `deleteMessageController()`: 메시지 삭제
      - `uploadFile()`: 파일 업로드 및 첨부파일 DB 저장
      - `getSessionMessagesController()`: 세션별 메시지 목록 조회 (CLOB 변환 포함)

  - `controllers/sessionController.js`: 채팅 세션 생성/조회/수정/삭제 등 세션 관련 API 처리
    - 주요 함수:
      - `createSessionController()`: 세션 생성
      - `getUserSessionsController()`: 사용자 세션 목록 조회
      - `updateSessionController()`: 세션 정보 수정 (제목, 카테고리, 보관 여부)
      - `getSessionMessagesController()`: 세션 메시지 목록 조회 (models/session.js의 getSessionMessages 호출)
      - `deleteSessionController()`: 세션 삭제

  - `controllers/aiInfoController.js`: AI 정보 조회 API 처리
    - **기본 provider: `'vertexai'`로 설정됨**
    - 주요 함수:
      - `getModelsInfoController()`: 사용 가능한 AI 모델 목록 조회 (기본값으로 Vertex AI 설정)

  - `controllers/searchController.js`: 검색 기능 관련 API 처리 (위키피디아 검색 등)
    - 주요 함수:
      - `searchWikipediaController()`: 위키피디아 검색 API 처리
      - `getUserSessionsController()`: 사용자 세션 목록 조회
      - `updateSessionController()`: 세션 정보 수정 (제목, 카테고리, 보관 여부)
      - `getSessionMessagesController()`: 세션 메시지 목록 조회 (models/session.js의 getSessionMessages 호출)
      - `deleteSessionController()`: 세션 삭제
- **API 라우트**
  - `routes/users.js`, `routes/chat.js`, `routes/sessions.js`, `routes/aiInfo.js`, `routes/search.js`

- **모델**
  - `models/user.js`: 사용자 관련 DB 접근 함수 (회원가입, 로그인, 설정/프로필 조회·수정, 프로필 이미지, 경험치/레벨, 회원 탈퇴)
    - 주요 함수:
      - `registerUser(username, email, password)`: 회원가입, 비밀번호 해시(bcrypt), 중복 체크, 기본 설정/프로필 생성 및 트랜잭션 처리
      - `loginUser(email, password)`: 로그인, 비밀번호 검증, 계정 활성화 체크, 로그인 시간 업데이트
      - `getUserSettings(user_id)`, `updateUserSettings(user_id, settings)`: 사용자 설정 조회/수정 (테마, 언어, 폰트 크기, AI 모델 선호도 등)
      - `getUserProfile(user_id)`, `updateUserProfile(user_id, profileData)`: 프로필 조회/수정 (닉네임, 소개, 생년월일, 성별 등)
      - `updateUserProfileImage(user_id, profileImagePath)`: 프로필 이미지 경로 업데이트
      - `addUserExperience(user_id, points)`: 경험치 추가 및 레벨업 처리 (레벨 테이블 기반 자동 계산)
      - `deleteUser(user_id)`: 회원 탈퇴(계정 및 연관 데이터 완전 삭제, 트랜잭션 처리)
      - `checkEmailExists(email)`: 이메일 중복 여부 확인 (true/false 반환)

  - `models/chat.js`: 채팅 메시지, 첨부파일, CLOB 변환 등 채팅 관련 DB 접근 함수
    - 주요 함수:
      - `getChatHistoryFromDB(connection, sessionId, includeCurrentUserMessage)`: 세션별 대화 기록 조회 (Vertex AI 포맷으로 변환, CLOB 처리)
      - `saveUserMessageToDB(connection, sessionId, user_id, message)`: 사용자 메시지 저장 (CLOB, sequence 기반 ID 생성)
      - `saveAiMessageToDB(connection, sessionId, user_id, message)`: AI 메시지 저장 (CLOB, RETURNING으로 ID 반환)
      - `saveAttachmentToDB(messageId, file)`: 첨부파일 정보 저장 (파일명, 경로, 크기, MIME 타입)
      - `deleteUserMessageFromDB(messageId, user_id)`: 메시지 삭제 (soft delete 방식, 사용자 권한 체크)
      - `getSessionMessagesForClient(sessionId)`: 세션 전체 메시지(첨부 포함) 조회 (클라이언트용 포맷, CLOB 자동 변환)
      - `clobToString(clob)`: Oracle CLOB → 문자열 변환 유틸 (스트림 처리)

  - `models/session.js`: 채팅 세션 생성/조회/수정/삭제 등 세션 관련 DB 접근 함수
    - 주요 함수:
      - `createChatSession(user_id, title, category)`: 세션 생성 (sequence 기반 ID, 기본값 설정)
      - `getUserChatSessions(user_id)`: 사용자 세션 목록 조회 (생성일 역순, 보관 상태 포함)
      - `updateChatSession(sessionId, updates)`: 세션 정보 수정 (제목, 카테고리, 보관 여부, 업데이트 시간 자동 갱신)
      - `deleteChatSession(sessionId, user_id)`: 세션 삭제 (메시지/첨부파일/세션 완전 삭제, 트랜잭션 처리)
      - `getSessionMessages(sessionId)`: 세션 메시지 목록 조회 (시간순 정렬, CLOB 변환)
      - `getUserIdBySessionId(sessionId)`: 세션 ID로 사용자 ID 조회 (권한 체크용)

- **프론트엔드**

  - `public/script.js`: 메인 채팅 프론트엔드 스크립트 (index.html용)
    - 주요 함수 및 기능:
      - `initializeSession()`: 세션 초기화 및 자동 연결 (로컬 스토리지 기반 세션 복원)
      - `addMessage(sender, text, messageId, isEdited)`: 채팅 메시지 UI 추가 (메시지 액션 버튼 포함)
      - `sendMessage()`: 메시지 전송 및 AI 응답 처리 (스트리밍, 캔버스 모드 지원)
      - `startEditing()`, `saveEdit()`, `deleteMessage()`: 메시지 편집/삭제 기능
      - `refreshMessages()`: 서버에서 메시지 새로고침
      - `fetchAiModelsAndPopulateSelector()`: AI 모델 목록 조회 및 드롭다운 생성
      - `updateDisplayedModelInfo()`: 선택된 AI 모델 정보 UI 업데이트
    - 전역 변수: currentSessionId, selectedAiProvider, selectedModelId, currentMaxOutputTokens, currentContextLimit

  - `public/test.html`: API 테스트 페이지
    - **기본 AI Provider: Gemini(vertexai) 선택됨**
    - Gemini 선택 시 Ollama 모델 선택 및 양자화 옵션 자동 비활성화

  - `public/testScript.js`: API 테스트 및 디버깅용 프론트엔드 스크립트 (test.html용)
    - 모듈화 구조: testScripts/ 디렉토리의 개별 모듈을 import
      - `testScripts/user.js`: 사용자 관련 API 테스트 (회원가입, 로그인, 프로필, 설정)
      - `testScripts/session.js`: 세션 관련 API 테스트 (생성, 조회, 수정, 삭제)
      - `testScripts/message.js`: 메시지 관련 API 테스트 (편집, 리액션, 삭제, 파일 업로드)
      - `testScripts/search.js`: 검색 기능 API 테스트 (위키피디아, 네이버, 카카오)
      - `testScripts/chat.js`: 채팅 기능 (세션 초기화, 메시지 전송, 새로고침)
        - **기본 AI Provider: `'vertexai'`로 설정됨**
        - Gemini UI 선택 시 `vertexai`로 자동 변환 (`radio.value === 'gemini' ? 'vertexai' : radio.value`)
      - `testScripts/utils.js`: 공통 유틸리티 함수 (API 응답 표시, 에러 처리)
    - 주요 역할: API 엔드포인트 테스트, 응답 데이터 검증, 서버 상태 점검
    - **UI 최적화**: `toggleOllamaOptions()` 함수로 AI Provider 변경 시 Ollama 옵션 자동 비활성화/활성화

  - `public/promptFeature.js`: 채팅 프롬프트(시스템 프롬프트) UI 기능
    - 주요 기능:
      - 프롬프트 버튼 및 옵션 패널 생성 (promptOptions 배열 기반)
      - 프롬프트 선택 시 입력창 dataset에 저장 (data-system-prompt 속성)
      - 다양한 역할 프롬프트 지원 (Orbitmate 2.5, mate-star, mate-search, 문학작가, 비즈니스 컨설턴트, 철학자 등)
      - 채팅 입력 UX 개선 (프롬프트 토글 버튼, 드롭다운 패널)

---

## 2. 운영 및 진단 가이드

- **문제 발생 시**
  - 에러, 비표준 코드, API/DB 불일치, UI-API 연동 문제 등은 즉시 "버그 트래킹"에 기록
  - 신규 진입자/AI가 빠르게 구조를 파악할 수 있도록, 주요 진입점·데이터 흐름·테스트/디버깅 팁·자주 쓰는 명령어 등 요약

- **테스트/디버깅 체크리스트**
  - test.html, testScript.js, script.js에서 버튼/입력/이벤트 정상 동작 확인
  - DOM 요소와 JS 코드 연결, 이벤트 리스너 누락/중복 점검
  - API 호출 시 실제 네트워크 요청 및 UI 반영, 콘솔 에러/경고 없는지 확인

- **API 설계 원칙**
  - 성공 시: 데이터를 직접 반환 (배열이면 배열, 객체면 객체)
  - 실패 시: 에러 메시지 형태로 반환
  - 클라이언트는 유연하게 처리, 서버는 필수 데이터만 요구하고 전부 응답
  - snake_case 통일 (standardizeApiResponse 유틸리티 활용)
  - 함수명, 변수명, 파일명, API 경로 등 copilot-instructions.md와 실제 코드가 일치하는지 수시로 교차 점검

- **문서화**
  - 새로운 구조/패턴/핵심 함수 추가 시, 이 문서에 간단히 요약/정리

---

## 3. AI 메모 및 버그 트래킹

- **작성 예시**
  - 날짜, 문제/원인/해결책/상태 순으로 간결하게 기록
  - 예시:
    - `[2025-05-08] 긴 AI 응답 표시 문제: testScript.js에서 addMessage로 넘길 때 잘림 → 응답 요약 표시 및 전체 내용은 패널 안내로 개선 (프론트엔드)`
    - `[2025-05-08] CLOB 반환 오류: Oracle CLOB 스트림 → clobToString 유틸 추가로 해결 (백엔드)`
    - `[2025-05-09] API 응답 케이싱 불일치: Oracle DB 필드가 대문자로 반환되어 응답이 API 문서와 불일치 → standardizeApiResponse 유틸로 snake_case 통일, CLOB 자동 변환 추가 (백엔드)`

[2025-05-30] getConnection 함수 미정의 오류: chatController.js에서 config/database.js의 getConnection 함수를 import하지 않아서 발생 → import 문에 getConnection 추가 (해결)
[2025-06-02] API 응답 형식 통일: standardizeApiResponse 함수를 원래 방식으로 복원 (단일 데이터 객체 반환), 검색 API는 createSearchApiResponse로 분리 (성공시 데이터 직접 반환, 실패시 에러 메시지 반환) (해결)
[2025-06-02] 위키피디아 API 구현 완료: 백엔드/프론트엔드/테스트 UI 모두 구현, 검색 기능 정상 작동 확인 (해결)
[2025-06-10] 기본 AI Provider 변경: ollama → vertexai 전체 시스템 변경 완료 (해결)
[2025-06-10] GUEST_USER_ID 오류: chatController.js에서 GUEST_USER_ID가 미정의 → 'test-guest'로 변경 (해결)
[2025-06-10] 테스트 페이지 UI 개선: Gemini 선택 시 Ollama 옵션 자동 비활성화 및 gemini → vertexai 자동 변환 완료 (해결)
[2025-06-17] API 라우트 404 오류: 서버 IP 변경 시 API 요청이 404 에러 발생 → 라우트 설정 및 서버 연결 상태 확인 필요 (진행중)
[2025-06-17] 회원탈퇴 후 CASCADE 오류: 사용자 삭제 시 연관 메시지/세션이 CASCADE로 삭제되어 리액션 API에서 참조 오류 발생 → 리액션 API에서 메시지 존재 여부 체크 강화 및 우아한 오류 처리 필요 (진행중)
[2025-06-17] 기본 AI Provider 변경: vertexai → geminiapi (Google AI Studio) 전체 시스템 변경 완료 (해결)
[2025-06-17] Google AI Studio API 통합: config/geminiapi.js 추가, 최신 공짜모델인 gemini-2.0-flash-thinking-exp-01-21 모델 사용 (해결)
[2025-06-17] API 명세 업데이트: geminiapi provider 추가, 기본값 변경 반영 완료 (해결)
---

## 4. 작업 목록 (진행상황 체크)

### 기존 기능 (완료)
- [x] 채팅 메시지 전송 API (`POST /api/chat/sessions/:session_id/messages`)
- [x] 채팅 세션 삭제 API (`DELETE /api/chat/sessions/:session_id`)
- [x] 채팅 메시지 삭제 API (`DELETE /api/chat/messages/:message_id`)
- [x] 메시지 리액션 제거 API (`DELETE /api/chat/messages/:message_id/reaction`)
- [x] 파일 업로드/다운로드/권한 관리 (인증 최소화)
- [x] JWT 인증/인가 (학습용 최소 구현)

### 기존 개선 사항
- [ ] API 오류 처리 표준화 및 상세화
- [ ] 입력값 유효성 검사 강화
- [ ] DB 커넥션 풀 최적화
- [ ] API 응답 케이싱 통일 (standardizeApiResponse 유틸리티 추가 및 적용)
- [ ] (선택) WebSocket 실시간 메시지

### 신규 백엔드 기능 (우선순위별)

#### 즉시 구현 가능 (Immediate) - 무료 API 활용
- [x] **위키피디아 API 연동 (백엔드)**: 백과사전 정보 검색 ⭐ 최우선 **완료**
  - 위키피디아 검색 API (`GET /api/search/wikipedia`)
    - 무료, 무제한 사용 가능 (API 키 불필요)
    - 다국어 지원 (한국어, 영어, 일본어 등)
    - 요약/전문 조회 기능
    - 환경변수 설정 완료: `WIKIPEDIA_API_BASE_URL`, `WIKIPEDIA_DEFAULT_LANGUAGE` 등
    - 백엔드 구현 완료: `models/search.js`, `controllers/searchController.js`, `routes/search.js`
    - 프론트엔드 구현 완료: `testScripts/search.js`, 모듈화된 테스트 UI
  - 검색 결과 캐싱 시스템 (메모리 캐시, 1시간)
  - 한국어 위키피디아 우선 검색 후 영어 위키피디아 대체
  - AI 답변에 참조 자료로 활용 가능

- [ ] **네이버 검색 API 연동 (백엔드)**: 통합 검색 기능
  - 네이버 통합검색 API (`GET /api/search/naver`)
    - 일 25,000회 무료 제공 (개발자 등록 필요)
    - 웹문서, 뉴스, 블로그, 이미지, 백과사전, 카페글, 지식iN 검색
    - 지역 검색 기능 ('OO역 맛집' 등)
    - 환경변수: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
  - 성인 검색어 필터링 및 오타 교정 기능
  - API 사용량 모니터링 및 제한 관리

- [ ] **카카오(다음) 검색 API 연동 (백엔드)**: 이미지 및 웹 검색
  - 카카오 검색 API (`GET /api/search/kakao`)
    - 일 30,000회 무료 제공 (개발자 등록 필요)
    - 웹 검색, 이미지 검색, 동영상 검색
    - 지도/장소 검색 API 활용
    - 환경변수: `KAKAO_API_KEY`
  - 검색 결과 통합 및 중복 제거

- [ ] **OpenWeatherMap API 연동 (백엔드)**: 날씨 정보 위젯
  - 현재 날씨 조회 API (`GET /api/widgets/weather/current`)
    - 무료 60회/분, 1000회/일 (충분한 용량)
    - 위치별 현재 날씨, 온도, 습도, 바람
    - 환경변수: `OPENWEATHER_API_KEY`
  - 5일 예보 API (`GET /api/widgets/weather/forecast`)
  - 날씨 데이터 캐싱 (30분 간격)
  - 사용자 위치 기반 자동 날씨 조회

#### 쉬움 (Easy) - 기본적인 CRUD 및 데이터 관리
- [ ] **프로필 꾸미기 (백엔드)**: 테마, 뱃지 등 사용자 프로필 커스터마이징 데이터 저장/조회 API
  - 프로필 테마 설정 API (`PUT /api/users/profile/theme`)
  - 뱃지 목록 조회/설정 API (`GET|PUT /api/users/profile/badges`)
  - 커스터마이징 옵션 메타데이터 API (`GET /api/profile/customization-options`)

- [ ] **계정 레벨 기능 (백엔드)**: 사용자 레벨 관리 및 해금 시스템
  - 레벨/경험치 조회 API (`GET /api/users/level`)
  - 레벨업 처리 로직 (경험치 증가 시 자동 레벨업)
  - 레벨별 해금 기능 조회 API (`GET /api/users/unlocked-features`)

- [ ] **채팅 메시지 수정 기능 (백엔드)**: 메시지 편집 및 AI 재호출
  - 메시지 편집 API (`PUT /api/chat/messages/:message_id`)
  - 편집된 메시지에 대한 AI 재응답 로직
  - 메시지 수정 이력 관리 (선택사항)

- [ ] **언어 선택 기능 (백엔드)**: 다국어 지원 시스템
  - 사용자 언어 설정 저장/조회 API (`GET|PUT /api/users/language`)
  - 번역 리소스 관리 시스템
  - i18n 번역 키 관리 API (`GET /api/translations/:lang`)
  - 지원 언어: 한국어(ko), 영어(en), 일본어(ja)

- [ ] **드래그 기능 데이터 저장 (백엔드)**: 스티커/위젯 위치 정보 관리
  - 사용자별 UI 레이아웃 저장 API (`PUT /api/users/ui-layout`)
  - 드래그 위치/상태 정보 JSON 저장
  - 실시간 동기화를 위한 WebSocket 지원 (선택)

- [ ] **간단한 게임 데이터 관리 (백엔드)**: 게임 점수 및 진행상황 저장
  - 게임 점수/기록 저장 API (`POST /api/games/scores`)
  - 리더보드 조회 API (`GET /api/games/leaderboard`)
  - 게임별 설정/진행상황 관리

- [ ] **계정 데이터 저장/삭제 기능 (백엔드)**: 사용자 데이터 관리
  - 사용자 데이터 백업/내보내기 API (`GET /api/users/data-export`)
  - 개인정보 처리 규정 준수 (GDPR 스타일 데이터 삭제)
  - 계정 완전 삭제 API 개선 (연관 데이터 완전 삭제)

- [ ] **화면 강제 잠금 기능 (백엔드)**: 세션 잠금 상태 관리
  - 사용자 세션 잠금 상태 저장/조회 API (`GET|PUT /api/users/session-lock`)
  - PIN/패스워드 설정 및 검증 API (`POST /api/users/unlock-session`)
  - 잠금 설정 및 자동 잠금 시간 관리

#### 보통 (Medium) - 파일 처리 및 외부 연동
- [ ] **페이지 위젯 추가 (백엔드)**: 외부 API 연동 및 데이터 표시
  - 날씨 위젯 API 연동 (`GET /api/widgets/weather`)
    - OpenWeatherMap API 활용 (무료 60회/분, 1000회/일)
    - 위치별 현재 날씨, 5일 예보 제공
  - 캘린더 위젯 연동 (`GET /api/widgets/calendar`)
    - Google Calendar API 또는 공공 휴일 API 연동
  - 주식/금융 위젯 (`GET /api/widgets/finance`)
    - 무료 주식 API (Alpha Vantage, 한국투자증권 등)
  - 위젯 데이터 캐싱 시스템 (Redis)
  - 사용자별 위젯 설정 저장

- [ ] **문제 해결 챗봇 (백엔드)**: 튜토리얼 및 기본 시나리오 시스템
  - 시나리오 관리 API (`GET|PUT /api/chatbot/scenarios`)
  - 키워드 매칭 엔진 및 규칙 기반 응답
  - 튜토리얼 단계별 진행상황 추적 API (`GET|PUT /api/users/tutorial-progress`)
  - 사용자 질문 패턴 분석 및 FAQ 자동 업데이트

- [ ] **통합 검색 기능 확장 (백엔드)**: 다중 검색 엔진 통합
  - 통합 검색 결과 API (`GET /api/search/integrated`)
  - 네이버, 카카오, 위키피디아 결과 병합
  - 검색 결과 랭킹 및 중복 제거 알고리즘
  - 사용자별 검색 기록 저장 (선택적)

- [ ] **날씨 정보 위젯 (백엔드)**: OpenWeatherMap API 연동
  - 현재 날씨 조회 API (`GET /api/widgets/weather/current`)
    - OpenWeatherMap API 활용 (무료 60회/분, 1000회/일)
    - 위치별 현재 날씨, 온도, 습도, 바람
  - 5일 예보 API (`GET /api/widgets/weather/forecast`)
  - 위치 정보 기반 자동 날씨 조회
  - 날씨 데이터 캐싱 (1시간 간격)

- [ ] **공공데이터 기본 연동 (백엔드)**: 한국 공공데이터포털 API
  - 실시간 대기질 정보 API (`GET /api/widgets/air-quality`)
    - 한국환경공단 에어코리아 API (무료)
    - 지역별 미세먼지, 초미세먼지, 오존 수치
  - 공공데이터 캐싱 및 업데이트 스케줄링
  - 사용자 위치 기반 대기질 정보 제공

- [ ] **다국어 지원 (백엔드)**: 언어 설정 및 번역 리소스 관리
  - 사용자 언어 설정 저장/조회 API (`GET|PUT /api/users/language`)
  - 번역 리소스 관리 시스템
  - i18n 번역 키 관리 API (`GET /api/translations/:lang`)

- [ ] **페이지 위젯 (백엔드)**: 외부 API 연동 및 데이터 캐싱
  - 날씨 API 연동 (`GET /api/widgets/weather`)
    - OpenWeatherMap API 활용 (무료 60회/분, 1000회/일)
    - 위치별 현재 날씨, 5일 예보 제공
  - 캘린더 이벤트 연동 (`GET /api/widgets/calendar`)
  - 위젯 데이터 캐싱 시스템 (Redis)
  - 사용자별 위젯 설정 저장

- [ ] **통합 검색 기능 (백엔드)**: 다양한 무료 검색 API 연동
  - 네이버 통합 검색 API (`GET /api/search/naver`)
    - 웹, 뉴스, 블로그, 이미지 검색 (일 25,000회 무료)
    - 지식iN, 카페, 백과사전 등 특화 검색
  - 다음(카카오) 검색 API (`GET /api/search/daum`)
    - 웹 검색, 이미지 검색 (일 30,000회 무료)
    - 지도/장소 검색 API 활용
  - 위키피디아 API (`GET /api/search/wikipedia`)
    - 백과사전 정보 검색 (무료, 무제한)
    - 다국어 지원, 요약/전문 조회
  - 통합 검색 결과 정렬 및 캐싱

#### 어려움 (Hard) - 고급 AI 및 실시간 기능
- [ ] **AI 대화 요약 기능 (백엔드)**: 대화 내용 요약 및 최적화
  - 긴 대화 세션 자동 요약 API (`POST /api/chat/sessions/:session_id/summarize`)
  - 요약 AI 모델 연동 (Vertex AI 활용)
  - 요약 결과 캐싱 및 성능 최적화
  - API 비용 관리 및 모니터링

- [ ] **채팅 메모리/개인화 (백엔드)**: 장기 기억 관리 시스템
  - 사용자별 대화 컨텍스트 장기 저장
  - 벡터 DB 연동 (ChromaDB, Pinecone 등)
  - 개인화된 AI 응답 생성을 위한 컨텍스트 관리
  - 메모리 압축 및 중요도 기반 저장

- [ ] **음성 인식 및 TTS (백엔드)**: 오디오 처리 및 외부 서비스 연동
  - STT 서비스 연동 API (`POST /api/speech/transcribe`)
  - TTS 서비스 연동 API (`POST /api/speech/synthesize`)
  - 오디오 파일 처리 및 스트리밍
  - 음성 권한 관리 및 보안

- [ ] **실시간 검색 순위 (백엔드)**: 실시간 데이터 집계 시스템
  - 검색 로그 수집 및 실시간 집계
  - Redis/메모리 캐시 기반 순위 관리
  - 검색 트렌드 분석 API (`GET /api/search/trending`)
  - 네이버 데이터랩 API 연동 (키워드 트렌드 분석)

- [ ] **추천 검색 기능 (백엔드)**: ML 기반 추천 시스템
  - 사용자 행동 분석 로깅
  - 추천 알고리즘 구현 (협업 필터링, 컨텐츠 기반)
  - 개인화된 검색 결과 API (`GET /api/search/recommendations`)
  - 외부 API 결과 기반 개인화 필터링

- [ ] **공공데이터 활용 위젯 (백엔드)**: 한국 공공데이터포털 API 연동
  - 실시간 대기질 정보 (`GET /api/widgets/air-quality`)
    - 한국환경공단 에어코리아 API
  - 지역별 문화 행사 정보 (`GET /api/widgets/culture-events`)
    - 문화데이터광장 API 연동
  - 교통 정보 및 대중교통 (`GET /api/widgets/transport`)
    - 국토교통부 공간정보 오픈플랫폼 API
  - 공공데이터 캐싱 및 업데이트 관리

#### 매우 어려움 (Very Hard) - 복잡한 시스템 통합
- [ ] **쇼핑몰 연동 (백엔드)**: 외부 커머스 플랫폼 통합
  - 네이버 쇼핑 API 연동 (상품 검색, 가격 비교)
  - 쿠팡 파트너스 API 연동 (제휴 마케팅)
  - 상품 정보 동기화 및 캐싱
  - 주문/결제 시스템 연동
  - 재고 관리 및 주문 상태 추적

- [ ] **고급 공공데이터 통합 (백엔드)**: 다양한 정부 API 연동
  - 문화 행사 정보 API (`GET /api/widgets/culture-events`)
    - 문화데이터광장 API 연동 (무료)
    - 지역별 공연, 전시, 축제 정보
  - 교통 정보 API (`GET /api/widgets/transport`)
    - 국토교통부 공간정보 오픈플랫폼 API
    - 실시간 대중교통 정보, 교통상황
  - 경제 지표 API (`GET /api/widgets/economic-stats`)
    - 한국은행 ECOS API 연동 (무료)
    - 환율, 금리, 주요 경제지표

- [ ] **금융 정보 통합 (백엔드)**: 금융 데이터 API 연동 확장
  - 기업 정보 조회 API (`GET /api/finance/company-info`)
    - 금융감독원 DART API 연동 (무료)
    - 기업 재무정보, 공시 정보 조회
  - 주식 정보 API (`GET /api/finance/stock-info`)
    - 증권사 API 연동 (개발자 계정 필요)
    - 실시간 주식 시세, 차트 데이터
  - 금융 데이터 실시간 캐싱 및 알림

### 추가 백엔드 기능 분석 (사용자 요청 기반)

#### 기본 UI/UX 기능의 백엔드 지원
- [ ] **드래그 기능 데이터 저장 (백엔드)**: 스티커/위젯 위치 정보 관리
  - 사용자별 UI 레이아웃 저장 API (`PUT /api/users/ui-layout`)
  - 드래그 위치/상태 정보 JSON 저장
  - 실시간 동기화를 위한 WebSocket 지원 (선택)

- [ ] **간단한 게임 데이터 관리 (백엔드)**: 게임 점수 및 진행상황 저장
  - 게임 점수/기록 저장 API (`POST /api/games/scores`)
  - 리더보드 조회 API (`GET /api/games/leaderboard`)
  - 게임별 설정/진행상황 관리

#### 고급 검색 및 AI 기능 강화
- [ ] **AI 검색 통합 (백엔드)**: 검색 결과와 AI 응답 결합
  - 검색 결과 기반 AI 컨텍스트 생성
  - 실시간 웹 크롤링 결과를 AI 응답에 통합
  - 검색 의도 분석 및 맞춤형 응답 생성
  - Vertex AI와 외부 검색 API 연동 최적화

- [ ] **문제 해결 챗봇 시스템 (백엔드)**: 시나리오 기반 응답 시스템
  - 사전 정의된 시나리오 관리 API (`GET|PUT /api/chatbot/scenarios`)
  - 키워드 매칭 엔진 및 규칙 기반 응답
  - 튜토리얼 단계별 진행상황 추적
  - 사용자 질문 패턴 분석 및 FAQ 자동 업데이트

### 우선순위 재정렬 (무료 API 활용 중심)

#### 1순위 (즉시 구현 가능 - 무료, 무제한)
1. **위키피디아 API 연동** - ✅ **완료** (무료, 무제한, 간단한 구현)
   - 검색 결과를 AI 답변에 참조 자료로 활용 가능
   - 교육적 가치가 높은 백과사전 정보 제공

#### 2순위 (개발자 등록 필요, 무료 한도 내)
1. **네이버 검색 API** - 일 25,000회 무료 (충분한 용량)
   - 한국어 콘텐츠에 최적화된 검색 결과
   - 지역 검색, 뉴스, 블로그 등 다양한 분야

2. **카카오(다음) 검색 API** - 일 30,000회 무료 (넉넉한 용량)
   - 이미지 검색 및 지도 정보 활용도 높음
   - 카카오톡 연동 가능성 (향후 확장)

3. **OpenWeatherMap API** - 일 1,000회 무료 (위젯용으로 충분)
   - 날씨 위젯으로 실용적 가치 높음
   - 캐싱으로 API 호출 최소화 가능

#### 3순위 (정부 지원, 안정적 무료)
1. **한국 공공데이터포털 API** - 정부 제공, 대부분 무료
   - 대기질, 문화행사, 교통정보 등 실생활 정보
   - 한국 사용자에게 특화된 유용한 데이터

2. **한국은행 ECOS API** - 경제 데이터, 무료
   - 환율, 금리 등 금융 정보 위젯 활용 가능

#### 구현 전략 및 고려사항

1. **API 사용량 관리**
   - Redis를 활용한 일일 사용량 추적
   - API 키 로테이션 시스템 (여러 개발자 계정 활용)
   - 사용량 임계치 도달 시 자동 알림

2. **캐싱 전략**
   - 검색 결과: 1시간 캐싱 (동일 키워드 재검색 방지)
   - 날씨 데이터: 30분 캐싱 (적당한 실시간성)
   - 공공데이터: 24시간 캐싱 (업데이트 빈도 낮음)

3. **오류 처리 및 대체 방안**
   - API 장애 시 캐시된 데이터 활용
   - 여러 검색 엔진 중 일부 실패 시 다른 엔진 결과 사용
   - 사용량 초과 시 다음날까지 기능 일시 비활성화 안내

4. **데이터 품질 관리**
   - 검색 결과 필터링 (성인 콘텐츠, 스팸 등)
   - 응답 시간 모니터링 및 성능 최적화
   - 사용자 피드백 기반 검색 품질 개선

---

## 최신 시스템 상태 (2025-06-17 기준)

### 🔧 현재 기본 설정
- **기본 AI Provider**: `geminiapi` (Google AI Studio)
- **기본 모델**: `gemini-2.0-flash-thinking-exp-01-21`
- **테스트 사용자 ID**: `test-guest`
- **Vertex AI 모델**: `gemini-2.5-pro-exp-03-25` (대체 옵션)
- **Ollama 모델**: `gemma3:4b` (대체 옵션)

### 🌟 주요 최적화 사항
1. **UI/UX 개선**: Gemini 선택 시 Ollama 옵션 자동 비활성화
2. **자동 매핑**: 테스트 페이지에서 `gemini` → `geminiapi` 자동 변환
3. **기본값 통일**: 전체 시스템에서 Google AI Studio 우선 사용

### 🚀 성능 향상
- Gemini 2.0 Flash Thinking Exp의 고품질 응답 제공
- 스트림/캔버스 모드 완벽 지원
- 검색 기능과 AI 응답 통합

### 📋 주요 변경 사항 요약 (2025-06-17)
1. **기본 AI Provider 변경**: `vertexai` → `geminiapi` (Google AI Studio)
2. **기본 모델 업데이트**: `gemini-2.0-flash-thinking-exp-01-21` 사용
3. **UI 개선**: Gemini 선택 시 Ollama 옵션 자동 비활성화
4. **자동 변환**: 프론트엔드에서 `gemini` → `geminiapi` 매핑

### 🔍 디버깅 로그 개선
- chatController에 AI provider 결정 로그 추가
- 요청 파라미터 디버깅 로그 활성화
- AI provider 매핑 상태 실시간 확인 가능

---
````