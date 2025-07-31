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
  enhancePromptWithContext,
  generateTitleGenerationPrompt 
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
    special_mode_type, // snake_case도 지원
    max_output_tokens_override,
    context_message_limit,
    ai_provider_override,
    model_id_override,
    user_message_token_count,
  } = messageData;

  // specialModeType과 special_mode_type 중 하나라도 있으면 사용 (snake_case 우선)
  const finalSpecialModeType = special_mode_type || specialModeType;

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

    // 3. 사용자 프로필 및 설정 조회 (시스템 프롬프트 개인화용)
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

    // 4. 시스템 프롬프트 생성 및 개선
    const enhancedSystemPrompt = generateSystemPrompt(userProfile, userSettings, system_prompt);
    const finalSystemPrompt = enhancePromptWithContext(
      validateAndCleanPrompt(enhancedSystemPrompt), 
      finalSpecialModeType
    );

    console.log(`[ChatService] 시스템 프롬프트 적용 - 길이: ${finalSystemPrompt.length}자, 타입: ${finalSpecialModeType || 'general'}`);

    // 5. 대화 이력 조회 (사용자 메시지 저장 전에 조회하여 중복 방지)
    const chatHistoryForAI = await chatModel.getChatHistoryFromDB(
      connection, sessionId, false, context_message_limit
    );

    // 6. 사용자 메시지 DB에 저장 (actualUserId 사용)
    const userMessageResult = await chatModel.saveUserMessageToDB(
      connection, sessionId, actualUserId, message, user_message_token_count
    );
    const userMessageId = userMessageResult.user_message_id;


    // 7. GPT-style Function Calling Loop 실행
    // runFunctionCallingLoop의 첫 번째 인자는 AI 프롬프트 함수여야 함
    const { runFunctionCallingLoop } = require("../utils/aiTools");
    const { fetchChatCompletion } = require("../utils/aiProvider");

    // toolCallRequest: function calling loop에 전달할 요청 객체
    const toolCallRequest = {
      sessionId,
      userId: actualUserId,
      message,
      systemPrompt: finalSystemPrompt,
      chatHistory: chatHistoryForAI,
      aiProvider: typeof actualAiProvider === 'string' ? actualAiProvider : (actualAiProvider?.name || 'geminiapi'),
      modelId: typeof actualModelId === 'string' ? actualModelId : (actualModelId?.name || config.ai.gemini.defaultModel),
      specialModeType: finalSpecialModeType,
      maxOutputTokens: max_output_tokens_override,
      streamResponseCallback,
      clientIp,
    };

    // function calling loop 실행 (여러 도구를 순차적으로 호출)
    const loopResult = await runFunctionCallingLoop(fetchChatCompletion, toolCallRequest);

    // loopResult: { finalAnswer, functionCallsUsed, aiResponseFull, ... }
    // 최종 AI 응답을 DB에 저장
    let aiContentToSave = loopResult.finalAnswer || loopResult.aiResponseFull?.content || "(함수 호출 사용됨)";
    const aiMessageResult = await chatModel.saveAiMessageToDB(
      connection, sessionId, actualUserId, aiContentToSave.trim(), loopResult.aiResponseFull?.actual_output_tokens
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
      special_mode_type: finalSpecialModeType,
      function_calls_used: loopResult.functionCallsUsed || null,
      streaming_handled_by_service: finalSpecialModeType === 'stream' && !!streamResponseCallback,
      // 추가 정보: function calling loop 결과
      tool_calling_loop: {
        steps: loopResult.steps,
        ai_response_full: loopResult.aiResponseFull,
      },
    };
  });
}

/**
 * 메시지 편집 서비스
 * @param {string} messageId - 편집할 메시지 ID
 * @param {string} newContent - 새 메시지 내용
 * @param {string} editReason - 편집 사유(선택)
 * @param {string} userId - 편집자 ID(권한 체크)
 * @returns {Promise<Object>} 편집 결과
 */
async function editMessageService(messageId, newContent, editReason = null, userId = null) {
  return await withTransaction(async (connection) => {
    // 1. 메시지 존재 및 권한 확인
    const message = await chatModel.getMessageById(connection, messageId);
    if (!message) {
      const error = new Error("메시지를 찾을 수 없습니다.");
      error.code = "MESSAGE_NOT_FOUND";
      throw error;
    }
    if (userId && message.user_id !== userId) {
      const error = new Error("메시지에 대한 권한이 없습니다.");
      error.code = "FORBIDDEN";
      throw error;
    }

    // 2. 메시지 내용 업데이트
    const editResult = await chatModel.editMessageContent(connection, messageId, newContent, editReason);
    if (!editResult || !editResult.success) {
      const error = new Error("메시지 편집에 실패했습니다.");
      error.code = "DB_ERROR";
      throw error;
    }

    // 3. 편집 이력 저장 (모델에서 처리한다고 가정)

    // 4. 경험치 지급 (메시지 편집 시 1점)
    try {
      await userModel.addUserExperience(connection, userId || message.user_id, 1, "message_edit", "메시지 편집");
    } catch (expError) {
      console.warn(`[ChatService-Edit] 사용자 ${userId || message.user_id} 경험치 지급 실패: ${expError.message}`);
      // 경험치 지급 실패는 주 트랜잭션 실패로 이어지지 않도록 처리
    }

    return {
      success: true,
      message_id: messageId,
      new_content: newContent,
      edit_reason: editReason,
      edited_by: userId || message.user_id,
      edited_at: editResult.edited_at,
    };
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

/**
 * 채팅 세션의 제목 자동 생성 서비스
 * @param {string} sessionId - 세션 ID
 * @param {string} userId - 사용자 ID (권한 확인용)
 * @returns {Promise<Object>} 생성된 제목과 세션 정보
 */
async function generateSessionTitleService(sessionId, userId) {
  return await withTransaction(async (connection) => {
    console.log(`[DEBUG] 세션 ${sessionId}에 대한 제목 생성 시작 (사용자: ${userId})`);

    // 1. 세션 존재 여부 및 권한 확인
    let sessionInfo;
    try {
      sessionInfo = await sessionModel.getUserIdBySessionId(connection, sessionId);
      if (sessionInfo.user_id !== userId) {
        const error = new Error("세션에 대한 권한이 없습니다");
        error.code = "FORBIDDEN";
        throw error;
      }
    } catch (error) {
      if (error.code === "FORBIDDEN") {
        throw error;
      }
      const notFoundError = new Error("세션을 찾을 수 없습니다");
      notFoundError.code = "SESSION_NOT_FOUND";
      throw notFoundError;
    }

    // 2. 세션의 메시지 목록 가져오기 (최대 10개 메시지로 제한)
    const messages = await chatModel.getMessagesBySessionId(connection, sessionId, 10);
    
    if (!messages || messages.length === 0) {
      const error = new Error("제목을 생성할 메시지가 없습니다");
      error.code = "NO_MESSAGES_FOUND";
      throw error;
    }

    console.log(`[DEBUG] 제목 생성을 위해 ${messages.length}개 메시지 분석 중`);

    // 3. 사용자 설정 조회 (언어 설정을 위해)
    let userSettings = null;
    try {
      userSettings = await userModel.getUserSettings(connection, userId);
    } catch (error) {
      console.warn(`[WARN] 사용자 설정을 가져올 수 없습니다: ${error.message}`);
    }

    const language = userSettings?.language || 'ko';

    // 4. 메시지를 분석용 텍스트로 변환 (언어에 따라)
    const userLabel = language === 'en' ? 'User' : '사용자';
    const aiLabel = language === 'en' ? 'AI' : 'AI';
    const conversationText = messages
      .map(msg => `${msg.message_type === 'user' ? userLabel : aiLabel}: ${msg.message}`)
      .join('\n\n');

    console.log(`[DEBUG] 대화 내용 길이: ${conversationText.length}자`);

    // 5. 제목 생성을 위한 프롬프트 정보 생성
    const titlePromptInfo = generateTitleGenerationPrompt(language);
    

    // 6. AI 제공자 설정 (기본값 사용)
    const aiProvider = config.ai.defaultProvider;
    let modelId;
    
    // 제공자별 모델 ID 설정
    switch (aiProvider) {
      case "geminiapi": 
        modelId = config.ai.gemini.defaultModel; 
        break;
      case "vertexai": 
        modelId = config.ai.vertexAi.defaultModel; 
        break;
      case "ollama": 
        modelId = config.ai.ollama.defaultModel; 
        break;
      default:
        modelId = config.ai.gemini.defaultModel; // 기본값
        break;
    }

    console.log(`[DEBUG] 제목 생성 AI 설정 - Provider: ${aiProvider}, Model: ${modelId}`);

    // 7. AI API 호출하여 제목 생성 (속도 제한 고려하여 1초 대기)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let generatedTitle;
    try {
      // 프롬프트 정보를 활용한 요청 메시지 생성
      const requestMessage = `${titlePromptInfo.requestPrefix}\n\n${conversationText}`;


      const aiResponse = await fetchChatCompletion(
        aiProvider, // AI 제공자
        requestMessage, // 사용자 메시지
        [], // 히스토리 (제목 생성은 독립적)
        titlePromptInfo.systemPrompt, // 시스템 프롬프트 복구
        null, // 특수 모드 없음
        null, // 스트리밍 콜백 없음
        { 
          model_id_override: modelId,
          max_output_tokens_override: 1000, // thinking 모델용 토큰 넉넉하게
          temperature: 0.3,
          useTools: false // 제목 생성 시 도구 사용 안 함
        }, // 옵션
        {} // 컨텍스트
      );

      
      // AI 응답 처리 - 다양한 응답 형태에 대응
      if (typeof aiResponse === 'string') {
        generatedTitle = aiResponse.trim();
      } else if (aiResponse && typeof aiResponse === 'object') {
        // content 속성만 확인 (가장 일반적)
        generatedTitle = aiResponse.content?.trim() || '';
        
        console.log(`[DEBUG] AI 응답 content: "${generatedTitle}"`);
        
        // content가 비어있는 경우 원인 분석
        if (!generatedTitle) {
          if (aiResponse.finish_reason === 'SAFETY') {
            console.log(`[WARN] 제목 생성이 안전 필터에 의해 차단됨`);
          } else if (aiResponse.finish_reason === 'MAX_TOKENS') {
            console.log(`[WARN] 제목 생성이 토큰 한도로 인해 중단됨`);
          } else if (aiResponse.error) {
            console.log(`[ERROR] AI 응답 오류:`, aiResponse.error);
          } else {
            console.log(`[DEBUG] AI 응답에서 제목을 추출할 수 없음 (finish_reason: ${aiResponse.finish_reason}), 기본 제목 사용`);
          }
        }
      } else {
        generatedTitle = '';
        console.log(`[DEBUG] AI 응답이 예상치 못한 타입: ${typeof aiResponse}`);
      }
      
      // 제목이 비어있거나 생성되지 않은 경우 기본 제목 사용
      if (!generatedTitle || generatedTitle.trim() === '') {
        const firstUserMessage = messages.find(msg => msg.message_type === 'user');
        if (firstUserMessage) {
          const shortMessage = firstUserMessage.message.length > 30 
            ? firstUserMessage.message.substring(0, 27) + '...'
            : firstUserMessage.message;
          generatedTitle = `${titlePromptInfo.fallbackPrefix} ${shortMessage}`;
        } else {
          generatedTitle = language === 'en' ? "New Chat" : "새로운 대화";
        }
      } else {
        // 제목 길이 제한 및 정리 (정상적으로 생성된 경우만)
        if (generatedTitle.length > 50) {
          generatedTitle = generatedTitle.substring(0, 47) + '...';
        }
      }

    } catch (aiError) {
      console.error(`[ERROR] 제목 생성 AI 호출 실패:`, aiError);
      
      // AI 호출 실패 시 기본 제목 생성 (프롬프트 정보 활용)
      const firstUserMessage = messages.find(msg => msg.message_type === 'user');
      if (firstUserMessage) {
        const shortMessage = firstUserMessage.message.length > 30 
          ? firstUserMessage.message.substring(0, 27) + '...'
          : firstUserMessage.message;
        generatedTitle = `${titlePromptInfo.fallbackPrefix} ${shortMessage}`;
      } else {
        generatedTitle = language === 'en' ? "New Chat" : "새로운 대화";
      }
      
      console.log(`[DEBUG] 기본 제목 사용: "${generatedTitle}"`);
    }

    // 8. 생성된 제목으로 세션 업데이트
    try {
      await sessionModel.updateSessionTitle(connection, sessionId, generatedTitle);
      console.log(`[DEBUG] 세션 ${sessionId} 제목 업데이트 완료: "${generatedTitle}"`);
    } catch (updateError) {
      console.error(`[ERROR] 세션 제목 업데이트 실패:`, updateError);
      const error = new Error("제목 업데이트에 실패했습니다");
      error.code = "TITLE_UPDATE_FAILED";
      throw error;
    }

    return {
      session_id: sessionId,
      generated_title: generatedTitle,
      message_count: messages.length,
      language: language,
      ai_provider: aiProvider,
      model: modelId
    };
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
  generateSessionTitleService,
};
