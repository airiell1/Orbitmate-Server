const bcrypt = require("bcrypt");
const userModel = require("../models/user");
const { withTransaction } = require("../utils/dbUtils");
const config = require("../config"); // For NODE_ENV, test user ID

/**
 * 사용자 등록 서비스
 * @param {string} username - 사용자명
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 생성된 사용자 정보 또는 이미 등록된 경우 해당 정보
 */
async function registerUserService(username, email, password) {
  return await withTransaction(async (connection) => {
    // 컨트롤러에서 하던 입력값 유효성 검사는 서비스 계층으로 옮기거나,
    // 컨트롤러에서 처리하고 서비스는 순수 비즈니스 로직만 담당하도록 할 수 있음.
    // 여기서는 컨트롤러에서 기본적인 형식 검사를 하고,
    // 서비스에서는 좀 더 비즈니스적인 관점의 검증 (예: 이메일 중복)을 담당한다고 가정.
    // (모델의 registerUser 함수가 이미 이메일 중복을 체크하고 already_registered를 반환)

    const user = await userModel.registerUser(connection, username, email, password);
    // 모델에서 반환된 user 객체는 { user_id, username, email, created_at } 또는
    // { user_id, username, email, already_registered: true } 형태를 가짐.

    // 추가적인 비즈니스 로직이 있다면 여기서 처리 (예: 가입 축하 이메일 발송 등)
    // 현재는 모델의 반환값을 그대로 전달.
    return user;
  });
}

/**
 * 사용자 로그인 서비스
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 사용자 정보 및 JWT 토큰
 */
async function loginUserService(email, password) {
  const user = await withTransaction(async (connection) => {
    return await userModel.loginUser(connection, email, password);
  });

  // 로그인 성공 시 JWT 생성 (토큰 생성은 서비스 레이어의 책임)
  const tokenPayload = { user_id: user.user_id, email: user.email };
  const token = generateToken(tokenPayload);

  return { ...user, token };
}

/**
 * 이메일 중복 확인 서비스
 * @param {string} email - 확인할 이메일
 * @returns {Promise<{email_exists: boolean}>} 이메일 존재 여부
 */
async function checkEmailExistsService(email) {
  // 이메일 중복 확인은 읽기 전용 작업이므로 withTransaction이 필수는 아니지만,
  // DB 접근의 일관성을 위해 사용하거나, 직접 connection을 관리할 수도 있음.
  // 여기서는 모델이 connection을 받으므로 withTransaction 사용.
  const exists = await withTransaction(async (connection) => {
    return await userModel.checkEmailExists(connection, email);
  });
  return { email_exists: exists };
}

module.exports = {
  registerUserService,
  loginUserService,
  checkEmailExistsService,
};
