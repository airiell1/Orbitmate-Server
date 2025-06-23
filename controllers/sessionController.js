const sessionModel = require("../models/session");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { withTransaction } = require("../utils/dbUtils");
// createErrorResponse, getHttpStatusByErrorCode, logError 등은 next(err)를 통해 중앙 처리

// 새 채팅 세션 생성 컨트롤러
async function createSessionController(req, res, next) {
  const { user_id, title, category } = req.body;

  // Validation (간단하게 유지, 필요시 express-validator 등 사용)
  if (!user_id || typeof user_id !== "string" || user_id.trim() === "" || user_id.length > 36) {
    const err = new Error("사용자 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!title || typeof title !== "string" || title.trim() === "" || title.length > 100) {
    const err = new Error("세션 제목은 필수이며 최대 100자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (category && (typeof category !== "string" || category.length > 50)) {
    const err = new Error("카테고리는 문자열이어야 하며 최대 50자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    const session = await withTransaction(async (connection) => {
      return await sessionModel.createChatSession(connection, user_id, title, category);
    });
    // 모델에서 session_id가 없는 경우 에러를 throw하도록 수정되었으므로, 여기서 null 체크는 불필요할 수 있음
    // 하지만 방어적으로 체크
    if (!session || !session.session_id) {
        const err = new Error("세션 생성에 실패했습니다 (모델 반환 값 오류).");
        err.code = "SERVER_ERROR"; // 또는 DB_ERROR
        return next(err);
    }
    const apiResponse = standardizeApiResponse(session);
    res.status(201).json(apiResponse.body); // 201 Created
  } catch (err) {
    next(err);
  }
}

// 사용자의 채팅 세션 목록 조회 컨트롤러
async function getUserSessionsController(req, res, next) {
  const { user_id: requestedUserId } = req.params; // 경로 파라미터에서 user_id 가져옴

  if (!requestedUserId || typeof requestedUserId !== "string" || requestedUserId.trim() === "" || requestedUserId.length > 36) {
    const err = new Error("경로 매개변수의 사용자 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  // README.AI 요청: 인증/보안 기능 최소화.
  // 실제 운영 시에는 req.user.user_id (인증된 사용자)와 requestedUserId를 비교하는 인가 로직 필요.
  // if (req.user.user_id !== requestedUserId) {
  //   const err = new Error("자신의 세션 목록만 조회할 수 있습니다.");
  //   err.code = "FORBIDDEN";
  //   return next(err);
  // }

  try {
    const sessions = await withTransaction(async (connection) => { // 읽기 전용이지만 일관성을 위해
      return await sessionModel.getUserChatSessions(connection, requestedUserId);
    });
    const apiResponse = standardizeApiResponse(sessions);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 세션 정보 수정 컨트롤러
async function updateSessionController(req, res, next) {
  const { session_id: sessionId } = req.params; // 경로 파라미터에서 session_id 가져옴
  const updates = req.body; // { title, category, is_archived }

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "" || sessionId.length > 36) {
    const err = new Error("경로 매개변수의 세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (Object.keys(updates).length === 0 || (updates.title === undefined && updates.category === undefined && updates.is_archived === undefined)) {
    const err = new Error("수정할 항목(제목, 카테고리, 보관 여부) 중 하나 이상이 필요합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // 각 필드 상세 유효성 검사는 모델 또는 서비스 레이어에서 처리하거나, 여기서 추가 가능
  if (updates.title !== undefined && (typeof updates.title !== "string" || updates.title.trim() === "" || updates.title.length > 100)) {
     const err = new Error("세션 제목은 비어있지 않은 문자열이어야 하며 최대 100자입니다.");
     err.code = "INVALID_INPUT";
     return next(err);
  }
  if (updates.category !== undefined && (typeof updates.category !== "string" || updates.category.length > 50)) {
     const err = new Error("카테고리는 문자열이어야 하며 최대 50자입니다.");
     err.code = "INVALID_INPUT";
     return next(err);
  }
   if (updates.is_archived !== undefined && typeof updates.is_archived !== "boolean") {
     const err = new Error("보관 여부는 boolean 값이어야 합니다.");
     err.code = "INVALID_INPUT";
     return next(err);
  }

  try {
    // README.AI 요청: 인증/보안 기능 최소화. 세션 소유권 확인은 모델에서 처리하거나 생략.
    // 실제로는 이 세션이 현재 로그인한 사용자의 것인지 확인하는 로직이 필요.
    const updatedSession = await withTransaction(async (connection) => {
      return await sessionModel.updateChatSession(connection, sessionId, updates);
    });
     // 모델에서 SESSION_NOT_FOUND 에러를 throw하면 여기서 잡힘
    const apiResponse = standardizeApiResponse(updatedSession);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 세션 메시지 목록 조회 컨트롤러
async function getSessionMessagesController(req, res, next) {
  const { session_id: sessionId } = req.params;

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "" || sessionId.length > 36) {
    const err = new Error("경로 매개변수의 세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    // README.AI 요청: 인증/보안 기능 최소화.
    const messages = await withTransaction(async (connection) => { // 읽기 전용이지만 일관성 위해
        return await sessionModel.getSessionMessages(connection, sessionId);
    });
    const apiResponse = standardizeApiResponse(messages);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 세션 삭제 컨트롤러
async function deleteSessionController(req, res, next) {
  const { session_id: sessionId } = req.params;
  // user_id는 요청 본문에서 가져오거나, 인증된 사용자 정보(req.user.user_id)를 사용해야 함.
  // MVP에서는 요청 본문에서 받는 것으로 가정.
  const { user_id } = req.body;


  if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "" || sessionId.length > 36) {
    const err = new Error("경로 매개변수의 세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!user_id || typeof user_id !== "string" || user_id.trim() === "" || user_id.length > 36) {
    const err = new Error("요청 본문의 사용자 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // 실제 운영 시에는 req.user.user_id와 비교하여 본인 세션만 삭제 가능하도록 해야 함.

  try {
    const deletedCount = await withTransaction(async (connection) => {
      return await sessionModel.deleteChatSession(connection, sessionId, user_id);
    });

    if (deletedCount === 0) {
      const err = new Error("세션을 찾을 수 없거나 삭제할 권한이 없습니다.");
      err.code = "SESSION_NOT_FOUND"; // 또는 FORBIDDEN
      return next(err);
    }
    // 성공 시 200 OK와 메시지 또는 204 No Content
    const apiResponse = standardizeApiResponse({ message: "세션이 성공적으로 삭제되었습니다." });
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSessionController,
  getUserSessionsController,
  updateSessionController,
  getSessionMessagesController,
  deleteSessionController,
};
