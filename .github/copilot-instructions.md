주요 사항
실제 프론트엔드는 다른 프로젝트에서 운영되고 있습니다.
이곳의 public/testScripts 폴더는 백엔드 API 테스트용 코드입니다.
사용자가 명시적으로 요청하지 않는 한, 테스트 코드는 수정하지 않습니다.
실제 프론트엔드에서 발생하는 문제는 백엔드 API 수정으로 해결해야 합니다.
테스트용 고정 ID('test-user-id' 등)는 사용하지 않고, 실제 동적 ID를 사용해야 합니다.

---

## [2025-06-26] 시스템 구조/운영/리팩토링 검증 요약 (자동화 보고서 기반)

### 1. 구조/기능/명세 일치성
- config, middleware, models, controllers, utils 폴더 전체가 SYSTEM_ARCHITECTURE.md 기준 100% 일치
- ServiceFactory/Repository/Middleware/Provider 패턴, 트랜잭션/에러/응답 표준화, 관심사 분리 등 설계 원칙 준수
- Oracle DB 구조, 주요 테이블/컬럼/관계, 트랜잭션/커넥션 관리, RESTful 엔드포인트, snake_case 응답, HTTP 상태코드, 에러코드 표준화 모두 일치

### 2. 미세 리팩토링/개선 포인트 및 잠재적 에러
- config: 환경변수 유효성, 안내 메시지, graceful degradation 등
- middleware/models: connection 주입 일관성, autoCommit, 중복 로직, 에러코드 표준화 등
- controllers: 유효성 검사/에러코드/응답 포맷 중복, 파일 업로드 예외, 외부 API 장애 대응 등

### 3. 컨트롤러/모델/미들웨어 상세 검증
- 모든 컨트롤러는 ServiceFactory 패턴 기반, dataExtractor/validations/responseTransformer/errorHandler 일관성 유지
- chat.js, user.js 등 모델은 connection 첫 인자, 트랜잭션/에러처리/주석/에러코드/autoCommit/withTransaction 패턴 일치
- 미들웨어는 구독/권한/일일제한/파일업로드 제한 등 명세와 일치, 표준 에러코드(403, 429, 413 등) 사용

### 4. 구조적 불일치 없음 (2025-06-25 기준)
- SYSTEM_ARCHITECTURE.md 기준 구조/기능/명세 100% 일치
- 모든 계층/패턴/핵심 기능이 설계 의도대로 구현됨
- 미세 리팩토링/안정성 개선 여지 외 구조적 문제 없음

### 5. 참고: 자동화 검증/분석 보고서 활용법
- .github/orbitmate-검증-분석-리포트.md, .github/orbitmate-퍼블릭-이슈.md 참고
- 구조/기능/명세 일치성, 미세 리팩토링 포인트, 잠재적 에러, 개선점 등 실무 적용에 유용

---

## 1. 프로젝트 구조 및 주요 진입점

외부문서로 분리
SYSTEM_ARCHITECTURE.md 참고

---

## 2. 운영 및 진단 가이드

- **문제 발생 시**
  - 에러, 비표준 코드, API/DB 불일치, UI-API 연동 문제 등은 즉시 "버그 트래킹"에 기록
  - 신규 진입자/AI가 빠르게 구조를 파악할 수 있도록, 주요 진입점·데이터 흐름·테스트/디버깅 팁·자주 쓰는 명령어 등 요약

- **테스트/디버깅 체크리스트**
  - test.html, testScript.js, script.js에서 버튼/입력/이벤트 정상 동작 확인
  - DOM 요소와 JS 코드 연결, 이벤트 리스너 누락/중복 점검
  - API 호출 시 실제 네트워크 요청 및 UI 반영, 콘솔 에러/경고 없는지 확인
  - Markdown 렌더링 및 코드 하이라이팅 정상 작동 확인

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

---
### [2025-06-26] 유틸리티 계층 구조/표준화/역할 상세 분석

- **dbUtils.js**
  - withTransaction: 트랜잭션 자동 관리(커밋/롤백/커넥션 close), 서비스 계층에서 DB 작업 래핑
  - clobToString: Oracle CLOB/Stream을 안전하게 문자열로 변환
  - toSnakeCaseObj, convertClobFields: DB 결과 snake_case 변환, CLOB 필드 일괄 변환

- **apiResponse.js**
  - standardizeApiResponse: 모든 API 응답을 statusCode/body 구조로 표준화, snake_case 일관성
  - getHttpStatusByErrorCode: 에러코드별 HTTP 상태코드 매핑

- **errorHandler.js**
  - handleOracleError: Oracle/일반 에러를 표준화된 Error 객체(code/message/details)로 변환
  - getHttpStatusByErrorCode: 에러코드별 HTTP 상태코드 반환(중복 정의, 통합 필요)

- **validation.js**
  - validateUserId, validateEmail, validateStringLength 등 공통 입력값 유효성 검사 함수 제공
  - validateRequiredFields: 필수 필드 일괄 체크

- **fileUtils.js**
  - safeDeleteFile, safeDeleteMultipleFiles: 파일 안전 삭제(에러 무시 옵션)
  - fileExists: 파일 존재 여부 확인
  - 기타 파일 관련 유틸리티 함수

- **serviceFactory.js/controllerFactory.js/modelFactory.js**
  - createService, createController 등 팩토리 패턴으로 계층별 표준 래퍼 제공
  - 트랜잭션, 전/후처리, 에러처리, 캐싱 등 옵션화

---

---
### [2025-06-26] 서비스 계층 구조/표준화/역할 상세 분석

- **공통 원칙**
  - 모든 서비스 함수는 비즈니스 로직/트랜잭션 관리 담당, DB 작업은 모델 계층에 위임
  - 트랜잭션은 반드시 utils/dbUtils.js의 withTransaction으로 관리, 콜백 내에서 모델 함수 호출
  - 입력값 유효성 검증은 컨트롤러에서 1차 수행, 서비스에서는 비즈니스 규칙(권한, 중복 등) 검증
  - 에러는 필요시 code/message를 가진 Error 객체로 throw, 모델에서 throw된 에러는 그대로 전달
  - 외부 API 연동, 캐싱, 복합 데이터 가공 등도 서비스 계층에서 처리

- **chatService.js**
  - 채팅 메시지 전송/AI 응답/메시지 편집/리액션 등 채팅 관련 비즈니스 로직 담당
  - 구독 일일 사용량 체크, AI provider/model 결정, 사용자 설정 반영 등 복합 로직 처리
  - 모든 DB 작업은 withTransaction 내에서 모델 함수 호출로 일관

- **sessionService.js**
  - 채팅 세션 생성/조회/수정/삭제 등 세션 관련 비즈니스 로직 담당
  - 트랜잭션 내에서 모델 함수 호출, 추가 데이터 가공/알림 등 확장 가능

- **subscriptionService.js**
  - 구독 등급/정보/업데이트/취소/이력/권한/사용량 등 구독 관련 비즈니스 로직 담당
  - 한영 등급명 매핑, 무료 구독 자동 생성, 트랜잭션 일관성 보장

- **userProfileService.js / userSettingsService.js**
  - 사용자 프로필/설정/이미지 등 관리, 트랜잭션 내에서 모델 함수 호출
  - 파일 시스템 작업은 컨트롤러에서, DB 경로 저장은 서비스에서 처리

- **userActivityService.js**
  - 경험치/레벨/뱃지/활동 로그 등 사용자 활동 관련 비즈니스 로직 담당
  - 트랜잭션 내에서 모델 함수 호출, 프로필 자동 생성 등 예외 처리

- **searchService.js / translationService.js**
  - 외부 API(위키피디아, 날씨 등) 연동, 번역 리소스 관리 등
  - 모델 함수 호출 및 에러 표준화, 미구현 기능은 FEATURE_NOT_IMPLEMENTED 에러 throw

---

---
### [2025-06-26] 라우터 폴더 구조/표준화/역할 상세 분석

- **공통 원칙**
  - 모든 라우터는 express.Router() 기반, RESTful 경로 설계 원칙 준수
  - 컨트롤러 계층만 호출, 비즈니스 로직/DB 접근 금지
  - 인증/권한/구독 등 미들웨어는 필요한 엔드포인트에만 명확히 적용
  - 파일 업로드 등 특수 기능은 multer 등 미들웨어로 분리
  - 경로/함수명/컨트롤러명 일관성 유지, copilot-instructions.md와 상시 교차 점검

- **chat.js**
  - 채팅 세션/메시지/리액션/편집 등 채팅 관련 모든 엔드포인트 제공
  - 파일 업로드(multer) 경로 분리, 업로드 디렉토리 자동 생성
  - 구독 기능 제한(requireFeature) 등 미들웨어 적용
  - 인증 미들웨어(verifyToken)는 현재 제거, 추후 필요시 재적용 가능

- **sessions.js**
  - 사용자별 채팅 세션 목록 조회 전용 라우트
  - 인증 미들웨어(verifyToken) 제거, 단순화

- **users.js**
  - 회원가입/로그인/이메일 중복/프로필/설정/언어 등 사용자 관련 모든 엔드포인트 제공
  - 프로필 이미지 업로드(multer) 경로 분리, 파일명에 user_id+timestamp 적용
  - Phase별(핵심/확장/테스트)로 라우트 구분, 컨트롤러 함수 일관성 유지

- **subscriptions.js**
  - 구독 등급/정보/업데이트/취소/이력/권한/사용량 등 구독 관련 모든 엔드포인트 제공
  - 시뮬레이션(업그레이드/갱신) 등 테스트용 엔드포인트 포함
  - RESTful 경로 설계, 컨트롤러 함수와 1:1 매핑

---

---
### [2025-06-26] 모델 계층 구조/표준화/역할 상세 분석

- **공통 원칙**
  - 모든 모델 함수는 첫 번째 인자로 반드시 connection 객체를 받음 (getConnection 직접 호출 금지)
  - 트랜잭션/커밋/롤백/커넥션 close는 서비스 계층에서만 처리, 모델에서는 autoCommit: false 유지
  - 에러 발생 시 utils/errorHandler.js의 handleOracleError로 표준화 후 throw
  - DB 조회 결과는 snake_case 변환(toSnakeCaseObj) 후 반환, CLOB 필드는 clobToString 등으로 문자열 변환
  - 입력값 검증/유효성 체크는 서비스 또는 컨트롤러에서 수행, 모델에서는 최소한의 DB 제약만 체크
  - 모델 함수 내에서 console.log 등 직접 로깅 최소화, 필요시 중앙 로거 또는 에러핸들러 사용

- **user.js**
  - 회원가입/로그인/설정/프로필/레벨/뱃지/언어/번역 등 사용자 관련 모든 DB 작업 담당
  - registerUser, loginUser 등은 입력값 검증, bcrypt 해싱, 중복 체크, 고정 ID 지원, 트랜잭션 일관성 보장
  - 경험치/레벨/뱃지/활동 로그 등은 handleUserActivity 등 통합 함수로 관리, 래퍼 함수로 하위 호환성 유지
  - 모든 에러는 표준화된 code/message로 throw, UNIQUE/NOT_FOUND/INVALID_INPUT 등 명확한 코드 사용
  - CLOB, 날짜 등 특수 필드는 변환 후 반환, snake_case 일관성

- **subscription.js**
  - 구독 등급/정보/업데이트/취소/이력/권한/사용량 등 구독 관련 모든 DB 작업 담당
  - getUserSubscription, updateUserSubscription 등은 트랜잭션 일관성, 무료 구독 자동 생성, 등급명 한영 매핑 지원
  - features_included 등 JSON/CLOB 필드는 파싱 후 반환, tier 정보는 중첩 객체로 구조화
  - 에러 발생 시 handleOracleError로 표준화, RESOURCE_NOT_FOUND 등 명확한 코드 사용

- **session.js**
  - 채팅 세션 생성/조회/수정/삭제, 메시지 목록, 세션-사용자 매핑 등 담당
  - 테스트 환경 고정 ID 지원, 세션/메시지 동시 생성 및 정리, 트랜잭션 일관성 보장
  - 모든 반환값은 snake_case, CLOB 메시지 변환, is_archived 등 boolean 변환
  - 에러는 handleOracleError로 표준화, SESSION_NOT_FOUND 등 명확한 코드 사용

- **chat.js**
  - 채팅 메시지 CRUD, 히스토리, 편집, 리액션, AI 메시지 저장 등 담당
  - 모든 함수는 connection 첫 인자, 트랜잭션/에러/autoCommit 패턴 일치
  - 메시지 내용은 CLOB 변환, snake_case 일관성, 에러 표준화

- **search.js**
  - 위키피디아/날씨/위치 등 외부 API 연동 및 캐싱, 검색 결과 포맷팅, 캐시 관리 등 담당
  - 메모리 캐시(Map) 기반, 캐시 만료/최대 크기/통계/삭제 등 유틸 제공
  - 외부 API 장애 시 캐시된 데이터 우선 반환, 한영 자동 재시도, 에러 발생 시 빈 배열 반환(throw 최소화)
  - 모든 함수는 async/await, 에러/로깅 표준화, 반환 포맷 일관성

---
---
### [2025-06-26] 모델 계층 구조/표준화/역할 상세 분석

- **공통 원칙**
  - 모든 모델 함수는 첫 번째 인자로 반드시 connection 객체를 받음 (getConnection 직접 호출 금지)
  - 트랜잭션/커밋/롤백/커넥션 close는 서비스 계층에서만 처리, 모델에서는 autoCommit: false 유지
  - 에러 발생 시 utils/errorHandler.js의 handleOracleError로 표준화 후 throw
  - DB 조회 결과는 snake_case 변환(toSnakeCaseObj) 후 반환, CLOB 필드는 clobToString 등으로 문자열 변환
  - 입력값 검증/유효성 체크는 서비스 또는 컨트롤러에서 수행, 모델에서는 최소한의 DB 제약만 체크
  - 모델 함수 내에서 console.log 등 직접 로깅 최소화, 필요시 중앙 로거 또는 에러핸들러 사용

- **user.js**
  - 회원가입/로그인/설정/프로필/레벨/뱃지/언어/번역 등 사용자 관련 모든 DB 작업 담당
  - registerUser, loginUser 등은 입력값 검증, bcrypt 해싱, 중복 체크, 고정 ID 지원, 트랜잭션 일관성 보장
  - 경험치/레벨/뱃지/활동 로그 등은 handleUserActivity 등 통합 함수로 관리, 래퍼 함수로 하위 호환성 유지
  - 모든 에러는 표준화된 code/message로 throw, UNIQUE/NOT_FOUND/INVALID_INPUT 등 명확한 코드 사용
  - CLOB, 날짜 등 특수 필드는 변환 후 반환, snake_case 일관성

- **subscription.js**
  - 구독 등급/정보/업데이트/취소/이력/권한/사용량 등 구독 관련 모든 DB 작업 담당
  - getUserSubscription, updateUserSubscription 등은 트랜잭션 일관성, 무료 구독 자동 생성, 등급명 한영 매핑 지원
  - features_included 등 JSON/CLOB 필드는 파싱 후 반환, tier 정보는 중첩 객체로 구조화
  - 에러 발생 시 handleOracleError로 표준화, RESOURCE_NOT_FOUND 등 명확한 코드 사용

- **session.js**
  - 채팅 세션 생성/조회/수정/삭제, 메시지 목록, 세션-사용자 매핑 등 담당
  - 테스트 환경 고정 ID 지원, 세션/메시지 동시 생성 및 정리, 트랜잭션 일관성 보장
  - 모든 반환값은 snake_case, CLOB 메시지 변환, is_archived 등 boolean 변환
  - 에러는 handleOracleError로 표준화, SESSION_NOT_FOUND 등 명확한 코드 사용

- **chat.js**
  - 채팅 메시지 CRUD, 히스토리, 편집, 리액션, AI 메시지 저장 등 담당
  - 모든 함수는 connection 첫 인자, 트랜잭션/에러/autoCommit 패턴 일치
  - 메시지 내용은 CLOB 변환, snake_case 일관성, 에러 표준화

- **search.js**
  - 위키피디아/날씨/위치 등 외부 API 연동 및 캐싱, 검색 결과 포맷팅, 캐시 관리 등 담당
  - 메모리 캐시(Map) 기반, 캐시 만료/최대 크기/통계/삭제 등 유틸 제공
  - 외부 API 장애 시 캐시된 데이터 우선 반환, 한영 자동 재시도, 에러 발생 시 빈 배열 반환(throw 최소화)
  - 모든 함수는 async/await, 에러/로깅 표준화, 반환 포맷 일관성

---

---
### [2025-06-26] 미들웨어 구조/표준화/역할 상세 분석

- **auth.js (인증 미들웨어)**
  - JWT 기반 인증 처리: `generateToken`, `verifyToken` 함수 제공
  - 환경설정은 반드시 config/index.js에서 관리 (process.env 직접 사용 금지)
  - 인증 실패/만료/유효성 오류 시 표준화된 에러코드(`UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`)로 next(error) 전달
  - req.user에 인증된 사용자 정보(payload) 주입, 직접 res.status().json() 사용 금지

- **logger.js (API 로깅 미들웨어)**
  - 모든 API 요청/응답/에러를 파일(`logs/api.log`)과 콘솔에 표준 포맷으로 기록
  - 요청/응답/에러/타임아웃/파일정리 등 전 과정 자동화
  - 민감정보(비밀번호 등) 마스킹, JSON 변환 실패 시 안전 처리
  - 에러는 중앙 에러 핸들러로 전달, 서버 시작 시 로깅 시스템 자동 초기화
  - 7일 이상된 로그 파일 자동 삭제(정책화)

- **subscription.js (구독/권한/제한 미들웨어)**
  - 구독 등급별 기능 제한: `requireFeature`, `requireTierLevel` 등으로 세분화
  - 일일 사용량 제한: `checkDailyLimit` 미들웨어에서 트랜잭션 일관성 보장
  - 파일 업로드 크기 제한: `checkFileUploadLimit`에서 구독 등급별 허용 용량 체크, 초과 시 413 반환
  - 모든 미들웨어는 트랜잭션 기반으로 DB 일관성 유지, req에 구독/사용량 정보 주입
  - 권한 부족(403), 사용량 초과(429), 파일 초과(413) 등 표준 HTTP 상태코드 및 메시지 반환
  - 에러 발생 시 콘솔/로그 기록 후 500 반환, 직접 res.status().json() 사용(에러 응답만 예외적 허용)

---

  - 날짜, 문제/원인/해결책/상태 순으로 간결하게 기록
  - 예시:
    - `[2025-05-08] 긴 AI 응답 표시 문제: testScript.js에서 addMessage로 넘길 때 잘림 → 응답 요약 표시 및 전체 내용은 패널 안내로 개선 (프론트엔드)`
    - `[2025-05-08] CLOB 반환 오류: Oracle CLOB 스트림 → clobToString 유틸 추가로 해결 (백엔드)`
    - `[2025-05-09] API 응답 케이싱 불일치: Oracle DB 필드가 대문자로 반환되어 응답이 API 문서와 불일치 → standardizeApiResponse 유틸로 snake_case 통일, CLOB 자동 변환 추가 (백엔드)`

---
### [2025-06-26] 컨트롤러 리팩토링/표준화/통합 최신 반영

- **ServiceFactory 기반 컨트롤러 구조 표준화**: 모든 주요 컨트롤러(chat, session, subscription, user 등)는 ServiceFactory 패턴 기반으로 통일, createController에서 withTransaction 중복 래핑 제거(트랜잭션은 서비스 계층에서만 관리)
- **컨트롤러-서비스-모델 계층 분리**: 컨트롤러는 서비스 계층만 호출, 서비스에서 트랜잭션 관리, 모델은 connection 첫 인자 고정
- **API 응답 표준화**: 모든 컨트롤러에서 utils/apiResponse.js의 standardizeApiResponse 사용, statusCode/body 구조로 응답, snake_case 일관성 유지
- **에러 처리 일원화**: try-catch 후 next(error)로 중앙 에러 핸들러에 위임, 직접 res.status().json()으로 에러 응답 금지
- **입력값 검증/에러코드/응답 포맷 중복 제거**: dataExtractor/validations/responseTransformer/errorHandler 패턴 일관 적용
- **테스트/고정 ID 컨트롤러 분리**: registerUserController, loginUserController 등은 테스트 모드에서 직접 구현, 고정 ID 반환
- **신규 기능 컨트롤러**: 프로필 꾸미기, 레벨 시스템, 메시지 편집, 다국어 지원 등 신규 API 컨트롤러 추가 및 표준화
- **컨트롤러 내 디버깅 로그 개선**: AI provider 결정, 요청 파라미터, 스트리밍/DB 저장/Markdown 렌더링 성공여부 등 주요 상태 로그 추가

---

[2025-05-30] getConnection 함수 미정의 오류: chatController.js에서 config/database.js의 getConnection 함수를 import하지 않아서 발생 → import 문에 getConnection 추가 (해결)
[2025-06-02] API 응답 형식 통일: standardizeApiResponse 함수를 원래 방식으로 복원 (단일 데이터 객체 반환), 검색 API는 createSearchApiResponse로 분리 (성공시 데이터 직접 반환, 실패시 에러 메시지 반환) (해결)
[2025-06-02] 위키피디아 API 구현 완료: 백엔드/프론트엔드/테스트 UI 모두 구현, 검색 기능 정상 작동 확인 (해결)
[2025-06-10] 기본 AI Provider 변경: ollama → vertexai 전체 시스템 변경 완료 (해결)

[2025-06-10] 테스트 페이지 UI 개선: Gemini 선택 시 Ollama 옵션 자동 비활성화 및 gemini → vertexai 자동 변환 완료 (해결)
[2025-06-17] API 라우트 404 오류: 서버 IP 변경 시 API 요청이 404 에러 발생 → 라우트 설정 및 서버 연결 상태 확인 필요 (진행중)
[2025-06-17] 회원탈퇴 후 CASCADE 오류: 사용자 삭제 시 연관 메시지/세션이 CASCADE로 삭제되어 리액션 API에서 참조 오류 발생 → 리액션 API에서 메시지 존재 여부 체크 강화 및 우아한 오류 처리 필요 (해결)
[2025-06-17] 기본 AI Provider 변경: vertexai → geminiapi (Google AI Studio) 전체 시스템 변경 완료 (해결)
[2025-06-17] Google AI Studio API 통합: config/geminiapi.js 추가, 최신 공짜모델인 gemini-2.0-flash-thinking-exp-01-21 모델 사용 (해결)
[2025-06-17] API 명세 업데이트: geminiapi provider 추가, 기본값 변경 반영 완료 (해결)
[2025-06-19] HTTP SSE 스트리밍 시스템 최적화: 모든 WebSocket 관련 코드 제거, HTTP SSE 스트리밍만 사용하도록 단순화 → 팀원 사용 편의성 대폭 향상 (해결)
[2025-06-23] 구독 등급 체계 업데이트: 새로운 구독 등급으로 변경 완료 (☄️ 코멧-무료, 🪐 플래닛-월1.5만원, ☀️ 스타-월15만원, 🌌 갤럭시-기업용월300만원), 갤럭시는 기업용으로 프로필 뱃지 제공하지 않음, DB 스키마 확장 완료 (해결)
[2025-06-20] Markdown 렌더링 구현: 메인/테스트 페이지에 Marked.js + Highlight.js 통합, AI 응답 Markdown 자동 렌더링, 코드 하이라이팅, 완전한 CSS 스타일링 적용 (해결)
[2025-06-23] 7~10번 기능 구현 완료: 프로필 꾸미기, 레벨 시스템, 메시지 편집, 다국어 지원 백엔드 구현 (해결)
  - DB 스키마 확장: user_badges, level_requirements, user_experience_log, user_items, message_edit_history, translation_resources 테이블 추가
  - 프로필 꾸미기 API: 테마, 테두리, 배경, 상태 메시지 커스터마이징 지원
  - 레벨 시스템: 경험치 자동 계산, 레벨업 처리, 뱃지 자동 지급, 경험치 배수 아이템 지원
  - 메시지 편집: 편집 기록 저장, AI 재응답 요청, 권한 체크 강화
  - 다국어 지원: 번역 리소스 관리, 사용자별 언어 설정
  - 테스트 UI 추가: test.html에 모든 신규 기능 테스트 인터페이스 구현

[2025-01-27] 자동 API 테스트 시스템 완전 구현: 전체 API 엔드포인트 자동 테스트, 고정 ID 시스템 통합, 결과 내보내기/지우기 기능, 테스트 UI 완전 복구 (해결)
  - public/testScripts/autoApiTest.js: 포괄적 자동 테스트 시스템 구현, 25개 주요 API 엔드포인트 테스트 자동화
  - 고정 ID 시스템: email이 "API@example.com"일 때 user_id="API_TEST_USER_ID", session_id="API_TEST_SESSION_ID" 등 테스트용 고정값 사용
  - 테스트 결과 관리: JSON 파일 내보내기, 결과 지우기, DOM 기반 실시간 결과 표시
  - 오류 복구: Oracle NJS-044 파라미터 바인딩 오류 해결, ServiceFactory 이중 트랜잭션 래핑 제거
  - UI 복구: public/test.html의 "전체 API 테스트 실행" 버튼 및 관련 컨트롤 완전 복구
  - ES6 모듈 통합: testScript.js에서 동적 import로 autoApiTest.js 로드 및 이벤트 연결
  - 테스트 커버리지: 사용자/세션/메시지/구독/검색/프로필/뱃지/번역 API 전 영역 포함
  - 성공률 추적: 테스트 성공/실패 통계, 타임스탬프, 상세 오류 정보 제공
  - models/user.js: handleUserActivity 통합 함수 추가, 기존 3개 함수는 래퍼로 하위 호환성 유지
  - controllers/userController.js: handleUserActivityController 통합 컨트롤러 추가, 기존 3개 컨트롤러는 래퍼로 변경
  - 동일한 기능(경험치 지급, 활동 로그, 뱃지 처리)을 하나의 함수에서 activity_type으로 분기 처리하여 코드 중복 제거
[2025-06-25] ServiceFactory 트랜잭션 중복 래핑 문제 재발 및 해결: utils/serviceFactory.js의 createController에서 withTransaction 중복 래핑으로 인한 NJS-044 Oracle 바인딩 에러 재발 → createController에서 withTransaction 제거하여 서비스 계층에서만 트랜잭션 관리하도록 재수정 (해결)
  - 문제: createController에서 withTransaction → 서비스에서 withTransaction → 모델로 connection 전달 시 인자 순서가 바뀌어서 NJS-044 Oracle 바인딩 에러 발생
  - 해결: createController에서 withTransaction 제거, 서비스 계층에서만 트랜잭션 관리하도록 재수정
  - 영향: ServiceFactory 기반 컨트롤러의 모든 API (세션/메시지/구독 등) 정상 작동 복원
[2025-06-25] 테스트 페이지 모듈 import 오류 해결: public/testScripts/utils.js에 displayApiResponse, displayError 함수가 없어서 badgeLevel.js에서 import 실패 → utils.js에 누락된 함수들 추가 (해결)
  - 문제: badgeLevel.js에서 './utils.js'의 displayApiResponse, displayError 함수를 import하려 했으나 해당 함수들이 export되지 않음
  - 해결: utils.js에 displayApiResponse, displayError 함수 추가 및 export
  - 영향: 테스트 페이지의 모든 모듈 정상 작동 복원
[2025-06-25] 고정 ID 시스템 구현 완료: API_TEST_USER_ID, API_TEST_SESSION_ID 등 테스트용 고정 ID 시스템 정상 작동 (해결)
  - 문제: 회원가입/세션 생성 시 랜덤 ID 생성으로 테스트 일관성 부족
  - 해결: utils/constants.js에 테스트 상수 정의, registerUserController/loginUserController를 직접 구현으로 수정하여 withTransaction 사용
  - 결과: user_id="API_TEST_USER_ID", session_id="API_TEST_SESSION_ID" 고정 반환 확인
  - 추가: NODE_ENV='test' 설정으로 테스트 모드 활성화, ServiceFactory 대신 직접 구현으로 connection 객체 문제 해결
[2025-06-26] 유효성 검사 중복 정의 및 'undefined' 세션 ID 오류 해결: utils/validation.js에서 validateBatch, validateSessionId 함수 중복 정의 제거 및 개선 (해결)
  - 문제: validateBatch 함수가 두 번 정의되어 충돌 발생, validateSessionId도 중복 정의로 혼란 야기
  - 문제: URL에서 'undefined' 문자열이 세션 ID로 전달되어 "세션 ID가 제공되지 않았습니다" 에러 반복 발생
  - 문제: 영어/한국어 에러 메시지 혼재로 일관성 부족
  - 해결: validateBatch 함수 통합, validateSessionId/validateMessageId/validateUserAccess/validateFileType 함수 개선
  - 해결: 'undefined', 'null' 문자열 명시적 체크 추가, 한국어 에러 메시지 통일
  - 해결: req 객체와 일반 값 모두 처리 가능하도록 유연한 함수 구조로 개선
  - 영향: chatController.js의 모든 유효성 검사 안정화, 프론트엔드에서 undefined 전달 시에도 명확한 에러 메시지 제공
[2025-06-26] SSE 스트리밍 응답 형식 불일치 해결: [DONE] 문자열을 JSON 형태로 통일 (해결)
  - 문제: SSE 스트리밍에서 완료 신호만 `data: [DONE]` 문자열로 전송되어 다른 JSON 이벤트와 일관성 부족
  - 문제: 프론트엔드에서 JSON 파싱 시도 후 문자열 체크하는 이중 로직으로 코드 복잡성 증가
  - 해결: utils/serviceFactory.js에서 `data: [DONE]`을 `data: {"done":true}`로 변경
  - 해결: script.js와 testScripts/chat.js에서 `data === '[DONE]'` 체크를 `chunkData.done === true` JSON 파싱으로 통일
  - 해결: 파싱 실패 예외 처리에서 `data !== '[DONE]'` 조건 제거하여 로직 단순화
  - 영향: SSE 스트리밍의 모든 이벤트가 JSON 형태로 통일, 클라이언트 처리 로직 일관성 향상

[2025-06-26] API 명세서 응답 형식 표준화: 모든 API 응답을 {status, data/error} 구조로 통일 (해결)
  - 문제: API 명세서에서 일부 응답이 구 형식({message: ...})으로 표기되어 실제 응답과 불일치
  - 문제: SSE 스트리밍 응답 형식에 대한 명세 부족으로 개발자 혼란 야기
  - 해결: public/api_docs.js에서 모든 성공 응답을 {status: "success", data: {...}} 형식으로 통일
  - 해결: SSE 스트리밍 응답 형식 상세 설명 추가 (이벤트 타입, 완료 신호, 최종 응답 등)
  - 해결: 채팅 메시지 전송 API에 일반 응답과 SSE 스트리밍 응답 예시 모두 포함
  - 영향: API 문서와 실제 응답 형식 완전 일치, 개발 시 혼란 제거

[2025-06-30] 메시지 조회 시 사용자 ID 정확성 개선: 세션 소유자 정보를 정확하게 반환하도록 수정 (해결)
  - 문제: 세션 메시지 목록 조회 시 일부 메시지에서 잘못된 사용자 정보 표시
  - 해결: getSessionMessages 함수에서 먼저 chat_sessions 테이블에서 실제 세션 소유자 ID를 조회
  - 해결: 사용자 메시지(message_type='user')의 경우 실제 세션 소유자 ID로 교체, AI 메시지는 기존 user_id 유지
  - 해결: 세션 존재 여부 및 권한 체크를 메시지 조회 전에 수행하여 보안 강화
  - 영향: GET /api/chat/sessions/:session_id/messages API에서 정확한 사용자 ID 반환, 메시지 소유권 명확화

---
## 중요: 코드베이스 리팩토링 관련 최신 지침 (YYYY-MM-DD 업데이트)

이 프로젝트는 최근 주요 리팩토링을 거쳤습니다. 아래 지침을 반드시 숙지하고 코드를 수정해주십시오.

### 1. 설정 관리 (`config/index.js`)

- 모든 환경 변수 및 주요 설정은 `config/index.js` 파일을 통해 접근해야 합니다.
- `process.env`를 코드베이스 다른 곳에서 직접 사용하지 마십시오.
- 예시: `const config = require('../config'); const dbUser = config.database.user;`

### 2. 데이터베이스 연결 및 트랜잭션 (`utils/dbUtils.js`의 `withTransaction`)

- **모델 함수**:
    - 모든 데이터베이스 작업을 수행하는 모델 함수는 첫 번째 인자로 `connection` 객체를 받아야 합니다.
    - 모델 함수 내에서 `getConnection()`, `connection.close()`, `connection.commit()`, `connection.rollback()`을 직접 호출해서는 안 됩니다.
    - SQL 실행 시 `autoCommit` 옵션은 `false`로 설정하거나, `withTransaction`의 기본 동작에 맡깁니다.
- **서비스 함수**:
    - 데이터베이스 트랜잭션이 필요한 비즈니스 로직은 서비스 함수 내에서 `utils/dbUtils`의 `withTransaction(async (connection) => { ... })` 유틸리티 함수로 감싸야 합니다.
    - 이 콜백 함수 내에서 모델 함수를 호출할 때 `connection` 객체를 전달합니다.
    - 여러 모델 함수 호출이나 데이터 가공 로직이 포함될 수 있습니다.
- **컨트롤러 함수**:
    - 컨트롤러는 서비스 계층의 함수를 호출합니다. `withTransaction`을 직접 사용하지 않습니다 (서비스 계층에서 처리).
- 예시 (서비스 함수):
  ```javascript
  // services/someService.js
  const { withTransaction } = require("../utils/dbUtils");
  const myModel = require("../models/myModel");

  async function doSomethingComplex(userId, dataToProcess) {
    return await withTransaction(async (connection) => {
      const item = await myModel.getItem(connection, dataToProcess.itemId);
      if (!item) throw new Error("아이템을 찾을 수 없습니다.");
      // ... (데이터 가공 및 추가 DB 작업) ...
      await myModel.updateItem(connection, item.id, { processed: true });
      await myModel.logAction(connection, userId, "PROCESS_ITEM", item.id);
      return { success: true, processedItemId: item.id };
    });
  }
  ```
- 예시 (컨트롤러 함수):
  ```javascript
  // controllers/someController.js
  const someService = require("../services/someService");
  const { standardizeApiResponse } = require("../utils/apiResponse");

  async function handleRequest(req, res, next) {
    try {
      const result = await someService.doSomethingComplex(req.user.id, req.body);
      const apiResponse = standardizeApiResponse(result);
      res.status(apiResponse.statusCode).json(apiResponse.body);
    } catch (error) {
      next(error); // 중앙 에러 핸들러로 전달
    }
  }
  ```

### 3. API 응답 형식 (`utils/apiResponse.js`)

- 모든 컨트롤러의 API 응답은 `utils/apiResponse.js`의 `standardizeApiResponse(data, error = null)` 함수를 사용하여 생성해야 합니다.
- 이 함수는 `{ statusCode, body }` 객체를 반환합니다.
- 컨트롤러에서는 `res.status(apiResponse.statusCode).json(apiResponse.body);` 형태로 응답합니다.
- 성공 시: `standardizeApiResponse(dataToReturn)` -> `{ statusCode: 2xx, body: { status: 'success', data: ... } }`
- 에러 시: `standardizeApiResponse(null, errorObject)` -> `{ statusCode: 4xx/5xx, body: { status: 'error', error: { code, message, details } } }` (에러 객체는 `code`, `message`, `details` 속성을 가질 수 있음)

### 4. 에러 처리 (`utils/errorHandler.js`)

- **컨트롤러**:
    - `try...catch` 블록을 사용하여 서비스 계층에서 발생할 수 있는 모든 에러를 포착해야 합니다.
    - `catch` 블록에서는 받은 에러 객체를 그대로 `next(error)`를 호출하여 중앙 에러 핸들러로 전달합니다.
    - 컨트롤러에서 직접 새로운 에러 객체를 생성하거나 `res.status().json()`으로 에러 응답을 보내지 마십시오 (입력값 검증 실패 시에는 컨트롤러에서 `INVALID_INPUT` 에러 객체 생성 후 `next(error)` 가능).
- **서비스**:
    - 비즈니스 로직 수행 중 발생하는 특정 에러 (예: "리소스를 찾을 수 없음", "권한 부족")는 `code`와 `message`를 가진 새로운 `Error` 객체를 생성하여 `throw` 합니다. 이 에러는 컨트롤러로 전파됩니다.
    - 모델에서 throw된 DB 관련 에러는 그대로 다시 throw하거나, 필요시 서비스 특화 에러로 변환하여 throw 할 수 있습니다.
- **모델**:
    - DB 관련 에러 발생 시, `utils/errorHandler.js`의 `handleOracleError(oraError)` 함수를 사용하여 표준화된 에러 객체(Error 인스턴스에 `code`, `message`, `details` 포함)를 생성하여 `throw` 해야 합니다.
    - 데이터 조회 결과가 없는 경우 등은 모델 레벨에서 에러를 throw 하거나 (예: `RESOURCE_NOT_FOUND`), null 또는 빈 배열을 반환하여 서비스 계층에서 처리하도록 할 수 있습니다 (일관된 방식 선택 필요 - 현재는 에러 throw 선호).
- **중앙 에러 핸들러**:
    - `app.js`에 등록된 `handleCentralError` 미들웨어가 `next(error)`로 전달된 모든 에러를 최종적으로 처리하고, `standardizeApiResponse`를 사용하여 클라이언트에 응답합니다.

### 5. 로깅

- 코드 내에서 직접 `console.log`, `console.warn`, `console.error` 사용을 최소화해주십시오.
- 디버깅 목적의 로그는 개발 중에만 사용하고, 커밋 전에는 제거하거나 조건부 로깅으로 변경해주십시오.
- 주요 에러 로깅은 중앙 에러 핸들러의 `logError` 함수를 통해 이루어집니다. (향후 별도 로거 도입 가능성 있음)

### 6. CLOB 처리 (`utils/dbUtils.js`)
- Oracle DB의 CLOB 데이터 타입은 `utils/dbUtils.js`의 `clobToString(clob)` 또는 `convertClobFields(data)` 함수를 사용하여 문자열로 변환해야 합니다.
- 모델 함수에서 DB 조회 결과 중 CLOB 필드가 있다면, 이 유틸리티를 사용하여 적절히 변환 후 반환해주십시오.

---
(기존 내용은 여기에 이어짐)

---

## 4. 작업 목록 (진행상황 체크)

### 기존 기능 (완료)
- [x] 채팅 메시지 전송 API (`POST /api/chat/sessions/:session_id/messages`)
- [x] 채팅 세션 삭제 API (`DELETE /api/chat/sessions/:session_id`)
- [x] 채팅 메시지 삭제 API (`DELETE /api/chat/messages/:message_id`)
- [x] 메시지 리액션 제거 API (`DELETE /api/chat/messages/:message_id/reaction`)
- [x] 파일 업로드/다운로드/권한 관리 (인증 최소화)
- [x] JWT 인증/인가 (학습용 최소 구현)
- [x] HTTP SSE 스트리밍 (WebSocket 제거 완료)
- [x] Markdown 렌더링 지원 (Marked.js + Highlight.js 통합)

### 기존 개선 사항
- [ ] API 오류 처리 표준화 및 상세화
- [ ] 입력값 유효성 검사 강화
- [ ] DB 커넥션 풀 최적화
- [x] API 응답 케이싱 통일 (standardizeApiResponse 유틸리티 추가 및 적용)
- [x] WebSocket 완전 제거 및 HTTP SSE 스트리밍으로 단순화
- [x] Markdown 렌더링 및 코드 하이라이팅 구현

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
- [x] **프로필 꾸미기 (백엔드)**: 테마, 뱃지 등 사용자 프로필 커스터마이징 데이터 저장/조회 API **완료**
  - 프로필 테마 설정 API (`GET|PUT /api/users/:user_id/customization`)
  - 뱃지 목록 조회/설정 API (`GET /api/users/:user_id/badges`, `PUT /api/users/:user_id/badges/:badge_id`)
  - 커스터마이징 옵션 메타데이터 (프로필 테마, 테두리, 배경, 상태 메시지)

- [x] **구독 등급 시스템 (백엔드)**: 4단계 구독 등급 관리 시스템 **완료**
  - 구독 등급: ☄️ 코멧(무료), 🪐 플래닛(월1.5만원), ☀️ 스타(월15만원), 🌌 갤럭시(기업용월300만원)
  - 구독 등급별 기능 제한 및 뱃지 시스템 (갤럭시는 기업용으로 프로필 뱃지 제공하지 않음)
  - 결제 및 자동 갱신 관리, 사용자별 구독 정보 추적
  - DB 테이블: `subscription_tiers`, `user_subscriptions` 추가

- [x] **계정 레벨 기능 (백엔드)**: 사용자 레벨 관리 및 해금 시스템 **완료**
  - 레벨/경험치 조회 API (`GET /api/users/:user_id/level`)
  - 경험치 추가 API (`POST /api/users/:user_id/experience`)
  - 레벨업 처리 로직 (경험치 증가 시 자동 레벨업)
  - 레벨별 해금 기능 시스템 (level_requirements 테이블)

- [x] **채팅 메시지 수정 기능 (백엔드)**: 메시지 편집 및 AI 재호출 **완료**
  - 메시지 편집 API (`PUT /api/chat/messages/:message_id`)
  - 메시지 편집 기록 조회 API (`GET /api/chat/messages/:message_id/history`)
  - 편집된 메시지에 대한 AI 재응답 로직 (`POST /api/chat/sessions/:session_id/messages/:message_id/reresponse`)
  - 메시지 수정 이력 관리 (message_edit_history 테이블)

- [x] **언어 선택 기능 (백엔드)**: 다국어 지원 시스템 **완료**
  - 사용자 언어 설정 저장/조회 API (`PUT /api/users/:user_id/language`)
  - 번역 리소스 관리 시스템 (`GET /api/users/translations/:lang`)
  - i18n 번역 키 관리 (translation_resources 테이블)
  - 지원 언어: 한국어(ko), 영어(en), 일본어(ja), 중국어(zh)

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

## 최신 시스템 상태 (2025-06-20 기준)

### 🔧 현재 기본 설정
- **기본 AI Provider**: `geminiapi` (Google AI Studio)
- **기본 모델**: `gemini-2.0-flash-thinking-exp-01-21`
- **기본 구독 등급**: 코멧 (무료) - 일일 30회 AI 요청, 10MB 파일 업로드 **✅ 구독 시스템 추가됨**
- **Vertex AI 모델**: `gemini-2.5-pro-exp-03-25` (대체 옵션)
- **Ollama 모델**: `gemma3:4b` (대체 옵션)
- **스트리밍 방식**: HTTP SSE (Server-Sent Events) 전용

### 🌟 주요 최적화 사항
1. **WebSocket 제거**: 복잡한 WebSocket 코드 완전 제거, HTTP SSE 스트리밍만 사용
2. **팀원 친화적**: 표준 HTTP API, 브라우저 네트워크 탭에서 확인 가능
3. **UI/UX 개선**: Gemini 선택 시 Ollama 옵션 자동 비활성화
4. **자동 매핑**: 테스트 페이지에서 `gemini` → `geminiapi` 자동 변환
5. **기본값 통일**: 전체 시스템에서 Google AI Studio 우선 사용
6. **Markdown 렌더링**: AI 응답의 완전한 Markdown 지원 및 코드 하이라이팅
7. **구독 관리 시스템**:  4단계 구독 등급 및 기능 제한 시스템 **✅ 새로 추가됨**

### 🚀 성능 향상
- Gemini 2.0 Flash Thinking Exp의 고품질 응답 제공
- 스트림/캔버스 모드 완벽 지원
- 검색 기능과 AI 응답 통합
- DB 저장 보장 (스트리밍 모드에서도 메시지 정상 저장)
- Markdown 렌더링을 통한 가독성 향상
- 구독 등급별 일일 사용량 제한 및 권한 관리 **✅  구독 시스템 추가**

### 📋 주요 변경 사항 요약 (2025-06-20)
1. **Markdown 렌더링 구현**: Marked.js + Highlight.js 통합
   - 메인/테스트 페이지 모두 지원
   - AI 응답 자동 Markdown 렌더링
   - 코드 하이라이팅 지원
   - 완전한 CSS 스타일링 적용
2. **스트리밍 완료 후 처리**: 스트리밍이 끝난 후 Markdown 변환
3. **사용자 메시지**: 일반 텍스트로 처리 (보안상 이유)
4. **테스트 환경**: 동일한 Markdown 렌더링 기능 적용

### 🔍 디버깅 로그 개선
- chatController에 AI provider 결정 로그 추가
- 요청 파라미터 디버깅 로그 활성화
- AI provider 매핑 상태 실시간 확인 가능
- 스트리밍 모드에서 DB 저장 성공/실패 로그 추가
- Markdown 렌더링 성공/실패 로그 추가

---

## 수정 기록 (2025-01-27)

### 구독 관리 시스템 구현 ()
- **새로운 파일**:
  - `models/subscription.js`: 구독 등급/정보/업데이트/취소/이력/권한/사용량 모델 함수
  - `controllers/subscriptionController.js`: 구독 관리 API 컨트롤러 (8개 주요 엔드포인트)
  - `routes/subscriptions.js`: 구독 관리 REST API 라우트
  - `middleware/subscription.js`: 기능별 구독 권한/사용량 제한 미들웨어
  - `testScripts/subscription.js`: 프론트엔드 구독 관리 테스트 함수

- **수정된 파일**:
  - `app.js`: 구독 라우트 (`/api/subscriptions`) 추가
  - `controllers/chatController.js`: 일일 AI 요청 제한 체크 추가
  - `routes/chat.js`: 파일 업로드에 구독 기능 제한 미들웨어 적용
  - `public/test.html`: 구독 관리 UI 섹션 (8개 테스트 버튼) 추가
  - `public/testScript.js`: 구독 관리 모듈 import 및 이벤트 연결
  - `copilot-instructions.md`: 구독 시스템 구조/API/모델/미들웨어 문서화

### 주요 기능
1. **4단계 구독 등급**: 코멧(무료), 플래닛(월1.5만원), 스타(월15만원), 갤럭시(기업용월300만원)
2. **기능별 제한**: AI 요청 횟수, 파일 업로드 크기, 고급 기능 접근 권한
3. **일일 사용량 추적**: Redis 없이 DB 기반 일일 사용량 관리 (매일 자동 초기화)
4. **구독 시뮬레이션**: 결제 연동 없이 구독 변경/취소 테스트 가능
5. **미들웨어 통합**: 채팅/파일 업로드 등 기존 기능에 구독 제한 자동 적용

### 기술적 세부사항
- **포트폴리오 목적**: 실제 결제 없이 구독 비즈니스 로직 및 권한 관리 시스템 시연
- **확장 가능**: 실제 결제 게이트웨이 (토스페이, 아임포트 등) 연동 준비 완료
- **권한 체크**: HTTP 403 (권한 부족), HTTP 429 (사용량 초과) 표준 응답
- **데이터 무결성**: 트랜잭션 처리로 구독 변경 시 데이터 일관성 보장

---

## 수정 기록 (2025-06-20)

### Markdown 렌더링 시스템 구현
- **변경된 파일**:
  - `public/index.html`: Marked.js, Highlight.js 라이브러리 추가
  - `public/test.html`: Marked.js, Highlight.js 라이브러리 추가
  - `public/script.js`: Markdown 파싱 함수 및 렌더링 로직 추가
  - `testScripts/utils.js`: Markdown 처리 유틸리티 함수 추가
  - `testScripts/chat.js`: 테스트 페이지 Markdown 렌더링 적용
  - `public/style.css`: 완전한 Markdown 요소 CSS 스타일링 추가

### 주요 기능
1. **AI 응답 Markdown 자동 렌더링**: 코드 블록, 헤딩, 리스트, 테이블, 인용구 등
2. **코드 하이라이팅**: Highlight.js를 통한 syntax highlighting
3. **스트리밍 지원**: 스트리밍 완료 후 Markdown 변환 적용
4. **보안 고려**: 사용자 메시지는 일반 텍스트로 처리 (XSS 방지)
5. **반응형 디자인**: 모든 Markdown 요소의 완전한 CSS 스타일링

### 기술적 세부사항
- **라이브러리**: Marked.js (Markdown 파싱), Highlight.js (코드 하이라이팅)
- **렌더링 시점**: AI 메시지 추가 시 및 스트리밍 완료 후
- **CSS 스타일**: 헤딩, 코드 블록, 테이블, 인용구, 리스트 등 완전 지원
- **에러 처리**: 라이브러리 로드 실패 시 일반 텍스트로 대체

---
### [2025-06-27] 메시지 편집 API 버그 수정: 
  - 문제 1: chatController.js에서 content 필드명 불일치 (validation은 content, dataExtractor는 new_content) → dataExtractor를 content로 통일
  - 문제 2: models/chat.js에서 존재하지 않는 is_deleted 컬럼 사용으로 ORA-00904 오류 → SQL 쿼리에서 is_deleted 조건 제거
  - 문제 3: dataExtractor에서 undefined content에 대한 trim() 호출 → null/undefined 체크 추가
  - 결과: PUT /api/chat/messages/:message_id API 정상 작동 복원 (해결)

---
### [2025-06-27] chatController.js user_id 접근 오류 및 스트리밍 에러 처리 버그 수정:
  - 문제 1: chatController.js에서 req.user가 undefined인 경우 req.user.user_id 접근 시 TypeError 발생
  - 문제 2: req.body가 undefined일 때 messageData.message 접근 시 오류 발생
  - 문제 3: 스트리밍 중 에러 발생 시 이미 전송된 헤더에 대해 다시 헤더 설정 시도로 "Cannot set headers after they are sent" 오류 발생
  - 해결 1: chatController.js에서 req.user?.user_id 패턴 사용하고 인증 에러 처리 강화
  - 해결 2: dataExtractor에서 req.body || {} 기본값 사용, validations에서도 messageData = req.body || {} 적용
  - 해결 3: utils/serviceFactory.js의 createStreamController에서 res.headersSent 체크 후 이미 헤더가 전송된 경우 SSE로 에러 응답 전송 후 종료
  - 결과: POST /api/chat/sessions/:session_id/messages API의 TypeError 및 헤더 중복 전송 오류 완전 해결 (해결)

---
### [2025-06-27] API 문서 업데이트: 최근 버그 수정 및 새로운 기능 반영
  - 일반 정보 섹션 업데이트: 캔버스 모드, 최근 버그 수정 사항 추가
  - 채팅 메시지 전송 API: 캔버스 모드 HTML/CSS/JS 추출 기능, 스트리밍 에러 처리 개선 명시
  - 메시지 편집 API: content 필드 안전 처리, edit_reason 파라미터 추가 명시
  - 새로운 API 추가: 메시지 편집 기록 조회 (GET /api/chat/messages/:message_id/history), AI 재응답 요청 (POST /api/chat/sessions/:session_id/messages/:message_id/reresponse)
  - 세션 메시지 목록 조회 API: 'undefined'/'null' 문자열 체크, 강화된 유효성 검사 명시
  - 파일 업로드 API: 경로 수정 (upload로 변경), 구독 등급별 파일 크기 제한, 자동 파일 정리 기능 명시
  - 캔버스 모드 응답 예시 추가: canvas_html, canvas_css, canvas_js 필드 포함된 응답 형식
  - 모든 API 응답 형식 표준화: {status: "success/error", data/error: ...} 구조 일관성 유지
  - 결과: API 문서가 실제 구현과 완전히 일치, 최근 버그 수정 및 기능 개선 사항 모두 반영 (해결)

---
### [2025-07-04] 로거 사용자 ID 추출 개선 및 프로필 이미지 업로드 수정
  - 문제 1: middleware/logger.js에서 사용자 ID 추출 실패로 로그에 [UserID: unknown] 표시
  - 문제 2: routes/users.js에서 upload.any() 사용으로 req.file 접근 불가, controllers/userController.js와 불일치
  - 문제 3: 프로필 이미지 업로드 시 "프로필 이미지 파일이 필요합니다" 에러 발생
  - 해결 1: logger.js에서 req.params?.user_id || req.user?.user_id || req.body?.user_id 순서로 사용자 ID 추출 로직 추가
  - 해결 2: routes/users.js에서 upload.any()를 upload.single('profileImage')로 변경, 명확한 필드명 지정
  - 해결 3: userController.js에서 디버깅 로그 및 상세 에러 메시지 추가, 파일 필드명 명시
  - 해결 4: 로그 출력 형식 개선으로 [UserID: actual_user_id] [Path: METHOD /path] [Handler: /path] 구조화
  - 결과: 로그에서 정확한 사용자 ID 표시, 프로필 이미지 업로드 정상 작동, 에러 추적 개선 (해결)

### [2025-07-03] MVP용 인증 시스템 완전 제거
  - 배경: MVP에서는 복잡한 JWT 인증보다 간단한 시스템이 적합
  - 제거된 항목:
    - controllers/userController.js: generateToken import 및 사용 제거
    - services/authService.js: generateToken import 제거  
    - public/script.js: Authorization 헤더 제거
    - public/api_docs.js: JWT 관련 설명을 MVP 모드로 변경
    - utils/testFactory.js: 인증 테스트 함수들 MVP 모드로 수정
    - README.md: JWT 설명을 간단한 인증으로 변경
  - 유지된 항목: middleware/auth.js (향후 확장용으로 보존)
  - 결과: 에러 없이 완전한 MVP 환경 구축, 클라이언트에서 user_id만 전송하면 작동 (해결)

---
### [2025-07-03] 세션 삭제 권한 문제 및 MVP 간소화
  - 문제: 사용자 A가 생성한 세션을 사용자 B가 삭제하려고 시도하여 SESSION_NOT_FOUND 오류 발생
  - 원인: 다른 사용자의 세션을 삭제하려고 시도하는 것은 정상적인 보안 동작
  - 해결: 인증 토큰 시스템을 제거하고 MVP 버전에 맞게 간소화
    - routes/chat.js: verifyToken 미들웨어 제거
    - routes/sessions.js: verifyToken 미들웨어 제거  
    - controllers/sessionController.js: JWT 기반 로직을 req.body 기반으로 복원
    - MVP에서는 클라이언트가 올바른 user_id를 전송하도록 신뢰하는 방식 채택
  - 디버깅 로그 추가: sessionService.js와 models/session.js에 상세 디버깅 로그 추가
  - 결과: MVP 환경에 적합한 간단한 권한 체크 시스템으로 복원 (해결)
  - **새로운 파일**: utils/systemPrompt.js - 시스템 프롬프트 생성 및 관리 유틸리티
    - generateSystemPrompt: 사용자 프로필/설정 기반 개인화된 프롬프트 자동 생성
    - validateAndCleanPrompt: 프롬프트 검증 및 정리 (최대 8000자)
    - enhancePromptWithContext: 컨텍스트별 프롬프트 확장 (coding, creative, analysis 등)
    - DEFAULT_SYSTEM_PROMPT: 한/영 기본 프롬프트 템플릿 (OrbitMate Mate 3.5 정체성)
  - **기본 프롬프트 강화**: 
    - 영어 기본 프롬프트로 "Mate 3.5, OrbitMate Corporation" 브랜드 정체성 확립
    - 핵심 역량, 가이드라인, 사용 가능한 도구 명시
    - 사용자 정보 자동 포함 (닉네임, 레벨, 구독등급, 위치, 언어설정 등)
  - **개인화 기능**:
    - 사용자 프로필 정보 자동 반영 (display_name, user_level, country)
    - 사용자 설정 반영 (language, timezone, ai_model_preference, communication_style)
    - 구독 등급 정보 포함으로 AI가 사용자 레벨 인지
  - **검열 완화**: 
    - Gemini API: BLOCK_MEDIUM_AND_ABOVE → BLOCK_ONLY_HIGH
    - Vertex AI: 새로운 safetySettings 추가 (BLOCK_ONLY_HIGH)
    - 시스템 프롬프트 관련 검열 방지로 사용성 향상
  - **services/chatService.js 개선**:
    - 사용자 프로필/설정 자동 조회 및 프롬프트 개인화
    - finalSystemPrompt 생성 로직 추가, 컨텍스트별 확장 지원
    - 프롬프트 길이 및 타입 로깅으로 디버깅 개선
  - **API 문서 업데이트**: system_prompt 최대 길이 8000자, 개인화 기능 설명 추가
  - 결과: AI가 사용자별 맞춤형 응답 제공, 검열로 인한 시스템 프롬프트 차단 문제 해결 (해결)

---
### [2025-07-07] 로그 API 및 웹 로그 뷰어 공식 지원 중단:
  - 이유: 로그를 외부로 제공할 필요가 없어져서 log API 엔드포인트 공식 지원 중단
  - 삭제된 파일: routes/logs.js, controllers/logController.js → temp/ 폴더로 백업 이동
  - 삭제된 명세: public/api_docs.js에서 로그 모니터링 시스템 관련 API 명세 제거
  - 유지된 기능: middleware/logger.js (내부 로깅 시스템)은 정상 동작 유지
  - 결과: /api/logs/* 엔드포인트 완전 제거, 웹 로그 뷰어 기능 중단, 명세와 실제 코드 일치 (해결)

---
