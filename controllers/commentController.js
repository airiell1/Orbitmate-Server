// controllers/commentController.js
const commentService = require("../services/commentService");
const { standardizeApiResponse } = require("../utils/apiResponse");

/**
 * 댓글 생성 컨트롤러
 */
async function createCommentController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { content, parent_comment_id } = req.body;
    
    // 입력값 검증
    if (!content || content.trim() === '') {
      const error = new Error("댓글 내용이 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const commentData = {
      post_id: parseInt(post_id),
      parent_comment_id: parent_comment_id ? parseInt(parent_comment_id) : null,
      user_id: req.body.user_id || 'anonymous',
      user_ip: req.ip || req.connection.remoteAddress,
      content: content.trim()
    };

    const result = await commentService.createCommentService(commentData);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
    
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 목록 조회 컨트롤러
 */
async function getCommentsController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const result = await commentService.getCommentsService(parseInt(post_id), options);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
    
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 수정 컨트롤러
 */
async function updateCommentController(req, res, next) {
  try {
    const { comment_id } = req.params;
    const { content, user_id } = req.body;
    
    // 입력값 검증
    if (!content || content.trim() === '') {
      const error = new Error("댓글 내용이 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    if (!user_id) {
      const error = new Error("사용자 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const updateData = {
      content: content.trim()
    };

    const result = await commentService.updateCommentService(
      parseInt(comment_id), 
      updateData, 
      user_id
    );
    
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);
    
  } catch (error) {
    next(error);
  }
}

/**
 * 댓글 삭제 컨트롤러
 */
async function deleteCommentController(req, res, next) {
  try {
    const { comment_id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      const error = new Error("사용자 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const result = await commentService.deleteCommentService(
      parseInt(comment_id), 
      user_id
    );
    
    const apiResponse = standardizeApiResponse({ 
      success: result,
      message: result ? "댓글이 삭제되었습니다." : "댓글 삭제에 실패했습니다."
    });
    
    res.status(apiResponse.statusCode).json(apiResponse.body);
    
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCommentController,
  getCommentsController,
  updateCommentController,
  deleteCommentController
};
