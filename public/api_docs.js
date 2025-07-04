  /*
  General API Information:
  
  Success Responses: All successful API responses follow a standard format:
  {
    "status": "success",
    "data": { ... actual response data ... }
  }
  
  Error Responses: All API error responses follow a standard format:
  {
    "status": "error",
    "error": {
      "code": "ERROR_CODE_IN_SNAKE_CASE",
      "message": "A descriptive error message.",
      "details": null | { ... additional error details ... }
    }
  }
  
  SSE Streaming Responses: When special_mode_type is "stream", responses use Server-Sent Events:
  - Content-Type: text/event-stream
  - Events include: ids, ai_message_id, message (with delta content)
  - Completion signal: {"done": true}
  - Final result: Standard success response format with complete data
  
  Canvas Mode: When special_mode_type is "canvas", AI responses containing HTML/CSS/JS code blocks 
  will have additional fields extracted: canvas_html, canvas_css, canvas_js
  
  MVP Mode: No authentication required. APIs support guest users without authentication.
  
  Recent Bug Fixes (2025-07-03):
  - Fixed message deletion API: Removed req.body usage from DELETE requests, now accepts user_id via query parameter or x-user-id header
  - Fixed message editing API: Changed content field to new_content to match frontend, added user_id requirement for MVP
  - Enhanced MVP authentication: Removed JWT dependencies, simplified to direct user_id transmission
  
  Previous Bug Fixes (2025-06-30):
  - Fixed session message user_id display: User messages now show actual session owner ID instead of "guest"
  - Improved session message retrieval: Added session owner verification and proper user_id mapping
  - Enhanced security: Session existence check before message retrieval
  
  Previous Bug Fixes (2025-06-27):
  - Fixed message editing API: content field validation, null safety, guest user support
  - Fixed chat message sending: req.user undefined handling, req.body safety checks  
  - Fixed SSE streaming: improved error handling when headers already sent
  - Enhanced session message retrieval: 'undefined'/'null' string validation
  
  All keys in responses, including error responses, are in snake_case.
  */
const apis = [
  {
    method: 'GET',
    path: '/api/health',
    title: '서버 상태 확인',
    desc: '서버의 현재 상태와 타임스탬프를 반환합니다.',
    params: [],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": {
    "status": "ok",
    "timestamp": "YYYY-MM-DDTHH:mm:ss.sssZ"
  }
}`
  },
  {
    method: 'GET',
    path: '/api/ai/models',
    title: 'AI 모델 정보 조회',
    desc: '사용 가능한 AI 모델 목록과 관련 정보를 반환합니다. (컨트롤러: aiInfoController)',
    params: [],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": [
    {
      "provider": "geminiapi",
      "id": "gemini-2.0-flash-thinking-exp-01-21",
      "name": "Google AI Studio (gemini-2.0-flash-thinking-exp-01-21)",
      "max_input_tokens": 1048576,
      "max_output_tokens": 8192,
      "is_default": true,
      "description": "Google의 AI Studio를 통해 제공되는 모델입니다. 균형 잡힌 성능과 다양한 기능을 제공합니다.",
      "strengths": ["일반 대화", "창의적 글쓰기", "요약"],
      "availability": "available"
    },
    {
      "provider": "ollama",
      "id": "gemma3:4b",
      "name": "Ollama (gemma3:4b)",
      "max_input_tokens": 128000,
      "max_output_tokens": 8192,
      "is_default": false,
      "description": "로컬 환경에서 실행 가능한 오픈소스 모델입니다. 데이터 보안 및 커스터마이징에 유리합니다.",
      "strengths": ["오프라인 사용", "빠른 응답(로컬 환경 최적화 시)", "특정 작업 फाइन-튜닝 가능"],
      "availability": "available"
    }
    // ... more models
  ]
}`
  },
  /* 2. 사용자 관리 (인증 관련은 /api/auth, 프로필 등은 /api/users/:user_id) */
  {
    method: 'POST',
    path: '/api/users/register', // 이 경로는 /api/auth/register 등으로 변경될 수 있음 (라우트 업데이트 단계에서 결정)
    title: '회원가입',
    desc: '새로운 사용자를 등록합니다. (컨트롤러: authController)<br>Validation Rules: <ul><li>`username`: 3-30자, 영숫자 및 밑줄(_) 허용.</li><li>`email`: 유효한 이메일 형식, 최대 254자.</li><li>`password`: 최소 8자, 최대 128자.</li></ul>',
    params: [
      { name: 'username', type: 'text', label: '사용자명 (3-30자, 영숫자/_)', required: true },
      { name: 'email', type: 'email', label: '이메일 (최대 254자)', required: true },
      { name: 'password', type: 'password', label: '비밀번호 (8-128자)', required: true }
    ],
    exampleReq: `{\n  "username": "APItestUser",\n  "email": "API@example.com",\n  "password": "password123"\n}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "user_id": "API_TEST_USER_ID",
    "username": "APItestUser",
    "email": "API@example.com",
    "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/users/check-email', // 이 경로는 /api/auth/check-email 등으로 변경될 수 있음
    title: '이메일 중복 확인',
    desc: '제공된 이메일 주소가 이미 시스템에 등록되어 있는지 확인합니다.<br>Validation Rules: <ul><li>`email`: 유효한 이메일 형식, 최대 254자.</li></ul>',
    params: [
      { name: 'email', type: 'email', label: '이메일 (최대 254자)', required: true }
    ],
    exampleReq: `{
  "email": "test@example.com"
}`,
    exampleRes: `{
  "email_exists": false
}`
  },
  {
    method: 'POST',
    path: '/api/users/login',
    title: '로그인',
    desc: '사용자가 로그인합니다.<br>Validation Rules: <ul><li>`email`: 유효한 이메일 형식.</li><li>`password`: 필수.</li></ul>',
    params: [
      { name: 'email', type: 'email', label: '이메일 (유효한 형식)', required: true },
      { name: 'password', type: 'password', label: '비밀번호', required: true }
    ],
    exampleReq:  `{\n  "email": "API@example.com",\n  "password": "password123"\n}`,
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "logged_in_at": "YYYY-MM-DDTHH:mm:ss.sssZ",\n  "token": "랜덤한 문자열"\n}`
  },
  {
    method: 'GET',
    path: '/api/users/:user_id/settings',    title: '사용자 설정 조회',
    desc: '특정 사용자의 설정을 조회합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true, value: 'guest' }
    ],
    exampleReq: '',
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "theme": "light",\n  "language": "ko",\n  "font_size": 14,\n  "notifications_enabled": true,\n  "ai_model_preference": null\n}`
  },
  {
    method: 'PUT',
    path: '/api/users/:user_id/settings',
    title: '사용자 설정 수정',
    desc: '특정 사용자의 설정을 업데이트합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li><li>`theme`: "light", "dark", "system" 중 하나.</li><li>`language`: "en", "ko", "ja" 중 하나.</li><li>`font_size`: 10-30 사이의 숫자.</li><li>`notifications_enabled`: boolean.</li><li>`ai_model_preference`: 문자열, 최대 50자.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 설정을 수정할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true },
      { name: 'theme', type: 'text', label: '테마 (light/dark/system)', required: false },
      { name: 'language', type: 'text', label: '언어 (en/ko/ja)', required: false },
      { name: 'font_size', type: 'number', label: '글꼴 크기 (10-30)', required: false },
      { name: 'notifications_enabled', type: 'checkbox', label: '알림 사용 (true/false)', required: false },
      { name: 'ai_model_preference', type: 'text', label: 'AI 모델 (최대 50자)', required: false }
    ],
    exampleReq:  `{\n  "theme": "dark",\n  "language": "en",\n  "font_size": 16,\n  "notifications_enabled": false,\n  "ai_model_preference": "gemini-2.0-flash-thinking-exp-01-21"\n}`,
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "theme": "light",\n  "language": "ko",\n  "font_size": 14,\n  "notifications_enabled": false,\n  "ai_model_preference": null\n}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/profile/image',
    title: '프로필 이미지 업로드',
    desc: '특정 사용자의 프로필 이미지를 업로드합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li><li>`profileImage` (file): 필수, 이미지 파일 (jpeg, png, gif), 최대 2MB.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 프로필 이미지를 업로드할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true },
      { name: 'profileImage', type: 'file', label: '프로필 이미지 (jpg/png/gif, max 2MB)', required: true }
    ],
    exampleReq: '(multipart/form-data: profileImage=파일 선택)',
    exampleRes: `{\n  "message": "프로필 이미지가 성공적으로 업데이트되었습니다.",\n  "user_id": "API_TEST_USER_ID",\n  "profile_image_path": "/uploads/API_TEST_USER_ID-YYYY-MM-DDTHH:mm:ss.sssZ-Orbitmate.png"\n}`
  },
  {
    method: 'DELETE',
    path: '/api/users/:user_id',
    title: '회원 탈퇴',
    desc: '특정 사용자의 계정을 삭제합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정을 삭제할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{\n  "message": "사용자 계정이 성공적으로 삭제되었습니다.",\n  "user_id": "API_TEST_USER_ID"\n}`
  },
  {
    method: 'GET',
    path: '/api/users/:user_id/profile',
    title: '프로필 조회',
    desc: '특정 사용자의 프로필 정보를 조회합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 프로필을 조회할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "profile_image_url": "/uploads/profiles/API_TEST_USER_ID-profile.jpg",\n  "bio": "테스트 계정입니다."\n}`
  },
  {
    method: 'PUT',
    path: '/api/users/:user_id/profile',
    title: '프로필 수정',
    desc: '특정 사용자의 프로필 정보를 업데이트합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li><li>`username` (body): 3-30자, 영숫자 및 밑줄(_) 허용.</li><li>`theme_preference`: "light", "dark", "system" 중 하나.</li><li>`bio`: 최대 500자.</li><li>`badge`: 최대 50자.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 프로필을 수정할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true },
      { name: 'username', type: 'text', label: '사용자명 (3-30자, 영숫자/_)', required: false },
      { name: 'theme_preference', type: 'text', label: '테마 (light/dark/system)', required: false },
      { name: 'bio', type: 'text', label: '자기소개 (최대 500자)', required: false },
      { name: 'badge', type: 'text', label: '배지 (최대 50자)', required: false }
    ],
    exampleReq:  `{\n  "username": "APItestUser",\n  "theme_preference": "dark",\n  "bio": "새로운 자기소개입니다.",\n  "badge": "Gold Star"\n}`,
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",\n  "is_active": 1,\n  "profile_image_path": null,\n  "theme_preference": "light",\n  "bio": "테스트 계정입니다.",\n  "badge": null,\n  "experience": 0,\n  "level": 1,\n  "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`  },
  
  /* 3. 채팅 세션 관리 */  {
    method: 'GET',
    path: '/api/sessions/:user_id/chat/sessions',
    title: '사용자 세션 목록 조회',
    desc: '특정 사용자의 모든 채팅 세션 목록을 조회합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 세션 목록을 조회할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes: `[
  {
    "session_id": "API_TEST_SESSION_ID",
    "title": "테스트 세션",
    "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "category": "일반",
    "is_archived": false
  }
]`
  },
  {
    method: 'POST',
    path: '/api/chat/sessions',
    title: '채팅 세션 생성',
    desc: '새로운 채팅 세션을 생성합니다.<br>Validation Rules: <ul><li>`user_id` (body): 필수, 최대 36자.</li><li>`title` (body): 필수, 최대 100자.</li><li>`category` (body): 선택, 최대 50자.</li></ul><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정으로 세션을 생성할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true },
      { name: 'title', type: 'text', label: '세션 제목 (최대 100자)', required: true },
      { name: 'category', type: 'text', label: '카테고리 (최대 50자)', required: false }
    ],
    exampleReq:  `{\n  "user_id": "API_TEST_USER_ID",\n  "title": "새로운 채팅 세션",\n  "category": "기술"\n}`,
    exampleRes:  `{\n  "session_id": "API_TEST_SESSION_ID",\n  "user_id": "API_TEST_USER_ID",\n  "title": "테스트 세션",\n  "category": "일반",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'PUT',
    path: '/api/chat/sessions/:session_id',
    title: '채팅 세션 정보 수정',
    desc: '특정 채팅 세션의 정보를 수정합니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 최대 36자.</li><li>`title` (body): 선택, 최대 100자.</li><li>`category` (body): 선택, 최대 50자.</li><li>`is_archived` (body): 선택, boolean.</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true },
      { name: 'title', type: 'text', label: '세션 제목 (최대 100자)', required: false },
      { name: 'category', type: 'text', label: '카테고리 (최대 50자)', required: false },
      { name: 'is_archived', type: 'checkbox', label: '보관 여부 (true/false)', required: false }
    ],
    exampleReq:  `{\n  "title": "업데이트된 세션 제목",\n  "category": "업무 관련",\n  "is_archived": false\n}`,
    exampleRes:  `{\n  "session_id": "API_TEST_SESSION_ID",\n  "title": "수정된 세션 제목",\n  "category": "중요",\n  "is_archived": true,\n  "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/sessions/:session_id',
    title: '채팅 세션 삭제',
    desc: '특정 채팅 세션을 삭제합니다. 해당 세션의 모든 메시지도 함께 삭제됩니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 최대 36자.</li><li>`user_id` (body): 필수, 최대 36자.</li></ul><span class="api-desc-note">session_id에 "API_TEST_SESSION_ID"를, 요청 본문에 "user_id": "API_TEST_USER_ID"를 입력하면 테스트 세션을 삭제할 수 있습니다.</span>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true },
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자, 요청 본문)', required: true, inPath: false }
    ],    exampleReq: `{\n  "user_id": "API_TEST_USER_ID"\n}`,
    exampleRes: `{\n  "message": "세션이 성공적으로 삭제되었습니다."\n}`
  },
  {
    method: 'GET',
    path: '/api/chat/sessions/:session_id/messages',
    title: '세션 메시지 목록 조회',
    desc: '특정 채팅 세션의 모든 메시지 목록을 조회합니다. 사용자 메시지의 user_id는 실제 세션 소유자 ID로 표시됩니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 최대 100자. \'undefined\' 또는 \'null\' 문자열 체크 포함.</li></ul><br><span class="api-desc-note">⚠️ 최근 버그 수정: undefined/null 문자열 명시적 체크, 강화된 유효성 검사, 사용자 메시지의 정확한 user_id 표시</span>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 100자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{
  "status": "success",
  "data": [
    {
      "message_id": "msg-id-1",
      "message_content": "안녕하세요!",
      "message_type": "user",
      "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
      "user_id": "API_TEST_USER_ID"
    },
    {
      "message_id": "msg-id-2", 
      "message_content": "안녕하세요! 무엇을 도와드릴까요?",
      "message_type": "ai",
      "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
      "user_id": "guest",
      "ai_provider": "geminiapi",
      "model_id": "gemini-2.0-flash-thinking-exp-01-21"
    }
  ]
}`
  },
  /* 4. 채팅 메시지 관리 */
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/messages',
    title: '채팅 메시지 전송',
    desc: '특정 채팅 세션에 새 메시지를 전송하고 AI의 응답을 받습니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`message` (body): 필수, 1-4000자 사이의 문자열.</li><li>`system_prompt` (body): 선택, 0-8000자 사이의 문자열. 제공되지 않으면 사용자 프로필 기반 기본 프롬프트가 자동 생성됩니다.</li><li>`special_mode_type` (body): 선택, \'stream\' 또는 \'canvas\' 중 하나여야 합니다.</li></ul><br>Optional overrides:<ul><li>`ai_provider_override`: (string) "vertexai", "geminiapi" 또는 "ollama". 제공될 경우 빈 문자열이 아니어야 합니다.</li><li>`model_id_override`: (string) 특정 모델 ID. 제공될 경우 빈 문자열이 아니어야 합니다.</li><li>`user_message_token_count`: (integer >= 0) 사용자 메시지의 토큰 수.</li><li>`max_output_tokens_override`: (integer > 0) AI 응답의 최대 토큰 수 재정의.</li><li>`context_message_limit`: (integer >= 0) 컨텍스트에 포함할 과거 메시지 수 (0은 컨텍스트 없음).</li></ul><span class="api-desc-note">🤖 시스템 프롬프트 개선: 사용자별 개인화된 기본 프롬프트 자동 생성, 프로필 정보(닉네임, 레벨, 구독등급) 및 설정(언어, AI 모델 선호도) 반영, 안전성 필터 완화 적용</span><br><span class="api-desc-note">special_mode_type이 "stream"이면 SSE 스트리밍 응답, "canvas"면 HTML/CSS/JS 추출 지원. 캔버스 모드에서는 응답에 canvas_html, canvas_css, canvas_js 필드가 추가됩니다.</span>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true, default: 'API_TEST_SESSION_ID' },
      { name: 'message', type: 'text', label: '메시지 (1-4000자)', required: true },
      { name: 'system_prompt', type: 'text', label: '시스템 프롬프트 (0-8000자, 개인화 자동 적용)', required: false },
      { name: 'special_mode_type', type: 'text', label: '특수 모드 (stream/canvas)', required: false },
      { name: 'ai_provider_override', type: 'text', label: 'AI 제공자 재정의 (vertexai/geminiapi/ollama, 선택)', required: false },
      { name: 'model_id_override', type: 'text', label: 'AI 모델 ID 재정의 (선택)', required: false },
      { name: 'user_message_token_count', type: 'number', label: '사용자 메시지 토큰 수 (선택, 정수 >= 0)', required: false },
      { name: 'max_output_tokens_override', type: 'number', label: '최대 출력 토큰 재정의 (선택, 양의 정수 > 0)', required: false },
      { name: 'context_message_limit', type: 'number', label: '컨텍스트 메시지 제한 (선택, 0 이상 정수)', required: false }
    ],
    exampleReq:  `{
  "message": "안녕하세요! 오늘 날씨에 대해 알려주세요.",
  "system_prompt": "You are a helpful AI assistant. Please provide clear and accurate responses based on the user's questions.",
  "special_mode_type": "stream",
  "ai_provider_override": "geminiapi",
  "model_id_override": "gemini-2.0-flash-thinking-exp-01-21",
  "user_message_token_count": 15,
  "max_output_tokens_override": 500,
  "context_message_limit": 10
}`,
    exampleRes: `일반 응답:
{
  "status": "success",
  "data": {
    "user_message_id": "API_TEST_USER_MESSAGE_ID",
    "ai_message_id": "API_TEST_AI_MESSAGE_ID",
    "message": "안녕하세요! 오늘 날씨는 맑고 화창합니다.",
    "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "ai_message_token_count": 25,
    "ai_provider": "geminiapi",
    "model_id": "gemini-2.0-flash-thinking-exp-01-21"
  }
}

캔버스 모드 응답 (special_mode_type: "canvas"):
{
  "status": "success",
  "data": {
    "user_message_id": "API_TEST_USER_MESSAGE_ID",
    "ai_message_id": "API_TEST_AI_MESSAGE_ID",
    "message": "HTML 페이지를 생성했습니다...",
    "canvas_html": "<div>Hello World</div>",
    "canvas_css": "div { color: blue; }",
    "canvas_js": "console.log('Hello');",
    "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "ai_message_token_count": 50,
    "ai_provider": "geminiapi",
    "model_id": "gemini-2.0-flash-thinking-exp-01-21"
  }
}

SSE 스트리밍 응답 (special_mode_type: "stream"):
Content-Type: text/event-stream

event: ids
data: {"userMessageId": "user-msg-id"}

event: ai_message_id
data: {"aiMessageId": "ai-msg-id"}

event: message
data: {"delta": "안녕하세요!"}

event: message
data: {"delta": " 오늘 날씨는"}

data: {"done": true}

data: {
  "status": "success",
  "data": {
    "user_message_id": "user-msg-id",
    "ai_message_id": "ai-msg-id",
    "message": "안녕하세요! 오늘 날씨는 맑고 화창합니다.",
    "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
    "ai_message_token_count": 25,
    "ai_provider": "geminiapi",
    "model_id": "gemini-2.0-flash-thinking-exp-01-21"
  }
}`
  },
  {
    method: 'PUT',
    path: '/api/chat/messages/:message_id',
    title: '메시지 수정',
    desc: '특정 메시지의 내용을 수정합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`message` 또는 `new_content` (body): 필수, 1-4000자 사이의 문자열. 둘 중 하나만 있으면 됨. 둘 다 있으면 `message` 우선.</li><li>`edit_reason` (body): 선택, 편집 사유.</li><li>`user_id` (body): 필수, 사용자 ID.</li></ul><br><span class="api-desc-note">⚠️ 최근 버그 수정 (2025-07-03): message/new_content 동시 지원, MVP 버전 user_id 필수화, content 필드명 혼동 방지</span>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true },
      { name: 'message', type: 'text', label: '수정할 내용 (1-4000자, message 또는 new_content 중 하나)', required: false },
      { name: 'new_content', type: 'text', label: '수정할 내용 (1-4000자, message 또는 new_content 중 하나)', required: false },
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true },
      { name: 'edit_reason', type: 'text', label: '편집 사유 (선택)', required: false }
    ],
    exampleReq:  `{
  "message": "이것은 수정된 메시지입니다.",
  "user_id": "guest",
  "edit_reason": "오타 수정"
}`,
    exampleRes:  `{
  "status": "success",
  "data": {
    "message": "메시지가 성공적으로 편집되었습니다.",
    "updated_message": {
      "message_id": "msg-id",
      "content": "이것은 수정된 메시지입니다.",
      "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"
    }
  }
}`
  },
  {
    method: 'GET',
    path: '/api/chat/messages/:message_id/history',
    title: '메시지 편집 기록 조회',
    desc: '특정 메시지의 편집 기록을 조회합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{
  "status": "success",
  "data": [
    {
      "edit_id": "edit-id-1",
      "message_id": "msg-id",
      "old_content": "원본 메시지 내용",
      "new_content": "수정된 메시지 내용",
      "edit_reason": "오타 수정",
      "edited_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
      "edited_by": "user-id"
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/messages/:message_id/reresponse',
    title: 'AI 재응답 요청',
    desc: '편집된 메시지에 대해 AI 재응답을 요청합니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true },
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{
  "status": "success",
  "data": {
    "message": "AI 재응답이 성공적으로 요청되었습니다.",
    "new_ai_message_id": "new-ai-msg-id",
    "ai_response": "편집된 메시지에 대한 새로운 AI 응답입니다."
  }
}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id',
    title: '메시지 삭제',
    desc: '특정 메시지를 삭제합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`user_id` (body): 필수, 사용자 ID. (DELETE 메서드에서도 JSON body로 전달해야 함)</li></ul><br><span class="api-desc-note">⚠️ 최근 수정 (2025-07-03): DELETE 요청에서 JSON body 사용 명확화, req.body 안전 처리 적용, user_id 필수화</span>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true },
      { name: 'user_id', type: 'text', label: '사용자 ID (JSON body, 필수)', required: true }
    ],
    exampleReq: `{
  "user_id": "guest"
}`,
    exampleRes:  `{
  "status": "success",
  "data": {
    "message": "메시지가 성공적으로 삭제되었습니다."
  }
}`
  },
  {
    method: 'POST',
    path: '/api/chat/messages/:message_id/reaction',
    title: '메시지 리액션 추가',
    desc: '특정 메시지에 리액션을 추가합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`reaction` (body): 필수, 1-10자 사이의 문자열.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true },
      { name: 'reaction', type: 'text', label: '리액션 (1-10자)', required: true }
    ],
    exampleReq:  `{
  "reaction": "🎉"
}`,
    exampleRes:  `{
  "status": "success",
  "data": {
    "message": "리액션이 성공적으로 추가/수정되었습니다.",
    "reaction": "👍"
  }
}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id/reaction',
    title: '메시지 리액션 제거',
    desc: '특정 메시지의 리액션을 제거합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{
  "status": "success",
  "data": {
    "message": "리액션이 성공적으로 제거되었습니다."
  }
}`
  },
  /* 5. 파일 업로드 */
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/upload',
    title: '파일 업로드 (채팅)',
    desc: '특정 채팅 세션에 파일을 업로드하고, 해당 파일 정보를 메시지로 저장합니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`file` (file): 필수, 허용된 타입 (jpeg, png, pdf, txt, md, html, css, js, ts, py, java, c, cpp, go, rb, php, swift, kt, sh, sql).</li><li>`message_content` (form-data): 선택, 파일과 함께 전송할 메시지.</li></ul><br><span class="api-desc-note">파일 크기 제한은 구독 등급에 따라 달라집니다: 코멧(10MB), 플래닛(50MB), 스타(500MB), 갤럭시(2GB)</span><br><span class="api-desc-note">⚠️ 최근 개선: 구독 등급별 파일 크기 제한, 업로드 실패 시 자동 파일 정리, 게스트 사용자 지원</span>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true },
      { name: 'file', type: 'file', label: '업로드 파일 (다양한 타입 허용, 구독 등급별 크기 제한)', required: true },
      { name: 'message_content', type: 'text', label: '파일과 함께 전송할 메시지 (선택)', required: false }
    ],    
    exampleReq: '(multipart/form-data: file=파일 선택, message_content="문서를 첨부합니다")',
    exampleRes:  `{
  "status": "success",
  "data": {
    "message": "파일이 성공적으로 업로드되었습니다.",
    "user_message_id": "user-msg-id",
    "file_message": {
      "message_id": "file-msg-id",
      "file_name": "document.pdf",
      "file_size": 1024000,
      "file_path": "/uploads/session-id/document.pdf",
      "content_type": "application/pdf"
    }
  }
}`  },
  
  /* 뱃지 레벨 시스템 */
  {
    method: 'GET',
    path: '/api/users/:user_id/badge-details',
    title: '사용자 뱃지 상세 조회',
    desc: '사용자의 모든 뱃지와 레벨 정보를 상세히 조회합니다. 뱃지는 타입별로 분류되며, 각 뱃지의 레벨과 업데이트 기록을 포함합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'badge_name', type: 'text', label: '특정 뱃지 이름 (선택)', required: false }
    ],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": {
    "total_badges": 3,
    "badges_by_type": {
      "special": [
        {
          "badge_id": "badge123",
          "badge_name": "버그 헌터",
          "badge_description": "세 번째 버그 제보! 진정한 버그 헌터로 성장하고 있습니다",
          "badge_icon": "🛠️",
          "badge_color": "#795548",
          "badge_level": 3,
          "is_equipped": 1,
          "earned_at": "2025-01-27T10:00:00.000Z",
          "updated_at": "2025-01-27T15:30:00.000Z"
        }
      ],
      "achievement": [],
      "premium": [],
      "activity": []
    },
    "all_badges": [...]
  }
}`
  },  {
    method: 'POST',
    path: '/api/users/:user_id/bug-report',
    title: '버그 제보 (승인 대기 방식)',
    desc: '버그를 제보하면 개발팀 검토 대기 상태가 됩니다. 개발자가 승인하면 "버그 헌터" 뱃지 레벨이 증가합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'bug_description', type: 'text', label: '버그 설명 (최소 10자)', required: true },
      { name: 'severity', type: 'select', label: '심각도', required: false, options: ['low', 'medium', 'high', 'critical'], default: 'medium' },
      { name: 'steps_to_reproduce', type: 'text', label: '재현 단계', required: false },
      { name: 'expected_behavior', type: 'text', label: '예상 동작', required: false },
      { name: 'actual_behavior', type: 'text', label: '실제 동작', required: false }
    ],
    exampleReq: `{
  "bug_description": "메시지 전송 시 가끔 중복으로 전송되는 문제가 있습니다",
  "severity": "medium",
  "steps_to_reproduce": "1. 채팅창에 메시지 입력 2. 빠르게 Enter 키를 여러 번 누름",
  "expected_behavior": "메시지가 한 번만 전송되어야 함",
  "actual_behavior": "동일한 메시지가 2-3번 중복 전송됨"
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "message": "버그 제보가 접수되었습니다. 개발팀 검토 후 뱃지가 지급됩니다.",
    "report_status": "pending_review",
    "exp_reward": 5,
    "note": "개발자 승인 후 버그 헌터 뱃지 레벨이 증가합니다."
  }
}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/feedback',
    title: '피드백 제출 (승인 대기 방식)',
    desc: '피드백을 제출하면 개발팀 검토 대기 상태가 됩니다. 개발자가 승인하면 "피드백 전문가" 뱃지 레벨이 증가합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'feedback_content', type: 'text', label: '피드백 내용 (최소 5자)', required: true },
      { name: 'feedback_type', type: 'select', label: '피드백 타입', required: false, options: ['general', 'ui_ux', 'feature_request', 'performance'], default: 'general' },
      { name: 'rating', type: 'number', label: '평점 (1-5)', required: false },
      { name: 'suggestion', type: 'text', label: '개선 제안', required: false }
    ],
    exampleReq: `{
  "feedback_content": "채팅 인터페이스가 매우 직관적이고 사용하기 쉽습니다",
  "feedback_type": "ui_ux",
  "rating": 5,
  "suggestion": "다크 모드 옵션이 있으면 더 좋을 것 같습니다"
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "message": "피드백이 제출되었습니다. 개발팀 검토 후 뱃지가 지급됩니다.",
    "feedback_status": "pending_review",
    "exp_reward": 3,
    "note": "개발자 승인 후 피드백 전문가 뱃지 레벨이 증가합니다."
  }
}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/subscription-badge',
    title: '구독 기간 뱃지 업그레이드',
    desc: '플래닛/스타 구독자의 구독 기간에 따라 뱃지 레벨을 업그레이드합니다. 1→2→3→6→12→24→36개월 단계별 레벨 시스템.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'tier_name', type: 'select', label: '구독 등급', required: true, options: ['planet', 'star'] },
      { name: 'months_count', type: 'number', label: '구독 개월 수 (1-60)', required: true }
    ],
    exampleReq: `{
  "tier_name": "planet",
  "months_count": 6
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "message": "플래닛 구독자 뱃지가 레벨 4로 업그레이드되었습니다!",
    "badge_upgrade": {
      "badge_name": "플래닛 구독자",
      "old_level": 3,
      "new_level": 4,
      "description": "플래닛 6개월 구독! 오랜 기간 함께해주셔서 감사합니다",
      "icon": "🏡",
      "exp_reward": 40
    },
    "months_count": 6,
    "tier_name": "planet"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/approve-badge',
    title: '개발자 뱃지 승인 (관리자용)',
    desc: '개발자가 버그 제보나 피드백을 검토한 후 수동으로 뱃지 레벨을 승인합니다. 승인 시 추가 보너스 경험치가 지급됩니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'badge_name', type: 'select', label: '승인할 뱃지', required: true, options: ['버그 헌터', '피드백 전문가'] },
      { name: 'reason', type: 'text', label: '승인 사유', required: false }
    ],
    exampleReq: `{
  "badge_name": "버그 헌터",
  "reason": "중요한 버그 발견으로 서비스 안정성 크게 향상"
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "message": "버그 헌터 뱃지 레벨이 승인되었습니다!",
    "badge_upgrade": {
      "badge_name": "버그 헌터",
      "old_level": 2,
      "new_level": 3,
      "description": "세 번째 버그 제보! 진정한 버그 헌터로 성장하고 있습니다",
      "icon": "🛡️",
      "exp_reward": 30
    },
    "bonus_exp": 25,
    "approved_by": "developer"
  }
}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/test-participation',
    title: '테스트 참여 (뱃지 레벨 자동 증가)',
    desc: '알파/베타 테스트에 참여하면 해당 테스터 뱃지의 레벨이 증가하고 경험치를 획득합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'test_type', type: 'select', label: '테스트 타입', required: true, options: ['alpha', 'beta'] },
      { name: 'test_details', type: 'text', label: '테스트 세부사항', required: false },
      { name: 'completion_status', type: 'text', label: '완료 상태', required: false }
    ],
    exampleReq: `{
  "test_type": "beta",
  "test_details": "새로운 채팅 기능 베타 테스트 참여",
  "completion_status": "완료"
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "message": "beta 테스트 참여가 기록되었습니다. 감사합니다!",
    "badge_upgrade": {
      "success": true,
      "badge_name": "베타 테스터",
      "old_level": 1,
      "new_level": 2,
      "description": "베타 테스트 2단계! 사용자 관점에서 소중한 피드백을 제공하고 있습니다",
      "icon": "🎯",
      "exp_reward": 20
    },
    "exp_reward": 20
  }
}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/badges/upgrade',
    title: '뱃지 레벨 직접 업그레이드 (개발/테스트용)',
    desc: '관리자나 개발자가 특정 뱃지의 레벨을 직접 업그레이드할 수 있습니다. 주로 테스트나 특별한 상황에서 사용됩니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'badge_name', type: 'text', label: '뱃지 이름', required: true },
      { name: 'action_reason', type: 'text', label: '업그레이드 사유', required: false }
    ],
    exampleReq: `{
  "badge_name": "버그 헌터",
  "action_reason": "특별 기여 인정"
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "badge_name": "버그 헌터",
    "old_level": 3,
    "new_level": 4,
    "description": "네 번째 버그 제보! 전문적인 테스터의 면모를 보이고 있습니다",
    "icon": "🎯",
    "exp_reward": 40,
    "action_reason": "특별 기여 인정"
  }
}`
  },
  
  /* 6. 검색 기능 */
  {
    method: 'GET',
    path: '/api/search/wikipedia',
    title: '위키피디아 검색',
    desc: '위키피디아에서 키워드를 검색하여 관련 정보를 가져옵니다.<br>Query Parameters: <ul><li>`q`: 검색어 (필수, 1-500자)</li><li>`limit`: 결과 개수 (선택, 1-50, 기본값: 10)</li><li>`language`: 언어 코드 (선택, ko/en/ja/zh/fr/de/es/ru, 기본값: ko)</li></ul>',
    params: [
      { name: 'q', type: 'text', label: '검색어 (1-500자)', required: true, default: '대한민국' },
      { name: 'limit', type: 'number', label: '결과 개수 (1-50, 기본값: 10)', required: false, default: '5' },
      { name: 'language', type: 'text', label: '언어 코드 (ko/en/ja 등, 기본값: ko)', required: false, default: 'ko' }
    ],
    exampleReq: '?q=대한민국&limit=5&language=ko',
    exampleRes: `{
  "status": "success",
  "data": {
    "query": "대한민국",
    "language": "ko", 
    "limit": 5,
    "results": [
      {
        "title": "대한민국",
        "snippet": "대한민국은 동아시아의 한반도 남부에 위치한 공화국이다...",
        "url": "https://ko.wikipedia.org/wiki/대한민국",
        "thumbnail": "https://upload.wikimedia.org/...",
        "page_id": "123456"
      }
    ],
    "total_found": 1
  }
}`
  },
  
  {
    method: 'GET',
    path: '/api/search/weather',
    title: '날씨 검색 (IP 기반 자동 위치 감지)',
    desc: '사용자의 IP 주소를 기반으로 위치를 자동 감지하여 현재 날씨와 예보를 제공합니다.<br>Query Parameters: <ul><li>`units`: 온도 단위 (선택, metric/imperial/kelvin, 기본값: metric)</li><li>`lang`: 언어 코드 (선택, ko/en/ja 등, 기본값: ko)</li><li>`city`: 도시명 (선택, 제공시 IP 감지 대신 사용)</li><li>`lat`, `lon`: 위도, 경도 (선택, 제공시 정확한 좌표 사용)</li></ul><br><b>기능:</b> IP 기반 자동 위치 감지, 현재 날씨 + 8시간 예보, 메모리 캐싱, 로컬 IP 시 서울 기본값',
    params: [
      { name: 'units', type: 'text', label: '온도 단위 (metric/imperial/kelvin)', required: false, default: 'metric' },
      { name: 'lang', type: 'text', label: '언어 코드 (ko/en/ja)', required: false, default: 'ko' },
      { name: 'city', type: 'text', label: '도시명 (선택사항)', required: false, default: '' },
      { name: 'lat', type: 'number', label: '위도 (-90~90)', required: false, default: '' },
      { name: 'lon', type: 'number', label: '경도 (-180~180)', required: false, default: '' }
    ],
    exampleReq: '?units=metric&lang=ko (IP 기반 자동 감지)',
    exampleRes: `{
  "status": "success",
  "data": {
    "location": {
      "name": "Seoul",
      "country": "KR",
      "coordinates": {
        "latitude": 37.5665,
        "longitude": 126.978
      },
      "timezone": 32400
    },
    "current": {
      "temperature": 15,
      "feels_like": 13,
      "description": "맑음",
      "main": "Clear",
      "icon": "01d",
      "humidity": 65,
      "pressure": 1015,
      "visibility": 10000,
      "wind": {
        "speed": 3.2,
        "direction": 180
      },
      "clouds": 10,
      "sunrise": "2025-06-19T05:30:00.000Z",
      "sunset": "2025-06-19T10:45:00.000Z",
      "timestamp": "2025-06-19T08:00:00.000Z"
    },
    "forecast": [
      {
        "datetime": "2025-06-19T09:00:00.000Z",
        "temperature": {
          "current": 17,
          "min": 15,
          "max": 18
        },
        "description": "구름 조금",
        "icon": "02d",
        "humidity": 60,
        "wind_speed": 2.8,
        "clouds": 25,
        "rain": 0
      }
    ],
    "units": "metric",
    "language": "ko",
    "timestamp": "2025-06-19T08:00:00.000Z",
    "ip_detected": {
      "ip": "123.45.67.89",
      "detected_city": "Seoul",
      "detected_country": "South Korea",
      "is_local_ip": false,
      "used_fallback": false
    }
  }
}`
  },
  
  /* 구독 관리 시스템 */
  {
    method: 'GET',
    path: '/api/subscriptions/tiers',
    title: '구독 등급 목록 조회',
    desc: '사용 가능한 모든 구독 등급 목록을 반환합니다. 각 등급의 이름, 가격, 제한사항, 기능 등을 포함합니다.',
    params: [],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": [
    {
      "tier_id": 1,
      "tier_name": "코멧",
      "tier_emoji": "☄️",
      "price_monthly": 0,
      "price_yearly": 0,
      "max_sessions_per_day": 10,
      "max_messages_per_session": 50,
      "max_file_upload_mb": 5,
      "ai_model_access": ["geminiapi"],
      "features": ["basic_chat", "file_upload"],
      "is_active": true,
      "created_at": "2025-01-27T00:00:00.000Z"
    },
    {
      "tier_id": 2,
      "tier_name": "플래닛",
      "tier_emoji": "🪐",
      "price_monthly": 15000,
      "price_yearly": 150000,
      "max_sessions_per_day": 100,
      "max_messages_per_session": 200,
      "max_file_upload_mb": 20,
      "ai_model_access": ["geminiapi", "vertexai"],
      "features": ["basic_chat", "file_upload", "priority_support"],
      "is_active": true,
      "created_at": "2025-01-27T00:00:00.000Z"
    }
  ]
}`
  },
  {
    method: 'GET',
    path: '/api/subscriptions/users/:user_id/subscription',    title: '사용자 구독 정보 조회',
    desc: '특정 사용자의 현재 구독 정보를 조회합니다. 구독 등급, 만료일, 상태 등을 포함합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": {
    "subscription_id": "SUB123456789",
    "user_id": "guest",
    "tier_id": 1,
    "tier_name": "코멧",
    "tier_emoji": "☄️",
    "subscription_status": "active",
    "start_date": "2025-01-27T00:00:00.000Z",
    "end_date": null,
    "auto_renewal": true,
    "payment_method": null,
    "last_payment_date": null,
    "next_payment_date": null,
    "created_at": "2025-01-27T00:00:00.000Z",
    "updated_at": "2025-01-27T00:00:00.000Z"
  }
}`
  },
  {
    method: 'PUT',
    path: '/api/subscriptions/users/:user_id/subscription',
    title: '구독 업그레이드/다운그레이드',
    desc: '사용자의 구독 등급을 변경합니다. 업그레이드 또는 다운그레이드가 가능합니다.',    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'tier_name', type: 'text', label: '새로운 구독 등급명 (한국어: 코멧/플래닛/스타/갤럭시 또는 영어: free/planet/star/galaxy)', required: true },
      { name: 'payment_method', type: 'text', label: '결제 방법 (optional)', required: false },
      { name: 'billing_cycle', type: 'text', label: '결제 주기 (monthly/yearly)', required: false },
      { name: 'auto_renewal', type: 'checkbox', label: '자동 갱신 여부', required: false }
    ],
    exampleReq: `{
  "tier_name": "플래닛",
  "payment_method": "credit_card",
  "billing_cycle": "monthly",
  "auto_renewal": true
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "subscription_id": "SUB123456789",
    "user_id": "guest",
    "tier_id": 2,
    "tier_name": "플래닛",
    "tier_emoji": "🪐",
    "subscription_status": "active",
    "start_date": "2025-01-27T00:00:00.000Z",
    "end_date": "2025-02-27T00:00:00.000Z",
    "auto_renewal": true,
    "payment_method": "credit_card",
    "last_payment_date": "2025-01-27T00:00:00.000Z",
    "next_payment_date": "2025-02-27T00:00:00.000Z",
    "updated_at": "2025-01-27T10:30:00.000Z"
  }
}`
  },
  {
    method: 'DELETE',
    path: '/api/subscriptions/users/:user_id/subscription',
    title: '구독 취소',    desc: '사용자의 현재 구독을 취소합니다. 즉시 취소되거나 현재 기간 종료 후 취소됩니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'immediate', type: 'checkbox', label: '즉시 취소 여부', required: false },
      { name: 'reason', type: 'text', label: '취소 사유 (optional)', required: false }
    ],
    exampleReq: `{
  "immediate": false,
  "reason": "서비스 불만족"
}`,
    exampleRes: `{
  "status": "success",
  "data": {
    "message": "구독이 성공적으로 취소되었습니다.",
    "subscription_id": "SUB123456789",
    "cancellation_date": "2025-01-27T10:30:00.000Z",
    "service_end_date": "2025-02-27T00:00:00.000Z",
    "immediate_cancellation": false
  }
}`
  },
  {
    method: 'GET',
    path: '/api/subscriptions/users/:user_id/subscription/history',
    title: '구독 이력 조회',
    desc: '사용자의 구독 변경 이력을 조회합니다. 업그레이드, 다운그레이드, 결제 이력 등을 포함합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'limit', type: 'number', label: '조회 개수 제한 (optional)', required: false },
      { name: 'offset', type: 'number', label: '조회 시작 위치 (optional)', required: false }
    ],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": [
    {
      "history_id": "HIST123456789",
      "subscription_id": "SUB123456789",
      "user_id": "guest",
      "action_type": "upgrade",
      "old_tier_id": 1,
      "old_tier_name": "코멧",
      "new_tier_id": 2,
      "new_tier_name": "플래닛",
      "amount_paid": 15000,
      "payment_method": "credit_card",
      "created_at": "2025-01-27T10:30:00.000Z"
    }
  ]
}`
  },
  {
    method: 'GET',
    path: '/api/subscriptions/users/:user_id/subscription/features/:feature_name',
    title: '기능 접근 권한 확인',
    desc: '사용자의 현재 구독 등급으로 특정 기능에 접근할 수 있는지 확인합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'feature_name', type: 'text', label: '기능 이름 (예: premium_ai, priority_support)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": {
    "feature_name": "premium_ai",
    "has_access": true,
    "tier_name": "플래닛",
    "tier_emoji": "🪐",
    "reason": "현재 구독 등급에서 지원하는 기능입니다."
  }
}`
  },
  {
    method: 'GET',
    path: '/api/subscriptions/users/:user_id/subscription/usage',
    title: '일일 사용량 확인',
    desc: '사용자의 오늘 사용량과 구독 등급별 제한을 확인합니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes: `{
  "status": "success",
  "data": {
    "user_id": "guest",
    "tier_name": "플래닛",
    "tier_emoji": "🪐",
    "usage_date": "2025-01-27",
    "sessions_today": 5,
    "max_sessions_per_day": 100,
    "messages_today": 45,
    "max_messages_per_session": 200,
    "file_uploads_today": 2,
    "max_file_upload_mb": 20,
    "remaining_sessions": 95,
    "usage_percentage": 5.0
  }
}`
  },
  {
    method: 'POST',
    path: '/api/subscriptions/users/:user_id/subscription/upgrade',
    title: '구독 업그레이드 시뮬레이션',
    desc: '실제 결제 없이 구독 업그레이드를 시뮬레이션합니다. 테스트용 API입니다.',    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'tier_name', type: 'text', label: '목표 구독 등급명 (한국어: 코멧/플래닛/스타/갤럭시 또는 영어: free/planet/star/galaxy)', required: true },
      { name: 'simulation_type', type: 'text', label: '시뮬레이션 타입 (upgrade/downgrade)', required: false }
    ],
    exampleReq: `{
  "tier_name": "planet",
  "simulation_type": "upgrade"
}`,    exampleRes: `{
  "status": "success",
  "data": {
    "message": "Subscription upgrade simulation completed",
    "simulation": {
      "user_id": "API_TEST_USER_ID",
      "current_tier": {
        "tier_id": 1,
        "tier_name": "free",
        "tier_display_name": "☄️ 코멧",
        "tier_emoji": "☄️",
        "monthly_price": 0,
        "yearly_price": 0,
        "tier_level": 1
      },
      "target_tier": {
        "tier_id": 3,
        "tier_name": "star",
        "tier_display_name": "☀️ 스타",
        "tier_emoji": "☀️",
        "monthly_price": 150000,
        "yearly_price": 1500000,
        "tier_level": 3
      },
      "upgrade_type": "upgrade",
      "estimated_monthly_cost": 150000,
      "estimated_yearly_cost": 1500000,
      "new_features": ["premium_ai", "priority_support", "advanced_analytics"],
      "payment_simulation": true,
      "can_proceed": true,
      "simulation_timestamp": "2025-01-27T10:30:00.000Z"
    }
  }
}`
  },
  {
    method: 'POST',
    path: '/api/subscriptions/users/:user_id/subscription/renewal',
    title: '구독 갱신 시뮬레이션',
    desc: '실제 결제 없이 구독 갱신을 시뮬레이션합니다. 테스트용 API입니다.',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'renewal_period', type: 'text', label: '갱신 기간 (monthly/yearly)', required: false },
      { name: 'apply_discount', type: 'checkbox', label: '할인 적용 여부', required: false }
    ],
    exampleReq: `{
  "renewal_period": "monthly",
  "apply_discount": true
}`,    exampleRes: `{
  "status": "success",
  "data": {
    "message": "Subscription renewal simulation completed",
    "simulation": {
      "user_id": "API_TEST_USER_ID",
      "current_subscription": {
        "subscription_id": 123,
        "tier": {
          "tier_id": 2,
          "tier_name": "planet",
          "tier_display_name": "🪐 플래닛",
          "tier_emoji": "🪐",
          "monthly_price": 15000,
          "yearly_price": 150000,
          "tier_level": 2
        },
        "auto_renewal": true
      },
      "renewal_period": "monthly",
      "renewal_date": "2025-02-27T10:30:00.000Z",
      "base_price": 15000,
      "discount_applied": true,
      "discount_amount": 1500,
      "final_price": 13500,
      "auto_renewal": true,
      "payment_simulation": true,
      "simulation_timestamp": "2025-01-27T10:30:00.000Z"
    }
  }
}`
  }
];

const apiList = document.getElementById('api-list');
apis.forEach((api, idx) => {
  const div = document.createElement('div');
  div.className = 'api-item';
  const defaultValues = {
    'username': 'APItest',
    'email': 'API@example.com',
    'password': 'password123',
    'user_id': 'API_TEST_USER_ID',
    'session_id': 'API_TEST_SESSION_ID', 
    'message_id': 'API_TEST_USER_MESSAGE_ID',
  };
  div.innerHTML = [
    '<div class="api-title"><span class="api-method">' + api.method + '</span> <span class="api-path">' + api.path + '</span> - ' + api.title + '</div>',
    '<div class="api-desc">' + api.desc + '</div>',
    '<details><summary>요청/응답 예시 보기</summary>' +
      '<div><b>요청 예시:</b><pre>' + (api.exampleReq || '-') + '</pre></div>' +
      '<div><b>응답 예시:</b><pre>' + (api.exampleRes || '-') + '</pre></div>' +
    '</details>',    '<form class="api-test" onsubmit="return false;" id="form-' + idx + '">',
      api.params.filter(function(p){return p.inPath;}).map(function(p) {
        const def = defaultValues[p.name] ? ' value="' + defaultValues[p.name] + '"' : '';
        return '<label>' + p.label + (p.required ? ' *' : '') + '</label>' +
          '<input type=\"text\" name=\"' + p.name + '\"' + (p.required ? ' required' : '') + def + ' placeholder=\"(URL 경로에 사용)\">';
      }).join(''),
      // GET 요청의 쿼리 파라미터 처리
      (api.method === 'GET' && api.params.filter(function(p){return !p.inPath && p.type!=='file';}).length > 0
        ? api.params.filter(function(p){return !p.inPath && p.type!=='file';}).map(function(p) {
          const def = p.default ? ' value="' + p.default + '"' : '';
          return '<label>' + p.label + (p.required ? ' *' : '') + '</label>' +
            '<input type=\"' + (p.type === 'number' ? 'number' : 'text') + '\" name=\"' + p.name + '\"' + (p.required ? ' required' : '') + def + ' placeholder=\"(쿼리 파라미터)\">';
        }).join('')
        : ''),
      ((api.method === 'POST' || api.method === 'PUT' || api.method === 'DELETE') && api.params.filter(function(p){return !p.inPath && p.type!=='file';}).length > 0
        ? '<label>요청 JSON</label><textarea name="jsonBody" rows="5">' + (api.exampleReq && api.exampleReq !== '' && api.exampleReq !== '(multipart/form-data)' ? api.exampleReq : '{}') + '</textarea>'
        : ''),
      api.params.filter(function(p){return p.type==='file';}).map(function(p) {
        return '<label>' + p.label + (p.required ? ' *' : '') + '</label>' +
          '<input type=\"file\" name=\"' + p.name + '\"' + (p.required ? ' required' : '') + '>';
      }).join(''),
      '<button type="submit">API 호출</button>',
      '<div class="result" style="display:none;"></div>',
    '</form>'
  ].join('');
  apiList.appendChild(div);
  setTimeout(function() { 
    var form = document.getElementById('form-' + idx);
    if (!form) return;      form.onsubmit = async function(event) {
      event.preventDefault();
      const resultDiv = form.querySelector('.result');
      resultDiv.style.display = 'block';
      resultDiv.textContent = '요청 중...';
      let url = api.path;
      
      // URL path 파라미터 처리
      api.params.filter(p => p.inPath).forEach(p => {
        const v = form.elements[p.name].value;
        url = url.replace(':' + p.name, encodeURIComponent(v));
      });
      
      // GET 요청의 쿼리 파라미터 처리
      if (api.method === 'GET') {
        const queryParams = [];
        api.params.filter(p => !p.inPath && p.type !== 'file').forEach(p => {
          const v = form.elements[p.name] ? form.elements[p.name].value : '';
          if (v !== '') {
            queryParams.push(encodeURIComponent(p.name) + '=' + encodeURIComponent(v));
          }
        });
        if (queryParams.length > 0) {
          url += '?' + queryParams.join('&');
        }
      }
      
      let fetchOpts = { method: api.method, headers: {} };
      const hasFile = api.params.some(p => p.type === 'file');
      if (hasFile) {
        const formData = new FormData();
        api.params.filter(p => p.type === 'file').forEach(p => {
          const fileInput = form.elements[p.name];
          if (fileInput && fileInput.files.length > 0) {
            formData.append(p.name, fileInput.files[0]);
          }
        });

        const hasOtherBodyParams = api.params.some(p => !p.inPath && p.type !== 'file');
        if (hasOtherBodyParams && form.elements['jsonBody']) {
          try {
            const json = JSON.parse(form.elements['jsonBody'].value);
            Object.keys(json).forEach(k => formData.append(k, json[k]));
          } catch {
            resultDiv.className = 'result error';
            resultDiv.textContent = 'JSON 형식 오류';
            return;
          }
        }
        fetchOpts.body = formData;

      } else if (api.method === 'POST' || api.method === 'PUT' || api.method === 'DELETE') {
        if (form.elements['jsonBody']) {
          try {
            fetchOpts.headers['Content-Type'] = 'application/json';
            fetchOpts.body = form.elements['jsonBody'].value;
            JSON.parse(fetchOpts.body); // Validate JSON
          } catch {
            resultDiv.className = 'result error';
            resultDiv.textContent = 'JSON 형식 오류';
            return;
          }
        }
      }

      // The section you highlighted starts here:
      const token = localStorage.getItem('token');
      if (token) fetchOpts.headers['Authorization'] = 'Bearer ' + token;

      try {
        const resp = await fetch(url, fetchOpts);
        const text = await resp.text();
        let display = '';
        try { display = JSON.stringify(JSON.parse(text), null, 2); } catch { display = text; }
        resultDiv.className = 'result' + (resp.ok ? '' : ' error');
        resultDiv.textContent = 'Status: ' + resp.status + ' ' + resp.statusText + '\n' + display;
      } catch (e) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'API 호출 오류: ' + e.message;
      }
    };
  }
  , 0);
}
);