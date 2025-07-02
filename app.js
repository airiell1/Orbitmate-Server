const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config(); // 환경 변수 로드

const { initOracleClient, initializeDbPool } = require('./config/database'); // DB 관련 함수들 가져오기
const { logApiRequest, logApiError, initializeLogger } = require('./middleware/logger'); // JSON 기반 로깅 미들웨어 포함


const app = express();
// 🔥 중앙집중식 API 자동 로깅 미들웨어 적용 (모든 라우트보다 먼저 설정)
app.use('/api', logApiRequest);

// ** 라우터 변수만 선언 (require는 나중에) **
let usersRouter;
let chatRouter;
let sessionsRouter;
let aiInfoRouter; // Declare aiInfoRouter
let searchRouter;
let subscriptionsRouter;
let translationsRouter; // translationsRouter 변수 선언 추가
let feedbackRouter; // feedbackRouter 변수 선언 추가
let logsRouter; // logsRouter 변수 선언 추가


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
app.get('/log', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'log.html'));
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
async function startServer() {  try {
    // ** DB 초기화를 먼저 완료 **
    await initOracleClient(); // Oracle Thick 모드 활성화 완료 대기
    await initializeDbPool(); // DB 풀 초기화 완료 대기
    
    // ** 라우터 로드 **
    usersRouter = require('./routes/users');
    chatRouter = require('./routes/chat');
    
    sessionsRouter = require('./routes/sessions');
    aiInfoRouter = require('./routes/aiInfo'); // Require aiInfoRouter
    searchRouter = require('./routes/search'); // Require searchRouter
    subscriptionsRouter = require('./routes/subscriptions'); // Require subscriptionsRouter
    translationsRouter = require('./routes/translations'); // translationsRouter 로드
    feedbackRouter = require('./routes/feedback'); // feedbackRouter 로드
    logsRouter = require('./routes/logs'); // logsRouter 로드


    app.use('/api/users', usersRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/sessions', sessionsRouter);
    app.use('/api/ai', aiInfoRouter); // Mount aiInfoRouter
    app.use('/api/search', searchRouter); // Mount searchRouter
    app.use('/api/subscriptions', subscriptionsRouter); // Mount subscriptionsRouter
    app.use('/api/translations', translationsRouter); // translationsRouter 마운트
    app.use('/api/feedback', feedbackRouter); // feedbackRouter 마운트
    app.use('/api/logs', logsRouter); // logsRouter 마운트

    // 서버 상태 확인용 엔드포인트
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 🔥 API 에러 자동 로깅 미들웨어 (에러 핸들러보다 먼저)
    const { handleCentralError } = require('./utils/errorHandler');
    app.use('/api', logApiError);
    app.use(handleCentralError);

    const port = process.env.PORT || 3000; // config.port를 사용하는 것이 더 일관적일 수 있음
    
    // 🔥 로깅 시스템 초기화
    initializeLogger();
    
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

// 서버 시작 함수 호출 (테스트 모드에서도 실행)
// startServer 함수 (async) 호출. 최상위에서는 await 대신 .catch()로 에러 처리.
startServer().catch(err => {
    console.error('서버 시작 중 치명적인 오류 발생:', err);
    process.exit(1); // 오류 발생 시 종료
});

module.exports = { app };