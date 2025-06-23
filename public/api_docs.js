/*
  General API Information:
  Error Responses: All API error responses now follow a standard format:
  {
    "error": {
      "code": "ERROR_CODE_IN_SNAKE_CASE",
      "message": "A descriptive error message."
    }
  }
  All keys in the response, including error responses, are in snake_case.
*/
const apis = [
  {
    method: 'GET',
    path: '/api/health',
    title: '서버 상태 확인',
    desc: '서버의 현재 상태와 타임스탬프를 반환합니다.',
    params: [],
    exampleReq: '',
    exampleRes: `{\n  "status": "ok",\n  "timestamp": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'GET',
    path: '/api/ai/models',
    title: 'AI 모델 정보 조회',
    desc: '사용 가능한 AI 모델 목록과 관련 정보를 반환합니다. 이 정보는 클라이언트에서 AI 공급자 및 모델 선택 UI를 구성하는 데 사용될 수 있습니다.',
    params: [], // No parameters for this GET request
    exampleReq: '', // No request body
    exampleRes: `[
   {
     "provider": "geminiapi",
     "id": "gemini-2.0-flash-thinking-exp-01-21", 
     "name": "Google AI Studio (gemini-2.0-flash-thinking-exp-01-21)",
     "max_input_tokens": 1048576, 
     "max_output_tokens": 8192,
     "is_default": true 
   },
   {
     "provider": "ollama",
     "id": "llama2", 
     "name": "Ollama (llama2)",
     "max_input_tokens": 128000, 
     "max_output_tokens": 8192,
     "is_default": false 
   },
   {
     "provider": "vertexai",
     "id": "gemini-2.5-pro-exp-03-25", 
     "name": "Vertex AI (gemini-2.5-pro-exp-03-25)",
     "max_input_tokens": 1048576,
     "max_output_tokens": 65535,
     "is_default": false 
   }
 ]`
  },
  /* 2. 사용자 관리 */
  {
    method: 'POST',
    path: '/api/users/register',
    title: '회원가입',
    desc: '새로운 사용자를 등록합니다.<br>Validation Rules: <ul><li>`username`: 3-30자, 영숫자 및 밑줄(_) 허용.</li><li>`email`: 유효한 이메일 형식, 최대 254자.</li><li>`password`: 최소 8자, 최대 128자.</li></ul>',
    params: [
      { name: 'username', type: 'text', label: '사용자명 (3-30자, 영숫자/_)', required: true },
      { name: 'email', type: 'email', label: '이메일 (최대 254자)', required: true },
      { name: 'password', type: 'password', label: '비밀번호 (8-128자)', required: true }
    ],
    exampleReq: `{\n  "username": "APItestUser",\n  "email": "API@example.com",\n  "password": "password123"\n}`,
    exampleRes: `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'POST',
    path: '/api/users/check-email',
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
    desc: '특정 채팅 세션의 모든 메시지 목록을 조회합니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 최대 36자.</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  ` [{ "message_id": "메시지 ID", "message_content": "내용", ... }]`
  },
  /* 4. 채팅 메시지 관리 */
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/messages',
    title: '채팅 메시지 전송',
    desc: '특정 채팅 세션에 새 메시지를 전송하고 AI의 응답을 받습니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`message` (body): 필수, 1-4000자 사이의 문자열.</li><li>`system_prompt` (body): 선택, 0-2000자 사이의 문자열.</li><li>`special_mode_type` (body): 선택, \'stream\' 또는 \'canvas\' 중 하나여야 합니다.</li></ul><br>Optional overrides:<ul><li>`ai_provider_override`: (string) "vertexai" 또는 "ollama". 제공될 경우 빈 문자열이 아니어야 합니다.</li><li>`model_id_override`: (string) 특정 모델 ID. 제공될 경우 빈 문자열이 아니어야 합니다.</li><li>`user_message_token_count`: (integer >= 0) 사용자 메시지의 토큰 수.</li><li>`max_output_tokens_override`: (integer > 0) AI 응답의 최대 토큰 수 재정의.</li><li>`context_message_limit`: (integer >= 0) 컨텍스트에 포함할 과거 메시지 수 (0은 컨텍스트 없음).</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true, default: 'API_TEST_SESSION_ID' },
      { name: 'message', type: 'text', label: '메시지 (1-4000자)', required: true },
      { name: 'system_prompt', type: 'text', label: '시스템 프롬프트 (0-2000자)', required: false },
      { name: 'special_mode_type', type: 'text', label: '특수 모드 (stream/canvas)', required: false },
      { name: 'ai_provider_override', type: 'text', label: 'AI 제공자 재정의 (vertexai/ollama, 선택)', required: false },
      { name: 'model_id_override', type: 'text', label: 'AI 모델 ID 재정의 (선택)', required: false },
      { name: 'user_message_token_count', type: 'number', label: '사용자 메시지 토큰 수 (선택, 정수 >= 0)', required: false },
      { name: 'max_output_tokens_override', type: 'number', label: '최대 출력 토큰 재정의 (선택, 양의 정수 > 0)', required: false },
      { name: 'context_message_limit', type: 'number', label: '컨텍스트 메시지 제한 (선택, 0 이상 정수)', required: false }
    ],
    exampleReq:  `{\n  "message": "안녕하세요! 오늘 날씨에 대해 알려주세요.",\n  "system_prompt": "AI는 친절하게 답변합니다.",\n  "special_mode_type": "stream",\n  "ai_provider_override": "vertexai",\n  "model_id_override": "gemini-2.0-flash-thinking-exp-01-21",\n  "user_message_token_count": 15,\n  "max_output_tokens_override": 500,\n  "context_message_limit": 10\n}`,
    exampleRes:  `{\n  "user_message_id": "API_TEST_USER_MESSAGE_ID",\n  "ai_message_id": "API_TEST_AI_MESSAGE_ID",\n  "message": "안녕하세요! 오늘 날씨는 맑고 화창합니다.",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",\n  "ai_message_token_count": 25,\n  "ai_provider": "vertexai",\n  "model_id": "gemini-2.0-flash-thinking-exp-01-21"\n}`
  },
  {
    method: 'PUT',
    path: '/api/chat/messages/:message_id',
    title: '메시지 수정',
    desc: '특정 메시지의 내용을 수정합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`content` (body): 필수, 1-4000자 사이의 문자열.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true },
      { name: 'content', type: 'text', label: '수정할 내용 (1-4000자)', required: true }
    ],
    exampleReq:  `{\n  "content": "이것은 수정된 메시지입니다."\n}`,
    exampleRes:  `{\n  "message": "메시지가 성공적으로 수정되었습니다.",\n  "updatedMessage": { ... }\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id',
    title: '메시지 삭제',
    desc: '특정 메시지를 삭제합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  ` {\n  "message": "메시지가 성공적으로 삭제되었습니다."\n}`
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
    exampleReq:  `{\n  "reaction": "🎉"\n}`,
    exampleRes:  ` {\n  "message": "리액션이 성공적으로 추가/수정되었습니다.",\n  "reaction": "👍"\n}`
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
    exampleRes:  ` {\n  "message": "리액션이 성공적으로 제거되었습니다."\n}`
  },
  /* 5. 파일 업로드 */
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/files',
    title: '파일 업로드 (채팅)',
    desc: '특정 채팅 세션에 파일을 업로드하고, 해당 파일 정보를 메시지로 저장합니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 유효한 UUID 형식, 최대 36자.</li><li>`file` (file): 필수, 허용된 타입 (jpeg, png, pdf, txt, md, html, css, js, ts, py, java, c, cpp, go, rb, php, swift, kt, sh, sql), 최대 5MB.</li><li>`user_id` (form-data): 선택, 최대 36자.</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true },
      { name: 'file', type: 'file', label: '업로드 파일 (다양한 타입 허용, max 5MB)', required: true },
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: false }
    ],
    exampleReq: '(multipart/form-data: file=파일 선택, user_id=USER123)',    exampleRes:  ` {\n  "message": "파일이 성공적으로 업로드되었습니다.",\n  "fileMessage": { ... }\n}`  },
  
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
    exampleRes: `[
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
]`
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
  "message": "구독이 성공적으로 취소되었습니다.",
  "subscription_id": "SUB123456789",
  "cancellation_date": "2025-01-27T10:30:00.000Z",
  "service_end_date": "2025-02-27T00:00:00.000Z",
  "immediate_cancellation": false
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
    exampleRes: `[
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
]`
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
  "feature_name": "premium_ai",
  "has_access": true,
  "tier_name": "플래닛",
  "tier_emoji": "🪐",
  "reason": "현재 구독 등급에서 지원하는 기능입니다."
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
}`,exampleRes: `{
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