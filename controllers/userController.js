const bcrypt = require('bcrypt');
const { getConnection, oracledb } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { 
  registerUser, 
  loginUser, 
  getUserSettings, 
  updateUserSettings, 
  updateUserProfileImage, 
  deleteUser, 
  getUserProfile, 
  updateUserProfile,
  getUserCustomization,
  updateUserCustomization,
  getUserLevel,
  addUserExperience,
  getUserBadges,
  toggleUserBadge,
  getTranslationResources,
  updateUserLanguage
} = require('../models/user');
const fs = require('fs');
const path = require('path');
const userModel = require('../models/user');
const { standardizeApiResponse } = require('../utils/apiResponse'); // Corrected path
const { createErrorResponse, getHttpStatusByErrorCode, handleOracleError, logError } = require('../utils/errorHandler');

// 사용자 등록 컨트롤러
async function registerUserController(req, res) {
  const { username, email, password } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9_]+$/;

  // Username validation
  if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자명은 3자 이상 30자 이하이어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (!usernameRegex.test(username)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자명은 영문자, 숫자, 밑줄(_)만 사용할 수 있습니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Email validation
  if (!email || typeof email !== 'string' || email.length > 254 || !emailRegex.test(email)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '유효한 이메일 주소를 입력해주세요 (최대 254자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Password validation
  if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '비밀번호는 8자 이상 128자 이하이어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  // Optional: Add complexity check, e.g., one uppercase, one number
  // const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,128}$/;
  // if (!passwordRegex.test(password)) {
  //   const errorPayload = createErrorResponse('INVALID_INPUT', '비밀번호는 최소 하나의 대문자와 하나의 숫자를 포함해야 합니다.');
  //   return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  // }


  try {
    const user = await registerUser(username, email, password);
    if (user && user.already_registered) {
      // 이미 가입된 사용자 정보 반환 (201 Created 아님)
      return res.status(200).json(standardizeApiResponse({
        message: '이미 가입된 이메일입니다.',
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        already_registered: true
      }));
    }
    res.status(201).json(standardizeApiResponse(user));
  } catch (err) {
    logError('userControllerRegisterUser', err);
    // 이메일 중복 등 고유 제약 위반
    if (err.message === '이미 등록된 이메일입니다.' || err.errorNum === 1 || (err.code && err.code === 'ORA-00001')) {
      const errorPayload = createErrorResponse('UNIQUE_CONSTRAINT_VIOLATED', '이미 등록된 이메일입니다.');
      return res.status(getHttpStatusByErrorCode('UNIQUE_CONSTRAINT_VIOLATED')).json(standardizeApiResponse(errorPayload));
    }
    // 기타 DB 오류
    if (err.errorNum) {
      const errorPayload = handleOracleError(err);
      return res.status(getHttpStatusByErrorCode(errorPayload.error.code)).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `사용자 등록 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 사용자 로그인 컨트롤러
async function loginUserController(req, res) {
  const { email, password } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Email validation
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '유효한 이메일 주소를 입력해주세요.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Password validation
  if (!password || typeof password !== 'string' || password.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '비밀번호를 입력해주세요.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    // loginUser 함수는 이제 사용자 정보만 반환한다고 가정합니다.
    // 실제 loginUser 함수 구현에 따라 조정이 필요할 수 있습니다.
    const user = await loginUser(email, password);

    // 로그인 성공 시 JWT 생성
    const tokenPayload = { user_id: user.user_id, email: user.email }; // 토큰에 포함될 정보
    const token = generateToken(tokenPayload);

    // 사용자 정보와 토큰 함께 반환
    res.json(standardizeApiResponse({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      logged_in_at: new Date().toISOString(),
      token: token // 생성된 토큰 추가
    }));

  } catch (err) {
    logError('userControllerLoginUser', err);
    if (err.message.includes('이메일 또는 비밀번호가 올바르지 않습니다')) {
      const errorPayload = createErrorResponse('UNAUTHORIZED', err.message);
      return res.status(getHttpStatusByErrorCode('UNAUTHORIZED')).json(standardizeApiResponse(errorPayload));
    }
    if (err.message.includes('계정이 비활성화')) {
      const errorPayload = createErrorResponse('FORBIDDEN', err.message);
      return res.status(getHttpStatusByErrorCode('FORBIDDEN')).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `로그인 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 사용자 설정 조회 컨트롤러
async function getUserSettingsController(req, res) {
  const user_id = req.params.user_id;

  // User ID validation
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '' || user_id.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID는 필수이며 최대 36자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    const settings = await getUserSettings(user_id);
    
    // 응답 데이터 표준화
    res.json(standardizeApiResponse(settings));
  } catch (err) {
    logError('userControllerGetUserSettings', err);
    const errorPayload = createErrorResponse('SERVER_ERROR', err.message);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 사용자 설정 업데이트 컨트롤러
async function updateUserSettingsController(req, res) {
  const requestedUserId = req.params.user_id;
  const authenticatedUserId = requestedUserId; 
  const settings = req.body;

  // User ID validation
  if (!requestedUserId || typeof requestedUserId !== 'string' || requestedUserId.trim() === '' || requestedUserId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID는 필수이며 최대 36자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  if (!settings || Object.keys(settings).length === 0) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '수정할 설정 내용이 없습니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Settings validation
  const allowedThemes = ['light', 'dark', 'system'];
  if (settings.hasOwnProperty('theme') && (typeof settings.theme !== 'string' || !allowedThemes.includes(settings.theme))) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `테마는 다음 중 하나여야 합니다: ${allowedThemes.join(', ')}.`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  const allowedLanguages = ['en', 'ko', 'ja'];
  if (settings.hasOwnProperty('language') && (typeof settings.language !== 'string' || !allowedLanguages.includes(settings.language))) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `언어는 다음 중 하나여야 합니다: ${allowedLanguages.join(', ')}.`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  if (settings.hasOwnProperty('font_size')) {
    const fontSize = parseInt(settings.font_size, 10);
    if (isNaN(fontSize) || fontSize < 10 || fontSize > 30) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '글꼴 크기는 10에서 30 사이의 숫자여야 합니다.');
      return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
    }
  }

  if (settings.hasOwnProperty('notifications_enabled') && typeof settings.notifications_enabled !== 'boolean') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '알림 활성화 여부는 boolean 값이어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  
  if (settings.hasOwnProperty('ai_model_preference') && (typeof settings.ai_model_preference !== 'string' || settings.ai_model_preference.trim() === '' || settings.ai_model_preference.length > 50 )) {
    const errorPayload = createErrorResponse('INVALID_INPUT', 'AI 모델 환경설정은 비어 있지 않은 문자열이어야 하며 최대 50자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }


  try {
    const updatedSettings = await updateUserSettings(authenticatedUserId, settings);
    res.status(200).json(standardizeApiResponse(updatedSettings));
  } catch (err) {
    logError('userControllerUpdateUserSettings', err);
    const errorPayload = createErrorResponse('SERVER_ERROR', `설정 업데이트 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 사용자 프로필 이미지 업로드 컨트롤러
async function uploadProfileImageController(req, res) {
  const user_id = req.params.user_id;
  const file = req.file;

  // User ID validation
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '' || user_id.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID는 필수이며 최대 36자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // File validation
  if (!file) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '프로필 이미지가 업로드되지 않았습니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `허용되지 않는 파일 타입입니다. 허용되는 타입: ${allowedMimeTypes.join(', ')}.`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  const maxFileSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxFileSize) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `파일 크기가 너무 큽니다 (최대 ${maxFileSize / (1024 * 1024)}MB).`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // 실제 파일 저장 경로는 /uploads/profiles/[user_id]/filename 형태로 구성하거나, DB에 파일 경로 저장
  // 여기서는 단순화를 위해 파일명만 DB에 저장한다고 가정하고, 실제 파일은 uploads 폴더에 저장됨
  // 필요시 사용자별 폴더 생성 로직 추가
  const profileImagePath = `/uploads/${file.filename}`; // 예시 경로

  try {
    await updateUserProfileImage(user_id, profileImagePath);
    res.json(standardizeApiResponse({ 
      message: '프로필 이미지가 성공적으로 업데이트되었습니다.', 
      user_id: user_id,
      profile_image_path: profileImagePath 
    }));
  } catch (err) {
    logError('userControllerUploadProfileImage', err);
    // 업로드된 파일 삭제 (오류 시)
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) logError('userControllerUploadProfileImageUnlink', unlinkErr);
      });
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `프로필 이미지 업데이트 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 회원 탈퇴 (계정 데이터 삭제) 컨트롤러
async function deleteUserController(req, res) {
  const user_id = req.params.user_id;

  // User ID validation
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '' || user_id.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID는 필수이며 최대 36자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    await deleteUser(user_id);
    res.status(200).json(standardizeApiResponse({ message: '사용자 계정이 성공적으로 삭제되었습니다.', user_id: user_id }));
  } catch (err) {
    logError('userControllerDeleteUser', err);
    const errorPayload = createErrorResponse('SERVER_ERROR', `회원 탈퇴 처리 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 사용자 프로필 조회 컨트롤러
async function getUserProfileController(req, res) {
  const user_id = req.params.user_id;

  // User ID validation
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '' || user_id.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID는 필수이며 최대 36자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    const userProfile = await userModel.getUserProfile(user_id);
    if (!userProfile) {
      // 사용자는 존재하지만 프로필이 없는 경우 (정상적인 상황은 아님, registerUser에서 생성)
      // 또는 초기 데이터 마이그레이션 등으로 프로필이 없을 수 있음.
      // 이 경우, 빈 프로필 객체 또는 404를 반환할 수 있습니다.
      // README.AI 지침에 따라 인증/보안을 최소화하므로, 여기서는 404를 반환합니다.
      const errorPayload = createErrorResponse('USER_NOT_FOUND', '사용자 프로필을 찾을 수 없습니다.');
      return res.status(getHttpStatusByErrorCode('USER_NOT_FOUND')).json(standardizeApiResponse(errorPayload));
    }
    // CLOB(BIO 등) → 문자열 변환 (casing도 일관성)
    const { clobToString } = require('../models/chat');
    const profileObj = { ...userProfile };
    if (profileObj.BIO && typeof profileObj.BIO === 'object') {
      profileObj.BIO = await clobToString(profileObj.BIO);
    }
    res.json(standardizeApiResponse(profileObj));
  } catch (err) {
    logError('userControllerGetUserProfile', err);
    const errorPayload = createErrorResponse('SERVER_ERROR', `프로필 조회 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 사용자 프로필 업데이트 컨트롤러
async function updateUserProfileController(req, res) {
  const user_id = req.params.user_id;
  const profileData = req.body;
  const usernameRegex = /^[a-zA-Z0-9_]+$/;

  // User ID validation
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '' || user_id.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID는 필수이며 최대 36자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // ProfileData validation
  if (!profileData || Object.keys(profileData).length === 0) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '수정할 프로필 내용이 없습니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  if (profileData.hasOwnProperty('username')) {
    if (typeof profileData.username !== 'string' || profileData.username.trim().length < 3 || profileData.username.trim().length > 30) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자명은 3자 이상 30자 이하이어야 합니다.');
      return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
    }
    if (!usernameRegex.test(profileData.username)) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자명은 영문자, 숫자, 밑줄(_)만 사용할 수 있습니다.');
      return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
    }
  }

  const allowedThemes = ['light', 'dark', 'system'];
  if (profileData.hasOwnProperty('theme_preference') && (typeof profileData.theme_preference !== 'string' || !allowedThemes.includes(profileData.theme_preference))) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `테마 환경설정은 다음 중 하나여야 합니다: ${allowedThemes.join(', ')}.`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  if (profileData.hasOwnProperty('bio') && (typeof profileData.bio !== 'string' || profileData.bio.length > 500)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '소개는 문자열이어야 하며 최대 500자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  if (profileData.hasOwnProperty('badge') && (typeof profileData.badge !== 'string' || profileData.badge.length > 50)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '배지는 문자열이어야 하며 최대 50자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    const updatedProfile = await updateUserProfile(user_id, profileData);
    // CLOB(BIO 등) → 문자열 변환 (casing도 일관성)
    const { clobToString } = require('../models/chat');
    const profileObj = { ...updatedProfile };
    if (profileObj.BIO && typeof profileObj.BIO === 'object') {
      profileObj.BIO = await clobToString(profileObj.BIO);
    }
    res.json(standardizeApiResponse(profileObj));
  } catch (err) {
    logError('userControllerUpdateUserProfile', err);
    if (err.message.includes('프로필을 찾을 수 없거나 업데이트할 내용이 없습니다')) {
        const errorPayload = createErrorResponse('USER_NOT_FOUND', err.message);
        return res.status(getHttpStatusByErrorCode('USER_NOT_FOUND')).json(standardizeApiResponse(errorPayload));
    }
    if (err.message.includes('수정할 프로필 내용이 없습니다')) { // 모델에서 발생시킨 경우
        const errorPayload = createErrorResponse('INVALID_INPUT', err.message);
        return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `프로필 업데이트 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

async function checkEmailExists(req, res) {
  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Email validation
  if (!email || typeof email !== 'string' || email.length > 254 || !emailRegex.test(email)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '유효한 이메일 주소를 입력해주세요 (최대 254자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    const exists = await userModel.checkEmailExists(email);
    res.json(standardizeApiResponse({ email_exists: exists }));
  } catch (err) {
    logError('userControllerCheckEmailExists', err);
    const errorPayload = createErrorResponse('SERVER_ERROR', `이메일 중복 체크 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// =========================
// 7. 프로필 꾸미기 API
// =========================

/**
 * 사용자 프로필 꾸미기 설정 조회
 */
async function getUserCustomizationController(req, res) {
  try {
    const { user_id } = req.params;
    
    if (!user_id) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const customization = await getUserCustomization(user_id);
    return res.status(200).json(standardizeApiResponse(customization));
    
  } catch (error) {
    logError('getUserCustomizationController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

/**
 * 사용자 프로필 꾸미기 설정 업데이트
 */
async function updateUserCustomizationController(req, res) {
  try {
    const { user_id } = req.params;
    const customizationData = req.body;
    
    if (!user_id) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const result = await updateUserCustomization(user_id, customizationData);
    return res.status(200).json(standardizeApiResponse(result));
    
  } catch (error) {
    logError('updateUserCustomizationController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

// =========================
// 8. 레벨 및 경험치 API
// =========================

/**
 * 사용자 레벨 정보 조회
 */
async function getUserLevelController(req, res) {
  try {
    const { user_id } = req.params;
    
    if (!user_id) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const levelInfo = await getUserLevel(user_id);
    return res.status(200).json(standardizeApiResponse(levelInfo));
    
  } catch (error) {
    logError('getUserLevelController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

/**
 * 사용자 경험치 추가 (관리자용 또는 시스템 내부 호출)
 */
async function addUserExperienceController(req, res) {
  try {
    const { user_id } = req.params;
    const { points, exp_type = 'manual', reason } = req.body;
    
    if (!user_id || typeof points !== 'number' || points <= 0) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID와 유효한 경험치 포인트가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const result = await addUserExperience(user_id, points, exp_type, reason);
    return res.status(200).json(standardizeApiResponse(result));
    
  } catch (error) {
    logError('addUserExperienceController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

// =========================
// 뱃지 시스템 API
// =========================

/**
 * 사용자 뱃지 목록 조회
 */
async function getUserBadgesController(req, res) {
  try {
    const { user_id } = req.params;
    
    if (!user_id) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const badges = await getUserBadges(user_id);
    return res.status(200).json(standardizeApiResponse(badges));
    
  } catch (error) {
    logError('getUserBadgesController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

/**
 * 뱃지 착용/해제
 */
async function toggleUserBadgeController(req, res) {
  try {
    const { user_id, badge_id } = req.params;
    const { is_equipped } = req.body;
    
    if (!user_id || !badge_id) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID와 뱃지 ID가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const result = await toggleUserBadge(user_id, badge_id, is_equipped);
    return res.status(200).json(standardizeApiResponse(result));
    
  } catch (error) {
    logError('toggleUserBadgeController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

// =========================
// 10. 다국어 지원 API
// =========================

/**
 * 번역 리소스 조회
 */
async function getTranslationResourcesController(req, res) {
  try {
    const { lang } = req.params;
    const { category } = req.query;
    
    if (!lang) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '언어 코드가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const translations = await getTranslationResources(lang, category);
    return res.status(200).json(standardizeApiResponse(translations));
    
  } catch (error) {
    logError('getTranslationResourcesController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

/**
 * 사용자 언어 설정 업데이트
 */
async function updateUserLanguageController(req, res) {
  try {
    const { user_id } = req.params;
    const { language } = req.body;
    
    if (!user_id || !language) {
      const errorPayload = createErrorResponse('INVALID_INPUT', '사용자 ID와 언어 코드가 필요합니다.');
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    // 지원하는 언어 체크
    const supportedLanguages = ['ko', 'en', 'ja', 'zh'];
    if (!supportedLanguages.includes(language)) {
      const errorPayload = createErrorResponse('INVALID_INPUT', `지원하지 않는 언어입니다. 지원 언어: ${supportedLanguages.join(', ')}`);
      return res.status(400).json(standardizeApiResponse(errorPayload));
    }

    const result = await updateUserLanguage(user_id, language);
    return res.status(200).json(standardizeApiResponse(result));
    
  } catch (error) {
    logError('updateUserLanguageController', error);
    const errorPayload = handleOracleError(error);
    return res.status(getHttpStatusByErrorCode(errorPayload.code)).json(standardizeApiResponse(errorPayload));
  }
}

module.exports = {
  registerUserController,
  loginUserController,
  getUserSettingsController, // Already done
  updateUserSettingsController,
  uploadProfileImageController,
  deleteUserController,
  getUserProfileController,
  updateUserProfileController,
  checkEmailExists,
  getUserCustomizationController,
  updateUserCustomizationController,
  getUserLevelController,
  addUserExperienceController,
  getUserBadgesController,
  toggleUserBadgeController,
  getTranslationResourcesController,
  updateUserLanguageController
};