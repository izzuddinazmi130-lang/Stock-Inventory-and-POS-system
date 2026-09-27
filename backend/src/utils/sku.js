// backend/src/utils/sku.js
//
// Variant-specific SKU generation.
//
// Format: {BRANCHCODE}-{PRODUCT-NAME}-{VARIANT-VALUE-1}-{VARIANT-VALUE-2}...
// e.g.    KAF-SAFIRA-BLUE-M          (Safira, colour Blue, size M)
//         KAF-SAFIRA-BLUE-L          (same product, size L -> different SKU)
//         AST-LOGITECH-MX-MASTER-3S  (no variants -> just branch + product)
//
// Every distinct combination of variant values gets its own row in `products`
// and therefore its own SKU and its own QR code (QR codes are generated
// on-demand from the current `sku`, see routes/qr.js).

/**
 * Turn any string into an uppercase, hyphen-separated, SKU-safe token.
 * @param {string} str
 * @param {number} maxLen - truncate the token to this many characters
 */
function slugify(str, maxLen = 20) {
  if (!str) return '';
  let s = String(str)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (maxLen && s.length > maxLen) {
    s = s.slice(0, maxLen).replace(/-+$/, '');
  }
  return s;
}

/**
 * Build the "base" SKU (before uniqueness suffixing) for one variant combination.
 * @param {string} branchCode
 * @param {string} productName
 * @param {string[]} comboValues - ordered list of variant values, e.g. ['Blue', 'M']
 */
function buildBaseSku(branchCode, productName, comboValues = []) {
  const parts = [slugify(branchCode, 10), slugify(productName, 24)];
  comboValues.forEach(v => {
    const s = slugify(v, 16);
    if (s) parts.push(s);
  });
  return parts.filter(Boolean).join('-');
}

/**
 * Given a base SKU, find a SKU that doesn't collide with anything already in `products`.
 * Appends -2, -3, ... on collision (should only happen for genuine duplicate
 * product+variant combos).
 * @param {string} baseSku
 * @param {object} db - a pool or transaction connection with .query()
 * @param {number|null} excludeProductId - ignore this row when checking (for re-migration/edit)
 */
async function ensureUniqueSku(baseSku, db, excludeProductId = null) {
  let candidate = baseSku;
  let n = 2;
  // Safety cap so a bug can't loop forever
  for (let attempts = 0; attempts < 500; attempts++) {
    const params = excludeProductId ? [candidate, excludeProductId] : [candidate];
    const query = excludeProductId
      ? 'SELECT id FROM products WHERE sku = ? AND id != ?'
      : 'SELECT id FROM products WHERE sku = ?';
    const [rows] = await db.query(query, params);
    if (rows.length === 0) return candidate;
    candidate = `${baseSku}-${n}`;
    n++;
  }
  throw new Error(`Could not find a unique SKU based on "${baseSku}" after many attempts.`);
}

/**
 * Cartesian product of a variant matrix.
 * @param {Object.<string, string[]>} matrix - e.g. { colour: ['Blue','Red'], size: ['S','M'] }
 * @returns {Object[]} list of combo objects, e.g. [{colour:'Blue',size:'S'}, {colour:'Blue',size:'M'}, ...]
 *   Returns [{}] if the matrix has no non-empty attribute arrays.
 */
function cartesianCombos(matrix) {
  if (!matrix || typeof matrix !== 'object') return [{}];
  const keys = Object.keys(matrix).filter(k => Array.isArray(matrix[k]) && matrix[k].length > 0);
  if (keys.length === 0) return [{}];

  return keys.reduce((acc, key) => {
    // de-dupe + trim values for this attribute
    const values = [...new Set(
      matrix[key].map(v => String(v).trim()).filter(Boolean)
    )];
    if (values.length === 0) return acc;
    const next = [];
    acc.forEach(comboSoFar => {
      values.forEach(v => next.push({ ...comboSoFar, [key]: v }));
    });
    return next;
  }, [{}]);
}

/**
 * De-dupe an array of combo objects (in case the same combination was
 * entered twice across different inputs).
 */
function dedupeCombos(combos) {
  const seen = new Set();
  const out = [];
  combos.forEach(combo => {
    const key = JSON.stringify(
      Object.keys(combo).sort().map(k => [k, combo[k]])
    );
    if (!seen.has(key)) {
      seen.add(key);
      out.push(combo);
    }
  });
  return out;
}

// Stable order for turning a combo object into SKU tokens / QR labels:
// known attributes first (colour, then size, then model), then anything else
// alphabetically, so SKUs are predictable and readable.
const ATTRIBUTE_ORDER = ['colour', 'color', 'size', 'model'];

function orderedComboValues(combo) {
  const keys = Object.keys(combo);
  keys.sort((a, b) => {
    const ia = ATTRIBUTE_ORDER.indexOf(a);
    const ib = ATTRIBUTE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return keys.map(k => combo[k]);
}

module.exports = {
  slugify,
  buildBaseSku,
  ensureUniqueSku,
  cartesianCombos,
  dedupeCombos,
  orderedComboValues,
};