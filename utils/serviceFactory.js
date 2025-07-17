// utils/serviceFactory.js - 서비스 팩토리 유틸리티

const { withTransaction } = require("./dbUtils");
const { standardizeApiResponse } = require("./apiResponse");

/**
 * 제네릭 서비스 생성 팩토리
 * @param {Function} modelFunction - 호출할 모델 함수
 * @param {Object} options - 옵션 설정
 * @returns {Function} 서비스 함수
 */
function createService(modelFunction, options = {}) {
  const {
    useTransaction = true,
    preprocessor = null,
    postprocessor = null,
    errorHandler = null,
    cacheKey = null,
    cacheTTL = 300000 // 5분
  } = options;

  return async (...args) => {
    try {
      // 전처리
      const processedArgs = preprocessor ? await preprocessor(...args) : args;

      let result;

      if (useTransaction) {
        // 트랜잭션 사용
        result = await withTransaction(async (connection) => {
          return await modelFunction(connection, ...processedArgs);
        });
      } else {
        // 트랜잭션 없이 실행 (읽기 전용 작업 등)
        result = await modelFunction(...processedArgs);
      }

      // 후처리
      const finalResult = postprocessor ? await postprocessor(result, ...args) : result;

      return finalResult;

    } catch (error) {
      // 에러 처리
      if (errorHandler) {
        return await errorHandler(error, ...args);
      }
      throw error;
    }
  };
}

/**
 * CRUD 서비스 생성 헬퍼들
 */

// 조회 서비스 (읽기 전용)
function createReadService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: false, // 읽기는 트랜잭션 불필요
    ...options
  });
}

// 생성 서비스
function createCreateService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    postprocessor: (result) => {
      // 생성 후 성공 메시지 추가
      return {
        ...result,
        created_at: new Date().toISOString()
      };
    },
    ...options
  });
}

// 업데이트 서비스
function createUpdateService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    postprocessor: (result) => {
      // 업데이트 후 성공 메시지 추가
      return {
        ...result,
        updated_at: new Date().toISOString()
      };
    },
    ...options
  });
}

// 삭제 서비스
function createDeleteService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    postprocessor: (result) => {
      return {
        success: true,
        message: "Resource deleted successfully",
        deleted_at: new Date().toISOString(),
        ...result
      };
    },
    ...options
  });
}

/**
 * 사용자 관련 서비스 헬퍼들
 */

// 사용자 ID 기반 서비스
function createUserService(modelFunction, options = {}) {
  return createService(modelFunction, {
    preprocessor: (userId, ...otherArgs) => {
      // 사용자 ID 유효성 기본 체크
      if (!userId) {
        throw new Error("User ID is required");
      }
      return [userId, ...otherArgs];
    },
    ...options
  });
}

// 사용자 설정 관련 서비스
function createUserSettingsService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: (result, userId) => {
      return {
        user_id: userId,
        ...result
      };
    },
    ...options
  });
}

// 사용자 프로필 관련 서비스
function createUserProfileService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: (result, userId) => {
      // 민감한 정보 제거
      const { password_hash, ...safeResult } = result || {};
      return {
        user_id: userId,
        ...safeResult
      };
    },
    ...options
  });
}

/**
 * 뱃지/경험치 관련 서비스 헬퍼들
 */

// 경험치 관련 서비스
function createExperienceService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: async (result, userId, points, expType) => {
      // 경험치 추가 후 레벨업 체크 등 부가 작업
      return {
        ...result,
        experience_gained: points,
        experience_type: expType
      };
    },
    ...options
  });
}

// 뱃지 관련 서비스
function createBadgeService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: (result, userId) => {
      return {
        user_id: userId,
        badge_info: result,
        timestamp: new Date().toISOString()
      };
    },
    ...options
  });
}

/**
 * 채팅 관련 서비스 헬퍼들
 */

// 메시지 서비스
function createMessageService(modelFunction, options = {}) {
  return createService(modelFunction, {
    preprocessor: (sessionId, userId, ...otherArgs) => {
      if (!sessionId || !userId) {
        throw new Error("Session ID and User ID are required");
      }
      return [sessionId, userId, ...otherArgs];
    },
    ...options
  });
}

// 세션 서비스
function createSessionService(modelFunction, options = {}) {
  return createUserService(modelFunction, options);
}

/**
 * 구독 관련 서비스 헬퍼들
 */

// 구독 서비스
function createSubscriptionService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: (result, userId) => {
      return {
        user_id: userId,
        subscription_info: result,
        checked_at: new Date().toISOString()
      };
    },
    ...options
  });
}

/**
 * 캐시 지원 서비스
 */
const serviceCache = new Map();

function createCachedService(modelFunction, cacheKey, cacheTTL = 300000, options = {}) {
  return createService(modelFunction, {
    ...options,
    preprocessor: async (...args) => {
      const key = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;
      const cached = serviceCache.get(key);
      
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        throw { isCacheHit: true, data: cached.data };
      }
      
      return options.preprocessor ? await options.preprocessor(...args) : args;
    },
    postprocessor: async (result, ...args) => {
      const key = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;
      serviceCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      return options.postprocessor ? await options.postprocessor(result, ...args) : result;
    },
    errorHandler: async (error, ...args) => {
      if (error.isCacheHit) {
        return error.data;
      }
      
      if (options.errorHandler) {
        return await options.errorHandler(error, ...args);
      }
      
      throw error;
    }
  });
}

/**
 * 스트리밍 관련 서비스 헬퍼들
 */

// 스트리밍 서비스 (SSE 등)
function createStreamService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    preprocessor: (sessionId, userId, messageData, clientIp, streamCallback, ...otherArgs) => {
      // 스트리밍 유효성 검사
      if (!sessionId || !userId) {
        throw new Error("Session ID and User ID are required for streaming");
      }
      if (!streamCallback || typeof streamCallback !== 'function') {
        throw new Error("Stream callback function is required");
      }
      if (!messageData || !messageData.message) {
        throw new Error("Message data is required");
      }
      return [sessionId, userId, messageData, clientIp, streamCallback, ...otherArgs];
    },
    postprocessor: (result, sessionId, userId) => {
      return {
        session_id: sessionId,
        user_id: userId,
        streaming_completed: true,
        ...result
      };
    },
    ...options
  });
}

// 파일 업로드 서비스
function createFileUploadService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    preprocessor: (sessionId, userId, file, messageContent, ...otherArgs) => {
      // 파일 유효성 검사
      const allowedMimeTypes = options.allowedMimeTypes || ["image/jpeg", "image/png", "application/pdf"];
      const maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB
      
      if (!sessionId || !userId) {
        throw new Error("Session ID and User ID are required");
      }
      if (!file) {
        throw new Error("File is required");
      }
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type. Allowed: ${allowedMimeTypes.join(", ")}`);
      }
      if (file.size > maxFileSize) {
        throw new Error(`File too large. Max: ${maxFileSize / (1024 * 1024)}MB`);
      }
      
      return [sessionId, userId, file, messageContent, ...otherArgs];
    },
    errorHandler: async (error, sessionId, userId, file) => {
      // 에러 시 업로드된 파일 삭제
      if (file && file.path) {
        try {
          const fs = require('fs');
          fs.unlinkSync(file.path);
        } catch(unlinkErr) {
          console.error('Failed to cleanup uploaded file:', unlinkErr);
        }
      }
      throw error;
    },
    ...options
  });
}

/**
 * 외부 API 관련 서비스 헬퍼들
 */

// 외부 API 서비스 (검색, 번역 등)
function createExternalApiService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: false, // 외부 API는 트랜잭션 불필요
    preprocessor: async (...args) => {
      // API 키 확인, 요청 제한 체크 등
      if (options.requireApiKey && !process.env[options.apiKeyEnvVar]) {
        throw new Error(`API key is required: ${options.apiKeyEnvVar}`);
      }
      return args;
    },
    postprocessor: (result, ...args) => {
      // 외부 API 응답 형식 표준화
      return {
        source: options.apiName || 'external',
        requested_at: new Date().toISOString(),
        data: result
      };
    },
    errorHandler: async (error, ...args) => {
      // 외부 API 에러 처리
      if (error.response) {
        throw new Error(`External API Error (${options.apiName}): ${error.response.status} - ${error.response.statusText}`);
      }
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error(`Network error connecting to ${options.apiName || 'external API'}`);
      }
      throw error;
    },
    ...options
  });
}

// 검색 서비스 (위키피디아, 네이버 등)
function createSearchService(modelFunction, options = {}) {
  return createExternalApiService(modelFunction, {
    ...options,
    postprocessor: (result, query, ...args) => {
      return {
        query: query,
        search_engine: options.searchEngine || 'unknown',
        results_count: Array.isArray(result) ? result.length : (result.results?.length || 0),
        searched_at: new Date().toISOString(),
        data: result
      };
    }
  });
}

/**
 * 활동 관련 서비스 헬퍼들  
 */

// 사용자 활동 서비스 (버그 제보, 피드백 등)
function createActivityService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: (result, userId, activityType) => {
      return {
        user_id: userId,
        activity_type: activityType,
        activity_result: result,
        recorded_at: new Date().toISOString()
      };
    },
    ...options
  });
}

// =========================
// 🎮 컨트롤러 팩토리 (Controller Factory)
// =========================

/**
 * 제네릭 컨트롤러 생성 팩토리
 * @param {Function} serviceFunction - 호출할 서비스 함수
 * @param {Object} options - 옵션 설정
 * @returns {Function} Express 컨트롤러 함수
 */
function createController(serviceOrModelFunction, options = {}) {
  const {
    validations = [],
    dataExtractor = (req) => {
      const { user_id } = req.params;
      const bodyData = req.body;
      return [user_id, bodyData];
    },
    responseTransformer = (result) => result,
    successMessage = null,
    successStatusCode = 200,
    errorHandler = null,
    errorContext = 'operation',
    isModelFunction = null // null이면 자동 감지
  } = options;

  return async (req, res, next) => {
    try {
      // 1. 유효성 검사 실행
      for (const validation of validations) {
        validation(req); // 에러가 있으면 throw됨
      }

      // 2. 요청에서 데이터 추출
      const extractedData = dataExtractor(req);

      // 3. 함수 타입 자동 감지 (isModelFunction이 null인 경우)
      let isModel = isModelFunction;
      if (isModel === null) {
        // 함수 이름이나 파라미터로 모델 함수인지 추측
        const functionString = serviceOrModelFunction.toString();
        const parameterNames = functionString.match(/^(?:async\s+)?function[^(]*\(([^)]*)\)/)?.[1]?.split(',').map(p => p.trim()) || [];
        
        // 첫 번째 파라미터가 'connection'이거나 'conn'이면 모델 함수로 추정
        isModel = parameterNames.length > 0 && (parameterNames[0] === 'connection' || parameterNames[0] === 'conn');
      }

      // 4. 함수 호출
      let result;
      if (isModel) {
        // 모델 함수인 경우 withTransaction으로 감싸서 connection을 첫 번째 인자로 전달
        result = await withTransaction(async (connection) => {
          return await serviceOrModelFunction(connection, ...extractedData);
        });
      } else {
        // 서비스 함수인 경우 그대로 호출 (서비스 계층에서 트랜잭션 처리)
        result = await serviceOrModelFunction(...extractedData);
      }

      // 4. 응답 변환
      const transformedResult = responseTransformer(result, req);

      // 5. 성공 메시지 추가 (옵션)
      const finalResult = successMessage 
        ? { ...transformedResult, message: successMessage }
        : transformedResult;

      // 6. 표준화된 응답 반환
      const apiResponse = standardizeApiResponse(finalResult);
      res.status(successStatusCode).json(apiResponse.body);

    } catch (error) {
      // 커스텀 에러 처리
      if (errorHandler) {
        try {
          await errorHandler(error, req, res, next);
          return;
        } catch (handlerError) {
          error = handlerError;
        }
      }
      
      // 에러 컨텍스트 추가
      if (!error.context) {
        error.context = errorContext;
      }
      next(error);
    }
  };
}

/**
 * 구독 관리 컨트롤러 생성 헬퍼
 */
function createSubscriptionController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { tier_name, feature_name, ...restBody } = req.body;
      const { feature_name: paramFeature } = req.params;
      
      // 파라미터에서 feature_name이 있으면 사용, 없으면 body에서 사용
      const finalFeatureName = paramFeature || feature_name;
      
      return [user_id, tier_name || finalFeatureName, restBody];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'subscription',
    ...options
  });
}

/**
 * 외부 API 컨트롤러 생성 헬퍼
 */
function createExternalApiController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    validations: [],
    dataExtractor: (req) => {
      const { query, lang, limit } = req.query;
      const { feature_name } = req.params;
      return [query || feature_name, { lang, limit: parseInt(limit) || 10 }];
    },
    errorHandler: async (error, req, res, next) => {
      // 외부 API 에러 특별 처리
      if (error.response) {
        const customError = new Error(`External API Error: ${error.response.status}`);
        customError.code = "EXTERNAL_API_ERROR";
        throw customError;
      }
      throw error;
    },
    errorContext: 'external_api',
    ...options
  });
}

/**
 * 읽기 전용 컨트롤러 생성 헬퍼
 */
function createReadController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    dataExtractor: (req) => {
      const { user_id, lang, category } = req.params;
      const { category: queryCategory } = req.query;
      return [user_id || lang, queryCategory || category];
    },
    errorContext: 'read',
    ...options
  });
}

/**
 * 생성 컨트롤러 헬퍼
 */
function createCreateController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    successStatusCode: 201,
    successMessage: "Resource created successfully",
    errorContext: 'create',
    ...options
  });
}

/**
 * 업데이트 컨트롤러 헬퍼
 */
function createUpdateController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    successMessage: "Resource updated successfully",
    errorContext: 'update',
    ...options
  });
}

/**
 * 삭제 컨트롤러 헬퍼
 */
function createDeleteController(serviceFunction, options = {}) {
  return createController(serviceFunction, {
    dataExtractor: (req) => {
      const { user_id, session_id } = req.params;
      const { user_id: bodyUserId } = req.body;
      return [session_id || user_id, bodyUserId || user_id];
    },
    successMessage: "Resource deleted successfully",
    errorContext: 'delete',
    ...options
  });
}

/**
 * 스트리밍 컨트롤러 생성 (SSE/WebSocket 지원)
 */
function createStreamController(serviceFunction, options = {}) {
  const {
    dataExtractor,
    validations = [],
    responseTransformer,
    errorHandler,
    errorContext = 'stream_operation',
    streamType = 'sse', // 'sse' 또는 'websocket'
    streamHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  } = options;

  return async (req, res, next) => {
    try {
      // 유효성 검사 실행
      for (const validation of validations) {
        await validation(req);
      }

      // 스트리밍 헤더 설정
      if (streamType === 'sse') {
        Object.entries(streamHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.flushHeaders();
      }

      // 데이터 추출
      const serviceArgs = dataExtractor ? dataExtractor(req) : [req.body];

      // 스트림 콜백 함수 생성
      const streamCallback = (chunk) => {
        if (streamType === 'sse') {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        } else {
          res.write(JSON.stringify(chunk));
        }
      };

      // 서비스 실행 (스트림 콜백 포함)
      const result = await serviceFunction(...serviceArgs, streamCallback);

      // 스트림 종료
      if (streamType === 'sse') {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      
      // 최종 응답 전송
      if (responseTransformer) {
        const transformedResult = responseTransformer(result, req);
        if (streamType === 'sse') {
          // SSE 스트리밍에서도 표준 응답 형식 사용
          const apiResponse = standardizeApiResponse(transformedResult);
          res.write(`data: ${JSON.stringify(apiResponse.body)}\n\n`);
        } else {
          const apiResponse = standardizeApiResponse(transformedResult);
          res.json(apiResponse.body);
        }
      } else {
        // responseTransformer가 없을 때도 표준 응답 형식 사용
        if (streamType === 'sse') {
          const apiResponse = standardizeApiResponse(result);
          res.write(`data: ${JSON.stringify(apiResponse.body)}\n\n`);
        } else {
          const apiResponse = standardizeApiResponse(result);
          res.json(apiResponse.body);
        }
      }

      res.end();

    } catch (error) {
      console.error('[ServiceFactory] createStreamController 에러:', error);
      
      // 스트리밍 중에 에러가 발생한 경우
      if (res.headersSent) {
        // 이미 헤더가 전송된 경우, SSE로 에러 메시지 전송 후 종료
        try {
          if (streamType === 'sse') {
            const errorResponse = standardizeApiResponse(null, {
              code: error.code || 'SERVER_ERROR',
              message: error.message || '서버 오류가 발생했습니다.',
              details: error.details || null
            });
            res.write(`data: ${JSON.stringify(errorResponse.body)}\n\n`);
          }
          res.end();
        } catch (endError) {
          console.error('[ServiceFactory] 스트리밍 에러 응답 전송 실패:', endError);
        }
      } else {
        // 헤더가 아직 전송되지 않은 경우, 일반적인 에러 처리
        if (errorHandler) {
          await errorHandler(error, req, res, next);
        } else {
          error.context = errorContext;
          next(error);
        }
      }
    }
  };
}

/**
 * 파일 업로드 컨트롤러 생성 (Multer 통합)
 */
function createFileUploadController(serviceFunction, options = {}) {
  const {
    dataExtractor,
    validations = [],
    fileValidations = [],
    responseTransformer,
    errorHandler,
    errorContext = 'file_upload',
    fileFieldName = 'file',
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedMimeTypes = [],
    cleanupOnError = true
  } = options;

  return async (req, res, next) => {
    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    
    try {
      // 기본 유효성 검사
      for (const validation of validations) {
        await validation(req);
      }

      // 파일 유효성 검사
      for (const file of uploadedFiles) {
        // 파일 크기 검사
        if (file.size > maxFileSize) {
          const err = new Error(`파일 크기가 너무 큽니다. 최대 ${maxFileSize / (1024 * 1024)}MB까지 허용됩니다.`);
          err.code = "FILE_TOO_LARGE";
          throw err;
        }

        // MIME 타입 검사
        if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
          const err = new Error(`허용되지 않는 파일 타입입니다. 허용되는 타입: ${allowedMimeTypes.join(', ')}`);
          err.code = "INVALID_FILE_TYPE";
          throw err;
        }

        // 추가 파일 유효성 검사
        for (const fileValidation of fileValidations) {
          await fileValidation(file, req);
        }
      }

      // 데이터 추출 (파일 정보 포함)
      const serviceArgs = dataExtractor ? dataExtractor(req) : [req.body, uploadedFiles];

      // 서비스 실행
      const result = await serviceFunction(...serviceArgs);

      // 응답 변환
      const finalResult = responseTransformer ? responseTransformer(result, req) : result;
      const apiResponse = standardizeApiResponse(finalResult);
      
      res.status(apiResponse.statusCode).json(apiResponse.body);

    } catch (error) {
      // 에러 시 업로드된 파일 정리
      if (cleanupOnError) {
        for (const file of uploadedFiles) {
          if (file.path) {
            try {
              const fs = require('fs');
              fs.unlinkSync(file.path);
            } catch (cleanupError) {
              console.warn('파일 정리 실패:', cleanupError.message);
            }
          }
        }
      }

      if (errorHandler) {
        await errorHandler(error, req, res, next);
      } else {
        error.context = errorContext;
        next(error);
      }
    }
  };
}

module.exports = {
  // 기본 팩토리
  createService,
  
  // CRUD 헬퍼들
  createReadService,
  createCreateService,
  createUpdateService,
  createDeleteService,
  
  // 도메인별 헬퍼들
  createUserService,
  createUserSettingsService,
  createUserProfileService,
  createExperienceService,
  createBadgeService,
  createMessageService,
  createSessionService,
  createSubscriptionService,
  
  // 스트리밍 & 파일 관련 헬퍼들
  createStreamService,
  createFileUploadService,
  
  // 외부 API 관련 헬퍼들
  createExternalApiService,
  createSearchService,
  
  // 활동 관련 헬퍼들
  createActivityService,
  
  // 컨트롤러 팩토리들
  createController,
  createSubscriptionController,
  createExternalApiController,
  createReadController,
  createCreateController,
  createUpdateController,
  createDeleteController,
  createStreamController,
  createFileUploadController,
  
  // 고급 기능
  createCachedService,
};
