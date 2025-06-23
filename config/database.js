const oracledb = require("oracledb");
const config = require("./index"); // 중앙 설정 파일 import

// 데이터베이스 설정 (중앙 설정 파일에서 가져옴)
const dbConfig = {
  user: config.database.user,
  password: config.database.password,
  connectString: config.database.connectString,
  poolMin: config.database.poolMin,
  poolMax: config.database.poolMax,
  poolIncrement: config.database.poolIncrement,
};

// Oracle Thick 모드 활성화 (Instant Client 경로 지정 필요)
async function initOracleClient() {
  const oracleClientLibDir = config.database.oracleClientLibDir;
  const thickModeRequired = config.database.thickModeRequired;

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
      if (thickModeRequired) {
        console.error(
          "Thick 모드가 필수로 설정되어 있으나 초기화에 실패하여 애플리케이션을 종료합니다."
        );
        process.exit(1);
      } else {
        console.warn("Thick 모드 초기화에 실패했지만, 필수가 아니므로 계속 진행합니다.");
      }
    }
  } else {
    // libDir 없이 초기화 시도
    try {
      oracledb.initOracleClient();
      console.log(
        "Oracle Thick 모드가 활성화되었습니다. (시스템 기본 경로 또는 설정 없음)"
      );
    } catch (err) {
      const message = `Oracle Client 초기화 시도 실패 (libDir 없이). Thick 모드가 필요하다면 ORACLE_CLIENT_LIB_DIR 환경 변수를 설정하세요: ${err.message}`;
      if (thickModeRequired) {
        console.error(message);
        console.error(
          "Thick 모드가 필수로 설정되어 있으나 초기화에 실패하여 애플리케이션을 종료합니다."
        );
        process.exit(1);
      } else {
        console.warn(message);
      }
    }
  }
}

// DB 연결 풀 초기화
async function initializeDbPool() {
  try {
    await oracledb.createPool(dbConfig);
    console.log("Oracle DB 연결 풀이 성공적으로 초기화되었습니다.");
  } catch (err) {
    console.error("Oracle DB 연결 풀 초기화 실패:", err);
    process.exit(1); // 풀 초기화 실패는 심각한 오류로 간주하고 종료
  }
}

// DB 연결 가져오기
async function getConnection() {
  try {
    return await oracledb.getConnection();
  } catch (err) {
    console.error("DB 연결 가져오기 실패:", err);
    throw err; // 이 에러는 호출 측에서 처리하도록 함
  }
}

module.exports = {
  initOracleClient,
  initializeDbPool,
  getConnection,
  oracledb, // oracledb 객체 자체도 export 하여 다른 곳에서 타입 등을 참조할 수 있도록 함
};
