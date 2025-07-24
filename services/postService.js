// services/postService.js
const postModel = require("../models/post");
const { withTransaction } = require("../utils/dbUtils");
const { fetchChatCompletion } = require("../utils/aiProvider");
const { oracledb } = require("../config/database");
const { clobToString } = require("../utils/dbUtils");
const config = require("../config");
const { generateTranslationPrompt } = require("../utils/systemPrompt");

/**
 * 게시물 생성 서비스
 * @param {Object} postData - 게시물 데이터
 * @returns {Promise<Object>} 생성된 게시물 정보
 */
async function createPostService(postData) {
  try {
    return await withTransaction(async (connection) => {
      const result = await postModel.createPost(connection, postData);
      return result;
    });
  } catch (error) {
    console.error('[postService] createPostService error:', error);
    throw error;
  }
}

/**
 * 게시물 목록 조회 서비스
 * @param {string} languageCode - 언어 코드
 * @param {Object} options - 페이징 옵션
 * @returns {Promise<Array>} 게시물 목록
 */
async function getPostListService(languageCode, options = {}) {
  try {
    return await withTransaction(async (connection) => {
      const posts = await postModel.getPostList(connection, languageCode, options);
      
      // 빈 배열인 경우 바로 반환
      if (!posts || posts.length === 0) {
        return [];
      }
      
      // 목록 조회에서는 번역하지 않음 (API 테러 방지)
      // 번역은 개별 게시물 조회 또는 명시적 번역 요청 시에만 수행
      
      return posts;
    });
  } catch (error) {
    console.error('[postService] getPostListService error:', error);
    throw error;
  }
}

/**
 * 게시물 상세 조회 서비스
 * @param {number} postId - 게시물 ID
 * @param {string} languageCode - 언어 코드
 * @returns {Promise<Object>} 게시물 상세 정보
 */
async function getPostDetailService(postId, languageCode) {
  return await withTransaction(async (connection) => {
    const post = await postModel.getPostDetail(connection, postId, languageCode);
    
    // 번역이 없는 경우 AI 번역 요청
    if (post.needs_translation) {
      try {
        const translationResult = await translatePostContent(post, languageCode);
        await postModel.addTranslation(connection, postId, languageCode, translationResult);
        post.translation = translationResult;
        post.needs_translation = false;
      } catch (translationError) {
        console.error(`[postService] AI 번역 실패 (post_id: ${postId}, lang: ${languageCode}):`, translationError);
        // 번역 실패 시에도 원본 데이터는 반환
      }
    }
    
    return post;
  });
}

/**
 * 게시물 수정 서비스
 * @param {number} postId - 게시물 ID
 * @param {Object} updateData - 수정 데이터
 * @returns {Promise<Object>} 수정된 게시물 정보
 */
async function updatePostService(postId, updateData) {
  return await withTransaction(async (connection) => {
    const result = await postModel.updatePost(connection, postId, updateData);
    
    // 원본 내용이 수정되었으므로 기존 번역 데이터 삭제 (원본 제외)
    await connection.execute(
      `DELETE FROM post_translations WHERE post_id = :post_id AND is_original = 0`,
      { post_id: postId },
      { autoCommit: false }
    );
    
    return result;
  });
}

/**
 * 게시물 삭제 서비스
 * @param {number} postId - 게시물 ID
 * @param {string} user_name - 사용자 이름
 * @param {string} pwd - 비밀번호
 * @returns {Promise<Object>} 삭제 결과
 */
async function deletePostService(postId, user_name, pwd) {
  return await withTransaction(async (connection) => {
    const result = await postModel.deletePost(connection, postId, user_name, pwd);
    return result;
  });
}

/**
 * 게시물 내용 AI 번역
 * @param {Object} post - 게시물 정보
 * @param {string} targetLanguage - 목표 언어
 * @returns {Promise<Object>} 번역 결과
 */
async function translatePostContent(post, targetLanguage) {
  try {
    // 원본 번역 데이터 조회
    const originalTranslation = await withTransaction(async (connection) => {
      const result = await connection.execute(
        `SELECT subject, content FROM post_translations 
         WHERE post_id = :post_id AND is_original = 1`,
        { post_id: post.post_id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      if (result.rows.length === 0) {
        const error = new Error("원본 번역 데이터를 찾을 수 없습니다.");
        error.code = "TRANSLATION_NOT_FOUND";
        throw error;
      }
      
      return {
        subject: await clobToString(result.rows[0].SUBJECT),
        content: await clobToString(result.rows[0].CONTENT)
      };
    });

    // AI 번역 시스템 프롬프트 생성
    const systemPrompt = generateTranslationPrompt(post.origin_language, targetLanguage);
    
    // 제목과 내용을 한 번에 번역 (API 호출 최적화)
    const combinedText = `Title: ${originalTranslation.subject}\n\nContent: ${originalTranslation.content}`;
    
    const translation = await fetchChatCompletion(
      config.ai.defaultProvider,
      combinedText,
      [],
      systemPrompt,
      null,
      null,
      { max_tokens: 2500 }
    );

    console.log('[translatePostContent] combined translation:', typeof translation, translation);

    // 안전한 텍스트 추출 함수
    const extractText = (response) => {
      if (typeof response === 'string') {
        return response.trim();
      }
      if (response && typeof response === 'object') {
        // 다양한 응답 구조 지원
        const text = response.content || response.text || response.message || 
                    response.response || response.output || response.result ||
                    (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) ||
                    (response.data && response.data.content) ||
                    String(response);
        return typeof text === 'string' ? text.trim() : String(text).trim();
      }
      return String(response).trim();
    };

    // 결합된 번역 결과 파싱
    const rawTranslation = extractText(translation);
    
    // 간단한 Title:, Content: 파싱
    const lines = rawTranslation.split('\n');
    let subject = '';
    let content = '';
    let isContent = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('Title:')) {
        subject = trimmed.replace('Title:', '').trim();
        isContent = false;
      } else if (trimmed.startsWith('Content:')) {
        isContent = true;
        const contentStart = trimmed.replace('Content:', '').trim();
        if (contentStart) {
          content = contentStart;
        }
      } else if (isContent) {
        content += (content ? '\n' : '') + trimmed;
      }
    }

    return {
      subject: subject || '제목 없음',
      content: content || '내용 없음',
      translation_method: 'ai'
    };

  } catch (error) {
    console.error(`[postService] 번역 오류:`, error);
    throw error;
  }
}

/**
 * 게시물 번역 서비스
 * @param {number} postId - 게시물 ID
 * @param {string} targetLanguage - 대상 언어
 * @param {boolean} forceRetranslate - 강제 재번역 여부
 * @returns {Promise<Object>} 번역 결과
 */
async function translatePostService(postId, targetLanguage, forceRetranslate = false) {
  return await withTransaction(async (connection) => {
    // 게시물 존재 여부 확인
    const postExists = await connection.execute(
      `SELECT idx FROM posts WHERE idx = :post_id`,
      { post_id: postId }
    );
    
    if (postExists.rows.length === 0) {
      const error = new Error("게시물을 찾을 수 없습니다.");
      error.code = "POST_NOT_FOUND";
      throw error;
    }

    // 기존 번역 확인
    const existingTranslation = await connection.execute(
      `SELECT subject, content, created_date FROM post_translations 
       WHERE post_id = :post_id AND language_code = :language_code`,
      { post_id: postId, language_code: targetLanguage },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 기존 번역이 있고 강제 재번역이 아닌 경우
    if (existingTranslation.rows.length > 0 && !forceRetranslate) {
      const row = existingTranslation.rows[0];
      return {
        post_id: postId,
        language_code: targetLanguage,
        subject: await clobToString(row.SUBJECT),
        content: await clobToString(row.CONTENT),
        translation_method: 'existing',
        created_date: row.CREATED_DATE?.toISOString(),
        is_new_translation: false
      };
    }

    // 게시물 상세 조회
    const post = await postModel.getPostDetail(connection, postId, targetLanguage);
    
    // AI 번역 수행
    const translationResult = await translatePostContent(post, targetLanguage);
    
    // 번역 결과 저장
    await postModel.addTranslation(connection, postId, targetLanguage, translationResult);
    
    return {
      post_id: postId,
      language_code: targetLanguage,
      subject: translationResult.subject,
      content: translationResult.content,
      translation_method: translationResult.translation_method,
      created_date: new Date().toISOString(),
      is_new_translation: true
    };
  });
}

/**
 * 게시물 번역 목록 조회 서비스
 * @param {number} postId - 게시물 ID
 * @param {boolean} includeOriginal - 원본 번역 포함 여부
 * @returns {Promise<Array>} 번역 목록
 */
async function getPostTranslationsService(postId, includeOriginal = true) {
  return await withTransaction(async (connection) => {
    // 게시물 존재 여부 및 원본 언어 확인
    const postResult = await connection.execute(
      `SELECT idx, origin_language FROM posts WHERE idx = :post_id`,
      { post_id: postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (postResult.rows.length === 0) {
      const error = new Error("게시물을 찾을 수 없습니다.");
      error.code = "POST_NOT_FOUND";
      throw error;
    }

    const originLanguage = postResult.rows[0].ORIGIN_LANGUAGE;

    // 번역 목록 조회
    let query = `SELECT language_code, subject, content, is_original, created_date 
                 FROM post_translations 
                 WHERE post_id = :post_id`;
    
    if (!includeOriginal) {
      query += ` AND is_original = 0`;
    }
    
    query += ` ORDER BY is_original DESC, created_date DESC`;

    const result = await connection.execute(
      query,
      { post_id: postId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const translations = [];
    for (const row of result.rows) {
      const translation = {
        language_code: row.LANGUAGE_CODE,
        subject: await clobToString(row.SUBJECT),
        content: await clobToString(row.CONTENT),
        is_original: row.IS_ORIGINAL === 1,
        translation_method: row.IS_ORIGINAL === 1 ? 'original' : 'ai',
        created_date: row.CREATED_DATE?.toISOString(),
        has_translation: true
      };
      translations.push(translation);
    }

    // 번역이 없는 경우 원본 언어로 표시
    if (translations.length === 0) {
      // 원본 번역 데이터가 없는 경우 posts 테이블에서 직접 조회
      const originalPost = await connection.execute(
        `SELECT p.idx, p.origin_language, p.created_date
         FROM posts p
         WHERE p.idx = :post_id`,
        { post_id: postId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (originalPost.rows.length > 0) {
        const row = originalPost.rows[0];
        translations.push({
          language_code: row.ORIGIN_LANGUAGE,
          subject: null,
          content: null,
          is_original: true,
          translation_method: 'original',
          created_date: row.CREATED_DATE?.toISOString(),
          has_translation: false
        });
      }
    }

    return {
      post_id: postId,
      origin_language: originLanguage,
      translations: translations,
      total_count: translations.length
    };
  });
}
module.exports = {
  createPostService,
  getPostListService,
  getPostDetailService,
  updatePostService,
  deletePostService,
  translatePostService,
  getPostTranslationsService,
  translatePostContent
};
