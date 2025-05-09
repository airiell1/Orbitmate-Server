const bcrypt = require('bcrypt');
const { getConnection, oracledb } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { registerUser, loginUser, getUserSettings, updateUserSettings, updateUserProfileImage, deleteUser, getUserProfile, updateUserProfile } = require('../models/user');
const fs = require('fs');
const path = require('path');
const userModel = require('../models/user');
const { standardizeApiResponse } = require('../utils/apiResponse');

// 사용자 등록 컨트롤러
async function registerUserController(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: '사용자명, 이메일, 비밀번호는 필수 입력사항입니다.' });
  }

  try {
    const user = await registerUser(username, email, password);
    if (user && user.already_registered) {
      // 이미 가입된 사용자 정보 반환 (201 Created 아님)
      return res.status(200).json({
        message: '이미 가입된 이메일입니다.',
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        already_registered: true
      });
    }
    res.status(201).json(user);
  } catch (err) {
    // 공통 에러 핸들러 사용 (utils/errorHandler)
    const { createErrorResponse, handleOracleError, logError } = require('../utils/errorHandler');
    logError('registerUserController', err);
    // 이메일 중복 등 고유 제약 위반
    if (err.message === '이미 등록된 이메일입니다.' || err.errorNum === 1 || (err.code && err.code === 'ORA-00001')) {
      return res.status(409).json(createErrorResponse('UNIQUE_CONSTRAINT_VIOLATED', '이미 등록된 이메일입니다.'));
    }
    // 기타 DB 오류
    if (err.errorNum) {
      return res.status(500).json(handleOracleError(err));
    }
    res.status(500).json(createErrorResponse('SERVER_ERROR', `사용자 등록 중 오류 발생: ${err.message}`));
  }
}

// 사용자 로그인 컨트롤러
async function loginUserController(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호는 필수 입력사항입니다.' });
  }

  try {
    // loginUser 함수는 이제 사용자 정보만 반환한다고 가정합니다.
    // 실제 loginUser 함수 구현에 따라 조정이 필요할 수 있습니다.
    const user = await loginUser(email, password);

    // 로그인 성공 시 JWT 생성
    const tokenPayload = { userId: user.user_id, email: user.email }; // 토큰에 포함될 정보
    const token = generateToken(tokenPayload);

    // 사용자 정보와 토큰 함께 반환
    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      logged_in_at: new Date().toISOString(),
      token: token // 생성된 토큰 추가
    });

  } catch (err) {
    if (err.message.includes('이메일 또는 비밀번호가 올바르지 않습니다')) {
      return res.status(401).json({ error: err.message });
    }
    if (err.message.includes('계정이 비활성화')) {
      return res.status(403).json({ error: err.message });
    }
    console.error('로그인 컨트롤러 오류:', err);
    res.status(500).json({ error: `로그인 중 오류 발생: ${err.message}` });
  }
}

// 사용자 설정 조회 컨트롤러
async function getUserSettingsController(req, res) {
  try {
    const userId = req.params.user_id;
    const settings = await getUserSettings(userId);
    
    // 응답 데이터 표준화
    res.json(standardizeApiResponse(settings));
  } catch (err) {
    console.error('사용자 설정 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
}

// 사용자 설정 업데이트 컨트롤러
async function updateUserSettingsController(req, res) {
  const requestedUserId = req.params.user_id;
  // const authenticatedUserId = req.user.userId; // 인증 생략
  const authenticatedUserId = requestedUserId; // 임시로 요청된 ID를 사용
  const settings = req.body;

  // 인가 확인 생략
  // if (requestedUserId !== authenticatedUserId) {
  //   return res.status(403).json({ error: '자신의 설정만 수정할 수 있습니다.' });
  // }

  if (Object.keys(settings).length === 0) {
    return res.status(400).json({ error: '수정할 설정 내용이 없습니다.' });
  }

  try {
    const updatedSettings = await updateUserSettings(authenticatedUserId, settings);
    res.status(200).json(updatedSettings);
  } catch (err) {
    console.error('설정 업데이트 컨트롤러 오류:', err);
    res.status(500).json({ error: `설정 업데이트 중 오류 발생: ${err.message}` });
  }
}

// 사용자 프로필 이미지 업로드 컨트롤러
async function uploadProfileImageController(req, res) {
  const userId = req.params.user_id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: '프로필 이미지가 업로드되지 않았습니다.' });
  }

  // 실제 파일 저장 경로는 /uploads/profiles/[user_id]/filename 형태로 구성하거나, DB에 파일 경로 저장
  // 여기서는 단순화를 위해 파일명만 DB에 저장한다고 가정하고, 실제 파일은 uploads 폴더에 저장됨
  // 필요시 사용자별 폴더 생성 로직 추가
  const profileImagePath = `/uploads/${file.filename}`; // 예시 경로

  try {
    await updateUserProfileImage(userId, profileImagePath);
    res.json({ 
      message: '프로필 이미지가 성공적으로 업데이트되었습니다.', 
      user_id: userId,
      profile_image_path: profileImagePath 
    });
  } catch (err) {
    console.error('프로필 이미지 업데이트 실패:', err);
    // 업로드된 파일 삭제 (오류 시)
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('임시 프로필 이미지 삭제 실패:', unlinkErr);
      });
    }
    res.status(500).json({ error: `프로필 이미지 업데이트 중 오류 발생: ${err.message}` });
  }
}

// 회원 탈퇴 (계정 데이터 삭제) 컨트롤러
async function deleteUserController(req, res) {
  const userId = req.params.user_id;
  // 실제 운영에서는 본인 확인 절차 또는 관리자 권한 확인이 필요합니다.
  // 여기서는 인증을 생략하므로 바로 삭제 로직 진행

  try {
    await deleteUser(userId);
    res.status(200).json({ message: '사용자 계정이 성공적으로 삭제되었습니다.', user_id: userId });
  } catch (err) {
    console.error('회원 탈퇴 처리 실패:', err);
    res.status(500).json({ error: `회원 탈퇴 처리 중 오류 발생: ${err.message}` });
  }
}

// 사용자 프로필 조회 컨트롤러
async function getUserProfileController(req, res) {
  const userId = req.params.user_id;
  // 인증/인가 로직은 현재 최소화되어 있습니다.

  try {
    const userProfile = await userModel.getUserProfile(userId);
    if (!userProfile) {
      // 사용자는 존재하지만 프로필이 없는 경우 (정상적인 상황은 아님, registerUser에서 생성)
      // 또는 초기 데이터 마이그레이션 등으로 프로필이 없을 수 있음.
      // 이 경우, 빈 프로필 객체 또는 404를 반환할 수 있습니다.
      // README.AI 지침에 따라 인증/보안을 최소화하므로, 여기서는 404를 반환합니다.
      return res.status(404).json({ error: '사용자 프로필을 찾을 수 없습니다.' });
    }
    // CLOB(BIO 등) → 문자열 변환 (casing도 일관성)
    const { clobToString } = require('../models/chat');
    const profileObj = { ...userProfile };
    if (profileObj.BIO && typeof profileObj.BIO === 'object') {
      profileObj.BIO = await clobToString(profileObj.BIO);
    }
    res.json(profileObj);
  } catch (err) {
    console.error('프로필 조회 컨트롤러 오류:', err);
    res.status(500).json({ error: `프로필 조회 중 오류 발생: ${err.message}` });
  }
}

// 사용자 프로필 업데이트 컨트롤러
async function updateUserProfileController(req, res) {
  const userId = req.params.user_id;
  const profileData = req.body;
  // 인증/인가 로직 최소화

  // 요청 본문이 비어 있는지 확인 (profileData가 null이거나 빈 객체일 수 있음)
  if (!profileData || Object.keys(profileData).length === 0) {
    return res.status(400).json({ error: '수정할 프로필 내용이 없습니다.' });
  }

  try {
    const updatedProfile = await updateUserProfile(userId, profileData);
    // CLOB(BIO 등) → 문자열 변환 (casing도 일관성)
    const { clobToString } = require('../models/chat');
    const profileObj = { ...updatedProfile };
    if (profileObj.BIO && typeof profileObj.BIO === 'object') {
      profileObj.BIO = await clobToString(profileObj.BIO);
    }
    res.json(profileObj);
  } catch (err) {
    console.error('프로필 업데이트 컨트롤러 오류:', err);
    if (err.message.includes('프로필을 찾을 수 없거나 업데이트할 내용이 없습니다')) {
        return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('수정할 프로필 내용이 없습니다')) { // 모델에서 발생시킨 경우
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: `프로필 업데이트 중 오류 발생: ${err.message}` });
  }
}

module.exports = {
  registerUserController,
  loginUserController,
  getUserSettingsController,
  updateUserSettingsController,
  uploadProfileImageController,
  deleteUserController,
  getUserProfileController, // 추가
  updateUserProfileController // 추가
};