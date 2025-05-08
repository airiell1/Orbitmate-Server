# copilot-instructions.md는 코파일럿이 할 작업 목록 및 AI 메모장입니다.
- AI는 언제든 이 문서를 수정할 수 있습니다.

# AI 메모 및 버그 트래킹

## 프로세스 트리와 코드 구조

### 서버 진입점
- server.js: 메인 서버 진입점, 포트 설정, 앱 실행
- app.js: Express 앱 설정, 미들웨어, 라우트 연결

### 데이터베이스
- config/database.js: DB 연결 설정, 풀 관리
  - getConnection(): DB 연결 획득
  - oracledb: Oracle DB 라이브러리

### API 및 라우트
- routes/users.js: 사용자 관련 라우트
- routes/chat.js: 채팅 관련 라우트
- routes/sessions.js: 세션 관련 라우트

### 컨트롤러 (비즈니스 로직)
- controllers/userController.js: 사용자 컨트롤러
  - registerUserController(): 회원가입
  - loginUserController(): 로그인
  - getUserSettingsController(): 설정 조회
  - updateUserSettingsController(): 설정 업데이트
  - getUserProfileController(): 프로필 조회
  - updateUserProfileController(): 프로필 업데이트
  - deleteUserController(): 회원 탈퇴

- controllers/chatController.js: 채팅 컨트롤러
  - sendMessageController(): 메시지 전송 및 AI 응답 처리
  - editMessageController(): 메시지 편집
  - deleteMessageController(): 메시지 삭제
  - addReactionController(): 리액션 추가
  - removeReactionController(): 리액션 제거
  - uploadFile(): 파일 업로드

- controllers/sessionController.js: 세션 컨트롤러
  - createSessionController(): 세션 생성
  - getSessionsController(): 세션 목록 조회
  - updateSessionController(): 세션 정보 업데이트
  - deleteSessionController(): 세션 삭제
  - getSessionMessagesController(): 세션 메시지 조회

### 모델 (데이터 접근 계층)
- models/user.js: 사용자 모델
  - registerUser(): 회원가입
  - loginUser(): 로그인
  - getUserSettings(): 설정 조회
  - updateUserSettings(): 설정 업데이트
  - getUserProfile(): 프로필 조회
  - updateUserProfile(): 프로필 업데이트
  - updateUserProfileImage(): 프로필 이미지 업데이트
  - addUserExperience(): 경험치 추가
  - deleteUser(): 사용자 삭제

- models/chat.js: 채팅 모델
  - getChatHistoryFromDB(): 채팅 기록 조회
  - saveUserMessageToDB(): 사용자 메시지 저장
  - saveAiMessageToDB(): AI 메시지 저장
  - saveAttachmentToDB(): 첨부파일 저장
  - deleteUserMessageFromDB(): 메시지 삭제

- models/session.js: 세션 모델
  - createChatSession(): 세션 생성
  - getUserChatSessions(): 사용자 세션 목록
  - updateChatSession(): 세션 정보 업데이트
  - deleteChatSession(): 세션 삭제
  - getSessionMessages(): 세션 메시지 조회
  - getUserIdBySessionId(): 세션 ID로 사용자 ID 조회

### 프론트엔드
- public/script.js: 메인 채팅 UI 스크립트
  - initializeSession(): 세션 초기화
  - addMessage(): 메시지 UI 추가
  - sendMessage(): 메시지 전송
  - startEditing(): 메시지 편집 시작
  - saveEdit(): 메시지 편집 저장
  - deleteMessage(): 메시지 삭제

- public/testScript.js: 테스트 페이지 스크립트
  - 다양한 API 호출 테스트 함수들
  - UI 업데이트 함수들
  - refreshSessionMessages(): 세션 메시지 새로고침

- public/promptFeature.js: 채팅 프롬프트 기능
  - 프롬프트 버튼 생성 및 이벤트 처리

## 버그 수정 및 이슈 트래킹
### [2025-05-08] 테스트 세션 새로고침 및 긴 AI 응답 표시 개선
- 문제: 테스트 페이지에서 메시지 전송 후 새로고침 시점이 어색하거나, 긴 AI 응답이 클라이언트에서 잘려서 '유효한 응답을 받지 못했습니다'로 표시됨.
- 원인:
    1. `testScript.js`에서 `sendMessage()` 후 UI 동기화가 불완전하여 새로고침 시점이 어색함.
    2. 긴 AI 응답을 그대로 `addMessage`로 넘기면 DOM/브라우저에서 렌더링이 불안정해지거나, 클라이언트 측에서 처리 가능한 최대 길이를 초과하여 문제 발생.
    3. `models/chat.js`의 `saveAiMessageToDB` 함수에서 AI 응답(CLOB)을 `RETURNING` 절로 받을 때 `maxSize`가 충분하지 않아 "NJS-016: buffer is too small for OUT binds" 오류 발생 및 이로 인해 AI 메시지 ID와 내용이 제대로 반환되지 않음.
- 해결책:
    1. `testScript.js`의 `sendMessage()` 함수에서 AI 응답이 매우 길 경우, 앞부분만 요약하여 `addMessage`로 표시하고, 전체 내용은 API 응답 패널이나 다른 방식으로 확인할 수 있도록 안내하는 것을 고려합니다. (프론트엔드 작업)
    2. 메시지 전송 후 `refreshSessionMessages()`를 호출하여 UI와 DB 간의 동기화를 강화합니다. (프론트엔드 작업)
    3. `models/chat.js`의 `saveAiMessageToDB` 함수에서 `RETURNING ... INTO :content` 부분의 `content` 바인드 변수 설정에 `maxSize`를 충분히 큰 값(예: `1024 * 1024`)으로 지정하여 NJS-016 오류를 해결하고, AI 메시지 ID와 함께 변환된 문자열 내용을 정상적으로 반환하도록 수정했습니다.
- 상태: ✅ 일부 해결됨 (백엔드 CLOB 처리 및 반환값 문제 해결, 프론트엔드 UI 개선 필요)

### [2025-05-08] CLOB 데이터 처리 및 반환 오류
- 문제: `chat_messages` 테이블의 `message_content` (CLOB) 컬럼 조회 시, Oracle 드라이버가 스트림 형태로 반환하여 클라이언트에 직접 전달하거나 Vertex AI에 전송할 때 문제가 발생. 특히 `saveAiMessageToDB`에서 AI 응답 저장 후 `RETURNING`으로 받는 `message_content`가 스트림 객체로 반환되어 `sendMessageController`에서 클라이언트에 AI 응답 내용을 제대로 전달하지 못함.
- 원인: Node.js oracledb 드라이버에서 CLOB 타입은 기본적으로 스트림으로 처리됨. 이를 문자열로 명시적으로 변환해야 함.
- 해결책:
    - `models/chat.js`에 `clobToString` 유틸리티 함수를 구현하여 CLOB 스트림을 UTF-8 문자열로 변환.
    - `getChatHistoryFromDB`, `saveAiMessageToDB`, `getSessionMessagesForClient` 함수 내에서 CLOB 데이터를 조회하거나 반환할 때 `clobToString`을 사용하여 문자열로 변환 후 처리하도록 수정.
    - `saveAiMessageToDB`에서 `RETURNING` 절로 받은 CLOB `content`를 `clobToString`으로 변환하여 반환 객체에 포함시킴.
- 상태: ✅ 해결됨

### [2025-05-08] Vertex AI 중복 전송 문제
- 문제: 메시지 전송 시 DB에 저장된 사용자 메시지를 포함한 전체 대화 기록과 현재 사용자 메시지가 함께 Vertex AI로 전송되어, 결과적으로 사용자 메시지가 AI 모델에 두 번 전달됨.
- 원인: `sendMessageController`에서 `getChatHistoryFromDB`를 통해 가져온 대화 기록에 이미 현재 사용자 메시지가 포함되어 있을 수 있는데, `getAiResponse` 호출 시 현재 사용자 메시지를 다시 추가하여 발생.
- 해결책: `sendMessageController`에서 `getAiResponse` 호출 전, `chatHistory`의 마지막 메시지가 현재 사용자의 메시지와 동일하면 `chatHistory`에서 해당 메시지를 제거하는 로직 추가.
- 상태: ✅ 해결됨

### [2025-05-08] Vertex AI 중복 응답 문제
- 문제: 동일한 메시지 전송 시 Vertex AI 응답이 두 번 반환됨 ("안녕" → "안녕하세요! 😊 무엇을 도와드릴까요?" 2회)
- 원인: public/testScript.js에서 sendMessage() 함수에 메시지 중복 전송 방지 플래그(isMessageSending)가 없어서, 버튼 클릭/엔터 입력 시 빠르게 두 번 호출될 수 있었음
- 해결책: testScript.js에 isMessageSending 플래그 추가 및 finally에서 해제하도록 수정
- 상태: ✅ 해결됨

### [2025-05-08] 새 메시지 전송 시 부모 키 제약 조건 위반 오류
- 문제: 존재하지 않는 세션 ID로 메시지 전송 시 ORA-02291 오류(integrity constraint violated - parent key not found) 발생
- 해결책: saveUserMessageToDB 함수에 세션 존재 여부 확인 로직 추가 및 에러 메시지 개선
- 상태: ✅ 해결됨


### [2025-05-08] 메시지 CLOB 롤백 및 처리
- 문제: 긴 메시지, AI 응답 등 4000자 초과 메시지 저장 필요. VARCHAR2(4000) 한계로 인해 오류 발생 및 메시지 잘림 현상.
- 결정: chat_messages.message_content 컬럼을 CLOB으로 롤백(재변경)하여 긴 메시지 지원.
- 추가 이슈: CLOB 타입은 Oracle에서 스트림으로 반환되므로, Node.js에서 저장/조회 시 문자열 변환 처리 필요.
- 작업: sqldb.sql, models/chat.js, controllers/chatController.js 등 CLOB 대응 코드로 일괄 수정.
- 상태: 진행 중 (2025-05-08)

### [2025-05-08] 세션이 메인 페이지에서 2회 호출되는 문제
- 문제: index.html에서 script.js와 promptFeature.js 모두 DOM 로드 시 초기화 작업이 중복 실행됨
- 해결책: script.js에 세션 초기화 플래그 추가 및 DOMContentLoaded 이벤트에서 한 번만 실행되도록 변경
- 상태: ✅ 해결됨

### [이전] ORA-01400 에러 (AI가 빈 응답을 줄 때)
- 문제: chat.js에서 MESSAGE_CONTENT가 NULL일 때 Oracle 에러 발생
- 해결책: saveAiMessageToDB()에서 빈 응답 검사 및 기본 메시지 설정 추가
- 상태: ✅ 해결됨

### [이전] ORA-01747 에러 (user.table.column)
- 문제: Oracle의 'user' 예약어 사용으로 인한 충돌
- 해결책: SQL 쿼리에서 테이블 별칭 사용 (예: 'u' 대신 'user')
- 상태: ✅ 해결됨

### [이전] 테스트에서 세션 중복 문제
- 문제: 테스트 중 세션이 계속 생성되는 문제
- 해결책: test.html에 세션 관리 버튼 추가 및 리셋 기능 구현
- 상태: ✅ 해결됨

### [이전] "AI: undefined" 메시지 문제
- 문제: 메시지 로딩 시 내용이 없는 경우 undefined 표시됨
- 해결책: 내용이 없을 때 대체 텍스트 표시
- 상태: ✅ 해결됨

### [이전] 메시지 중복 전송 문제
- 문제: 버튼 연속 클릭 시 동일 메시지 중복 전송
- 해결책: isMessageSending 플래그 및 버튼 비활성화 구현
- 상태: ✅ 해결됨

### [이전] 메시지 편집 기능 개선
- 문제: 기존 메시지 편집 UI/UX 부재
- 해결책: 인라인 편집 기능 및 편집 표시 추가
- 상태: ✅ 해결됨

# 아키텍처 원칙
- **클라이언트-서버-DB/외부 API 분리**: 클라이언트는 서버 API를 통해서만 데이터베이스 또는 외부 API(Vertex AI 등)와 상호작용해야 합니다. 클라이언트가 직접 DB나 외부 API에 접근하는 것은 허용되지 않습니다.

# 백엔드 구현 작업 목록

## AI 작업 지침
- 사용자 요청: 인증/보안 기능 최소화 (이유: 현재 학습 및 기능 구현에 집중하기 위함. 실제 프로덕션 환경에서는 보안이 매우 중요하지만, 현 단계에서는 핵심 로직 이해와 빠른 프로토타이핑을 우선으로 함. 추후 보안 강화 예정).
- 사용자 요청: README.AI 작업 목록 순서대로 진행.
- 사용자 요청: 프론트엔드 작업은 제외.

## 핵심 채팅 기능
- [x] **채팅 메시지 전송 API 구현 (`POST /api/chat/sessions/:session_id/messages`)**
- [x] **채팅 세션 삭제 API 구현 (`DELETE /api/chat/sessions/:session_id`)**
- [x] **채팅 메시지 삭제 API 구현 (`DELETE /api/chat/messages/:message_id`)**
- [x] **메시지 리액션 제거 API 구현 (`DELETE /api/chat/messages/:message_id/reaction`)**
    - [x] `chat_messages` 테이블에 파일 정보(경로, 타입 등) 저장 필드 추가 또는 별도 테이블 관리
    - [x] 파일 다운로드/접근 권한 관리 // 사용자의 요청으로 인증/인가 최소화

## 백엔드 시스템 개선 및 기타
- [x] **사용자 인증 및 인가 강화** // 사용자의 요청으로 인증/인가 최소화 또는 제거됨
    - [x] JWT(JSON Web Token) 발급 및 검증 미들웨어 구현 (기본 구현 완료)
    - [x] 로그인 시 JWT 발급, 이후 API 요청 시 헤더에서 토큰 검증 (구현 완료)
    - [x] 각 API 엔드포인트에 필요한 역할/권한 기반 인가 로직 추가 (세션/메시지 삭제 인가 강화 완료)
- [ ] **API 엔드포인트 전반적인 오류 처리 개선**
    - [x] 일관된 오류 응답 구조 정의 (예: `{ "error": { "code": "...", "message": "..." } }`)
    - [x] 주요 오류 상황에 대한 상세 로깅 추가
    - [ ] 모든 컨트롤러에 표준화된 오류 처리 적용
- [ ] **모든 API 엔드포인트에 대한 상세 입력값 유효성 검사 추가**
    - [ ] 각 필드 타입, 길이, 필수 여부 등 상세 검증 규칙 적용
- [ ] **데이터베이스 커넥션 풀 관리 최적화**
    - [ ] 불필요한 커넥션 유지 방지
- [ ] **(선택) WebSocket을 이용한 실시간 메시지 전송 구현**
    - [ ] 클라이언트 연결 관리 및 메시지 브로드캐스팅 로직 구현