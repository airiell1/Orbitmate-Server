// const { getConnection, oracledb } = require("../config/database"); // Removed getConnection
const { oracledb } = require("../config/database"); // For oracledb.CLOB etc.
const chatModel = require("../models/chat");
const userModel = require("../models/user"); // For getUserSettings, addUserExperience
const subscriptionModel = require("../models/subscription"); // For checkDailyUsage
const { fetchChatCompletion } = require("../utils/aiProvider");
const { withTransaction } = require("../utils/dbUtils");
const { standardizeApiResponse } = require("../utils/apiResponse");
const config = require("../config"); // For AI provider/model defaults
const fs = require("fs");
// Error utils are used by next(err) rather than directly in most cases now
// const { createErrorResponse, getHttpStatusByErrorCode, handleOracleError, logError } = require("../utils/errorHandler");


// 채팅 메시지 전송 및 AI 응답 받기 컨트롤러
async function sendMessageController(req, res, next) { // Added next
  const { session_id } = req.params;
  const {
    message, systemPrompt, specialModeType,
    max_output_tokens_override, context_message_limit,
    ai_provider_override, model_id_override, user_message_token_count,
  } = req.body;

  // --- Input Validation Start ---
  // (각 validation 실패 시 바로 return 하는 대신, 에러 객체 생성 후 next(error) 호출 고려)
  // 예시:
  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err); // 중앙 에러 핸들러로 전달
  }
  if (!message || typeof message !== "string" || message.trim() === "" || message.length > 4000) {
    const err = new Error("메시지는 필수이며 최대 4000자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // ... (다른 validation들도 유사하게 수정) ...
  const allowedSpecialModeTypes = ["stream", "canvas"];
  if (specialModeType && !allowedSpecialModeTypes.includes(specialModeType)) {
    const err = new Error(`잘못된 specialModeType 값입니다. 허용되는 값: ${allowedSpecialModeTypes.join(", ")}.`);
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // --- Input Validation End ---

  const user_id = req.user ? req.user.user_id : "guest"; // 인증 미들웨어에서 req.user 설정 가정

  try {
    // 구독 일일 사용량 제한 체크 (withTransaction 외부에서 실행)
    // checkDailyUsage는 내부적으로 getUserSubscription을 호출하고, 이는 DB 연결을 사용함.
    // 따라서 withTransaction으로 감싸거나, checkDailyUsage가 connection을 받도록 수정 필요.
    // 여기서는 checkDailyUsage가 connection을 받도록 수정했다고 가정하고 withTransaction 내에서 호출.

    // --- AI Provider 및 Model 결정 ---
    // getUserSettings도 DB 호출이므로 withTransaction 내에서 처리하거나 connection을 받도록 수정 필요.
    // 일단은 withTransaction 외부에서 호출하고, 필요시 내부로 이동.
    let actualAiProvider = ai_provider_override || config.ai.defaultProvider;
    let actualModelId = model_id_override;

    if (!actualModelId) {
        switch (actualAiProvider) {
            case "geminiapi": actualModelId = config.ai.gemini.defaultModel; break;
            case "ollama": actualModelId = config.ai.ollama.defaultModel; break;
            case "vertexai": actualModelId = config.ai.vertexAi.defaultModel; break;
            default:
                const err = new Error(`지원하지 않는 AI 제공자입니다: ${actualAiProvider}`);
                err.code = "INVALID_INPUT";
                return next(err);
        }
    }

    // 사용자 설정에 따른 AI Provider/Model 우선 적용 (user_id가 guest가 아닐 경우)
    if (user_id !== "guest" && !ai_provider_override && !model_id_override) {
        // 이 부분은 withTransaction 내부로 이동하여 userSettings를 가져와야 함.
        // 또는, 사용자 설정을 미리 로드하는 미들웨어를 고려할 수 있음.
    }
    // --- AI Provider 및 Model 결정 끝 ---


    const responseData = await withTransaction(async (connection) => {
      // 구독 사용량 체크 (connection 필요)
      const usage = await subscriptionModel.checkDailyUsage(connection, user_id);
      if (!usage.can_make_request) {
        const err = new Error("일일 AI 요청 한도를 초과했습니다. 구독을 업그레이드하거나 내일 다시 시도해주세요.");
        err.code = "FORBIDDEN"; // 또는 429 Too Many Requests에 해당하는 코드
        err.details = { usage_info: usage, upgrade_url: "/api/subscriptions/tiers" };
        throw err;
      }

      // 사용자 설정에 따른 AI Provider/Model 재결정 (DB connection 사용)
      if (user_id !== "guest" && !ai_provider_override && !model_id_override) {
        try {
            const userSettings = await userModel.getUserSettings(connection, user_id);
            if (userSettings && userSettings.ai_model_preference) { // 필드명 확인 필요 (ai_model_preference or preferred_ai_provider)
                // 예시: userSettings.ai_model_preference가 "ollama/gemma3:7b" 형태라고 가정
                const parts = userSettings.ai_model_preference.split('/');
                if (parts.length === 2) {
                    actualAiProvider = parts[0];
                    actualModelId = parts[1];
                } else {
                    actualAiProvider = userSettings.ai_model_preference; // 제공자만 변경될 수도 있음
                    // 이 경우 모델은 해당 제공자의 기본 모델 사용
                     switch (actualAiProvider) {
                        case "geminiapi": actualModelId = config.ai.gemini.defaultModel; break;
                        case "ollama": actualModelId = config.ai.ollama.defaultModel; break;
                        case "vertexai": actualModelId = config.ai.vertexAi.defaultModel; break;
                    }
                }
            }
        } catch (settingError) {
            // 설정 조회 실패 시 기본값 사용, 로깅은 할 수 있음
            console.warn(`[ChatCtrl] 사용자 ${user_id}의 AI 설정을 가져오지 못했습니다: ${settingError.message}`);
        }
      }


      const userMessageResult = await chatModel.saveUserMessageToDB(
        connection, session_id, user_id, message, user_message_token_count
      );
      // DB_ERROR 등은 chatModel 내에서 throw하고 여기서 잡힐 것임

      const userMessageId = userMessageResult.user_message_id;
      const chatHistoryForAI = await chatModel.getChatHistoryFromDB(
        connection, session_id, false, context_message_limit
      );

      const callOptions = {
        max_output_tokens_override,
        model_id_override: actualModelId, // 최종 결정된 모델 ID 전달
      };
      if (actualAiProvider === "ollama") callOptions.ollamaModel = actualModelId;

      let streamResponseCallback = null;
      if (specialModeType === "stream") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*"); // 필요시 CORS 설정
        res.flushHeaders();

        streamResponseCallback = (chunk, error) => { // 에러도 받을 수 있도록 수정
            if (error) {
                // 스트리밍 중 에러 발생 시 어떻게 처리할지? (이미 헤더는 전송됨)
                // res.write로 에러 이벤트를 보내고 연결을 종료할 수 있음.
                res.write(`event: error\ndata: ${JSON.stringify({ code: error.code || 'STREAM_ERROR', message: error.message })}\n\n`);
                res.end();
                // 여기서 throw를 하면 안됨 (이미 응답 시작됨)
                return;
            }
            if (chunk) {
                 res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
            }
        };
        res.write(`event: ids\ndata: ${JSON.stringify({ userMessageId: userMessageId.toString() })}\n\n`);
      }

      const requestContext = { clientIp: req.ip || req.connection.remoteAddress || "127.0.0.1" };

      const aiResponseFull = await fetchChatCompletion(
        actualAiProvider, message, chatHistoryForAI, systemPrompt,
        specialModeType, streamResponseCallback, callOptions, requestContext
      );

      // 스트리밍이 아닌 경우 또는 스트리밍 후 최종 처리
      if (specialModeType !== 'stream' || (aiResponseFull && !aiResponseFull.streaming_handled)) {
        if (!aiResponseFull || typeof aiResponseFull.content !== "string" || aiResponseFull.content.trim() === "") {
            const err = new Error("AI로부터 유효한 응답을 받지 못했습니다.");
            err.code = "AI_RESPONSE_ERROR";
            throw err;
        }

        const aiMessageResult = await chatModel.saveAiMessageToDB(
            connection, session_id, user_id, aiResponseFull.content, aiResponseFull.actual_output_tokens
        );

        return { // 컨트롤러에서 최종 응답을 위해 필요한 데이터 반환
            user_message_id: userMessageId,
            ai_message_id: aiMessageResult.ai_message_id,
            message: aiMessageResult.content, // DB에 저장된 최종 content
            created_at: aiMessageResult.created_at,
            ai_message_token_count: aiMessageResult.ai_message_token_count,
            ai_provider: actualAiProvider, // 응답에 AI 제공자 정보 포함
            model_id: actualModelId,       // 응답에 모델 ID 정보 포함
        };
      }
      // 스트리밍의 경우, 여기서 반환할 특별한 데이터가 없을 수 있음 (모든것이 콜백으로 처리됨)
      // 또는 스트리밍 완료 후 DB 저장된 ID 등을 반환할 수 있음.
      // 현재 로직은 스트리밍 시 aiResponseFull이 null이거나 streaming_handled:true를 가질 것으로 예상.
      // 만약 스트리밍 후에도 AI 메시지 ID 등을 받아야 한다면, fetchChatCompletion의 반환 값과 이 로직 수정 필요.
      // 지금은 스트리밍 시에는 이 withTransaction 콜백에서 null이나 특정 마커를 반환하고,
      // 스트리밍 콜백 내에서 res.end()를 호출하는 것으로 가정.
      // saveAiMessageToDB는 스트리밍 완료 후 호출되어야 함. fetchChatCompletion이 스트리밍 완료 후 최종 텍스트를 반환하도록 수정 필요.
      // --> fetchChatCompletion이 스트리밍시 { streaming_handled: true, fullContent: '...', ... } 등을 반환하도록 수정하거나,
      //     콜백에서 최종 텍스트를 받아 여기서 DB 저장.
      // 현재 fetchChatCompletion은 스트리밍 시 null 또는 { streaming_handled: true } 반환 가정.
      // AI 메시지 저장은 스트리밍이 아닌 경우에만 위에서 처리됨. 스트리밍의 경우 별도 처리 필요.
      if (specialModeType === 'stream' && aiResponseFull && aiResponseFull.streaming_handled) {
          // 스트리밍 완료 후 AI 메시지를 DB에 저장해야 한다면,
          // fetchChatCompletion이 최종 텍스트를 반환하거나, 콜백에서 최종 텍스트를 받아 여기서 처리.
          // 이 부분은 fetchChatCompletion의 스트리밍 처리 방식에 따라 달라짐.
          // 지금은 aiResponseFull.content 가 스트리밍 완료 후 전체 텍스트라고 가정하고,
          // 스트리밍 콜백은 단순히 청크만 전달하는 역할로 가정.
          if (aiResponseFull.content) { // 스트리밍 완료 후 전체 내용이 있다면
             const aiMessageResultFromStream = await chatModel.saveAiMessageToDB(
                connection, session_id, user_id, aiResponseFull.content, aiResponseFull.actual_output_tokens
            );
             if (streamResponseCallback) { // 스트리밍 콜백이 있다면 AI 메시지 ID도 보내줌
                res.write(`event: ai_message_id\ndata: ${JSON.stringify({ aiMessageId: aiMessageResultFromStream.ai_message_id.toString() })}\n\n`);
             }
            return { streaming_completed_and_saved: true, ai_message_id: aiMessageResultFromStream.ai_message_id };
          }
          return { streaming_handled: true }; // 마커 반환
      }
      // 이 부분은 로직이 복잡해질 수 있어, fetchChatCompletion의 스트리밍 처리 방식 명확화 필요.
      // 우선 기존 로직대로라면 스트리밍 시에는 responseData가 null이거나 특정 마커일 것.
      return null; // 스트리밍의 경우 여기서 특별히 반환할 것이 없을 수 있음
    });

    if (specialModeType === "stream") {
      // 스트리밍 응답의 경우, withTransaction이 성공적으로 완료되면 (에러 없이)
      // streamResponseCallback 내에서 또는 fetchChatCompletion 내부에서 res.end()가 호출되어야 함.
      // responseData가 { streaming_handled: true } 같은 마커를 반환했다면 여기서 res.end()
      if(responseData && responseData.streaming_completed_and_saved) {
           res.write(`event: end\ndata: ${JSON.stringify({ message: "Stream ended", ai_message_id: responseData.ai_message_id })}\n\n`);
      } else {
           res.write(`event: end\ndata: ${JSON.stringify({ message: "Stream ended" })}\n\n`);
      }
      res.end();
      return; // 명시적으로 여기서 종료
    }

    // 비스트리밍 응답 처리
    if (responseData) {
        let finalResponseData = { ...responseData };
        if (specialModeType === "canvas" && responseData.message) {
            const htmlRegex = /```html\n([\s\S]*?)\n```/;
            const cssRegex = /```css\n([\s\S]*?)\n```/;
            const jsRegex = /```javascript\n([\s\S]*?)\n```/;
            finalResponseData.canvas_html = responseData.message.match(htmlRegex)?.[1]?.trim() || "";
            finalResponseData.canvas_css = responseData.message.match(cssRegex)?.[1]?.trim() || "";
            finalResponseData.canvas_js = responseData.message.match(jsRegex)?.[1]?.trim() || "";
        }
        const apiResponse = standardizeApiResponse(finalResponseData);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    } else {
        // responseData가 null인 경우 (예: 스트리밍이었지만 위에서 return되지 않은 경우, 또는 예상치 못한 상황)
        // 이 경우는 발생하지 않아야 정상이지만, 방어적으로 처리
        const err = new Error("메시지 처리에 실패했습니다 (No response data).");
        err.code = "SERVER_ERROR";
        next(err);
    }

  } catch (err) {
    // console.error 제거, 중앙 핸들러에서 logError 사용
    next(err); // 중앙 에러 핸들러로 전달
  }
}

// =========================
// 9. 메시지 편집 기능 API
// =========================
async function editMessageController(req, res, next) {
  const { message_id } = req.params;
  const { new_content, edit_reason } = req.body;
  const user_id = req.user ? req.user.user_id : (req.body.user_id || "guest"); // 인증된 사용자 또는 테스트용

  if (!message_id || !new_content || typeof new_content !== "string" || new_content.trim().length === 0) {
    const err = new Error("메시지 ID와 새로운 내용(비어있지 않은 문자열)이 필요합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    const result = await withTransaction(async (connection) => {
      const editResult = await chatModel.editUserMessage(
        connection, message_id, user_id, new_content.trim(), edit_reason
      );
      // 경험치 지급 (같은 트랜잭션 내에서)
      if (user_id !== "guest") { // 게스트가 아닐 때만 경험치 지급
        try {
          await userModel.addUserExperience(connection, user_id, 5, "message_edit", "메시지 편집");
        } catch (expError) {
           console.warn(`[ChatCtrl-Edit] 사용자 ${user_id} 경험치 지급 실패: ${expError.message}`);
           // 경험치 지급 실패는 전체 트랜잭션을 롤백하지 않도록 처리 (선택적)
        }
      }
      return editResult;
    });

    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

async function getMessageEditHistoryController(req, res, next) {
  const { message_id } = req.params;
  if (!message_id) {
    const err = new Error("메시지 ID가 필요합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    // 이력 조회는 읽기 전용이므로 withTransaction이 필수는 아닐 수 있으나,
    // 일관성을 위해 또는 향후 이 함수가 쓰기 작업을 포함할 가능성을 대비해 사용 가능
    const editHistory = await withTransaction(async (connection) => {
        return await chatModel.getMessageEditHistory(connection, message_id);
    });
    const apiResponse = standardizeApiResponse(editHistory);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

async function requestAiReresponseController(req, res, next) {
  const { session_id, message_id } = req.params;
  const user_id = req.user ? req.user.user_id : (req.body.user_id || "guest");

  if (!session_id || !message_id) {
    const err = new Error("세션 ID와 메시지 ID가 필요합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const result = await withTransaction(async (connection) => {
        return await chatModel.requestAiReresponse(connection, session_id, message_id, user_id);
    });
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

// 메시지 리액션 추가 컨트롤러
async function addReactionController(req, res, next) {
  const { message_id } = req.params; // message_id로 변경 (라우트 정의 일치 가정)
  const { reaction } = req.body;

  if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
    const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!reaction || typeof reaction !== "string" || reaction.trim() === "" || reaction.length > 10) {
    const err = new Error("리액션은 필수이며 최대 10자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    let reactionUpdated = false;
    let messageExists = true;

    await withTransaction(async (connection) => {
      const messageCheck = await connection.execute(
        `SELECT message_id FROM chat_messages WHERE message_id = :messageId`,
        { messageId: message_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (messageCheck.rows.length === 0) {
        messageExists = false;
        return; // 트랜잭션 내에서 더 이상 진행 안함
      }

      const result = await connection.execute(
        `UPDATE chat_messages SET reaction = :reaction WHERE message_id = :messageId`,
        { reaction, messageId: message_id }, { autoCommit: false }
      );
      if (result.rowsAffected > 0) reactionUpdated = true;
    });

    if (!messageExists) {
        // 메시지가 없는 경우, 경고와 함께 200 OK 또는 404 Not Found 반환 가능
        // 여기서는 사용자에게 혼란을 주지 않기 위해 성공처럼 보이되, 경고 메시지를 포함하는 200을 반환
        const apiResponse = standardizeApiResponse({
            message: "메시지가 존재하지 않아 리액션을 추가할 수 없습니다. 메시지가 삭제되었을 수 있습니다.",
            reaction: null, // 또는 reaction: reaction (요청된 리액션)
            warning_code: "MESSAGE_NOT_FOUND_ON_REACTION"
        });
        return res.status(200).json(apiResponse.body); // statusCode는 200이지만, 내용은 경고
    }

    if (reactionUpdated) {
      const apiResponse = standardizeApiResponse({ message: "리액션이 성공적으로 추가되었습니다.", reaction });
      res.status(apiResponse.statusCode).json(apiResponse.body);
    } else {
      // 이 경우는 거의 발생하지 않아야 함 (messageExists가 true인데 update가 안된 경우)
      const err = new Error("리액션 추가에 실패했습니다 (알 수 없는 원인).");
      err.code = "SERVER_ERROR";
      next(err);
    }
  } catch (err) {
    next(err);
  }
}

// 메시지 리액션 제거 컨트롤러
async function removeReactionController(req, res, next) {
  const { message_id } = req.params;

  if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
    const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    let reactionRemoved = false;
    let messageExists = true;

    await withTransaction(async (connection) => {
      const messageCheck = await connection.execute(
        `SELECT message_id FROM chat_messages WHERE message_id = :messageId`,
        { messageId: message_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (messageCheck.rows.length === 0) {
        messageExists = false;
        return;
      }
      const result = await connection.execute(
        `UPDATE chat_messages SET reaction = NULL WHERE message_id = :messageId`,
        { messageId: message_id }, { autoCommit: false }
      );
      if (result.rowsAffected > 0) reactionRemoved = true;
    });

    if (!messageExists) {
        const apiResponse = standardizeApiResponse({
            message: "메시지가 존재하지 않아 리액션을 제거할 수 없습니다.",
            warning_code: "MESSAGE_NOT_FOUND_ON_REACTION"
        });
        return res.status(200).json(apiResponse.body);
    }
    if (reactionRemoved) {
      const apiResponse = standardizeApiResponse({ message: "리액션이 성공적으로 제거되었습니다." });
      res.status(apiResponse.statusCode).json(apiResponse.body);
    } else {
      const err = new Error("리액션 제거에 실패했습니다 (알 수 없는 원인 또는 이미 제거됨).");
      err.code = "SERVER_ERROR"; // 또는 NO_CHANGE
      next(err);
    }
  } catch (err) {
    next(err);
  }
}

// 메시지 삭제 컨트롤러
async function deleteMessageController(req, res, next) {
  const { message_id } = req.params;

  if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
     const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const deleted = await withTransaction(async (connection) => {
      return await chatModel.deleteUserMessageFromDB(connection, message_id);
    });

    if (!deleted) {
      const err = new Error("메시지를 찾을 수 없거나 삭제할 수 없습니다.");
      err.code = "MESSAGE_NOT_FOUND";
      return next(err); // 404로 처리될 것임
    }
    const apiResponse = standardizeApiResponse({ message: "메시지가 성공적으로 삭제되었습니다." });
    res.status(apiResponse.statusCode).json(apiResponse.body); // 보통 200 OK 또는 204 No Content
  } catch (err) {
    next(err);
  }
}

// 파일 업로드 처리 함수
async function uploadFile(req, res, next) {
  const { session_id } = req.params;
  const file = req.file; // multer에서 req.file에 저장
  const user_id = req.user ? req.user.user_id : (req.body.user_id || "guest"); // 인증 또는 body에서 user_id

  // --- Input Validation ---
  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    if (file && file.path) fs.unlinkSync(file.path); // 오류 시 임시 파일 삭제
    return next(err);
  }
  if (!file) {
    const err = new Error("업로드할 파일이 없습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"]; // config로 이동 가능
  const maxFileSize = 5 * 1024 * 1024; // 5MB, config로 이동 가능
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const err = new Error(`허용되지 않는 파일 타입입니다. (${allowedMimeTypes.join(", ")})`);
    err.code = "INVALID_INPUT";
    fs.unlinkSync(file.path);
    return next(err);
  }
  if (file.size > maxFileSize) {
    const err = new Error(`파일 크기가 너무 큽니다 (최대 ${maxFileSize / (1024 * 1024)}MB).`);
    err.code = "INVALID_INPUT";
    fs.unlinkSync(file.path);
    return next(err);
  }
  // --- Input Validation End ---

  const messageContent = `파일 업로드: ${file.originalname}`;

  try {
    const resultData = await withTransaction(async (connection) => {
      // 1. chat_messages 테이블에 'file' 타입 메시지 저장
      const messageResult = await connection.execute(
        `INSERT INTO chat_messages (session_id, user_id, message_type, message_content)
         VALUES (:sessionId, :user_id, 'file', :messageContent)
         RETURNING message_id INTO :outMessageId`,
        { sessionId: session_id, user_id, messageContent, outMessageId: { type: oracledb.STRING, dir: oracledb.BIND_OUT } },
        { autoCommit: false }
      );
      const messageId = messageResult.outBinds.outMessageId[0];
      if (!messageId) {
        const err = new Error("파일 메시지 저장 중 오류가 발생했습니다.");
        err.code = "DB_ERROR";
        throw err;
      }
      // 2. attachments 테이블에 파일 정보 저장
      const attachment = await chatModel.saveAttachmentToDB(connection, messageId, file);
      if (!attachment || !attachment.attachment_id) {
         const err = new Error("첨부 파일 정보 저장 중 오류가 발생했습니다.");
        err.code = "DB_ERROR";
        throw err;
      }
      return { message_id: messageId, attachment_id: attachment.attachment_id, file_info: file };
    });

    const apiResponse = standardizeApiResponse({
        message: "파일이 성공적으로 업로드되었습니다.",
        message_id: resultData.message_id,
        attachment_id: resultData.attachment_id,
        file_info: { // toSnakeCaseObj가 적용될 것이므로 camelCase로 전달해도 됨
          originalName: resultData.file_info.originalname,
          fileName: resultData.file_info.filename, // multer가 저장한 파일명
          path: resultData.file_info.path,       // 저장 경로
          mimetype: resultData.file_info.mimetype,
          size: resultData.file_info.size,
        },
      }, null); // 에러 없음
    // 파일 업로드 성공은 201 Created가 적절
    res.status(201).json(apiResponse.body);

  } catch (err) {
    // 트랜잭션 실패 시 multer가 이미 저장한 파일 삭제
    if (file && file.path) {
      try { fs.unlinkSync(file.path); }
      catch (unlinkErr) { console.error(`[ChatCtrl-Upload] 임시 파일 삭제 실패: ${unlinkErr.message}`); }
    }
    next(err);
  }
}

// 세션의 메시지 목록 조회 컨트롤러
async function getSessionMessagesController(req, res, next) {
  const { session_id } = req.params;
  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const messages = await withTransaction(async (connection) => { // 읽기 전용이지만 일관성을 위해
      return await chatModel.getSessionMessagesForClient(connection, session_id);
    });
    const apiResponse = standardizeApiResponse(messages);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendMessageController,
  editMessageController,
  getMessageEditHistoryController,
  requestAiReresponseController,
  addReactionController,
  deleteMessageController,
  removeReactionController,
  uploadFile,
  getSessionMessagesController,
};
