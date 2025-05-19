const bcrypt = require('bcrypt');
const { getConnection, oracledb } = require('../config/database');
const { clobToString, convertClobFields, toSnakeCaseObj } = require('../utils/dbUtils'); // 상단 import 수정

// 사용자 등록 함수
async function registerUser(username, email, password) {

  // 테스트 계정 고정 UID 적용 (DB에 항상 동일한 UID로 저장)
  const isTestUser = (
    username === 'APItest' &&
    email === 'API@example.com' &&
    password === 'password123'
  );


  let connection;
  try {
    connection = await getConnection();

    // 비밀번호 해싱
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 이미 가입된 이메일인지 확인 (이중 체크: 트랜잭션 내에서 잠금)
    let user_id;
    let alreadyRegisteredUser = null;
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const emailCheck = await connection.execute(
      `SELECT user_id, username, email FROM users WHERE email = :email FOR UPDATE`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (emailCheck.rows.length > 0) {
      alreadyRegisteredUser = {
        user_id: emailCheck.rows[0].user_id || emailCheck.rows[0].USER_ID,
        username: emailCheck.rows[0].username || emailCheck.rows[0].USERNAME,
        email: emailCheck.rows[0].email || emailCheck.rows[0].EMAIL,
        already_registered: true
      };
    } else {
      // 신규 사용자 INSERT
      if (isTestUser) {
        // 테스트 계정은 항상 동일한 UID로 저장 (있으면 덮어쓰기, 없으면 생성)
        // 먼저 기존에 UID가 있는지 확인
        const testUserId = 'API_TEST_USER_ID';
        // 기존에 같은 UID가 있으면 삭제(덮어쓰기 보장)
        await connection.execute(
          `DELETE FROM users WHERE user_id = :user_id OR email = :email`,
          { user_id: testUserId, email: email },
          { autoCommit: false }
        );
        // 새로 삽입
        const result = await connection.execute(
          `INSERT INTO users (user_id, username, email, password_hash)
           VALUES (:user_id, :username, :email, :passwordHash)
           RETURNING user_id INTO :user_idOut`,
          {
            user_id: testUserId,
            username: username,
            email: email,
            passwordHash: passwordHash,
            user_idOut: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
          },
          { autoCommit: false }
        );
        user_id = result.outBinds.user_idOut[0];
      } else {
        const result = await connection.execute(
          `INSERT INTO users (username, email, password_hash)
           VALUES (:username, :email, :passwordHash)
           RETURNING user_id INTO :user_id`,
          {
            username: username,
            email: email,
            passwordHash: passwordHash,
            user_id: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
          },
          { autoCommit: false }
        );
        user_id = result.outBinds.user_id[0];
      }
    }

    // 이미 가입된 경우, 트랜잭션 롤백 및 반환
    if (alreadyRegisteredUser) {
      await connection.rollback();
      return alreadyRegisteredUser;
    }
    
    // 사용자 설정 기본값 생성
    await connection.execute(
      `INSERT INTO user_settings (user_id, theme, language, font_size, notifications_enabled)
       VALUES (:user_id, 'light', 'ko', 14, 1)`,
      { user_id: user_id }
    );

    // 사용자 프로필이 이미 존재하는지 확인
    const profileCheck = await connection.execute(
      `SELECT COUNT(*) FROM user_profiles WHERE user_id = :user_id`,
      { user_id: user_id }
    );
    // 프로필이 없는 경우에만 생성
    if (profileCheck.rows[0][0] === 0) {
      await connection.execute(
        `INSERT INTO user_profiles (user_id, theme_preference, bio, badge, experience, "level")
         VALUES (:user_id, 'light', NULL, NULL, 0, 1)`,
        { user_id: user_id }
      );
    }
    
    await connection.commit(); // 모든 INSERT 작업 후 커밋

    return {
      user_id: user_id,
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
        console.error("DB 연결 해제 실패:", err);
      }
    }
  }
}

// 사용자 로그인 함수
async function loginUser(email, password) {
  let connection;
  try {
    connection = await getConnection();

    // outFormat을 OBJECT로 지정
    const result = await connection.execute(
      `SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE FROM USERS WHERE EMAIL = :email`,
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
      `UPDATE users SET last_login = SYSTIMESTAMP WHERE user_id = :user_id`,
      { user_id: user.USER_ID },
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
async function getUserSettings(user_id) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT us.user_id, us.theme, us.language, us.font_size, us.notifications_enabled, us.ai_model_preference, us.updated_at 
       FROM user_settings us
       WHERE us.user_id = :user_id`,
      { user_id: user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      throw new Error('사용자 설정을 찾을 수 없습니다.');
    }
    
    // 응답 데이터 변환 - toSnakeCaseObj 사용으로 대체
    return toSnakeCaseObj(result.rows[0]);
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
async function updateUserSettings(user_id, settings) {
  const { theme, language, font_size, notifications_enabled, ai_model_preference } = settings;
  
  let connection;
  try {
    connection = await getConnection();
    
    // 업데이트할 필드 구성
    let updateQuery = 'UPDATE user_settings SET updated_at = SYSTIMESTAMP';
    const bindParams = { user_id: user_id };
    
    if (theme !== undefined) {
      updateQuery += ', theme = :theme';
      bindParams.theme = theme;
    }
    
    if (language !== undefined) {
      updateQuery += ', language = :language';
      bindParams.language = language;
    }
    
    if (font_size !== undefined) {
      updateQuery += ', font_size = :font_size';
      bindParams.font_size = font_size;
    }
    
    if (notifications_enabled !== undefined) {
      updateQuery += ', notifications_enabled = :notifications_enabled';
      bindParams.notifications_enabled = notifications_enabled ? 1 : 0;
    }
    
    if (ai_model_preference !== undefined) {
      updateQuery += ', ai_model_preference = :ai_model_preference';
      bindParams.ai_model_preference = ai_model_preference;
    }
    
    updateQuery += ' WHERE user_id = :user_id';
    
    // 쿼리 실행
    await connection.execute(updateQuery, bindParams, { autoCommit: true });
    
    // 업데이트된 설정 조회
    const updatedSettings = await getUserSettings(user_id);
    // toSnakeCaseObj 함수 사용하여 케이싱 통일
    return toSnakeCaseObj(updatedSettings);
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

// 사용자 프로필 이미지 경로 업데이트 함수
async function updateUserProfileImage(user_id, profileImagePath) {
  let connection;
  try {
    connection = await getConnection();
    await connection.execute(
      `UPDATE users SET profile_image_path = :profileImagePath WHERE user_id = :user_id`,
      { profileImagePath: profileImagePath, user_id: user_id },
      { autoCommit: true }
    );
  } catch (err) {
    console.error('프로필 이미지 경로 업데이트 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 해제 실패:', err);
      }
    }
  }
}

// 사용자 프로필 조회 함수 (existingConnection 파라미터 추가)
async function getUserProfile(user_id, existingConnection = null) {
  let connection = existingConnection;
  try {
    if (!connection) {
      connection = await getConnection();
    }
    const result = await connection.execute(
      `SELECT u.user_id, u.username, u.email, u.created_at, u.is_active, u.profile_image_path, 
              p.theme_preference, p.bio, p.badge, p.experience, p."level", p.updated_at
       FROM users u
       LEFT JOIN user_profiles p ON u.user_id = p.user_id
       WHERE u.user_id = :user_id`,
      { user_id: user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return null;
    }

    let row = await convertClobFields(result.rows[0]);

    if (row.CREATED_AT && typeof row.CREATED_AT === 'object' && row.CREATED_AT.toISOString) {
      row.CREATED_AT = row.CREATED_AT.toISOString();
    }
    if (row.UPDATED_AT && typeof row.UPDATED_AT === 'object' && row.UPDATED_AT.toISOString) {
      row.UPDATED_AT = row.UPDATED_AT.toISOString();
    }

    return toSnakeCaseObj(row);
  } catch (err) {
    console.error('Error getting user profile:', err);
    throw err;
  } finally {
    if (connection && !existingConnection) { // 이 함수에서 직접 생성한 경우에만 닫음
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

// 사용자 프로필 업데이트 함수
async function updateUserProfile(user_id, profileData) {
  let connection;
  try {
    connection = await getConnection();
    // 트랜잭션 시작 (명시적으로 autoCommit을 false로 설정하거나, connection 기본값이 false임)

    const snakeCaseProfileData = toSnakeCaseObj(profileData);
    const { username, theme_preference, bio, badge } = snakeCaseProfileData;

    let userTableHasChanges = false;
    let userProfileTableHasChanges = false;

    // 1. users 테이블 업데이트 (username)
    if (username !== undefined && username !== null) { // username이 제공된 경우
      // 현재 username과 다른 경우에만 업데이트 (선택적 최적화)
      // const currentUser = await connection.execute(`SELECT username FROM users WHERE user_id = :user_id`, {user_id}, {outFormat: oracledb.OUT_FORMAT_OBJECT});
      // if (currentUser.rows.length > 0 && currentUser.rows[0].USERNAME !== username) {
      await connection.execute(
        `UPDATE users SET username = :username WHERE user_id = :user_id`,
        { username: username, user_id: user_id }
        // { autoCommit: false } // autoCommit은 마지막에 한 번만
      );
      userTableHasChanges = true;
      // }
    }

    // 2. user_profiles 테이블 업데이트
    const profileUpdateFields = [];
    const profileBindParams = { user_id: user_id };

    if (theme_preference !== undefined) {
      profileUpdateFields.push('theme_preference = :theme_preference');
      profileBindParams.theme_preference = theme_preference;
    }
    if (bio !== undefined) { // CLOB 데이터는 그대로 전달
      profileUpdateFields.push('bio = :bio');
      profileBindParams.bio = bio;
    }
    if (badge !== undefined) {
      profileUpdateFields.push('badge = :badge');
      profileBindParams.badge = badge;
    }

    if (profileUpdateFields.length > 0) {
      let updateProfileQuery = `UPDATE user_profiles SET ${profileUpdateFields.join(', ')}, updated_at = SYSTIMESTAMP WHERE user_id = :user_id`;
      await connection.execute(updateProfileQuery, profileBindParams);
      userProfileTableHasChanges = true;
    }

    if (!userTableHasChanges && !userProfileTableHasChanges) {
      // 변경 사항이 없으면 현재 프로필 반환 (롤백 불필요, 커밋 안 함)
      const currentProfile = await getUserProfile(user_id, connection); // 기존 커넥션 사용
      if (!currentProfile) throw new Error('프로필을 찾을 수 없습니다.');
      return currentProfile;
    }

    await connection.commit(); // 모든 변경사항 커밋
    
    return await getUserProfile(user_id, connection); // 업데이트된 프로필 정보 반환 (기존 커넥션 사용)
  } catch (err) {
    if (connection) {
      await connection.rollback(); // 오류 발생 시 롤백
    }
    console.error('프로필 업데이트 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 해제 실패:', err);
      }
    }
  }
}

// 경험치 추가 및 레벨 업데이트 함수
async function addUserExperience(user_id, points) {
  let connection;
  try {
    connection = await getConnection();
    await connection.execute(
      `UPDATE user_profiles up
       SET up.experience = up.experience + :points
       WHERE up.user_id = :user_id`,
      { user_id, points },
      { autoCommit: false } // 레벨 업데이트와 함께 트랜잭션 처리
    );

    // 현재 경험치 및 레벨 가져오기
    const profileResult = await connection.execute(
      `SELECT up.level, up.experience FROM user_profiles up WHERE up.user_id = :user_id`,
      { user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (profileResult.rows.length === 0) {
      throw new Error('사용자 프로필을 찾을 수 없습니다.');
    }

    let currentLevel = profileResult.rows[0].LEVEL;
    let currentExperience = profileResult.rows[0].EXPERIENCE;

    // 레벨업 로직 (예: 100 경험치당 1레벨업)
    const experienceForNextLevel = 100; // 레벨업에 필요한 경험치
    while (currentExperience >= experienceForNextLevel) {
      currentLevel += 1;
      currentExperience -= experienceForNextLevel;
    }    // 레벨 및 경험치 업데이트
    await connection.execute(
      `UPDATE user_profiles up
       SET up.level = :level, up.experience = :experience
       WHERE up.user_id = :user_id`,
      { user_id, level: currentLevel, experience: currentExperience },
      { autoCommit: false }
    );

    await connection.commit();
    return { level: currentLevel, experience: currentExperience };

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('경험치 추가 및 레벨 업데이트 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 해제 실패:', err);
      }
    }
  }
}

// 회원 탈퇴 (계정 데이터 삭제) 함수
async function deleteUser(user_id) {
  let connection;
  try {
    connection = await getConnection();
    // 사용자와 관련된 모든 데이터는 DB의 ON DELETE CASCADE 제약조건에 의해 자동으로 삭제될 것으로 예상됩니다.
    // (chat_sessions, user_settings, user_profiles)
    // chat_messages의 user_id는 ON DELETE SET NULL이므로, 해당 메시지는 유지됩니다.
    // attachments는 chat_messages에 CASCADE되어 있으므로 메시지 삭제 시 함께 삭제됩니다.
    const result = await connection.execute(
      `DELETE FROM users WHERE user_id = :user_id`,
      { user_id: user_id },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      throw new Error('삭제할 사용자를 찾을 수 없습니다.');
    }

    // console.log(`User ${user_id} and related data (via CASCADE) deleted successfully.`);
    return { message: `User ${user_id} and related data deleted successfully.` };
  } catch (err) {
    console.error('회원 탈퇴 실패:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 해제 실패:', err);
      }
    }
  }
}

// 이메일 중복 체크 함수
async function checkEmailExists(email) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT COUNT(*) AS count FROM users WHERE email = :email`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0].COUNT > 0;
  } catch (err) {
    console.error('이메일 중복 체크 DB 오류:', err);
    throw err; // 오류를 호출자에게 다시 던짐
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('DB 연결 해제 실패:', err);
      }
    }
  }
}

module.exports = {
  registerUser,
  loginUser,
  getUserSettings,
  updateUserSettings,
  updateUserProfileImage,
  getUserProfile,
  updateUserProfile,
  addUserExperience,
  deleteUser,
  checkEmailExists
};