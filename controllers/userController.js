const {
  createController,
  createReadController,
  createUpdateController,
  createDeleteController,
  createService,
  createReadService,
  createUpdateService,
  createDeleteService,
  createUserService,
  createUserSettingsService,
  createUserProfileService,
} = require("../utils/serviceFactory");

const userModel = require("../models/user");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { API_TEST_USER_ID } = require("../utils/constants");
const { withTransaction } = require("../utils/dbUtils");
const config = require("../config");
const fs = require("fs");

// =========================
// 🔥 Phase 1: 핵심 기능 (사용자 인증 & 기본 정보)
// =========================

/**
 * 사용자 등록 컨트롤러 - 직접 구현 (withTransaction 사용)
 */
async function registerUserController(req, res, next) {
  try {
    const { username, email, password } = req.body;
    
    // 입력값 검증
    if (!username || !email || !password) {
      const err = new Error("사용자명, 이메일, 비밀번호가 모두 필요합니다.");
      err.code = "INVALID_INPUT";
      throw err;
    }

    // API@example.com 이메일일 때만 고정 ID 사용, 아니면 null (자동 생성)
    const user_id = email === "API@example.com" ? API_TEST_USER_ID : null;

    // 트랜잭션으로 사용자 등록 실행
    const result = await withTransaction(async (connection) => {
      return await userModel.registerUser(connection, user_id, username, email, password);
    });

    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
    
  } catch (error) {
    next(error);
  }
}

/**
 * 사용자 로그인 컨트롤러 - 직접 구현 (withTransaction 사용)
 */
async function loginUserController(req, res, next) {
  try {
    const { email, password } = req.body;
    
    // 입력값 검증
    if (!email || !password) {
      const err = new Error("이메일과 비밀번호가 필요합니다.");
      err.code = "INVALID_INPUT";
      throw err;
    }

    // 트랜잭션으로 사용자 로그인 실행
    const result = await withTransaction(async (connection) => {
      return await userModel.loginUser(connection, email, password);
    });

    // MVP에서는 토큰 없이 사용자 정보만 반환
    const finalResult = { ...result };

    const apiResponse = standardizeApiResponse(finalResult);
    res.status(apiResponse.statusCode).json(apiResponse.body);
    
  } catch (error) {
    next(error);
  }
}

/**
 * 이메일 중복 체크 컨트롤러 - ServiceFactory 패턴 적용
 */
const checkEmailExistsController = createReadController(
  userModel.checkEmailExists,
  {
    dataExtractor: (req) => {
      const { email } = req.body;
      return [email];
    },
    validations: [
      (req) => {
        const { email } = req.body;
        
        if (!email) {
          const err = new Error("이메일이 필요합니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    responseTransformer: (exists) => ({ email_exists: exists }),
    errorContext: 'check_email_exists'
  }
);

/**
 * 사용자 프로필 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserProfileController = createReadController(
  userModel.getUserProfile,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      return [user_id];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        
        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_user_profile'
  }
);

/**
 * 사용자 프로필 업데이트 컨트롤러 - ServiceFactory 패턴 적용
 */
const updateUserProfileController = createUpdateController(
  userModel.updateUserProfile,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const profileData = req.body;
      return [user_id, profileData];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const profileData = req.body;

        if (!user_id || !profileData || Object.keys(profileData).length === 0) {
          const err = new Error("User ID and profile data are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }

        // 유효성 검사
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        if (profileData.username && !usernameRegex.test(profileData.username)) {
          const err = new Error("사용자명은 3~30자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        if (profileData.bio && profileData.bio.length > 500) {
          const err = new Error("소개는 최대 500자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'update_user_profile'
  }
);

/**
 * 회원 탈퇴 컨트롤러 - ServiceFactory 패턴 적용
 */
const deleteUserController = createDeleteController(
  userModel.deleteUser,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      return [user_id];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;

        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'delete_user'
  }
);

/**
 * 사용자 설정 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserSettingsController = createReadController(
  userModel.getUserSettings,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      return [user_id];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        
        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_user_settings'
  }
);

/**
 * 사용자 설정 업데이트 컨트롤러 - ServiceFactory 패턴 적용
 */
const updateUserSettingsController = createUpdateController(
  userModel.updateUserSettings,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const settingsData = req.body;
      return [user_id, settingsData];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const settingsData = req.body;

        if (!user_id || !settingsData || Object.keys(settingsData).length === 0) {
          const err = new Error("User ID and settings data are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }

        // 유효성 검사
        if (settingsData.theme && !config.userSettings.allowedThemes?.includes(settingsData.theme)) {
          const err = new Error(`Invalid theme. Allowed: ${config.userSettings.allowedThemes?.join(', ') || 'light, dark'}`);
          err.code = "INVALID_INPUT";
          throw err;
        }
        if (settingsData.language && !config.userSettings.supportedLanguages?.includes(settingsData.language)) {
          const err = new Error(`Invalid language. Supported: ${config.userSettings.supportedLanguages?.join(', ') || 'ko, en'}`);
          err.code = "INVALID_INPUT";
          throw err;
        }
        if (settingsData.font_size && (settingsData.font_size < config.userSettings.fontSizeRange.min || settingsData.font_size > config.userSettings.fontSizeRange.max)) {
          const err = new Error(`Font size must be between ${config.userSettings.fontSizeRange.min} and ${config.userSettings.fontSizeRange.max}.`);
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'update_user_settings'
  }
);

/**
 * 프로필 이미지 업로드 컨트롤러 - 직접 구현 (파일 처리 때문에)
 */
async function uploadProfileImageController(req, res, next) {
  const { user_id } = req.params;
  const uploadedFile = req.file;

  console.log('[uploadProfileImageController] 실행:', { 
    user_id, 
    hasFile: !!uploadedFile,
    files: req.files,
    body: req.body 
  });

  if (!user_id) {
    const err = new Error("User ID is required.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  if (!uploadedFile) {
    const err = new Error("프로필 이미지 파일이 필요합니다. 'profileImage' 필드로 파일을 전송해주세요.");
    err.code = "INVALID_INPUT";
    err.details = { 
      expected_field: 'profileImage',
      received_files: req.files || 'none',
      received_file: req.file || 'none'
    };
    return next(err);
  }

  try {
    const { withTransaction } = require("../utils/dbUtils");
    const profileImagePath = `/uploads/profiles/${uploadedFile.filename}`;
    
    const result = await withTransaction(async (connection) => {
      return await userModel.updateUserProfileImage(connection, user_id, profileImagePath);
    });
    
    const apiResponse = standardizeApiResponse({
      message: "프로필 이미지가 성공적으로 업로드되었습니다.",
      profile_image_path: profileImagePath,
      ...result
    });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    // 파일 업로드 실패 시 파일 삭제
    if (uploadedFile && uploadedFile.path) {
      try {
        fs.unlinkSync(uploadedFile.path);
      } catch (unlinkErr) {
        console.error("Failed to delete uploaded file:", unlinkErr);
      }
    }
    next(err);
  }
}

// =========================
// ⭐ Phase 2: 중요 기능 (레벨 & 기본 뱃지)
// =========================

/**
 * 사용자 레벨 정보 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserLevelController = createReadController(
  userModel.getUserLevel,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      return [user_id];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;

        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_user_level'
  }
);

/**
 * 사용자 경험치 추가 컨트롤러 - ServiceFactory 패턴 적용
 */
const addUserExperienceController = createController(
  userModel.addUserExperience,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { points, exp_type = "manual", reason } = req.body;
      return [user_id, points, exp_type, reason];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { points } = req.body;

        if (!user_id || points === undefined) {
          const err = new Error("User ID and experience points are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }

        if (typeof points !== 'number' || points < 0 || points > 10000) {
          const err = new Error("Experience points must be a number between 0 and 10000.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'add_user_experience'
  }
);

/**
 * 사용자 뱃지 목록 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserBadgesController = createReadController(
  userModel.getUserBadges,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      return [user_id];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;

        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_user_badges'
  }
);

/**
 * 뱃지 착용/해제 컨트롤러 - ServiceFactory 패턴 적용
 */
const toggleUserBadgeController = createController(
  userModel.toggleUserBadge,
  {
    dataExtractor: (req) => {
      const { user_id, badge_id } = req.params;
      const { is_equipped } = req.body;
      return [user_id, badge_id, is_equipped];
    },
    validations: [
      (req) => {
        const { user_id, badge_id } = req.params;
        const { is_equipped } = req.body;

        if (!user_id || !badge_id || is_equipped === undefined) {
          const err = new Error("User ID, badge ID, and is_equipped status are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'toggle_user_badge'
  }
);

// =========================
// 🎨 Phase 3: 부가 기능 (프로필 꾸미기 & 다국어)
// =========================

/**
 * 프로필 꾸미기 설정 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserCustomizationController = createReadController(
  userModel.getUserCustomization,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      return [user_id];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;

        if (!user_id) {
          const err = new Error("User ID is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_user_customization'
  }
);

/**
 * 프로필 꾸미기 설정 업데이트 컨트롤러 - ServiceFactory 패턴 적용
 */
const updateUserCustomizationController = createUpdateController(
  userModel.updateUserCustomization,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const customizationData = req.body;
      return [user_id, customizationData];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const customizationData = req.body;

        if (!user_id || !customizationData || Object.keys(customizationData).length === 0) {
          const err = new Error("User ID and customization data are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'update_user_customization'
  }
);

/**
 * 번역 리소스 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getTranslationResourcesController = createReadController(
  userModel.getTranslationResources,
  {
    dataExtractor: (req) => {
      const { lang } = req.params;
      const { category } = req.query;
      return [lang, category];
    },
    validations: [
      (req) => {
        const { lang } = req.params;

        if (!lang) {
          const err = new Error("Language code is required.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_translation_resources'
  }
);

/**
 * 사용자 언어 설정 업데이트 컨트롤러 - ServiceFactory 패턴 적용
 */
const updateUserLanguageController = createUpdateController(
  userModel.updateUserLanguage,
  {
    dataExtractor: (req) => {
      const { user_id } = req.params;
      const { language } = req.body;
      return [user_id, language];
    },
    validations: [
      (req) => {
        const { user_id } = req.params;
        const { language } = req.body;

        if (!user_id || !language) {
          const err = new Error("User ID and language are required.");
          err.code = "INVALID_INPUT";
          throw err;
        }

        const supportedLanguages = ['ko', 'en', 'ja', 'zh'];
        if (!supportedLanguages.includes(language)) {
          const err = new Error(`Unsupported language. Supported: ${supportedLanguages.join(', ')}`);
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'update_user_language'
  }
);

module.exports = {
  // Phase 1: 핵심 기능
  registerUserController,
  loginUserController,
  checkEmailExistsController,
  getUserProfileController,
  updateUserProfileController,
  deleteUserController,
  getUserSettingsController,
  updateUserSettingsController,
  uploadProfileImageController,
  
  // Phase 2: 중요 기능
  getUserLevelController,
  addUserExperienceController,
  getUserBadgesController,
  toggleUserBadgeController,
  
  // Phase 3: 부가 기능
  getUserCustomizationController,
  updateUserCustomizationController,
  getTranslationResourcesController,
  updateUserLanguageController,
};
