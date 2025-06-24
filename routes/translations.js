const express = require("express");
const translationController = require("../controllers/translationController");
const router = express.Router();

// 번역 리소스 조회
// 예: GET /api/translations/ko
// 예: GET /api/translations/en?category=common
router.get("/:lang", translationController.getTranslationResourcesController);

module.exports = router;
