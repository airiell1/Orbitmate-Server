/**
 * 관리자 권한 미들웨어
 * @description 관리자 권한이 필요한 API 엔드포인트에 사용
 */

const { withTransaction } = require("../utils/dbUtils");
const userModel = require("../models/user");
const { standardizeApiResponse } = require("../utils/apiResponse");

/**
 * 관리자 권한 확인 미들웨어
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function requireAdminPermission(req, res, next) {
  try {
    // 현재 사용자 ID 가져오기
    const current_user_id = req.user?.user_id || req.body?.user_id || req.query?.user_id;
    
    if (!current_user_id) {
      const error = new Error("인증이 필요합니다.");
      error.code = "UNAUTHORIZED";
      throw error;
    }

    // 관리자 권한 확인
    const isAdmin = await withTransaction(async (connection) => {
      return await userModel.isUserAdmin(connection, current_user_id);
    });

    if (!isAdmin) {
      const error = new Error("관리자 권한이 필요합니다.");
      error.code = "FORBIDDEN";
      throw error;
    }

    // 관리자 권한이 있으면 다음 미들웨어로 진행
    next();

  } catch (error) {
    if (error.code === "UNAUTHORIZED") {
      const apiResponse = standardizeApiResponse(null, {
        code: "UNAUTHORIZED",
        message: "인증이 필요합니다.",
        details: "관리자 권한 확인을 위해 사용자 인증이 필요합니다."
      });
      return res.status(apiResponse.statusCode).json(apiResponse.body);
    }

    if (error.code === "FORBIDDEN") {
      const apiResponse = standardizeApiResponse(null, {
        code: "FORBIDDEN", 
        message: "관리자 권한이 필요합니다.",
        details: "이 작업을 수행하려면 관리자 권한이 필요합니다."
      });
      return res.status(apiResponse.statusCode).json(apiResponse.body);
    }

    // 기타 에러는 next로 전달
    next(error);
  }
}

/**
 * 자기 자신 또는 관리자 권한 확인 미들웨어
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function requireSelfOrAdminPermission(req, res, next) {
  try {
    // 현재 사용자 ID와 요청 대상 사용자 ID
    const current_user_id = req.user?.user_id || req.body?.user_id || req.query?.user_id;
    const target_user_id = req.params.user_id;
    
    if (!current_user_id) {
      const error = new Error("인증이 필요합니다.");
      error.code = "UNAUTHORIZED";
      throw error;
    }

    if (!target_user_id) {
      const error = new Error("대상 사용자 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    // 자기 자신인 경우 허용
    if (current_user_id === target_user_id) {
      return next();
    }

    // 관리자 권한 확인
    const isAdmin = await withTransaction(async (connection) => {
      return await userModel.isUserAdmin(connection, current_user_id);
    });

    if (!isAdmin) {
      const error = new Error("자신의 정보이거나 관리자 권한이 필요합니다.");
      error.code = "FORBIDDEN";
      throw error;
    }

    // 관리자 권한이 있으면 다음 미들웨어로 진행
    next();

  } catch (error) {
    if (error.code === "UNAUTHORIZED") {
      const apiResponse = standardizeApiResponse(null, {
        code: "UNAUTHORIZED",
        message: "인증이 필요합니다.",
        details: "권한 확인을 위해 사용자 인증이 필요합니다."
      });
      return res.status(apiResponse.statusCode).json(apiResponse.body);
    }

    if (error.code === "FORBIDDEN") {
      const apiResponse = standardizeApiResponse(null, {
        code: "FORBIDDEN", 
        message: "자신의 정보이거나 관리자 권한이 필요합니다.",
        details: "이 작업을 수행하려면 본인이거나 관리자 권한이 필요합니다."
      });
      return res.status(apiResponse.statusCode).json(apiResponse.body);
    }

    // 기타 에러는 next로 전달
    next(error);
  }
}

module.exports = {
  requireAdminPermission,
  requireSelfOrAdminPermission
};
