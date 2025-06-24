const userProfileService = require("../services/userProfileService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const fs = require("fs"); // For cleaning up files on error if necessary, though service might handle it

/**
 * 사용자 프로필 조회 컨트롤러
 */
async function getUserProfileController(req, res, next) {
  const { user_id } = req.params;
  if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const userProfile = await userProfileService.getUserProfileService(user_id);
    // 서비스에서 USER_NOT_FOUND 에러를 throw 할 수 있음
    const apiResponse = standardizeApiResponse(userProfile);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

/**
 * 사용자 프로필 업데이트 컨트롤러
 */
async function updateUserProfileController(req, res, next) {
  const { user_id } = req.params;
  const profileData = req.body;

  if (!user_id || !profileData || Object.keys(profileData).length === 0) {
    const err = new Error("User ID and profile data are required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // 입력값 상세 유효성 검사는 여기서 수행하거나, express-validator 등을 사용
  // 예: username 길이, 형식 등
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (profileData.username && !usernameRegex.test(profileData.username)) {
    const err = new Error("사용자명은 3~30자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
   if (profileData.bio && profileData.bio.length > 500) {
    const err = new Error("소개는 최대 500자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // ... 기타 필드 유효성 검사

  try {
    // 인증된 사용자와 요청된 user_id가 일치하는지 확인하는 로직 (미들웨어 또는 여기서)
    // if (req.user.user_id !== user_id) {
    //   const err = new Error("자신의 프로필만 수정할 수 있습니다.");
    //   err.code = "FORBIDDEN";
    //   return next(err);
    // }
    const updatedProfile = await userProfileService.updateUserProfileService(user_id, profileData);
    const apiResponse = standardizeApiResponse(updatedProfile);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

/**
 * 사용자 프로필 이미지 업로드 컨트롤러
 */
async function uploadProfileImageController(req, res, next) {
  const { user_id } = req.params;
  const file = req.file; // multer 미들웨어에서 설정

  if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){}
    return next(err);
  }
  if (!file) {
    const err = new Error("프로필 이미지가 업로드되지 않았습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // 파일 유효성 검사 (MIME 타입, 크기 등) - multer에서도 가능하지만, 컨트롤러에서 한번 더 확인 가능
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
  const maxFileSize = 2 * 1024 * 1024; // 2MB

  if (!allowedMimeTypes.includes(file.mimetype)) {
    const err = new Error(`허용되지 않는 파일 타입입니다. (${allowedMimeTypes.join(", ")})`);
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){}
    return next(err);
  }
  if (file.size > maxFileSize) {
    const err = new Error(`파일 크기가 너무 큽니다 (최대 ${maxFileSize / (1024 * 1024)}MB).`);
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){}
    return next(err);
  }

  // public/uploads/profiles/ 와 같은 경로에 저장되도록 multer 설정이 되어있다고 가정
  // 서비스에는 DB에 저장할 상대 경로 또는 전체 URL 전달
  const profileImagePath = `/uploads/profiles/${file.filename}`;

  try {
    // 인증된 사용자와 요청된 user_id가 일치하는지 확인하는 로직
    // if (req.user.user_id !== user_id) { ... }

    const result = await userProfileService.updateUserProfileImageService(user_id, profileImagePath);
    const apiResponse = standardizeApiResponse({
      message: "프로필 이미지가 성공적으로 업데이트되었습니다.",
      user_id: user_id,
      profile_image_path: result.profile_image_path, // 서비스에서 반환된 경로 사용
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    // 서비스 또는 모델에서 에러 발생 시 업로드된 파일 삭제
    if (file && file.path) {
      try { fs.unlinkSync(file.path); } catch (e) { console.error("Error deleting uploaded file on failure:", e); }
    }
    next(err);
  }
}

/**
 * 사용자 계정 삭제 컨트롤러
 */
async function deleteUserController(req, res, next) {
  const { user_id } = req.params;
   // 실제 운영에서는 인증된 사용자가 본인이거나 관리자인지 확인 필요
  // if (req.user.user_id !== user_id && !req.user.isAdmin) {
  //   const err = new Error("계정을 삭제할 권한이 없습니다.");
  //   err.code = "FORBIDDEN";
  //   return next(err);
  // }
   if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    // deleteUserService를 만들거나, userProfileService에 포함할 수 있음.
    // 여기서는 userModel을 직접 호출하는 대신, 서비스 계층을 거친다고 가정하고
    // userProfileService에 deleteUserService가 있다고 가정하거나,
    // userManagementService 같은 것을 만들 수 있음.
    // 우선은 userModel.deleteUser가 서비스로 옮겨졌다고 가정하고 호출 (userModel 직접 호출은 지양)
    // 이 부분은 userService.js 또는 userManagementService.js로 이전 필요
    const result = await withTransaction(async (connection) => { // userModel.deleteUser가 connection을 받도록 수정됨
        return await userModel.deleteUser(connection, user_id);
    });

    const apiResponse = standardizeApiResponse(result); // 모델에서 { message: "..." } 반환 가정
    res.status(apiResponse.statusCode).json(apiResponse.body); // 성공 시 200 또는 204
  } catch (err) {
    next(err);
  }
}


module.exports = {
  getUserProfileController,
  updateUserProfileController,
  uploadProfileImageController,
  deleteUserController, // deleteUserController는 userManagementController 등으로 옮기는 것이 더 적절할 수 있음
};
