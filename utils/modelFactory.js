// utils/modelFactory.js - 모델 팩토리 유틸리티

const { getConnection } = require("../config/database");

/**
 * 제네릭 모델 함수 생성 팩토리
 * @param {Object} options - 설정 옵션
 * @returns {Function} 모델 함수
 */
function createModel(options = {}) {
  const {
    tableName,
    primaryKey = 'id',
    fields = [],
    selectFields = '*',
    returningFields = '*',
    sequenceName = null,
    autoSetTimestamps = true,
    softDelete = false,
    dateFields = ['created_at', 'updated_at'],
    requiredFields = []
  } = options;

  if (!tableName) {
    throw new Error("tableName is required for createModel");
  }

  return {
    // 기본 CRUD 함수들 생성
    findById: createFindById(tableName, primaryKey, selectFields),
    findAll: createFindAll(tableName, selectFields),
    findWhere: createFindWhere(tableName, selectFields),
    create: createCreate(tableName, fields, sequenceName, autoSetTimestamps, requiredFields, returningFields),
    update: createUpdate(tableName, primaryKey, fields, autoSetTimestamps),
    delete: createDelete(tableName, primaryKey, softDelete),
    
    // 유틸리티 함수들
    count: createCount(tableName),
    exists: createExists(tableName, primaryKey),
    
    // 메타 정보
    getTableName: () => tableName,
    getPrimaryKey: () => primaryKey,
    getFields: () => fields,
  };
}

/**
 * ID로 조회하는 함수 생성
 */
function createFindById(tableName, primaryKey, selectFields) {
  return async (connection, id) => {
    if (!id) {
      throw new Error(`${primaryKey} is required`);
    }

    const query = `SELECT ${selectFields} FROM ${tableName} WHERE ${primaryKey} = :id`;
    const result = await connection.execute(query, { id });
    
    return result.rows.length > 0 ? result.rows[0] : null;
  };
}

/**
 * 전체 조회 함수 생성
 */
function createFindAll(tableName, selectFields) {
  return async (connection, options = {}) => {
    const {
      limit = null,
      offset = 0,
      orderBy = null,
      where = null,
      whereParams = {}
    } = options;

    let query = `SELECT ${selectFields} FROM ${tableName}`;
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      query += ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }

    const result = await connection.execute(query, whereParams);
    return result.rows;
  };
}

/**
 * 조건부 조회 함수 생성
 */
function createFindWhere(tableName, selectFields) {
  return async (connection, whereClause, whereParams = {}) => {
    if (!whereClause) {
      throw new Error("Where clause is required");
    }

    const query = `SELECT ${selectFields} FROM ${tableName} WHERE ${whereClause}`;
    const result = await connection.execute(query, whereParams);
    
    return result.rows;
  };
}

/**
 * 생성 함수 생성
 */
function createCreate(tableName, fields, sequenceName, autoSetTimestamps, requiredFields, returningFields) {
  return async (connection, data) => {
    // 필수 필드 체크
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`${field} is required`);
      }
    }

    // 타임스탬프 자동 설정
    if (autoSetTimestamps) {
      data.created_at = new Date();
      data.updated_at = new Date();
    }

    // 사용할 필드들 필터링
    const filteredData = {};
    for (const field of fields) {
      if (data.hasOwnProperty(field)) {
        filteredData[field] = data[field];
      }
    }

    // ID 자동 생성 (시퀀스 사용)
    if (sequenceName && !filteredData.id) {
      const idResult = await connection.execute(`SELECT ${sequenceName}.NEXTVAL as next_id FROM dual`);
      filteredData.id = idResult.rows[0].NEXT_ID;
    }

    const fieldNames = Object.keys(filteredData);
    const fieldPlaceholders = fieldNames.map(field => `:${field}`);
    
    const query = `
      INSERT INTO ${tableName} (${fieldNames.join(', ')}) 
      VALUES (${fieldPlaceholders.join(', ')})
      ${returningFields !== '*' ? `RETURNING ${returningFields} INTO :result` : ''}
    `;

    let result;
    if (returningFields !== '*') {
      const binds = { ...filteredData, result: { dir: connection.BIND_OUT } };
      result = await connection.execute(query, binds);
      return result.outBinds.result;
    } else {
      await connection.execute(query, filteredData);
      return { id: filteredData.id, ...filteredData };
    }
  };
}

/**
 * 수정 함수 생성
 */
function createUpdate(tableName, primaryKey, fields, autoSetTimestamps) {
  return async (connection, id, data) => {
    if (!id) {
      throw new Error(`${primaryKey} is required`);
    }

    // 타임스탬프 자동 설정
    if (autoSetTimestamps) {
      data.updated_at = new Date();
    }

    // 사용할 필드들 필터링 (ID 제외)
    const filteredData = {};
    for (const field of fields) {
      if (data.hasOwnProperty(field) && field !== primaryKey) {
        filteredData[field] = data[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      throw new Error("No valid fields to update");
    }

    const setClause = Object.keys(filteredData).map(field => `${field} = :${field}`).join(', ');
    const query = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = :id`;
    
    const binds = { ...filteredData, id };
    const result = await connection.execute(query, binds);
    
    if (result.rowsAffected === 0) {
      throw new Error(`No record found with ${primaryKey}: ${id}`);
    }

    return { [primaryKey]: id, ...filteredData };
  };
}

/**
 * 삭제 함수 생성
 */
function createDelete(tableName, primaryKey, softDelete) {
  return async (connection, id) => {
    if (!id) {
      throw new Error(`${primaryKey} is required`);
    }

    let query;
    if (softDelete) {
      query = `UPDATE ${tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE ${primaryKey} = :id AND deleted_at IS NULL`;
    } else {
      query = `DELETE FROM ${tableName} WHERE ${primaryKey} = :id`;
    }

    const result = await connection.execute(query, { id });
    
    if (result.rowsAffected === 0) {
      throw new Error(`No record found with ${primaryKey}: ${id}`);
    }

    return { success: true, [primaryKey]: id };
  };
}

/**
 * 카운트 함수 생성
 */
function createCount(tableName) {
  return async (connection, whereClause = null, whereParams = {}) => {
    let query = `SELECT COUNT(*) as count FROM ${tableName}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    const result = await connection.execute(query, whereParams);
    return result.rows[0].COUNT;
  };
}

/**
 * 존재 여부 확인 함수 생성
 */
function createExists(tableName, primaryKey) {
  return async (connection, id) => {
    if (!id) {
      return false;
    }

    const query = `SELECT 1 FROM ${tableName} WHERE ${primaryKey} = :id AND ROWNUM = 1`;
    const result = await connection.execute(query, { id });
    
    return result.rows.length > 0;
  };
}

/**
 * 특화된 모델 팩토리들
 */

/**
 * 사용자 모델 팩토리
 */
function createUserModel(additionalFields = []) {
  const baseFields = [
    'id', 'username', 'email', 'password_hash', 'profile_image_path',
    'last_login_at', 'is_active', 'created_at', 'updated_at'
  ];

  return createModel({
    tableName: 'users',
    primaryKey: 'user_id',
    fields: [...baseFields, ...additionalFields],
    selectFields: 'user_id, username, email, profile_image_path, last_login_at, is_active, created_at, updated_at',
    sequenceName: 'user_seq',
    requiredFields: ['username', 'email', 'password_hash']
  });
}

/**
 * 세션 모델 팩토리
 */
function createSessionModel() {
  return createModel({
    tableName: 'chat_sessions',
    primaryKey: 'session_id',
    fields: ['session_id', 'user_id', 'title', 'category', 'is_archived', 'created_at', 'updated_at'],
    sequenceName: 'session_seq',
    requiredFields: ['user_id']
  });
}

/**
 * 메시지 모델 팩토리
 */
function createMessageModel() {
  return createModel({
    tableName: 'chat_messages',
    primaryKey: 'message_id',
    fields: ['message_id', 'session_id', 'user_id', 'sender', 'message_text', 'ai_provider', 'ai_model', 'tokens_used', 'is_edited', 'created_at', 'updated_at'],
    sequenceName: 'message_seq',
    requiredFields: ['session_id', 'user_id', 'sender', 'message_text']
  });
}

/**
 * 구독 모델 팩토리
 */
function createSubscriptionModel() {
  return createModel({
    tableName: 'user_subscriptions',
    primaryKey: 'subscription_id',
    fields: ['subscription_id', 'user_id', 'tier_name', 'start_date', 'end_date', 'is_active', 'auto_renewal', 'created_at', 'updated_at'],
    sequenceName: 'subscription_seq',
    requiredFields: ['user_id', 'tier_name']
  });
}

/**
 * 설정 모델 팩토리
 */
function createSettingsModel() {
  return createModel({
    tableName: 'user_settings',
    primaryKey: 'user_id',
    fields: ['user_id', 'theme', 'language', 'font_size', 'preferred_ai_provider', 'auto_save_chat', 'created_at', 'updated_at'],
    requiredFields: ['user_id'],
    autoSetTimestamps: true
  });
}

module.exports = {
  createModel,
  
  // 기본 CRUD 팩토리들
  createFindById,
  createFindAll,
  createFindWhere,
  createCreate,
  createUpdate,
  createDelete,
  createCount,
  createExists,
  
  // 특화된 모델 팩토리들
  createUserModel,
  createSessionModel,
  createMessageModel,
  createSubscriptionModel,
  createSettingsModel,
};
