const sessionModel = require("../models/session");
const { withTransaction } = require("../utils/dbUtils"); // DB 트랜잭션 유틸리티
const config = require("../config"); // NODE_ENV 등 설정값

/**
 * 새 채팅 세션 생성 서비스
 * @param {string} userId - 사용자 ID
 * @param {string} title - 세션 제목
 * @param {string|null} category - 세션 카테고리
 * @returns {Promise<Object>} 생성된 세션 정보
 */
async function createSessionService(userId, title, category) {
  // 입력값 유효성 검사는 컨트롤러에서 이미 수행되었다고 가정
  
  return await withTransaction(async (connection) => {
    // 모델 함수는 connection을 첫 번째 인자로 받음
    const session = await sessionModel.createChatSession(connection, userId, title, category);

    // 모델에서 반환된 session 객체에 session_id가 없다면 에러로 간주할 수 있으나,
    // 현재 모델은 RETURNING 절을 통해 session_id를 확실히 반환하므로 추가 검증은 생략 가능.
    // 만약 session 생성 후 추가적인 비즈니스 로직 (예: 기본 메시지 생성, 알림 발송 등)이 있다면 여기서 수행.
    // 예: if (config.nodeEnv !== 'test' || userId !== 'API_TEST_USER_ID') { /* 일반 사용자 세션 생성 후 추가 작업 */ }
    return session;
  });
}

/**
 * 특정 사용자의 모든 채팅 세션 목록 조회 서비스
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} 세션 목록
 */
async function getUserSessionsService(userId) {
  return await withTransaction(async (connection) => {
    // 이 작업은 읽기 전용이지만, 일관성 및 향후 확장성을 위해 withTransaction 사용
    const sessions = await sessionModel.getUserChatSessions(connection, userId);
    // 여기서 데이터를 추가 가공하거나 필터링하는 등의 비즈니스 로직 수행 가능
    return sessions;
  });
}

/**
 * 채팅 세션 정보 업데이트 서비스
 * @param {string} sessionId - 세션 ID
 * @param {Object} updates - 업데이트할 정보 { title, category, is_archived }
 * @returns {Promise<Object>} 업데이트된 세션 정보
 */
async function updateSessionService(sessionId, updates) {
  // 컨트롤러에서 기본적인 입력값 유효성 검사는 수행되었다고 가정
  // (예: updates 객체가 비어있지 않은지, 각 필드의 타입 등)
  return await withTransaction(async (connection) => {
    // 모델 함수는 SESSION_NOT_FOUND 에러를 throw 할 수 있음
    const updatedSession = await sessionModel.updateChatSession(connection, sessionId, updates);
    // 업데이트 후 추가적인 로직 (예: 관련 사용자에게 알림)이 있다면 여기서 수행
    return updatedSession;
  });
}

/**
 * 특정 세션의 모든 메시지 목록 조회 서비스
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<Array>} 메시지 목록
 */
async function getSessionMessagesService(sessionId) {
  return await withTransaction(async (connection) => {
    const messages = await sessionModel.getSessionMessages(connection, sessionId);
    // 여기서 메시지 내용을 가공하거나, 특정 사용자에게만 보이는 필드를 추가/제거하는 등의 로직 가능
    return messages;
  });
}

/**
 * 채팅 세션 삭제 서비스
 * @param {string} sessionId - 삭제할 세션 ID
 * @param {string} userId - 요청한 사용자 ID (세션 소유권 확인용)
 * @returns {Promise<number>} 삭제된 세션의 수 (0 또는 1)
 */
async function deleteSessionService(sessionId, userId) {
  // 컨트롤러에서 sessionId와 userId가 제공되었는지 확인했다고 가정
  return await withTransaction(async (connection) => {
    // 디버깅: 삭제 시도 전 세션과 사용자 정보 로깅
    console.log('🔍 [DEBUG] 세션 삭제 시도:', {
      sessionId: sessionId,
      requestingUserId: userId
    });

    // 먼저 세션이 존재하는지, 실제 소유자가 누구인지 확인
    try {
      const sessionInfo = await sessionModel.getUserIdBySessionId(connection, sessionId);
      console.log('🔍 [DEBUG] 세션 소유자 정보:', {
        sessionId: sessionId,
        actualOwnerId: sessionInfo.user_id,
        requestingUserId: userId,
        isOwner: sessionInfo.user_id === userId
      });
    } catch (checkError) {
      console.log('🔍 [DEBUG] 세션 소유자 확인 실패:', checkError.message);
    }

    // 모델 함수는 내부적으로 chat_messages 삭제 후 chat_sessions 삭제
    // rowsAffected를 반환하며, 0이면 삭제할 세션이 없거나 권한이 없음을 의미 (모델에서 에러 throw 안 함)
    const deletedCount = await sessionModel.deleteChatSession(connection, sessionId, userId);

    console.log('🔍 [DEBUG] 삭제 결과:', {
      sessionId: sessionId,
      userId: userId,
      deletedCount: deletedCount
    });

    if (deletedCount === 0) {
      // 서비스 레벨에서 명시적인 에러를 발생시켜 컨트롤러가 알 수 있도록 함
      const error = new Error("세션을 찾을 수 없거나 삭제할 권한이 없습니다.");
      error.code = "SESSION_NOT_FOUND"; // 또는 FORBIDDEN
      throw error;
    }
    // 삭제 성공 시, 컨트롤러에서 사용할 수 있도록 간단한 성공 메시지나 상태 반환 가능
    // 여기서는 모델의 반환값(삭제된 행 수)을 그대로 전달하거나, 이를 기반으로 boolean 반환도 가능
    return { message: "세션이 성공적으로 삭제되었습니다.", deleted_count: deletedCount };
  });
}

/**
 * 세션 ID로 사용자 ID 조회 서비스 (주로 내부 권한 확인용)
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<Object>} { user_id: string }
 */
async function getUserIdBySessionIdService(sessionId) {
    return await withTransaction(async (connection) => {
        // 모델에서 SESSION_NOT_FOUND 에러 throw 가능
        return await sessionModel.getUserIdBySessionId(connection, sessionId);
    });
}


module.exports = {
  createSessionService,
  getUserSessionsService,
  updateSessionService,
  getSessionMessagesService,
  deleteSessionService,
  getUserIdBySessionIdService,
};
