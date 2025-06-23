# Orbitmate - AI 기반 다목적 어시스턴트 애플리케이션 (MVP)

Orbitmate는 사용자와의 대화, 정보 검색, 다양한 AI 기반 기능을 제공하는 것을 목표로 하는 웹 애플리케이션입니다. 현재 버전은 핵심 기능 구현에 중점을 둔 MVP(Minimum Viable Product)입니다.

## 주요 기능

*   **AI 채팅**: 다양한 AI 제공자(Google AI Studio, Vertex AI, Ollama)를 선택하여 대화할 수 있습니다.
    *   HTTP SSE (Server-Sent Events)를 통한 실시간 스트리밍 응답을 지원합니다.
    *   Markdown 형식의 AI 응답을 렌더링합니다.
*   **채팅 세션 관리**: 대화 내용을 세션별로 저장하고 관리합니다. (생성, 조회, 수정, 삭제)
*   **메시지 관리**: 개별 메시지에 대한 수정, 삭제, 리액션 기능을 제공합니다.
*   **파일 첨부**: 채팅 중 파일을 업로드하고 공유할 수 있습니다.
*   **사용자 시스템**: 기본적인 회원가입, 로그인, 사용자 설정 및 프로필 관리 기능을 제공합니다.
*   **정보 검색**:
    *   위키피디아 검색 기능을 통해 백과사전 정보를 조회할 수 있습니다.
    *   IP 기반 또는 도시명 기반 날씨 정보를 조회할 수 있습니다.
*   **구독 시스템 (시뮬레이션)**: 다양한 등급의 구독 플랜 및 기능 제한을 시뮬레이션합니다.
*   **사용자 활동 시스템**: 프로필 꾸미기, 레벨 및 경험치, 뱃지, 다국어 지원 등의 기능을 포함합니다.

## 기술 스택

*   **백엔드**: Node.js, Express.js
*   **데이터베이스**: Oracle Database 11g XE
*   **AI 연동**:
    *   Google AI Studio (Gemini API)
    *   Google Cloud Vertex AI (Gemini API)
    *   Ollama (로컬 모델 실행)
*   **인증**: JWT (JSON Web Token)
*   **실시간 통신**: HTTP SSE (Server-Sent Events)
*   **프론트엔드**: HTML, CSS, JavaScript (Vanilla JS)
    *   Markdown 렌더링: Marked.js, Highlight.js
*   **기타**: `bcrypt` (비밀번호 해싱), `multer` (파일 업로드), `axios` (HTTP 클라이언트), `dotenv` (환경 변수 관리)

## 시작하기

### 요구 사항

*   Node.js (권장 LTS 버전)
*   Oracle Database (11g XE 또는 호환 버전)
*   Oracle Instant Client (DB Thick 모드 사용 시)
*   Git

### 설치

1.  프로젝트 클론:
    ```bash
    git clone <저장소_URL>
    cd <프로젝트_디렉토리>
    ```
2.  필요한 패키지 설치:
    ```bash
    npm install
    ```

### 환경 설정

1.  프로젝트 루트 디렉토리에 `.env` 파일을 생성합니다.
2.  아래 내용을 참고하여 환경 변수를 설정합니다. `config/index.js` 파일에서 모든 설정을 관리하므로, 해당 파일을 참조하여 필요한 모든 변수를 설정하십시오.

    ```env
    # 서버 설정
    PORT=3000
    NODE_ENV=development # 또는 production
    TEST_PAGE_PASSWORD=your_test_page_password

    # 데이터베이스 연결 정보
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_CONNECT_STRING=localhost:1521/xe # 예: localhost:1521/ORCLPDB1 또는 TNS 이름
    # DB_POOL_MIN=10 (기본값)
    # DB_POOL_MAX=10 (기본값)
    # DB_POOL_INCREMENT=0 (기본값)

    # Oracle Instant Client 경로 (Thick 모드 사용 시, Windows에서는 필수일 수 있음)
    # 예: ORACLE_CLIENT_LIB_DIR=C:\oracle\instantclient_21_3
    ORACLE_CLIENT_LIB_DIR=
    THICK_MODE_REQUIRED=false # true로 설정 시 Thick 모드 초기화 실패하면 앱 종료

    # JWT 설정
    JWT_SECRET=your_jwt_secret_key_here # 매우 중요: 프로덕션에서는 강력한 무작위 문자열 사용
    JWT_EXPIRES_IN=1h

    # AI 제공자 설정
    DEFAULT_AI_PROVIDER=geminiapi # geminiapi, vertexai, ollama 중 선택

    GEMINI_API_KEY=your_google_ai_studio_api_key
    # GEMINI_MODEL=gemini-2.0-flash-thinking-exp-01-21 (기본값)

    GOOGLE_PROJECT_ID=your_google_cloud_project_id
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/gcp-service-account-key.json # Vertex AI용 서비스 계정 키 경로
    # VERTEX_AI_LOCATION=global (기본값)
    # VERTEX_AI_MODEL=gemini-2.5-pro-exp-03-25 (기본값)

    OLLAMA_API_URL=http://localhost:11434/api/chat # 로컬 Ollama 서버 주소
    # OLLAMA_MODEL=gemma3:4b (기본값)

    # Wikipedia API (기본값 사용 가능)
    # WIKIPEDIA_API_BASE_URL=https://ko.wikipedia.org/api/rest_v1
    # WIKIPEDIA_SEARCH_API_URL=https://ko.wikipedia.org/w/api.php
    # WIKIPEDIA_DEFAULT_LANGUAGE=ko
    # WIKIPEDIA_FALLBACK_LANGUAGE=en
    # WIKIPEDIA_REQUEST_TIMEOUT=5000
    # WIKIPEDIA_MAX_RESULTS=10
    # WIKIPEDIA_CACHE_DURATION=3600

    # OpenWeatherMap API
    OPENWEATHER_API_KEY=your_openweathermap_api_key
    # WEATHER_CACHE_DURATION=1800
    # WEATHER_REQUEST_TIMEOUT=5000

    # 기타 외부 API 키 (현재 더미값)
    NAVER_CLIENT_ID=dummy
    NAVER_CLIENT_SECRET=dummy
    KAKAO_API_KEY=dummy
    ```

3.  **Oracle Instant Client 설정 (필요시)**:
    *   Oracle Thick 모드를 사용해야 하는 환경(예: 일부 Windows 환경 또는 특정 Oracle 기능 사용 시)에서는 Oracle Instant Client를 설치해야 합니다.
    *   Instant Client를 설치한 후, 해당 경로를 `ORACLE_CLIENT_LIB_DIR` 환경 변수에 설정합니다.
    *   `THICK_MODE_REQUIRED=true`로 설정하면 Instant Client 초기화 실패 시 애플리케이션이 시작되지 않습니다.

### 데이터베이스 초기화

1.  Oracle 데이터베이스에 접속하여 사용자를 생성하고 필요한 권한을 부여합니다.
2.  프로젝트 루트의 `sqldb.sql` 파일을 사용하여 데이터베이스 스키마와 기본 데이터를 생성합니다. SQL*Plus, SQL Developer 등의 도구를 사용할 수 있습니다.
    ```sql
    -- 예시: SQL*Plus 사용
    sqlplus your_db_user/your_db_password@your_connect_string @sqldb.sql
    ```

### 애플리케이션 실행

```bash
npm start
```
또는 개발 환경에서는 다음을 사용할 수 있습니다:
```bash
node app.js
# 또는 nodemon app.js (nodemon 설치 시)
```
서버가 정상적으로 시작되면 `http://localhost:PORT` (예: `http://localhost:3000`)로 접속할 수 있습니다.

## 프로젝트 구조

*   `app.js`: Express 애플리케이션 설정, 미들웨어 로드, 라우트 연결, DB 초기화 및 서버 시작 로직.
*   `server.js`: `app.js`를 실행하는 간단한 진입점.
*   `config/`: 데이터베이스, AI 제공자, JWT 등 각종 설정 파일.
    *   `index.js`: 모든 설정을 통합 관리하며, 환경 변수를 로드하여 애플리케이션에 제공.
*   `controllers/`: API 요청을 받아 비즈니스 로직을 처리하고 응답을 반환. 모델과 뷰(응답) 사이의 중재자.
*   `middleware/`: JWT 인증, 구독 기반 권한 체크 등 Express 미들웨어.
*   `models/`: 데이터베이스 스키마 및 데이터 접근 로직 (SQL 쿼리 실행).
*   `public/`: 정적 파일 (HTML, CSS, 클라이언트 JavaScript, 이미지 등).
*   `routes/`: API 엔드포인트 정의 및 해당 컨트롤러 함수 연결.
*   `utils/`: 공통 유틸리티 함수 (DB 유틸, API 응답 표준화, 에러 핸들러 등).
*   `uploads/`: 파일 업로드 시 저장되는 디렉토리 (자동 생성).
*   `sqldb.sql`: 데이터베이스 스키마 및 초기 데이터 생성 스크립트.
*   `copilot-instructions.md`: AI 에이전트(Jules)를 위한 개발 지침 및 프로젝트 정보.

## API 문서

API 엔드포인트에 대한 자세한 정보는 `public/api_docs.html` 파일을 통해 확인할 수 있습니다. (서버 실행 후 `/api/docs` 경로로 접속)

## 주요 코드 설계 원칙 (기여자를 위한 안내)

*   **설정 관리**: 모든 설정 값은 `config/index.js`를 통해 접근합니다. `process.env` 직접 사용을 지양합니다.
*   **DB 연결 및 트랜잭션**:
    *   모델 함수는 `connection` 객체를 첫 번째 인자로 받습니다.
    *   컨트롤러에서 DB 작업 시 `utils/dbUtils.js`의 `withTransaction` 유틸리티를 사용합니다.
    *   모델 내에서 직접적인 DB 연결 관리(생성, 해제, 커밋, 롤백)를 하지 않습니다.
*   **API 응답 표준화**: `utils/apiResponse.js`의 `standardizeApiResponse`를 사용하여 모든 API 응답을 일관된 형식(`{ status, data/error }`)으로 반환합니다.
*   **중앙 에러 처리**: 컨트롤러에서 발생한 에러는 `next(error)`를 통해 `app.js`에 등록된 중앙 에러 핸들러(`handleCentralError`)로 전달되어 처리됩니다.
*   **CLOB 처리**: Oracle CLOB 데이터는 `utils/dbUtils.js`의 `clobToString` 또는 `convertClobFields`를 사용하여 문자열로 변환합니다.
*   **로깅**: `console.log/error` 직접 사용을 지양하고, 중앙 로깅 메커니즘을 따릅니다 (현재는 `errorHandler.js`의 `logError`를 통해 간접적으로 사용).

## 향후 개선 방향 (TODO)

*   `express-validator`를 사용한 입력값 검증 강화.
*   보다 상세한 요청 로깅 미들웨어 추가 (요청 ID 포함).
*   테스트 코드 작성 (단위 테스트, 통합 테스트).
*   Ollama 모델 사용 시 토큰 수 계산 기능 추가.
*   프론트엔드 코드 개선 및 프레임워크 도입 고려.
*   실제 결제 시스템 연동 (구독 기능).
*   `AGENTS.md` 또는 `copilot-instructions.md`의 "작업 목록"에 있는 미구현 기능 개발.
```

위 내용으로 `README.md` 파일을 생성하겠습니다.
