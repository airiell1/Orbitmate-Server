const bcrypt = require('bcrypt');
const { getConnection, oracledb } = require('../config/database');
const { clobToString, convertClobFields, toSnakeCaseObj } = require('../utils/dbUtils'); // 상단 import 수정

// 사용자 등록 함수
async function registerUser(username, email, password) {
  // 테스트 계정 고정 UID 적용 (DB에 항상 동일한 UID로 저장)
  const isTestUser = (email === 'API@example.com');
  const testUserId = 'API_TEST_USER_ID';

  let connection;
  try {
    connection = await getConnection();

    // 비밀번호 해싱
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 이미 가입된 이메일인지 확인
    const emailCheck = await connection.execute(
      `SELECT user_id, username, email FROM users WHERE email = :email`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (emailCheck.rows.length > 0) {
      // 이미 가입된 사용자 반환
      const existingUser = emailCheck.rows[0];
      return {
        user_id: existingUser.user_id || existingUser.USER_ID,
        username: existingUser.username || existingUser.USERNAME,
        email: existingUser.email || existingUser.EMAIL,
        already_registered: true
      };
    }

    // 신규 사용자 INSERT
    let user_id;
    if (isTestUser) {
      // 테스트 계정의 경우 고정 ID로 생성
      // 만약 동일한 user_id가 이미 존재한다면 제거 후 재생성
      const existingTestUser = await connection.execute(
        `SELECT user_id FROM users WHERE user_id = :user_id`,
        { user_id: testUserId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (existingTestUser.rows.length > 0) {
        // 기존 테스트 사용자가 있으면 완전 삭제 (CASCADE로 연관 데이터도 삭제됨)
        await connection.execute(
          `DELETE FROM users WHERE user_id = :user_id`,
          { user_id: testUserId },
          { autoCommit: false }
        );
      }

      // 새로운 테스트 사용자 생성
      await connection.execute(
        `INSERT INTO users (user_id, username, email, password_hash)
         VALUES (:user_id, :username, :email, :passwordHash)`,
        {
          user_id: testUserId,
          username: username,
          email: email,
          passwordHash: passwordHash
        },
        { autoCommit: false }
      );
      user_id = testUserId;
    } else {
      // 일반 사용자의 경우 시스템이 자동 생성하는 GUID 사용
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
    // 사용자 설정 기본값 생성
    await connection.execute(
      `INSERT INTO user_settings (user_id, theme, language, font_size, notifications_enabled)
       VALUES (:user_id, 'light', 'ko', 14, 1)`,
      { user_id: user_id },
      { autoCommit: false }
    );

    // 사용자 프로필 기본값 생성
    await connection.execute(
      `INSERT INTO user_profiles (user_id, theme_preference, bio, badge, experience, "level")
       VALUES (:user_id, 'light', NULL, NULL, 0, 1)`,
      { user_id: user_id },
      { autoCommit: false }
    );
    
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

// =========================
// 7. 프로필 꾸미기 기능
// =========================

/**
 * 사용자 프로필 꾸미기 설정 조회
 */
async function getUserCustomization(user_id) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT profile_theme, profile_border, profile_background, status_message, 
              nickname, introduction, is_premium, premium_until
       FROM user_profiles 
       WHERE user_id = :user_id`,
      { user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      // 기본 프로필이 없으면 생성
      await createDefaultUserProfile(user_id);
      return {
        profile_theme: 'default',
        profile_border: 'none',
        profile_background: null,
        status_message: null,
        nickname: null,
        introduction: null,
        is_premium: 0,
        premium_until: null
      };
    }

    return convertClobFields(result.rows[0]);
  } catch (error) {
    console.error('[userModel] 프로필 꾸미기 조회 오류:', error);
    throw error;
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

/**
 * 사용자 프로필 꾸미기 설정 업데이트
 */
async function updateUserCustomization(user_id, customizationData) {
  let connection;
  try {
    connection = await getConnection();
    
    const { 
      profile_theme, 
      profile_border, 
      profile_background, 
      status_message,
      nickname,
      introduction 
    } = customizationData;

    const result = await connection.execute(
      `UPDATE user_profiles 
       SET profile_theme = NVL(:profile_theme, profile_theme),
           profile_border = NVL(:profile_border, profile_border),
           profile_background = NVL(:profile_background, profile_background),
           status_message = :status_message,
           nickname = :nickname,
           introduction = :introduction,
           updated_at = SYSTIMESTAMP
       WHERE user_id = :user_id`,
      {
        user_id,
        profile_theme,
        profile_border,
        profile_background,
        status_message,
        nickname,
        introduction
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      throw new Error('프로필을 찾을 수 없거나 업데이트할 수 없습니다.');
    }

    return { success: true, message: '프로필 꾸미기 설정이 업데이트되었습니다.' };
  } catch (error) {
    console.error('[userModel] 프로필 꾸미기 업데이트 오류:', error);
    throw error;
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

// =========================
// 8. 계정 레벨 및 경험치 시스템
// =========================

/**
 * 사용자 레벨 및 경험치 정보 조회
 */
async function getUserLevel(user_id) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT up.experience, up."level", up.experience_multiplier,
              lr.level_name, lr.level_description, lr.required_exp, lr.unlock_features,
              (SELECT required_exp FROM level_requirements WHERE level_num = up."level" + 1) as next_level_exp
       FROM user_profiles up
       LEFT JOIN level_requirements lr ON up."level" = lr.level_num
       WHERE up.user_id = :user_id`,
      { user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return {
        experience: 0,
        level: 1,
        level_name: '새싹 오비터',
        level_description: 'Orbitmate를 시작한 신규 사용자',
        required_exp: 0,
        next_level_exp: 100,
        progress: 0,
        experience_multiplier: 1.0,
        unlock_features: ['basic_chat', 'profile_edit']
      };
    }

    const data = convertClobFields(result.rows[0]);
    const currentExp = data.EXPERIENCE || 0;
    const requiredExp = data.REQUIRED_EXP || 0;
    const nextLevelExp = data.NEXT_LEVEL_EXP || null;
    
    let progress = 0;
    if (nextLevelExp && nextLevelExp > requiredExp) {
      progress = Math.round(((currentExp - requiredExp) / (nextLevelExp - requiredExp)) * 100);
    }

    return {
      experience: currentExp,
      level: data.LEVEL || data.level,
      level_name: data.LEVEL_NAME || data.level_name,
      level_description: data.LEVEL_DESCRIPTION || data.level_description,
      required_exp: requiredExp,
      next_level_exp: nextLevelExp,
      progress: Math.max(0, Math.min(100, progress)),
      experience_multiplier: data.EXPERIENCE_MULTIPLIER || 1.0,
      unlock_features: data.UNLOCK_FEATURES ? JSON.parse(data.UNLOCK_FEATURES) : []
    };
  } catch (error) {
    console.error('[userModel] 사용자 레벨 조회 오류:', error);
    throw error;
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

/**
 * 사용자 경험치 추가 및 레벨업 처리 (개선된 버전)
 */
async function addUserExperience(user_id, points, exp_type = 'chat', reason = null) {
  let connection;
  try {
    connection = await getConnection();
    await connection.execute('BEGIN'); // 트랜잭션 시작

    // 현재 사용자 정보 조회
    const userResult = await connection.execute(
      `SELECT experience, "level", experience_multiplier FROM user_profiles WHERE user_id = :user_id`,
      { user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (userResult.rows.length === 0) {
      // 프로필이 없으면 생성
      await createDefaultUserProfile(user_id);
      return await addUserExperience(user_id, points, exp_type, reason);
    }

    const currentData = userResult.rows[0];
    const oldExp = currentData.EXPERIENCE || 0;
    const oldLevel = currentData.LEVEL || currentData.level || 1;
    const multiplier = currentData.EXPERIENCE_MULTIPLIER || 1.0;

    // 배수 적용
    const actualPoints = Math.round(points * multiplier);
    const newExp = oldExp + actualPoints;

    // 새 레벨 계산
    const levelResult = await connection.execute(
      `SELECT level_num FROM level_requirements 
       WHERE required_exp <= :newExp 
       ORDER BY level_num DESC 
       FETCH FIRST 1 ROWS ONLY`,
      { newExp },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const newLevel = levelResult.rows.length > 0 ? levelResult.rows[0].LEVEL_NUM : oldLevel;

    // 경험치 로그 기록
    await connection.execute(
      `INSERT INTO user_experience_log 
       (user_id, exp_type, exp_amount, exp_reason, old_total_exp, new_total_exp, 
        old_level, new_level, multiplier_applied) 
       VALUES (:user_id, :exp_type, :exp_amount, :exp_reason, :old_total_exp, 
               :new_total_exp, :old_level, :new_level, :multiplier_applied)`,
      {
        user_id,
        exp_type,
        exp_amount: actualPoints,
        exp_reason: reason,
        old_total_exp: oldExp,
        new_total_exp: newExp,
        old_level: oldLevel,
        new_level: newLevel,
        multiplier_applied: multiplier
      },
      { autoCommit: false }
    );

    // 사용자 프로필 업데이트
    await connection.execute(
      `UPDATE user_profiles 
       SET experience = :newExp, "level" = :newLevel, updated_at = SYSTIMESTAMP 
       WHERE user_id = :user_id`,
      { newExp, newLevel, user_id },
      { autoCommit: false }
    );

    // 레벨업 시 뱃지 지급
    let levelUpBadge = null;
    if (newLevel > oldLevel) {
      const badgeResult = await connection.execute(
        `SELECT level_badge FROM level_requirements WHERE level_num = :newLevel`,
        { newLevel },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (badgeResult.rows.length > 0 && badgeResult.rows[0].LEVEL_BADGE) {
        levelUpBadge = await grantUserBadge(connection, user_id, 'achievement', badgeResult.rows[0].LEVEL_BADGE, `레벨 ${newLevel} 달성`);
      }
    }

    await connection.commit();

    return {
      success: true,
      old_experience: oldExp,
      new_experience: newExp,
      points_added: actualPoints,
      multiplier_applied: multiplier,
      old_level: oldLevel,
      new_level: newLevel,
      level_up: newLevel > oldLevel,
      badge_earned: levelUpBadge
    };

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('[userModel] 경험치 추가 오류:', error);
    throw error;
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

// =========================
// 뱃지 시스템
// =========================

/**
 * 사용자 뱃지 목록 조회
 */
async function getUserBadges(user_id) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT badge_id, badge_type, badge_name, badge_description, badge_icon, 
              badge_color, is_equipped, earned_at
       FROM user_badges 
       WHERE user_id = :user_id 
       ORDER BY earned_at DESC`,
      { user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return result.rows.map(row => convertClobFields(row));
  } catch (error) {
    console.error('[userModel] 사용자 뱃지 조회 오류:', error);
    throw error;
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

/**
 * 사용자에게 뱃지 지급 (트랜잭션 내에서 사용)
 */
async function grantUserBadge(connection, user_id, badge_type, badge_name, badge_description, badge_icon = '🏆', badge_color = '#FFD700') {
  try {
    // 중복 뱃지 체크
    const existingBadge = await connection.execute(
      `SELECT badge_id FROM user_badges 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingBadge.rows.length > 0) {
      return null; // 이미 보유한 뱃지
    }

    const result = await connection.execute(
      `INSERT INTO user_badges 
       (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color) 
       VALUES (:user_id, :badge_type, :badge_name, :badge_description, :badge_icon, :badge_color)
       RETURNING badge_id INTO :badge_id`,
      {
        user_id,
        badge_type,
        badge_name,
        badge_description,
        badge_icon,
        badge_color,
        badge_id: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      },
      { autoCommit: false }
    );

    return {
      badge_id: result.outBinds.badge_id[0],
      badge_name,
      badge_description,
      badge_icon,
      badge_color
    };
  } catch (error) {
    console.error('[userModel] 뱃지 지급 오류:', error);
    throw error;
  }
}

/**
 * 뱃지 착용/해제
 */
async function toggleUserBadge(user_id, badge_id, is_equipped) {
  let connection;
  try {
    connection = await getConnection();
    
    // 다른 뱃지들 해제 (하나만 착용 가능)
    if (is_equipped) {
      await connection.execute(
        `UPDATE user_badges SET is_equipped = 0 WHERE user_id = :user_id`,
        { user_id },
        { autoCommit: false }
      );
    }

    // 선택한 뱃지 착용/해제
    const result = await connection.execute(
      `UPDATE user_badges 
       SET is_equipped = :is_equipped 
       WHERE user_id = :user_id AND badge_id = :badge_id`,
      { user_id, badge_id, is_equipped: is_equipped ? 1 : 0 },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      throw new Error('뱃지를 찾을 수 없습니다.');
    }

    return { success: true, message: is_equipped ? '뱃지를 착용했습니다.' : '뱃지를 해제했습니다.' };
  } catch (error) {
    console.error('[userModel] 뱃지 토글 오류:', error);
    throw error;
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

// =========================
// 10. 다국어 지원 시스템
// =========================

/**
 * 번역 리소스 조회
 */
async function getTranslationResources(lang_code = 'ko', category = null) {
  let connection;
  try {
    connection = await getConnection();
    
    let query = `SELECT resource_key, resource_value, category 
                 FROM translation_resources 
                 WHERE lang_code = :lang_code`;
    const params = { lang_code };

    if (category) {
      query += ` AND category = :category`;
      params.category = category;
    }

    query += ` ORDER BY category, resource_key`;

    const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const translations = {};
    for (const row of result.rows) {
      const data = convertClobFields(row);
      translations[data.RESOURCE_KEY || data.resource_key] = data.RESOURCE_VALUE || data.resource_value;
    }

    return translations;
  } catch (error) {
    console.error('[userModel] 번역 리소스 조회 오류:', error);
    throw error;
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

/**
 * 사용자 언어 설정 업데이트
 */
async function updateUserLanguage(user_id, language) {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `UPDATE user_settings 
       SET language = :language, updated_at = SYSTIMESTAMP 
       WHERE user_id = :user_id`,
      { user_id, language },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      // 설정이 없으면 생성
      await connection.execute(
        `INSERT INTO user_settings (user_id, language) VALUES (:user_id, :language)`,
        { user_id, language },
        { autoCommit: true }
      );
    }

    return { success: true, message: '언어 설정이 업데이트되었습니다.' };
  } catch (error) {
    console.error('[userModel] 언어 설정 업데이트 오류:', error);
    throw error;
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
  checkEmailExists,
  getUserCustomization,
  updateUserCustomization,
  getUserLevel,
  addUserExperience,
  getUserBadges,
  toggleUserBadge,
  getTranslationResources,
  updateUserLanguage
};