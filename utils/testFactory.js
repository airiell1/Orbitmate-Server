// utils/testFactory.js - 테스트 팩토리 유틸리티

/**
 * 제네릭 API 테스트 함수 생성 팩토리
 * @param {Object} options - 테스트 설정 옵션
 * @returns {Function} 테스트 함수
 */
function createApiTest(options = {}) {
  const {
    method = 'GET',
    baseUrl = '/api',
    endpoint,
    headers = {},
    defaultData = {},
    responseProcessor = null,
    errorHandler = null,
    successMessage = null,
    showResponse = true
  } = options;

  if (!endpoint) {
    throw new Error("endpoint is required for createApiTest");
  }

  return async (additionalData = {}, customOptions = {}) => {
    try {
      const mergedData = { ...defaultData, ...additionalData };
      const mergedOptions = { ...options, ...customOptions };
      
      // URL 생성 (path parameters 처리)
      let url = baseUrl + endpoint;
      if (mergedOptions.pathParams) {
        Object.entries(mergedOptions.pathParams).forEach(([key, value]) => {
          url = url.replace(`:${key}`, encodeURIComponent(value));
        });
      }

      // 요청 설정
      const requestOptions = {
        method: mergedOptions.method || method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...mergedOptions.headers
        }
      };

      // 데이터 추가 (GET 요청이 아닌 경우)
      if (requestOptions.method !== 'GET' && Object.keys(mergedData).length > 0) {
        requestOptions.body = JSON.stringify(mergedData);
      }

      // Query parameters 처리 (GET 요청)
      if (requestOptions.method === 'GET' && Object.keys(mergedData).length > 0) {
        const queryString = new URLSearchParams(mergedData).toString();
        url += (url.includes('?') ? '&' : '?') + queryString;
      }

      console.log(`🔍 Testing ${requestOptions.method} ${url}`);
      
      // API 호출
      const response = await fetch(url, requestOptions);
      const data = await response.json();

      // 응답 처리
      if (response.ok) {
        const processedData = responseProcessor ? responseProcessor(data) : data;
        
        const message = successMessage || `✅ ${requestOptions.method} ${endpoint} successful`;
        console.log(message);
        
        if (showResponse) {
          console.log('Response:', processedData);
        }
        
        return { success: true, data: processedData, response };
      } else {
        throw new Error(`HTTP ${response.status}: ${data.message || 'Request failed'}`);
      }

    } catch (error) {
      console.error(`❌ ${method} ${endpoint} failed:`, error.message);
      
      if (errorHandler) {
        return errorHandler(error, additionalData, customOptions);
      }
      
      return { success: false, error: error.message };
    }
  };
}

/**
 * CRUD 테스트 함수들 생성
 */

// GET 요청 테스트 생성
function createGetTest(endpoint, options = {}) {
  return createApiTest({
    method: 'GET',
    endpoint,
    successMessage: `✅ GET ${endpoint} successful`,
    ...options
  });
}

// POST 요청 테스트 생성
function createPostTest(endpoint, defaultData = {}, options = {}) {
  return createApiTest({
    method: 'POST',
    endpoint,
    defaultData,
    successMessage: `✅ POST ${endpoint} successful`,
    ...options
  });
}

// PUT 요청 테스트 생성
function createPutTest(endpoint, defaultData = {}, options = {}) {
  return createApiTest({
    method: 'PUT',
    endpoint,
    defaultData,
    successMessage: `✅ PUT ${endpoint} successful`,
    ...options
  });
}

// DELETE 요청 테스트 생성
function createDeleteTest(endpoint, options = {}) {
  return createApiTest({
    method: 'DELETE',
    endpoint,
    successMessage: `✅ DELETE ${endpoint} successful`,
    ...options
  });
}

/**
 * 사용자 관련 테스트 팩토리들
 */

// 사용자 인증 테스트
function createAuthTest(endpoint, credentials = {}) {
  return createPostTest(endpoint, credentials, {
    responseProcessor: (data) => {
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        console.log('🔐 Auth token saved to localStorage');
      }
      return data;
    },
    successMessage: `✅ Authentication successful`
  });
}

// 인증이 필요한 테스트
function createAuthenticatedTest(endpoint, options = {}) {
  return createApiTest({
    endpoint,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
    },
    errorHandler: (error) => {
      if (error.message.includes('401') || error.message.includes('403')) {
        console.warn('⚠️ Authentication required. Please login first.');
      }
      return { success: false, error: error.message };
    },
    ...options
  });
}

// 사용자 ID 기반 테스트
function createUserTest(endpoint, userId = 'guest', options = {}) {
  const processedEndpoint = endpoint.replace(':user_id', userId);
  return createAuthenticatedTest(processedEndpoint, {
    pathParams: { user_id: userId },
    ...options
  });
}

/**
 * 채팅 관련 테스트 팩토리들
 */

// 세션 기반 테스트
function createSessionTest(endpoint, sessionId = '1', options = {}) {
  const processedEndpoint = endpoint.replace(':session_id', sessionId);
  return createAuthenticatedTest(processedEndpoint, {
    pathParams: { session_id: sessionId },
    ...options
  });
}

// 메시지 기반 테스트
function createMessageTest(endpoint, messageId = '1', options = {}) {
  const processedEndpoint = endpoint.replace(':message_id', messageId);
  return createAuthenticatedTest(processedEndpoint, {
    pathParams: { message_id: messageId },
    ...options
  });
}

/**
 * 배치 테스트 실행기
 */

// 여러 테스트를 순차 실행
async function runTestSequence(tests, delayMs = 1000) {
  const results = [];
  
  console.log(`🚀 Running ${tests.length} tests sequentially...`);
  
  for (let i = 0; i < tests.length; i++) {
    const { name, test, data, options } = tests[i];
    
    console.log(`\n--- Test ${i + 1}/${tests.length}: ${name} ---`);
    
    try {
      const result = await test(data, options);
      results.push({ name, success: result.success, result });
      
      // 다음 테스트 전 대기
      if (i < tests.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Test ${name} failed:`, error);
      results.push({ name, success: false, error: error.message });
    }
  }
  
  // 결과 요약
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`\n📊 Test Results: ${successful} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  return results;
}

// 병렬 테스트 실행
async function runTestsInParallel(tests) {
  console.log(`🚀 Running ${tests.length} tests in parallel...`);
  
  const promises = tests.map(async ({ name, test, data, options }) => {
    try {
      const result = await test(data, options);
      return { name, success: result.success, result };
    } catch (error) {
      return { name, success: false, error: error.message };
    }
  });
  
  const results = await Promise.all(promises);
  
  // 결과 요약
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`\n📊 Test Results: ${successful} passed, ${failed} failed`);
  
  return results;
}

/**
 * 공통 테스트 데이터 생성기
 */

// 랜덤 테스트 사용자 데이터
function generateTestUser() {
  const timestamp = Date.now();
  return {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'password123'
  };
}

// 랜덤 테스트 세션 데이터
function generateTestSession(userId = 'guest') {
  return {
    title: `Test Session ${Date.now()}`,
    category: 'general',
    user_id: userId
  };
}

// 랜덤 테스트 메시지 데이터
function generateTestMessage(sessionId = '1', userId = 'guest') {
  return {
    session_id: sessionId,
    user_id: userId,
    message: `Test message ${Date.now()}`,
    sender: 'user'
  };
}

/**
 * 응답 검증 헬퍼들
 */

// 기본 응답 구조 검증
function validateBasicResponse(data, requiredFields = []) {
  const errors = [];
  
  if (typeof data !== 'object') {
    errors.push('Response should be an object');
    return errors;
  }
  
  requiredFields.forEach(field => {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  return errors;
}

// 사용자 응답 검증
function validateUserResponse(data) {
  return validateBasicResponse(data, ['user_id', 'username', 'email']);
}

// 세션 응답 검증
function validateSessionResponse(data) {
  return validateBasicResponse(data, ['session_id', 'user_id', 'title']);
}

// 메시지 응답 검증
function validateMessageResponse(data) {
  return validateBasicResponse(data, ['message_id', 'session_id', 'sender', 'message_text']);
}

module.exports = {
  // 기본 팩토리들
  createApiTest,
  createGetTest,
  createPostTest,
  createPutTest,
  createDeleteTest,
  
  // 특화된 팩토리들
  createAuthTest,
  createAuthenticatedTest,
  createUserTest,
  createSessionTest,
  createMessageTest,
  
  // 실행기들
  runTestSequence,
  runTestsInParallel,
  
  // 데이터 생성기들
  generateTestUser,
  generateTestSession,
  generateTestMessage,
  
  // 검증 헬퍼들
  validateBasicResponse,
  validateUserResponse,
  validateSessionResponse,
  validateMessageResponse,
};
