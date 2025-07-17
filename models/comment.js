// models/comment.js
const { oracledb } = require("../config/database");
const { handleOracleError } = require("../utils/errorHandler");
const { toSnakeCaseObj, clobToString } = require("../utils/dbUtils");

/**
 * 댓글 생성
 * @param {oracledb.Connection} connection - DB connection object
 * @param {Object} commentData - 댓글 데이터
 * @returns {Promise<Object>} 생성된 댓글 정보
 */
async function createComment(connection, commentData) {
  try {
    const { post_id, parent_comment_id, user_id, user_ip, content } = commentData;
    
    const result = await connection.execute(
      `INSERT INTO post_comments (comment_id, post_id, parent_comment_id, user_id, user_ip, content, created_date, updated_date) 
       VALUES (post_comments_seq.NEXTVAL, :post_id, :parent_comment_id, :user_id, :user_ip, :content, SYSDATE, SYSDATE) 
       RETURNING comment_id INTO :comment_id`,
      {
        post_id,
        parent_comment_id: parent_comment_id || null,
        user_id,
        user_ip,
        content,
        comment_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: false }
    );

    const commentId = result.outBinds.comment_id[0];
    
    // 생성된 댓글 정보 조회
    const commentResult = await connection.execute(
      `SELECT comment_id, post_id, parent_comment_id, user_id, user_ip, content, is_deleted, created_date, updated_date
       FROM post_comments 
       WHERE comment_id = :comment_id`,
      { comment_id: commentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );

    if (commentResult.rows.length === 0) {
      throw new Error("댓글 생성 후 조회 실패");
    }

    const comment = commentResult.rows[0];
    const processedComment = toSnakeCaseObj(comment);
    
    // VARCHAR2이므로 CLOB 변환 불필요
    
    return processedComment;
    
  } catch (error) {
    console.error('[comment model] createComment error:', error);
    throw handleOracleError(error);
  }
}

/**
 * 게시물의 댓글 목록 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} postId - 게시물 ID
 * @param {Object} options - 옵션 (페이징 등)
 * @returns {Promise<Array>} 댓글 목록
 */
async function getCommentsByPostId(connection, postId, options = {}) {
  try {
    const { limit = 100, offset = 0 } = options;
    
    const result = await connection.execute(
      `SELECT * FROM (
         SELECT comment_id, post_id, parent_comment_id, user_id, user_ip, content, is_deleted, created_date, updated_date, 
                ROW_NUMBER() OVER (ORDER BY created_date ASC) as rn
         FROM post_comments 
         WHERE post_id = :post_id AND is_deleted = 0
       ) WHERE rn > :offset AND rn <= :end_row`,
      { 
        post_id: postId, 
        offset: offset, 
        end_row: offset + limit 
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );

    const comments = [];
    for (const row of result.rows) {
      const comment = toSnakeCaseObj(row);
      // VARCHAR2이므로 CLOB 변환 불필요
      comments.push(comment);
    }

    return comments;
    
  } catch (error) {
    console.error('[comment model] getCommentsByPostId error:', error);
    throw handleOracleError(error);
  }
}

/**
 * 댓글 상세 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} commentId - 댓글 ID
 * @returns {Promise<Object>} 댓글 정보
 */
async function getCommentById(connection, commentId) {
  try {
    const result = await connection.execute(
      `SELECT comment_id, post_id, parent_comment_id, user_id, user_ip, content, is_deleted, created_date, updated_date
       FROM post_comments 
       WHERE comment_id = :comment_id`,
      { comment_id: commentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );

    if (result.rows.length === 0) {
      const error = new Error("댓글을 찾을 수 없습니다.");
      error.code = "COMMENT_NOT_FOUND";
      throw error;
    }

    const comment = toSnakeCaseObj(result.rows[0]);
    // VARCHAR2이므로 CLOB 변환 불필요
    
    return comment;
    
  } catch (error) {
    console.error('[comment model] getCommentById error:', error);
    throw handleOracleError(error);
  }
}

/**
 * 댓글 수정
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} commentId - 댓글 ID
 * @param {Object} updateData - 수정 데이터
 * @returns {Promise<Object>} 수정된 댓글 정보
 */
async function updateComment(connection, commentId, updateData) {
  try {
    const { content } = updateData;
    
    await connection.execute(
      `UPDATE post_comments 
       SET content = :content, updated_date = SYSDATE 
       WHERE comment_id = :comment_id`,
      { content, comment_id: commentId },
      { autoCommit: false }
    );

    return await getCommentById(connection, commentId);
    
  } catch (error) {
    console.error('[comment model] updateComment error:', error);
    throw handleOracleError(error);
  }
}

/**
 * 댓글 삭제 (소프트 삭제)
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} commentId - 댓글 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
async function deleteComment(connection, commentId) {
  try {
    const result = await connection.execute(
      `UPDATE post_comments 
       SET is_deleted = 1, updated_date = SYSDATE 
       WHERE comment_id = :comment_id`,
      { comment_id: commentId },
      { autoCommit: false }
    );

    return result.rowsAffected > 0;
    
  } catch (error) {
    console.error('[comment model] deleteComment error:', error);
    throw handleOracleError(error);
  }
}

/**
 * 댓글 개수 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} postId - 게시물 ID
 * @returns {Promise<number>} 댓글 개수
 */
async function getCommentCount(connection, postId) {
  try {
    const result = await connection.execute(
      `SELECT COUNT(*) as comment_count 
       FROM post_comments 
       WHERE post_id = :post_id AND is_deleted = 0`,
      { post_id: postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );

    return result.rows[0].COMMENT_COUNT;
    
  } catch (error) {
    console.error('[comment model] getCommentCount error:', error);
    throw handleOracleError(error);
  }
}

module.exports = {
  createComment,
  getCommentsByPostId,
  getCommentById,
  updateComment,
  deleteComment,
  getCommentCount
};
