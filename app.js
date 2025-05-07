const express = require('express');
const cors = require('cors');
const { initOracleClient, initializeDbPool } = require('./config/database');
const path = require('path'); // path 모듈 추가
const multer = require('multer'); // multer 추가
const fs = require('fs'); // fs 모듈 추가
require('dotenv').config();

// 라우터 불러오기
const usersRouter = require('./routes/users');
const chatRouter = require('./routes/chat');
const sessionsRouter = require('./routes/sessions');

// Express 앱 초기화
const app = express();

// CORS 설정
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // JSON 요청 본문 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 요청 본문 파싱

// 정적 파일 제공 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// 기본 경로('/')에 대한 라우트 추가
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 테스트 페이지를 위한 라우트 추가
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// 업로드 디렉토리 생성 (없으면)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 업로드된 파일 제공을 위한 정적 경로 설정
app.use('/uploads', express.static(uploadDir));

// Multer 설정 (파일 저장 위치 및 이름 지정)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // 파일 저장 경로
    },
    filename: function (req, file, cb) {
        // 파일 이름 중복 방지를 위해 타임스탬프 사용
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// 라우터 설정
app.use('/api/users', usersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/sessions', sessionsRouter); // 경로 수정: /api/sessions 사용

// 서버 상태 확인용 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Oracle 초기화 및 서버 시작
async function startServer() {
  try {
    // Oracle Thick 모드 활성화
    await initOracleClient();
    // DB 풀 초기화
    await initializeDbPool();
    
    const port = process.env.PORT || 7777;
    app.listen(port, () => {
      console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
    });
  } catch (err) {
    console.error('서버 시작 실패:', err);
    process.exit(1);
  }
}

// 테스트 환경이 아닐 때만 서버를 시작
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;