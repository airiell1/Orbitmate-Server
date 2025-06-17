const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config(); // 환경 변수 로드

const { initOracleClient, initializeDbPool } = require('./config/database'); // DB 관련 함수들 가져오기
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // 개발 환경에서는 모든 출처 허용
    methods: ["GET", "POST"]
  }
});

// ** 라우터 변수만 선언 (require는 나중에) **
let usersRouter;
let chatRouter;
let sessionsRouter;
let aiInfoRouter; // Declare aiInfoRouter
let searchRouter;


// 미들웨어 설정
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

// favicon.ico 요청 처리 (404 오류 방지)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

// API 문서 라우트를 app.js에서 직접 처리
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api_docs.html'));
});

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Multer 설정
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
    console.log('DB 초기화 완료.');    // ** DB 초기화가 끝난 후에 DB 연결이 필요한 라우터들을 require 하고 등록 **
    console.log('DB 연결 필요한 라우터 로드 및 등록...');
      // WebSocket 이벤트 핸들러 설정
    require('./config/websocket')(io);
    
    // WebSocket 인스턴스를 채팅 컨트롤러에 전달
    const chatController = require('./controllers/chatController');
    chatController.setSocketIO(io);    
    // WebSocket API 라우트 설정
    const { router: websocketRouter, setSocketIO: setWebSocketRouterIO } = require('./routes/websocket');
    setWebSocketRouterIO(io);
    
    usersRouter = require('./routes/users');
    chatRouter = require('./routes/chat');
    sessionsRouter = require('./routes/sessions');
    aiInfoRouter = require('./routes/aiInfo'); // Require aiInfoRouter
    searchRouter = require('./routes/search'); // Require searchRouter

    app.use('/api/users', usersRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/sessions', sessionsRouter);
    app.use('/api/ai', aiInfoRouter); // Mount aiInfoRouter
    app.use('/api/search', searchRouter); // Mount searchRouter
    app.use('/api/websocket', websocketRouter); // Mount WebSocket API router

    // 서버 상태 확인용 엔드포인트
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });    const port = process.env.PORT || 7777;
    
    // ** Express 서버 시작 **
    server.listen(port, () => {
      console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
      console.log(`WebSocket 서버도 동일한 포트에서 실행 중입니다.`);
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

module.exports = { app, server, io };