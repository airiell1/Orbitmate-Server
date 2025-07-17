// const { getConnection, oracledb } = require("../config/database"); // Removed
const { oracledb } = require("../config/database");
const { clobToString, toSnakeCaseObj } = require("../utils/dbUtils"); // Import from dbUtils
const { handleOracleError } = require("../utils/errorHandler");
const { API_TEST_USER_ID, API_TEST_SESSION_ID, API_TEST_USER_MESSAGE_ID, API_TEST_AI_MESSAGE_ID } = require("../utils/constants");
const config = require("../config"); // For NODE_ENV

// 새 채팅 세션 생성
async function createChatSession(connection, user_id, title, category) {
  try {
    let sessionId;
    // 테스트 사용자 로직은 NODE_ENV를 확인하여 개발 환경에서만 실행되도록 수정
    if (config.nodeEnv === "development" && user_id === API_TEST_USER_ID) {
      const testSessionId = API_TEST_SESSION_ID;
      const testUserMsgId = API_TEST_USER_MESSAGE_ID;
      const testAiMsgId = API_TEST_AI_MESSAGE_ID;

      // 테스트 데이터 삭제 (이전 실행의 잔여 데이터 정리)
      await connection.execute(
        `DELETE FROM chat_messages WHERE message_id IN (:userMsgId, :aiMsgId) OR session_id = :sessionId`,
        { userMsgId: testUserMsgId, aiMsgId: testAiMsgId, sessionId: testSessionId },
        { autoCommit: false }
      );
      await connection.execute(
        `DELETE FROM chat_sessions WHERE session_id = :sessionId OR (user_id = :user_id AND title = :title)`,
        { sessionId: testSessionId, user_id: user_id, title: title },
        { autoCommit: false }
      );

      // 테스트 세션 생성
      const result = await connection.execute(
        `INSERT INTO chat_sessions (session_id, user_id, title, category)
         VALUES (:sessionId, :user_id, :title, :category)
         RETURNING session_id INTO :sessionIdOut`,
        {
          sessionId: testSessionId,
          user_id,
          title,
          category: category || null,
          sessionIdOut: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        },
        { autoCommit: false }
      );
      sessionId = result.outBinds.sessionIdOut[0];

      const now = new Date();
      await connection.execute(
        `INSERT INTO chat_messages (message_id, session_id, user_id, message_type, message_content, created_at)
         VALUES (:msgId, :sessionId, :user_id, 'user', :content, :createdAt)`,
        {
          msgId: testUserMsgId,
          sessionId: testSessionId,
          user_id: user_id,
          content: "이것은 테스트 유저 메시지입니다.",
          createdAt: now,
        }, { autoCommit: false }
      );
      await connection.execute(
        `INSERT INTO chat_messages (message_id, session_id, user_id, message_type, message_content, created_at)
         VALUES (:msgId, :sessionId, :user_id, 'ai', :content, :createdAt)`,
        {
          msgId: testAiMsgId,
          sessionId: testSessionId,
          user_id: user_id,
          content: "이것은 테스트 AI 메시지입니다.",
          createdAt: now,
        }, { autoCommit: false }
      );
      // commit은 withTransaction에서 처리
    } else {
      // 디버깅: 실제 DB에 삽입하려는 user_id 확인
      console.log('🔍 [DEBUG] 새 세션 생성 요청 - user_id:', user_id, 'title:', title, 'category:', category);
      
      // MVP 모드에서 guest 사용자 세션 생성은 정상 동작
      if (user_id === 'guest') {
        console.log('🔍 [DEBUG] MVP 게스트 사용자 세션 생성 (정상 동작)');
      }
      
      // UUID 형태의 session_id를 자동 생성하여 반환
      const result = await connection.execute(
        `INSERT INTO chat_sessions (user_id, title, category) 
         VALUES (:user_id, :title, :category) 
         RETURNING session_id INTO :sessionId`,
        {
          user_id: user_id,
          title: title,
          category: category || null,
          sessionId: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
        },
        { autoCommit: false } // withTransaction 사용 시 autoCommit은 false
      );
      sessionId = result.outBinds.sessionId[0];
    }

    return {
      session_id: sessionId,
      title: title,
      category: category,
      created_at: new Date().toISOString(), // DB에서 생성 시간을 가져오는 것이 더 정확할 수 있음
    };
  } catch (err) {
    throw handleOracleError(err);
  }
}

// 사용자의 채팅 세션 목록 조회
async function getUserChatSessions(connection, user_id) {
  try {
    const result = await connection.execute(
      `SELECT session_id, title, created_at, updated_at, category, is_archived
       FROM chat_sessions 
       WHERE user_id = :user_id
       ORDER BY updated_at DESC`,
      { user_id: user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT } // outFormat은 여기서 유지
    );
    // toSnakeCaseObj는 컨트롤러 또는 최종 응답 직전에 적용
    return result.rows.map(row => ({
        session_id: row.SESSION_ID,
        title: row.TITLE,
        created_at: row.CREATED_AT ? row.CREATED_AT.toISOString() : null,
        updated_at: row.UPDATED_AT ? row.UPDATED_AT.toISOString() : null,
        category: row.CATEGORY,
        is_archived: row.IS_ARCHIVED === 1,
    }));
  } catch (err) {
    throw handleOracleError(err);
  }
}

// 채팅 세션 정보 수정
async function updateChatSession(connection, sessionId, updates) {
  const { title, category, is_archived } = updates;
  try {
    let updateQuery = "UPDATE chat_sessions SET updated_at = SYSTIMESTAMP";
    const bindParams = { sessionId: sessionId };

    if (title !== undefined) { // null도 유효한 값으로 업데이트 될 수 있도록 수정
      updateQuery += ", title = :title";
      bindParams.title = title;
    }
    if (category !== undefined) {
      updateQuery += ", category = :category";
      bindParams.category = category;
    }
    if (is_archived !== undefined) {
      updateQuery += ", is_archived = :isArchived";
      bindParams.isArchived = is_archived ? 1 : 0;
    }

    updateQuery +=
      " WHERE session_id = :sessionId RETURNING session_id, title, category, is_archived, updated_at INTO :outSessionId, :outTitle, :outCategory, :outIsArchived, :outUpdatedAt";

    bindParams.outSessionId = { type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outTitle = { type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outCategory = { type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outIsArchived = { type: oracledb.NUMBER, dir: oracledb.BIND_OUT };
    bindParams.outUpdatedAt = { type: oracledb.DATE, dir: oracledb.BIND_OUT };

    const result = await connection.execute(updateQuery, bindParams, {
      autoCommit: false, // withTransaction 사용
    });

    if (result.rowsAffected === 0) {
        const error = new Error("세션을 찾을 수 없거나 업데이트할 수 없습니다.");
        error.code = "SESSION_NOT_FOUND";
        throw error;
    }

    return {
      session_id: result.outBinds.outSessionId[0],
      title: result.outBinds.outTitle[0],
      category: result.outBinds.outCategory[0],
      is_archived: result.outBinds.outIsArchived[0] === 1,
      updated_at: result.outBinds.outUpdatedAt[0],
    };
  } catch (err) {
    if(err.code === "SESSION_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 채팅 세션 삭제
async function deleteChatSession(connection, sessionId, user_id) {
  try {
    console.log('🔍 [MODEL DEBUG] 세션 삭제 시작:', {
      sessionId: sessionId,
      user_id: user_id
    });

    // 1. 해당 세션의 메시지들 삭제
    const messageDeleteResult = await connection.execute(
      `DELETE FROM chat_messages WHERE session_id = :sessionId`,
      { sessionId: sessionId },
      { autoCommit: false }
    );

    console.log('🔍 [MODEL DEBUG] 메시지 삭제 결과:', {
      sessionId: sessionId,
      deletedMessages: messageDeleteResult.rowsAffected
    });

    // 2. 세션 삭제
    const result = await connection.execute(
      `DELETE FROM chat_sessions WHERE session_id = :sessionId AND user_id = :user_id`,
      { sessionId: sessionId, user_id: user_id },
      { autoCommit: false }
    );

    console.log('🔍 [MODEL DEBUG] 세션 삭제 결과:', {
      sessionId: sessionId,
      user_id: user_id,
      deletedSessions: result.rowsAffected
    });

    return result.rowsAffected; // 삭제된 세션 수 반환 (0 또는 1)
  } catch (err) {
    console.error('🔍 [MODEL DEBUG] 세션 삭제 에러:', err);
    throw handleOracleError(err);
  }
}

// 특정 세션의 메시지 목록 조회
async function getSessionMessages(connection, sessionId) {
  try {
    // 먼저 세션 소유자 확인
    const sessionOwner = await connection.execute(
      `SELECT user_id FROM chat_sessions WHERE session_id = :sessionId`,
      { sessionId: sessionId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (sessionOwner.rows.length === 0) {
      const error = new Error("세션을 찾을 수 없습니다.");
      error.code = "SESSION_NOT_FOUND";
      throw error;
    }

    const actualUserId = sessionOwner.rows[0].USER_ID;

    const result = await connection.execute(
      `SELECT m.message_id, m.user_id, m.message_type, m.message_content, 
              m.created_at, m.reaction, m.is_edited, m.edited_at, m.parent_message_id
       FROM chat_messages m
       WHERE m.session_id = :sessionId
       ORDER BY m.created_at ASC`,
      { sessionId: sessionId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const messages = await Promise.all(
      result.rows.map(async (row) => ({
        message_id: row.MESSAGE_ID,
        // 사용자 메시지인 경우 실제 세션 소유자 ID로 표시, AI 메시지는 그대로 유지
        user_id: row.MESSAGE_TYPE === 'user' ? actualUserId : row.USER_ID,
        message_type: row.MESSAGE_TYPE,
        message_content: await clobToString(row.MESSAGE_CONTENT),
        created_at: row.CREATED_AT ? row.CREATED_AT.toISOString() : null,
        reaction: row.REACTION,
        is_edited: row.IS_EDITED === 1,
        edited_at: row.EDITED_AT ? row.EDITED_AT.toISOString() : null,
        parent_message_id: row.PARENT_MESSAGE_ID,
      }))
    );
    return messages;
  } catch (err) {
    throw handleOracleError(err);
  }
}

// 세션 ID로 사용자 ID 조회 함수 추가
async function getUserIdBySessionId(connection, sessionId) {
  try {
    const result = await connection.execute(
      `SELECT user_id FROM chat_sessions WHERE session_id = :sessionId`,
      { sessionId: sessionId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      const error = new Error("세션을 찾을 수 없습니다.");
      error.code = "SESSION_NOT_FOUND"; // 표준 에러 코드 사용
      throw error;
    }
    return { user_id: result.rows[0].USER_ID };
  } catch (err) {
    if(err.code === "SESSION_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 관리자용 전체 세션 조회 함수
async function getAllSessionsForAdmin(connection, options = {}) {
  try {
    const { 
      user_id, 
      include_empty = false, 
      limit = 50, 
      offset = 0 
    } = options;

    console.log('[DEBUG] getAllSessionsForAdmin options:', { user_id, include_empty, limit, offset });

    let whereClause = '';
    const bindings = {};

    if (user_id) {
      whereClause = 'WHERE cs.user_id = :user_id';
      bindings.user_id = user_id;
    }

    if (!include_empty) {
      const emptyFilter = 'COALESCE(msg_count, 0) > 0';
      whereClause = whereClause ? `${whereClause} AND ${emptyFilter}` : `WHERE ${emptyFilter}`;
      console.log('[DEBUG] 빈 세션 필터링 적용');
    } else {
      console.log('[DEBUG] 빈 세션 포함하여 조회');
    }

    console.log('[DEBUG] WHERE clause:', whereClause);
    console.log('[DEBUG] Bindings:', bindings);

    const query = `
      SELECT cs.session_id,
             cs.user_id,
             cs.title,
             cs.category,
             cs.created_at,
             cs.updated_at,
             cs.is_archived,
             u.username,
             u.email,
             u.is_active,
             u.is_admin,
             COALESCE(msg_count, 0) as message_count,
             COALESCE(user_msg_count, 0) as user_message_count,
             COALESCE(ai_msg_count, 0) as ai_message_count,
             last_message_at,
             last_message_content
      FROM chat_sessions cs
      LEFT JOIN users u ON cs.user_id = u.user_id
      LEFT JOIN (
        SELECT session_id,
               COUNT(*) as msg_count,
               SUM(CASE WHEN message_type = 'user' THEN 1 ELSE 0 END) as user_msg_count,
               SUM(CASE WHEN message_type = 'ai' THEN 1 ELSE 0 END) as ai_msg_count,
               MAX(created_at) as last_message_at
        FROM chat_messages
        GROUP BY session_id
      ) msg_stats ON cs.session_id = msg_stats.session_id
      LEFT JOIN (
        SELECT session_id,
               SUBSTR(message_content, 1, 100) as last_message_content
        FROM (
          SELECT session_id,
                 message_content,
                 ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn
          FROM chat_messages
        )
        WHERE rn = 1
      ) last_msg ON cs.session_id = last_msg.session_id
      ${whereClause}
      ORDER BY cs.updated_at DESC`;

    // Oracle 11g 호환 페이지네이션 구문 사용
    const finalQuery = `
      SELECT * FROM (
        SELECT rownum as rn, sub.* FROM (
          ${query}
        ) sub
        WHERE rownum <= :maxRow
      )
      WHERE rn > :minRow`;

    bindings.minRow = offset;
    bindings.maxRow = offset + limit;

    const result = await connection.execute(finalQuery, bindings, { 
      outFormat: oracledb.OUT_FORMAT_OBJECT 
    });

    const sessions = await Promise.all(
      result.rows.map(async (row) => ({
        session_id: row.SESSION_ID,
        user_id: row.USER_ID,
        title: row.TITLE,
        category: row.CATEGORY,
        created_at: row.CREATED_AT ? row.CREATED_AT.toISOString() : null,
        updated_at: row.UPDATED_AT ? row.UPDATED_AT.toISOString() : null,
        is_archived: row.IS_ARCHIVED === 1,
        user_info: {
          username: row.USERNAME,
          email: row.EMAIL,
          is_active: row.IS_ACTIVE === 1,
          is_admin: row.IS_ADMIN === 1
        },
        message_stats: {
          total_messages: row.MESSAGE_COUNT || 0,
          user_messages: row.USER_MESSAGE_COUNT || 0,
          ai_messages: row.AI_MESSAGE_COUNT || 0,
          last_message_at: row.LAST_MESSAGE_AT ? row.LAST_MESSAGE_AT.toISOString() : null,
          last_message_preview: row.LAST_MESSAGE_CONTENT ? 
            await clobToString(row.LAST_MESSAGE_CONTENT) : null
        }
      }))
    );

    // 총 세션 수 조회
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM chat_sessions cs
      LEFT JOIN (
        SELECT session_id,
               COUNT(*) as msg_count
        FROM chat_messages
        GROUP BY session_id
      ) msg_stats ON cs.session_id = msg_stats.session_id
      ${whereClause}`;

    // 카운트 쿼리용 바인딩 (페이지네이션 제외)
    const countBindings = { ...bindings };
    delete countBindings.minRow;
    delete countBindings.maxRow;

    const countResult = await connection.execute(countQuery, countBindings, { 
      outFormat: oracledb.OUT_FORMAT_OBJECT 
    });

    return {
      sessions,
      pagination: {
        total_count: countResult.rows[0].TOTAL_COUNT,
        limit,
        offset,
        has_more: (offset + limit) < countResult.rows[0].TOTAL_COUNT
      }
    };
  } catch (err) {
    throw handleOracleError(err);
  }
}

module.exports = {
  createChatSession,
  getUserChatSessions,
  updateChatSession,
  getSessionMessages,
  deleteChatSession,
  getUserIdBySessionId, // export 추가
  getAllSessionsForAdmin, // export 추가
};
