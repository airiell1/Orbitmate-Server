// services/commentService.js
const commentModel = require("../models/comment");
const postModel = require("../models/post");
const { withTransaction } = require("../utils/dbUtils");
const { handleOracleError } = require("../utils/errorHandler");

/**
 * 댓글 생성 서비스
 * @param {Object} commentData - 댓글 데이터
 * @returns {Promise<Object>} 생성된 댓글 정보
 */
async function createCommentService(commentData) {
  try {
    return await withTransaction(async (connection) => {
      // 게시물 존재 여부 확인
      const postExists = await connection.execute(
        `SELECT idx FROM posts WHERE idx = :post_id`,
        { post_id: commentData.post_id }
      );
      
      if (postExists.rows.length === 0) {
        const error = new Error("게시물을 찾을 수 없습니다.");
        error.code = "POST_NOT_FOUND";
        throw error;
      }

      // 부모 댓글 존재 여부 확인 (대댓글인 경우)
      if (commentData.parent_comment_id) {
        const parentExists = await connection.execute(
          `SELECT comment_id FROM post_comments WHERE comment_id = :parent_id AND is_deleted = 0`,
          { parent_id: commentData.parent_comment_id }
        );
        
        if (parentExists.rows.length === 0) {
          const error = new Error("부모 댓글을 찾을 수 없습니다.");
          error.code = "PARENT_COMMENT_NOT_FOUND";
          throw error;
        }
      }

      const result = await commentModel.createComment(connection, commentData);
      return result;
    });
  } catch (error) {
    console.error('[commentService] createCommentService error:', error);
    throw error;
  }
}

/**
 * 게시물의 댓글 목록 조회 서비스
 * @param {number} postId - 게시물 ID
 * @param {Object} options - 옵션 (페이징 등)
 * @returns {Promise<Object>} 댓글 목록과 메타 정보
 */
async function getCommentsService(postId, options = {}) {
  try {
    return await withTransaction(async (connection) => {
      // 게시물 존재 여부 확인
      const postExists = await connection.execute(
        `SELECT idx FROM posts WHERE idx = :post_id`,
        { post_id: postId }
      );
      
      if (postExists.rows.length === 0) {
        const error = new Error("게시물을 찾을 수 없습니다.");
        error.code = "POST_NOT_FOUND";
        throw error;
      }

      const comments = await commentModel.getCommentsByPostId(connection, postId, options);
      const totalCount = await commentModel.getCommentCount(connection, postId);

      // 댓글을 트리 구조로 변환
      const commentTree = buildCommentTree(comments);

      return {
        post_id: postId,
        comments: commentTree,
        total_count: totalCount,
        page_info: {
          limit: options.limit || 100,
          offset: options.offset || 0,
          has_more: comments.length === (options.limit || 100)
        }
      };
    });
  } catch (error) {
    console.error('[commentService] getCommentsService error:', error);
    throw error;
  }
}

/**
 * 댓글 수정 서비스
 * @param {number} commentId - 댓글 ID
 * @param {Object} updateData - 수정 데이터
 * @param {string} userId - 사용자 ID (권한 체크용)
 * @returns {Promise<Object>} 수정된 댓글 정보
 */
async function updateCommentService(commentId, updateData, userId) {
  try {
    return await withTransaction(async (connection) => {
      // 댓글 존재 여부 및 권한 확인
      const comment = await commentModel.getCommentById(connection, commentId);
      
      if (comment.user_id !== userId) {
        const error = new Error("댓글을 수정할 권한이 없습니다.");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      const result = await commentModel.updateComment(connection, commentId, updateData);
      return result;
    });
  } catch (error) {
    console.error('[commentService] updateCommentService error:', error);
    throw error;
  }
}

/**
 * 댓글 삭제 서비스
 * @param {number} commentId - 댓글 ID
 * @param {string} userId - 사용자 ID (권한 체크용)
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
async function deleteCommentService(commentId, userId) {
  try {
    return await withTransaction(async (connection) => {
      // 댓글 존재 여부 및 권한 확인
      const comment = await commentModel.getCommentById(connection, commentId);
      
      if (comment.user_id !== userId) {
        const error = new Error("댓글을 삭제할 권한이 없습니다.");
        error.code = "UNAUTHORIZED";
        throw error;
      }

      const result = await commentModel.deleteComment(connection, commentId);
      return result;
    });
  } catch (error) {
    console.error('[commentService] deleteCommentService error:', error);
    throw error;
  }
}

/**
 * 댓글을 트리 구조로 변환
 * @param {Array} comments - 댓글 배열
 * @returns {Array} 트리 구조 댓글 배열
 */
function buildCommentTree(comments) {
  const commentMap = new Map();
  const rootComments = [];

  // 모든 댓글을 맵에 저장
  comments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.comment_id, comment);
  });

  // 부모-자식 관계 설정
  comments.forEach(comment => {
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  });

  return rootComments;
}

module.exports = {
  createCommentService,
  getCommentsService,
  updateCommentService,
  deleteCommentService
};
