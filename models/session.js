const { getConnection, oracledb } = require('../config/database');
const { clobToString } = require('./chat'); // clobToString 함수 import

// 새 채팅 세션 생성
async function createChatSession(user_id, title, category) {
  let connection;
  try {
    connection = await getConnection();

    let sessionId;
    if (user_id === 'API_TEST_USER_ID') {
      // 기존에 같은 세션ID/메시지ID가 있으면 삭제(덮어쓰기 보장)
      const testSessionId = 'API_TEST_SESSION_ID';
      const testUserMsgId = 'API_TEST_USER_MESSAGE_ID';
      const testAiMsgId = 'API_TEST_AI_MESSAGE_ID';
      await connection.execute(
        `DELETE FROM chat_messages WHERE message_id IN (:userMsgId, :aiMsgId) OR session_id = :sessionId`,
        { userMsgId: testUserMsgId, aiMsgId: testAiMsgId, sessionId: testSessionId },
        { autoCommit: false }
      );
      await connection.execute(
        `DELETE FROM chat_sessions WHERE session_id = :sessionId OR (user_id = :user_id AND title = :title)`,
        { sessionId: testSessionId, user_id, title },
        { autoCommit: false }
      );
      // 새로 삽입 (고정 세션ID)
      const result = await connection.execute(
        `INSERT INTO chat_sessions (session_id, user_id, title, category)
         VALUES (:sessionId, :user_id, :title, :category)
         RETURNING session_id INTO :sessionIdOut`,
        {
          sessionId: testSessionId,
          user_id,
          title,
          category: category || null,
          sessionIdOut: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
        },
        { autoCommit: false }
      );
      sessionId = result.outBinds.sessionIdOut[0];

      // 테스트 메시지 2개 생성 (USER, AI)
      const now = new Date();
      await connection.execute(
        `INSERT INTO chat_messages (message_id, session_id, user_id, message_type, message_content, created_at)
         VALUES (:msgId, :sessionId, :user_id, 'user', :content, :createdAt)`,
        {
          msgId: testUserMsgId,
          sessionId: testSessionId,
          user_id: user_id,
          content: '이것은 테스트 유저 메시지입니다.',
          createdAt: now
        }
      );
      await connection.execute(
        `INSERT INTO chat_messages (message_id, session_id, user_id, message_type, message_content, created_at)
         VALUES (:msgId, :sessionId, :user_id, 'ai', :content, :createdAt)`,
        {
          msgId: testAiMsgId,
          sessionId: testSessionId,
          user_id: user_id,
          content: '이것은 테스트 AI 메시지입니다.',
          createdAt: now
        }
      );
      await connection.commit();
    } else {
      const result = await connection.execute(
        `INSERT INTO chat_sessions (user_id, title, category) 
         VALUES (:user_id, :title, :category) 
         RETURNING session_id INTO :sessionId`,
        { 
          user_id: user_id, 
          title: title,
          category: category || null,
          sessionId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );
      sessionId = result.outBinds.sessionId[0];
    }

    return { 
      session_id: sessionId,
      title: title,
      category: category,
      created_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('세션 생성 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 사용자의 채팅 세션 목록 조회
async function getUserChatSessions(user_id) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT session_id, title, created_at, updated_at, category, is_archived
       FROM chat_sessions 
       WHERE user_id = :user_id
       ORDER BY updated_at DESC`,
      { user_id: user_id }
    );
    
    return result.rows.map(row => ({
      session_id: row[0],
      title: row[1],
      created_at: row[2],
      updated_at: row[3],
      category: row[4],
      is_archived: row[5] === 1
    }));
  } catch (err) {
    console.error('세션 목록 조회 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 채팅 세션 정보 수정
async function updateChatSession(sessionId, updates) {
  const { title, category, is_archived } = updates;
  
  let connection;
  try {
    connection = await getConnection();
    
    // 세션 정보 업데이트를 위한 쿼리 및 바인드 변수 구성
    let updateQuery = 'UPDATE chat_sessions SET updated_at = SYSTIMESTAMP';
    const bindParams = { sessionId: sessionId };
    
    if (title) {
      updateQuery += ', title = :title';
      bindParams.title = title;
    }
    
    if (category !== undefined) {
      updateQuery += ', category = :category';
      bindParams.category = category;
    }
    
    if (is_archived !== undefined) {
      updateQuery += ', is_archived = :isArchived';
      bindParams.isArchived = is_archived ? 1 : 0;
    }
    
    updateQuery += ' WHERE session_id = :sessionId RETURNING title, category, is_archived, updated_at INTO :outTitle, :outCategory, :outIsArchived, :outUpdatedAt';
    
    // RETURNING 절을 위한 바인드 변수 추가
    bindParams.outTitle = { type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outCategory = { type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outIsArchived = { type: oracledb.NUMBER, dir: oracledb.BIND_OUT };
    bindParams.outUpdatedAt = { type: oracledb.DATE, dir: oracledb.BIND_OUT };
    
    // 쿼리 실행
    const result = await connection.execute(updateQuery, bindParams, { autoCommit: true });
    
    // 업데이트된 세션 정보 반환
    return {
      session_id: sessionId,
      title: result.outBinds.outTitle[0],
      category: result.outBinds.outCategory[0],
      is_archived: result.outBinds.outIsArchived[0] === 1,
      updated_at: result.outBinds.outUpdatedAt[0]
    };
  } catch (err) {
    console.error('세션 수정 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 채팅 세션 삭제 (사용자 ID 검증 없이 session_id만으로 삭제)
async function deleteChatSession(sessionId, user_id) {
  let connection;
  try {
    connection = await getConnection();
    await connection.execute(
      `DELETE FROM chat_messages 
       WHERE session_id = :sessionId`,
      { sessionId: sessionId }
    );
    console.log(`[DB] 세션 ${sessionId}의 메시지 삭제 시도 완료`);

    // 같은 트랜잭션 내에서 실행됩니다.
    const result = await connection.execute(
      `DELETE FROM chat_sessions 
       WHERE session_id = :sessionId AND user_id = :user_id`,
      { sessionId: sessionId, user_id: user_id }
    );

    // 트랜잭션 커밋 (user.js의 working pattern처럼 commit 메소드는 사용)
    await connection.commit(); // <--- 이 메소드는 user.js에서 작동했으니 유지합니다.

    return result.rowsAffected; // 삭제된 세션 수 반환 (0 또는 1)

  } catch (err) {
    console.error('세션 삭제 실패:', err);
    if (connection) {
      try {
        // 오류 발생 시 롤백 (user.js의 working pattern처럼 rollback 메소드는 사용)
        await connection.rollback(); // <--- 이 메소드는 user.js에서 작동했으니 유지합니다.
      } catch (rollbackErr) {
        console.error('롤백 실패:', rollbackErr);
      }
    }
    throw err; // 오류 다시 던지기
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 특정 세션의 메시지 목록 조회
async function getSessionMessages(sessionId) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT m.message_id, m.user_id, m.message_type, m.message_content, 
              m.created_at, m.reaction, m.is_edited, m.edited_at, m.parent_message_id
       FROM chat_messages m
       WHERE m.session_id = :sessionId
       ORDER BY m.created_at ASC`,
      { sessionId: sessionId }
    );
    
    // CLOB 변환을 포함하도록 수정
    const messages = await Promise.all(result.rows.map(async (row) => ({
      message_id: row[0],
      user_id: row[1],
      message_type: row[2],
      message_content: await clobToString(row[3]), // CLOB을 문자열로 변환
      created_at: row[4],
      reaction: row[5],
      is_edited: row[6] === 1,
      edited_at: row[7],
      parent_message_id: row[8]
    })));
    
    return messages;
  } catch (err) {
    console.error('메시지 목록 조회 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 세션 ID로 사용자 ID 조회 함수 추가
async function getUserIdBySessionId(sessionId) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT user_id
       FROM chat_sessions
       WHERE session_id = :sessionId`,
      { sessionId: sessionId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      throw new Error('세션을 찾을 수 없습니다.');
    }
    return result.rows[0].USER_ID;
  } catch (err) {
    console.error('세션에서 사용자 ID 조회 실패:', err);
    throw err; // 오류를 다시 던져 호출 측에서 처리하도록 함
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 해제 실패:', err);
      }
    }
  }
}

module.exports = {
  createChatSession,
  getUserChatSessions,
  updateChatSession,
  getSessionMessages,
  deleteChatSession,
  getUserIdBySessionId // export 추가
};