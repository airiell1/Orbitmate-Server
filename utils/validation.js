// utils/validation.js - 공통 유효성 검사 유틸리티

/**
 * 공통 유효성 검사 규칙들
 */

// 사용자 ID 필수 체크
function validateUserId(req) {
  const { user_id } = req.params;
  if (!user_id) {
    const error = new Error("User ID is required.");
    error.code = "INVALID_INPUT";
    return error;
  }
  return null;
}

// 이메일 형식 체크
function validateEmail(email) {
  if (!email) {
    const error = new Error("Email is required.");
    error.code = "INVALID_INPUT";
    return error;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const error = new Error("Invalid email format.");
    error.code = "INVALID_INPUT";
    return error;
  }
  
  return null;
}

// 문자열 길이 체크
function validateStringLength(value, fieldName, min = 1, max = 500) {
  if (!value || typeof value !== 'string') {
    const error = new Error(`${fieldName} is required and must be a string.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
  
  if (value.length < min) {
    const error = new Error(`${fieldName} must be at least ${min} characters long.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
  
  if (value.length > max) {
    const error = new Error(`${fieldName} cannot exceed ${max} characters.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
}

// 필수 필드 체크 (여러 필드)
function validateRequiredFields(data, requiredFields) {
  for (const field of requiredFields) {
    if (!data[field]) {
      const error = new Error(`${field} is required.`);
      error.code = "INVALID_INPUT";
      throw error;
    }
  }
}

// 타입 체크
function validateType(value, expectedType, fieldName) {
  if (typeof value !== expectedType) {
    const error = new Error(`${fieldName} must be of type ${expectedType}.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  return null;
}

// 배열 체크
function validateArray(value, fieldName, minLength = 0, maxLength = null) {
  if (!Array.isArray(value)) {
    const error = new Error(`${fieldName} must be an array.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  if (value.length < minLength) {
    const error = new Error(`${fieldName} must have at least ${minLength} items.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  if (maxLength && value.length > maxLength) {
    const error = new Error(`${fieldName} cannot have more than ${maxLength} items.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  return null;
}

// 숫자 범위 체크
function validateNumberRange(value, fieldName, min = null, max = null) {
  if (typeof value !== 'number' || isNaN(value)) {
    const error = new Error(`${fieldName} must be a valid number.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  if (min !== null && value < min) {
    const error = new Error(`${fieldName} must be at least ${min}.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  if (max !== null && value > max) {
    const error = new Error(`${fieldName} cannot exceed ${max}.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  return null;
}

// 열거형 값 체크
function validateEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    const error = new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  return null;
}

// 복합 유효성 검사 실행기
function runValidations(validations) {
  for (const validation of validations) {
    const error = validation();
    if (error) {
      return error;
    }
  }
  return null;
}

// 세션 ID 유효성 검사
function validateSessionId(sessionIdOrReq, fieldName = 'Session ID') {
  let sessionId;
  
  // req 객체인지 확인하고 params에서 추출
  if (sessionIdOrReq && typeof sessionIdOrReq === 'object' && sessionIdOrReq.params) {
    sessionId = sessionIdOrReq.params.session_id;
  } else {
    sessionId = sessionIdOrReq;
  }
  
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '' || sessionId === 'undefined' || sessionId === 'null') {
    const error = new Error(`${fieldName}는 필수이며 유효한 문자열이어야 합니다.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  // UUID는 36자, 일반 ID는 3-100자 허용
  if (sessionId.length < 3 || sessionId.length > 100) {
    const error = new Error(`${fieldName}는 3자에서 100자 사이여야 합니다.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  return null;
}

// 메시지 ID 유효성 검사
function validateMessageId(req) {
  const { message_id } = req.params;
  if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
    const error = new Error("메시지 ID는 필수이며 최대 36자입니다.");
    error.code = "INVALID_INPUT";
    return error;
  }
  return null;
}

// 사용자 접근 권한 검사
function validateUserAccess(req) {
  // 기본적인 사용자 권한 검사 로직
  const user_id = req.user ? req.user.user_id : "guest";
  if (!user_id) {
    const error = new Error("사용자 인증이 필요합니다.");
    error.code = "UNAUTHORIZED";
    return error;
  }
  return null;
}

// 파일 타입 유효성 검사
function validateFileType(file) {
  if (!file) {
    const error = new Error("파일이 필요합니다.");
    error.code = "INVALID_INPUT";
    return error;
  }
  
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(`지원하지 않는 파일 형식입니다. 허용되는 형식: ${allowedMimeTypes.join(', ')}`);
    error.code = "INVALID_FILE_TYPE";
    return error;
  }
  
  return null;
}

// 배치 유효성 검사 실행
function validateBatch(validators) {
  if (!Array.isArray(validators)) {
    throw new Error("validators must be an array");
  }
  
  for (const validator of validators) {
    if (typeof validator === 'function') {
      const error = validator();
      if (error) {
        throw error; // 첫 번째 에러에서 즉시 중단
      }
    }
  }
  return null; // 모든 검사 통과
}

// 메시지 ID 유효성 검사
function validateMessageId(messageIdOrReq, fieldName = 'Message ID') {
  let messageId;
  
  // req 객체인지 확인하고 params에서 추출
  if (messageIdOrReq && typeof messageIdOrReq === 'object' && messageIdOrReq.params) {
    messageId = messageIdOrReq.params.message_id;
  } else {
    messageId = messageIdOrReq;
  }
  
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '' || messageId === 'undefined' || messageId === 'null') {
    const error = new Error(`${fieldName}는 필수이며 유효한 문자열이어야 합니다.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  if (messageId.length < 3 || messageId.length > 100) {
    const error = new Error(`${fieldName}는 3자에서 100자 사이여야 합니다.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  return null;
}

// 사용자 접근 권한 검사
function validateUserAccess(userIdOrReq, sessionUserId = null, fieldName = 'User access') {
  let userId;
  
  // req 객체인지 확인하고 user에서 추출
  if (userIdOrReq && typeof userIdOrReq === 'object' && userIdOrReq.user) {
    userId = userIdOrReq.user.user_id || "guest";
  } else if (userIdOrReq && typeof userIdOrReq === 'object' && userIdOrReq.params) {
    userId = userIdOrReq.params.user_id;
  } else {
    userId = userIdOrReq;
  }
  
  if (!userId) {
    const error = new Error("사용자 인증이 필요합니다.");
    error.code = "UNAUTHORIZED";
    return error;
  }
  
  if (sessionUserId && userId !== sessionUserId) {
    const error = new Error(`${fieldName}: 이 리소스에 접근할 권한이 없습니다.`);
    error.code = "FORBIDDEN";
    return error;
  }
  
  return null;
}

// 파일 타입 유효성 검사
function validateFileType(fileOrFilename, allowedTypes = [], fieldName = 'File type') {
  let filename, mimetype;
  
  // file 객체인지 확인
  if (fileOrFilename && typeof fileOrFilename === 'object') {
    filename = fileOrFilename.originalname || fileOrFilename.filename;
    mimetype = fileOrFilename.mimetype;
  } else {
    filename = fileOrFilename;
  }
  
  if (!filename || typeof filename !== 'string') {
    const error = new Error(`${fieldName}: 파일명이 필요합니다.`);
    error.code = "INVALID_INPUT";
    return error;
  }
  
  // MIME 타입 검사 (파일 객체인 경우)
  if (mimetype) {
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(mimetype)) {
      const error = new Error(`지원하지 않는 파일 형식입니다. 허용되는 형식: 이미지(jpg, png, gif, webp), 텍스트(txt), PDF, Word, Excel`);
      error.code = "INVALID_FILE_TYPE";
      return error;
    }
  }
  
  // 확장자 검사 (allowedTypes가 제공된 경우)
  if (allowedTypes.length > 0) {
    const extension = filename.toLowerCase().split('.').pop();
    if (!allowedTypes.includes(extension)) {
      const error = new Error(`${fieldName}: ${allowedTypes.join(', ')} 파일만 허용됩니다.`);
      error.code = "INVALID_INPUT";
      return error;
    }
  }
  
  return null;
}

/**
 * 미들웨어 형태의 유효성 검사
 * @param {Function[]} validationFunctions - 실행할 유효성 검사 함수들
 * @returns {Function} Express 미들웨어 함수
 */
function validateRequest(validationFunctions) {
  return (req, res, next) => {
    for (const validateFn of validationFunctions) {
      const error = validateFn(req);
      if (error) {
        return next(error);
      }
    }
    next();
  };
}

module.exports = {
  validateUserId,
  validateEmail,
  validateStringLength,
  validateRequiredFields,
  validateType,
  validateArray,
  validateNumberRange,
  validateEnum,
  runValidations,
  validateRequest,
  validateBatch,
  validateSessionId,
  validateMessageId,
  validateUserAccess,
  validateFileType,
  
  // 조합된 검사들 (자주 사용되는 패턴)
  validateUserIdFromParams: (req) => validateUserId(req),
  validateEmailField: (req) => validateEmail(req.body.email),
  validatePassword: (req) => validateStringLength(req.body.password, 'Password', 6, 100),
  validateUsername: (req) => validateStringLength(req.body.username, 'Username', 2, 50),
};
