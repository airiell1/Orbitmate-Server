const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
  process.exit(1);
}

// JWT 생성 함수
function generateToken(payload) {
  // 만료 시간을 1시간으로 설정 (예시)
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

// JWT 검증 미들웨어
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: "인증 토큰이 필요합니다." }); // Unauthorized
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("JWT 검증 오류:", err.message);
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "토큰이 만료되었습니다." });
      }
      return res.status(403).json({ error: "유효하지 않은 토큰입니다." }); // Forbidden
    }

    // 요청 객체에 사용자 정보(payload) 추가
    req.user = user;
    console.log("JWT 검증 성공:", user);
    next(); // 다음 미들웨어 또는 라우트 핸들러로 이동
  });
}

module.exports = {
  generateToken,
  verifyToken,
};
