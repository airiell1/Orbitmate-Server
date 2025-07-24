// controllers/postController.js
const postService = require("../services/postService");
const { standardizeApiResponse } = require("../utils/apiResponse");
const { validateRequiredFields } = require("../utils/validation");

/**
 * 게시물 생성 컨트롤러
 */
async function createPostController(req, res, next) {
  try {
    const { user_name, subject, content, pwd, origin_language = 'ko', is_notice = false } = req.body;
    const user_ip = req.ip || req.connection.remoteAddress;

    // 필수 필드 검증
    const requiredFields = ['user_name', 'subject', 'content'];
    const validation = validateRequiredFields(req.body, requiredFields);
    if (!validation.isValid) {
      const error = new Error(validation.message);
      error.code = "INVALID_INPUT";
      throw error;
    }

    // 일반 게시물인 경우 비밀번호 필수
    if (!is_notice && !pwd) {
      const error = new Error("일반 게시물은 비밀번호가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const postData = {
      user_name,
      user_ip,
      pwd: pwd,
      origin_language,
      subject,
      content,
      is_notice: is_notice ? 1 : 0
    };

    const result = await postService.createPostService(postData);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 게시물 목록 조회 컨트롤러
 */
async function getPostListController(req, res, next) {
  try {
    const { language = 'ko', limit = 20, offset = 0 } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const result = await postService.getPostListService(language, options);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 게시물 상세 조회 컨트롤러
 */
async function getPostDetailController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { language = 'ko' } = req.query;

    if (!post_id) {
      const error = new Error("게시물 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const result = await postService.getPostDetailService(parseInt(post_id), language);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 게시물 수정 컨트롤러
 */
async function updatePostController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { user_name, subject, content, pwd } = req.body;

    if (!post_id) {
      const error = new Error("게시물 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    // 필수 필드 검증
    const requiredFields = ['user_name', 'subject', 'content'];
    const validation = validateRequiredFields(req.body, requiredFields);
    if (!validation.isValid) {
      const error = new Error(validation.message);
      error.code = "INVALID_INPUT";
      throw error;
    }

    const updateData = {
      user_name,
      subject,
      content,
      pwd: pwd
    };

    const result = await postService.updatePostService(parseInt(post_id), updateData);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 게시물 삭제 컨트롤러
 */
async function deletePostController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { user_name, pwd } = req.body;

    if (!post_id) {
      const error = new Error("게시물 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    if (!user_name) {
      const error = new Error("사용자 이름이 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const result = await postService.deletePostService(parseInt(post_id), user_name, pwd);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 게시물 번역 요청 컨트롤러
 */
async function translatePostController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { target_language, force_retranslate = false } = req.body;

    if (!post_id) {
      const error = new Error("게시물 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    if (!target_language) {
      const error = new Error("번역할 언어가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    // target_language는 사용자가 입력한 값을 그대로 AI에게 전달
    // 언어 검증 제거 - AI가 알아서 판단하도록 위임 (만우절 특별 언어도 가능 🎉)

    const result = await postService.translatePostService(parseInt(post_id), target_language, force_retranslate);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

/**
 * 게시물 번역 목록 조회 컨트롤러
 */
async function getPostTranslationsController(req, res, next) {
  try {
    const { post_id } = req.params;
    const { include_original = 'true' } = req.query;

    if (!post_id) {
      const error = new Error("게시물 ID가 필요합니다.");
      error.code = "INVALID_INPUT";
      throw error;
    }

    const includeOriginal = include_original === 'true';
    const result = await postService.getPostTranslationsService(parseInt(post_id), includeOriginal);
    const apiResponse = standardizeApiResponse(result);
    res.status(apiResponse.statusCode).json(apiResponse.body);

  } catch (error) {
    next(error);
  }
}

module.exports = {
  createPostController,
  getPostListController,
  getPostDetailController,
  updatePostController,
  deletePostController,
  translatePostController,
  getPostTranslationsController
};
