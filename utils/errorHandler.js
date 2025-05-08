/**
 * 공통 오류 처리 유틸리티
 */

// 표준화된 에러 응답 포맷 생성
function createErrorResponse(code, message, details = null) {
  const errorResponse = {
    error: {
      code: code,
      message: message
    }
  };
  
  if (details) {
    errorResponse.error.details = details;
  }
  
  return errorResponse;
}

// 오류 유형에 따른 HTTP 상태 코드 반환
function getHttpStatusByErrorCode(errorCode) {
  const statusMap = {
    // 클라이언트 오류 (400 대)
    'INVALID_INPUT': 400,
    'INVALID_MESSAGE': 400,
    'INVALID_SESSION': 400,
    'INVALID_USER': 400,
    'SESSION_NOT_FOUND': 404,
    'MESSAGE_NOT_FOUND': 404,
    'USER_NOT_FOUND': 404,
    'UNAUTHORIZED': 401,
    'FORBIDDEN': 403,
    'FOREIGN_KEY_VIOLATION': 400,
    'NO_TEAPOT_FOUND': 418,
    
    // 서버 오류 (500 대)
    'SERVER_ERROR': 500,
    'DATABASE_ERROR': 500,
    'AI_SERVICE_ERROR': 503,
    'MESSAGE_SAVE_FAILED': 500,
    'AI_MESSAGE_SAVE_FAILED': 500,
    'AI_RESPONSE_ERROR': 503
  };
  
  return statusMap[errorCode] || 500;
}

// Oracle 데이터베이스 오류를 처리하는 함수
function handleOracleError(err) {
  // Oracle 오류 코드별 처리
  switch(err.errorNum) {
    case 1:
      return createErrorResponse('UNIQUE_CONSTRAINT_VIOLATED', '고유 제약 조건 위반입니다.');
    case 2291:
      return createErrorResponse('FOREIGN_KEY_VIOLATION', '참조하려는 키가 존재하지 않습니다.');
    case 1400:
      return createErrorResponse('NULL_VALUE_ERROR', 'NULL 값이 허용되지 않는 필드에 NULL이 입력되었습니다.');
    case 12899:
      return createErrorResponse('VALUE_TOO_LARGE', '입력값이 허용된 크기를 초과합니다.');
    default:
      return createErrorResponse('DATABASE_ERROR', '데이터베이스 작업 중 오류가 발생했습니다.');
  }
}

// 오류 로깅 함수
function logError(context, error) {
  console.error(`[${context}] 오류 발생:`, error);
  
  // 추가적인 상세 로깅을 위한 확장 가능한 구조
  if (error.stack) {
    console.error(`[${context}] 스택 트레이스:`, error.stack);
  }
  
  if (error.errorNum) {
    console.error(`[${context}] Oracle 오류 코드: ${error.errorNum}`);
  }
}

module.exports = {
  createErrorResponse,
  getHttpStatusByErrorCode,
  handleOracleError,
  logError
};
