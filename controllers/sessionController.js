const { createChatSession, getUserChatSessions, updateChatSession, getSessionMessages, deleteChatSession } = require('../models/session');

// 새 채팅 세션 생성 컨트롤러
async function createSessionController(req, res) {
  const { userId, title, category } = req.body;
  
  if (!userId || !title) {
    return res.status(400).json({ error: '사용자 ID와 제목은 필수 입력사항입니다.' });
  }
  
  try {
    const session = await createChatSession(userId, title, category);
    res.status(201).json(session);
  } catch (err) {
    console.error('세션 생성 컨트롤러 오류:', err);
    res.status(500).json({ error: `세션 생성 중 오류 발생: ${err.message}` });
  }
}

// 사용자의 채팅 세션 목록 조회 컨트롤러
async function getUserSessionsController(req, res) {
  const requestedUserId = req.params.user_id;
  const authenticatedUserId = req.user.userId; // JWT 미들웨어에서 추가된 사용자 ID

  // 인가 확인: 요청된 user_id와 인증된 user_id가 동일한지 확인
  if (requestedUserId !== authenticatedUserId) {
    return res.status(403).json({ error: '자신의 채팅 세션 목록만 조회할 수 있습니다.' }); // Forbidden
  }

  try {
    const sessions = await getUserChatSessions(authenticatedUserId);
    res.json({ sessions });
  } catch (err) {
    console.error('세션 목록 조회 컨트롤러 오류:', err);
    res.status(500).json({ error: `세션 목록 조회 중 오류 발생: ${err.message}` });
  }
}

// 세션 정보 수정 컨트롤러
async function updateSessionController(req, res) {
  const sessionId = req.params.session_id;
  const { title, category, is_archived } = req.body;
  
  if (!title && category === undefined && is_archived === undefined) {
    return res.status(400).json({ error: '수정할 필드가 지정되지 않았습니다.' });
  }
  
  try {
    const session = await updateChatSession(sessionId, { title, category, is_archived });
    res.json(session);
  } catch (err) {
    console.error('세션 수정 컨트롤러 오류:', err);
    res.status(500).json({ error: `세션 수정 중 오류 발생: ${err.message}` });
  }
}

// 세션 메시지 목록 조회 컨트롤러
async function getSessionMessagesController(req, res) {
  const sessionId = req.params.session_id;
  
  try {
    const messages = await getSessionMessages(sessionId);
    res.json({ messages });
  } catch (err) {
    console.error('메시지 목록 조회 컨트롤러 오류:', err);
    res.status(500).json({ error: `메시지 목록 조회 중 오류 발생: ${err.message}` });
  }
}

// 세션 삭제 컨트롤러
async function deleteSessionController(req, res) {
  const sessionId = req.params.session_id;
  const userId = req.user.userId; // JWT 미들웨어에서 추가된 사용자 ID

  if (!userId) {
    return res.status(401).json({ error: '인증되지 않은 사용자입니다.' });
  }

  try {
    const deletedCount = await deleteChatSession(sessionId, userId);
    
    if (deletedCount === 0) {
      // 세션이 없거나, 사용자가 해당 세션의 소유자가 아님
      return res.status(404).json({ error: '삭제할 세션을 찾을 수 없거나 권한이 없습니다.' });
    }
    
    res.status(200).json({ message: '채팅 세션이 성공적으로 삭제되었습니다.' });
  } catch (err) {
    console.error('세션 삭제 컨트롤러 오류:', err);
    res.status(500).json({ error: `세션 삭제 중 오류 발생: ${err.message}` });
  }
}

module.exports = {
  createSessionController,
  getUserSessionsController,
  updateSessionController,
  getSessionMessagesController,
  deleteSessionController
};