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
      { sessionId: sessionId },
      { fetchInfo: { "MESSAGE_CONTENT": { type: oracledb.STRING } } } // CLOB를 문자열로 가져오도록 fetchInfo 추가
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
async function saveAiMessageToDB(sessionId, message, userId = 'ai-system') { // AI 메시지도 user_id를 받을 수 있도록 수정 (옵션)
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, user_id, message_type, message_content, created_at) 
       VALUES (:sessionId, :userId, 'ai', :message, SYSTIMESTAMP) 
       RETURNING message_id INTO :messageId`,
      { 
        sessionId: sessionId, 
        userId: userId, // AI의 경우 특정 ID 또는 null
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

// 파일 첨부 정보를 DB(attachments 테이블)에 저장
async function saveAttachmentToDB(messageId, file) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `INSERT INTO attachments (message_id, file_name, file_path, file_type, file_size, uploaded_at)
       VALUES (:messageId, :fileName, :filePath, :fileType, :fileSize, SYSTIMESTAMP)
       RETURNING attachment_id INTO :attachmentId`,
      {
        messageId: messageId,
        fileName: file.originalname,
        filePath: file.path, // multer에서 저장한 경로
        fileType: file.mimetype,
        fileSize: file.size,
        attachmentId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    return result.outBinds.attachmentId[0];
  } catch (err) {
    console.error('첨부파일 정보 저장 실패:', err);
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
// 이 함수는 현재 chatController에서 직접 saveUserMessageToDB, saveAiMessageToDB를 사용하므로, 필요시 리팩토링 가능
// 우선은 기존 함수들을 활용하고, saveMessageToDB는 파일 메시지 저장 시 활용 검토
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
    
    // README.AI에 따라 인증/보안 최소화 요청 수용: userId 체크를 제거
    const result = await connection.execute(
      `DELETE FROM chat_messages 
       WHERE message_id = :messageId`,
      { messageId: messageId },
      { autoCommit: true }
    );

    // 삭제된 행의 수를 반환 (0이면 삭제 실패 또는 권한 없음)
    return result.rowsAffected > 0; 

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
  saveAttachmentToDB, // 추가
  saveMessageToDB,
  deleteUserMessageFromDB
};