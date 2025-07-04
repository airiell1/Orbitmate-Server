const jwt = require("jsonwebtoken");
const config = require("../config"); // 중앙 설정 파일 import
// require("dotenv").config(); // 제거: config/index.js 또는 app.js에서 이미 처리

const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;

// JWT_SECRET이 없는 경우의 치명적 오류는 config/index.js에서 처리하거나,
// 여기서도 한 번 더 확인할 수 있지만, config/index.js에서 이미 기본값을 설정하거나 오류를 발생시키므로
// 여기서는 JWT_SECRET이 확실히 있다고 가정하거나, 간단한 확인만 수행합니다.
if (!JWT_SECRET) {
  // 이 로그는 실제 운영에서는 config/index.js의 시작 시점 검증으로 대체되어야 함
  console.error("CRITICAL: JWT_SECRET is not configured properly. Application might not work as expected.");
  // process.exit(1); // 여기서 직접 종료하는 대신, 설정 로드 시점에서 처리하는 것이 좋음
}

// JWT 생성 함수
function generateToken(payload) {
  if (!JWT_SECRET) {
    throw new Error("JWT 시크릿 키가 설정되지 않았습니다. 토큰을 생성할 수 없습니다.");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// JWT 검증 미들웨어
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    const error = new Error("인증 토큰이 필요합니다.");
    error.code = "UNAUTHORIZED"; // 표준 에러 코드 사용
    return next(error); // 중앙 에러 핸들러로 전달
  }

  if (!JWT_SECRET) {
    // 이 경우는 서버 설정 오류이므로 500 에러를 발생시키는 것이 적절
    const error = new Error("JWT 시크릿 키가 설정되지 않아 토큰을 검증할 수 없습니다.");
    error.code = "SERVER_ERROR"; // 또는 "JWT_CONFIG_ERROR" 같은 커스텀 코드
    return next(error);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // console.error 제거, 중앙 핸들러에서 로깅
      const customError = new Error();
      if (err.name === "TokenExpiredError") {
        customError.message = "토큰이 만료되었습니다.";
        customError.code = "TOKEN_EXPIRED"; // 커스텀 에러 코드
      } else {
        customError.message = "유효하지 않은 토큰입니다.";
        customError.code = "INVALID_TOKEN"; // 커스텀 에러 코드
      }
      return next(customError); // 중앙 에러 핸들러로 전달
    }

    req.user = user; // 요청 객체에 사용자 정보(payload) 추가
    // console.log("JWT 검증 성공:", user); // 프로덕션에서는 제거 또는 조건부 로깅
    next();
  });
}

module.exports = {
  generateToken,
  verifyToken,
};

// ⚠️ 중요 공지: MVP 버전에서는 인증을 사용하지 않습니다
// 이 파일은 향후 확장 시에만 사용될 예정입니다