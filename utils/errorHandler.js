/**
 * 공통 오류 처리 유틸리티
 */

// 오류 유형에 따른 HTTP 상태 코드 반환
function getHttpStatusByErrorCode(errorCode) {
  const statusMap = {
    // 클라이언트 오류 (400 대)
    INVALID_INPUT: 400,
    INVALID_MESSAGE: 400,
    INVALID_SESSION: 400,
    INVALID_USER: 400,
    UNIQUE_CONSTRAINT_VIOLATED: 400, // 중복 에러도 400으로 처리 (또는 409 Conflict)
    FOREIGN_KEY_VIOLATION: 400,
    NULL_VALUE_ERROR: 400,
    VALUE_TOO_LARGE: 400,
    SESSION_NOT_FOUND: 404,
    MESSAGE_NOT_FOUND: 404,
    USER_NOT_FOUND: 404,
    RESOURCE_NOT_FOUND: 404, // 일반적인 Not Found
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NO_TEAPOT_FOUND: 418, // Just for fun, if ever used

    // 서버 오류 (500 대)
    SERVER_ERROR: 500,
    DATABASE_ERROR: 500,
    DB_ERROR: 500, // DB 관련 일반 오류
    DB_BIND_ERROR: 500,
    AI_SERVICE_ERROR: 503, // 외부 서비스 문제
    AI_RESPONSE_ERROR: 503,
    MESSAGE_SAVE_FAILED: 500,
    AI_MESSAGE_SAVE_FAILED: 500,
    UNKNOWN_ERROR: 500, // 정의되지 않은 모든 에러
  };

  return statusMap[errorCode] || 500; // 기본값 500
}

// Oracle 데이터베이스 오류를 처리하여 표준 에러 객체로 변환
function handleOracleError(oraError) {
  // bcrypt 오류인지 확인
  if (oraError.message && oraError.message.includes("data and salt arguments required")) {
    const error = new Error("비밀번호 해싱 중 오류가 발생했습니다. 입력값을 확인해주세요.");
    error.code = "INVALID_INPUT";
    error.details = {
      originalMessage: oraError.message,
      type: "bcrypt_error"
    };
    return error;
  }
  
  // Node.js 일반 오류 (DB 오류가 아닌 경우)
  if (!oraError.errorNum && oraError.message) {
    const error = new Error(oraError.message);
    error.code = "APPLICATION_ERROR";
    error.details = {
      originalMessage: oraError.message,
      type: "general_error"
    };
    return error;
  }

  let code = "DATABASE_ERROR";
  let message = "데이터베이스 작업 중 오류가 발생했습니다.";

  switch (oraError.errorNum) {
    case 1:
      code = "UNIQUE_CONSTRAINT_VIOLATED";
      message = "이미 존재하는 데이터입니다. (고유 제약 조건 위반)";
      break;
    case 2291:
      code = "FOREIGN_KEY_VIOLATION";
      message = "관련된 데이터를 찾을 수 없습니다. (참조 무결성 제약 조건 위반)";
      break;
    case 1400:
      code = "NULL_VALUE_ERROR";
      message = "필수 입력값이 누락되었습니다. (NULL 값 허용 안됨)";
      break;
    case 12899:
      code = "VALUE_TOO_LARGE";
      message = "입력값이 너무 큽니다. (허용된 크기 초과)";
      break;
    // 추가적인 Oracle 에러 코드 처리 가능
  }

  // 표준 에러 객체 생성 (standardizeApiResponse가 사용할 수 있도록)
  const error = new Error(message);
  error.code = code;
  error.details = {
    oracleErrorNum: oraError.errorNum,
    oracleMessage: oraError.message,
  };
  return error;
}

// 오류 로깅 함수
function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}]`;

  if (context.requestId) {
    logMessage += ` [RequestID: ${context.requestId}]`;
  }
  if (context.userId) {
    logMessage += ` [UserID: ${context.userId}]`;
  }
  if (context.path) {
    logMessage += ` [Path: ${context.method} ${context.path}]`;
  }
  if (context.handler) {
    logMessage += ` [Handler: ${context.handler}]`;
  }

  logMessage += ` 오류 발생: ${error.message}`;

  console.error(logMessage);

  if (error.code) {
    console.error(`  Error Code: ${error.code}`);
  }
  if (error.details) {
    console.error(`  Details: ${JSON.stringify(error.details)}`);
  }
  if (error.stack) {
    console.error("  Stack Trace:", error.stack);
  }
  if (error.errorNum) {
    // Oracle 에러의 경우
    console.error(`  Oracle Error Num: ${error.errorNum}`);
    console.error(`  Oracle Error Message: ${error.message}`); // Oracle 에러 메시지는 error.message에 있음
  }
}

/**
 * 중앙 에러 핸들링 미들웨어.
 * Express 앱의 마지막에 등록하여 사용합니다.
 * @param {Error} err - 발생한 에러 객체.
 * @param {import('express').Request} req - Express 요청 객체.
 * @param {import('express').Response} res - Express 응답 객체.
 * @param {import('express').NextFunction} next - Express 다음 미들웨어 함수.
 */
function handleCentralError(err, req, res, next) {
  // 에러 로깅 (요청 ID, 사용자 ID 등 컨텍스트 정보 포함)
  const errorContext = {
    requestId: req.id, // req.id는 나중에 미들웨어로 추가 예정
    userId: req.user ? req.user.user_id : "guest",
    path: req.originalUrl,
    method: req.method,
    handler: req.route ? req.route.path : "unknown", // 어떤 라우트 핸들러에서 발생했는지
  };
  logError(err, errorContext);

  let standardizedError = err;
  if (err.errorNum) {
    // Oracle 에러인 경우, 표준 에러 객체로 변환
    standardizedError = handleOracleError(err);
  }

  // 직접 에러 응답 생성 (순환 참조 방지)
  const errorCode = standardizedError.code || "SERVER_ERROR";
  const httpStatusCode = getHttpStatusByErrorCode(errorCode);
  const responseBody = {
    status: "error",
    error: {
      code: errorCode,
      message: standardizedError.message || "알 수 없는 오류가 발생했습니다.",
      details: standardizedError.details || null,
    },
  };

  res.status(httpStatusCode).json(responseBody);
}

module.exports = {
  getHttpStatusByErrorCode,
  handleOracleError,
  logError,
  handleCentralError,
};
