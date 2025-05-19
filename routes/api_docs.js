// filepath: c:\Users\user1\Desktop\orbitmate_all\orbitmate_server\routes\api_docs.js
const express = require('express');
const router = express.Router();
const path = require('path'); // path 모듈 추가

router.get('/', (req, res) => {
  // public 폴더에 있는 api_docs.html 파일을 전송합니다.
  res.sendFile(path.join(__dirname, '..', 'public', 'api_docs.html'));
});

module.exports = router;