const sessionService = require("../services/sessionService"); // 서비스 계층 사용
const { standardizeApiResponse } = require("../utils/apiResponse");
// const { withTransaction } = require("../utils/dbUtils"); // 컨트롤러에서 직접 사용 안 함

// 새 채팅 세션 생성 컨트롤러
async function createSessionController(req, res, next) {
  const { user_id, title, category } = req.body;

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
    const session = await sessionService.createSessionService(user_id, title, category);
    // 서비스에서 에러 throw 또는 정상 객체 반환
    const apiResponse = standardizeApiResponse(session);
    res.status(201).json(apiResponse.body); // 201 Created
  } catch (err) {
    next(err);
  }
}

// 사용자의 채팅 세션 목록 조회 컨트롤러
async function getUserSessionsController(req, res, next) {
  const { user_id: requestedUserId } = req.params;

  if (!requestedUserId || typeof requestedUserId !== "string" || requestedUserId.trim() === "" || requestedUserId.length > 36) {
    const err = new Error("경로 매개변수의 사용자 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // 인증 로직은 미들웨어에서 처리하거나, 서비스 계층에서 req.user와 requestedUserId 비교 가능
  try {
    const sessions = await sessionService.getUserSessionsService(requestedUserId);
    const apiResponse = standardizeApiResponse(sessions);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 세션 정보 수정 컨트롤러
async function updateSessionController(req, res, next) {
  const { session_id: sessionId } = req.params;
  const updates = req.body;

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
  // 필드별 상세 유효성 검사
  if (updates.title !== undefined && (typeof updates.title !== "string" || updates.title.trim() === "" || updates.title.length > 100)) {
     const err = new Error("세션 제목은 비어있지 않은 문자열이어야 하며 최대 100자입니다.");
     err.code = "INVALID_INPUT"; return next(err);
  }
  if (updates.category !== undefined && (typeof updates.category !== "string" || updates.category.length > 50)) {
     const err = new Error("카테고리는 문자열이어야 하며 최대 50자입니다.");
     err.code = "INVALID_INPUT"; return next(err);
  }
   if (updates.is_archived !== undefined && typeof updates.is_archived !== "boolean") {
     const err = new Error("보관 여부는 boolean 값이어야 합니다.");
     err.code = "INVALID_INPUT"; return next(err);
  }
  // 세션 소유권 확인 등은 서비스 계층 또는 미들웨어에서 처리
  try {
    const updatedSession = await sessionService.updateSessionService(sessionId, updates);
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
    const messages = await sessionService.getSessionMessagesService(sessionId);
    const apiResponse = standardizeApiResponse(messages);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

// 세션 삭제 컨트롤러
async function deleteSessionController(req, res, next) {
  const { session_id: sessionId } = req.params;
  const { user_id } = req.body; // 또는 req.user.user_id (인증된 사용자)

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
  // 세션 소유권 확인 등은 서비스 계층 또는 미들웨어에서 처리
  try {
    const result = await sessionService.deleteSessionService(sessionId, user_id);
    // 서비스에서 SESSION_NOT_FOUND 에러를 throw 하거나, 성공 메시지를 담은 객체를 반환
    const apiResponse = standardizeApiResponse(result); // result가 { message: "..." } 형태일 것으로 예상
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
