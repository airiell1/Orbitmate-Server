// routes/search.js
const express = require('express');
const router = express.Router();
const { searchWikipediaController } = require('../controllers/searchController');
// const authMiddleware = require('../middleware/auth'); // 필요시 인증 추가

// 위키피디아 검색 API
router.get('/wikipedia', searchWikipediaController);

module.exports = router;
