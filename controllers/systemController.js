// controllers/systemController.js - 시스템 관련 컨트롤러

const { standardizeApiResponse } = require("../utils/apiResponse");
const { getModelLockStatus, getAllowedModels } = require("../utils/modelValidator");

/**
 * 모델 락 상태 조회 컨트롤러
 * GET /api/system/model-lock-status
 */
async function getModelLockStatusController(req, res, next) {
  try {
    const status = getModelLockStatus();
    
    // 각 제공자별 허용 모델 목록 추가
    const detailedStatus = {
      ...status,
      allowedModelsByProvider: {
        geminiapi: getAllowedModels('geminiapi'),
        vertexai: getAllowedModels('vertexai'),
        ollama: getAllowedModels('ollama')
      }
    };

    const apiResponse = standardizeApiResponse(detailedStatus);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    console.error('[SystemController] 모델 락 상태 조회 실패:', error);
    next(error);
  }
}

/**
 * 시스템 정보 조회 컨트롤러
 * GET /api/system/info
 */
async function getSystemInfoController(req, res, next) {
  try {
    const systemInfo = {
      server: {
        name: "OrbitMate Server",
        version: "1.0.0",
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
      },
      features: {
        modelLock: getModelLockStatus().enabled,
        streaming: true,
        functionCalling: true,
        multiProvider: true
      },
      providers: {
        default: require('../config').ai.defaultProvider,
        available: ['geminiapi', 'vertexai', 'ollama']
      }
    };

    const apiResponse = standardizeApiResponse(systemInfo);
    res.status(apiResponse.statusCode).json(apiResponse.body);
  } catch (error) {
    console.error('[SystemController] 시스템 정보 조회 실패:', error);
    next(error);
  }
}

module.exports = {
  getModelLockStatusController,
  getSystemInfoController
};
