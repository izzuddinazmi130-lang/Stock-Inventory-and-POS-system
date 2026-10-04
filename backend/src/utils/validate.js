// Small input checks shared by the routes. Values arrive as JSON numbers or as strings (multipart forms).

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** A whole number ≥ min, e.g. stock counts and quantities. '3' and 3 pass; 2.5, -1, 'abc' fail. */
function isWholeNumber(value, min = 0) {
  if (isBlank(value) || typeof value === 'boolean') return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= min;
}

/** A money amount ≥ 0 (prices, costs). */
function isMoney(value) {
  if (isBlank(value) || typeof value === 'boolean') return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isEmail = (value) => typeof value === 'string' && value.length <= 255 && EMAIL_PATTERN.test(value.trim());

const USER_ROLES = ['admin', 'super_admin'];

module.exports = { isBlank, isWholeNumber, isMoney, isEmail, USER_ROLES };
