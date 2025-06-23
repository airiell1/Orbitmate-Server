const { toSnakeCaseObj } = require("./dbUtils");

/**
 * API 응답을 표준화하는 함수 (원래 방식)
 * @param {Object} data - API 응답 데이터
 * @returns {Object} snake_case로 변환된 응답 데이터
 */
function standardizeApiResponse(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data.map((item) => toSnakeCaseObj(item));
  }
  return toSnakeCaseObj(data);
}

/**
 * 검색 API 전용 응답 함수 - 성공시 데이터, 실패시 에러 메시지
 * @param {boolean} success - 성공 여부
 * @param {Object} data - API 응답 데이터
 * @param {string} message - 응답 메시지
 * @param {string} errorCode - 에러 코드 (선택)
 * @returns {Object} 검색 API 응답
 */
function createSearchApiResponse(
  success,
  data = null,
  message = "",
  errorCode = null
) {
  if (success && data) {
    // 성공시: 데이터만 반환 (snake_case 변환)
    return Array.isArray(data)
      ? data.map((item) => toSnakeCaseObj(item))
      : toSnakeCaseObj(data);
  } else {
    // 실패시: 에러 메시지 반환
    const errorResponse = { message };
    if (errorCode) {
      errorResponse.error_code = errorCode;
    }
    return errorResponse;
  }
}

module.exports = {
  standardizeApiResponse,
  createSearchApiResponse,
};
