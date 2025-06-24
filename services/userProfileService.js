const userModel = require("../models/user");
const { withTransaction } = require("../utils/dbUtils");
const fs = require("fs"); // For file operations if needed by service, though typically controller handles file system interaction via multer

/**
 * 사용자 프로필 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 사용자 프로필 정보 또는 null (사용자 없음)
 */
async function getUserProfileService(userId) {
  return await withTransaction(async (connection) => {
    const userProfile = await userModel.getUserProfile(connection, userId);
    if (!userProfile) {
      // 모델에서 USER_NOT_FOUND 에러를 throw하므로, 서비스 레벨에서 추가적인 에러 처리는 불필요할 수 있음.
      // 또는, 여기서 잡아서 다른 형태의 에러로 변환하거나 로깅 후 다시 throw 할 수 있음.
      // 현재 모델은 에러를 throw하므로, 여기서는 그대로 전파되도록 둠.
    }
    // 추가적인 비즈니스 로직 (예: 특정 필드 가공, 다른 서비스 호출하여 정보 조합 등)이 있다면 여기서 수행
    return userProfile;
  });
}

/**
 * 사용자 프로필 업데이트 서비스
 * @param {string} userId - 사용자 ID
 * @param {Object} profileData - 업데이트할 프로필 데이터
 * @returns {Promise<Object>} 업데이트된 프로필 정보
 */
async function updateUserProfileService(userId, profileData) {
  return await withTransaction(async (connection) => {
    // 입력값 유효성 검사는 컨트롤러에서 수행되었거나, 여기서 추가적인 비즈니스 규칙 검증 가능
    const updatedProfile = await userModel.updateUserProfile(connection, userId, profileData);
    // 추가 로직 (예: 프로필 변경 알림 발송 등)
    return updatedProfile;
  });
}

/**
 * 사용자 프로필 이미지 경로 업데이트 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} profileImagePath - 저장된 프로필 이미지 경로
 * @returns {Promise<Object>} 업데이트 결과 (예: { profile_image_path: newPath })
 */
async function updateUserProfileImageService(userId, profileImagePath) {
  // 파일 시스템 작업(파일 저장/삭제 등)은 보통 컨트롤러나 별도의 파일 관리 서비스에서 처리.
  // 이 서비스는 DB에 경로를 업데이트하는 역할만 수행.
  return await withTransaction(async (connection) => {
    const result = await userModel.updateUserProfileImage(connection, userId, profileImagePath);
    // userModel.updateUserProfileImage가 { profile_image_path: profileImagePath }를 반환한다고 가정
    return result;
  });
}

module.exports = {
  getUserProfileService,
  updateUserProfileService,
  updateUserProfileImageService,
};
