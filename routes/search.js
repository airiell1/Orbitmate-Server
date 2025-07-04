// routes/search.js
const express = require('express');
const router = express.Router();
const { searchWikipediaController, searchWeatherController } = require('../controllers/searchController');

// 위키피디아 검색 API
router.get('/wikipedia', searchWikipediaController);

// 날씨 검색 API (IP 기반 위치 자동 감지)
router.get('/weather', searchWeatherController);

module.exports = router;
