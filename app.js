// Express 앱 초기화 (이건 먼저 해도 괜찮아)
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config(); // 환경 변수 로드

const { initOracleClient, initializeDbPool } = require('./config/database'); // DB 관련 함수들 가져오기
const app = express();

// ** 라우터 변수만 선언 (require는 나중에) **
let usersRouter;
let chatRouter;
let sessionsRouter;
let aiInfoRouter; // Declare aiInfoRouter


// 미들웨어 설정 (DB 연결 필요 없는 것들)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// API 문서 라우트를 app.js에서 직접 처리
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api_docs.html'));
});

// 업로드 디렉토리 설정 (이건 DB 연결 전에 해도 괜찮아)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Multer 설정 (이것도 DB 연결 전에 해도 괜찮아)
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });


// ** Oracle 초기화 및 서버 시작 함수 (async) **
async function startServer() {
  try {
    console.log('서버 시작을 위한 DB 초기화 중...');
    // ** DB 초기화를 먼저 완료 **
    await initOracleClient(); // Oracle Thick 모드 활성화 완료 대기
    await initializeDbPool(); // DB 풀 초기화 완료 대기
    console.log('DB 초기화 완료.');

    // ** DB 초기화가 끝난 후에 DB 연결이 필요한 라우터들을 require 하고 등록 **
    console.log('DB 연결 필요한 라우터 로드 및 등록...');
    usersRouter = require('./routes/users');
    chatRouter = require('./routes/chat');
    sessionsRouter = require('./routes/sessions');
    aiInfoRouter = require('./routes/aiInfo'); // Require aiInfoRouter

    app.use('/api/users', usersRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/sessions', sessionsRouter);
    app.use('/api/ai', aiInfoRouter); // Mount aiInfoRouter

    // 서버 상태 확인용 엔드포인트 (이건 DB 필요 없을 수도 있지만 라우터 등록 후에)
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const port = process.env.PORT || 7777;
    // ** Express 서버 시작 **
    app.listen(port, () => {
      console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
    });

  } catch (err) {
    console.error('서버 시작 실패:', err);
    // 초기화 실패는 치명적이므로 프로세스 종료
    process.exit(1);
  }
}

// 테스트 환경이 아닐 때만 서버 시작 함수 호출
if (process.env.NODE_ENV !== 'test') {
  // startServer 함수 (async) 호출. 최상위에서는 await 대신 .catch()로 에러 처리.
  startServer().catch(err => {
      console.error('서버 시작 중 치명적인 오류 발생:', err);
      process.exit(1); // 오류 발생 시 종료
  });
}

module.exports = app;