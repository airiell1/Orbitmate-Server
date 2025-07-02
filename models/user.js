const bcrypt = require("bcrypt");
// const { getConnection, oracledb } = require("../config/database"); // Removed
const { oracledb } = require("../config/database");
const { clobToString, convertClobFields, toSnakeCaseObj } = require("../utils/dbUtils");
const { handleOracleError } = require("../utils/errorHandler");
const config = require("../config"); // For NODE_ENV

// Helper function to create default user profile, used internally
async function createDefaultUserProfile(connection, user_id) {
    await connection.execute(
      `INSERT INTO user_profiles (user_id, theme_preference, bio, badge, experience, "level")
       VALUES (:user_id, 'light', NULL, NULL, 0, 1)`,
      { user_id: user_id },
      { autoCommit: false }
    );
}


// 사용자 등록 함수
async function registerUser(connection, user_id, username, email, password) {
  try {
    console.log('[registerUser] 시작:', { 
      connection: !!connection,
      user_id,
      username, 
      email, 
      passwordLength: password?.length,
      argumentsLength: arguments.length,
      argumentsArray: Array.from(arguments).map((arg, i) => ({ index: i, type: typeof arg, value: i === 0 ? '(connection)' : arg }))
    });
    
    // 입력값 검증
    if (!username || !email || !password) {
      const error = new Error("사용자명, 이메일, 비밀번호가 모두 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    if (typeof password !== 'string' || password.trim() === '') {
      const error = new Error("유효한 비밀번호를 입력해주세요.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const saltRounds = 10;
    let passwordHash;
    
    try {
      console.log('[registerUser] bcrypt 해싱 시작...');
      passwordHash = await bcrypt.hash(password.toString(), saltRounds);
      console.log('[registerUser] bcrypt 해싱 완료');
    } catch (bcryptError) {
      console.error('[registerUser] bcrypt hash error:', bcryptError);
      const error = new Error("비밀번호 해싱 중 오류가 발생했습니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const emailCheck = await connection.execute(
      `SELECT user_id, username, email FROM users WHERE email = :email`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (emailCheck.rows.length > 0) {
      const existingUser = toSnakeCaseObj(emailCheck.rows[0]);
      return { ...existingUser, already_registered: true };
    }

    // user_id 결정: null이면 자동 생성, 아니면 고정값 사용
    let user_id_to_insert;
    const isFixedId = user_id !== null;
    
    if (isFixedId) {
      // 고정 ID 사용 (API@example.com 등)
      user_id_to_insert = user_id;
      
      // 기존 고정 ID 사용자가 있다면 삭제 후 새로 생성
      const existingUser = await connection.execute(
        `SELECT user_id FROM users WHERE user_id = :user_id`,
        { user_id: user_id_to_insert },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      if (existingUser.rows.length > 0) {
        await connection.execute(
          `DELETE FROM users WHERE user_id = :user_id`,
          { user_id: user_id_to_insert },
          { autoCommit: false }
        );
      }
      
      // 고정된 user_id로 사용자 생성
      await connection.execute(
        `INSERT INTO users (user_id, username, email, password_hash)
         VALUES (:user_id, :username, :email, :passwordHash)`,
        { user_id: user_id_to_insert, username, email, passwordHash },
        { autoCommit: false }
      );
    } else {
      // 자동 ID 생성 (일반 사용자)
      const result = await connection.execute(
        `INSERT INTO users (username, email, password_hash)
         VALUES (:username, :email, :passwordHash)
         RETURNING user_id INTO :out_user_id`,
        { username, email, passwordHash, out_user_id: { type: oracledb.STRING, dir: oracledb.BIND_OUT } },
        { autoCommit: false }
      );
      user_id_to_insert = result.outBinds.out_user_id[0];
    }

    await connection.execute(
      `INSERT INTO user_settings (user_id, theme, language, font_size, notifications_enabled)
       VALUES (:user_id, 'light', 'ko', 14, 1)`,
      { user_id: user_id_to_insert },
      { autoCommit: false }
    );

    await createDefaultUserProfile(connection, user_id_to_insert);
    // commit is handled by withTransaction

    return {
      user_id: user_id_to_insert,
      username: username,
      email: email,
      created_at: new Date().toISOString(), // Consider if DB should provide this
    };
  } catch (err) {
    // bcrypt 오류 처리
    if (err.code === "INVALID_INPUT") {
      throw err; // 이미 처리된 입력값 오류는 그대로 전달
    }
    
    // Oracle 고유 제약조건 위반 처리
    if (err.errorNum === 1 || (err.message && err.message.toLowerCase().includes("unique constraint")) && (err.message.toUpperCase().includes("EMAIL"))) {
      const customError = new Error("이미 등록된 이메일입니다.");
      customError.code = "UNIQUE_CONSTRAINT_VIOLATED";
      throw customError;
    }
    
    // 일반적인 bcrypt 오류 처리
    if (err.message && err.message.includes("data and salt arguments required")) {
      const customError = new Error("비밀번호 처리 중 오류가 발생했습니다.");
      customError.code = "INVALID_INPUT";
      throw customError;
    }
    
    throw handleOracleError(err);
  }
}

// 사용자 로그인 함수
async function loginUser(connection, email, password) {
  try {
    const result = await connection.execute(
      `SELECT user_id, username, email, password_hash, is_active FROM users WHERE email = :email`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      const error = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      error.code = "UNAUTHORIZED";
      throw error;
    }

    const user = toSnakeCaseObj(result.rows[0]);

    if (user.is_active !== 1) {
      const error = new Error("계정이 비활성화되었습니다. 관리자에게 문의하세요.");
      error.code = "FORBIDDEN";
      throw error;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const error = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      error.code = "UNAUTHORIZED";
      throw error;
    }

    await connection.execute(
      `UPDATE users SET last_login = SYSTIMESTAMP WHERE user_id = :user_id`,
      { user_id: user.user_id },
      { autoCommit: false } // Assuming login might be part of a larger transaction in some cases
    );
    // commit will be handled by withTransaction

    return {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      logged_in_at: new Date().toISOString(),
    };
  } catch (err) {
    if (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN") throw err;
    throw handleOracleError(err);
  }
}

// 사용자 설정 조회 함수
async function getUserSettings(connection, user_id) {
  try {
    const result = await connection.execute(
      `SELECT user_id, theme, language, font_size, notifications_enabled, ai_model_preference, updated_at
       FROM user_settings
       WHERE user_id = :user_id`,
      { user_id: user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      // Consider creating default settings if not found, or throw specific error
      const error = new Error("사용자 설정을 찾을 수 없습니다.");
      error.code = "RESOURCE_NOT_FOUND";
      throw error;
    }
    return toSnakeCaseObj(result.rows[0]);
  } catch (err) {
    if (err.code === "RESOURCE_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 사용자 설정 업데이트 함수
async function updateUserSettings(connection, user_id, settings) {
  try {
    const { theme, language, font_size, notifications_enabled, ai_model_preference } = settings;
    let updateQuery = "UPDATE user_settings SET updated_at = SYSTIMESTAMP";
    const bindParams = { user_id: user_id };

    if (theme !== undefined) { updateQuery += ", theme = :theme"; bindParams.theme = theme; }
    if (language !== undefined) { updateQuery += ", language = :language"; bindParams.language = language; }
    if (font_size !== undefined) { updateQuery += ", font_size = :font_size"; bindParams.font_size = font_size; }
    if (notifications_enabled !== undefined) { updateQuery += ", notifications_enabled = :notifications_enabled"; bindParams.notifications_enabled = notifications_enabled ? 1 : 0; }
    if (ai_model_preference !== undefined) { updateQuery += ", ai_model_preference = :ai_model_preference"; bindParams.ai_model_preference = ai_model_preference; }

    updateQuery += " WHERE user_id = :user_id RETURNING user_id, theme, language, font_size, notifications_enabled, ai_model_preference, updated_at INTO :outUserId, :outTheme, :outLang, :outFontSize, :outNotif, :outAiModel, :outUpdatedAt";

    bindParams.outUserId = {type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outTheme = {type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outLang = {type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outFontSize = {type: oracledb.NUMBER, dir: oracledb.BIND_OUT };
    bindParams.outNotif = {type: oracledb.NUMBER, dir: oracledb.BIND_OUT };
    bindParams.outAiModel = {type: oracledb.STRING, dir: oracledb.BIND_OUT };
    bindParams.outUpdatedAt = {type: oracledb.DATE, dir: oracledb.BIND_OUT };

    const result = await connection.execute(updateQuery, bindParams, { autoCommit: false });

     if (result.rowsAffected === 0) {
        const error = new Error("사용자 설정을 찾을 수 없거나 업데이트되지 않았습니다.");
        error.code = "RESOURCE_NOT_FOUND";
        throw error;
    }
    // Directly use outBinds to construct the response
    return toSnakeCaseObj({
        USER_ID: result.outBinds.outUserId[0],
        THEME: result.outBinds.outTheme[0],
        LANGUAGE: result.outBinds.outLang[0],
        FONT_SIZE: result.outBinds.outFontSize[0],
        NOTIFICATIONS_ENABLED: result.outBinds.outNotif[0],
        AI_MODEL_PREFERENCE: result.outBinds.outAiModel[0],
        UPDATED_AT: result.outBinds.outUpdatedAt[0],
    });

  } catch (err) {
    if (err.code === "RESOURCE_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 사용자 프로필 이미지 경로 업데이트 함수
async function updateUserProfileImage(connection, user_id, profileImagePath) {
  try {
    const result = await connection.execute(
      `UPDATE users SET profile_image_path = :profileImagePath WHERE user_id = :user_id`,
      { profileImagePath: profileImagePath, user_id: user_id },
      { autoCommit: false }
    );
     if (result.rowsAffected === 0) {
        const error = new Error("사용자를 찾을 수 없어 프로필 이미지를 업데이트할 수 없습니다.");
        error.code = "USER_NOT_FOUND";
        throw error;
    }
    return { profile_image_path: profileImagePath }; // Return only the path or a success indicator
  } catch (err) {
    if (err.code === "USER_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 사용자 프로필 조회 함수
async function getUserProfile(connection, user_id) {
  try {
    const result = await connection.execute(
      `SELECT u.user_id, u.username, u.email, u.created_at, u.is_active, u.profile_image_path, 
              p.theme_preference, p.bio, p.badge, p.experience, p."level", p.updated_at as profile_updated_at
       FROM users u
       LEFT JOIN user_profiles p ON u.user_id = p.user_id
       WHERE u.user_id = :user_id`,
      { user_id: user_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      const error = new Error("사용자 프로필을 찾을 수 없습니다.");
      error.code = "USER_NOT_FOUND"; // Or RESOURCE_NOT_FOUND
      throw error;
    }

    let rowData = result.rows[0];
    // bio 필드가 CLOB일 수 있으므로 변환
    if (rowData.BIO) {
        rowData.BIO = await clobToString(rowData.BIO);
    }
    // 날짜 필드를 ISO 문자열로 변환 (필요한 경우)
    if (rowData.CREATED_AT && rowData.CREATED_AT instanceof Date) rowData.CREATED_AT = rowData.CREATED_AT.toISOString();
    if (rowData.PROFILE_UPDATED_AT && rowData.PROFILE_UPDATED_AT instanceof Date) rowData.PROFILE_UPDATED_AT = rowData.PROFILE_UPDATED_AT.toISOString();

    return toSnakeCaseObj(rowData);
  } catch (err) {
    if (err.code === "USER_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 사용자 프로필 업데이트 함수
async function updateUserProfile(connection, user_id, profileData) {
  try {
    const { username, theme_preference, bio, badge } = toSnakeCaseObj(profileData);
    let userUpdated = false;
    let profileUpdated = false;

    if (username !== undefined) {
      const userUpdateResult = await connection.execute(
        `UPDATE users SET username = :username WHERE user_id = :user_id`,
        { username, user_id }, { autoCommit: false }
      );
      if(userUpdateResult.rowsAffected > 0) userUpdated = true;
    }

    const profileUpdateFields = [];
    const profileBindParams = { user_id };
    if (theme_preference !== undefined) { profileUpdateFields.push("theme_preference = :theme_preference"); profileBindParams.theme_preference = theme_preference; }
    if (bio !== undefined) { profileUpdateFields.push("bio = :bio"); profileBindParams.bio = {val: bio, type: oracledb.CLOB}; } // Bind as CLOB
    if (badge !== undefined) { profileUpdateFields.push("badge = :badge"); profileBindParams.badge = badge; }

    if (profileUpdateFields.length > 0) {
      const updateProfileQuery = `UPDATE user_profiles SET ${profileUpdateFields.join(", ")}, updated_at = SYSTIMESTAMP WHERE user_id = :user_id`;
      const profileUpdateResult = await connection.execute(updateProfileQuery, profileBindParams, { autoCommit: false });
      if(profileUpdateResult.rowsAffected > 0) profileUpdated = true;
    }

    if (!userUpdated && !profileUpdated) {
        // 변경 사항이 없어도 에러는 아님. 현재 프로필 반환 또는 특정 메시지 반환.
        // 여기서는 현재 프로필을 다시 조회하여 반환.
        // 또는, 0 rowsAffected 시 USER_NOT_FOUND 에러를 던질 수도 있음.
        // getUserProfile은 에러를 던지므로, 여기서는 그냥 성공으로 간주하고 다시 조회.
    }
     // commit은 withTransaction에서 처리

    return await getUserProfile(connection, user_id); // 업데이트된 프로필 정보 반환
  } catch (err) {
    throw handleOracleError(err);
  }
}

// 경험치 추가 및 레벨 업데이트 함수 (addUserExperience는 두 번 정의되어 있음, 하나를 선택해야 함)
// 아래 addUserExperience(connection, user_id, points, exp_type, reason)를 사용
async function addUserExperience(connection, user_id, points, exp_type = "chat", reason = null) {
  try {
    const userProfileResult = await connection.execute(
      `SELECT experience, "level", experience_multiplier FROM user_profiles WHERE user_id = :user_id FOR UPDATE`, // FOR UPDATE 추가 고려
      { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (userProfileResult.rows.length === 0) {
      // 프로필이 없으면 생성 후 재시도 (createDefaultUserProfile은 connection을 인자로 받도록 수정 필요)
      // await createDefaultUserProfile(connection, user_id); // 이 함수가 connection을 받도록 수정되었다고 가정
      // return await addUserExperience(connection, user_id, points, exp_type, reason);
      // 또는 에러 처리
      const error = new Error("사용자 프로필을 찾을 수 없습니다. 경험치를 추가할 수 없습니다.");
      error.code = "USER_NOT_FOUND";
      throw error;
    }

    const currentData = toSnakeCaseObj(userProfileResult.rows[0]);
    const oldExp = currentData.experience || 0;
    const oldLevel = currentData.level || 1;
    const multiplier = currentData.experience_multiplier || 1.0;
    const actualPoints = Math.round(points * multiplier);
    const newExp = oldExp + actualPoints;

    const levelResult = await connection.execute(
      `SELECT level_num FROM (
         SELECT level_num FROM level_requirements
         WHERE required_exp <= :newExp
         ORDER BY level_num DESC
       ) WHERE ROWNUM = 1`,
      { newExp }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const newLevel = levelResult.rows.length > 0 ? levelResult.rows[0].LEVEL_NUM : oldLevel;

    await connection.execute(
      `INSERT INTO user_experience_log
       (user_id, exp_type, exp_amount, exp_reason, old_total_exp, new_total_exp, old_level, new_level, multiplier_applied)
       VALUES (:user_id, :exp_type, :exp_amount, :exp_reason, :old_total_exp, :new_total_exp, :old_level, :new_level, :multiplier_applied)`,
      { user_id, exp_type, exp_amount: actualPoints, exp_reason: reason, old_total_exp: oldExp, new_total_exp: newExp, old_level: oldLevel, new_level: newLevel, multiplier_applied: multiplier },
      { autoCommit: false }
    );

    await connection.execute(
      `UPDATE user_profiles SET experience = :newExp, "level" = :newLevel, updated_at = SYSTIMESTAMP WHERE user_id = :user_id`,
      { newExp, newLevel, user_id }, { autoCommit: false }
    );

    let levelUpBadge = null;
    let autoBadges = [];
    if (newLevel > oldLevel) {
      const badgeResult = await connection.execute(
        `SELECT level_badge FROM level_requirements WHERE level_num = :newLevel`,
        { newLevel }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (badgeResult.rows.length > 0 && badgeResult.rows[0].LEVEL_BADGE) {
        // grantUserBadge 함수가 connection을 받도록 수정 필요
        // levelUpBadge = await grantUserBadge(connection, user_id, "achievement", badgeResult.rows[0].LEVEL_BADGE, `레벨 ${newLevel} 달성`);
      }
      // checkAndGrantBadges 함수가 connection을 받도록 수정 필요
      // const levelUpBadges = await checkAndGrantBadges(connection, user_id, "level_up", { newLevel });
      // autoBadges.push(...levelUpBadges);
    }
    // const expMilestoneBadges = await checkAndGrantBadges(connection, user_id, "experience_milestone", { totalExp: newExp });
    // autoBadges.push(...expMilestoneBadges);
    // commit은 withTransaction에서 처리

    return {
      success: true, // 이 응답 형식은 컨트롤러에서 표준화될 것임
      old_experience: oldExp, new_experience: newExp, points_added: actualPoints,
      multiplier_applied: multiplier, old_level: oldLevel, new_level: newLevel,
      level_up: newLevel > oldLevel, badge_earned: levelUpBadge, auto_badges: autoBadges,
    };
  } catch (err) {
    if(err.code === "USER_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}


// 회원 탈퇴 (계정 데이터 삭제) 함수
async function deleteUser(connection, user_id) {
  try {
    const result = await connection.execute(
      `DELETE FROM users WHERE user_id = :user_id`,
      { user_id: user_id },
      { autoCommit: false } // withTransaction 사용
    );

    if (result.rowsAffected === 0) {
      const error = new Error("삭제할 사용자를 찾을 수 없습니다.");
      error.code = "USER_NOT_FOUND";
      throw error;
    }
    return { message: `User ${user_id} and related data deleted successfully.` };
  } catch (err) {
    if (err.code === "USER_NOT_FOUND") throw err;
    throw handleOracleError(err);
  }
}

// 이메일 중복 체크 함수
async function checkEmailExists(connection, email) {
  try {
    const result = await connection.execute(
      `SELECT COUNT(*) AS count FROM users WHERE email = :email`,
      { email: email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows[0].COUNT > 0;
  } catch (err) {
    throw handleOracleError(err);
  }
}

// 사용자 프로필 꾸미기 설정 조회
async function getUserCustomization(connection, user_id) {
  try {
    const result = await connection.execute(
      `SELECT profile_theme, profile_border, profile_background, status_message, nickname, introduction, is_premium, premium_until
       FROM user_profiles 
       WHERE user_id = :user_id`,
      { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      // await createDefaultUserProfile(connection, user_id); // connection 전달
      // const defaultProfile = await getUserCustomization(connection, user_id); // 재귀 호출 대신 기본값 직접 반환
      // 기본 프로필이 없는 경우, USER_NOT_FOUND 또는 RESOURCE_NOT_FOUND 에러를 던지거나,
      // 빈 객체 또는 기본값을 반환할 수 있음. 여기서는 에러를 던지는 대신 기본값 반환.
      return toSnakeCaseObj({ // 기본값도 snake_case로
        profile_theme: "default", profile_border: "none", profile_background: null,
        status_message: null, nickname: null, introduction: null,
        is_premium: 0, premium_until: null, user_id: user_id // user_id 추가
      });
    }

    let customizationData = result.rows[0];
    // CLOB 필드 변환
    if(customizationData.INTRODUCTION) customizationData.INTRODUCTION = await clobToString(customizationData.INTRODUCTION);
    if(customizationData.STATUS_MESSAGE) customizationData.STATUS_MESSAGE = await clobToString(customizationData.STATUS_MESSAGE);
    // 다른 CLOB 필드가 있다면 추가

    return toSnakeCaseObj(customizationData);
  } catch (error) {
    throw handleOracleError(error);
  }
}

// 사용자 프로필 꾸미기 설정 업데이트
async function updateUserCustomization(connection, user_id, customizationData) {
  try {
    const { profile_theme, profile_border, profile_background, status_message, nickname, introduction } = customizationData;
    const bindParams = { user_id, profile_theme, profile_border, profile_background, status_message, nickname, introduction};

    // CLOB으로 바인딩해야 할 수 있는 필드 처리
    if (introduction !== undefined) bindParams.introduction = {val: introduction, type: oracledb.CLOB };
    if (status_message !== undefined) bindParams.status_message = {val: status_message, type: oracledb.CLOB };
    // profile_background도 CLOB일 수 있음

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
      bindParams, { autoCommit: false }
    );

    if (result.rowsAffected === 0) {
      const error = new Error("프로필을 찾을 수 없거나 업데이트할 수 없습니다.");
      error.code = "RESOURCE_NOT_FOUND";
      throw error;
    }
    return { success: true, message: "프로필 꾸미기 설정이 업데이트되었습니다." }; // 이 응답 형식은 컨트롤러에서 표준화
  } catch (error) {
    if (error.code === "RESOURCE_NOT_FOUND") throw error;
    throw handleOracleError(error);
  }
}

// 사용자 레벨 및 경험치 정보 조회
async function getUserLevel(connection, user_id) {
  try {
    const result = await connection.execute(
      `SELECT up.experience, up."level", up.experience_multiplier,
              lr.level_name, lr.level_description, lr.required_exp, lr.unlock_features,
              (SELECT required_exp FROM level_requirements WHERE level_num = up."level" + 1) as next_level_exp
       FROM user_profiles up
       LEFT JOIN level_requirements lr ON up."level" = lr.level_num
       WHERE up.user_id = :user_id`,
      { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      const error = new Error("사용자 레벨 정보를 찾을 수 없습니다.");
      error.code = "USER_NOT_FOUND";
      throw error;
    }

    const data = toSnakeCaseObj(result.rows[0]);
    let unlock_features = [];
    if (data.unlock_features) {
        try { unlock_features = JSON.parse(data.unlock_features); }
        catch (e) { console.warn(`[UserLevel] Failed to parse unlock_features for user ${user_id}`); }
    }

    const currentExp = data.experience || 0;
    const requiredExp = data.required_exp || 0; // 현재 레벨 달성에 필요했던 경험치
    const nextLevelExp = data.next_level_exp || (requiredExp + 100); // 다음 레벨 필요 경험치 (기본값: 현재필요경험치 + 100)

    let progress = 0;
    if (nextLevelExp > requiredExp) { // 분모가 0이 되는 것 방지
      progress = Math.max(0, Math.min(100, Math.round(((currentExp - requiredExp) / (nextLevelExp - requiredExp)) * 100)));
    } else if (currentExp >= requiredExp) { // 현재 레벨의 최대 경험치를 달성한 경우 (다음 레벨 정보가 없을 때)
        progress = 100;
    }

    return {
      experience: currentExp,
      level: data.level || 1,
      level_name: data.level_name || "새싹 오비터",
      level_description: data.level_description || "Orbitmate를 시작한 신규 사용자",
      required_exp_for_current_level: requiredExp, // 현재 레벨이 되기 위해 필요했던 총 경험치
      exp_for_next_level: nextLevelExp, // 다음 레벨이 되기 위한 총 경험치
      progress_to_next_level: progress, // %
      experience_multiplier: data.experience_multiplier || 1.0,
      unlock_features: unlock_features,
    };
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") throw error;
    throw handleOracleError(error);
  }
}


// 번역 리소스 조회
async function getTranslationResources(connection, lang_code = "ko", category = null) {
  try {
    let query = `SELECT resource_key, resource_value, category 
                 FROM translation_resources 
                 WHERE lang_code = :lang_code`;
    const params = { lang_code };
    if (category) { query += ` AND category = :category`; params.category = category; }
    query += ` ORDER BY category, resource_key`;

    const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const translations = {};
    for (const row of result.rows) {
      const key = row.RESOURCE_KEY;
      const value = await clobToString(row.RESOURCE_VALUE); // CLOB 변환
      translations[key] = value;
    }
    return translations;
  } catch (error) {
    throw handleOracleError(error);
  }
}

// 사용자 언어 설정 업데이트
async function updateUserLanguage(connection, user_id, language) {
  try {
    const result = await connection.execute(
      `UPDATE user_settings SET language = :language, updated_at = SYSTIMESTAMP WHERE user_id = :user_id`,
      { user_id, language }, { autoCommit: false }
    );
    if (result.rowsAffected === 0) {
      // 설정이 없으면 생성 (user_settings는 사용자가 처음 생성될 때 기본값이 INSERT되므로, 이 경우는 거의 없음)
      await connection.execute(
        `INSERT INTO user_settings (user_id, language, theme, font_size, notifications_enabled)
         VALUES (:user_id, :language, 'light', 14, 1)`, // 기본값 함께 설정
        { user_id, language }, { autoCommit: false }
      );
    }
    return { success: true, message: "언어 설정이 업데이트되었습니다." };
  } catch (error) {
    throw handleOracleError(error);
  }
}

// --- 뱃지 관련 함수들 ---
// grantUserBadge, checkAndGrantBadges, upgradeBadgeLevel, upgradeSubscriptionBadge,
// approveBadgeUpgrade, getUserBadges, toggleUserBadge, handleUserActivity 등은
// DB 연결(connection 인자), 에러 처리, autoCommit 제거 등을 동일한 원칙으로 수정해야 합니다.
// 분량이 많으므로 대표적인 함수 몇 개만 수정하고 나머지는 유사하게 수정한다고 가정합니다.

async function grantUserBadge(connection, user_id, badge_type, badge_name, description, icon, color) {
    // 이 함수는 checkAndGrantBadges 내부에서 호출될 것으로 예상됨.
    // 이미 뱃지가 있는지 확인하는 로직이 필요할 수 있음 (중복 지급 방지)
    try {
        const existingBadge = await connection.execute(
            `SELECT badge_id FROM user_badges WHERE user_id = :user_id AND badge_name = :badge_name`,
            {user_id, badge_name}, {outFormat: oracledb.OUT_FORMAT_OBJECT}
        );
        if(existingBadge.rows.length > 0) {
            // console.log(`[grantUserBadge] User ${user_id} already has badge ${badge_name}`);
            return null; // 이미 뱃지 보유
        }

        const result = await connection.execute(
            `INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, badge_level, earned_at, updated_at)
             VALUES (:user_id, :badge_type, :badge_name, :description, :icon, :color, 1, SYSTIMESTAMP, SYSTIMESTAMP)
             RETURNING badge_id INTO :out_badge_id`,
            { user_id, badge_type, badge_name, description, icon, color, out_badge_id: {type: oracledb.STRING, dir: oracledb.BIND_OUT}},
            { autoCommit: false}
        );
        return { badge_id: result.outBinds.out_badge_id[0], badge_name, description, icon, badge_level: 1 };
    } catch (err) {
        throw handleOracleError(err);
    }
}


async function checkAndGrantBadges(connection, user_id, action_type, metadata = {}) {
  // 이 함수는 매우 길고, 각 조건마다 grantUserBadge를 호출합니다.
  // grantUserBadge가 connection을 받도록 수정되었으므로, 여기서도 connection을 전달합니다.
  // 내부 로직은 그대로 유지하되, 에러 처리 및 DB 호출 방식을 통일합니다.
  // 모든 grantUserBadge 호출에 connection을 전달해야 합니다.
  // console.log 호출 등은 제거하거나 logger 유틸리티로 대체합니다.
  try {
    const badges = [];
    // 예시: 첫 대화 뱃지
    if (action_type === "first_chat") {
      const badge = await grantUserBadge(connection, user_id, "achievement", "첫 대화", "처음으로 AI와 대화를 나눈 기념", "💬", "#4CAF50");
      if (badge) badges.push(badge);
    }
    // ... (다른 뱃지 조건들도 유사하게 수정) ...
    return badges;
  } catch(error) {
    // console.error(`[userModel.checkAndGrantBadges] Error for user ${user_id}, action ${action_type}:`, error);
    // 여기서 에러를 throw하거나, 빈 배열을 반환할 수 있음. 일단 빈 배열 반환으로 유지.
    return [];
  }
}

async function getUserBadges(connection, user_id) {
  try {
    const result = await connection.execute(
      `SELECT badge_id, badge_type, badge_name, badge_description, badge_icon, badge_level, is_equipped, earned_at, updated_at
       FROM user_badges
       WHERE user_id = :user_id
       ORDER BY earned_at DESC`,
      { user_id }, {outFormat: oracledb.OUT_FORMAT_OBJECT}
    );
    return result.rows.map(row => toSnakeCaseObj(row));
  } catch (error) {
    throw handleOracleError(error);
  }
}

async function toggleUserBadge(connection, user_id, badge_id, is_equipped) {
  try {
    const checkResult = await connection.execute(
      `SELECT badge_id FROM user_badges WHERE user_id = :user_id AND badge_id = :badge_id`,
      { user_id, badge_id }, {outFormat: oracledb.OUT_FORMAT_OBJECT}
    );
    if (checkResult.rows.length === 0) {
      const error = new Error("뱃지를 찾을 수 없습니다.");
      error.code = "RESOURCE_NOT_FOUND";
      throw error;
    }
    await connection.execute(
      `UPDATE user_badges SET is_equipped = :is_equipped, updated_at = SYSTIMESTAMP
       WHERE user_id = :user_id AND badge_id = :badge_id`,
      { user_id, badge_id, is_equipped: is_equipped ? 1 : 0 }, { autoCommit: false }
    );
    return { success: true, message: is_equipped ? "뱃지를 착용했습니다." : "뱃지를 해제했습니다." };
  } catch (error) {
    if(error.code === "RESOURCE_NOT_FOUND") throw error;
    throw handleOracleError(error);
  }
}

// 뱃지 레벨 업그레이드 함수
async function upgradeBadgeLevel(connection, user_id, badge_name, action_reason = "") {
  try {
    const existingBadge = await connection.execute(
      `SELECT badge_id, badge_level FROM user_badges WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (existingBadge.rows.length === 0) {
      const error = new Error("업그레이드할 뱃지를 찾을 수 없습니다.");
      error.code = "RESOURCE_NOT_FOUND";
      throw error;
    }

    const currentLevel = existingBadge.rows[0].BADGE_LEVEL || 1;
    const newLevel = currentLevel + 1;
    const maxLevel = 10; // 최대 레벨 제한

    if (newLevel > maxLevel) {
      const error = new Error(`뱃지가 이미 최대 레벨(${maxLevel})에 도달했습니다.`);
      error.code = "MAX_LEVEL_REACHED";
      throw error;
    }

    await connection.execute(
      `UPDATE user_badges 
       SET badge_level = :newLevel, updated_at = SYSTIMESTAMP 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { newLevel, user_id, badge_name }, { autoCommit: false }
    );

    // 경험치 지급 (뱃지 레벨업 시)
    const expPoints = newLevel * 50; // 레벨에 비례한 경험치
    await addUserExperience(connection, user_id, expPoints, "badge_upgrade", `${badge_name} 뱃지 ${newLevel}레벨 달성`);

    return {
      success: true,
      badge_name,
      old_level: currentLevel,
      new_level: newLevel,
      experience_earned: expPoints,
      message: `${badge_name} 뱃지가 ${newLevel}레벨로 업그레이드되었습니다.`
    };
  } catch (error) {
    if (error.code === "RESOURCE_NOT_FOUND" || error.code === "MAX_LEVEL_REACHED") throw error;
    throw handleOracleError(error);
  }
}

// 구독 뱃지 업그레이드 함수
async function upgradeSubscriptionBadge(connection, user_id, tier_name, months_count = 1) {
  try {
    const badge_name = `${tier_name} 구독자`;
    const badgeTypes = {
      "코멧": { icon: "☄️", color: "#9E9E9E" },
      "플래닛": { icon: "🪐", color: "#2196F3" },
      "스타": { icon: "☀️", color: "#FF9800" },
      "갤럭시": { icon: "🌌", color: "#9C27B0" }
    };

    const badgeInfo = badgeTypes[tier_name];
    if (!badgeInfo) {
      const error = new Error("유효하지 않은 구독 등급입니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    // 기존 구독 뱃지 확인
    const existingBadge = await connection.execute(
      `SELECT badge_id, badge_level FROM user_badges 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingBadge.rows.length > 0) {
      // 기존 뱃지 레벨 업그레이드
      const currentLevel = existingBadge.rows[0].BADGE_LEVEL || 1;
      const newLevel = currentLevel + months_count;
      
      await connection.execute(
        `UPDATE user_badges 
         SET badge_level = :newLevel, updated_at = SYSTIMESTAMP 
         WHERE user_id = :user_id AND badge_name = :badge_name`,
        { newLevel, user_id, badge_name }, { autoCommit: false }
      );

      return {
        success: true,
        badge_name,
        old_level: currentLevel,
        new_level: newLevel,
        message: `${badge_name} 뱃지가 ${newLevel}레벨로 업그레이드되었습니다.`
      };
    } else {
      // 새 구독 뱃지 생성
      const newBadge = await grantUserBadge(
        connection, user_id, "premium", badge_name,
        `${tier_name} 구독 서비스 이용자`, badgeInfo.icon, badgeInfo.color
      );

      if (newBadge && months_count > 1) {
        await connection.execute(
          `UPDATE user_badges 
           SET badge_level = :level, updated_at = SYSTIMESTAMP 
           WHERE badge_id = :badge_id`,
          { level: months_count, badge_id: newBadge.badge_id }, { autoCommit: false }
        );
      }

      return {
        success: true,
        badge_name,
        new_level: months_count,
        message: `${badge_name} 뱃지를 획득했습니다!`
      };
    }
  } catch (error) {
    if (error.code === "INVALID_INPUT") throw error;
    throw handleOracleError(error);
  }
}

// 뱃지 승인 함수 (관리자용)
async function approveBadgeUpgrade(connection, user_id, badge_name, reason = "관리자 승인") {
  try {
    const existingBadge = await connection.execute(
      `SELECT badge_id, badge_level FROM user_badges 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingBadge.rows.length === 0) {
      // 뱃지가 없으면 새로 생성
      const newBadge = await grantUserBadge(
        connection, user_id, "special", badge_name,
        reason, "🏆", "#FFD700"
      );
      
      return {
        success: true,
        badge_name,
        new_badge: true,
        message: `${badge_name} 뱃지가 승인되어 지급되었습니다.`
      };
    } else {
      // 기존 뱃지 레벨 업그레이드
      const currentLevel = existingBadge.rows[0].BADGE_LEVEL || 1;
      const newLevel = currentLevel + 1;
      
      await connection.execute(
        `UPDATE user_badges 
         SET badge_level = :newLevel, updated_at = SYSTIMESTAMP 
         WHERE user_id = :user_id AND badge_name = :badge_name`,
        { newLevel, user_id, badge_name }, { autoCommit: false }
      );

      return {
        success: true,
        badge_name,
        old_level: currentLevel,
        new_level: newLevel,
        message: `${badge_name} 뱃지가 승인되어 ${newLevel}레벨로 업그레이드되었습니다.`
      };
    }
  } catch (error) {
    throw handleOracleError(error);
  }
}

// 통합 사용자 활동 처리 함수 (리팩토링된 중앙 함수)
async function handleUserActivity(connection, user_id, activity_type, activity_data = {}) {
  try {
    const { description, severity, feedback_type, test_type, details } = activity_data;
    let experience_points = 0;
    let badge_earned = null;
    let activity_message = "";

    switch (activity_type) {
      case "bug_report":
        // 버그 제보 처리
        const severityPoints = { low: 10, medium: 20, high: 30, critical: 50 };
        experience_points = severityPoints[severity] || 20;
        activity_message = `버그 제보를 해주셔서 감사합니다 (심각도: ${severity})`;
        
        // 버그 제보 뱃지 체크 및 업그레이드
        const bugBadge = await checkAndUpdateActivityBadge(
          connection, user_id, "버그 헌터", "bug_report", 
          "버그를 발견하고 제보한 사용자", "🐛", "#FF5722"
        );
        if (bugBadge) badge_earned = bugBadge;
        break;

      case "feedback_submission":
        // 피드백 제출 처리
        const feedbackPoints = { suggestion: 15, compliment: 10, complaint: 20, general: 12 };
        experience_points = feedbackPoints[feedback_type] || 12;
        activity_message = `소중한 피드백을 제출해주셔서 감사합니다 (유형: ${feedback_type})`;
        
        // 피드백 뱃지 체크 및 업그레이드
        const feedbackBadge = await checkAndUpdateActivityBadge(
          connection, user_id, "피드백 제공자", "feedback", 
          "서비스 개선을 위한 피드백을 제공한 사용자", "💬", "#4CAF50"
        );
        if (feedbackBadge) badge_earned = feedbackBadge;
        break;

      case "test_participation":
        // 테스트 참여 처리
        const testPoints = { alpha: 30, beta: 25, preview: 20 };
        experience_points = testPoints[test_type] || 25;
        activity_message = `${test_type.toUpperCase()} 테스트에 참여해주셔서 감사합니다`;
        
        // 테스터 뱃지 체크 및 업그레이드
        const testerBadge = await checkAndUpdateActivityBadge(
          connection, user_id, "베타 테스터", "testing", 
          "신기능 테스트에 참여한 사용자", "🧪", "#9C27B0"
        );
        if (testerBadge) badge_earned = testerBadge;
        break;

      default:
        const error = new Error(`지원하지 않는 활동 유형입니다: ${activity_type}`);
        error.code = "INVALID_INPUT";
        throw error;
    }

    // 경험치 지급
    if (experience_points > 0) {
      await addUserExperience(connection, user_id, experience_points, activity_type, activity_message);
    }

    return {
      success: true,
      activity_type,
      experience_earned: experience_points,
      badge_earned,
      message: activity_message
    };

  } catch (error) {
    if (error.code === "INVALID_INPUT") throw error;
    throw handleOracleError(error);
  }
}

// 활동 뱃지 체크 및 업데이트 헬퍼 함수
async function checkAndUpdateActivityBadge(connection, user_id, badge_name, activity_type, description, icon, color) {
  try {
    const existingBadge = await connection.execute(
      `SELECT badge_id, badge_level FROM user_badges 
       WHERE user_id = :user_id AND badge_name = :badge_name`,
      { user_id, badge_name }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existingBadge.rows.length === 0) {
      // 새 뱃지 생성
      return await grantUserBadge(connection, user_id, "achievement", badge_name, description, icon, color);
    } else {
      // 기존 뱃지 레벨 업그레이드 (활동 횟수에 따라)
      const currentLevel = existingBadge.rows[0].BADGE_LEVEL || 1;
      const newLevel = currentLevel + 1;
      
      await connection.execute(
        `UPDATE user_badges 
         SET badge_level = :newLevel, updated_at = SYSTIMESTAMP 
         WHERE user_id = :user_id AND badge_name = :badge_name`,
        { newLevel, user_id, badge_name }, { autoCommit: false }
      );

      return {
        badge_id: existingBadge.rows[0].BADGE_ID,
        badge_name,
        old_level: currentLevel,
        new_level: newLevel,
        upgraded: true
      };
    }
  } catch (error) {
    throw handleOracleError(error);
  }
}

// 래퍼 함수들 (하위 호환성 유지)
async function handleBugReport(connection, user_id, bug_description, severity = "medium") {
  return await handleUserActivity(connection, user_id, "bug_report", {
    description: bug_description,
    severity: severity
  });
}

async function handleFeedbackSubmission(connection, user_id, feedback_content, feedback_type = "general") {
  return await handleUserActivity(connection, user_id, "feedback_submission", {
    description: feedback_content,
    feedback_type: feedback_type
  });
}

async function handleTestParticipation(connection, user_id, test_type, test_details = "") {
  return await handleUserActivity(connection, user_id, "test_participation", {
    test_type: test_type,
    details: test_details
  });
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
  grantUserBadge,
  handleUserActivity
};
