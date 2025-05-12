const { oracledb } = require('../config/database');

/**
 * Oracle CLOB을 문자열로 변환
 * @param {Object} clob - Oracle CLOB 객체
 * @returns {Promise<string>} 변환된 문자열
 */
async function clobToString(clob) {
  if (!clob) return null;
  return new Promise((resolve, reject) => {
    let data = '';
    clob.setEncoding('utf8');
    clob.on('data', chunk => data += chunk);
    clob.on('end', () => resolve(data));
    clob.on('error', reject);
  });
}

/**
 * DB 결과에서 모든 CLOB 필드를 문자열로 변환
 * @param {Object|Array} data - DB 결과 데이터
 * @returns {Promise<Object|Array>} CLOB이 문자열로 변환된 데이터
 */
async function convertClobFields(data) {
  if (!data) return null;
  
  if (Array.isArray(data)) return Promise.all(data.map(item => convertClobFields(item)));

  const result = { ...data };
  const promises = [];

  for (const key in result) {
    const value = result[key];

    if (value && typeof value === 'object' &&
        value.type && typeof value.type === 'object' &&
        (value.type.name === 'DB_TYPE_CLOB' || value.type.column_type_name === 'CLOB')
       ) {
      
      promises.push(
        clobToString(value).then(str => {
          
          result[key] = str; // 복사된 객체의 필드 업데이트
          
        }).catch(err => {
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
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k
          .replace(/([a-z0-9])([A-Z])/g, '$1_$2') 
          .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2') // USERID → USER_ID
          .replace(/([A-Z]+)/g, m => m.toLowerCase()) // USER_ID → user_id
          .replace(/^_+/, '') // 앞쪽 언더스코어 제거
          .toLowerCase(),
        toSnakeCaseObj(v)
      ])
    );
  }
  return obj;
}

module.exports = {
  clobToString,
  convertClobFields,
  toSnakeCaseObj
};