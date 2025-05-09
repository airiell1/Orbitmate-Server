# copilot-instructions.md (백업)

이 파일은 기존 copilot-instructions.md의 백업본입니다. 원본은 아래와 같습니다.

---

# copilot-instructions.md는 코파일럿이 할 작업 목록 및 AI 메모장입니다.
- AI는 언제든 이 문서를 수정할 수 있습니다.

요청: API 입/출력구조는 변경하지 말고, API 엔드포인트는 변경하지 마세요.
- AI는 이 문서에 있는 작업 목록을 기반으로 코드를 작성합니다.

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
(이하 생략)
