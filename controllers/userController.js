const bcrypt = require('bcrypt');
const { getConnection, oracledb } = require('../config/database');
const { generateToken } = require('../middleware/auth'); // JWT 생성 함수 가져오기
const { registerUser, loginUser, getUserSettings, updateUserSettings } = require('../models/user');

// 사용자 등록 컨트롤러
async function registerUserController(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: '사용자명, 이메일, 비밀번호는 필수 입력사항입니다.' });
  }

  try {
    const user = await registerUser(username, email, password);
    res.status(201).json(user);
  } catch (err) {
    if (err.message === '이미 등록된 이메일입니다.') {
      return res.status(409).json({ error: err.message });
    }
    console.error('사용자 등록 컨트롤러 오류:', err);
    res.status(500).json({ error: `사용자 등록 중 오류 발생: ${err.message}` });
  }
}

// 사용자 로그인 컨트롤러
async function loginUserController(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호는 필수 입력사항입니다.' });
  }

  try {
    // loginUser 함수는 이제 사용자 정보만 반환한다고 가정합니다.
    // 실제 loginUser 함수 구현에 따라 조정이 필요할 수 있습니다.
    const user = await loginUser(email, password);

    // 로그인 성공 시 JWT 생성
    const tokenPayload = { userId: user.user_id, email: user.email }; // 토큰에 포함될 정보
    const token = generateToken(tokenPayload);

    // 사용자 정보와 토큰 함께 반환
    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      logged_in_at: new Date().toISOString(),
      token: token // 생성된 토큰 추가
    });

  } catch (err) {
    if (err.message.includes('이메일 또는 비밀번호가 올바르지 않습니다')) {
      return res.status(401).json({ error: err.message });
    }
    if (err.message.includes('계정이 비활성화')) {
      return res.status(403).json({ error: err.message });
    }
    console.error('로그인 컨트롤러 오류:', err);
    res.status(500).json({ error: `로그인 중 오류 발생: ${err.message}` });
  }
}

// 사용자 설정 조회 컨트롤러
async function getUserSettingsController(req, res) {
  const requestedUserId = req.params.user_id;
  const authenticatedUserId = req.user.userId; // JWT 미들웨어에서 추가된 사용자 ID

  // 인가 확인: 요청된 user_id와 인증된 user_id가 동일한지 확인
  if (requestedUserId !== authenticatedUserId) {
    return res.status(403).json({ error: '자신의 설정만 조회할 수 있습니다.' }); // Forbidden
  }

  try {
    const settings = await getUserSettings(authenticatedUserId);
    res.json(settings);
  } catch (err) {
    console.error('설정 조회 컨트롤러 오류:', err);
    // 특정 오류 메시지 처리 (예: 설정 없음)
    if (err.message.includes('설정을 찾을 수 없습니다')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: `설정 조회 중 오류 발생: ${err.message}` });
  }
}

// 사용자 설정 업데이트 컨트롤러
async function updateUserSettingsController(req, res) {
  const requestedUserId = req.params.user_id;
  const authenticatedUserId = req.user.userId; // JWT 미들웨어에서 추가된 사용자 ID
  const settings = req.body;

  // 인가 확인: 요청된 user_id와 인증된 user_id가 동일한지 확인
  if (requestedUserId !== authenticatedUserId) {
    return res.status(403).json({ error: '자신의 설정만 수정할 수 있습니다.' }); // Forbidden
  }

  // 유효성 검사: 업데이트할 설정 데이터가 있는지 확인
  if (Object.keys(settings).length === 0) {
    return res.status(400).json({ error: '수정할 설정 내용이 없습니다.' });
  }

  try {
    const updatedSettings = await updateUserSettings(authenticatedUserId, settings);
    res.json(updatedSettings);
  } catch (err) {
    console.error('설정 업데이트 컨트롤러 오류:', err);
    res.status(500).json({ error: `설정 업데이트 중 오류 발생: ${err.message}` });
  }
}

// loginUser 함수는 컨트롤러에서 직접 호출하지 않고, 내부 로직으로 남겨두거나
// 서비스 계층으로 분리하는 것이 더 좋습니다. 여기서는 설명을 위해 그대로 둡니다.
async function loginUser(email, password) {
  let connection;
  try {
    connection = await getConnection();

    // 사용자 조회
    const result = await connection.execute(
      `SELECT user_id, username, password_hash, is_active, email
       FROM users
       WHERE email = :email`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const user = result.rows[0];

    // 계정이 비활성화된 경우
    if (user.IS_ACTIVE !== 1) {
      throw new Error('계정이 비활성화되었습니다.');
    }

    // 비밀번호 검증
    const match = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!match) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 로그인 시간 업데이트
    await connection.execute(
      `UPDATE users SET last_login = SYSTIMESTAMP WHERE user_id = :userId`,
      { userId: user.USER_ID },
      { autoCommit: true }
    );

    // 컨트롤러에서 토큰 생성을 위해 필요한 사용자 정보만 반환
    return {
      user_id: user.USER_ID,
      username: user.USERNAME,
      email: user.EMAIL
    };
  } catch (err) {
    console.error('로그인 실패 (모델):', err);
    // 특정 오류 메시지를 컨트롤러로 전달
    if (err.message.includes('이메일 또는 비밀번호') || err.message.includes('계정이 비활성화')) {
        throw err;
    }
    // 그 외 오류는 일반적인 오류로 처리
    throw new Error('로그인 처리 중 오류가 발생했습니다.');
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 닫기 실패 (로그인):', err);
      }
    }
  }
}

module.exports = {
  registerUserController,
  loginUserController,
  getUserSettingsController,
  updateUserSettingsController
};