const { oracledb, getConnection } = require("../config/database"); // oracledb import 추가

/**
 * 트랜잭션을 자동으로 관리하는 헬퍼 함수
 * @param {Function} callback - 실행할 콜백 함수 (connection을 매개변수로 받음)
 * @returns {Promise<any>} 콜백 함수의 반환값
 */
async function withTransaction(callback) {
  let connection;
  try {
    connection = await getConnection();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error("Failed to close connection:", closeError);
      }
    }
  }
}

/**
 * Oracle CLOB 또는 Node.js 스트림을 문자열로 변환하는 안정적인 함수.
 * models/chat.js에서 가져와 범용적으로 사용할 수 있도록 수정.
 * @param {oracledb.Lob | ReadableStream | string | null | undefined} clob - CLOB 객체, 스트림 또는 이미 문자열.
 * @returns {Promise<string>} 변환된 문자열. 오류 발생 시 기본 메시지 반환.
 */
async function clobToString(clob) {
  if (clob === null || clob === undefined) return ""; // null 또는 undefined인 경우 빈 문자열 반환
  if (typeof clob === "string") return clob; // 이미 문자열이면 그대로 반환

  // oracledb.Lob 인스턴스 확인 (type 속성으로 더 명확히)
  const isOracleLob = clob instanceof oracledb.Lob && clob.type === oracledb.CLOB;
  // 일반 Node.js 스트림 확인 (readable 속성 및 pipe/on 메서드 존재 여부)
  const isReadableStream = typeof clob.pipe === 'function' && typeof clob.on === 'function' && clob.readable !== false;

  if (isOracleLob || isReadableStream) {
    return new Promise((resolve, reject) => {
      let str = "";
      // CLOB의 경우 UTF-8 인코딩 설정 (oracledb.Lob은 기본 UTF-8)
      if (isOracleLob && clob.setEncoding) { // setEncoding은 Node.js 스트림에 가까움, Lob은 자동
         // oracledb.Lob 인스턴스는 기본적으로 UTF-8로 처리됨
      } else if (isReadableStream && clob.setEncoding) {
        clob.setEncoding("utf8");
      }

      clob.on("data", (chunk) => {
        str += chunk;
      });
      clob.on("end", () => {
        resolve(str);
      });
      clob.on("error", (err) => {
        console.error("[dbUtils.clobToString] CLOB 스트림을 문자열로 변환 중 오류:", err);
        // Promise.all 전체 실패를 막기 위해 오류 메시지 문자열로 resolve
        resolve(`(오류: CLOB 내용을 읽지 못했습니다 - ${err.message})`);
      });

      // 스트림 상태 추가 확인 (Node.js 스트림에 더 해당)
      if (isReadableStream) {
        if (clob._readableState && clob._readableState.ended) {
          process.nextTick(() => resolve(str));
        } else if (clob.readable === false && clob._readableState && !clob._readableState.ended) {
          resolve("(오류: CLOB 스트림을 읽을 수 없는 상태입니다)");
        }
      } else if (isOracleLob && clob.iLob) { // Oracle LOB 객체의 내부 상태 확인 (주의: 내부 API 의존)
        // Oracle LOB의 경우, 스트림이 이미 끝났는지 확인하는 직접적인 public API는 제한적.
        // 보통은 'end' 이벤트를 기다리는 것이 표준적.
        // 만약 LOB이 이미 닫혔거나 데이터가 없는 경우, 'data'나 'end' 이벤트가 발생하지 않을 수 있음.
        // 이 경우 Promise는 완료되지 않을 수 있으므로 타임아웃 처리 등을 고려할 수 있으나, 여기서는 단순화.
      }
    });
  } else {
    console.warn(
      "[dbUtils.clobToString] CLOB 객체가 아니거나 인식 가능한 스트림이 아닙니다. 객체:",
      clob
    );
    return "(내용 변환 불가: 알 수 없는 CLOB 데이터 형식)";
  }
}


/**
 * DB 결과에서 모든 CLOB 필드를 문자열로 변환.
 * 이 함수는 clobToString을 내부적으로 사용하며, 객체 또는 객체 배열을 처리합니다.
 * @param {Object|Array} data - DB 결과 데이터
 * @returns {Promise<Object|Array>} CLOB이 문자열로 변환된 데이터
 */
async function convertClobFields(data) {
  if (!data) return null;

  if (Array.isArray(data))
    return Promise.all(data.map((item) => convertClobFields(item)));

  const result = { ...data };
  const promises = [];

  for (const key in result) {
    const value = result[key];

    if (
      value &&
      typeof value === "object" &&
      value.type &&
      typeof value.type === "object" &&
      (value.type.name === "DB_TYPE_CLOB" ||
        value.type.column_type_name === "CLOB")
    ) {
      promises.push(
        clobToString(value)
          .then((str) => {
            result[key] = str; // 복사된 객체의 필드 업데이트
          })
          .catch((err) => {
            throw err;
          })
      );
    }
  }

  await Promise.all(promises);
  return result;
}

function toSnakeCaseObj(obj) {
  if (Array.isArray(obj)) return obj.map(toSnakeCaseObj);
  if (obj && typeof obj === "object") {
    // Oracle DATE 객체 처리 - Date 객체를 ISO 문자열로 변환
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k
          .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
          .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, "$1_$2") // USERID → USER_ID
          .replace(/([A-Z]+)/g, (m) => m.toLowerCase()) // USER_ID → user_id
          .replace(/^_+/, "") // 앞쪽 언더스코어 제거
          .toLowerCase(),
        toSnakeCaseObj(v),
      ])
    );
  }
  return obj;
}

module.exports = {
  clobToString,
  convertClobFields,
  toSnakeCaseObj,
  withTransaction,
};
