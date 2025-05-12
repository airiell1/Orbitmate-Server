# Orbitmate Copilot Instructions

이 문서는 Orbitmate 프로젝트의 AI 코파일럿 및 신규 진입자를 위한 실전 운영 가이드, 구조 요약, 버그 트래킹, 작업 목록을 포함합니다.
**AI는 언제든 이 문서를 수정·추가·정리할 수 있습니다.**

---


## 1. 프로젝트 구조 및 주요 진입점

- **서버 진입점**
  - `server.js`: 서버 실행, 포트 설정
  - `app.js`: Express 앱/미들웨어/라우트 연결

- **DB/외부 연동 (config/)**
  - `config/database.js`:
    - Oracle DB 연결, 커넥션 풀 관리, Thick 모드(Instant Client) 지원
    - 환경변수 기반 설정 (user, password, connectString)
    - 주요 함수 및 내보내기:
      - `initOracleClient()`: Oracle Instant Client 경로로 Thick 모드 초기화 (윈도우 환경 등에서 필수)
      - `initializeDbPool()`: 커넥션 풀 생성 및 초기화
      - `getConnection()`: 커넥션 획득 (풀에서)
      - `oracledb`: oracledb 인스턴스 전체 내보내기 (트랜잭션, CLOB 등 활용)
    - 참고: 커넥션 풀은 app.js/server.js에서 최초 1회만 초기화 필요. 각 모델/컨트롤러에서는 getConnection()으로 커넥션 획득 후 사용/반납.

  - `config/vertexai.js`:
    - Vertex AI 연동, Google Cloud Gemini 2.5 pro 모델 사용
    - 안전성 필터(증오/성적/위험/학대), 스트림/캔버스/검색 등 특수 모드 지원
    - 주요 함수 및 내보내기:
      - `getAiResponse(currentUserMessage, history, systemMessageText, specialModeType, streamResponseCallback)`: Vertex AI에 대화 요청, 스트림/캔버스/검색 등 특수 모드 지원 (systemPrompt, specialModeType, stream 콜백 등 다양한 옵션 지원)
      - `vertex_ai`: VertexAI 인스턴스 (직접 모델 생성/설정 가능)
      - `generativeModel`: Gemini 2.5 pro 모델 인스턴스 (기본 설정)
    - 참고: specialModeType에 따라 systemPrompt가 자동 강화(캔버스/검색 등), streamResponseCallback으로 스트리밍 응답 처리 가능

- **API 라우트**
  - `routes/users.js`, `routes/chat.js`, `routes/sessions.js`

- **컨트롤러**

  - `controllers/userController.js`: 사용자 회원가입, 로그인, 설정/프로필 조회·수정, 프로필 이미지 업로드, 회원 탈퇴 등 사용자 관련 API 처리
    - 주요 함수:
      - `registerUserController()`: 회원가입
      - `loginUserController()`: 로그인 (JWT 발급)
      - `getUserSettingsController()`, `updateUserSettingsController()`: 사용자 설정 조회/수정
      - `getUserProfileController()`, `updateUserProfileController()`: 프로필 조회/수정
      - `uploadProfileImageController()`: 프로필 이미지 업로드
      - `deleteUserController()`: 회원 탈퇴

  - `controllers/chatController.js`: 채팅 메시지 전송, AI 응답, 메시지 편집/삭제/리액션, 파일 업로드 등 채팅 관련 API 처리
    - 주요 함수:
      - `sendMessageController()`: 메시지 전송 및 AI 응답 처리 (Vertex AI 연동)
      - `editMessageController()`: 메시지 편집
      - `addReactionController()`, `removeReactionController()`: 메시지 리액션 추가/제거
      - `deleteMessageController()`: 메시지 삭제
      - `uploadFile()`: 파일 업로드 및 첨부파일 DB 저장
      - `getSessionMessagesController()`: 세션별 메시지 목록 조회

  - `controllers/sessionController.js`: 채팅 세션 생성/조회/수정/삭제 등 세션 관련 API 처리
    - 주요 함수:
      - `createSessionController()`: 세션 생성
      - `getUserSessionsController()`: 사용자 세션 목록 조회
      - `updateSessionController()`: 세션 정보 수정
      - `getSessionMessagesController()`: 세션 메시지 목록 조회
      - `deleteSessionController()`: 세션 삭제

- **모델**
  - `models/user.js`: 사용자 관련 DB 접근 함수 (회원가입, 로그인, 설정/프로필 조회·수정, 프로필 이미지, 경험치/레벨, 회원 탈퇴)
    - 주요 함수:
      - `registerUser(username, email, password)`: 회원가입, 비밀번호 해시, 중복 체크, 기본 설정/프로필 생성
      - `loginUser(email, password)`: 로그인, 비밀번호 검증, 계정 활성화 체크, 로그인 시간 업데이트
      - `getUserSettings(user_id)`, `updateUserSettings(user_id, settings)`: 사용자 설정 조회/수정
      - `getUserProfile(user_id)`, `updateUserProfile(user_id, profileData)`: 프로필 조회/수정
      - `updateUserProfileImage(user_id, profileImagePath)`: 프로필 이미지 경로 업데이트
      - `addUserExperience(user_id, points)`: 경험치 추가 및 레벨업 처리
      - `deleteUser(user_id)`: 회원 탈퇴(계정 및 연관 데이터 삭제)

  - `models/chat.js`: 채팅 메시지, 첨부파일, CLOB 변환 등 채팅 관련 DB 접근 함수
    - 주요 함수:
      - `getChatHistoryFromDB(connection, sessionId, includeCurrentUserMessage)`: 세션별 대화 기록 조회 (Vertex AI 포맷)
      - `saveUserMessageToDB(connection, sessionId, user_id, message)`: 사용자 메시지 저장 (CLOB)
      - `saveAiMessageToDB(connection, sessionId, user_id, message)`: AI 메시지 저장 (CLOB, RETURNING)
      - `saveAttachmentToDB(messageId, file)`: 첨부파일 정보 저장
      - `deleteUserMessageFromDB(messageId, user_id)`: 메시지 삭제 (user_id 체크 최소화)
      - `getSessionMessagesForClient(sessionId)`: 세션 전체 메시지(첨부 포함) 조회 (CLOB 변환)
      - `clobToString(clob)`: Oracle CLOB → 문자열 변환 유틸

  - `models/session.js`: 채팅 세션 생성/조회/수정/삭제 등 세션 관련 DB 접근 함수
    - 주요 함수:
      - `createChatSession(user_id, title, category)`: 세션 생성
      - `getUserChatSessions(user_id)`: 사용자 세션 목록 조회
      - `updateChatSession(sessionId, updates)`: 세션 정보 수정 (제목, 카테고리, 보관 등)
      - `deleteChatSession(sessionId, user_id)`: 세션 삭제 (메시지/세션 트랜잭션)
      - `getSessionMessages(sessionId)`: 세션 메시지 목록 조회 (CLOB 변환)
      - `getUserIdBySessionId(sessionId)`: 세션 ID로 사용자 ID 조회

- **프론트엔드**

  - `public/script.js`: 메인 채팅 프론트엔드 스크립트
    - 주요 함수:
      - `initializeSession()`: 세션 초기화 및 자동 연결
      - `addMessage()`: 채팅 메시지 UI 추가
      - `sendMessage()`: 메시지 전송 및 응답 처리
      - `startEditing()`, `saveEdit()`, `deleteMessage()`: 메시지 편집/삭제

  - `public/testScript.js`: API 테스트 및 디버깅용 프론트엔드 스크립트
    - 주요 역할:
      - 다양한 API 호출 테스트 함수 (회원가입, 로그인, 세션/메시지/파일 등)
      - 테스트용 채팅 UI 및 API 응답 패널 관리
      - `refreshSessionMessages()`: 세션 메시지 새로고침

  - `public/promptFeature.js`: 채팅 프롬프트(시스템 프롬프트) UI 기능
    - 주요 역할:
      - 프롬프트 버튼 및 옵션 패널 생성
      - 프롬프트 선택 시 입력창 dataset에 저장
      - 채팅 입력 UX 개선

---

## 2. 운영 및 진단 가이드

- **문제 발생 시**
  - 에러, 비표준 코드, API/DB 불일치, UI-API 연동 문제 등은 즉시 "버그 트래킹"에 기록
  - 신규 진입자/AI가 빠르게 구조를 파악할 수 있도록, 주요 진입점·데이터 흐름·테스트/디버깅 팁·자주 쓰는 명령어 등 요약

- **테스트/디버깅 체크리스트**
  - test.html, testScript.js, script.js에서 버튼/입력/이벤트 정상 동작 확인
  - DOM 요소와 JS 코드 연결, 이벤트 리스너 누락/중복 점검
  - API 호출 시 실제 네트워크 요청 및 UI 반영, 콘솔 에러/경고 없는지 확인

- **코드 일관성**
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

---

## 4. 작업 목록 (진행상황 체크)

- [x] 채팅 메시지 전송 API (`POST /api/chat/sessions/:session_id/messages`)
- [x] 채팅 세션 삭제 API (`DELETE /api/chat/sessions/:session_id`)
- [x] 채팅 메시지 삭제 API (`DELETE /api/chat/messages/:message_id`)
- [x] 메시지 리액션 제거 API (`DELETE /api/chat/messages/:message_id/reaction`)
- [x] 파일 업로드/다운로드/권한 관리 (인증 최소화)
- [x] JWT 인증/인가 (학습용 최소 구현)
- [ ] API 오류 처리 표준화 및 상세화
- [ ] 입력값 유효성 검사 강화
- [ ] DB 커넥션 풀 최적화
- [ ] API 응답 케이싱 통일 (standardizeApiResponse 유틸리티 추가 및 적용)
- [ ] (선택) WebSocket 실시간 메시지

---

## 5. 아키텍처 원칙

- **클라이언트-서버-DB/외부 API 분리**: 클라이언트는 서버 API를 통해서만 DB/외부 API와 상호작용. 직접 접근 금지.

---

## 6. 기타

- **정기적 점검 및 메모**: AI는 이 문서를 주기적으로 점검, 개선 아이디어/구조적 문제/반복 실수/테스트 자동화 필요성 등을 자유롭게 메모/추가
- **문제 발생 시 즉시 기록**: 에러, 비표준 코드, API/DB 불일치, UI-API 연동 문제 등은 즉시 "버그 트래킹"에 기록


---

## 7. API 테스트 데이터/문서화/DB 일관성 가이드

**테스트 유저/세션/메시지 고정값 및 오버라이드 규칙 (상세)**
  - 모든 API 문서, 예시, 기본값, 실제 DB/백엔드 로직에서 아래 고정값을 반드시 사용(불변):
    - 유저:  
      - username: `APItest`
      - email: `API@example.com`
      - password: `password123`
      - user_id: `API_TEST_USER_ID`
    - 세션:  
      - session_id: `API_TEST_SESSION_ID`
    - 메시지:  
      - user_message_id: `API_TEST_USER_MESSAGE_ID`
      - ai_message_id: `API_TEST_AI_MESSAGE_ID`
  - **관례/자동화**:  
    - 테스트 유저/세션/메시지는 항상 동일 ID로 생성/덮어쓰기(중복 생성 X, 기존 데이터 자동 삭제)
    - 테스트 세션 생성 시, 두 개의 기본 메시지(유저/AI)도 자동 생성
    - 예시)  
      - 회원가입/로그인/세션생성/메시지전송 등 모든 테스트 API는 위 고정값을 기본값으로 사용  
      - 기존에 동일 ID가 있으면 자동 삭제 후 새로 생성(덮어쓰기)
  - **문제/원인/해결**:  
    - (예시) "테스트 계정이 여러 번 생성되어 user_id가 달라지는 문제" → 기존 데이터 자동 삭제 및 고정값 덮어쓰기 로직으로 해결
    - (예시) "테스트 세션 생성 시 메시지 ID가 매번 달라짐" → 세션 생성 시 두 개의 메시지도 고정 ID로 자동 생성

**API 문서/예시/기본값/실제 응답 동기화 (상세)**
  - `routes/apiDocs.js`의 모든 예시 요청/응답, 폼 기본값, 설명은 실제 백엔드 출력과 1:1로 맞출 것
  - 신규/수정 API 추가 시, 예시/기본값/응답 구조를 반드시 실 API 결과와 비교·동기화
  - 필드명, casing, 값 타입(문자열/숫자/객체 등)까지 실제 응답과 일치시킬 것
  - **예시)**
    - API 문서 예시:
      {
        "user_id": "API_TEST_USER_ID",
        "username": "APItest",
        "email": "API@example.com"
      }
    - 실제 응답(JSON)도 위와 완전히 동일해야 함(필드명, casing, 타입, 값)
  - **문제/원인/해결**
    - (예시) "API 문서 예시와 실제 응답 구조가 다름" → 실제 응답 기준으로 문서/예시/기본값 모두 동기화
    - (예시) "폼 기본값이 실제 테스트 계정과 다름" → 자동 입력 로직으로 고정값 반영

**Oracle CLOB/LOB 반환 및 필드 casing 이슈 (상세)**
  - Oracle DB에서 CLOB/BLOB 필드는 JS 객체로 반환될 수 있음(예: BIO, MESSAGE_CONTENT 등)
  - 일부 응답에서 CLOB 객체가 그대로 노출되는 경우 있음 → `clobToString` 등 유틸로 문자열 변환 필요
  - 필드명 casing(대문자/소문자) 불일치 주의: API 문서/코드/DB 모두 일관성 유지, 불가피할 경우 변환/주석 명시
  - **문제/원인/해결**
    - (예시) "메시지 내용이 { type: 'CLOB', ... } 형태로 반환됨" → `clobToString` 유틸로 문자열 변환 후 응답
    - (예시) "DB 필드명은 대문자, JS/문서에서는 소문자" → 컨트롤러/모델에서 casing 변환 또는 주석 명시
    - (예시) "API 응답이 일관되지 않은 케이싱 사용" → `standardizeApiResponse` 유틸리티로 모든 API 응답에 일관된 snake_case 적용
  - **상태/관례**
    - CLOB/LOB 자동 변환 및 casing 표준화는 향후 백엔드에서 일괄 개선 예정
    - **현재 개선 방안**: 
      1. `utils/apiResponse.js` 유틸리티 추가 (표준화된 응답 처리)
      2. `utils/dbUtils.js` 유틸리티 확장 (CLOB 필드 자동 변환)
      3. 모든 컨트롤러에서 일관된 응답 처리 적용 (DB → convertClobFields → standardizeApiResponse → 응답)

**테스트/문서화 관례 (상세)**
  - 테스트용 API 호출, 예시, 기본값, 응답 구조는 항상 위 고정값/구조를 따름
  - 신규 진입자/AI는 반드시 실제 API 호출 결과와 문서 예시를 비교하여 불일치 즉시 수정
  - **예시)**
    - testScript.js, test.html 등에서 API 호출 시 자동으로 고정값 입력
    - 신규 API/문서 추가 시, 실제 응답을 복사하여 예시/기본값/문서에 반영
  - **문제/원인/해결**
    - (예시) "문서 예시와 실제 응답이 다름" → 실제 응답 기준으로 문서/예시/기본값 모두 동기화

**향후/확장 아이디어**
  - AI가 유저 메시지에 자동 리액션(이모지 등) 기능 추가 고려
    - 예: 메시지 전송 시 AI가 자동으로 👍, 😂 등 리액션 부여
  - 메시지 전송 API(`sendMessageController`)에 스트리밍 옵션 추가 및 문서화 필요(예: stream=true 쿼리)
    - 예: stream=true 옵션 시, 응답을 스트리밍으로 전송/프론트에서 실시간 표시
  - CLOB/LOB 자동 변환 및 응답 표준화(백엔드 개선 예정)
    - 예: 모든 CLOB/BLOB 필드는 자동으로 문자열/버퍼로 변환 후 응답
  - API 응답 케이싱 표준화
    - 모든 API 응답을 일관된 snake_case로 변환하는 미들웨어 또는 전역 유틸 적용
    - 구현: `standardizeApiResponse` 유틸리티 함수를 모든 컨트롤러에서 사용하도록 일괄 적용

**유지보수자를 위한 메모 (상세)**
  - 테스트 데이터/문서/DB/코드가 불일치하면 디버깅/자동화/신규 기능 개발이 매우 어려워짐
  - 모든 예시/기본값/응답 구조는 실제 동작과 반드시 일치시킬 것(수정 시 이 섹션도 함께 갱신)
  - **예시)**
    - 신규 진입자/AI가 테스트/문서/코드/DB 구조를 빠르게 파악할 수 있도록, 이 섹션을 항상 최신 상태로 유지
    - 반복되는 실수/불일치/이슈는 즉시 이 섹션에 기록 및 개선

---

## 8. 필드명 casing(네이밍) 규칙

- **snake_case(소문자+언더스코어)**:  
  - DB 컬럼, 백엔드 모델/컨트롤러/응답(JSON), API 문서(exampleReq/exampleRes/params 등)  
  - 예시: `user_id`, `created_at`, `session_id`, `message_content`
- **camelCase**:  
  - 프론트엔드 JS 코드 내부 변수/상태/함수명  
  - 예시: `user_id`, `createdAt`, `sessionId`, `messageContent`
- **변환 규칙**:  
  - DB→백엔드→API 응답: snake_case로 통일  
  - 프론트엔드에서 필요시 camelCase로 변환(또는 snake_case 그대로 사용)
- **유틸 함수**:  
  - Oracle 등에서 대문자/카멜/스네이크 혼용시, `toSnakeCaseObj` 유틸로 일괄 변환
- **예시**
  - API 응답/문서:
    ```json
    {
      "user_id": "API_TEST_USER_ID",
      "created_at": "2025-05-09T12:00:00.000Z"
    }
    ```
  - 프론트엔드 변수:
    ```js
    const user_id = response.user_id;
    ```

---