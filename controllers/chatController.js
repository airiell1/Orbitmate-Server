// controllers/chatController.js - ServiceFactory 패턴 적용
const {
  createController,
  createStreamController,
  createFileUploadController,
  createReadController,
  createUpdateController,
  createDeleteController
} = require("../utils/serviceFactory");
const { validateBatch } = require("../utils/validation");
const chatService = require("../services/chatService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { 
  validateSessionId, 
  validateMessageId, 
  validateStringLength, 
  validateNumberRange,
  validateUserAccess,
  validateFileType 
} = require("../utils/validation");
const { validateFileSizeByTier, cleanupFailedUploads } = require("../utils/fileUtils");
const config = require("../config");

// =========================
// 💬 채팅 메시지 관리 (Chat Message Management)
// =========================

/**
 * 채팅 메시지 전송 및 AI 응답 컨트롤러 - 스트리밍 지원
 * POST /api/chat/sessions/:session_id/messages
 */
const sendMessageController = createStreamController(
  chatService.sendMessageService,
  {
    dataExtractor: (req) => {
      const { session_id } = req.params;
      const messageData = req.body || {};
      const user_id = req.user?.user_id;
      const clientIp = req.ip || req.connection.remoteAddress || "127.0.0.1";
      
      if (!user_id) {
        const err = new Error("사용자 인증이 필요합니다.");
        err.code = "UNAUTHORIZED";
        throw err;
      }
      
      return [session_id, user_id, messageData, clientIp];
    },
    validations: [
      (req) => {
        const { session_id } = req.params;
        const messageData = req.body || {};
        
        // 🔍 배치 유효성 검사 사용
        return validateBatch([
          () => validateSessionId(req),
          () => validateStringLength(messageData.message, "message", 1, 4000),
          () => {
            // 특수 모드 타입 검사
            const allowedSpecialModeTypes = ["stream", "canvas"];
            if (messageData.specialModeType && !allowedSpecialModeTypes.includes(messageData.specialModeType)) {
              const err = new Error(`잘못된 specialModeType 값입니다. 허용되는 값: ${allowedSpecialModeTypes.join(", ")}.`);
              err.code = "INVALID_INPUT";
              return err;
            }
            return null;
          },
          () => {
            // 숫자 매개변수 검사
            if (messageData.max_output_tokens_override !== undefined) {
              return validateNumberRange(messageData.max_output_tokens_override, "max_output_tokens_override", 1);
            }
            return null;
          },
          () => {
            if (messageData.context_message_limit !== undefined) {
              return validateNumberRange(messageData.context_message_limit, "context_message_limit", 0);
            }
            return null;
          }
        ]);
      }
    ],
    responseTransformer: (result, req) => {
      const messageData = req.body;
      
      // 캔버스 모드의 경우 HTML/CSS/JS 추출
      if (messageData.specialModeType === "canvas" && result.message) {
        const htmlRegex = /```html\n([\s\S]*?)\n```/;
        const cssRegex = /```css\n([\s\S]*?)\n```/;
        const jsRegex = /```javascript\n([\s\S]*?)\n```/;
        
        return {
          ...result,
          canvas_html: result.message.match(htmlRegex)?.[1]?.trim() || "",
          canvas_css: result.message.match(cssRegex)?.[1]?.trim() || "",
          canvas_js: result.message.match(jsRegex)?.[1]?.trim() || ""
        };
      }
      
      return result;
    },
    streamType: 'sse',
    errorContext: 'send_message'
  }
);

/**
 * 메시지 편집 컨트롤러 - ServiceFactory 패턴 적용
 * PUT /api/chat/messages/:message_id
 */
const editMessageController = createUpdateController(
  chatService.editMessageService,
  {
    dataExtractor: (req) => {
      const { message_id } = req.params;
      const { content, edit_reason } = req.body;
      const user_id = req.user?.user_id || req.body.user_id;
      
      if (!user_id) {
        const err = new Error("사용자 인증이 필요합니다.");
        err.code = "UNAUTHORIZED";
        throw err;
      }
      
      // content가 undefined인 경우 빈 문자열로 처리하여 trim() 에러 방지
      const safeContent = content || '';
      
      return [message_id, user_id, safeContent.trim(), edit_reason];
    },
    validations: [
      (req) => {
        const { message_id } = req.params;
        const { content } = req.body;
        
        if (!message_id || !content || typeof content !== "string" || content.trim().length === 0) {
          const err = new Error("메시지 ID와 새로운 내용(비어있지 않은 문자열)이 필요합니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successMessage: "메시지가 성공적으로 편집되었습니다.",
    errorContext: 'edit_message'
  }
);

/**
 * 메시지 편집 기록 조회 컨트롤러 - ServiceFactory 패턴 적용
 * GET /api/chat/messages/:message_id/history
 */
const getMessageEditHistoryController = createReadController(
  chatService.getMessageEditHistoryService,
  {
    dataExtractor: (req) => {
      const { message_id } = req.params;
      return [message_id];
    },
    validations: [
      (req) => {
        const { message_id } = req.params;
        
        if (!message_id || typeof message_id !== "string" || message_id.trim() === "") {
          const err = new Error("메시지 ID는 필수입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    errorContext: 'get_message_edit_history'
  }
);

/**
 * AI 재응답 요청 컨트롤러 - ServiceFactory 패턴 적용
 * POST /api/chat/sessions/:session_id/messages/:message_id/reresponse
 */
const requestAiReresponseController = createController(
  chatService.requestAiReresponseService,
  {
    dataExtractor: (req) => {
      const { session_id, message_id } = req.params;
      const user_id = req.user?.user_id;
      
      if (!user_id) {
        const err = new Error("사용자 인증이 필요합니다.");
        err.code = "UNAUTHORIZED";
        throw err;
      }
      
      return [session_id, message_id, user_id];
    },
    validations: [
      (req) => {
        const { session_id, message_id } = req.params;
        
        if (!session_id || typeof session_id !== "string" || session_id.trim() === "" || session_id.length > 36) {
          const err = new Error("세션 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
          const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successMessage: "AI 재응답이 성공적으로 요청되었습니다.",
    errorContext: 'request_ai_reresponse'
  }
);

/**
 * 메시지 리액션 추가 컨트롤러 - ServiceFactory 패턴 적용
 * POST /api/chat/messages/:message_id/reaction
 */
const addReactionController = createController(
  chatService.upsertReactionService,
  {
    dataExtractor: (req) => {
      const { message_id } = req.params;
      const { reaction } = req.body;
      
      return [message_id, reaction];
    },
    validations: [
      (req) => {
        const { message_id } = req.params;
        const { reaction } = req.body;
        
        if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
          const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
        
        if (!reaction || typeof reaction !== "string" || reaction.trim() === "" || reaction.length > 10) {
          const err = new Error("리액션은 필수이며 최대 10자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successMessage: "리액션이 성공적으로 추가되었습니다.",
    errorContext: 'add_reaction'
  }
);

/**
 * 메시지 리액션 제거 컨트롤러 - ServiceFactory 패턴 적용
 * DELETE /api/chat/messages/:message_id/reaction
 */
const removeReactionController = createDeleteController(
  chatService.removeReactionService,
  {
    dataExtractor: (req) => {
      const { message_id } = req.params;
      return [message_id];
    },
    validations: [
      (req) => {
        const { message_id } = req.params;
        
        if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
          const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successMessage: "리액션이 성공적으로 제거되었습니다.",
    errorContext: 'remove_reaction'
  }
);

/**
 * 메시지 삭제 컨트롤러 - ServiceFactory 패턴 적용
 * DELETE /api/chat/messages/:message_id
 */
const deleteMessageController = createDeleteController(
  chatService.deleteMessageService,
  {
    dataExtractor: (req) => {
      const { message_id } = req.params;
      const user_id = req.user?.user_id;
      
      if (!user_id) {
        const err = new Error("사용자 인증이 필요합니다.");
        err.code = "UNAUTHORIZED";
        throw err;
      }
      
      return [message_id, user_id];
    },
    validations: [
      (req) => {
        const { message_id } = req.params;
        
        if (!message_id || typeof message_id !== "string" || message_id.trim() === "" || message_id.length > 36) {
          const err = new Error("메시지 ID는 필수이며 최대 36자입니다.");
          err.code = "INVALID_INPUT";
          throw err;
        }
      }
    ],
    successMessage: "메시지가 성공적으로 삭제되었습니다.",
    errorContext: 'delete_message'
  }
);

/**
 * 파일 업로드 컨트롤러 - ServiceFactory 패턴 적용 (개선된 에러 처리)
 * POST /api/chat/sessions/:session_id/upload
 */
const uploadFile = createFileUploadController(
  chatService.uploadFileService,
  {
    dataExtractor: (req) => {
      const { session_id } = req.params;
      const { message_content } = req.body;
      const user_id = req.user?.user_id;
      const files = req.files || (req.file ? [req.file] : []);
      const file = files.length > 0 ? files[0] : null;
      
      if (!user_id) {
        const err = new Error("사용자 인증이 필요합니다.");
        err.code = "UNAUTHORIZED";
        throw err;
      }
      
      return [session_id, user_id, file, message_content];
    },
    validations: [
      (req) => {
        const { session_id } = req.params;
        
        // 🔍 배치 유효성 검사 사용
        return validateBatch([
          () => validateSessionId(req),
          () => {
            // 파일 존재 체크
            const files = req.files || (req.file ? [req.file] : []);
            const file = files.length > 0 ? files[0] : null;
            
            if (!file) {
              const err = new Error("업로드할 파일이 필요합니다.");
              err.code = "INVALID_INPUT";
              return err;
            }
            return null;
          }
        ]);
      }
    ],
    fileValidations: [
      (file, req) => {
        // 🔍 파일 유효성 검사
        return validateBatch([
          () => validateFileType(file),
          () => {
            // 구독 등급별 파일 크기 제한 (기본: comet)
            const tier = req.userSubscription?.tier?.tier_name || 'comet';
            return validateFileSizeByTier(file, tier);
          }
        ]);
      }
    ],
    onError: async (error, req) => {
      // 🧹 에러 발생 시 업로드된 파일 정리
      const files = req.files || (req.file ? [req.file] : []);
      if (files.length > 0) {
        await cleanupFailedUploads(files);
      }
    },
    responseTransformer: (result, req) => {
      return {
        message: "파일이 성공적으로 업로드되었습니다.",
        ...result
      };
    },
    errorContext: 'upload_file'
  }
);

/**
 * 세션 메시지 목록 조회 컨트롤러 - ServiceFactory 패턴 적용 (강화된 검증)
 * GET /api/chat/sessions/:session_id/messages
 */
const getSessionMessagesController = createReadController(
  chatService.getSessionMessagesService,
  {
    dataExtractor: (req) => {
      const { session_id } = req.params;
      return [session_id];
    },
    validations: [
      (req) => {
        const { session_id } = req.params;
        
        // 🔍 강화된 유효성 검사
        return validateBatch([
          () => {
            if (!session_id || session_id === 'undefined' || session_id === 'null') {
              const err = new Error("세션 ID가 제공되지 않았습니다.");
              err.code = "INVALID_INPUT";
              return err;
            }
            return null;
          },
          () => validateSessionId(req),
          () => validateStringLength(session_id, "session_id", 1, 100)
        ]);
      }
    ],
    errorContext: 'get_session_messages'
  }
);

module.exports = {
  sendMessageController,
  editMessageController,
  getMessageEditHistoryController,
  requestAiReresponseController,
  addReactionController,
  removeReactionController,
  deleteMessageController,
  uploadFile,
  getSessionMessagesController,
};
