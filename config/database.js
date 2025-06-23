const oracledb = require("oracledb");
require("dotenv").config();

// 데이터베이스 설정
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  poolMin: 10,
  poolMax: 10,
  poolIncrement: 0,
};

// Oracle Thick 모드 활성화 (Instant Client 경로 지정 필요)
async function initOracleClient() {
  const oracleClientLibDir = process.env.ORACLE_CLIENT_LIB_DIR;
  if (oracleClientLibDir) {
    try {
      oracledb.initOracleClient({ libDir: oracleClientLibDir });
      console.log(
        `Oracle Thick 모드가 활성화되었습니다. Client Dir: ${oracleClientLibDir}`
      );
    } catch (err) {
      console.error(
        `Oracle Client 초기화 실패 (지정된 경로: ${oracleClientLibDir}):`,
        err
      );
      console.error(
        "Thick 모드를 사용하려면 Oracle Instant Client가 필요하며, 경로 설정이 정확해야 합니다."
      );
      process.exit(1);
    }
  } else {
    // Attempt to initialize without a specific path (relies on system PATH or default behavior)
    try {
      oracledb.initOracleClient(); // Initialize without libDir
      console.log(
        "Oracle Thick 모드가 활성화되었습니다. (시스템 기본 경로 또는 설정 없음)"
      );
    } catch (err) {
      console.warn(
        "Oracle Client 초기화 시도 실패 (libDir 없이). Thick 모드가 필요하다면 ORACLE_CLIENT_LIB_DIR 환경 변수를 설정하세요:",
        err.message
      );
      // Depending on requirements, this might not be a fatal error if Thick mode is optional
      // or if thin mode is automatically used. For now, just a warning.
    }
  }
}

// DB 연결 풀 초기화
async function initializeDbPool() {
  try {
    await oracledb.createPool(dbConfig);
  } catch (err) {
    console.error("Error initializing database pool:", err);
    process.exit(1);
  }
}

// DB 연결 가져오기
async function getConnection() {
  try {
    return await oracledb.getConnection();
  } catch (err) {
    console.error("DB 연결 가져오기 실패:", err);
    throw err;
  }
}

module.exports = {
  initOracleClient,
  initializeDbPool,
  getConnection,
  oracledb,
};
