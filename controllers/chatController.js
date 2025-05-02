const { getChatHistoryFromDB, saveUserMessageToDB, saveAiMessageToDB, deleteUserMessageFromDB } = require('../models/chat');
const { getAiResponse } = require('../config/vertexai');
const { getConnection, oracledb } = require('../config/database');
const chatModel = require('../models/chat');
const path = require('path');

// 채팅 메시지 전송 및 AI 응답 받기 컨트롤러
async function sendMessageController(req, res) {
  const sessionId = req.params.session_id;
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: '메시지 내용은 비어 있을 수 없습니다.' });
  }

  try {
    // 1. 사용자 메시지 DB 저장
    const userMessageId = await saveUserMessageToDB(sessionId, message);
    console.log(`[${sessionId}] 사용자 메시지 저장 완료 (ID: ${userMessageId})`);

    // 2. 해당 세션의 전체 대화 기록 조회
    const history = await getChatHistoryFromDB(sessionId);
    console.log(`[${sessionId}] 대화 기록 조회 완료 (메시지 ${history.length}개)`);

    // 3. 대화 기록과 새 메시지를 Vertex AI에 전송
    const aiResponse = await getAiResponse(message, history);
    console.log(`[${sessionId}] AI 응답 수신 완료`);

    // 4. AI 응답 DB 저장
    const aiMessageId = await saveAiMessageToDB(sessionId, aiResponse);
    console.log(`[${sessionId}] AI 메시지 저장 완료 (ID: ${aiMessageId})`);

    // 5. 응답 반환
    res.json({
      message: aiResponse,
      user_message_id: userMessageId,
      ai_message_id: aiMessageId,
      created_at: new Date().toISOString()
    });

  } catch (err) {
    console.error('메시지 처리 실패:', err);
    // Vertex AI 안전 설정 차단 오류 처리
    if (err.message.includes('안전 설정에 의해 차단')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: `메시지 처리 중 오류 발생: ${err.message}` });
  }
}

// 메시지 편집 컨트롤러
async function editMessageController(req, res) {
  const messageId = req.params.message_id;
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: '메시지 내용이 필요합니다.' });
  }
  
  let connection;
  try {
    connection = await getConnection();
    
    // 메시지 업데이트
    await connection.execute(
      `UPDATE chat_messages 
       SET message_content = :content, is_edited = 1, edited_at = SYSTIMESTAMP 
       WHERE message_id = :messageId`,
      { 
        messageId: messageId,
        content: content
      },
      { autoCommit: true }
    );
    
    // 업데이트된 메시지 조회
    const result = await connection.execute(
      `SELECT message_id, user_id, message_type, message_content, created_at,
              reaction, is_edited, edited_at, parent_message_id, session_id
       FROM chat_messages
       WHERE message_id = :messageId`,
      { messageId: messageId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
    }
    
    const message = result.rows[0];
    
    res.json({
      message_id: message.MESSAGE_ID,
      user_id: message.USER_ID,
      message_type: message.MESSAGE_TYPE,
      message_content: message.MESSAGE_CONTENT,
      created_at: message.CREATED_AT,
      edited_at: message.EDITED_AT,
      is_edited: message.IS_EDITED === 1,
      session_id: message.SESSION_ID
    });
    
  } catch (err) {
    console.error('메시지 편집 실패:', err);
    res.status(500).json({ error: `메시지 편집 중 오류 발생: ${err.message}` });
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

// 메시지 리액션 추가 컨트롤러
async function addReactionController(req, res) {
  const messageId = req.params.message_id;
  const { reaction } = req.body;
  
  if (!reaction) {
    return res.status(400).json({ error: '리액션 값이 필요합니다.' });
  }
  
  let connection;
  try {
    connection = await getConnection();
    
    // 리액션 업데이트
    await connection.execute(
      `UPDATE chat_messages SET reaction = :reaction WHERE message_id = :messageId`,
      { 
        messageId: messageId,
        reaction: reaction
      },
      { autoCommit: true }
    );
    
    res.json({
      message_id: messageId,
      reaction: reaction,
      updated_at: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('리액션 추가 실패:', err);
    res.status(500).json({ error: `리액션 추가 중 오류 발생: ${err.message}` });
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

// 메시지 리액션 제거 컨트롤러
async function removeReactionController(req, res) {
  const messageId = req.params.message_id;
  // const userId = req.user.userId; // 인증된 사용자 ID, 필요시 인가 로직에 사용

  let connection;
  try {
    connection = await getConnection();

    // TODO: (선택 사항) 해당 세션 참여자인지 확인하는 로직 추가
    // 예: 메시지 ID로 세션 ID 조회 -> 세션 ID와 사용자 ID로 참여 여부 확인

    // 리액션 제거 (NULL로 업데이트)
    const result = await connection.execute(
      `UPDATE chat_messages SET reaction = NULL WHERE message_id = :messageId`,
      { messageId: messageId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      // 메시지가 없거나 이미 리액션이 없는 경우 등
      // 404를 반환할 수도 있지만, 멱등성을 고려하여 성공으로 처리할 수도 있음
      // 여기서는 메시지 자체가 없을 경우를 대비해 404 반환
      const checkMessage = await connection.execute(
          `SELECT 1 FROM chat_messages WHERE message_id = :messageId`,
          { messageId: messageId }
      );
      if (checkMessage.rows.length === 0) {
          return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
      }
      // 메시지는 있지만 업데이트가 안 된 경우 (이미 NULL 등) - 성공으로 간주
    }

    console.log(`메시지 리액션 제거 완료 (ID: ${messageId})`);
    res.status(200).json({ message: '리액션이 성공적으로 제거되었습니다.', message_id: messageId });

  } catch (err) {
    console.error('리액션 제거 실패:', err);
    res.status(500).json({ error: `리액션 제거 중 오류 발생: ${err.message}` });
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

// 메시지 삭제 컨트롤러
async function deleteMessageController(req, res) {
  const messageId = req.params.message_id;
  const userId = req.user.userId; // JWT 미들웨어에서 추가된 사용자 ID

  if (!userId) {
    return res.status(401).json({ error: '인증되지 않은 사용자입니다.' });
  }
  if (!messageId) {
    return res.status(400).json({ error: '메시지 ID가 필요합니다.' });
  }

  try {
    // 모델 함수를 사용하여 메시지 삭제 및 소유권 확인
    const deletedCount = await deleteUserMessageFromDB(messageId, userId);

    if (deletedCount === 0) {
      // 메시지가 없거나, 사용자가 해당 메시지의 소유자가 아니거나, AI 메시지인 경우
      // AI 메시지는 이 API로 삭제할 수 없다고 가정
      return res.status(404).json({ error: '삭제할 메시지를 찾을 수 없거나 권한이 없습니다.' });
    }

    res.status(200).json({ message: '메시지가 성공적으로 삭제되었습니다.' });

  } catch (err) {
    console.error('메시지 삭제 컨트롤러 오류:', err);
    res.status(500).json({ error: `메시지 삭제 중 오류 발생: ${err.message}` });
  }
}

// 예시: 채팅 메시지 처리 함수
async function handleChatMessage(req, res) {
  try {
    const { sessionId, message } = req.body;
    const userId = 'test-user-frontend'; // 실제로는 인증 통해 얻어야 함

    // 1. 사용자 메시지 저장 (DB)
    await saveUserMessage(sessionId, userId, message); // DB 저장 함수 호출 (구현 필요)

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
async function saveUserMessage(sessionId, userId, message) {
  // TODO: DB에 사용자 메시지 저장 로직 구현 (models/chat.js 등 활용)
  console.log(`[DB] 사용자 메시지 저장 시도: ${sessionId}, ${userId}, ${message}`);
  // 예: await ChatModel.saveMessage({ sessionId, userId, messageType: 'user', messageContent: message });
}

// AI 메시지 저장 함수 (예시 - 실제 구현 필요)
async function saveAiMessage(sessionId, message) {
  // TODO: DB에 AI 메시지 저장 로직 구현 (models/chat.js 등 활용)
  const aiUserId = 'ai-system'; // AI를 나타내는 고정 ID 또는 다른 방식 사용
  console.log(`[DB] AI 메시지 저장 시도: ${sessionId}, ${message}`);
  // 예: await ChatModel.saveMessage({ sessionId, userId: aiUserId, messageType: 'ai', messageContent: message });
}

// 파일 업로드 처리 함수
async function uploadFile(req, res) {
    const { session_id } = req.params;
    const userId = req.user.userId; // authMiddleware에서 설정된 사용자 ID
    const file = req.file; // multer가 처리한 파일 정보

    if (!file) {
        return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    try {
        // 1. 파일 정보를 포함하는 메시지 생성 (예: "파일 [파일명]이 업로드되었습니다.")
        //    실제 파일 내용을 AI에게 보내는 것은 아니므로, 간단한 텍스트 메시지로 처리
        const messageContent = `파일 업로드: ${file.originalname}`;
        const messageType = 'file'; // 메시지 타입을 'file'로 지정

        // 2. 파일 정보와 함께 메시지를 DB에 저장
        //    chatModel.saveUserMessageToDB 함수를 수정하거나 새 함수를 만들어야 함
        //    여기서는 file 객체의 정보 (filename, path, mimetype, size 등)를 함께 저장한다고 가정
        const messageData = {
            session_id: parseInt(session_id, 10),
            user_id: userId,
            content: messageContent,
            message_type: messageType, // 메시지 타입 추가
            file_path: file.path, // 서버 내 저장 경로
            original_filename: file.originalname,
            mime_type: file.mimetype,
            file_size: file.size
        };

        const savedMessage = await chatModel.saveMessageToDB(messageData); // 수정된 또는 새 함수 호출

        // 3. 클라이언트에 성공 응답 전송 (저장된 메시지 정보 포함)
        res.status(201).json({
            message: '파일이 성공적으로 업로드되었습니다.',
            uploadedFile: {
                message_id: savedMessage.message_id,
                filename: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                upload_timestamp: savedMessage.created_at // DB에서 반환된 타임스탬프 사용
            }
        });

    } catch (error) {
        console.error('파일 업로드 처리 중 오류 발생:', error);
        // 파일 시스템에 저장된 파일 삭제 (롤백)
        if (file && file.path) {
            const fs = require('fs');
            fs.unlink(file.path, (err) => {
                if (err) console.error('업로드 실패 후 파일 삭제 중 오류:', err);
            });
        }
        res.status(500).json({ error: '파일 업로드 중 서버 오류가 발생했습니다.' });
    }
};

module.exports = {
  sendMessageController,
  editMessageController,
  addReactionController,
  deleteMessageController,
  removeReactionController, // 추가
  handleChatMessage, // 예시 함수 export
  uploadFile
};