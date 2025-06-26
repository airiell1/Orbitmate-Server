const { toSnakeCaseObj } = require("./dbUtils");

// getHttpStatusByErrorCode 함수를 여기서 직접 정의하여 순환 참조 방지
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

/**
 * API 응답을 표준화하는 함수.
 * 성공 시 데이터를 직접 반환하고,
 * 에러 시 { status: 'error', error: { code, message, details } } 형식으로 응답합니다.
 * HTTP 상태 코드도 함께 반환하여 res.status().json() 형태로 사용됩니다.
 *
 * @param {any} data - 성공 시 응답할 데이터.
 * @param {Error | null} error - 에러 객체 (선택 사항). 에러 객체는 code, message, details 속성을 가질 수 있습니다.
 * @returns {{statusCode: number, body: Object}} HTTP 상태 코드와 응답 본문을 포함하는 객체.
 */
function standardizeApiResponse(data, error = null) {
  if (error) {
    const errorCode = error.code || "SERVER_ERROR"; // 기본 에러 코드
    const httpStatusCode = getHttpStatusByErrorCode(errorCode);
    const responseBody = {
      status: "error",
      error: {
        code: errorCode,
        message: error.message || "알 수 없는 오류가 발생했습니다.",
        details: error.details || null,
      },
    };
    return { statusCode: httpStatusCode, body: responseBody };
  }

  // 성공 시 데이터를 직접 반환
  let statusCode = 200;
  if (data === null || data === undefined) {
    // 성공이지만 데이터가 없는 경우 (예: DELETE 성공)
    statusCode = 204; // No Content
    return { statusCode, body: null }; // 204는 본문을 포함하지 않음
  }

  // 성공 시 데이터를 snake_case로 변환하여 직접 반환
  return {
    statusCode: statusCode,
    body: toSnakeCaseObj(data),
  };
}

module.exports = {
  standardizeApiResponse,
};
