const bcrypt = require("bcrypt");
const { getConnection, oracledb } = require("../config/database");
const {
  clobToString,
  convertClobFields,
  toSnakeCaseObj,
} = require("../utils/dbUtils"); // 상단 import 수정

// 사용자 등록 함수
async function registerUser(username, email, password) {
  // 테스트 계정 고정 UID 적용 (DB에 항상 동일한 UID로 저장)
  const isTestUser = email === "API@example.com";
  const testUserId = "API_TEST_USER_ID";

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
        already_registered: true,
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
          passwordHash: passwordHash,
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
          user_id: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
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
      created_at: new Date().toISOString(),
    };
  } catch (err) {
    // 이메일 중복 오류 처리
    if (
      err.message.includes("unique constraint") &&
      err.message.includes("EMAIL")
    ) {
      throw new Error("이미 등록된 이메일입니다.");
    }
    console.error("사용자 등록 실패:", err);
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
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const user = result.rows[0];

    // 계정이 비활성화된 경우
    if (user.IS_ACTIVE !== 1) {
      throw new Error("계정이 비활성화되었습니다. 관리자에게 문의하세요.");
    }

    // 비밀번호 검증
    const match = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!match) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
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
      logged_in_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("로그인 실패:", err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("연결 닫기 실패:", err);
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
      throw new Error("사용자 설정을 찾을 수 없습니다.");
    }

    // 응답 데이터 변환 - toSnakeCaseObj 사용으로 대체
    return toSnakeCaseObj(result.rows[0]);
  } catch (err) {
    console.error("설정 조회 실패:", err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("연결 닫기 실패:", err);
      }
    }
  }
}

// 사용자 설정 업데이트 함수
async function updateUserSettings(user_id, settings) {
  const {
    theme,
    language,
    font_size,
    notifications_enabled,
    ai_model_preference,
  } = settings;

  let connection;
  try {
    connection = await getConnection();

    // 업데이트할 필드 구성
    let updateQuery = "UPDATE user_settings SET updated_at = SYSTIMESTAMP";
    const bindParams = { user_id: user_id };

    if (theme !== undefined) {
      updateQuery += ", theme = :theme";
      bindParams.theme = theme;
    }

    if (language !== undefined) {
      updateQuery += ", language = :language";
      bindParams.language = language;
    }

    if (font_size !== undefined) {
      updateQuery += ", font_size = :font_size";
      bindParams.font_size = font_size;
    }

    if (notifications_enabled !== undefined) {
      updateQuery += ", notifications_enabled = :notifications_enabled";
      bindParams.notifications_enabled = notifications_enabled ? 1 : 0;
    }

    if (ai_model_preference !== undefined) {
      updateQuery += ", ai_model_preference = :ai_model_preference";
      bindParams.ai_model_preference = ai_model_preference;
    }

    updateQuery += " WHERE user_id = :user_id";

    // 쿼리 실행
    await connection.execute(updateQuery, bindParams, { autoCommit: true });

    // 업데이트된 설정 조회
    const updatedSettings = await getUserSettings(user_id);
    // toSnakeCaseObj 함수 사용하여 케이싱 통일
    return toSnakeCaseObj(updatedSettings);
  } catch (err) {
    console.error("설정 업데이트 실패:", err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("연결 닫기 실패:", err);
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
    console.error("프로필 이미지 경로 업데이트 실패:", err);
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

    if (
      row.CREATED_AT &&
      typeof row.CREATED_AT === "object" &&
      row.CREATED_AT.toISOString
    ) {
      row.CREATED_AT = row.CREATED_AT.toISOString();
    }
    if (
      row.UPDATED_AT &&
      typeof row.UPDATED_AT === "object" &&
      row.UPDATED_AT.toISOString
    ) {
      row.UPDATED_AT = row.UPDATED_AT.toISOString();
    }

    return toSnakeCaseObj(row);
  } catch (err) {
    console.error("Error getting user profile:", err);
    throw err;
  } finally {
    if (connection && !existingConnection) {
      // 이 함수에서 직접 생성한 경우에만 닫음
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
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
    if (username !== undefined && username !== null) {
      // username이 제공된 경우
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
      profileUpdateFields.push("theme_preference = :theme_preference");
      profileBindParams.theme_preference = theme_preference;
    }
    if (bio !== undefined) {
      // CLOB 데이터는 그대로 전달
      profileUpdateFields.push("bio = :bio");
      profileBindParams.bio = bio;
    }
    if (badge !== undefined) {
      profileUpdateFields.push("badge = :badge");
      profileBindParams.badge = badge;
    }

    if (profileUpdateFields.length > 0) {
      let updateProfileQuery = `UPDATE user_profiles SET ${profileUpdateFields.join(
        ", "
      )}, updated_at = SYSTIMESTAMP WHERE user_id = :user_id`;
      await connection.execute(updateProfileQuery, profileBindParams);
      userProfileTableHasChanges = true;
    }

    if (!userTableHasChanges && !userProfileTableHasChanges) {
      // 변경 사항이 없으면 현재 프로필 반환 (롤백 불필요, 커밋 안 함)
      const currentProfile = await getUserProfile(user_id, connection); // 기존 커넥션 사용
      if (!currentProfile) throw new Error("프로필을 찾을 수 없습니다.");
      return currentProfile;
    }

    await connection.commit(); // 모든 변경사항 커밋

    return await getUserProfile(user_id, connection); // 업데이트된 프로필 정보 반환 (기존 커넥션 사용)
  } catch (err) {
    if (connection) {
      await connection.rollback(); // 오류 발생 시 롤백
    }
    console.error("프로필 업데이트 실패:", err);
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
      throw new Error("사용자 프로필을 찾을 수 없습니다.");
    }

    let currentLevel = profileResult.rows[0].LEVEL;
    let currentExperience = profileResult.rows[0].EXPERIENCE;

    // 레벨업 로직 (예: 100 경험치당 1레벨업)
    const experienceForNextLevel = 100; // 레벨업에 필요한 경험치
    while (currentExperience >= experienceForNextLevel) {
      currentLevel += 1;
      currentExperience -= experienceForNextLevel;
    } // 레벨 및 경험치 업데이트
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
    console.error("경험치 추가 및 레벨 업데이트 실패:", err);
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
      throw new Error("삭제할 사용자를 찾을 수 없습니다.");
    }

    // console.log(`User ${user_id} and related data (via CASCADE) deleted successfully.`);
    return {
      message: `User ${user_id} and related data deleted successfully.`,
    };
  } catch (err) {
    console.error("회원 탈퇴 실패:", err);
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
    console.error("이메일 중복 체크 DB 오류:", err);
    throw err; // 오류를 호출자에게 다시 던짐
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
        profile_theme: "default",
        profile_border: "none",
        profile_background: null,
        status_message: null,
        nickname: null,
        introduction: null,
        is_premium: 0,
        premium_until: null,
      };
    }

    // CLOB 변환을 연결이 열려있을 때 수행
    const customizationData = await convertClobFields(result.rows[0]);
    return customizationData;
  } catch (error) {
    console.error("[userModel] 프로필 꾸미기 조회 오류:", error);
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
      introduction,
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
        introduction,
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      throw new Error("프로필을 찾을 수 없거나 업데이트할 수 없습니다.");
    }

    return {
      success: true,
      message: "프로필 꾸미기 설정이 업데이트되었습니다.",
    };
  } catch (error) {
    console.error("[userModel] 프로필 꾸미기 업데이트 오류:", error);
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
        level_name: "새싹 오비터",
        level_description: "Orbitmate를 시작한 신규 사용자",
        required_exp: 0,
        next_level_exp: 100,
        progress: 0,
        experience_multiplier: 1.0,
        unlock_features: ["basic_chat", "profile_edit"],
      };
    }
    const data = await convertClobFields(result.rows[0]);
    const currentExp = data.EXPERIENCE || 0;
    const requiredExp = data.REQUIRED_EXP || 0;
    const nextLevelExp = data.NEXT_LEVEL_EXP || null;

    let progress = 0;
    if (nextLevelExp && nextLevelExp > requiredExp) {
      progress = Math.round(
        ((currentExp - requiredExp) / (nextLevelExp - requiredExp)) * 100
      );
    }

    const levelData = {
      experience: currentExp,
      level: data.LEVEL || data.level,
      level_name: data.LEVEL_NAME || data.level_name,
      level_description: data.LEVEL_DESCRIPTION || data.level_description,
      required_exp: requiredExp,
      next_level_exp: nextLevelExp,
      progress: Math.max(0, Math.min(100, progress)),
      experience_multiplier: data.EXPERIENCE_MULTIPLIER || 1.0,
      unlock_features: data.UNLOCK_FEATURES
        ? JSON.parse(data.UNLOCK_FEATURES)
        : [],
    };
    return levelData;
  } catch (error) {
    console.error("[userModel] 사용자 레벨 조회 오류:", error);
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
async function addUserExperience(
  user_id,
  points,
  exp_type = "chat",
  reason = null
) {
  let connection;
  try {
    connection = await getConnection();
    // Oracle에서는 기본적으로 autoCommit: false이므로 트랜잭션이 자동 시작됨

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
    const newExp = oldExp + actualPoints; // 새 레벨 계산
    const levelResult = await connection.execute(
      `SELECT level_num FROM (
         SELECT level_num FROM level_requirements 
         WHERE required_exp <= :newExp 
         ORDER BY level_num DESC
       ) WHERE ROWNUM = 1`,
      { newExp },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const newLevel =
      levelResult.rows.length > 0 ? levelResult.rows[0].LEVEL_NUM : oldLevel;

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
        multiplier_applied: multiplier,
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
    ); // 레벨업 시 뱃지 지급
    let levelUpBadge = null;
    let expMilestoneBadges = [];
    let levelUpBadges = [];

    if (newLevel > oldLevel) {
      const badgeResult = await connection.execute(
        `SELECT level_badge FROM level_requirements WHERE level_num = :newLevel`,
        { newLevel },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (badgeResult.rows.length > 0 && badgeResult.rows[0].LEVEL_BADGE) {
        levelUpBadge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          badgeResult.rows[0].LEVEL_BADGE,
          `레벨 ${newLevel} 달성`
        );
      }

      // 레벨업 뱃지 자동 지급
      levelUpBadges = await checkAndGrantBadges(
        connection,
        user_id,
        "level_up",
        { newLevel }
      );
    }

    // 경험치 마일스톤 뱃지 자동 지급
    expMilestoneBadges = await checkAndGrantBadges(
      connection,
      user_id,
      "experience_milestone",
      { totalExp: newExp }
    );

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
      badge_earned: levelUpBadge,
      auto_badges: [...expMilestoneBadges, ...levelUpBadges],
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("[userModel] 경험치 추가 오류:", error);
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
// 9. 다국어 지원 시스템
// =========================

/**
 * 번역 리소스 조회
 */
async function getTranslationResources(lang_code = "ko", category = null) {
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

    const result = await connection.execute(query, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    const translations = {};
    for (const row of result.rows) {
      const data = convertClobFields(row);
      translations[data.RESOURCE_KEY || data.resource_key] =
        data.RESOURCE_VALUE || data.resource_value;
    }

    return translations;
  } catch (error) {
    console.error("[userModel] 번역 리소스 조회 오류:", error);
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

    return { success: true, message: "언어 설정이 업데이트되었습니다." };
  } catch (error) {
    console.error("[userModel] 언어 설정 업데이트 오류:", error);
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
// 10. 다양한 조건에 따라 뱃지 자동 지급
// =========================

/**
 * 다양한 조건에 따라 뱃지 자동 지급
 */
async function checkAndGrantBadges(
  connection,
  user_id,
  action_type,
  metadata = {}
) {
  try {
    const badges = [];

    // 1. 첫 대화 뱃지
    if (action_type === "first_chat") {
      const badge = await grantUserBadge(
        connection,
        user_id,
        "achievement",
        "첫 대화",
        "처음으로 AI와 대화를 나눈 기념",
        "💬",
        "#4CAF50"
      );
      if (badge) badges.push(badge);
    }

    // 2. 경험치 기반 뱃지
    if (action_type === "experience_milestone") {
      const { totalExp } = metadata;

      if (totalExp >= 1000 && totalExp < 1050) {
        // 첫 1000 경험치 달성
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "경험치 마스터",
          "1000 경험치를 달성한 기념",
          "🎯",
          "#FF9800"
        );
        if (badge) badges.push(badge);
      }

      if (totalExp >= 5000 && totalExp < 5050) {
        // 5000 경험치 달성
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "경험치 전문가",
          "5000 경험치를 달성한 기념",
          "🏆",
          "#FFD700"
        );
        if (badge) badges.push(badge);
      }

      if (totalExp >= 10000 && totalExp < 10050) {
        // 10000 경험치 달성
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "경험치 레전드",
          "10000 경험치를 달성한 기념",
          "👑",
          "#9C27B0"
        );
        if (badge) badges.push(badge);
      }
    }
    // 3. 레벨 기반 뱃지
    if (action_type === "level_up") {
      const { newLevel } = metadata;

      if (newLevel === 5) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "초보 탈출",
          "레벨 5를 달성한 기념",
          "🌱",
          "#4CAF50"
        );
        if (badge) badges.push(badge);
      }

      if (newLevel === 10) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "중급자",
          "레벨 10을 달성한 기념",
          "🔥",
          "#FF5722"
        );
        if (badge) badges.push(badge);
      }

      if (newLevel === 20) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "고급 사용자",
          "레벨 20을 달성한 기념",
          "⚡",
          "#2196F3"
        );
        if (badge) badges.push(badge);
      }

      if (newLevel === 50) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "마스터 오비터",
          "레벨 50을 달성한 기념",
          "💎",
          "#9C27B0"
        );
        if (badge) badges.push(badge);
      }
    }

    // 4. 구독 관련 뱃지
    if (action_type === "subscription_upgrade") {
      const { tierName } = metadata;

      if (tierName === "planet") {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "premium",
          "플래닛 입문자",
          "첫 플래닛 구독을 시작한 기념",
          "🌱",
          "#4CAF50"
        );
        if (badge) badges.push(badge);
      }

      if (tierName === "star") {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "premium",
          "스타 신예",
          "스타 등급 첫 구독 기념",
          "⭐",
          "#FFC107"
        );
        if (badge) badges.push(badge);
      }
    }

    // 5. 활동 기반 뱃지
    if (action_type === "daily_activity") {
      const { consecutiveDays } = metadata;

      if (consecutiveDays === 7) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "activity",
          "일주일 연속",
          "7일 연속 접속한 기념",
          "📅",
          "#4CAF50"
        );
        if (badge) badges.push(badge);
      }

      if (consecutiveDays === 30) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "activity",
          "한 달 연속",
          "30일 연속 접속한 기념",
          "🗓️",
          "#FF9800"
        );
        if (badge) badges.push(badge);
      }

      if (consecutiveDays === 100) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "activity",
          "백일장",
          "100일 연속 접속한 기념",
          "💯",
          "#FFD700"
        );
        if (badge) badges.push(badge);
      }
    }

    // 6. 메시지 수 기반 뱃지
    if (action_type === "message_count") {
      const { totalMessages } = metadata;

      if (totalMessages === 100) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "수다쟁이",
          "100개의 메시지를 보낸 기념",
          "💬",
          "#4CAF50"
        );
        if (badge) badges.push(badge);
      }

      if (totalMessages === 1000) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "대화 마스터",
          "1000개의 메시지를 보낸 기념",
          "🗣️",
          "#FF9800"
        );
        if (badge) badges.push(badge);
      }

      if (totalMessages === 10000) {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "achievement",
          "채팅 레전드",
          "10000개의 메시지를 보낸 기념",
          "💎",
          "#9C27B0"
        );
        if (badge) badges.push(badge);
      }
    }

    // 7. 특별 이벤트 뱃지
    if (action_type === "special_event") {
      const { eventType } = metadata;

      if (eventType === "beta_tester") {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "special",
          "베타 테스터",
          "오비메이트 베타 버전 테스터",
          "🔬",
          "#FF9800"
        );
        if (badge) badges.push(badge);
      }

      if (eventType === "early_adopter") {
        const badge = await grantUserBadge(
          connection,
          user_id,
          "special",
          "얼리 어답터",
          "오비메이트 초기 사용자",
          "🚀",
          "#2196F3"
        );
        if (badge) badges.push(badge);
      }
    }

    return badges;
  } catch (error) {
    console.error("[userModel] 뱃지 자동 지급 오류:", error);
    return [];
  }
}

// =========================
// 뱃지 레벨 시스템
// =========================

/**
 * 뱃지 레벨 업그레이드 (버그 제보, 피드백 등)
 */
async function upgradeBadgeLevel(user_id, badge_name, action_reason = "") {
  let connection;
  try {
    connection = await getConnection();

    // 현재 뱃지 정보 조회
    const badgeResult = await connection.execute(
      `SELECT badge_id, badge_level, badge_description 
       FROM user_badges 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let currentLevel = 1;
    let badgeExists = false;

    if (badgeResult.rows.length > 0) {
      badgeExists = true;
      currentLevel = badgeResult.rows[0].BADGE_LEVEL || 1;
    }

    const newLevel = currentLevel + 1;
    // 뱃지별 레벨 설명 정의
    const badgeDescriptions = {
      "버그 헌터": {
        1: "첫 번째 버그 제보! 서비스 개선에 기여해주셔서 감사합니다",
        2: "두 번째 버그 제보! 날카로운 관찰력을 보여주고 있습니다",
        3: "세 번째 버그 제보! 진정한 버그 헌터로 성장하고 있습니다",
        4: "네 번째 버그 제보! 전문적인 테스터의 면모를 보이고 있습니다",
        5: "다섯 번째 버그 제보! 버그 헌터 마스터가 되었습니다",
        default: `${newLevel}번째 버그 제보! 최고의 버그 헌터입니다`,
      },
      "피드백 전문가": {
        1: "첫 번째 피드백! 서비스 개선 아이디어를 제공해주셔서 감사합니다",
        2: "두 번째 피드백! 사용자 경험 개선에 큰 도움이 되고 있습니다",
        3: "세 번째 피드백! 진정한 피드백 전문가로 인정받고 있습니다",
        4: "네 번째 피드백! 서비스 기획자 못지않은 통찰력을 보여주고 있습니다",
        5: "다섯 번째 피드백! 피드백 전문가 마스터가 되었습니다",
        default: `${newLevel}번째 피드백! 최고의 피드백 전문가입니다`,
      },
      "플래닛 구독자": {
        1: "플래닛 1개월 구독! 프리미엄 서비스 시작",
        2: "플래닛 2개월 구독! 꾸준한 이용자가 되어가고 있습니다",
        3: "플래닛 3개월 구독! 정착된 플래닛 사용자입니다",
        4: "플래닛 6개월 구독! 오랜 기간 함께해주셔서 감사합니다",
        5: "플래닛 1년 구독! 진정한 플래닛 주민이 되었습니다",
        6: "플래닛 2년 구독! 플래닛의 핵심 거주자입니다",
        7: "플래닛 3년 구독! 플래닛 개척자로 인정받습니다",
        default: `플래닛 장기 구독자! ${Math.floor(newLevel / 12)}년 ${
          newLevel % 12
        }개월 충성 고객`,
      },
      "스타 구독자": {
        1: "스타 1개월 구독! 최고급 서비스 이용 시작",
        2: "스타 2개월 구독! 프리미엄 경험을 지속하고 있습니다",
        3: "스타 3개월 구독! 스타 등급의 진가를 경험하고 있습니다",
        4: "스타 6개월 구독! 최상급 서비스의 충실한 이용자입니다",
        5: "스타 1년 구독! 스타 등급 VIP 고객이 되었습니다",
        6: "스타 2년 구독! 최고급 서비스의 핵심 고객입니다",
        7: "스타 3년 구독! 스타 등급 레전드 사용자입니다",
        default: `스타 장기 구독자! ${Math.floor(newLevel / 12)}년 ${
          newLevel % 12
        }개월 VIP 고객`,
      },
    };

    const badgeIcons = {
      "버그 헌터": ["🐛", "🔍", "🛠️", "🎯", "👑"],
      "피드백 전문가": ["💡", "💭", "🧠", "⚡", "🌟"],
      "플래닛 구독자": ["🌱", "🌿", "🌳", "🏡", "🏘️", "🏙️", "🌍"],
      "스타 구독자": ["⭐", "✨", "�", "💫", "�", "👑", "🌌"],
    };

    const newDescription =
      badgeDescriptions[badge_name]?.[newLevel] ||
      badgeDescriptions[badge_name]?.default ||
      `${badge_name} 레벨 ${newLevel}`;

    const newIcon = badgeIcons[badge_name]?.[newLevel - 1] || "🏆";

    if (badgeExists) {
      // 기존 뱃지 레벨 업그레이드
      await connection.execute(
        `UPDATE user_badges 
         SET badge_level = :newLevel, 
             badge_description = :newDescription,
             badge_icon = :newIcon,
             updated_at = SYSTIMESTAMP 
         WHERE user_id = :user_id AND badge_name = :badge_name`,
        { user_id, badge_name, newLevel, newDescription, newIcon },
        { autoCommit: true }
      );
    } else {
      // 새 뱃지 생성 (레벨 1부터 시작)
      await connection.execute(
        `INSERT INTO user_badges 
         (user_id, badge_type, badge_name, badge_description, badge_icon, badge_level, badge_color) 
         VALUES (:user_id, 'special', :badge_name, :newDescription, :newIcon, 1, '#795548')`,
        { user_id, badge_name, newDescription, newIcon },
        { autoCommit: true }
      );
      newLevel = 1;
    }

    // 경험치 보상 (뱃지 레벨에 따라 증가)
    const expReward = newLevel * 10;
    await addUserExperience(
      user_id,
      expReward,
      "badge_upgrade",
      `${badge_name} 레벨 ${newLevel} 달성`
    );

    return {
      success: true,
      badge_name,
      old_level: currentLevel,
      new_level: newLevel,
      description: newDescription,
      icon: newIcon,
      exp_reward: expReward,
      action_reason,
    };
  } catch (error) {
    console.error("[userModel] 뱃지 레벨 업그레이드 오류:", error);
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
 * 구독 기간 뱃지 업그레이드 (플래닛/스타만)
 */
async function upgradeSubscriptionBadge(user_id, tier_name, months_count) {
  let connection;
  try {
    connection = await getConnection();

    // 무료나 갤럭시는 구독 기간 뱃지 없음
    if (tier_name === "free" || tier_name === "galaxy") {
      return {
        success: false,
        message: "해당 구독 등급은 기간 뱃지를 지원하지 않습니다.",
      };
    }

    const badgeName = tier_name === "planet" ? "플래닛 구독자" : "스타 구독자";

    // 개월 수에 따른 레벨 계산
    let targetLevel = 1;
    if (months_count >= 36) targetLevel = 7; // 3년
    else if (months_count >= 24) targetLevel = 6; // 2년
    else if (months_count >= 12) targetLevel = 5; // 1년
    else if (months_count >= 6) targetLevel = 4; // 6개월
    else if (months_count >= 3) targetLevel = 3; // 3개월
    else if (months_count >= 2) targetLevel = 2; // 2개월
    else targetLevel = 1; // 1개월

    // 현재 뱃지 레벨 확인
    const currentBadge = await connection.execute(
      `SELECT badge_level FROM user_badges 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name: badgeName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const currentLevel =
      currentBadge.rows.length > 0 ? currentBadge.rows[0].BADGE_LEVEL || 1 : 0;

    // 레벨이 더 높아질 때만 업그레이드
    if (targetLevel <= currentLevel) {
      return {
        success: false,
        message: `이미 ${badgeName} 레벨 ${currentLevel}을 보유하고 있습니다.`,
        current_level: currentLevel,
        target_level: targetLevel,
      };
    }

    // 뱃지 레벨 업그레이드 또는 새로 생성
    if (currentBadge.rows.length > 0) {
      // 기존 뱃지 업그레이드
      const result = await upgradeBadgeLevel(
        user_id,
        badgeName,
        `구독 ${months_count}개월 달성`
      );
      return {
        success: true,
        message: `${badgeName} 뱃지가 레벨 ${targetLevel}로 업그레이드되었습니다!`,
        badge_upgrade: result,
        months_count,
        tier_name,
      };
    } else {
      // 새 뱃지 생성
      const badgeDescriptions = {
        "플래닛 구독자": {
          1: "플래닛 1개월 구독! 프리미엄 서비스 시작",
        },
        "스타 구독자": {
          1: "스타 1개월 구독! 최고급 서비스 이용 시작",
        },
      };

      const badgeIcons = {
        "플래닛 구독자": "🌱",
        "스타 구독자": "⭐",
      };

      await connection.execute(
        `INSERT INTO user_badges 
         (user_id, badge_type, badge_name, badge_description, badge_icon, badge_level, badge_color) 
         VALUES (:user_id, 'premium', :badge_name, :description, :icon, 1, :color)`,
        {
          user_id,
          badge_name: badgeName,
          description: badgeDescriptions[badgeName][1],
          icon: badgeIcons[badgeName],
          color: tier_name === "planet" ? "#4CAF50" : "#FFD700",
        },
        { autoCommit: true }
      );

      // 구독 시작 경험치
      const expReward = tier_name === "planet" ? 50 : 100;
      await addUserExperience(
        user_id,
        expReward,
        "subscription_start",
        `${badgeName} 구독 시작`
      );

      return {
        success: true,
        message: `${badgeName} 뱃지가 새로 지급되었습니다!`,
        badge_name: badgeName,
        level: 1,
        exp_reward: expReward,
        months_count,
        tier_name,
      };
    }
  } catch (error) {
    console.error("[userModel] 구독 뱃지 업그레이드 오류:", error);
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
 * 개발자가 수동으로 뱃지 레벨 승인 (버그 제보, 피드백용)
 */
async function approveBadgeUpgrade(
  user_id,
  badge_name,
  reason = "개발자 승인"
) {
  try {
    const result = await upgradeBadgeLevel(user_id, badge_name, reason);

    // 승인 보너스 경험치
    const bonusExp = badge_name === "버그 헌터" ? 25 : 20;
    await addUserExperience(
      user_id,
      bonusExp,
      "manual_approval",
      `${badge_name} 승인 보너스`
    );

    return {
      success: true,
      message: `${badge_name} 뱃지 레벨이 승인되었습니다!`,
      badge_upgrade: result,
      bonus_exp: bonusExp,
      approved_by: "developer",
    };
  } catch (error) {
    console.error("[userModel] 뱃지 승인 오류:", error);
    throw error;
  }
}

/**
 * 사용자 뱃지 목록 조회
 */
async function getUserBadges(user_id) {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT ub.badge_id, ub.badge_name, ub.badge_description, ub.badge_icon,
              ub.badge_level, ub.is_equipped, ub.created_at, ub.updated_at
       FROM user_badges ub
       WHERE ub.user_id = :user_id
       ORDER BY ub.created_at DESC`,
      { user_id }
    );

    return result.rows.map((row) => ({
      badge_id: row.BADGE_ID,
      badge_name: row.BADGE_NAME,
      badge_description: row.BADGE_DESCRIPTION,
      badge_icon: row.BADGE_ICON,
      badge_level: row.BADGE_LEVEL,
      is_equipped: row.IS_EQUIPPED,
      created_at: row.CREATED_AT,
      updated_at: row.UPDATED_AT,
    }));
  } catch (error) {
    console.error("Error fetching user badges:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

/**
 * 뱃지 착용/해제
 */
async function toggleUserBadge(user_id, badge_id, is_equipped) {
  let connection;
  try {
    connection = await getConnection();

    // 뱃지 소유 여부 확인
    const checkResult = await connection.execute(
      `SELECT badge_id FROM user_badges 
       WHERE user_id = :user_id AND badge_id = :badge_id`,
      { user_id, badge_id }
    );

    if (checkResult.rows.length === 0) {
      throw new Error("뱃지를 찾을 수 없습니다.");
    }

    // 착용 상태 업데이트
    await connection.execute(
      `UPDATE user_badges 
       SET is_equipped = :is_equipped, updated_at = SYSTIMESTAMP
       WHERE user_id = :user_id AND badge_id = :badge_id`,
      { user_id, badge_id, is_equipped: is_equipped ? 1 : 0 }
    );

    await connection.commit();

    return {
      success: true,
      message: is_equipped ? "뱃지를 착용했습니다." : "뱃지를 해제했습니다.",
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error toggling user badge:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

/**
 * 사용자 활동 처리 통합 함수 (버그 제보, 피드백, 테스트 참여)
 */
async function handleUserActivity(user_id, activity_type, content, metadata = {}) {
  let connection;
  try {
    connection = await getConnection();
    
    const activityConfig = {
      'bug_report': {
        exp_reward: 5,
        message: '버그 제보가 접수되었습니다. 개발팀 검토 후 뱃지가 지급됩니다.',
        status: 'pending_review',
        note: '개발자 승인 후 버그 헌터 뱃지 레벨이 증가합니다.'
      },
      'feedback': {
        exp_reward: 3,
        message: '피드백이 제출되었습니다. 개발팀 검토 후 뱃지가 지급됩니다.',
        status: 'pending_review',
        note: '개발자 승인 후 피드백 전문가 뱃지 레벨이 증가합니다.'
      },
      'test_participation': {
        exp_reward: 10,
        message: '테스트 참여가 완료되었습니다!',
        status: 'completed',
        note: '테스터 뱃지가 지급되었습니다.'
      }
    };
    
    const config = activityConfig[activity_type];
    if (!config) {
      throw new Error(`지원하지 않는 활동 타입: ${activity_type}`);
    }
    
    // 경험치 추가
    await addUserExperience(user_id, config.exp_reward, activity_type, content.substring(0, 50));
    
    // 테스트 참여의 경우 즉시 뱃지 지급
    if (activity_type === 'test_participation') {
      const test_type = metadata.test_type || 'alpha';
      const badge_name = test_type === 'alpha' ? 'Alpha Tester' : 'Beta Tester';
      
      // 이미 뱃지가 있는지 확인
      const existingBadge = await connection.execute(
        `SELECT badge_id FROM user_badges 
         WHERE user_id = :user_id AND badge_name = :badge_name`,
        { user_id, badge_name }
      );
      
      if (existingBadge.rows.length === 0) {
        // 새 뱃지 지급
        await connection.execute(
          `INSERT INTO user_badges (badge_id, user_id, badge_name, badge_description, badge_icon, badge_level, created_at, updated_at)
           VALUES (user_badges_seq.NEXTVAL, :user_id, :badge_name, :description, :icon, 1, SYSTIMESTAMP, SYSTIMESTAMP)`,
          {
            user_id,
            badge_name,
            description: `${test_type.toUpperCase()} 테스트에 참여하신 소중한 테스터입니다!`,
            icon: test_type === 'alpha' ? '🔬' : '🧪'
          }
        );
      }
    }
    
    await connection.commit();
    
    return {
      success: true,
      message: config.message,
      status: config.status,
      exp_reward: config.exp_reward,
      note: config.note
    };
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error(`Error handling ${activity_type}:`, error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// 기존 함수들을 래퍼로 변경 (하위 호환성 유지)
async function handleBugReport(user_id, bug_description, severity = 'medium') {
  return await handleUserActivity(user_id, 'bug_report', bug_description, { severity });
}

async function handleFeedbackSubmission(user_id, feedback_content, feedback_type = 'general') {
  return await handleUserActivity(user_id, 'feedback', feedback_content, { feedback_type });
}

async function handleTestParticipation(user_id, test_type, test_details = '') {
  return await handleUserActivity(user_id, 'test_participation', test_details, { test_type });
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
  getUserBadges,
  toggleUserBadge,
  checkAndGrantBadges,
  getTranslationResources,
  updateUserLanguage,
  upgradeBadgeLevel,
  handleBugReport,
  handleFeedbackSubmission,
  handleTestParticipation,
  upgradeSubscriptionBadge,
  approveBadgeUpgrade,
};
