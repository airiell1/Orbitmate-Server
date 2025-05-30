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
    path: '/api/users/:user_id/settings',
    title: '사용자 설정 조회',
    desc: '특정 사용자의 설정을 조회합니다.<br>Validation Rules: <ul><li>`user_id` (URL param): 필수, 최대 36자.</li>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: true, inPath: true }
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
    exampleReq:  `{\n  "theme": "dark",\n  "language": "en",\n  "font_size": 16,\n  "notifications_enabled": false,\n  "ai_model_preference": "gemini-2.5-pro-exp-03-25"\n}`,
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
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",\n  "is_active": 1,\n  "profile_image_path": null,\n  "theme_preference": "light",\n  "bio": "테스트 계정입니다.",\n  "badge": null,\n  "experience": 0,\n  "level": 1,\n  "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  /* 3. 채팅 세션 관리 */
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
    ],
    exampleReq: `{\n  "user_id": "USER123"\n}`,
    exampleRes: `{\n  "message": "세션 및 관련 메시지가 성공적으로 삭제되었습니다.",\n  "deleted_session_id": "API_TEST_SESSION_ID",\n  "deleted_messages_count": 0\n}` // 메시지 카운트는 실제 삭제된 수에 따라 달라질 수 있습니다.
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
    desc: '특정 채팅 세션에 새 메시지를 전송하고 AI의 응답을 받습니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 최대 36자.</li><li>`message` (body): 필수, 최대 4000자.</li><li>`system_prompt` (body): 선택, 최대 2000자.</li><li>`special_mode_type` (body): 선택, \'stream\' 또는 \'canvas\' 중 하나여야 합니다.</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true, default: 'API_TEST_SESSION_ID' },
      { name: 'message', type: 'text', label: '메시지 (최대 4000자)', required: true },
      { name: 'system_prompt', type: 'text', label: '시스템 프롬프트 (최대 2000자)', required: false },
      { name: 'special_mode_type', type: 'text', label: '특수 모드 (stream/canvas)', required: false }
    ],
    exampleReq:  `{\n  "message": "안녕하세요! 오늘 날씨에 대해 알려주세요.",\n  "system_prompt": "AI는 친절하게 답변합니다.",\n  "special_mode_type": "stream"\n}`,
    exampleRes:  `{\n  "user_message_id": "API_TEST_USER_MESSAGE_ID",\n  "ai_message_id": "API_TEST_AI_MESSAGE_ID",\n  "message": "안녕하세요! 무엇을 도와드릴까요?",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'PUT',
    path: '/api/chat/messages/:message_id',
    title: '메시지 수정',
    desc: '특정 메시지의 내용을 수정합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 최대 36자.</li><li>`content` (body): 필수, 최대 4000자.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true },
      { name: 'content', type: 'text', label: '수정할 내용 (최대 4000자)', required: true }
    ],
    exampleReq:  `{\n  "content": "이것은 수정된 메시지입니다."\n}`,
    exampleRes:  `{\n  "message": "메시지가 성공적으로 수정되었습니다.",\n  "updatedMessage": { ... }\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id',
    title: '메시지 삭제',
    desc: '특정 메시지를 삭제합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 최대 36자.</li></ul>',
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
    desc: '특정 메시지에 리액션을 추가합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 최대 36자.</li><li>`reaction` (body): 필수, 최대 10자.</li></ul>',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID (최대 36자)', required: true, inPath: true },
      { name: 'reaction', type: 'text', label: '리액션 (최대 10자)', required: true }
    ],
    exampleReq:  `{\n  "reaction": "🎉"\n}`,
    exampleRes:  ` {\n  "message": "리액션이 성공적으로 추가/수정되었습니다.",\n  "reaction": "👍"\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id/reaction',
    title: '메시지 리액션 제거',
    desc: '특정 메시지의 리액션을 제거합니다.<br>Validation Rules: <ul><li>`message_id` (URL param): 필수, 최대 36자.</li></ul>',
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
    desc: '특정 채팅 세션에 파일을 업로드하고, 해당 파일 정보를 메시지로 저장합니다.<br>Validation Rules: <ul><li>`session_id` (URL param): 필수, 최대 36자.</li><li>`file` (file): 필수, 허용된 타입 (jpeg, png, pdf), 최대 5MB.</li><li>`user_id` (form-data): 선택, 최대 36자.</li></ul>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID (최대 36자)', required: true, inPath: true },
      { name: 'file', type: 'file', label: '업로드 파일 (jpg/png/pdf, max 5MB)', required: true },
      { name: 'user_id', type: 'text', label: '사용자 ID (최대 36자)', required: false }
    ],
    exampleReq: '(multipart/form-data: file=파일 선택, user_id=USER123)',
    exampleRes:  ` {\n  "message": "파일이 성공적으로 업로드되었습니다.",\n  "fileMessage": { ... }\n}`
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
    '</details>',
    '<form class="api-test" onsubmit="return false;" id="form-' + idx + '">',
      api.params.filter(function(p){return p.inPath;}).map(function(p) {
        const def = defaultValues[p.name] ? ' value="' + defaultValues[p.name] + '"' : '';
        return '<label>' + p.label + (p.required ? ' *' : '') + '</label>' +
          '<input type=\"text\" name=\"' + p.name + '\"' + (p.required ? ' required' : '') + def + ' placeholder=\"(URL 경로에 사용)\">';
      }).join(''),
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
    if (!form) return;
      form.onsubmit = async function(event) {
      event.preventDefault();
      const resultDiv = form.querySelector('.result');
      resultDiv.style.display = 'block';
      resultDiv.textContent = '요청 중...';
      let url = api.path;
      api.params.filter(p => p.inPath).forEach(p => {
        const v = form.elements[p.name].value;
        url = url.replace(':' + p.name, encodeURIComponent(v));
      });
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