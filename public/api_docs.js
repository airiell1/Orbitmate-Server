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
    desc: '새로운 사용자를 등록합니다.<br><span class="api-desc-note">username에 "APItest", email에 "API@example.com", password에 "password123"을 입력하면 <b>user_id</b>는 항상 "API_TEST_USER_ID"로 고정됩니다.</span>',
    params: [
      { name: 'username', type: 'text', label: '사용자명', required: true },
      { name: 'email', type: 'email', label: '이메일', required: true },
      { name: 'password', type: 'password', label: '비밀번호', required: true }
    ],
    exampleReq: `{\n  "username": "APItest",\n  "email": "API@example.com",\n  "password": "password123"\n}`,
    exampleRes: `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'POST',
    path: '/api/users/login',
    title: '로그인',
    desc: '사용자가 로그인합니다.<br><span class="api-desc-note">email에 "API@example.com", password에 "password123"을 입력하면 user_id는 항상 "API_TEST_USER_ID"로 고정됩니다.</span>',
    params: [
      { name: 'email', type: 'email', label: '이메일', required: true },
      { name: 'password', type: 'password', label: '비밀번호', required: true }
    ],
    exampleReq:  `{\n  "email": "API@example.com",\n  "password": "password123"\n}`,
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "logged_in_at": "YYYY-MM-DDTHH:mm:ss.sssZ",\n  "token": "랜덤한 문자열"\n}`
  },
  {
    method: 'GET',
    path: '/api/users/:user_id/settings',
    title: '사용자 설정 조회',
    desc: '특정 사용자의 설정을 조회합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 설정을 조회할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "theme": "light",\n  "language": "ko",\n  "font_size": 14,\n  "notifications_enabled": true,\n  "ai_model_preference": null\n}`
  },
  {
    method: 'PUT',
    path: '/api/users/:user_id/settings',
    title: '사용자 설정 수정',
    desc: '특정 사용자의 설정을 업데이트합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 설정을 수정할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'username', type: 'text', label: '사용자명 (선택 사항)', required: false },
      { name: 'theme', type: 'text', label: '테마', required: false },
      { name: 'notifications_enabled', type: 'checkbox', label: '알림 사용', required: false }
    ],
    exampleReq:  `{\n  "theme": "light",\n  "notifications_enabled": false\n}`,
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "theme": "light",\n  "language": "ko",\n  "font_size": 14,\n  "notifications_enabled": false,\n  "ai_model_preference": null\n}`
  },
  {
    method: 'POST',
    path: '/api/users/:user_id/profile/image',
    title: '프로필 이미지 업로드',
    desc: '특정 사용자의 프로필 이미지를 업로드합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 프로필 이미지를 업로드할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'profileImage', type: 'file', label: '프로필 이미지', required: true }
    ],
    exampleReq: '(multipart/form-data)',
    exampleRes: `{\n  "message": "프로필 이미지가 성공적으로 업데이트되었습니다.",\n  "user_id": "API_TEST_USER_ID",\n  "profile_image_path": "/uploads/API_TEST_USER_ID-YYYY-MM-DDTHH:mm:ss.sssZ-Orbitmate.png"\n}`
  },
  {
    method: 'DELETE',
    path: '/api/users/:user_id',
    title: '회원 탈퇴',
    desc: '특정 사용자의 계정을 삭제합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정을 삭제할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{\n  "message": "사용자 계정이 성공적으로 삭제되었습니다.",\n  "user_id": "API_TEST_USER_ID"\n}`
  },
  {
    method: 'GET',
    path: '/api/users/:user_id/profile',
    title: '프로필 조회',
    desc: '특정 사용자의 프로필 정보를 조회합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 프로필을 조회할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "profile_image_url": "/uploads/profiles/API_TEST_USER_ID-profile.jpg",\n  "bio": "테스트 계정입니다."\n}`
  },
  {
    method: 'PUT',
    path: '/api/users/:user_id/profile',
    title: '프로필 수정',
    desc: '특정 사용자의 프로필 정보를 업데이트합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정의 프로필을 수정할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true, inPath: true },
      { name: 'username', type: 'text', label: '사용자명', required: false },
      { name: 'bio', type: 'text', label: '자기소개', required: false }
    ],
    exampleReq:  `{\n  "username": "APItest",\n  "bio": "테스트 계정입니다."\n}`,
    exampleRes:  `{\n  "user_id": "API_TEST_USER_ID",\n  "username": "APItest",\n  "email": "API@example.com",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ",\n  "is_active": 1,\n  "profile_image_path": null,\n  "theme_preference": "light",\n  "bio": "테스트 계정입니다.",\n  "badge": null,\n  "experience": 0,\n  "level": 1,\n  "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  /* 3. 채팅 세션 관리 */
  {
    method: 'POST',
    path: '/api/chat/sessions',
    title: '채팅 세션 생성',
    desc: '새로운 채팅 세션을 생성합니다.<br><span class="api-desc-note">user_id에 "API_TEST_USER_ID"를 입력하면 테스트 계정으로 세션을 생성할 수 있습니다.</span>',
    params: [
      { name: 'user_id', type: 'text', label: '사용자 ID', required: true },
      { name: 'title', type: 'text', label: '세션 제목', required: true },
      { name: 'category', type: 'text', label: '카테고리', required: false }
    ],
    exampleReq:  `{\n  "user_id": "API_TEST_USER_ID",\n  "title": "테스트 세션",\n  "category": "일반"\n}`,
    exampleRes:  `{\n  "session_id": "API_TEST_SESSION_ID",\n  "user_id": "API_TEST_USER_ID",\n  "title": "테스트 세션",\n  "category": "일반",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'PUT',
    path: '/api/chat/sessions/:session_id',
    title: '채팅 세션 정보 수정',
    desc: '특정 채팅 세션의 정보를 수정합니다.',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID', required: true, inPath: true },
      { name: 'title', type: 'text', label: '세션 제목', required: false },
      { name: 'category', type: 'text', label: '카테고리', required: false },
      { name: 'is_archived', type: 'checkbox', label: '보관 여부', required: false }
    ],
    exampleReq:  ` {\n  "title": "수정된 세션 제목",\n  "category": "중요",\n  "is_archived": true\n}`,
    exampleRes:  `{\n  "session_id": "API_TEST_SESSION_ID",\n  "title": "수정된 세션 제목",\n  "category": "중요",\n  "is_archived": true,\n  "updated_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/sessions/:session_id',
    title: '채팅 세션 삭제',
    desc: '특정 채팅 세션을 삭제합니다. 해당 세션의 모든 메시지도 함께 삭제됩니다. <br><span class="api-desc-note">session_id에 "API_TEST_SESSION_ID"를, 요청 본문에 "user_id": "API_TEST_USER_ID"를 입력하면 테스트 세션을 삭제할 수 있습니다.</span>',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID', required: true, inPath: true },
      { name: 'user_id', type: 'text', label: '사용자 ID (요청 본문)', required: true, inPath: false }
    ],
    exampleReq: `{\n  "user_id": "API_TEST_USER_ID"\n}`,
    exampleRes: `{\n  "message": "세션 및 관련 메시지가 성공적으로 삭제되었습니다.",\n  "deleted_session_id": "API_TEST_SESSION_ID",\n  "deleted_messages_count": 0\n}` // 메시지 카운트는 실제 삭제된 수에 따라 달라질 수 있습니다.
  },
  {
    method: 'GET',
    path: '/api/chat/sessions/:session_id/messages',
    title: '세션 메시지 목록 조회',
    desc: '특정 채팅 세션의 모든 메시지 목록을 조회합니다.',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  ` [{ "message_id": "메시지 ID", "message_content": "내용", ... }]`
  },
  /* 4. 채팅 메시지 관리 */
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/messages',
    title: '채팅 메시지 전송',
    desc: '특정 채팅 세션에 새 메시지를 전송하고 AI의 응답을 받습니다.',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID', required: true, inPath: true, default: 'API_TEST_SESSION_ID' }, // 추가된 세션 ID 파라미터
      { name: 'message', type: 'text', label: '메시지', required: true },
      { name: 'system_prompt', type: 'text', label: '시스템 프롬프트', required: false },
      { name: 'special_mode_type', type: 'text', label: '특수 모드', required: false }
    ],
    exampleReq:  `{\n  "message": "안녕! 오늘 날씨 어때?",\n  "system_prompt": "(선택) AI 행동 지시",\n  "special_mode_type": "(선택) stream/canvas 등)"\n}`,
    exampleRes:  `{\n  "user_message_id": "API_TEST_USER_MESSAGE_ID",\n  "ai_message_id": "API_TEST_AI_MESSAGE_ID",\n  "message": "안녕하세요! 무엇을 도와드릴까요?",\n  "created_at": "YYYY-MM-DDTHH:mm:ss.sssZ"\n}`
  },
  {
    method: 'PUT',
    path: '/api/chat/messages/:message_id',
    title: '메시지 수정',
    desc: '특정 메시지의 내용을 수정합니다.',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID', required: true, inPath: true },
      { name: 'content', type: 'text', label: '수정할 내용', required: true }
    ],
    exampleReq:  `{\n  "content": "수정된 메시지 내용입니다."\n}`,
    exampleRes:  `{\n  "message": "메시지가 성공적으로 수정되었습니다.",\n  "updatedMessage": { ... }\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id',
    title: '메시지 삭제',
    desc: '특정 메시지를 삭제합니다.',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  ` {\n  "message": "메시지가 성공적으로 삭제되었습니다."\n}`
  },
  {
    method: 'POST',
    path: '/api/chat/messages/:message_id/reaction',
    title: '메시지 리액션 추가',
    desc: '특정 메시지에 리액션을 추가합니다.',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID', required: true, inPath: true },
      { name: 'reaction', type: 'text', label: '리액션', required: true }
    ],
    exampleReq:  ` {\n  "reaction": "👍"\n}`,
    exampleRes:  ` {\n  "message": "리액션이 성공적으로 추가/수정되었습니다.",\n  "reaction": "👍"\n}`
  },
  {
    method: 'DELETE',
    path: '/api/chat/messages/:message_id/reaction',
    title: '메시지 리액션 제거',
    desc: '특정 메시지의 리액션을 제거합니다.',
    params: [
      { name: 'message_id', type: 'text', label: '메시지 ID', required: true, inPath: true }
    ],
    exampleReq: '',
    exampleRes:  ` {\n  "message": "리액션이 성공적으로 제거되었습니다."\n}`
  },
  /* 5. 파일 업로드 */
  {
    method: 'POST',
    path: '/api/chat/sessions/:session_id/files',
    title: '파일 업로드 (채팅)',
    desc: '특정 채팅 세션에 파일을 업로드하고, 해당 파일 정보를 메시지로 저장합니다.',
    params: [
      { name: 'session_id', type: 'text', label: '세션 ID', required: true, inPath: true },
      { name: 'file', type: 'file', label: '업로드 파일', required: true },
      { name: 'user_id', type: 'text', label: '사용자 ID', required: false }
    ],
    exampleReq: '(multipart/form-data)',
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
        resultDiv.textContent = 'Status: ' + resp.status + ' ' + resp.statusText + '\\n' + display;
      } catch (e) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'API 호출 오류: ' + e.message;
      }
    };
  }
  , 0);
}
);