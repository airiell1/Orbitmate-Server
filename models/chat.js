const { getConnection, oracledb } = require('../config/database');
const pool = require('../config/database').pool;

// DB에서 대화 기록 가져오기 (Vertex AI 형식으로 변환)
async function getChatHistoryFromDB(sessionId) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT message_type, message_content
       FROM chat_messages
       WHERE session_id = :sessionId
       ORDER BY created_at ASC`,
      { sessionId: sessionId }
    );

    // Vertex AI 형식으로 변환 ('user' 또는 'model' 역할)
    return result.rows.map(row => ({
      role: row[0] === 'ai' ? 'model' : 'user', // DB의 'ai' -> 'model'
      parts: [{ text: row[1] }]
    }));

  } catch (err) {
    console.error('대화 기록 조회 실패:', err);
    return []; // 오류 발생 시 빈 기록 반환
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

// 사용자 메시지를 DB에 저장
async function saveUserMessageToDB(sessionId, message) {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, message_type, message_content, created_at) 
       VALUES (:sessionId, 'user', :message, SYSTIMESTAMP) 
       RETURNING message_id INTO :messageId`,
      { 
        sessionId: sessionId, 
        message: message,
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    return result.outBinds.messageId[0];
  } catch (err) {
    console.error('사용자 메시지 저장 실패:', err);
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

// AI 메시지를 DB에 저장
async function saveAiMessageToDB(sessionId, message) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, message_type, message_content, created_at) 
       VALUES (:sessionId, 'ai', :message, SYSTIMESTAMP) 
       RETURNING message_id INTO :messageId`,
      { 
        sessionId: sessionId, 
        message: message,
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    
    return result.outBinds.messageId[0];
  } catch (err) {
    console.error('AI 메시지 저장 실패:', err);
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

// 메시지를 데이터베이스에 저장합니다. (사용자, AI, 파일 메시지 등 범용)
async function saveMessageToDB(messageData) {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `INSERT INTO chat_messages (session_id, user_id, content, sender_type, message_type, file_path, original_filename, mime_type, file_size)
                     VALUES (:session_id, :user_id, :content, :sender_type, :message_type, :file_path, :original_filename, :mime_type, :file_size)
                     RETURNING message_id, created_at INTO :out_message_id, :out_created_at`;

        const binds = {
            session_id: messageData.session_id,
            user_id: messageData.user_id || null, // AI 메시지인 경우 user_id는 null
            content: messageData.content,
            sender_type: messageData.sender_type || (messageData.user_id ? 'user' : 'ai'), // user_id 유무로 기본값 설정
            message_type: messageData.message_type || 'text', // 기본값 'text'
            file_path: messageData.file_path || null,
            original_filename: messageData.original_filename || null,
            mime_type: messageData.mime_type || null,
            file_size: messageData.file_size || null,
            out_message_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
            out_created_at: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
        };

        // sender_type 명시적 지정 (AI 메시지 저장 시 필요)
        if (messageData.sender_type) {
            binds.sender_type = messageData.sender_type;
        }

        const result = await connection.execute(sql, binds, { autoCommit: true });

        if (result.rowsAffected === 1 && result.outBinds) {
            return {
                message_id: result.outBinds.out_message_id[0],
                created_at: result.outBinds.out_created_at[0],
                ...messageData // 입력 데이터도 함께 반환 (필요에 따라)
            };
        } else {
            throw new Error('메시지 저장 실패');
        }
    } catch (err) {
        console.error('DB 메시지 저장 오류:', err);
        throw err; // 오류를 다시 던져서 상위 핸들러에서 처리하도록 함
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('DB 커넥션 반환 오류:', err);
            }
        }
    }
}

// 사용자 메시지를 DB에서 삭제 (작성자 확인 포함)
async function deleteUserMessageFromDB(messageId, userId) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `DELETE FROM chat_messages 
       WHERE message_id = :messageId AND user_id = :userId AND message_type = 'user'`, // user 타입 메시지만 삭제, user_id 추가
      { messageId: messageId, userId: userId },
      { autoCommit: true }
    );

    // 삭제된 행의 수를 반환 (0이면 삭제 실패 또는 권한 없음)
    return result.rowsAffected; 

  } catch (err) {
    console.error('사용자 메시지 삭제 실패:', err);
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

module.exports = {
  getChatHistoryFromDB,
  saveUserMessageToDB,
  saveAiMessageToDB,
  saveMessageToDB,     // 새 범용 함수 추가
  deleteUserMessageFromDB // 추가
};