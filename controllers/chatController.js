const { getConnection, oracledb } = require('../config/database');
const { saveUserMessageToDB, saveAiMessageToDB, deleteUserMessageFromDB, getSessionMessagesForClient, getChatHistoryFromDB } = require('../models/chat'); // getChatHistoryFromDB 추가
const { getAiResponse } = require('../config/vertexai');
const { clobToString, convertClobFields } = require('../utils/dbUtils'); // convertClobFields import 추가
const path = require('path');
const fs = require('fs');

// 오류 처리 유틸리티 추가
const { createErrorResponse, getHttpStatusByErrorCode, handleOracleError, logError } = require('../utils/errorHandler');

// 채팅 메시지 전송 및 AI 응답 받기 컨트롤러
async function sendMessageController(req, res) {
  const sessionId = req.params.session_id;
  const GUEST_USER_ID = 'guest';
  const { message, systemPrompt, specialModeType } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json(createErrorResponse('INVALID_INPUT', '메시지를 입력해주세요.'));
  }
  const user_id = req.user ? req.user.user_id : GUEST_USER_ID;

  let connection; // Ensure connection is declared at the function scope

  try {
    connection = await getConnection();

    // 1. 사용자 메시지 저장
    const userMessageResult = await saveUserMessageToDB(connection, sessionId, user_id, message);
    if (!userMessageResult || !userMessageResult.user_message_id) {
      await connection.rollback();
      return res.status(500).json(createErrorResponse('DB_ERROR', '사용자 메시지 저장에 실패했습니다.'));
    }
    const userMessageId = userMessageResult.user_message_id;

    // 2. 대화 기록 가져오기 (현재 사용자 메시지 포함)
    let chatHistoryForAI = await getChatHistoryFromDB(connection, sessionId, false);

    // 3. Vertex AI에 요청
    const effectiveSystemPrompt = systemPrompt && systemPrompt.trim() ? systemPrompt.trim() : null;
    
    const aiResponseFull = await getAiResponse(message, chatHistoryForAI, effectiveSystemPrompt, specialModeType);

    if (!aiResponseFull || typeof aiResponseFull.content !== 'string' || aiResponseFull.content.trim() === '') {
      await connection.rollback();
      console.error('Invalid AI response received from Vertex AI:', aiResponseFull);
      return res.status(500).json(createErrorResponse('AI_RESPONSE_ERROR', 'AI로부터 유효한 응답을 받지 못했습니다. 응답 내용이 비어있거나 형식이 잘못되었습니다.'));
    }
    const aiContentFromVertex = aiResponseFull.content;

    // 4. AI 응답 저장
    const aiMessageResult = await saveAiMessageToDB(connection, sessionId, GUEST_USER_ID, aiContentFromVertex); // Assuming AI messages are stored with a generic AI user ID
    if (!aiMessageResult || !aiMessageResult.ai_message_id) {
      await connection.rollback();
      return res.status(500).json(createErrorResponse('DB_ERROR', 'AI 메시지 저장에 실패했습니다.'));
    }
    const aiMessageId = aiMessageResult.ai_message_id.toString();
    const aiCreatedAt = aiMessageResult.created_at;
    const actualAiContentSaved = aiMessageResult.content; // Content confirmed from DB save

    await connection.commit(); // Commit transaction

    // 5. 클라이언트에 응답 전송
    const responseData = {
      user_message_id: userMessageId.toString(),
      ai_message_id: aiMessageId,
      message: actualAiContentSaved, // AI 응답 내용 (공통 필드로 사용)
      created_at: aiCreatedAt ? new Date(aiCreatedAt).toISOString() : new Date().toISOString()
    };

    if (specialModeType === 'stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // ID 전송
      res.write(`event: ids\\ndata: ${JSON.stringify({ userMessageId: responseData.user_message_id, aiMessageId: responseData.ai_message_id })}\\n\\n`);

      // 메시지 스트리밍
      const chunkSize = 100; // 청크 크기 설정 (원하는대로 조절)
      for (let i = 0; i < responseData.message.length; i += chunkSize) {
        const chunk = responseData.message.substring(i, i + chunkSize);
        // 각 청크 데이터를 'data:' 접두사와 함께 전송
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\\n\\n`);
        // 적절한 지연 시간을 두어 클라이언트에서 부드럽게 보이도록 조정 (원하는대로 조절)
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      // 스트림 종료 이벤트 전송
      res.write(`event: end\\ndata: ${JSON.stringify({ message: 'Stream ended' })}\\n\\n`);

      // 스트리밍 완료 후 함수 종료
      return; // 이 요청 처리를 여기서 끝냄

    } else { // 'canvas' 모드 또는 기본 모드 (스트리밍이 아닌 경우)
      // 'canvas' 모드일 경우 Canvas 데이터 파싱 및 추가
      if (specialModeType === 'canvas') {
        const htmlRegex = /```html\n([\s\S]*?)\n```/;
        const cssRegex = /```css\n([\s\S]*?)\n```/;
        const jsRegex = /```javascript\n([\s\S]*?)\n```/;

        const htmlMatch = actualAiContentSaved.match(htmlRegex);
        const cssMatch = actualAiContentSaved.match(cssRegex);
        const jsMatch = actualAiContentSaved.match(jsRegex);
  
        // responseData 객체에 Canvas 데이터 필드 추가
        responseData.canvas_html = htmlMatch ? htmlMatch[1].trim() : '';
        responseData.canvas_css = cssMatch ? cssMatch[1].trim() : '';
        responseData.canvas_js = jsMatch ? jsMatch[1].trim() : '';
      }

      // 스트리밍이 아닌 경우, 공통 응답 객체 (필요시 canvas 데이터 포함)를 JSON 형태로 전송
      res.json(responseData);
    }
  } catch (err) {
    logError(err, req);
    if (connection) {
      try {
        await connection.rollback(); // Rollback on any error if transaction started
      } catch (rollbackError) {
        logError(rollbackError, req, 'Rollback failed');
      }
    }
    // Specific error handling (can be expanded)
    if (err.code === 'NJS-044' || (err.message && err.message.includes('NJS-044'))) {
        return res.status(500).json(createErrorResponse('DB_BIND_ERROR', `데이터베이스 바인딩 오류: ${err.message}`));
    }
    if (err.message && err.message.startsWith("세션 ID")) { 
        return res.status(404).json(createErrorResponse('SESSION_NOT_FOUND', err.message));
    }
    if (err.errorNum) { // Oracle specific errors
      const handledError = handleOracleError(err, req);
      return res.status(getHttpStatusByErrorCode(handledError.code)).json(handledError);
    }
    // Generic server error
    res.status(500).json(createErrorResponse('SERVER_ERROR', `메시지 처리 중 서버 오류가 발생했습니다: ${err.message}`));
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        logError(err, req, 'DB connection close failed');
      }
    }
  }
}

// 메시지 편집 컨트롤러
async function editMessageController(req, res) {
  const messageId = req.params.message_id;
  const { content } = req.body;
  
  if (!content || typeof content !== 'string' || content.trim() === '') {
    console.error('Error in editMessageController: Content is required and must be a non-empty string.');
    return res.status(400).json({ error: '메시지 내용은 필수이며 빈 문자열이 아니어야 합니다.' });
  }
  if (!messageId) {
    console.error('Error in editMessageController: Message ID is required.');
    return res.status(400).json({ error: '메시지 ID가 필요합니다.' });
  }
  
  let connection;
  try {
    connection = await getConnection();
    // TODO: 사용자 인증 및 메시지 소유권 확인 로직 추가 (인가)
    const result = await connection.execute(
      `UPDATE chat_messages SET message_content = :content, edited_at = SYSTIMESTAMP, is_edited = 1 WHERE message_id = :messageId`,
      { content, messageId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      console.warn(`Warning in editMessageController: Message with ID ${messageId} not found or not updated.`);
      return res.status(404).json({ error: '메시지를 찾을 수 없거나 업데이트되지 않았습니다.' });
    }
    // 편집된 메시지 정보 다시 조회 (선택 사항)
    const editedMessageResult = await connection.execute(
        `SELECT message_id, session_id, user_id, message_type, message_content, created_at, edited_at, is_edited 
         FROM chat_messages 
         WHERE message_id = :messageId`,
        { messageId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (editedMessageResult.rows.length === 0) {
        console.error(`Error in editMessageController: Edited message with ID ${messageId} not found after update.`);
        return res.status(404).json({ error: '편집된 메시지를 찾을 수 없습니다.' });
    }

    const updatedMessage = await convertClobFields(editedMessageResult.rows[0]); // CLOB 변환

    res.status(200).json({ message: '메시지가 성공적으로 수정되었습니다.', updatedMessage: updatedMessage });
  } catch (err) {
    console.error(`Error in editMessageController for message ${messageId}:`, err);
    res.status(500).json({ error: `메시지 수정 중 오류 발생: ${err.message}` });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection in editMessageController:', err);
      }
    }
  }
}

// 메시지 리액션 추가 컨트롤러
async function addReactionController(req, res) {
  const messageId = req.params.message_id;
  const { reaction } = req.body; // 예: reaction = "👍"
  
  if (!reaction || typeof reaction !== 'string' || reaction.trim() === '') {
    console.error('Error in addReactionController: Reaction is required and must be a non-empty string.');
    return res.status(400).json({ error: '리액션은 필수이며 빈 문자열이 아니어야 합니다.' });
  }
   if (!messageId) {
    console.error('Error in addReactionController: Message ID is required.');
    return res.status(400).json({ error: '메시지 ID가 필요합니다.' });
  }
  
  let connection;
  try {
    connection = await getConnection();
    // TODO: 사용자 인증 로직 추가
    // TODO: 리액션 저장 로직 구현 (reactions 테이블 또는 chat_messages 테이블 확장)
    // 이 예시에서는 chat_messages에 reaction 컬럼이 있다고 가정 (실제 스키마에 맞게 수정 필요)
    const result = await connection.execute(
      `UPDATE chat_messages SET reaction = :reaction WHERE message_id = :messageId`,
      { reaction, messageId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      console.warn(`Warning in addReactionController: Message with ID ${messageId} not found or reaction not added.`);
      return res.status(404).json({ error: '메시지를 찾을 수 없거나 리액션이 추가되지 않았습니다.' });
    }
    res.status(200).json({ message: '리액션이 성공적으로 추가되었습니다.' });
  } catch (err) {
    console.error(`Error in addReactionController for message ${messageId}:`, err);
    res.status(500).json({ error: `리액션 추가 중 오류 발생: ${err.message}` });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection in addReactionController:', err);
      }
    }
  }
}

// 메시지 리액션 제거 컨트롤러
async function removeReactionController(req, res) {
  const messageId = req.params.message_id;
  // const { user_id } = req.user; // 인증된 사용자 ID (인증 구현 후 사용)

  if (!messageId) {
    console.error('Error in removeReactionController: Message ID is required.');
    return res.status(400).json({ error: '메시지 ID가 필요합니다.' });
  }

  let connection;
  try {
    connection = await getConnection();
    // TODO: 사용자 인증 및 리액션 소유권 확인 로직 추가 (인가)
    // 이 예시에서는 chat_messages에 reaction 컬럼이 있다고 가정하고 null로 설정
    const result = await connection.execute(
      `UPDATE chat_messages SET reaction = NULL WHERE message_id = :messageId`,
      // `UPDATE chat_messages SET reaction = NULL WHERE message_id = :messageId AND user_id = :user_id`, // 사용자 확인 추가 시
      { messageId },
      // { messageId, user_id }, // 사용자 확인 추가 시
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      console.warn(`Warning in removeReactionController: Message with ID ${messageId} not found or reaction not removed.`);
      return res.status(404).json({ error: '메시지를 찾을 수 없거나 리액션이 제거되지 않았습니다. 해당 메시지에 리액션이 없거나, 다른 사용자의 리액션일 수 있습니다.' });
    }
    res.status(200).json({ message: '리액션이 성공적으로 제거되었습니다.' });
  } catch (err) {
    console.error(`Error in removeReactionController for message ${messageId}:`, err);
    res.status(500).json({ error: `리액션 제거 중 오류 발생: ${err.message}` });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection in removeReactionController:', err);
      }
    }
  }
}

// 메시지 삭제 컨트롤러
async function deleteMessageController(req, res) {
  const messageId = req.params.message_id;
  // const user_id = req.user.user_id; // 인증된 사용자 ID (인증 구현 후 사용)

  if (!messageId) {
    console.error('Error in deleteMessageController: Message ID is required.');
    return res.status(400).json({ error: '메시지 ID가 필요합니다.' });
  }
  try {
    // 모델 함수를 사용하여 메시지 삭제 (내부적으로 인가 확인 가정)
    // README.AI에 따라 인가 최소화, 여기서는 user_id를 deleteUserMessageFromDB에 전달하지 않음
    const deleted = await deleteUserMessageFromDB(messageId); 

    if (!deleted) {
      console.warn(`Warning in deleteMessageController: Message with ID ${messageId} not found or not deleted.`);
      // 사용자가 자신의 메시지만 삭제 가능하도록 로직이 모델에 있다면, 403 Forbidden 또는 404 Not Found 반환 가능
      return res.status(404).json({ error: '메시지를 찾을 수 없거나 삭제할 수 없습니다. 이미 삭제되었거나 다른 사용자의 메시지일 수 있습니다.' });
    }
    res.status(200).json({ message: '메시지가 성공적으로 삭제되었습니다.' });
  } catch (err) {
    console.error(`Error in deleteMessageController for message ${messageId}:`, err);
    res.status(500).json({ error: `메시지 삭제 중 오류 발생: ${err.message}` });
  }
}

// 예시: 채팅 메시지 처리 함수
async function handleChatMessage(req, res) {
  try {
    const { sessionId, message } = req.body;
    const user_id = 'test-user-frontend'; // 실제로는 인증 통해 얻어야 함

    // 1. 사용자 메시지 저장 (DB)
    await saveUserMessage(sessionId, user_id, message); // DB 저장 함수 호출 (구현 필요)

    // 2. AI 응답 가져오기
    const aiResponseText = await getAiResponse(message); // AI 응답 함수 호출

    // 3. AI 메시지 저장 (DB)
    await saveAiMessage(sessionId, aiResponseText); // DB 저장 함수 호출 (구현 필요)

    // 4. 클라이언트에 AI 응답 전송
    res.json({ aiResponse: aiResponseText });

  } catch (error) {
    console.error('채팅 메시지 처리 중 오류 발생:', error); // 서버 로그에 상세 오류 출력

    // 클라이언트에는 항상 JSON 형식의 오류 응답 전송
    res.status(500).json({
      error: '메시지 처리 중 서버 오류가 발생했습니다.',
      details: error.message // 개발 중에는 상세 오류 포함, 운영 시에는 제거 고려
    });
  }
}

// 사용자 메시지 저장 함수 (예시 - 실제 구현 필요)
async function saveUserMessage(sessionId, user_id, message) {
  // TODO: DB에 사용자 메시지 저장 로직 구현 (models/chat.js 등 활용)
  console.log(`[DB] 사용자 메시지 저장 시도: ${sessionId}, ${user_id}, ${message}`);
  // 예: await ChatModel.saveMessage({ sessionId, user_id, messageType: 'user', messageContent: message });
}

// AI 메시지 저장 함수 (예시 - 실제 구현 필요)
async function saveAiMessage(sessionId, message) {
  // TODO: DB에 AI 메시지 저장 로직 구현 (models/chat.js 등 활용)
  const aiUserId = 'ai-system'; // AI를 나타내는 고정 ID 또는 다른 방식 사용
  // console.log(`[DB] AI 메시지 저장 시도: ${sessionId}, ${message}`);
  // await saveAiMessageToDB(sessionId, message, aiUserId); // 수정된 함수 호출
}

// 파일 업로드 처리 함수
async function uploadFile(req, res) {
  const sessionId = req.params.session_id;
  // const user_id = req.user.user_id; // 인증된 사용자 ID

  if (!req.file) {
    console.error('Error in uploadFile: No file uploaded.');
    return res.status(400).json({ error: '업로드할 파일이 없습니다.' });
  }
  if (!sessionId) {
    console.error('Error in uploadFile: Session ID is required.');
    return res.status(400).json({ error: '세션 ID가 필요합니다.' });
  }
  // 사용자 요청: 인증/보안 기능 최소화. user_id는 임시로 'guest' 또는 요청에서 가져오도록 처리 (실제 환경에서는 인증 필요)
  const user_id = req.body.user_id || 'guest'; // 임시 user_id, 실제로는 인증 통해 받아야 함

  const file = req.file;
  const messageContent = `파일 업로드: ${file.originalname}`; // 또는 파일 정보를 담은 JSON 문자열

  let connection;
  try {
    connection = await getConnection();

    // 1. chat_messages 테이블에 파일 메시지 저장
    const messageResult = await connection.execute(
      `INSERT INTO chat_messages (session_id, user_id, message_type, message_content)
       VALUES (:sessionId, :user_id, 'file', :messageContent)
       RETURNING message_id INTO :messageId`,
      {
        sessionId: sessionId,
        user_id: user_id, // 실제로는 인증된 사용자 ID 사용
        messageContent: messageContent,
        messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      }
    );

    const messageId = messageResult.outBinds.messageId[0];
    if (!messageId) {
        await connection.rollback(); // 오류 발생 시 롤백
        console.error('Error in uploadFile: Failed to save file message to chat_messages.');
        return res.status(500).json({ error: '파일 메시지 저장 중 오류가 발생했습니다.' });
    }

    // 2. attachments 테이블에 첨부 파일 정보 저장 (saveAttachmentToDB 모델 함수 사용)
    // saveAttachmentToDB 함수는 messageId와 file 객체를 인자로 받음
    const attachment = await saveAttachmentToDB(messageId, file, connection); // connection 전달
    if (!attachment) {
        await connection.rollback();
        // 파일 시스템에서 파일 삭제 시도 (선택적)
        // fs.unlinkSync(file.path); 
        console.error('Error in uploadFile: Failed to save attachment details.');
        return res.status(500).json({ error: '첨부 파일 정보 저장 중 오류가 발생했습니다.' });
    }

    await connection.commit(); // 트랜잭션 커밋

    // 업로드된 파일 정보와 메시지 ID 반환
    res.status(201).json({ 
      message: '파일이 성공적으로 업로드되었습니다.',
      messageId: messageId,
      fileInfo: {
        originalname: file.originalname,
        filename: file.filename, // 저장된 파일명 (multer에서 생성)
        path: file.path,         // 저장된 전체 경로
        mimetype: file.mimetype,
        size: file.size
      }
    });

  } catch (err) {
    if (connection) await connection.rollback(); // 오류 발생 시 롤백
    // 업로드된 파일 삭제 (오류 발생 시)
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`Cleaned up uploaded file: ${req.file.path}`);
      } catch (unlinkErr) {
        console.error(`Error cleaning up file ${req.file.path}:`, unlinkErr);
      }
    }
    console.error(`Error in uploadFile for session ${sessionId}:`, err);
    res.status(500).json({ error: `파일 업로드 중 오류 발생: ${err.message}` });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection in uploadFile:', err);
      }
    }  }
}

// 세션의 메시지 목록 조회 컨트롤러
async function getSessionMessagesController(req, res) {
  const sessionId = req.params.session_id;
  
  if (!sessionId) {
    console.error('Error in getSessionMessagesController: Session ID is required.');
    return res.status(400).json({ error: '세션 ID가 필요합니다.' });
  }
  
  try {
    // 세션에 속한 메시지 조회
    const messages = await getSessionMessagesForClient(sessionId);
    
    // 세션이 없거나 메시지가 없어도 빈 배열 반환 (404가 아님)
    res.status(200).json(messages);
  } catch (err) {
    console.error(`Error in getSessionMessagesController for session ${sessionId}:`, err);
    res.status(500).json({ error: `메시지 목록 조회 중 오류 발생: ${err.message}` });
  }
}

module.exports = {
  sendMessageController,
  editMessageController,
  addReactionController,
  deleteMessageController,
  removeReactionController, // 추가
  handleChatMessage, // 예시 함수 export
  uploadFile,
  getSessionMessagesController // 추가
};