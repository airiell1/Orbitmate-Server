// routes/comments.js
const express = require("express");
const router = express.Router();
const {
  createCommentController,
  getCommentsController,
  updateCommentController,
  deleteCommentController
} = require("../controllers/commentController");

// 댓글 생성 (특정 게시물에)
router.post("/posts/:post_id/comments", createCommentController);

// 댓글 목록 조회 (특정 게시물의)
router.get("/posts/:post_id/comments", getCommentsController);

// 댓글 수정
router.put("/comments/:comment_id", updateCommentController);

// 댓글 삭제
router.delete("/comments/:comment_id", deleteCommentController);

module.exports = router;
