// const { getConnection, oracledb } = require("../config/database"); // Removed direct import of getConnection
const { oracledb } = require("../config/database"); // Keep oracledb for types if needed
const { clobToString } = require("../utils/dbUtils"); // Import from dbUtils
const { handleOracleError } = require("../utils/errorHandler"); // Import error handler

// DB에서 대화 기록 가져오기 (Vertex AI 형식으로 변환)
async function getChatHistoryFromDB(
  connection, // Added connection parameter
  sessionId,
  includeCurrentUserMessage, // This parameter seems unused in the provided logic, consider removing or implementing
  context_message_limit = null
) {
  try {
    let sql = `
      SELECT message_id, session_id, user_id, message_type, message_content, created_at
      FROM chat_messages
      WHERE session_id = :sessionId
      ORDER BY created_at ASC`;

    if (
      context_message_limit !== null &&
      !isNaN(parseInt(context_message_limit)) &&
      parseInt(context_message_limit) > 0
    ) {
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
    if (sql.includes(":context_message_limit")) {
      bindParams.context_message_limit = parseInt(context_message_limit);
    }

    const result = await connection.execute(sql, bindParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    const rows = await Promise.all(
      result.rows.map(async (row) => {
        const text = await clobToString(row.MESSAGE_CONTENT);
        return {
          role: row.MESSAGE_TYPE === "user" ? "user" : "model",
          parts: [{ text: text || "" }],
        };
      })
    );
    return rows;
  } catch (err) {
    // console.error("대화 기록 조회 실패:", err); // Logging will be handled by central error handler
    throw handleOracleError(err); // Throw a standardized error
  }
}

async function saveUserMessageToDB(
  connection, // Added connection parameter
  sessionId,
  user_id,
  message,
  userTokenCount = null
) {
  try {
    const sessionCheck = await connection.execute(
      `SELECT 1 FROM chat_sessions WHERE session_id = :sessionId`,
      { sessionId: sessionId }
    );

    if (sessionCheck.rows.length === 0) {
      const error = new Error(
        `세션 ID '${sessionId}'가 존재하지 않습니다. 세션이 삭제되었거나 만료되었을 수 있습니다.`
      );
      error.code = "SESSION_NOT_FOUND";
      throw error;
    }

    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, user_id, message_type, message_content, created_at, user_message_token_count)
      VALUES (:sessionId, :user_id, 'user', :message, SYSTIMESTAMP, :userTokenCount)
      RETURNING message_id INTO :messageId`,
      {
        sessionId: sessionId,
        user_id: user_id,
        message: { val: message, type: oracledb.CLOB },
        userTokenCount: userTokenCount,
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 255 },
      },
      { autoCommit: false } // autoCommit is false as transaction is managed by withTransaction
    );

    return { user_message_id: result.outBinds.messageId[0] };
  } catch (err) {
    // console.error(`사용자 메시지 저장 실패 (sessionId: ${sessionId}):`, err);
    if (err.code === "SESSION_NOT_FOUND") throw err; // Rethrow specific known error
    throw handleOracleError(err);
  }
}

async function saveAiMessageToDB(
  connection, // Added connection parameter
  sessionId,
  user_id,
  message,
  aiTokenCount = null
) {
  try {
    let safeMessage =
      message && typeof message === "string" && message.trim() !== ""
        ? message.trim()
        : "(응답이 생성되지 않았습니다. 다시 시도해 주세요.)";

    const result = await connection.execute(
      `INSERT INTO chat_messages (session_id, user_id, message_type, message_content, created_at, ai_message_token_count) 
       VALUES (:sessionId, :user_id, 'ai', :messageContent, SYSTIMESTAMP, :aiTokenCount) 
       RETURNING message_id, message_content, created_at INTO :messageId, :content, :createdAt`,
      {
        sessionId: sessionId,
        user_id: user_id,
        messageContent: { val: safeMessage, type: oracledb.CLOB },
        aiTokenCount: aiTokenCount,
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 36 },
        content: { type: oracledb.CLOB, dir: oracledb.BIND_OUT, maxSize: 1024 * 1024 },
        createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
      },
      { autoCommit: false }
    );
    const contentStr = await clobToString(result.outBinds.content[0]);
    return {
      ai_message_id: result.outBinds.messageId[0],
      content: contentStr,
      created_at: result.outBinds.createdAt[0],
      ai_message_token_count: aiTokenCount,
    };
  } catch (err) {
    // console.error(`AI 메시지 저장 실패 (sessionId: ${sessionId}):`, err);
    throw handleOracleError(err);
  }
}

async function saveAttachmentToDB(
  connection, // Added connection parameter
  messageId,
  file
) {
  try {
    const result = await connection.execute(
      `INSERT INTO attachments (message_id, file_name, file_path, file_type, file_size, uploaded_at)
       VALUES (:messageId, :fileName, :filePath, :fileType, :fileSize, SYSTIMESTAMP)
       RETURNING attachment_id INTO :attachmentId`,
      {
        messageId: messageId,
        fileName: file.originalname,
        filePath: file.path,
        fileType: file.mimetype,
        fileSize: file.size,
        attachmentId: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      },
      { autoCommit: false }
    );
    return { attachment_id: result.outBinds.attachmentId[0] };
  } catch (err) {
    // console.error("첨부파일 정보 저장 실패:", err);
    throw handleOracleError(err);
  }
}

async function deleteUserMessageFromDB(
  connection, // Added connection parameter
  messageId
  // user_id parameter removed as per previous notes (not used in query)
) {
  try {
    const result = await connection.execute(
      `DELETE FROM chat_messages WHERE message_id = :messageId`,
      { messageId: messageId },
      { autoCommit: false }
    );
    return result.rowsAffected > 0;
  } catch (err) {
    // console.error("사용자 메시지 삭제 실패:", err);
    throw handleOracleError(err);
  }
}

async function getSessionMessagesForClient(
  connection, // Added connection parameter
  sessionId
) {
  try {
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

    const messagesWithContent = await Promise.all(
      result.rows.map(async (row) => {
        let messageContentStr = await clobToString(row.MESSAGE_CONTENT);
        if (messageContentStr === null || messageContentStr === undefined || messageContentStr.trim() === "") {
          messageContentStr = "(내용 없음)";
        }
        return {
          message_id: row.MESSAGE_ID,
          session_id: row.SESSION_ID,
          user_id: row.USER_ID,
          message_type: row.MESSAGE_TYPE,
          message_content: messageContentStr,
          created_at: row.CREATED_AT,
          edited_at: row.EDITED_AT,
          is_edited: row.IS_EDITED,
          attachment: row.ATTACHMENT_FILE_NAME
            ? {
                file_name: row.ATTACHMENT_FILE_NAME,
                file_path: row.ATTACHMENT_FILE_PATH,
                file_type: row.ATTACHMENT_FILE_TYPE,
              }
            : null,
        };
      })
    );
    return messagesWithContent;
  } catch (err) {
    // console.error("세션 메시지 조회 실패:", err);
    throw handleOracleError(err);
  }
}

// =========================
// 9. 메시지 편집 기능
// =========================

async function editUserMessage(
  connection, // Added connection parameter
  message_id,
  user_id,
  new_content,
  edit_reason = null
) {
  try {
    // 기존 메시지 조회 및 권한 확인
    const messageResult = await connection.execute(
      `SELECT message_content, user_id, message_type, session_id
       FROM chat_messages
       WHERE message_id = :message_id`,
      { message_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (messageResult.rows.length === 0) {
      const error = new Error("메시지를 찾을 수 없습니다.");
      error.code = "MESSAGE_NOT_FOUND";
      throw error;
    }

    const message = messageResult.rows[0];
    const oldContent = await clobToString(message.MESSAGE_CONTENT);

    if (message.USER_ID !== user_id) {
      const error = new Error("메시지를 편집할 권한이 없습니다.");
      error.code = "FORBIDDEN";
      throw error;
    }

    if (message.MESSAGE_TYPE === "ai") {
      const error = new Error("AI 메시지는 편집할 수 없습니다.");
      error.code = "INVALID_OPERATION"; // Or a more specific code
      throw error;
    }

    // 편집 기록 저장
    await connection.execute(
      `INSERT INTO message_edit_history
       (message_id, old_content, new_content, edit_reason, edited_by)
       VALUES (:message_id, :old_content, :new_content, :edit_reason, :edited_by)`,
      {
        message_id,
        old_content: oldContent,
        new_content,
        edit_reason,
        edited_by: user_id,
      },
      { autoCommit: false }
    );

    // 메시지 업데이트
    await connection.execute(
      `UPDATE chat_messages
       SET message_content = :new_content,
           is_edited = 1,
           edited_at = SYSTIMESTAMP
       WHERE message_id = :message_id`,
      { message_id, new_content },
      { autoCommit: false }
    );

    return {
      success: true, // This structure might change with standardized responses
      message_id,
      old_content: oldContent,
      new_content,
      session_id: message.SESSION_ID,
      edited_at: new Date().toISOString(), // Consider if DB should provide this
    };
  } catch (err) {
    if (err.code === "MESSAGE_NOT_FOUND" || err.code === "FORBIDDEN" || err.code === "INVALID_OPERATION") {
      throw err; // Rethrow specific known errors
    }
    throw handleOracleError(err); // Handle other DB errors
  }
}

async function getMessageEditHistory(
  connection, // Added connection parameter
  message_id
) {
  try {
    const result = await connection.execute(
      `SELECT edit_id, old_content, new_content, edit_reason, edited_by, edited_at
       FROM message_edit_history 
       WHERE message_id = :message_id 
       ORDER BY edited_at DESC`,
      { message_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const editHistory = [];
    for (const row of result.rows) {
      editHistory.push({
        edit_id: row.EDIT_ID,
        old_content: await clobToString(row.OLD_CONTENT),
        new_content: await clobToString(row.NEW_CONTENT),
        edit_reason: row.EDIT_REASON,
        edited_by: row.EDITED_BY,
        edited_at: row.EDITED_AT,
      });
    }
    return editHistory;
  } catch (err) {
    throw handleOracleError(err);
  }
}

async function requestAiReresponse(
  connection, // Added connection parameter
  session_id,
  edited_message_id
  // user_id parameter was not used in the original logic after removing connection.execute("BEGIN") etc.
  // If user_id is needed for authorization or other logic, it should be passed and used.
  // For now, keeping it removed as per the refactoring to simplify.
) {
  try {
    const subsequentMessages = await connection.execute(
      `SELECT message_id, message_type 
       FROM chat_messages 
       WHERE session_id = :session_id 
         AND created_at > (SELECT created_at FROM chat_messages WHERE message_id = :edited_message_id)
         AND is_deleted = 0
       ORDER BY created_at`,
      { session_id, edited_message_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (subsequentMessages.rows.length > 0) {
      const messageIds = subsequentMessages.rows.map((row) => row.MESSAGE_ID);

      // Correctly generate bind parameters for Oracle IN clause
      const bindParams = {};
      const idPlaceholders = messageIds.map((id, index) => {
        const paramName = `id${index}`;
        bindParams[paramName] = id;
        return `:${paramName}`;
      }).join(', ');

      await connection.execute(
        `UPDATE chat_messages 
         SET is_deleted = 1, updated_at = SYSTIMESTAMP 
         WHERE message_id IN (${idPlaceholders})`,
        bindParams, // Use the generated bind parameters
        { autoCommit: false } // autoCommit should be false as part of withTransaction
      );
    }

    return {
      success: true, // This structure might change with standardized responses
      message: "편집된 메시지 이후의 대화가 초기화되었습니다. 새로운 AI 응답을 요청하세요.",
      deleted_messages: subsequentMessages.rows.length,
    };
  } catch (err) {
    throw handleOracleError(err);
  }
}


module.exports = {
  getChatHistoryFromDB,
  saveUserMessageToDB,
  saveAiMessageToDB,
  saveAttachmentToDB,
  deleteUserMessageFromDB,
  getSessionMessagesForClient,
  // clobToString, // No longer exported from here, use from dbUtils
  editUserMessage,
  getMessageEditHistory,
  requestAiReresponse,
};
