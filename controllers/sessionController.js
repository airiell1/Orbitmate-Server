const { createChatSession, getUserChatSessions, updateChatSession, getSessionMessages, deleteChatSession } = require('../models/session');
const { standardizeApiResponse } = require('../utils/apiResponse'); // Import standardizeApiResponse

// 새 채팅 세션 생성 컨트롤러
async function createSessionController(req, res) { // todo: 인자 3개로 수정하기
  
  const { user_id, title, category } = req.body;
  
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
    console.error('Error in createSessionController: User ID is required and must be a non-empty string.');
    return res.status(400).json(standardizeApiResponse({ error_message: '사용자 ID는 필수이며 빈 문자열이 아니어야 합니다.' }));
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    console.error('Error in createSessionController: Title is required and must be a non-empty string.');
    return res.status(400).json(standardizeApiResponse({ error_message: '세션 제목은 필수이며 빈 문자열이 아니어야 합니다.' }));
  }
  if (category && typeof category !== 'string') {
    console.error('Error in createSessionController: Category must be a string if provided.');
    return res.status(400).json(standardizeApiResponse({ error_message: '카테고리는 문자열이어야 합니다.' }));
  }
  
  try {
    const session = await createChatSession(user_id, title, category);
    if (!session || !session.session_id) {
        console.error('Error in createSessionController: Failed to create session.');
        return res.status(500).json(standardizeApiResponse({ error_message: '세션 생성에 실패했습니다.' }));
    }
    res.status(201).json(standardizeApiResponse(session));
  } catch (err) {
    console.error(`Error in createSessionController for user ${user_id}:`, err);
    res.status(500).json(standardizeApiResponse({ error_message: `세션 생성 중 오류 발생: ${err.message}` }));
  }
}

// 사용자의 채팅 세션 목록 조회 컨트롤러
async function getUserSessionsController(req, res) {
  const requestedUserId = req.params.user_id;
  // const authenticatedUserId = req.user.user_id; // README.AI에 따라 인증/인가 최소화

  if (!requestedUserId) {
    console.error('Error in getUserSessionsController: User ID is required in params.');
    return res.status(400).json(standardizeApiResponse({ error_message: '경로 매개변수에 사용자 ID가 필요합니다.' }));
  }

  // README.AI 요청: 인증/보안 기능 최소화. 아래 인가 로직은 주석 처리.
  /*
  if (requestedUserId !== authenticatedUserId) {
    console.warn(`Authorization failed in getUserSessionsController: Requested ${requestedUserId}, Authenticated ${authenticatedUserId}`);
    return res.status(403).json({ error: '자신의 세션 목록만 조회할 수 있습니다.' });
  }
  */

  try {
    const sessions = await getUserChatSessions(requestedUserId);
    if (!sessions) {
        // getUserChatSessions가 오류 없이 빈 배열을 반환할 수 있으므로, null 체크는 모델 함수 구현에 따라 달라짐
        // 여기서는 일단 그대로 두고, 필요시 모델 함수에서 오류를 throw 하거나 여기서 빈 배열을 정상 응답으로 처리
        console.warn(`Warning in getUserSessionsController: No sessions found for user ${requestedUserId}, or an issue occurred.`);
    }
    res.status(200).json(standardizeApiResponse(sessions));
  } catch (err) {
    console.error(`Error in getUserSessionsController for user ${requestedUserId}:`, err);
    res.status(500).json(standardizeApiResponse({ error_message: `세션 목록 조회 중 오류 발생: ${err.message}` }));
  }
}

// 세션 정보 수정 컨트롤러
async function updateSessionController(req, res) {
  const sessionId = req.params.session_id;
  const { title, category, is_archived } = req.body;
  
  if (!sessionId) {
    console.error('Error in updateSessionController: Session ID is required in params.');
    return res.status(400).json(standardizeApiResponse({ error_message: '경로 매개변수에 세션 ID가 필요합니다.' }));
  }
  if (!title && category === undefined && is_archived === undefined) {
    console.error('Error in updateSessionController: At least one field to update is required (title, category, or is_archived).');
    return res.status(400).json(standardizeApiResponse({ error_message: '수정할 항목(제목, 카테고리, 보관 여부) 중 하나 이상이 필요합니다.' }));
  }
  if (title && (typeof title !== 'string' || title.trim() === '')) {
    console.error('Error in updateSessionController: Title must be a non-empty string if provided.');
    return res.status(400).json(standardizeApiResponse({ error_message: '제목은 빈 문자열이 아니어야 합니다.' }));
  }
  if (category && typeof category !== 'string') {
    console.error('Error in updateSessionController: Category must be a string if provided.');
    return res.status(400).json(standardizeApiResponse({ error_message: '카테고리는 문자열이어야 합니다.' }));
  }
  if (is_archived !== undefined && typeof is_archived !== 'boolean') {
    console.error('Error in updateSessionController: is_archived must be a boolean if provided.');
    return res.status(400).json(standardizeApiResponse({ error_message: '보관 여부는 boolean 값이어야 합니다.' }));
  }
  
  try {
    // README.AI 요청: 인증/보안 기능 최소화. 세션 소유권 확인 로직은 모델에서 처리하거나 생략.
    const updatedSession = await updateChatSession(sessionId, { title, category, is_archived });
    if (!updatedSession) {
      console.warn(`Warning in updateSessionController: Session with ID ${sessionId} not found or not updated.`);
      return res.status(404).json(standardizeApiResponse({ error_message: '세션을 찾을 수 없거나 업데이트되지 않았습니다.' }));
    }
    res.status(200).json(standardizeApiResponse(updatedSession));
  } catch (err) {
    console.error(`Error in updateSessionController for session ${sessionId}:`, err);
    res.status(500).json(standardizeApiResponse({ error_message: `세션 수정 중 오류 발생: ${err.message}` }));
  }
}

// 세션 메시지 목록 조회 컨트롤러
async function getSessionMessagesController(req, res) {
  const sessionId = req.params.session_id;
  
  if (!sessionId) {
    console.error('Error in getSessionMessagesController: Session ID is required in params.');
    return res.status(400).json(standardizeApiResponse({ error_message: '경로 매개변수에 세션 ID가 필요합니다.' }));
  }
  
  try {
    // README.AI 요청: 인증/보안 기능 최소화. 세션 접근 권한 확인 로직은 모델에서 처리하거나 생략.
    const messages = await getSessionMessages(sessionId);
    // messages가 null 또는 빈 배열일 수 있음, 이는 정상적인 상황일 수 있음 (메시지가 없는 세션)
    res.status(200).json(standardizeApiResponse(messages));
  } catch (err) {
    console.error(`Error in getSessionMessagesController for session ${sessionId}:`, err);
    res.status(500).json(standardizeApiResponse({ error_message: `메시지 목록 조회 중 오류 발생: ${err.message}` }));
  }
}

// 세션 삭제 컨트롤러
async function deleteSessionController(req, res) {
  const sessionId = req.params.session_id;
  const { user_id } = req.body; // 요청 본문에서 user_id를 가져옵니다.

  if (!sessionId) {
    console.error('Error in deleteSessionController: Session ID is required in params.');
    return res.status(400).json(standardizeApiResponse({ error_message: '경로 매개변수에 세션 ID가 필요합니다.' }));
  }

  if (!user_id) {
    console.error('Error in deleteSessionController: User ID is required in the request body.');
    return res.status(400).json(standardizeApiResponse({ error_message: '요청 본문에 사용자 ID(user_id)가 필요합니다.' }));
  }

  try {
    const deleted = await deleteChatSession(sessionId, user_id);
    if (!deleted) {
      console.warn(`Warning in deleteSessionController: Session with ID ${sessionId} for user ${user_id} not found or not deleted.`);
      return res.status(404).json(standardizeApiResponse({ error_message: '세션을 찾을 수 없거나 삭제할 수 없습니다. 세션 ID 또는 사용자 ID를 확인해주세요.' }));
    }
    res.status(200).json(standardizeApiResponse({ message: '세션이 성공적으로 삭제되었습니다.' }));
  } catch (err) {
    console.error(`Error in deleteSessionController for session ${sessionId}, user ${user_id}:`, err);
    res.status(500).json(standardizeApiResponse({ error_message: `세션 삭제 중 오류 발생: ${err.message}` }));
  }
}

module.exports = {
  createSessionController,
  getUserSessionsController,
  updateSessionController,
  getSessionMessagesController,
  deleteSessionController
};