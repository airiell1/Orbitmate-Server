// const { oracledb } = require("../config/database"); // 컨트롤러에서 직접 oracledb 사용 안 함
const chatService = require("../services/chatService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const fs = require("fs"); // 파일 처리 시 필요할 수 있음
// config는 서비스 계층에서 주로 사용될 것임

// 채팅 메시지 전송 및 AI 응답 받기 컨트롤러
async function sendMessageController(req, res, next) {
  const { session_id } = req.params;
  const messageData = req.body; // 서비스에 필요한 모든 데이터를 담은 객체
  const user_id = req.user ? req.user.user_id : "guest"; // 실제로는 인증 미들웨어에서 req.user를 설정해야 함
  const clientIp = req.ip || req.connection.remoteAddress || "127.0.0.1";

  // --- 입력값 유효성 검사 ---
  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!messageData.message || typeof messageData.message !== "string" || messageData.message.trim() === "" || messageData.message.length > 4000) {
    const err = new Error("메시지는 필수이며 최대 4000자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  const allowedSpecialModeTypes = ["stream", "canvas"]; // config로 이동 가능
  if (messageData.specialModeType && !allowedSpecialModeTypes.includes(messageData.specialModeType)) {
    const err = new Error(`잘못된 specialModeType 값입니다. 허용되는 값: ${allowedSpecialModeTypes.join(", ")}.`);
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // 추가적인 messageData 내 필드 유효성 검사 (예: max_output_tokens_override가 숫자인지 등)
  if (messageData.max_output_tokens_override !== undefined && (typeof messageData.max_output_tokens_override !== 'number' || messageData.max_output_tokens_override <= 0)) {
    const err = new Error("max_output_tokens_override는 양의 정수여야 합니다.");
    err.code = "INVALID_INPUT"; return next(err);
  }
  if (messageData.context_message_limit !== undefined && (typeof messageData.context_message_limit !== 'number' || messageData.context_message_limit < 0)) {
    const err = new Error("context_message_limit는 0 이상의 정수여야 합니다.");
    err.code = "INVALID_INPUT"; return next(err);
  }
  // --- 입력값 유효성 검사 끝 ---

  try {
    let streamResponseCallback = null;
    if (messageData.specialModeType === "stream") {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*"); // 개발 중에만 사용, 프로덕션에서는 특정 도메인 지정
      res.flushHeaders();

      streamResponseCallback = (chunk, error, eventType = 'delta') => {
        if (error) {
          res.write(`event: error\ndata: ${JSON.stringify({ code: error.code || 'STREAM_ERROR', message: error.message })}\n\n`);
          res.end();
          return;
        }
        if (chunk === null && eventType === 'end') { // 스트림 종료 명시적 처리
          res.write(`event: end\ndata: ${JSON.stringify({ message: "Stream ended" })}\n\n`);
          res.end();
          return;
        }
        // userMessageId, aiMessageId 등을 위한 이벤트 타입 처리
        if (eventType === 'ids' && typeof chunk === 'object' && chunk.userMessageId) {
             res.write(`event: ids\ndata: ${JSON.stringify(chunk)}\n\n`);
        } else if (eventType === 'ai_message_id' && typeof chunk === 'object' && chunk.aiMessageId) {
             res.write(`event: ai_message_id\ndata: ${JSON.stringify(chunk)}\n\n`);
        } else if (eventType === 'delta' && typeof chunk === 'string') { // 실제 메시지 청크
            res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
        }
      };
    }

    const result = await chatService.sendMessageService(
      session_id, userId, messageData, clientIp, streamResponseCallback
    );

    if (messageData.specialModeType !== 'stream') {
      if (!result) {
          const err = new Error("메시지 처리에 실패했습니다 (서비스로부터 응답 없음).");
          err.code = "SERVER_ERROR";
          return next(err);
      }
      let finalResponseData = { ...result };
       if (messageData.specialModeType === "canvas" && result.message) {
            const htmlRegex = /```html\n([\s\S]*?)\n```/;
            const cssRegex = /```css\n([\s\S]*?)\n```/;
            const jsRegex = /```javascript\n([\s\S]*?)\n```/;
            finalResponseData.canvas_html = result.message.match(htmlRegex)?.[1]?.trim() || "";
            finalResponseData.canvas_css = result.message.match(cssRegex)?.[1]?.trim() || "";
            finalResponseData.canvas_js = result.message.match(jsRegex)?.[1]?.trim() || "";
        }
      const apiResponse = standardizeApiResponse(finalResponseData);
      res.status(apiResponse.statusCode).json(apiResponse.body);
    }
    // 스트리밍의 경우, streamResponseCallback에서 res.end()가 호출되므로 여기서 추가 응답 X
  } catch (err) {
    if (res.headersSent && messageData.specialModeType === 'stream') {
        // 스트리밍 중 에러 발생 시 이미 응답이 시작되었을 수 있음
        // streamResponseCallback에서 에러 처리가 되었어야 함
        console.error("[ChatCtrl] sendMessageController Error after headers sent:", err);
        // res.end()가 이미 호출되었을 수 있으므로 추가 작업 지양
    } else {
        next(err);
    }
  }
}

async function editMessageController(req, res, next) {
  const { message_id } = req.params;
  const { new_content, edit_reason } = req.body;
  const user_id = req.user ? req.user.user_id : (req.body.user_id || "guest");

  if (!message_id || !new_content || typeof new_content !== "string" || new_content.trim().length === 0) {
    const err = new Error("메시지 ID와 새로운 내용(비어있지 않은 문자열)이 필요합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const result = await chatService.editMessageService(message_id, user_id, new_content.trim(), edit_reason);
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
    const editHistory = await chatService.getMessageEditHistoryService(message_id);
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
    const result = await chatService.requestAiReresponseService(session_id, message_id, user_id);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    next(error);
  }
}

async function addReactionController(req, res, next) {
  const { message_id } = req.params;
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
    const result = await chatService.upsertReactionService(message_id, reaction);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

async function removeReactionController(req, res, next) {
  const { message_id } = req.params;
  if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
    const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const result = await chatService.removeReactionService(message_id);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

async function deleteMessageController(req, res, next) {
  const { message_id } = req.params;
  if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
     const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const result = await chatService.deleteMessageService(message_id);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

async function uploadFile(req, res, next) {
  const { session_id } = req.params;
  const file = req.file;
  const user_id = req.user ? req.user.user_id : (req.body.user_id || "guest");

  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){}
    return next(err);
  }
  if (!file) {
    const err = new Error("업로드할 파일이 없습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  // config 등으로 설정값 이동 고려
  const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimeTypes.includes(file.mimetype)) {
    const err = new Error(`허용되지 않는 파일 타입입니다. (${allowedMimeTypes.join(", ")})`);
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){}
    return next(err);
  }
  if (file.size > maxFileSize) {
    const err = new Error(`파일 크기가 너무 큽니다 (최대 ${maxFileSize / (1024 * 1024)}MB).`);
    err.code = "INVALID_INPUT";
    if (file && file.path) try { fs.unlinkSync(file.path); } catch(e){}
    return next(err);
  }

  const messageContent = `파일 업로드: ${file.originalname}`;

  try {
    const resultData = await chatService.uploadFileService(session_id, user_id, file, messageContent);
    const apiResponse = standardizeApiResponse({
        message: "파일이 성공적으로 업로드되었습니다.",
        ...resultData
      }, null);
    res.status(201).json(apiResponse.body);
  } catch (err) {
    if (file && file.path) {
      try { fs.unlinkSync(file.path); }
      catch (unlinkErr) { console.error(`[ChatCtrl-Upload] 임시 파일 삭제 실패: ${unlinkErr.message}`); }
    }
    next(err);
  }
}

async function getSessionMessagesController(req, res, next) {
  const { session_id } = req.params;
  if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
    const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const messages = await chatService.getSessionMessagesService(session_id);
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
