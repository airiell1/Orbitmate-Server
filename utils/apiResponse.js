const toSnakeCaseObj = require('./toSnakeCase');

/**
 * API 응답을 표준화하는 함수
 * @param {Object} data - API 응답 데이터
 * @returns {Object} snake_case로 변환된 응답 데이터
 */
function standardizeApiResponse(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCaseObj(item));
  }
  return toSnakeCaseObj(data);
}

module.exports = { standardizeApiResponse };