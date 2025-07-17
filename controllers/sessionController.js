const {
  createController,
  createCreateService,
  createReadService,
  createUpdateService,
  createDeleteService
} = require("../utils/serviceFactory");
const sessionService = require("../services/sessionService");
const { standardizeApiResponse } = require("../utils/apiResponse");

// =========================
// 📝 채팅 세션 관리 (Session Management)
// =========================

/**
 * 새 채팅 세션 생성 컨트롤러 - ServiceFactory 패턴 적용
 */
const createSessionController = createController(
  sessionService.createSessionService,
  {
    dataExtractor: (req) => {
      const { user_id, title, category } = req.body;
      return [user_id, title, category];
    },
    validations: [
      (req) => {
        const { user_id, title, category } = req.body;
        
        // 사용자 ID 유효성 검사
        if (!user_id || typeof user_id !== "string" || user_id.trim() === "" || user_id.length > 36) {
          const err = new Error("사용자 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 제목 유효성 검사
        if (!title || typeof title !== "string" || title.trim() === "" || title.length > 100) {
          const err = new Error("세션 제목은 필수이며 최대 100자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 카테고리 유효성 검사
        if (category && (typeof category !== "string" || category.length > 50)) {
          const err = new Error("카테고리는 문자열이어야 하며 최대 50자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successStatusCode: 201 // Created
  }
);

/**
 * 사용자의 채팅 세션 목록 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getUserSessionsController = createController(
  sessionService.getUserSessionsService,
  {
    dataExtractor: (req) => {
      const { user_id: requestedUserId } = req.params;
      return [requestedUserId];
    },
    validations: [
      (req) => {
        const { user_id: requestedUserId } = req.params;
        
        if (!requestedUserId || typeof requestedUserId !== "string" || requestedUserId.trim() === "" || requestedUserId.length > 36) {
          const err = new Error("경로 매개변수의 사용자 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ]
  }
);

/**
 * 세션 정보 수정 컨트롤러 - ServiceFactory 패턴 적용
 */
const updateSessionController = createController(
  sessionService.updateSessionService,
  {
    dataExtractor: (req) => {
      const { session_id: sessionId } = req.params;
      const updates = req.body;
      return [sessionId, updates];
    },
    validations: [
      (req) => {
        const { session_id: sessionId } = req.params;
        const updates = req.body;
        
        // 세션 ID 유효성 검사
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "" || sessionId.length > 36) {
          const err = new Error("경로 매개변수의 세션 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 업데이트 데이터 유효성 검사
        if (Object.keys(updates).length === 0 || (updates.title === undefined && updates.category === undefined && updates.is_archived === undefined)) {
          const err = new Error("수정할 항목(제목, 카테고리, 보관 여부) 중 하나 이상이 필요합니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 제목 유효성 검사
        if (updates.title !== undefined && (typeof updates.title !== "string" || updates.title.trim() === "" || updates.title.length > 100)) {
          const err = new Error("세션 제목은 비어있지 않은 문자열이어야 하며 최대 100자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 카테고리 유효성 검사
        if (updates.category !== undefined && (typeof updates.category !== "string" || updates.category.length > 50)) {
          const err = new Error("카테고리는 문자열이어야 하며 최대 50자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 보관 여부 유효성 검사
        if (updates.is_archived !== undefined && typeof updates.is_archived !== "boolean") {
          const err = new Error("보관 여부는 boolean 값이어야 합니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ]
  }
);

/**
 * 세션 메시지 목록 조회 컨트롤러 - ServiceFactory 패턴 적용
 */
const getSessionMessagesController = createController(
  sessionService.getSessionMessagesService,
  {
    dataExtractor: (req) => {
      const { session_id: sessionId } = req.params;
      return [sessionId];
    },
    validations: [
      (req) => {
        const { session_id: sessionId } = req.params;
        
        // 'undefined', 'null' 문자열 명시적 체크 추가
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "" || 
            sessionId === 'undefined' || sessionId === 'null' || sessionId.length > 36) {
          const err = new Error("세션 ID가 제공되지 않았습니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ]
  }
);

/**
 * 세션 삭제 컨트롤러 - ServiceFactory 패턴 적용
 */
const deleteSessionController = createController(
  sessionService.deleteSessionService,
  {
    dataExtractor: (req) => {
      const { session_id: sessionId } = req.params;
      const { user_id } = req.body;
      return [sessionId, user_id];
    },
    validations: [
      (req) => {
        const { session_id: sessionId } = req.params;
        const { user_id } = req.body;
        
        // 세션 ID 유효성 검사
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "" || sessionId.length > 36) {
          const err = new Error("경로 매개변수의 세션 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        // 사용자 ID 유효성 검사
        if (!user_id || typeof user_id !== "string" || user_id.trim() === "" || user_id.length > 36) {
          const err = new Error("요청 본문의 사용자 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ]
  }
);

/**
 * 관리자용 전체 세션 조회 컨트롤러
 */
async function getAllSessionsForAdminController(req, res, next) {
  try {
    // 관리자 권한 확인을 위한 user_id 가져오기
    const requesting_user_id = req.body.user_id;
    
    if (!requesting_user_id) {
      const err = new Error("관리자 권한 확인을 위해 user_id가 필요합니다.");
      err.code = "UNAUTHORIZED";
      throw err;
    }

    // 관리자 권한 확인
    const userModel = require("../models/user");
    const { withTransaction } = require("../utils/dbUtils");
    
    const isAdmin = await withTransaction(async (connection) => {
      return await userModel.isUserAdmin(connection, requesting_user_id);
    });

    if (!isAdmin) {
      const err = new Error("관리자 권한이 필요합니다.");
      err.code = "FORBIDDEN";
      throw err;
    }

    const {
      filter_user_id,
      include_empty,
      limit = 50,
      offset = 0
    } = req.body;

    console.log('[DEBUG] 관리자 세션 조회 요청:', { 
      requesting_user_id, 
      filter_user_id, 
      include_empty, 
      limit, 
      offset,
      include_empty_type: typeof include_empty
    });

    // 입력값 검증
    if (filter_user_id && (typeof filter_user_id !== "string" || filter_user_id.trim() === "" || filter_user_id.length > 36)) {
      const err = new Error("필터링할 사용자 ID는 문자열이어야 하며 최대 36자입니다.");
      err.code = "INVALID_INPUT";
      throw err;
    }

    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      const err = new Error("limit은 1-100 사이의 숫자여야 합니다.");
      err.code = "INVALID_INPUT";
      throw err;
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      const err = new Error("offset은 0 이상의 숫자여야 합니다.");
      err.code = "INVALID_INPUT";
      throw err;
    }

    const options = {
      user_id: filter_user_id,
      include_empty: include_empty === true || include_empty === 'true',
      limit: limitNum,
      offset: offsetNum
    };

    console.log('[DEBUG] 서비스 호출 옵션:', options);

    const result = await sessionService.getAllSessionsForAdminService(options);
    
    console.log('[DEBUG] 서비스 결과:', {
      session_count: result.sessions ? result.sessions.length : 0,
      total_count: result.pagination ? result.pagination.total_count : 0
    });
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSessionController,
  getUserSessionsController,
  updateSessionController,
  getSessionMessagesController,
  deleteSessionController,
  getAllSessionsForAdminController,
};
