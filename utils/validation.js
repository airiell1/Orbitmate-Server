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
function validateSessionId(req) {
  const { session_id } = req.params;
  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const error = new Error("세션 ID는 필수이며 최대 36자입니다.");
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

// 배치 유효성 검사 함수 (validateBatch)
function validateBatch(validationFunctions) {
  for (const validationFn of validationFunctions) {
    const error = validationFn();
    if (error) {
      throw error; // 첫 번째 에러에서 즉시 중단
    }
  }
  return null; // 모든 검사 통과
}

// 배치 유효성 검사 실행
function validateBatch(validators) {
  if (!Array.isArray(validators)) {
    throw new Error("validators must be an array");
  }
  
  for (const validator of validators) {
    if (typeof validator === 'function') {
      validator(); // 유효성 검사 함수 실행 (에러 시 throw)
    }
  }
}

// 세션 ID 유효성 검사
function validateSessionId(sessionId, fieldName = 'Session ID') {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    const error = new Error(`${fieldName} is required and must be a non-empty string.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
  
  // UUID는 36자, 일반 ID는 3-50자 허용
  if (sessionId.length < 3 || sessionId.length > 100) {
    const error = new Error(`${fieldName} must be between 3 and 100 characters.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
}

// 메시지 ID 유효성 검사
function validateMessageId(messageId, fieldName = 'Message ID') {
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    const error = new Error(`${fieldName} is required and must be a non-empty string.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
  
  if (messageId.length < 3 || messageId.length > 50) {
    const error = new Error(`${fieldName} must be between 3 and 50 characters.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
}

// 사용자 접근 권한 검사
function validateUserAccess(userId, sessionUserId, fieldName = 'User access') {
  if (userId !== sessionUserId) {
    const error = new Error(`${fieldName}: You don't have permission to access this resource.`);
    error.code = "FORBIDDEN";
    throw error;
  }
}

// 파일 타입 유효성 검사
function validateFileType(filename, allowedTypes = [], fieldName = 'File type') {
  if (!filename || typeof filename !== 'string') {
    const error = new Error(`${fieldName}: Filename is required.`);
    error.code = "INVALID_INPUT";
    throw error;
  }
  
  if (allowedTypes.length > 0) {
    const extension = filename.toLowerCase().split('.').pop();
    if (!allowedTypes.includes(extension)) {
      const error = new Error(`${fieldName}: Only ${allowedTypes.join(', ')} files are allowed.`);
      error.code = "INVALID_INPUT";
      throw error;
    }
  }
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
