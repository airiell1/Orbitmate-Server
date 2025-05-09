function toSnakeCaseObj(obj) {
  if (Array.isArray(obj)) return obj.map(toSnakeCaseObj);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()).replace(/^_/, '').toLowerCase(),
        toSnakeCaseObj(v)
      ])
    );
  }
  return obj;
}
module.exports = toSnakeCaseObj;