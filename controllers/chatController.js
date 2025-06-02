const { getConnection, oracledb } = require('../config/database'); // Removed getConnection
const { saveUserMessageToDB, saveAiMessageToDB, deleteUserMessageFromDB, getSessionMessagesForClient, getChatHistoryFromDB, saveAttachmentToDB } = require('../models/chat'); // getChatHistoryFromDB 추가, saveAttachmentToDB 추가
const { getUserSettings } = require('../models/user'); // getUserSettings 추가
const { fetchChatCompletion } = require('../utils/aiProvider'); // Updated import
const { convertClobFields, withTransaction } = require('../utils/dbUtils'); // convertClobFields import 추가, withTransaction 추가
const { standardizeApiResponse } = require('../utils/apiResponse'); // Import standardizeApiResponse
const path = require('path');
const fs = require('fs');

// 오류 처리 유틸리티 추가
const { createErrorResponse, getHttpStatusByErrorCode, handleOracleError, logError } = require('../utils/errorHandler');

// 채팅 메시지 전송 및 AI 응답 받기 컨트롤러
async function sendMessageController(req, res) {
  const { session_id } = req.params;
  const { 
    message, 
    systemPrompt, 
    specialModeType,
    max_output_tokens_override,
    context_message_limit,
    ai_provider_override,
    model_id_override,
    user_message_token_count 
  } = req.body;

  // Validation for sessionId
  if (!session_id || typeof session_id !== 'string' || session_id.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '세션 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (session_id.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '세션 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Validation for message
  if (!message || typeof message !== 'string' || message.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지를 입력해주세요.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (message.length > 4000) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지가 너무 깁니다 (최대 4000자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Validation for systemPrompt
  if (systemPrompt && (typeof systemPrompt !== 'string' || systemPrompt.length > 2000)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '시스템 프롬프트는 문자열이어야 하며 최대 2000자입니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  
  // Validation for specialModeType
  const allowedSpecialModeTypes = ['stream', 'canvas'];
  if (specialModeType && !allowedSpecialModeTypes.includes(specialModeType)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `잘못된 specialModeType 값입니다. 허용되는 값: ${allowedSpecialModeTypes.join(', ')}.`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  const user_id = req.user ? req.user.user_id : 'guest';

  // Additional validation for new optional parameters
  if (max_output_tokens_override !== undefined && (typeof max_output_tokens_override !== 'number' || !Number.isInteger(max_output_tokens_override) || max_output_tokens_override <= 0)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', 'max_output_tokens_override는 양의 정수여야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (context_message_limit !== undefined && (typeof context_message_limit !== 'number' || !Number.isInteger(context_message_limit) || context_message_limit < 0)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', 'context_message_limit는 0 이상의 정수여야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (ai_provider_override !== undefined && typeof ai_provider_override !== 'string') {
    const errorPayload = createErrorResponse('INVALID_INPUT', 'ai_provider_override는 문자열이어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (model_id_override !== undefined && typeof model_id_override !== 'string') {
    const errorPayload = createErrorResponse('INVALID_INPUT', 'model_id_override는 문자열이어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (user_message_token_count !== undefined && (typeof user_message_token_count !== 'number' || !Number.isInteger(user_message_token_count) || user_message_token_count < 0)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', 'user_message_token_count는 0 이상의 정수여야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  let connection;

  try {
    connection = await getConnection();
    
    // AI 제공자 및 모델 정보 결정
    let actualAiProvider = 'ollama'; // 기본값
    let actualModelId = 'gemma3:4b'; // 기본 Ollama 모델
    
    // 사용자 설정에서 AI 제공자 확인
    const userSettings = await getUserSettings(user_id);
    if (userSettings && userSettings.preferred_ai_provider) {
      actualAiProvider = userSettings.preferred_ai_provider;
      if (actualAiProvider === 'ollama' && userSettings.preferred_ollama_model) {
        actualModelId = userSettings.preferred_ollama_model;
      }
    }

    const responseData = await withTransaction(async (connection) => {
      const userMessageTokenCountToStore = user_message_token_count !== undefined ? user_message_token_count : null;
      const userMessageResult = await saveUserMessageToDB(connection, session_id, user_id, message, userMessageTokenCountToStore);
      
      if (!userMessageResult || !userMessageResult.user_message_id) {
        const err = new Error('사용자 메시지 저장에 실패했습니다.');
        err.code = 'DB_ERROR';
        throw err;
      }

      const userMessageId = userMessageResult.user_message_id;

      const effectiveContextLimit = context_message_limit !== undefined ? context_message_limit : null;
      let chatHistoryForAI = await getChatHistoryFromDB(connection, session_id, false, effectiveContextLimit);

      const effectiveSystemPrompt = systemPrompt && systemPrompt.trim() ? systemPrompt.trim() : null;
      
      // Determine AI Provider and Model
      const defaultUserProvider = process.env.DEFAULT_AI_PROVIDER || 'ollama';
      const actualAiProvider = ai_provider_override || defaultUserProvider;

      let actualModelId = model_id_override;
      if (!actualModelId) {
          if (actualAiProvider === 'ollama') {
              actualModelId = process.env.OLLAMA_MODEL || 'gemma3:4b'; // Default Ollama model
          } else if (actualAiProvider === 'vertexai') {
              actualModelId = process.env.VERTEX_AI_MODEL || 'gemini-2.5-pro-exp-03-25';
          }
      }
      
      // This variable is for the second (ollamaModel) parameter of fetchChatCompletion
      // In fetchChatCompletion, this is now options.ollamaModel
      // For clarity, when calling fetchChatCompletion, we will set options.ollamaModel if actualAiProvider is ollama.
      // The second direct parameter to fetchChatCompletion is currentUserMessage.

      const callOptions = {
          max_output_tokens_override: max_output_tokens_override, // from req.body
          // Pass the resolved or overridden model_id specific to the provider
          // fetchChatCompletion will then use this in its own options.ollamaModel or options.vertexModelId
          model_id_override: actualModelId 
      };
      
      // If the determined provider is ollama, set ollamaModel in callOptions
      // This ensures fetchChatCompletion gets the correct model for ollama via its options parameter.
      if (actualAiProvider === 'ollama') {
          callOptions.ollamaModel = actualModelId;
      }


      // Updated AI call
      const aiResponseFull = await fetchChatCompletion(
          actualAiProvider,           // Provider to use
          message,                    // Current user message
          chatHistoryForAI,           // History
          effectiveSystemPrompt,      // System prompt
          specialModeType,            // e.g., 'canvas', 'stream'
          null,                       // streamResponseCallback - PASSING NULL
          callOptions                 // Options object
      );

      if (!aiResponseFull || typeof aiResponseFull.content !== 'string' || aiResponseFull.content.trim() === '') {
        console.error('Invalid AI response received:', aiResponseFull);
        const err = new Error('AI로부터 유효한 응답을 받지 못했습니다. 응답 내용이 비어있거나 형식이 잘못되었습니다.');
        err.code = 'AI_RESPONSE_ERROR';
        throw err;

      }
      const aiContentFromVertex = aiResponseFull.content;
      const aiMessageTokenCountToStore = aiResponseFull.actual_output_tokens !== undefined ? aiResponseFull.actual_output_tokens : null;

      const aiMessageResult = await saveAiMessageToDB(connection, session_id, GUEST_USER_ID, aiContentFromVertex, aiMessageTokenCountToStore);

      if (!aiMessageResult || !aiMessageResult.ai_message_id) {
        const err = new Error('AI 메시지 저장에 실패했습니다.');
        err.code = 'DB_ERROR';
        throw err;
      }
      const aiMessageId = aiMessageResult.ai_message_id.toString();
      const aiCreatedAt = aiMessageResult.created_at;
      const actualAiContentSaved = aiMessageResult.content;

      return {
        user_message_id: userMessageId.toString(),
        ai_message_id: aiMessageId,
        message: actualAiContentSaved,
        created_at: aiCreatedAt ? new Date(aiCreatedAt).toISOString() : new Date().toISOString(),
        ai_message_token_count: aiMessageTokenCountToStore // Include in response
      };
    });

    // Send response based on responseData (non-streaming part)
    if (specialModeType === 'stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      res.write(`event: ids\\ndata: ${JSON.stringify({ userMessageId: responseData.user_message_id, aiMessageId: responseData.ai_message_id })}\\n\\n`);

      const chunkSize = 100;
      for (let i = 0; i < responseData.message.length; i += chunkSize) {
        const chunk = responseData.message.substring(i, i + chunkSize);
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\\n\\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      res.write(`event: end\\ndata: ${JSON.stringify({ message: 'Stream ended' })}\\n\\n`);
      return;    } else {
      // AI 제공자 및 모델 정보 추가
      responseData.ai_provider = actualAiProvider; // selectedAiProvider -> actualAiProvider로 수정
      if (actualAiProvider === 'ollama') { // selectedAiProvider -> actualAiProvider로 수정
        responseData.ollama_model = actualModelId; // selectedOllamaModel -> actualModelId로 수정 (일관성 유지)
      }

      if (specialModeType === 'canvas') {
        const htmlRegex = /```html\n([\s\S]*?)\n```/;
        const cssRegex = /```css\n([\s\S]*?)\n```/;
        const jsRegex = /```javascript\n([\s\S]*?)\n```/;
        const htmlMatch = responseData.message.match(htmlRegex);
        const cssMatch = responseData.message.match(cssRegex);
        const jsMatch = responseData.message.match(jsRegex);
        responseData.canvas_html = htmlMatch ? htmlMatch[1].trim() : '';
        responseData.canvas_css = cssMatch ? cssMatch[1].trim() : '';
        responseData.canvas_js = jsMatch ? jsMatch[1].trim() : '';
      }
      // AI 제공자 및 모델 정보 추가
      responseData.ai_provider = actualAiProvider; // The provider that was actually used
      responseData.model_id = actualModelId;       // The model_id that was actually used or resolved
      
      if (specialModeType === 'canvas') {
        const htmlRegex = /```html\n([\s\S]*?)\n```/;
        const cssRegex = /```css\n([\s\S]*?)\n```/;
        const jsRegex = /```javascript\n([\s\S]*?)\n```/;
        const htmlMatch = responseData.message.match(htmlRegex);
        const cssMatch = responseData.message.match(cssRegex);
        const jsMatch = responseData.message.match(jsRegex);
        responseData.canvas_html = htmlMatch ? htmlMatch[1].trim() : '';
        responseData.canvas_css = cssMatch ? cssMatch[1].trim() : '';
        responseData.canvas_js = jsMatch ? jsMatch[1].trim() : '';
      }
      res.json(standardizeApiResponse(responseData));
    }
  } catch (err) {
    logError('chatControllerSendMessage', err);
    // Error handling remains, but rollback/close is handled by withTransaction
    if (err.code === 'DB_BIND_ERROR' || (err.message && err.message.includes('NJS-044'))) { // NJS-044 is an example, adjust if needed
        const errorPayload = createErrorResponse('DB_BIND_ERROR', `데이터베이스 바인딩 오류: ${err.message}`);
        return res.status(getHttpStatusByErrorCode('DB_BIND_ERROR')).json(standardizeApiResponse(errorPayload));
    }
    if (err.code === 'SESSION_NOT_FOUND' || (err.message && err.message.startsWith("세션 ID"))) { 
        const errorPayload = createErrorResponse('SESSION_NOT_FOUND', err.message);
        return res.status(getHttpStatusByErrorCode('SESSION_NOT_FOUND')).json(standardizeApiResponse(errorPayload));
    }
     if (err.code === 'DB_ERROR') {
        const errorPayload = createErrorResponse('DB_ERROR', err.message);
        return res.status(getHttpStatusByErrorCode('DB_ERROR')).json(standardizeApiResponse(errorPayload));
    }
    if (err.code === 'AI_RESPONSE_ERROR') {
        const errorPayload = createErrorResponse('AI_RESPONSE_ERROR', err.message);
        return res.status(getHttpStatusByErrorCode('AI_RESPONSE_ERROR')).json(standardizeApiResponse(errorPayload));
    }
    if (err.errorNum) { 
      const handledError = handleOracleError(err);
      return res.status(getHttpStatusByErrorCode(handledError.code)).json(standardizeApiResponse(handledError));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `메시지 처리 중 서버 오류가 발생했습니다: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 메시지 편집 컨트롤러
async function editMessageController(req, res) {
  const messageId = req.params.message_id;
  const { content } = req.body;

  // Validation for messageId
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (messageId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Validation for content
  if (!content || typeof content !== 'string' || content.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 내용은 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (content.length > 4000) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 내용이 너무 깁니다 (최대 4000자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  
  try {
    const updatedMessageData = await withTransaction(async (connection) => {
      const result = await connection.execute(
        `UPDATE chat_messages SET message_content = :content, edited_at = SYSTIMESTAMP, is_edited = 1 WHERE message_id = :messageId`,
        { content, messageId },
        { autoCommit: false } // withTransaction handles commit
      );

      if (result.rowsAffected === 0) {
        // console.warn(`Warning in editMessageController: Message with ID ${messageId} not found or not updated.`); // Kept for now
        const errorPayload = createErrorResponse('MESSAGE_NOT_FOUND', '메시지를 찾을 수 없거나 업데이트되지 않았습니다.');
        const err = new Error(errorPayload.error.message);
        err.code = 'MESSAGE_NOT_FOUND';
        throw err;
      }
      
      const editedMessageResult = await connection.execute(
          `SELECT message_id, session_id, user_id, message_type, message_content, created_at, edited_at, is_edited 
           FROM chat_messages 
           WHERE message_id = :messageId`,
          { messageId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (editedMessageResult.rows.length === 0) {
          // console.error(`Error in editMessageController: Edited message with ID ${messageId} not found after update.`); // Kept for now
          const errorPayload = createErrorResponse('MESSAGE_NOT_FOUND', '편집된 메시지를 찾을 수 없습니다.');
          const err = new Error(errorPayload.error.message);
          err.code = 'MESSAGE_NOT_FOUND';
          throw err;
      }
      return await convertClobFields(editedMessageResult.rows[0]);
    });

    res.status(200).json(standardizeApiResponse({ message: '메시지가 성공적으로 수정되었습니다.', updated_message: updatedMessageData }));
  } catch (err) {
    logError('chatControllerEditMessage', err);
    if (err.code === 'MESSAGE_NOT_FOUND') {
        const errorPayload = createErrorResponse(err.code, err.message);
        return res.status(getHttpStatusByErrorCode(err.code)).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `메시지 수정 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 메시지 리액션 추가 컨트롤러
async function addReactionController(req, res) {
  const messageId = req.params.message_id;
  const { reaction } = req.body;

  // Validation for messageId
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (messageId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Validation for reaction
  if (!reaction || typeof reaction !== 'string' || reaction.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '리액션은 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (reaction.length > 10) { // Example: allows for a few emojis
    const errorPayload = createErrorResponse('INVALID_INPUT', '리액션이 너무 깁니다 (최대 10자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  
  try {
    await withTransaction(async (connection) => {
      const result = await connection.execute(
        `UPDATE chat_messages SET reaction = :reaction WHERE message_id = :messageId`,
        { reaction, messageId },
        { autoCommit: false } // withTransaction handles commit
      );

      if (result.rowsAffected === 0) {
        // console.warn(`Warning in addReactionController: Message with ID ${messageId} not found or reaction not added.`);
        const errorPayload = createErrorResponse('MESSAGE_NOT_FOUND', '메시지를 찾을 수 없거나 리액션이 추가되지 않았습니다.');
        const err = new Error(errorPayload.error.message);
        err.code = 'MESSAGE_NOT_FOUND';
        throw err;
      }
    });
    res.status(200).json(standardizeApiResponse({ message: '리액션이 성공적으로 추가되었습니다.' }));
  } catch (err) {
    logError('chatControllerAddReaction', err);
    if (err.code === 'MESSAGE_NOT_FOUND') {
        const errorPayload = createErrorResponse(err.code, err.message);
        return res.status(getHttpStatusByErrorCode(err.code)).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `리액션 추가 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 메시지 리액션 제거 컨트롤러
async function removeReactionController(req, res) {
  const messageId = req.params.message_id;

  // Validation for messageId
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (messageId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    await withTransaction(async (connection) => {
      const result = await connection.execute(
        `UPDATE chat_messages SET reaction = NULL WHERE message_id = :messageId`,
        { messageId },
        { autoCommit: false } // withTransaction handles commit
      );

      if (result.rowsAffected === 0) {
        // console.warn(`Warning in removeReactionController: Message with ID ${messageId} not found or reaction not removed.`);
        const errorPayload = createErrorResponse('MESSAGE_NOT_FOUND', '메시지를 찾을 수 없거나 리액션이 제거되지 않았습니다. 해당 메시지에 리액션이 없거나, 다른 사용자의 리액션일 수 있습니다.');
        const err = new Error(errorPayload.error.message);
        err.code = 'MESSAGE_NOT_FOUND';
        throw err;
      }
    });
    res.status(200).json(standardizeApiResponse({ message: '리액션이 성공적으로 제거되었습니다.' }));
  } catch (err) {
    logError('chatControllerRemoveReaction', err);
     if (err.code === 'MESSAGE_NOT_FOUND') {
        const errorPayload = createErrorResponse(err.code, err.message);
        return res.status(getHttpStatusByErrorCode(err.code)).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `리액션 제거 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 메시지 삭제 컨트롤러
async function deleteMessageController(req, res) {
  const messageId = req.params.message_id;

  // Validation for messageId
  if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (messageId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '메시지 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  try {
    const deleted = await withTransaction(async (connection) => {
        // user_id is not passed to deleteUserMessageFromDB as per previous refactoring
        return await deleteUserMessageFromDB(connection, messageId); 
    });

    if (!deleted) {
      // console.warn(`Warning in deleteMessageController: Message with ID ${messageId} not found or not deleted.`);
      const errorPayload = createErrorResponse('MESSAGE_NOT_FOUND', '메시지를 찾을 수 없거나 삭제할 수 없습니다. 이미 삭제되었거나 다른 사용자의 메시지일 수 있습니다.');
      // This case might be handled inside withTransaction if deleteUserMessageFromDB throws an error for not found.
      // If deleteUserMessageFromDB returns false for not found, this check is needed here.
      return res.status(getHttpStatusByErrorCode('MESSAGE_NOT_FOUND')).json(standardizeApiResponse(errorPayload));
    }
    res.status(200).json(standardizeApiResponse({ message: '메시지가 성공적으로 삭제되었습니다.' }));
  } catch (err) {
    logError('chatControllerDeleteMessage', err);
     if (err.code === 'MESSAGE_NOT_FOUND') { // Assuming deleteUserMessageFromDB might throw this
        const errorPayload = createErrorResponse(err.code, err.message);
        return res.status(getHttpStatusByErrorCode(err.code)).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `메시지 삭제 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 파일 업로드 처리 함수
async function uploadFile(req, res) {
  const sessionId = req.params.session_id;

  // Validation for sessionId
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '세션 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (sessionId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '세션 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  // Validation for file
  if (!req.file) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '업로드할 파일이 없습니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  const file = req.file;
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf']; // Example mimetypes
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimeTypes.includes(file.mimetype)) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `허용되지 않는 파일 타입입니다. 허용되는 타입: ${allowedMimeTypes.join(', ')}.`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }

  if (file.size > maxFileSize) {
    const errorPayload = createErrorResponse('INVALID_INPUT', `파일 크기가 너무 큽니다 (최대 ${maxFileSize / (1024 * 1024)}MB).`);
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  
  const user_id = req.body.user_id || 'guest'; 
  const messageContent = `파일 업로드: ${file.originalname}`; 

  try {
    const resultData = await withTransaction(async (connection) => {
      const messageResult = await connection.execute(
        `INSERT INTO chat_messages (session_id, user_id, message_type, message_content)
         VALUES (:sessionId, :user_id, 'file', :messageContent)
         RETURNING message_id INTO :messageId`,
        {
          sessionId: sessionId,
          user_id: user_id, 
          messageContent: messageContent,
          messageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
        }
        // autoCommit is false by default, which is fine for withTransaction
      );

      const messageId = messageResult.outBinds.messageId[0];
      if (!messageId) {
          // console.error('Error in uploadFile: Failed to save file message to chat_messages.');
          const errorPayload = createErrorResponse('DB_ERROR', '파일 메시지 저장 중 오류가 발생했습니다.');
          const err = new Error(errorPayload.error.message);
          err.code = 'DB_ERROR';
          throw err;
      }

      const attachment = await saveAttachmentToDB(connection, messageId, file); // Pass connection
      if (!attachment) {
          // console.error('Error in uploadFile: Failed to save attachment details.');
          const errorPayload = createErrorResponse('DB_ERROR', '첨부 파일 정보 저장 중 오류가 발생했습니다.');
          const err = new Error(errorPayload.error.message);
          err.code = 'DB_ERROR';
          throw err;
      }
      return { message_id: messageId, file_info: file }; // Return necessary data for the response
    });
    
    res.status(201).json(standardizeApiResponse({ 
      message: '파일이 성공적으로 업로드되었습니다.',
      message_id: resultData.message_id,
      file_info: {
        original_name: resultData.file_info.originalname,
        file_name: resultData.file_info.filename, 
        path: resultData.file_info.path,        
        mimetype: resultData.file_info.mimetype,
        size: resultData.file_info.size
      }
    }));

  } catch (err) {
    // Rollback is handled by withTransaction. File cleanup should still happen.
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`Cleaned up uploaded file: ${req.file.path}`);
      } catch (unlinkErr) {
        logError('chatControllerUploadFileUnlink', unlinkErr);
      }
    }
    logError('chatControllerUploadFile', err);
    if (err.code === 'DB_ERROR') {
        const errorPayload = createErrorResponse('DB_ERROR', err.message);
        return res.status(getHttpStatusByErrorCode('DB_ERROR')).json(standardizeApiResponse(errorPayload));
    }
    const errorPayload = createErrorResponse('SERVER_ERROR', `파일 업로드 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

// 세션의 메시지 목록 조회 컨트롤러
async function getSessionMessagesController(req, res) {
  const sessionId = req.params.session_id;
  
  // Validation for sessionId
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    const errorPayload = createErrorResponse('INVALID_INPUT', '세션 ID는 필수이며 빈 문자열이 아니어야 합니다.');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  if (sessionId.length > 36) {
    const errorPayload = createErrorResponse('INVALID_INPUT', '세션 ID가 너무 깁니다 (최대 36자).');
    return res.status(getHttpStatusByErrorCode('INVALID_INPUT')).json(standardizeApiResponse(errorPayload));
  }
  
  try {
    const messages = await withTransaction(async (connection) => {
        return await getSessionMessagesForClient(connection, sessionId);
    });
    
    res.status(200).json(standardizeApiResponse(messages));
  } catch (err) {
    logError('chatControllerGetSessionMessages', err);
    // Since getSessionMessagesForClient might throw various errors,
    // a generic server error is appropriate here unless specific codes are thrown.
    const errorPayload = createErrorResponse('SERVER_ERROR', `메시지 목록 조회 중 오류 발생: ${err.message}`);
    res.status(getHttpStatusByErrorCode('SERVER_ERROR')).json(standardizeApiResponse(errorPayload));
  }
}

module.exports = {
  sendMessageController,
  editMessageController,
  addReactionController,
  deleteMessageController,
  removeReactionController, // 추가
  uploadFile,
  getSessionMessagesController // 추가
};