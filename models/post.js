// models/post.js
const { oracledb } = require("../config/database");
const { handleOracleError } = require("../utils/errorHandler");
const { clobToString } = require("../utils/dbUtils");
const bcrypt = require("bcrypt");

/**
 * 게시물 생성
 * @param {oracledb.Connection} connection - DB connection object
 * @param {Object} postData - 게시물 데이터
 * @returns {Promise<Object>} 생성된 게시물 정보
 */
async function createPost(connection, postData) {
  try {
    const { user_id, user_ip, pwd, origin_language, subject, content, is_notice = 0 } = postData;
    
    // 비밀번호 해시화 (공지사항이 아닌 경우만)
    let hashedPassword = null;
    if (pwd && !is_notice) {
      hashedPassword = await bcrypt.hash(pwd, 10);
    }

    // 게시물 생성
    const postResult = await connection.execute(
      `INSERT INTO posts (idx, user_id, user_ip, pwd, origin_language, is_notice, created_date, updated_date) 
       VALUES (posts_seq.NEXTVAL, :user_id, :user_ip, :pwd, :origin_language, :is_notice, SYSDATE, SYSDATE) 
       RETURNING idx INTO :post_id`,
      {
        user_id,
        user_ip,
        pwd: hashedPassword,
        origin_language,
        is_notice,
        post_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: false }
    );

    const postId = postResult.outBinds.post_id[0];

    // 원본 번역 데이터 생성
    await connection.execute(
      `INSERT INTO post_translations (post_id, language_code, subject, content, is_original, created_date) 
       VALUES (:post_id, :language_code, :subject, :content, 1, SYSDATE)`,
      {
        post_id: postId,
        language_code: origin_language,
        subject,
        content
      },
      { autoCommit: false }
    );

    return {
      post_id: postId,
      user_id,
      user_ip,
      origin_language,
      is_notice: is_notice === 1,
      subject,
      content,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 게시물 목록 조회 (특정 언어)
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} languageCode - 언어 코드
 * @param {Object} options - 페이징 옵션
 * @returns {Promise<Array>} 게시물 목록
 */
async function getPostList(connection, languageCode, options = {}) {
  try {
    const { limit = 20, offset = 0 } = options;
    
    console.log(`[postModel] getPostList called with languageCode: ${languageCode}, limit: ${limit}, offset: ${offset}`);
    
    // Oracle 11xe 호환: ROWNUM을 사용한 페이징
    const result = await connection.execute(
      `SELECT * FROM (
         SELECT ROWNUM rn, post_data.idx, post_data.user_id, post_data.origin_language, post_data.is_notice, 
                post_data.created_date, post_data.updated_date, post_data.subject, post_data.content, 
                post_data.has_translation, post_data.translation_method
         FROM (
           SELECT p.idx, p.user_id, p.origin_language, p.is_notice, p.created_date, p.updated_date, 
                  COALESCE(pt.subject, pt_orig.subject) as subject, 
                  COALESCE(pt.content, pt_orig.content) as content,
                  CASE WHEN pt.post_id IS NOT NULL THEN 1 ELSE 0 END as has_translation,
                  CASE WHEN pt.post_id IS NOT NULL AND pt.is_original = 0 THEN 'ai'
                       WHEN pt.post_id IS NOT NULL AND pt.is_original = 1 THEN 'original'
                       ELSE 'original' END as translation_method
           FROM posts p 
           LEFT JOIN post_translations pt ON p.idx = pt.post_id AND pt.language_code = :language_code
           LEFT JOIN post_translations pt_orig ON p.idx = pt_orig.post_id AND pt_orig.is_original = 1
           ORDER BY p.is_notice DESC, p.created_date DESC
         ) post_data
         WHERE ROWNUM <= :end_row
       ) WHERE rn > :start_row`,
      {
        language_code: languageCode,
        start_row: parseInt(offset),
        end_row: parseInt(offset) + parseInt(limit)
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log(`[postModel] getPostList query result: ${result.rows.length} rows`);

    const posts = [];
    for (const row of result.rows) {
      const post = {
        post_id: row.IDX,
        user_id: row.USER_ID,
        origin_language: row.ORIGIN_LANGUAGE,
        is_notice: row.IS_NOTICE === 1,
        created_date: row.CREATED_DATE?.toISOString(),
        updated_date: row.UPDATED_DATE?.toISOString(),
        subject: row.SUBJECT ? await clobToString(row.SUBJECT) : null,
        content: row.CONTENT ? await clobToString(row.CONTENT) : null,
        translation_method: row.TRANSLATION_METHOD, // SQL에서 계산된 값 사용
        has_translation: row.HAS_TRANSLATION === 1 // SQL에서 계산된 값 사용
      };
      posts.push(post);
    }

    return posts;
  } catch (error) {
    console.error('[postModel] getPostList error:', error);
    throw handleOracleError(error);
  }
}

/**
 * 게시물 상세 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} postId - 게시물 ID
 * @param {string} languageCode - 언어 코드
 * @returns {Promise<Object>} 게시물 상세 정보
 */
async function getPostDetail(connection, postId, languageCode) {
  try {
    // 게시물 기본 정보 조회
    const postResult = await connection.execute(
      `SELECT idx, user_id, user_ip, origin_language, is_notice, created_date, updated_date 
       FROM posts WHERE idx = :post_id`,
      { post_id: postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postResult.rows.length === 0) {
      const error = new Error("게시물을 찾을 수 없습니다.");
      error.code = "POST_NOT_FOUND";
      throw error;
    }

    const post = postResult.rows[0];

    // 해당 언어의 번역 데이터 조회
    const translationResult = await connection.execute(
      `SELECT subject, content, is_original, created_date 
       FROM post_translations 
       WHERE post_id = :post_id AND language_code = :language_code`,
      { post_id: postId, language_code: languageCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let translation = null;
    if (translationResult.rows.length > 0) {
      const row = translationResult.rows[0];
      translation = {
        subject: await clobToString(row.SUBJECT),
        content: await clobToString(row.CONTENT),
        translation_method: 'manual', // 기본값으로 설정
        is_original: row.IS_ORIGINAL === 1,
        created_date: row.CREATED_DATE?.toISOString()
      };
    }

    return {
      post_id: post.IDX,
      user_id: post.USER_ID,
      user_ip: post.USER_IP,
      origin_language: post.ORIGIN_LANGUAGE,
      is_notice: post.IS_NOTICE === 1,
      created_date: post.CREATED_DATE?.toISOString(),
      updated_date: post.UPDATED_DATE?.toISOString(),
      translation,
      needs_translation: !translation
    };
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 게시물 수정
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} postId - 게시물 ID
 * @param {Object} updateData - 수정 데이터
 * @returns {Promise<Object>} 수정된 게시물 정보
 */
async function updatePost(connection, postId, updateData) {
  try {
    const { subject, content, user_id, pwd } = updateData;
    
    // 게시물 존재 여부 및 작성자 확인
    const postResult = await connection.execute(
      `SELECT user_id, pwd, origin_language, is_notice FROM posts WHERE idx = :post_id`,
      { post_id: postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postResult.rows.length === 0) {
      const error = new Error("게시물을 찾을 수 없습니다.");
      error.code = "POST_NOT_FOUND";
      throw error;
    }

    const post = postResult.rows[0];
    
    // 권한 확인 (작성자이거나 공지사항인 경우 비밀번호 확인)
    if (post.USER_ID !== user_id && !post.IS_NOTICE) {
      const error = new Error("게시물을 수정할 권한이 없습니다.");
      error.code = "FORBIDDEN";
      throw error;
    }

    // 비밀번호 확인 (공지사항이 아닌 경우)
    if (!post.IS_NOTICE && post.PWD && pwd) {
      const isPasswordValid = await bcrypt.compare(pwd, post.PWD);
      if (!isPasswordValid) {
        const error = new Error("비밀번호가 일치하지 않습니다.");
        error.code = "INVALID_PASSWORD";
        throw error;
      }
    }

    // 게시물 업데이트 날짜 수정
    await connection.execute(
      `UPDATE posts SET updated_date = SYSDATE WHERE idx = :post_id`,
      { post_id: postId },
      { autoCommit: false }
    );

    // 원본 번역 데이터 수정
    const updateResult = await connection.execute(
      `UPDATE post_translations 
       SET subject = :subject, content = :content, created_date = SYSDATE
       WHERE post_id = :post_id AND language_code = :language_code AND is_original = 1`,
      {
        subject,
        content,
        post_id: postId,
        language_code: post.ORIGIN_LANGUAGE
      },
      { autoCommit: false }
    );

    if (updateResult.rowsAffected === 0) {
      const error = new Error("원본 번역 데이터를 찾을 수 없습니다.");
      error.code = "TRANSLATION_NOT_FOUND";
      throw error;
    }

    return {
      post_id: postId,
      subject,
      content,
      updated_date: new Date().toISOString()
    };
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 게시물 삭제
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} postId - 게시물 ID
 * @param {string} user_id - 사용자 ID
 * @param {string} pwd - 비밀번호
 * @returns {Promise<Object>} 삭제 결과
 */
async function deletePost(connection, postId, user_id, pwd) {
  try {
    // 게시물 존재 여부 및 작성자 확인
    const postResult = await connection.execute(
      `SELECT user_id, pwd, is_notice FROM posts WHERE idx = :post_id`,
      { post_id: postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (postResult.rows.length === 0) {
      const error = new Error("게시물을 찾을 수 없습니다.");
      error.code = "POST_NOT_FOUND";
      throw error;
    }

    const post = postResult.rows[0];
    
    // 권한 확인
    if (post.USER_ID !== user_id && !post.IS_NOTICE) {
      const error = new Error("게시물을 삭제할 권한이 없습니다.");
      error.code = "FORBIDDEN";
      throw error;
    }

    // 비밀번호 확인 (공지사항이 아닌 경우)
    if (!post.IS_NOTICE && post.PWD && pwd) {
      const isPasswordValid = await bcrypt.compare(pwd, post.PWD);
      if (!isPasswordValid) {
        const error = new Error("비밀번호가 일치하지 않습니다.");
        error.code = "INVALID_PASSWORD";
        throw error;
      }
    }

    // 게시물 삭제 (CASCADE로 번역 데이터도 자동 삭제)
    const deleteResult = await connection.execute(
      `DELETE FROM posts WHERE idx = :post_id`,
      { post_id: postId },
      { autoCommit: false }
    );

    return {
      post_id: postId,
      deleted: deleteResult.rowsAffected > 0
    };
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 게시물 번역 추가
 * @param {oracledb.Connection} connection - DB connection object
 * @param {number} postId - 게시물 ID
 * @param {string} languageCode - 언어 코드
 * @param {Object} translationData - 번역 데이터
 * @returns {Promise<Object>} 번역 결과
 */
async function addTranslation(connection, postId, languageCode, translationData) {
  try {
    const { subject, content, translation_method = 'ai' } = translationData;
    
    // 게시물 존재 여부 확인
    const postResult = await connection.execute(
      `SELECT idx FROM posts WHERE idx = :post_id`,
      { post_id: postId }
    );

    if (postResult.rows.length === 0) {
      const error = new Error("게시물을 찾을 수 없습니다.");
      error.code = "POST_NOT_FOUND";
      throw error;
    }

    // 번역 데이터 삽입 (UPSERT)
    const result = await connection.execute(
      `MERGE INTO post_translations pt
       USING (SELECT :post_id as post_id, :language_code as language_code FROM dual) src
       ON (pt.post_id = src.post_id AND pt.language_code = src.language_code)
       WHEN MATCHED THEN
         UPDATE SET subject = :subject, content = :content, created_date = SYSDATE
       WHEN NOT MATCHED THEN
         INSERT (post_id, language_code, subject, content, is_original, created_date)
         VALUES (:post_id, :language_code, :subject, :content, 0, SYSDATE)`,
      {
        post_id: postId,
        language_code: languageCode,
        subject,
        content
      },
      { autoCommit: false }
    );

    return {
      post_id: postId,
      language_code: languageCode,
      subject,
      content,
      translation_method: 'manual', // 기본값으로 설정
      created_date: new Date().toISOString()
    };
  } catch (error) {
    throw handleOracleError(error);
  }
}

/**
 * 번역이 필요한 게시물 조회
 * @param {oracledb.Connection} connection - DB connection object
 * @param {string} languageCode - 언어 코드
 * @returns {Promise<Array>} 번역이 필요한 게시물 목록
 */
async function getPostsNeedingTranslation(connection, languageCode) {
  try {
    const result = await connection.execute(
      `SELECT DISTINCT p.idx, p.origin_language, pt_orig.subject, pt_orig.content
       FROM posts p
       LEFT JOIN post_translations pt_orig ON p.idx = pt_orig.post_id AND pt_orig.is_original = 1
       WHERE NOT EXISTS (
         SELECT 1 FROM post_translations pt 
         WHERE pt.post_id = p.idx AND pt.language_code = :language_code
       )`,
      { language_code: languageCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const posts = [];
    for (const row of result.rows) {
      const post = {
        post_id: row.IDX,
        origin_language: row.ORIGIN_LANGUAGE,
        subject: row.SUBJECT ? await clobToString(row.SUBJECT) : null,
        content: row.CONTENT ? await clobToString(row.CONTENT) : null
      };
      posts.push(post);
    }

    return posts;
  } catch (error) {
    throw handleOracleError(error);
  }
}

module.exports = {
  createPost,
  getPostList,
  getPostDetail,
  updatePost,
  deletePost,
  addTranslation,
  getPostsNeedingTranslation
};
