// utils/controllerFactory.js - 컨트롤러 팩토리 유틸리티

const { standardizeApiResponse } = require("./apiResponse");

/**
 * 제네릭 컨트롤러 생성 팩토리
 * @param {Function} serviceFunction - 호출할 서비스 함수
 * @param {Object} options - 옵션 설정
 * @param {Function[]} options.validations - 유효성 검사 함수들
 * @param {Function} options.dataExtractor - req에서 데이터 추출 함수
 * @param {Function} options.responseTransformer - 응답 변환 함수
 * @returns {Function} Express 컨트롤러 함수
 */
function createController(serviceFunction, options = {}) {
  const {
    validations = [],
    dataExtractor = defaultDataExtractor,
    responseTransformer = defaultResponseTransformer,
    successMessage = null,
    errorContext = 'operation'
  } = options;

  return async (req, res, next) => {
    try {
      // 1. 유효성 검사 실행
      for (const validation of validations) {
        const error = validation(req);
        if (error) {
          return next(error);
        }
      }

      // 2. 요청에서 데이터 추출
      const extractedData = dataExtractor(req);

      // 3. 서비스 함수 호출
      const result = await serviceFunction(...extractedData);

      // 4. 응답 변환
      const transformedResult = responseTransformer(result, req);

      // 5. 성공 메시지 추가 (옵션)
      const finalResult = successMessage 
        ? { ...transformedResult, message: successMessage }
        : transformedResult;

      // 6. 표준화된 응답 반환
      const apiResponse = standardizeApiResponse(finalResult);
      res.status(apiResponse.statusCode).json(apiResponse.body);

    } catch (error) {
      // 에러 컨텍스트 추가
      if (!error.context) {
        error.context = errorContext;
      }
      next(error);
    }
  };
}

/**
 * 기본 데이터 추출기 - user_id와 body 데이터 추출
 */
function defaultDataExtractor(req) {
  const { user_id } = req.params;
  const bodyData = req.body;
  return [user_id, bodyData];
}

/**
 * 단순 데이터 추출기 - user_id만 추출
 */
function userIdOnlyExtractor(req) {
  const { user_id } = req.params;
  return [user_id];
}

/**
 * 파라미터 우선 데이터 추출기 - params를 우선으로 추출
 */
function paramsFirstExtractor(req) {
  return [req.params, req.body, req.query];
}

/**
 * 바디 우선 데이터 추출기 - body 데이터를 우선으로 추출
 */
function bodyFirstExtractor(req) {
  return [req.body, req.params, req.query];
}

/**
 * 기본 응답 변환기 - 그대로 반환
 */
function defaultResponseTransformer(result, req) {
  return result;
}

/**
 * 사용자 정보 마스킹 변환기 - 민감한 정보 제거
 */
function maskSensitiveDataTransformer(result, req) {
  if (result && typeof result === 'object') {
    const { password_hash, ...safeResult } = result;
    return safeResult;
  }
  return result;
}

/**
 * 페이지네이션 응답 변환기
 */
function paginationResponseTransformer(result, req) {
  const { page = 1, limit = 10 } = req.query;
  
  if (Array.isArray(result)) {
    return {
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.length
      }
    };
  }
  
  return result;
}

/**
 * CRUD 컨트롤러 생성 헬퍼들
 */

// 조회 컨트롤러 (GET)
function createGetController(serviceFunction, validations = []) {
  return createController(serviceFunction, {
    validations,
    dataExtractor: userIdOnlyExtractor,
    errorContext: 'fetch'
  });
}

// 생성 컨트롤러 (POST)
function createPostController(serviceFunction, validations = []) {
  return createController(serviceFunction, {
    validations,
    dataExtractor: defaultDataExtractor,
    successMessage: "Resource created successfully",
    errorContext: 'create'
  });
}

// 업데이트 컨트롤러 (PUT)
function createPutController(serviceFunction, validations = []) {
  return createController(serviceFunction, {
    validations,
    dataExtractor: defaultDataExtractor,
    successMessage: "Resource updated successfully",
    errorContext: 'update'
  });
}

// 삭제 컨트롤러 (DELETE)
function createDeleteController(serviceFunction, validations = []) {
  return createController(serviceFunction, {
    validations,
    dataExtractor: userIdOnlyExtractor,
    successMessage: "Resource deleted successfully",
    errorContext: 'delete'
  });
}

/**
 * 배치 작업용 컨트롤러 생성
 */
function createBatchController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    ...options,
    dataExtractor: (req) => [req.body.items || []],
    responseTransformer: (result, req) => ({
      processed: result.length,
      results: result
    })
  });
}

/**
 * 파일 업로드 컨트롤러 생성
 */
function createUploadController(serviceFunction, validations = []) {
  return createController(serviceFunction, {
    validations,
    dataExtractor: (req) => [req.params.user_id, req.file],
    successMessage: "File uploaded successfully",
    errorContext: 'upload'
  });
}

module.exports = {
  createController,
  
  // 데이터 추출기들
  defaultDataExtractor,
  userIdOnlyExtractor,
  paramsFirstExtractor,
  bodyFirstExtractor,
  
  // 응답 변환기들
  defaultResponseTransformer,
  maskSensitiveDataTransformer,
  paginationResponseTransformer,
  
  // CRUD 헬퍼들
  createGetController,
  createPostController,
  createPutController,
  createDeleteController,
  
  // 특수 컨트롤러들
  createBatchController,
  createUploadController,
};
