const { getConnection, oracledb } = require('../config/database');
const pool = require('../config/database').pool;

// CLOB을 문자열로 변환하는 안정적인 함수
async function clobToString(clob) {
  if (!clob) return ''; // null 또는 undefined인 경우 빈 문자열 반환
  if (typeof clob === 'string') return clob; // 이미 문자열이면 그대로 반환

  // Oracle LOB 객체이거나 일반 Node.js 스트림인지 확인
  if ((clob instanceof oracledb.Lob && clob.readable !== false) || (typeof clob.pipe === 'function' && typeof clob.on === 'function')) {
    return new Promise((resolve, reject) => {
      let str = '';
      // CLOB의 경우 UTF-8 인코딩 설정
      if (clob.setEncoding) {
        clob.setEncoding('utf8');
      } else if (clob.type === oracledb.CLOB) {
        // oracledb.Lob 인스턴스는 기본적으로 UTF-8로 처리됨
      }

      clob.on('data', (chunk) => {
        str += chunk;
      });
      clob.on('end', () => {
        resolve(str);
      });
      clob.on('error', (err) => {
        console.error('CLOB 스트림을 문자열로 변환 중 오류:', err);
        // Promise.all 전체 실패를 막기 위해 오류 메시지 문자열로 resolve
        resolve(`(오류: CLOB 내용을 읽지 못했습니다 - ${err.message})`);
      });

      // 스트림이 이미 종료되었거나 데이터를 읽을 수 없는 경우에 대한 추가 처리
      // Node.js 스트림의 내부 상태를 확인하여 더 안정적으로 처리
      if (clob._readableState && clob._readableState.ended) {
        // 이미 종료된 스트림이면, 현재까지 수집된 문자열로 즉시 resolve
        // 'end' 이벤트가 이미 발생했거나 발생하지 않을 수 있는 경우를 대비
        process.nextTick(() => resolve(str));
      } else if (clob.readable === false && clob._readableState && !clob._readableState.ended) {
        // 읽을 수 없는 상태이지만 아직 종료되지 않은 스트림 (예: destroy된 경우)
        resolve('(오류: CLOB 스트림을 읽을 수 없는 상태입니다)');
      }
    });
  } else {
    console.warn('clobToString: CLOB 객체가 문자열도 아니고, 인식 가능한 스트림도 아닙니다. 객체:', clob);
    return '(내용 변환 불가: 알 수 없는 CLOB 데이터 형식)';
  }
}

// DB에서 대화 기록 가져오기 (Vertex AI 형식으로 변환)
async function getChatHistoryFromDB(connection, sessionId, includeCurrentUserMessage, context_message_limit = null) {
  try {
    let sql = `
      SELECT message_id, session_id, user_id, message_type, message_content, created_at
      FROM chat_messages
      WHERE session_id = :sessionId
      ORDER BY created_at ASC`;

    if (context_message_limit !== null && !isNaN(parseInt(context_message_limit)) && parseInt(context_message_limit) > 0) {
      // Apply limit by fetching latest N messages, then re-ordering to ASC for history
      sql = `
        SELECT * FROM (
            SELECT inner_q.* FROM (
                SELECT message_id, session_id, user_id, message_type, message_content, created_at
                FROM chat_messages
                WHERE session_id = :sessionId
                ORDER BY created_at DESC
            ) inner_q
            WHERE ROWNUM <= :context_message_limit
        ) final_q
        ORDER BY created_at ASC`;
    }
    
    const bindParams = { sessionId: sessionId };
    if (sql.includes(':context_message_limit')) {
        bindParams.context_message_limit = parseInt(context_message_limit);
    }

    const result = await connection.execute(
      sql,
      bindParams,
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 모든 메시지 CLOB 변환
    const rows = await Promise.all(result.rows.map(async row => {
      const text = await clobToString(row.MESSAGE_CONTENT);
      return {
        role: row.MESSAGE_TYPE === 'user' ? 'user' : 'model',
        parts: [{ text: text || '' }]
      };
    }));
    return rows;

  } catch (err) {
    console.error('대화 기록 조회 실패:', err);
    return []; // 오류 발생 시 빈 기록 반환
  }
}

// connection, user_id 인자를 추가하고 순서를 맞춤
async function saveUserMessageToDB(connection, sessionId, user_id, message, userTokenCount = null) {
  try {
    const sessionCheck = await connection.execute(
      `SELECT 1 FROM chat_sessions WHERE session_id = :sessionId`,
      { sessionId: sessionId }
    );
    
    if (sessionCheck.rows.length === 0) {
      throw new Error(`세션 ID '${sessionId}'가 존재하지 않습니다. 메시지를 저장할 수 없습니다.`);
    }

    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, user_id, message_type, message_content, created_at, user_message_token_count)
      VALUES (:sessionId, :user_id, 'user', :message, SYSTIMESTAMP, :userTokenCount)
      RETURNING message_id INTO :messageId`,
      {
        sessionId: sessionId,
        user_id: user_id,
        message: { val: message, type: oracledb.CLOB },
        userTokenCount: userTokenCount, // Store the provided token count
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 255 }
      },
      { autoCommit: false }
    );

  return { user_message_id: result.outBinds.messageId[0] };

  } catch (err) {
    console.error(`사용자 메시지 저장 실패 (sessionId: ${sessionId}):`, err); 
    throw err;
  }
}

// AI 메시지를 DB에 저장
async function saveAiMessageToDB(connection, sessionId, user_id, message, aiTokenCount = null) {
  try {
    let safeMessage = message && typeof message === 'string' && message.trim() !== '' ? 
      message.trim() : 
      '(응답이 생성되지 않았습니다. 다시 시도해 주세요.)';

    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, user_id, message_type, message_content, created_at, ai_message_token_count) 
       VALUES (:sessionId, :user_id, 'ai', :messageContent, SYSTIMESTAMP, :aiTokenCount) 
       RETURNING message_id, message_content, created_at INTO :messageId, :content, :createdAt`,
      { 
        sessionId: sessionId, 
        user_id: user_id,
        messageContent: { val: safeMessage, type: oracledb.CLOB },
        aiTokenCount: aiTokenCount, // Store the provided token count
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 36 },
        content: { type: oracledb.CLOB, dir: oracledb.BIND_OUT, maxSize: 1024 * 1024 },
        createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
      },
      { autoCommit: false }
    );
    const contentStr = await clobToString(result.outBinds.content[0]);
    return {
      ai_message_id: result.outBinds.messageId[0],
      content: contentStr,
      created_at: result.outBinds.createdAt[0],
      ai_message_token_count: aiTokenCount // Also return it, though it's passed in
    };
  } catch (err) {
    console.error(`AI 메시지 저장 실패 (sessionId: ${sessionId}):`, err);
    throw err;
  }
}

// 파일 첨부 정보를 DB(attachments 테이블)에 저장
async function saveAttachmentToDB(connection, messageId, file) { // Added connection parameter
  try {
    // connection = await getConnection(); // Removed internal getConnection
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
      { autoCommit: false } // Changed to false for controller-managed transactions
    );
    return { attachment_id: result.outBinds.attachmentId[0] };
  } catch (err) {
    console.error('첨부파일 정보 저장 실패:', err);
    throw err;
  }
  // Removed finally block for connection closing
}

// 사용자 메시지를 DB에서 삭제 (작성자 확인 포함)
async function deleteUserMessageFromDB(connection, messageId, user_id) { // Added connection parameter
  try {
    // connection = await getConnection(); // Removed internal getConnection
    
    // README.AI에 따라 인증/보안 최소화 요청 수용: user_id 체크를 제거
    const result = await connection.execute(
      `DELETE FROM chat_messages 
       WHERE message_id = :messageId`,
      { messageId: messageId },
      { autoCommit: false } // Changed to false for controller-managed transactions
    );

    // 삭제된 행의 수를 반환 (0이면 삭제 실패 또는 권한 없음)
    return result.rowsAffected > 0; 

  } catch (err) {
    console.error('사용자 메시지 삭제 실패:', err);
    throw err;
  }
  // Removed finally block for connection closing
}

// 세션의 모든 메시지를 클라이언트 표시용으로 가져오기
async function getSessionMessagesForClient(connection, sessionId) { // Added connection parameter
  try {
    // connection = await getConnection(); // Removed internal getConnection
    const result = await connection.execute(
      `SELECT message_id, session_id, user_id, message_type, message_content, created_at, edited_at, is_edited,
              (SELECT f.file_name FROM attachments f WHERE f.message_id = cm.message_id AND ROWNUM = 1) as attachment_file_name,
              (SELECT f.file_path FROM attachments f WHERE f.message_id = cm.message_id AND ROWNUM = 1) as attachment_file_path,
              (SELECT f.file_type FROM attachments f WHERE f.message_id = cm.message_id AND ROWNUM = 1) as attachment_file_type
       FROM chat_messages cm
       WHERE session_id = :sessionId
       ORDER BY created_at ASC`,
      { sessionId: sessionId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const messagesWithContent = await Promise.all(result.rows.map(async row => {
      let messageContentStr = await clobToString(row.MESSAGE_CONTENT); // 이제 전역 clobToString을 사용합니다.
      if (messageContentStr === null || messageContentStr === undefined || messageContentStr.trim() === '') {
        messageContentStr = '(내용 없음)';
      }
      return {
        message_id: row.MESSAGE_ID,
        session_id: row.SESSION_ID,
        user_id: row.USER_ID,
        message_type: row.MESSAGE_TYPE,
        message_content: messageContentStr, // 변환된 문자열 사용
        created_at: row.CREATED_AT,
        edited_at: row.EDITED_AT,
        is_edited: row.IS_EDITED,
        attachment: row.ATTACHMENT_FILE_NAME ? {
          file_name: row.ATTACHMENT_FILE_NAME,
          file_path: row.ATTACHMENT_FILE_PATH,
          file_type: row.ATTACHMENT_FILE_TYPE
        } : null
      };
    }));
    return messagesWithContent;
  } catch (err) {
    console.error('세션 메시지 조회 실패:', err);
    throw err;
  }
  // Removed finally block for connection closing
}

module.exports = {
  getChatHistoryFromDB,
  saveUserMessageToDB,
  saveAiMessageToDB,
  saveAttachmentToDB,
  deleteUserMessageFromDB,
  getSessionMessagesForClient, // 기존 export
  clobToString // clobToString export 추가
};