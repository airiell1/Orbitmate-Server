const bcrypt = require('bcrypt');
const { getConnection, oracledb } = require('../config/database');

// 사용자 등록 함수
async function registerUser(username, email, password) {
  let connection;
  try {
    connection = await getConnection();

    // 비밀번호 해싱
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    const result = await connection.execute(
      `INSERT INTO users (username, email, password_hash)
       VALUES (:username, :email, :passwordHash)
       RETURNING user_id INTO :userId`,
      {
        username: username,
        email: email,
        passwordHash: passwordHash,
        userId: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    
    const userId = result.outBinds.userId[0];
    
    // 사용자 설정 기본값 생성
    await connection.execute(
      `INSERT INTO user_settings (user_id) VALUES (:userId)`,
      { userId: userId },
      { autoCommit: true }
    );
    
    return {
      user_id: userId,
      username: username,
      email: email,
      created_at: new Date().toISOString()
    };
  } catch (err) {
    // 이메일 중복 오류 처리
    if (err.message.includes('unique constraint') && err.message.includes('EMAIL')) {
      throw new Error('이미 등록된 이메일입니다.');
    }
    console.error('사용자 등록 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 사용자 로그인 함수
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
      throw new Error('계정이 비활성화되었습니다. 관리자에게 문의하세요.');
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
    
    return {
      user_id: user.USER_ID,
      username: user.USERNAME,
      email: user.EMAIL,
      logged_in_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('로그인 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 사용자 설정 조회 함수
async function getUserSettings(userId) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT theme, language, font_size, notifications_enabled, ai_model_preference
       FROM user_settings
       WHERE user_id = :userId`,
      { userId: userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      throw new Error('사용자 설정을 찾을 수 없습니다.');
    }
    
    const settings = result.rows[0];
    
    return {
      theme: settings.THEME,
      language: settings.LANGUAGE,
      font_size: settings.FONT_SIZE,
      notifications_enabled: settings.NOTIFICATIONS_ENABLED === 1,
      ai_model_preference: settings.AI_MODEL_PREFERENCE
    };
  } catch (err) {
    console.error('설정 조회 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

// 사용자 설정 업데이트 함수
async function updateUserSettings(userId, settings) {
  const { theme, language, font_size, notifications_enabled, ai_model_preference } = settings;
  
  let connection;
  try {
    connection = await getConnection();
    
    // 업데이트할 필드 구성
    let updateQuery = 'UPDATE user_settings SET updated_at = SYSTIMESTAMP';
    const bindParams = { userId: userId };
    
    if (theme !== undefined) {
      updateQuery += ', theme = :theme';
      bindParams.theme = theme;
    }
    
    if (language !== undefined) {
      updateQuery += ', language = :language';
      bindParams.language = language;
    }
    
    if (font_size !== undefined) {
      updateQuery += ', font_size = :fontSize';
      bindParams.fontSize = font_size;
    }
    
    if (notifications_enabled !== undefined) {
      updateQuery += ', notifications_enabled = :notificationsEnabled';
      bindParams.notificationsEnabled = notifications_enabled ? 1 : 0;
    }
    
    if (ai_model_preference !== undefined) {
      updateQuery += ', ai_model_preference = :aiModelPreference';
      bindParams.aiModelPreference = ai_model_preference;
    }
    
    updateQuery += ' WHERE user_id = :userId';
    
    // 쿼리 실행
    await connection.execute(updateQuery, bindParams, { autoCommit: true });
    
    // 업데이트된 설정 조회
    return await getUserSettings(userId);
  } catch (err) {
    console.error('설정 업데이트 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('연결 닫기 실패:', err);
      }
    }
  }
}

module.exports = {
  registerUser,
  loginUser,
  getUserSettings,
  updateUserSettings
};