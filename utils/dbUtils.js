const { oracledb } = require('../config/database');

/**
 * Oracle CLOB을 문자열로 변환
 * @param {Object} clob - Oracle CLOB 객체
 * @returns {Promise<string>} 변환된 문자열
 */
async function clobToString(clob) {
  if (!clob) return null;
  if (typeof clob === 'string') return clob;
  
  // CLOB이 아니라 일반 객체인 경우 (이미 변환됨)
  if (clob.constructor !== oracledb.CLOB) {
    if (typeof clob === 'object' && clob.type === 'CLOB') {
      // 이미 변환 시도했으나 여전히 CLOB 객체인 경우
      console.warn('CLOB 변환 실패, 객체를 문자열로 변환: ', clob);
      return JSON.stringify(clob);
    }
    return String(clob);
  }
  
  // CLOB 스트림 처리
  return new Promise((resolve, reject) => {
    let data = '';
    clob.setEncoding('utf8');
    clob.on('data', chunk => data += chunk);
    clob.on('error', err => reject(err));
    clob.on('end', () => resolve(data));
  });
}

/**
 * DB 결과에서 모든 CLOB 필드를 문자열로 변환
 * @param {Object|Array} data - DB 결과 데이터
 * @returns {Promise<Object|Array>} CLOB이 문자열로 변환된 데이터
 */
async function convertClobFields(data) {
  if (!data) return null;
  
  if (Array.isArray(data)) {
    return Promise.all(data.map(item => convertClobFields(item)));
  }
  
  const result = { ...data };
  const promises = [];
  
  for (const key in result) {
    if (result[key] && (
      result[key].constructor === oracledb.CLOB || 
      (typeof result[key] === 'object' && result[key].type === 'CLOB')
    )) {
      promises.push(
        clobToString(result[key]).then(str => {
          result[key] = str;
        })
      );
    }
  }
  
  await Promise.all(promises);
  return result;
}

module.exports = {
  clobToString,
  convertClobFields
};