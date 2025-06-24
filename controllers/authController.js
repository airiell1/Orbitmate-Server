const authService = require("../services/authService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { generateToken } = require("../middleware/auth"); // 토큰 생성은 컨트롤러 또는 서비스 어디에 위치할지 결정 필요. 우선 컨트롤러 유지.

/**
 * 사용자 등록 컨트롤러
 */
async function registerUserController(req, res, next) {
  const { username, email, password } = req.body;
  // 입력값 유효성 검사는 컨트롤러의 책임으로 남겨둘 수 있음
  // (또는 express-validator 같은 미들웨어 사용)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  const passwordRegex = /^.{8,128}$/;

  if (!username || !usernameRegex.test(username)) {
    const err = new Error("사용자명은 3~30자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!email || email.length > 254 || !emailRegex.test(email)) {
    const err = new Error("유효한 이메일 주소를 입력해주세요 (최대 254자).");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  if (!password || !passwordRegex.test(password)) {
    const err = new Error("비밀번호는 8자 이상 128자 이하이어야 합니다.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    const user = await authService.registerUserService(username, email, password);

    if (user && user.already_registered) {
      // 서비스에서 already_registered 플래그와 함께 사용자 정보를 반환했다고 가정
      const apiResponse = standardizeApiResponse({
        message: "이미 가입된 이메일입니다.",
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        already_registered: true,
      });
      // 이미 존재하는 경우 성공으로 간주하되, 내용은 다르게 (200 OK)
      return res.status(200).json(apiResponse.body);
    }

    // 신규 가입 성공
    const apiResponse = standardizeApiResponse(user);
    res.status(201).json(apiResponse.body); // 201 Created
  } catch (err) {
    next(err);
  }
}

/**
 * 사용자 로그인 컨트롤러
 */
async function loginUserController(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    const err = new Error("이메일과 비밀번호를 모두 입력해주세요.");
    err.code = "INVALID_INPUT";
    return next(err);
  }

  try {
    // authService.loginUserService는 사용자 정보와 토큰을 함께 반환하도록 수정됨
    const loginData = await authService.loginUserService(email, password);

    const apiResponse = standardizeApiResponse(loginData);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    // 서비스에서 UNAUTHORIZED, FORBIDDEN 등의 에러를 throw 할 것으로 예상
    next(err);
  }
}

/**
 * 이메일 중복 확인 컨트롤러
 */
async function checkEmailExistsController(req, res, next) {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email)) {
    const err = new Error("유효한 이메일을 입력해주세요.");
    err.code = "INVALID_INPUT";
    return next(err);
  }
  try {
    const result = await authService.checkEmailExistsService(email);
    const apiResponse = standardizeApiResponse(result); // { email_exists: true/false }
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerUserController,
  loginUserController,
  checkEmailExistsController,
};
