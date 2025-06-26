// utils/fileUtils.js - 파일 관련 유틸리티

const fs = require('fs').promises;
const path = require('path');
const { ERROR_CODES, FILE_UPLOAD_LIMITS } = require('./constants');

/**
 * 🗑️ 파일 안전 삭제 (에러 처리 포함)
 * @param {string} filePath - 삭제할 파일 경로
 * @param {boolean} silent - 에러 시 조용히 실패 (기본: true)
 */
async function safeDeleteFile(filePath, silent = true) {
  try {
    if (!filePath) return false;
    
    await fs.unlink(filePath);
    console.log(`[fileUtils] File deleted successfully: ${filePath}`);
    return true;
  } catch (error) {
    if (!silent) {
      console.error(`[fileUtils] Failed to delete file: ${filePath}`, error.message);
    }
    return false;
  }
}

/**
 * 🗂️ 여러 파일 일괄 삭제
 * @param {string[]} filePaths - 삭제할 파일 경로 배열
 * @param {boolean} silent - 에러 시 조용히 실패 (기본: true)
 */
async function safeDeleteMultipleFiles(filePaths, silent = true) {
  if (!Array.isArray(filePaths)) return [];
  
  const results = await Promise.allSettled(
    filePaths.map(filePath => safeDeleteFile(filePath, silent))
  );
  
  return results.map((result, index) => ({
    filePath: filePaths[index],
    success: result.status === 'fulfilled' && result.value,
    error: result.status === 'rejected' ? result.reason : null
  }));
}

/**
 * 📁 파일 존재 여부 확인
 * @param {string} filePath - 확인할 파일 경로
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 📏 파일 크기 확인
 * @param {string} filePath - 확인할 파일 경로
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new Error(`파일 크기를 확인할 수 없습니다: ${error.message}`);
  }
}

/**
 * 🔍 파일 확장자 및 MIME 타입 검증
 * @param {Object} file - Multer 파일 객체
 * @param {string[]} allowedTypes - 허용된 MIME 타입 배열
 */
function validateFileType(file, allowedTypes = FILE_UPLOAD_LIMITS.ALLOWED_TYPES) {
  if (!file || !file.mimetype) {
    const error = new Error("파일 정보가 없습니다.");
    error.code = ERROR_CODES.INVALID_INPUT;
    return error;
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
    error.code = ERROR_CODES.INVALID_FILE_TYPE;
    return error;
  }
  
  return null;
}

/**
 * 📊 구독 등급별 파일 크기 제한 확인
 * @param {Object} file - Multer 파일 객체
 * @param {string} tier - 구독 등급 (comet, planet, star, galaxy)
 */
function validateFileSizeByTier(file, tier = 'comet') {
  if (!file || !file.size) {
    const error = new Error("파일 크기 정보가 없습니다.");
    error.code = ERROR_CODES.INVALID_INPUT;
    return error;
  }
  
  const maxSize = FILE_UPLOAD_LIMITS.MAX_SIZE[tier.toUpperCase()];
  if (!maxSize) {
    const error = new Error("잘못된 구독 등급입니다.");
    error.code = ERROR_CODES.INVALID_INPUT;
    return error;
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1024 / 1024);
    const error = new Error(`파일 크기가 제한을 초과했습니다. 최대 ${maxSizeMB}MB까지 업로드 가능합니다.`);
    error.code = ERROR_CODES.FILE_TOO_LARGE;
    return error;
  }
  
  return null;
}

/**
 * 📁 디렉토리 생성 (존재하지 않을 경우)
 * @param {string} dirPath - 생성할 디렉토리 경로
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`[fileUtils] Failed to create directory: ${dirPath}`, error.message);
    throw new Error(`디렉토리 생성 실패: ${error.message}`);
  }
}

/**
 * 🔒 안전한 파일명 생성 (특수문자 제거, 중복 방지)
 * @param {string} originalName - 원본 파일명
 * @param {string} prefix - 접두사 (기본: 타임스탬프)
 */
function generateSafeFileName(originalName, prefix = null) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9가-힣\-_]/g, '_')
    .substring(0, 50); // 최대 50자
  
  const safePrefix = prefix || timestamp;
  return `${safePrefix}-${randomStr}-${baseName}${ext}`;
}

/**
 * 🧹 업로드 실패 시 임시 파일 정리
 * @param {Object|Object[]} files - Multer 파일 객체 또는 배열
 */
async function cleanupFailedUploads(files) {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : [files];
  const filePaths = fileArray
    .filter(file => file && file.path)
    .map(file => file.path);
  
  if (filePaths.length > 0) {
    console.log(`[fileUtils] Cleaning up failed uploads: ${filePaths.length} files`);
    await safeDeleteMultipleFiles(filePaths, true);
  }
}

/**
 * 🛡️ 파일 업로드 안전 처리 래퍼
 * @param {Object} uploadFunction - 업로드 처리 함수
 * @param {Object} file - 업로드된 파일 객체
 * @param {Object} validationOptions - 유효성 검사 옵션
 * @returns {Object} { success: boolean, data?: any, error?: Error, cleanup?: Function }
 */
async function safeFileUpload(uploadFunction, file, validationOptions = {}) {
  let tempFilePath = null;
  let cleanup = null;
  
  try {
    // 파일 임시 경로 저장
    tempFilePath = file?.path;
    
    // 파일 유효성 검사
    const validationResult = validateUploadedFile(file, validationOptions);
    if (validationResult.error) {
      throw validationResult.error;
    }
    
    // 정리 함수 생성
    cleanup = async () => {
      if (tempFilePath) {
        await safeDeleteFile(tempFilePath, true);
      }
    };
    
    // 업로드 함수 실행
    const result = await uploadFunction(file);
    
    return {
      success: true,
      data: result,
      cleanup
    };
    
  } catch (error) {
    // 에러 발생 시 임시 파일 자동 정리
    if (tempFilePath) {
      await safeDeleteFile(tempFilePath, true);
    }
    
    return {
      success: false,
      error,
      cleanup: null
    };
  }
}

/**
 * 🔄 업로드 트랜잭션 관리
 * @param {Function} uploadOperation - 업로드 관련 작업들
 * @param {string[]} filePaths - 관련 파일 경로들
 * @returns {Object} 트랜잭션 결과
 */
async function uploadTransaction(uploadOperation, filePaths = []) {
  const createdFiles = [];
  
  try {
    const result = await uploadOperation((filePath) => {
      createdFiles.push(filePath);
      return filePath;
    });
    
    return {
      success: true,
      data: result,
      createdFiles
    };
    
  } catch (error) {
    // 트랜잭션 실패시 생성된 모든 파일 정리
    if (createdFiles.length > 0) {
      console.log(`[fileUtils] Rolling back ${createdFiles.length} files due to upload error`);
      await safeDeleteMultipleFiles(createdFiles, true);
    }
    
    return {
      success: false,
      error,
      rolledBackFiles: createdFiles
    };
  }
}

/**
 * 📊 파일 업로드 상태 추적
 */
class FileUploadTracker {
  constructor() {
    this.uploads = new Map();
  }
  
  track(uploadId, filePath, metadata = {}) {
    this.uploads.set(uploadId, {
      filePath,
      metadata,
      startTime: Date.now(),
      status: 'uploading'
    });
  }
  
  complete(uploadId, result = {}) {
    const upload = this.uploads.get(uploadId);
    if (upload) {
      upload.status = 'completed';
      upload.endTime = Date.now();
      upload.result = result;
    }
  }
  
  fail(uploadId, error) {
    const upload = this.uploads.get(uploadId);
    if (upload) {
      upload.status = 'failed';
      upload.endTime = Date.now();
      upload.error = error;
      
      // 실패한 파일 자동 정리
      if (upload.filePath) {
        safeDeleteFile(upload.filePath, true);
      }
    }
  }
  
  cleanup(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (upload && upload.filePath) {
      safeDeleteFile(upload.filePath, true);
    }
    this.uploads.delete(uploadId);
  }
  
  getStatus(uploadId) {
    return this.uploads.get(uploadId);
  }
  
  // 오래된 업로드 추적 정보 정리 (메모리 누수 방지)
  cleanupOldEntries(maxAgeMs = 24 * 60 * 60 * 1000) { // 24시간
    const now = Date.now();
    for (const [uploadId, upload] of this.uploads.entries()) {
      if (upload.endTime && (now - upload.endTime) > maxAgeMs) {
        this.uploads.delete(uploadId);
      }
    }
  }
}

// 전역 파일 업로드 추적기
const globalUploadTracker = new FileUploadTracker();

// 주기적으로 오래된 추적 정보 정리 (10분마다)
setInterval(() => {
  globalUploadTracker.cleanupOldEntries();
}, 10 * 60 * 1000);

module.exports = {
  safeDeleteFile,
  safeDeleteMultipleFiles,
  fileExists,
  getFileSize,
  validateFileType,
  validateFileSizeByTier,
  ensureDirectoryExists,
  generateSafeFileName,
  cleanupFailedUploads,
  
  // 🛡️ 신규 파일 업로드 안전 처리 함수들
  safeFileUpload,
  uploadTransaction,
  FileUploadTracker,
  globalUploadTracker
};
