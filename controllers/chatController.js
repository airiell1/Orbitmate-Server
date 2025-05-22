const { getConnection, oracledb } = require('../config/database');
const { saveUserMessageToDB, saveAiMessageToDB, deleteUserMessageFromDB, getSessionMessagesForClient, getChatHistoryFromDB } = require('../models/chat'); // getChatHistoryFromDB 추가
const { getAiResponse } = require('../config/vertexai');
const { getOllamaResponse } = require('../config/ollama'); // Ollama 추가
const { clobToString, convertClobFields } = require('../utils/dbUtils'); // convertClobFields import 추가
const path = require('path');
const fs = require('fs');

// 오류 처리 유틸리티 추가
const { createErrorResponse, getHttpStatusByErrorCode, handleOracleError, logError } = require('../utils/errorHandler');

// 채팅 메시지 전송 및 AI 응답 받기 컨트롤러
async function sendMessageController(req, res) {
  const sessionId = req.params.session_id;
  const GUEST_USER_ID = 'guest';
  // aiProvider와 ollama_model 추가
  const { message, systemPrompt, specialModeType, ai_provider, ollama_model } = req.body;

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

    // 3. AI에 요청 (Gemini 또는 Ollama 선택)
    const effectiveSystemPrompt = systemPrompt && systemPrompt.trim() ? systemPrompt.trim() : null;
    
    let aiResponseFull;
    let aiSource; // AI 응답 출처를 기록하기 위한 변수
    let isOllamaStream = false;

    if (ai_provider === 'ollama') {
      aiSource = 'Ollama';
      const modelToUse = ollama_model || 'gemma3:4b'; // 기본 모델 gemma3:4b
      console.log(`Using Ollama model: ${modelToUse}, specialModeType: ${specialModeType}`);

      if (specialModeType === 'stream') {
        isOllamaStream = true;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // 스트리밍 ID 먼저 전송 (userMessageId는 위에서 이미 확보됨)
        // AI 메시지 ID는 AI 응답 저장 후 알 수 있으므로, 여기서는 우선 userMessageId만 보내거나,
        // 또는 AI 응답을 받기 시작했다는 신호와 함께 userMessageId를 보낼 수 있습니다.
        // 우선 userMessageId만 보내고, AI 메시지 ID는 스트림 종료 후 별도 이벤트로 보내거나,
        // 클라이언트가 최종 응답 객체를 통해 받도록 합니다.
        // 여기서는 스트림 시작 시 userMessageId와 임시 aiMessageId 플레이스홀더를 보낼 수 있습니다.
        // 또는, ID를 스트림 데이터와 함께 보내지 않고, 스트림 종료 후 한번에 보낼 수도 있습니다.
        // Gemini 스트림 방식과 유사하게 ID를 먼저 보내는 구조를 유지하려면,
        // AI 메시지 저장 전에 ID를 예측하거나 임시 ID를 사용해야 합니다.
        // 여기서는 우선 스트림 청크만 보내고, ID는 나중에 처리하는 방향으로 단순화합니다.
        // res.write(`event: ids\\ndata: ${JSON.stringify({ userMessageId: userMessageId.toString(), tempAiMessageId: "streaming..." })}\\n\\n`);


        let accumulatedChunks = "";
        try {
          aiResponseFull = await getOllamaResponse(
            modelToUse,
            message,
            chatHistoryForAI,
            effectiveSystemPrompt,
            (chunk) => { // streamResponseCallback
              if (chunk) {
                accumulatedChunks += chunk;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\\n\\n`);
              }
            }
          );
          // 스트림 종료 후 aiResponseFull에는 전체 내용이 담겨있음
          if (!aiResponseFull || typeof aiResponseFull.content !== 'string') {
             // 스트림 콜백 내에서 오류가 발생했거나, 최종 resolve된 내용이 없을 경우
            console.error('Ollama stream finished but no valid content was accumulated.');
            // 스트림이 이미 시작되었으므로, 여기서 500 에러를 보내는 것은 적절하지 않을 수 있음.
            // 클라이언트에 에러 이벤트를 보내고 연결을 종료해야 함.
            res.write(`event: error\\ndata: ${JSON.stringify({ message: 'AI 스트리밍 중 오류 발생 또는 내용 없음' })}\\n\\n`);
            res.end();
            // DB 롤백 및 연결 종료는 finally 블록에서 처리되도록 여기서 바로 return.
            // 다만, connection.rollback()은 여기서 호출해주는 것이 좋을 수 있음.
            if (connection) await connection.rollback();
            return; 
          }
          // console.log("Ollama stream finished. Full content:", aiResponseFull.content);
          res.write(`event: end\\ndata: ${JSON.stringify({ message: 'Stream ended' })}\\n\\n`);
          // 스트림이 정상 종료되었으므로 res.end()는 여기서 호출하지 않고,
          // AI 메시지 저장 후 최종 응답을 보내는 로직에서 처리하거나,
          // 또는 여기서 res.end()를 호출하고, DB 저장은 백그라운드로 처리할 수도 있습니다.
          // 현재 구조에서는 스트림 종료 후 DB 저장 및 최종 응답 전송이 이어지므로, res.end()는 나중에.
        } catch (streamError) {
          console.error('Error during Ollama stream processing in controller:', streamError);
          if (connection) await connection.rollback();
          // 클라이언트에 오류 알림
          if (!res.headersSent) { // 헤더가 아직 전송되지 않았다면 오류 응답 가능
            return res.status(500).json(createErrorResponse('AI_STREAM_ERROR', 'Ollama 스트리밍 중 오류가 발생했습니다.'));
          } else { // 이미 스트림이 시작되었다면
            res.write(`event: error\\ndata: ${JSON.stringify({ message: 'Ollama 스트리밍 중 심각한 오류 발생' })}\\n\\n`);
            res.end(); // 스트림 강제 종료
            return;
          }
        }
      } else { // Ollama 비스트리밍
        aiResponseFull = await getOllamaResponse(modelToUse, message, chatHistoryForAI, effectiveSystemPrompt);
      }
    } else { // Gemini 사용 (기존 로직)
      aiSource = 'Vertex AI (Gemini)';
      console.log('Using Vertex AI (Gemini)');
      // Gemini의 경우 specialModeType에 따라 getAiResponse 내부에서 스트리밍 등을 처리
      aiResponseFull = await getAiResponse(message, chatHistoryForAI, effectiveSystemPrompt, specialModeType, (chunk, isFinalChunk) => {
        if (specialModeType === 'stream' && chunk) {
          // Gemini 스트리밍 콜백 (기존 로직과 유사하게 처리)
          // 이 부분은 getAiResponse가 스트리밍을 직접 res 객체에 쓰지 않는다고 가정하고,
          // 청크를 받아서 컨트롤러가 직접 res.write 하는 방식입니다.
          // 만약 getAiResponse가 직접 res를 다룬다면 이 콜백은 다르게 사용될 수 있습니다.
          // 현재 getAiResponse는 전체 텍스트를 반환하거나 스트림 콜백을 통해 청크를 전달하는 방식이므로,
          // 여기서 res.write를 직접 호출합니다.
          if (!res.headersSent && specialModeType === 'stream') {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            // Gemini 스트림 시 ID를 먼저 보내는 부분은 getAiResponse 호출 전에 처리하거나,
            // 첫 청크를 받을 때 함께 보낼 수 있습니다.
            // 여기서는 userMessageId와 임시 aiMessageId를 보냅니다.
            // res.write(`event: ids\\ndata: ${JSON.stringify({ userMessageId: userMessageId.toString(), tempAiMessageId: "gemini_streaming..." })}\\n\\n`);
          }
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\\n\\n`);
          if (isFinalChunk) {
            res.write(`event: end\\ndata: ${JSON.stringify({ message: 'Stream ended' })}\\n\\n`);
            // Gemini 스트림의 경우, isFinalChunk 이후에 aiResponseFull이 완성된 내용을 가질 것으로 예상.
            // 또는 getAiResponse 자체가 최종 내용을 반환.
          }
        }
      });
    }

    if (!aiResponseFull || typeof aiResponseFull.content !== 'string' || aiResponseFull.content.trim() === '') {
      if (connection) await connection.rollback();
      console.error(`Invalid AI response received from ${aiSource}:`, aiResponseFull);
      // 스트림이 이미 시작된 경우 오류 처리가 다를 수 있음
      if ((specialModeType === 'stream' && ai_provider === 'ollama' && res.headersSent) || (specialModeType === 'stream' && ai_provider !== 'ollama' && res.headersSent)) {
        // 이미 스트림 데이터가 전송된 경우, 여기서 JSON 오류를 보내면 안됨.
        // 스트림 채널을 통해 오류를 알리고 종료해야 함.
        if (!isOllamaStream) { // Gemini 스트림 또는 Ollama 스트림에서 content가 비어있는 경우 (Ollama는 위에서 처리됨)
             res.write(`event: error\\ndata: ${JSON.stringify({ message: `${aiSource}로부터 유효한 응답을 받지 못했습니다.` })}\\n\\n`);
             res.end();
        }
        // Ollama 스트림의 경우 위에서 이미 처리되었으므로, 여기서는 추가 동작 없음.
        return; 
      }
      return res.status(500).json(createErrorResponse('AI_RESPONSE_ERROR', `${aiSource}로부터 유효한 응답을 받지 못했습니다. 응답 내용이 비어있거나 형식이 잘못되었습니다.`));
    }
    const aiContent = aiResponseFull.content;

    // 4. AI 응답 저장
    const aiMessageResult = await saveAiMessageToDB(connection, sessionId, GUEST_USER_ID, aiContent);
    if (!aiMessageResult || !aiMessageResult.ai_message_id) {
      if (connection) await connection.rollback();
      // 스트림이 진행중이었다면 클라이언트에 오류 알림
      if ((isOllamaStream && res.headersSent) || (specialModeType === 'stream' && ai_provider !== 'ollama' && res.headersSent)) {
          res.write(`event: error\\ndata: ${JSON.stringify({ message: 'AI 메시지 저장 실패' })}\\n\\n`);
          res.end();
          return;
      }
      return res.status(500).json(createErrorResponse('DB_ERROR', 'AI 메시지 저장에 실패했습니다.'));
    }
    const aiMessageId = aiMessageResult.ai_message_id.toString();
    const aiCreatedAt = aiMessageResult.created_at;
    const actualAiContentSaved = aiMessageResult.content; 

    await connection.commit(); 

    // 5. 클라이언트에 응답 전송
    const responseData = {
      user_message_id: userMessageId.toString(),
      ai_message_id: aiMessageId,
      message: actualAiContentSaved, 
      created_at: aiCreatedAt ? new Date(aiCreatedAt).toISOString() : new Date().toISOString(),
      ai_source: aiSource // AI 출처 정보 추가
    };
    
    // Gemini 스트리밍의 경우, getAiResponse 콜백에서 res.write를 직접 호출했거나,
    // 또는 specialModeType === 'stream' && ai_provider !== 'ollama' (Gemini) 경우에 대한 스트리밍 처리가 필요.
    // 현재 Gemini 스트리밍은 getAiResponse의 콜백을 통해 청크를 받고, 이 컨트롤러에서 res.write를 수행하는 것으로 가정.

    if (specialModeType === 'stream') {
      if (ai_provider === 'ollama') {
        // Ollama 스트림의 경우, 청크는 이미 전송되었고, 'end' 이벤트도 전송됨.
        // DB 저장 후 최종 ID 등을 포함한 완료 메시지를 보낼 수 있으나,
        // 여기서는 스트림이 이미 res.end() 되었거나, 될 예정이므로 추가 전송은 하지 않음.
        // 만약 res.end()가 호출되지 않았다면 여기서 호출.
        if (!res.writableEnded) {
            // ID 정보를 포함한 최종 메시지를 보낼 수 있음
            // res.write(`event: final_ids\\ndata: ${JSON.stringify({ userMessageId: responseData.user_message_id, aiMessageId: responseData.ai_message_id })}\\n\\n`);
            res.end();
        }
        return; // Ollama 스트림 처리 완료
      } else { // Gemini 스트림 (또는 다른 잠재적 스트리밍 AI 프로바이더)
        // Gemini 스트림의 경우, getAiResponse 콜백에서 청크와 end 이벤트가 처리되었을 것으로 가정.
        // 만약 getAiResponse가 res 객체를 직접 다루지 않았다면, 여기서 ID 전송 및 스트림 종료 필요.
        if (!res.headersSent) { // 스트림이 시작되지 않은 경우 (예: getAiResponse가 스트림 콜백을 호출하지 않은 경우)
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
        }
        if (!res.writableEnded) {
            // Gemini 스트림의 경우 ID를 여기서 보내거나, 첫 청크와 함께 보냈어야 함.
            // 이미 userMessageId는 알고 있고, aiMessageId도 이제 확정됨.
            res.write(`event: ids\\ndata: ${JSON.stringify({ userMessageId: responseData.user_message_id, aiMessageId: responseData.ai_message_id })}\\n\\n`);
            
            // Gemini 응답이 단일 청크로 오는 경우 (스트림이지만 실제로는 한 번에)
            // 또는 getAiResponse가 스트리밍 콜백을 호출하지 않고 전체 내용을 반환한 경우
            if (responseData.message) {
                 res.write(`data: ${JSON.stringify({ type: 'chunk', content: responseData.message })}\\n\\n`);
            }
            res.write(`event: end\\ndata: ${JSON.stringify({ message: 'Stream ended' })}\\n\\n`);
            res.end();
        }
        return; // Gemini 스트림 처리 완료
      }
    } else { // 비스트리밍 응답 (Gemini non-stream, Ollama non-stream, Canvas 등)
      if (specialModeType === 'canvas' && ai_provider !== 'ollama') { // Ollama는 아직 canvas 직접 지원 안함
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