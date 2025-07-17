// routes/posts.js
const express = require("express");
const router = express.Router();
const {
  createPostController,
  getPostListController,
  getPostDetailController,
  updatePostController,
  deletePostController,
  translatePostController,
  getPostTranslationsController
} = require("../controllers/postController");

// 게시물 생성
router.post("/", createPostController);

// 게시물 목록 조회
router.get("/", getPostListController);

// 게시물 상세 조회
router.get("/:post_id", getPostDetailController);

// 게시물 수정
router.put("/:post_id", updatePostController);

// 게시물 삭제
router.delete("/:post_id", deletePostController);

// 게시물 번역 요청
router.post("/:post_id/translations", translatePostController);

// 게시물 번역 목록 조회
router.get("/:post_id/translations", getPostTranslationsController);

module.exports = router;
