const chatModel = require("../models/chat");
const userModel = require("../models/user"); // For user settings, addUserExperience
const subscriptionModel = require("../models/subscription"); // For checkDailyUsage
const sessionModel = require("../models/session"); // For getUserIdBySessionId
const { fetchChatCompletion } = require("../utils/aiProvider");
const { withTransaction } = require("../utils/dbUtils");
const { oracledb } = require("../config/database"); // oracledb import 추가
const config = require("../config");
const { 
  generateSystemPrompt, 
  validateAndCleanPrompt, 
  enhancePromptWithContext 
} = require("../utils/systemPrompt");

/**
 * 채팅 메시지 전송 및 AI 응답 처리 서비스
 */
async function sendMessageService(
  sessionId,
  userId,
  messageData, // { message, system_prompt, specialModeType, ...overrides }
  clientIp,
  streamResponseCallback // 스트리밍 콜백 함수 (컨트롤러에서 전달)
) {
  const {
    message,
    system_prompt,
    specialModeType,
    max_output_tokens_override,
    context_message_limit,
    ai_provider_override,
    model_id_override,
    user_message_token_count,
  } = messageData;

  // withTransaction을 사용하여 모든 DB 작업을 하나의 트랜잭션으로 묶음
  return await withTransaction(async (connection) => {
    // 0. 세션의 실제 사용자 ID 가져오기 (클라이언트에서 전달된 userId 대신 세션의 실제 사용자 ID 사용)
    let actualUserId = userId;
    try {
      const sessionInfo = await sessionModel.getUserIdBySessionId(connection, sessionId);
      actualUserId = sessionInfo.user_id;
      console.log(`[DEBUG] 세션 ${sessionId}의 실제 사용자 ID: ${actualUserId} (클라이언트에서 전달된 ID: ${userId})`);
    } catch (error) {
      console.warn(`[WARN] 세션 ${sessionId}의 사용자 ID를 가져올 수 없습니다. 클라이언트 ID를 사용합니다: ${userId}`, error.message);
      // 세션을 찾을 수 없는 경우 클라이언트에서 전달된 userId를 사용
    }

    // 1. 구독 사용량 체크 (actualUserId 사용)
    const usage = await subscriptionModel.checkDailyUsage(connection, actualUserId);
    if (!usage.can_make_request) {
      const err = new Error("일일 AI 요청 한도를 초과했습니다.");
      err.code = "FORBIDDEN"; // 429 Too Many Requests에 해당될 수 있음
      err.details = { usage_info: usage, upgrade_url: "/api/subscriptions/tiers" };
      throw err;
    }

    // 2. AI 제공자 및 모델 결정
    let actualAiProvider = ai_provider_override || config.ai.defaultProvider;
    let actualModelId = model_id_override;

    if (!ai_provider_override && !model_id_override) {
      try {
        const userSettings = await userModel.getUserSettings(connection, actualUserId);
        if (userSettings && userSettings.ai_model_preference) {
          const prefParts = userSettings.ai_model_preference.split('/');
          if (prefParts.length === 2) {
            actualAiProvider = prefParts[0];
            actualModelId = prefParts[1];
          } else {
            actualAiProvider = userSettings.ai_model_preference;
          }
        }
      } catch (settingsError) {
        console.warn(`[ChatService] 사용자 ${actualUserId}의 AI 설정 조회 실패: ${settingsError.message}. 기본값 사용.`);
        // 기본값은 이미 설정되어 있으므로 추가 작업 불필요
      }
    }

    // 모델 ID가 명시적으로 오버라이드되지 않았을 경우, 각 제공자의 기본 모델 사용
    if (!actualModelId) {
        switch (actualAiProvider) {
            case "geminiapi": actualModelId = config.ai.gemini.defaultModel; break;
            case "ollama": actualModelId = config.ai.ollama.defaultModel; break;
            case "vertexai": actualModelId = config.ai.vertexAi.defaultModel; break;
            default: // 이 경우는 발생하지 않아야 하지만, 방어적으로
                const err = new Error(`알 수 없는 AI 제공자입니다: ${actualAiProvider}`);
                err.code = "INVALID_CONFIG"; // 서버 설정 오류로 간주
                throw err;
        }
    }

    // 3. 사용자 메시지 DB에 저장 (actualUserId 사용)
    const userMessageResult = await chatModel.saveUserMessageToDB(
      connection, sessionId, actualUserId, message, user_message_token_count
    );
    const userMessageId = userMessageResult.user_message_id;

    // 4. 사용자 프로필 및 설정 조회 (시스템 프롬프트 개인화용)
    let userProfile = null;
    let userSettings = null;
    
    try {
      // 사용자 프로필 정보 조회
      userProfile = await userModel.getUserProfile(connection, actualUserId);
      
      // 사용자 설정 조회
      userSettings = await userModel.getUserSettings(connection, actualUserId);
    } catch (profileError) {
      console.warn(`[ChatService] 사용자 ${actualUserId} 프로필/설정 조회 실패: ${profileError.message}`);
      // 프로필 조회 실패는 치명적이지 않음
    }

    // 5. 시스템 프롬프트 생성 및 개선
    const enhancedSystemPrompt = generateSystemPrompt(userProfile, userSettings, system_prompt);
    const finalSystemPrompt = enhancePromptWithContext(
      validateAndCleanPrompt(enhancedSystemPrompt), 
      specialModeType
    );

    console.log(`[ChatService] 시스템 프롬프트 적용 - 길이: ${finalSystemPrompt.length}자, 타입: ${specialModeType || 'general'}`);

    // 6. 대화 이력 조회
    const chatHistoryForAI = await chatModel.getChatHistoryFromDB(
      connection, sessionId, false, context_message_limit
    );

    // 7. AI 응답 요청
    const callOptions = {
      max_output_tokens_override,
      model_id_override: actualModelId, // 최종 결정된 모델 ID
    };
    if (actualAiProvider === "ollama") callOptions.ollamaModel = actualModelId;

    const requestContext = { clientIp };

    const aiResponseFull = await fetchChatCompletion(
      actualAiProvider, message, chatHistoryForAI, finalSystemPrompt,
      specialModeType,
      specialModeType === 'stream' ? streamResponseCallback : null, // 스트리밍 모드일 때만 콜백 전달
      callOptions, requestContext
    );

    // 8. AI 응답 DB에 저장
    // 스트리밍의 경우, fetchChatCompletion이 최종 fullContent를 반환해야 DB 저장 가능.
    // 또는, 컨트롤러에서 스트리밍 완료 후 별도 API로 AI 메시지 ID와 content를 받아 저장할 수도 있음.
    // 여기서는 fetchChatCompletion이 스트리밍 여부와 관계없이 최종 content를 반환한다고 가정.
    if (!aiResponseFull || typeof aiResponseFull.content !== "string" || (aiResponseFull.content.trim() === "" && !aiResponseFull.function_calls_used) ) {
      // 함수 호출이 있었다면 content가 비어있을 수 있음
      if (!aiResponseFull?.function_calls_used?.length > 0) {
        const err = new Error("AI로부터 유효한 응답을 받지 못했습니다 (내용 없음).");
        err.code = "AI_RESPONSE_ERROR";
        throw err;
      }
    }

    let aiContentToSave = aiResponseFull.content || "(함수 호출 사용됨)";
    
    // 더 정교한 중복 제거 로직: 연속으로 두 번 나타나는 경우만 제거
    const duplicatePattern = new RegExp(`(.{0,50})?${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.{0,50})?`, 'gi');
    if (duplicatePattern.test(aiContentToSave)) {
        console.warn(`[ChatService] AI 응답에서 중복된 사용자 메시지 발견: "${message}"`);
        aiContentToSave = aiContentToSave.replace(new RegExp(`${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), message);
    }

    const aiMessageResult = await chatModel.saveAiMessageToDB(
      connection, sessionId, actualUserId, aiContentToSave.trim(), aiResponseFull.actual_output_tokens
    );

    // 🎯 채팅 메시지 전송 성공 시 경험치 지급 (1 경험치)
    try {
      await userModel.addUserExperience(connection, actualUserId, 1, "chat_message", "채팅 메시지 전송");
      console.log(`[ChatService] 사용자 ${actualUserId}에게 채팅 메시지 전송 경험치 1점 지급 완료`);
    } catch (expError) {
      console.warn(`[ChatService] 사용자 ${actualUserId} 경험치 지급 실패: ${expError.message}`);
      // 경험치 지급 실패는 주 트랜잭션 실패로 이어지지 않도록 처리
    }

    return {
      user_message_id: userMessageId,
      ai_message_id: aiMessageResult.ai_message_id,
      message: aiMessageResult.content, // DB에 저장된 최종 content
      created_at: aiMessageResult.created_at,
      ai_message_token_count: aiMessageResult.ai_message_token_count,
      ai_provider: actualAiProvider,
      model_id: actualModelId,
      // 스트리밍 모드 여부나, 함수 호출 사용 여부 등 추가 정보 반환 가능
      special_mode_type: specialModeType,
      function_calls_used: aiResponseFull.function_calls_used || null,
      streaming_handled_by_service: specialModeType === 'stream' && !!streamResponseCallback, // 서비스가 스트림을 직접 처리했는지 여부
    };
  });
}

/**
 * 메시지 편집 서비스
 */
async function editMessageService(messageId, userId, newContent, editReason = null) {
    return await withTransaction(async (connection) => {
        const editResult = await chatModel.editUserMessage(connection, messageId, userId, newContent, editReason);

        // 경험치 지급 로직 (userActivityService 호출 또는 직접 userModel 호출)
        // 여기서는 userModel을 직접 호출한다고 가정 (userActivityService가 아직 없을 수 있으므로)
        if (editResult.success) { // editResult.success 등으로 성공 여부 확인
            try {
                // addUserExperience가 connection을 받도록 수정되었다고 가정
                await userModel.addUserExperience(connection, userId, 5, "message_edit", "메시지 편집");
            } catch (expError) {
                console.warn(`[ChatService-Edit] 사용자 ${userId} 경험치 지급 실패: ${expError.message}`);
                // 경험치 지급 실패는 주 트랜잭션 실패로 이어지지 않도록 처리
            }
        }
        return editResult;
    });
}

/**
 * 메시지 편집 기록 조회 서비스
 */
async function getMessageEditHistoryService(messageId) {
    return await withTransaction(async (connection) => {
        return await chatModel.getMessageEditHistory(connection, messageId);
    });
}

/**
 * 편집된 메시지에 대한 AI 재응답 요청 서비스 (후속 메시지 삭제 + 새로운 AI 응답 생성)
 */
async function requestAiReresponseService(sessionId, editedMessageId, userId = null) {
    return await withTransaction(async (connection) => {
        // user_id가 제공되지 않았으면 세션에서 조회
        let actualUserId = userId;
        if (!actualUserId) {
            try {
                const sessionInfo = await sessionModel.getUserIdBySessionId(connection, sessionId);
                actualUserId = sessionInfo.user_id;
            } catch (error) {
                const err = new Error("세션을 찾을 수 없습니다.");
                err.code = "SESSION_NOT_FOUND";
                throw err;
            }
        }
        
        // 1. 편집된 메시지 이후의 모든 메시지 삭제
        const deleteResult = await chatModel.requestAiReresponse(connection, sessionId, editedMessageId, actualUserId);
        
        // 2. 편집된 메시지 내용 조회
        const editedMessage = await chatModel.getMessageById(connection, editedMessageId);
        if (!editedMessage) {
            const err = new Error("편집된 메시지를 찾을 수 없습니다.");
            err.code = "MESSAGE_NOT_FOUND";
            throw err;
        }

        // 3. 구독 사용량 체크
        const usage = await subscriptionModel.checkDailyUsage(connection, actualUserId);
        if (!usage.can_make_request) {
            const err = new Error("일일 AI 요청 한도를 초과했습니다.");
            err.code = "FORBIDDEN";
            err.details = { usage_info: usage, upgrade_url: "/api/subscriptions/tiers" };
            throw err;
        }

        // 4. 사용자 설정 및 AI 제공자/모델 결정
        let actualAiProvider = config.ai.defaultProvider;
        let actualModelId;

        try {
            const userSettings = await userModel.getUserSettings(connection, actualUserId);
            if (userSettings && userSettings.ai_model_preference) {
                const prefParts = userSettings.ai_model_preference.split('/');
                if (prefParts.length === 2) {
                    actualAiProvider = prefParts[0];
                    actualModelId = prefParts[1];
                } else {
                    actualAiProvider = userSettings.ai_model_preference;
                }
            }
        } catch (settingsError) {
            console.warn(`[ChatService-Reresponse] 사용자 ${actualUserId}의 AI 설정 조회 실패: ${settingsError.message}. 기본값 사용.`);
        }

        // 모델 ID가 명시적으로 설정되지 않았을 경우, 각 제공자의 기본 모델 사용
        if (!actualModelId) {
            switch (actualAiProvider) {
                case "geminiapi": actualModelId = config.ai.gemini.defaultModel; break;
                case "ollama": actualModelId = config.ai.ollama.defaultModel; break;
                case "vertexai": actualModelId = config.ai.vertexAi.defaultModel; break;
                default:
                    const err = new Error(`알 수 없는 AI 제공자입니다: ${actualAiProvider}`);
                    err.code = "INVALID_CONFIG";
                    throw err;
            }
        }

        // 5. 사용자 프로필 및 설정 조회 (시스템 프롬프트 개인화용)
        let userProfile = null;
        let userSettings = null;
        
        try {
            userProfile = await userModel.getUserProfile(connection, actualUserId);
            userSettings = await userModel.getUserSettings(connection, actualUserId);
        } catch (profileError) {
            console.warn(`[ChatService-Reresponse] 사용자 ${actualUserId} 프로필/설정 조회 실패: ${profileError.message}`);
        }

        // 6. 시스템 프롬프트 생성
        const enhancedSystemPrompt = generateSystemPrompt(userProfile, userSettings);
        const finalSystemPrompt = validateAndCleanPrompt(enhancedSystemPrompt);

        // 7. 대화 이력 조회 (편집된 메시지까지만)
        const chatHistoryForAI = await chatModel.getChatHistoryFromDB(connection, sessionId, false);

        // 8. AI 응답 요청
        const callOptions = {
            model_id_override: actualModelId,
        };
        if (actualAiProvider === "ollama") callOptions.ollamaModel = actualModelId;

        const requestContext = { clientIp: "reresponse" };

        console.log(`[ChatService-Reresponse] AI 재응답 요청: ${actualAiProvider}/${actualModelId}, 메시지: "${editedMessage.message_content.substring(0, 50)}..."`);

        const aiResponseFull = await fetchChatCompletion(
            actualAiProvider, 
            editedMessage.message_content, 
            chatHistoryForAI, 
            finalSystemPrompt,
            'general', // 재응답은 일반 모드로
            null, // 스트리밍 콜백 없음
            callOptions, 
            requestContext
        );

        // 9. AI 응답 검증
        if (!aiResponseFull || typeof aiResponseFull.content !== "string" || aiResponseFull.content.trim() === "") {
            const err = new Error("AI로부터 유효한 재응답을 받지 못했습니다.");
            err.code = "AI_RESPONSE_ERROR";
            throw err;
        }

        // 10. AI 응답 DB에 저장
        const aiMessageResult = await chatModel.saveAiMessageToDB(
            connection, 
            sessionId, 
            actualUserId, 
            aiResponseFull.content.trim(), 
            aiResponseFull.actual_output_tokens
        );

        console.log(`[ChatService-Reresponse] AI 재응답 완료: messageId=${aiMessageResult.ai_message_id}, 길이=${aiResponseFull.content.length}자`);

        return {
            success: true,
            deleted_messages: deleteResult.deleted_messages,
            ai_message_id: aiMessageResult.ai_message_id,
            ai_response: aiMessageResult.content,
            created_at: aiMessageResult.created_at,
            ai_message_token_count: aiMessageResult.ai_message_token_count,
            ai_provider: actualAiProvider,
            model_id: actualModelId,
            message: "AI 재응답이 성공적으로 생성되었습니다."
        };
    });
}

/**
 * 메시지 리액션 추가/수정 서비스
 */
async function upsertReactionService(messageId, reaction) {
    return await withTransaction(async (connection) => {
        // 모델에 upsertReaction 함수가 있다고 가정하거나,
        // select 후 insert/update 하는 로직을 여기서 구현.
        // 여기서는 간단히 update만 수행 (모델에 reaction 필드가 있다고 가정)
        const messageCheck = await connection.execute(
            `SELECT message_id FROM chat_messages WHERE message_id = :p_message_id`,
            { p_message_id: messageId }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (messageCheck.rows.length === 0) {
            const error = new Error("리액션을 추가할 메시지를 찾을 수 없습니다.");
            error.code = "MESSAGE_NOT_FOUND";
            throw error;
        }

        const result = await connection.execute(
            `UPDATE chat_messages SET reaction = :p_reaction WHERE message_id = :p_message_id`,
            { 
                p_reaction: { val: reaction, type: oracledb.STRING }, 
                p_message_id: { val: messageId, type: oracledb.STRING } 
            },
            { autoCommit: false }
        );
        if (result.rowsAffected === 0) {
            // 이 경우는 거의 없지만, 방어적으로
            const error = new Error("리액션 추가에 실패했습니다.");
            error.code = "DB_ERROR";
            throw error;
        }
        return { message: "리액션이 성공적으로 추가/수정되었습니다.", reaction: reaction };
    });
}

/**
 * 메시지 리액션 제거 서비스
 */
async function removeReactionService(messageId) {
    return await withTransaction(async (connection) => {
        const result = await connection.execute(
            `UPDATE chat_messages SET reaction = NULL WHERE message_id = :p_message_id`,
            { p_message_id: { val: messageId, type: oracledb.STRING } },
            { autoCommit: false }
        );
        // 삭제할 리액션이 없어도 성공으로 간주하거나, rowsAffected로 판단 가능
        return { message: "리액션이 성공적으로 제거되었습니다." };
    });
}

/**
 * 메시지 삭제 서비스
 */
async function deleteMessageService(messageId) {
    return await withTransaction(async (connection) => {
        const deleted = await chatModel.deleteUserMessageFromDB(connection, messageId);
        if (!deleted) {
            const error = new Error("메시지를 찾을 수 없거나 삭제할 수 없습니다.");
            error.code = "MESSAGE_NOT_FOUND";
            throw error;
        }
        return { message: "메시지가 성공적으로 삭제되었습니다." };
    });
}

/**
 * 파일 업로드 관련 DB 작업 서비스
 * @param {string} sessionId - 세션 ID
 * @param {string} userId - 사용자 ID
 * @param {Object} file - Multer에서 처리된 파일 객체
 * @param {string} messageContent - 파일 업로드 관련 메시지 내용
 * @returns {Promise<Object>} 생성된 메시지 및 첨부파일 정보
 */
async function uploadFileService(sessionId, userId, file, messageContent) {
    return await withTransaction(async (connection) => {
        // 1. 'file' 타입의 채팅 메시지 생성
        const messageResult = await connection.execute(
            `INSERT INTO chat_messages (session_id, user_id, message_type, message_content)
             VALUES (:sessionId, :user_id, 'file', :messageContent)
             RETURNING message_id INTO :outMessageId`,
            { sessionId, user_id: userId, messageContent, outMessageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT } },
            // autoCommit: false는 withTransaction에서 관리
        );
        const messageId = messageResult.outBinds.outMessageId[0];
        if (!messageId) {
            const err = new Error("파일 메시지 저장 중 DB 오류가 발생했습니다.");
            err.code = "DB_ERROR";
            throw err;
        }

        // 2. 첨부파일 정보 DB에 저장
        const attachment = await chatModel.saveAttachmentToDB(connection, messageId, file);
        if (!attachment || !attachment.attachment_id) {
            const err = new Error("첨부 파일 정보 저장 중 DB 오류가 발생했습니다.");
            err.code = "DB_ERROR";
            throw err;
        }
        return {
            message_id: messageId,
            attachment_id: attachment.attachment_id,
            file_info: { // 컨트롤러에서 사용할 수 있도록 파일 정보 정리
                originalname: file.originalname,
                filename: file.filename, // multer가 저장한 이름
                path: file.path,
                mimetype: file.mimetype,
                size: file.size,
            }
        };
    });
}

/**
 * 세션의 모든 메시지 조회 서비스 (강화된 유효성 검증)
 */
async function getSessionMessagesService(sessionId) {
    // 🔍 서비스 레벨에서 사전 검증
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null' || typeof sessionId !== 'string') {
        console.error('[getSessionMessagesService] 잘못된 sessionId 파라미터:', {
            sessionId,
            type: typeof sessionId,
            arguments: Array.from(arguments)
        });
        const error = new Error("세션 ID가 유효하지 않습니다.");
        error.code = "INVALID_INPUT";
        throw error;
    }

    console.log('[getSessionMessagesService] 실행:', { sessionId, type: typeof sessionId });

    return await withTransaction(async (connection) => {
        return await chatModel.getSessionMessagesForClient(connection, sessionId);
    });
}

module.exports = {
  sendMessageService,
  editMessageService,
  getMessageEditHistoryService,
  requestAiReresponseService,
  upsertReactionService,
  removeReactionService,
  deleteMessageService,
  uploadFileService,
  getSessionMessagesService,
};
