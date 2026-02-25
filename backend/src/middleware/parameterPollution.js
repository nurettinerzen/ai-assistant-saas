/**
 * HTTP Parameter Pollution defense.
 * Rejects duplicate query keys unless explicitly allowlisted.
 */

const ALLOWED_DUPLICATE_QUERY_KEYS = new Set(
  (process.env.ALLOWED_DUPLICATE_QUERY_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

function extractQueryString(originalUrl = '') {
  const queryIndex = originalUrl.indexOf('?');
  if (queryIndex === -1) return '';
  return originalUrl.slice(queryIndex + 1);
}

export function preventParameterPollution(req, res, next) {
  const queryString = extractQueryString(req.originalUrl || req.url || '');
  if (!queryString) return next();

  const params = new URLSearchParams(queryString);
  const keyCounts = new Map();

  for (const [key] of params.entries()) {
    const nextCount = (keyCounts.get(key) || 0) + 1;
    keyCounts.set(key, nextCount);

    if (nextCount > 1 && !ALLOWED_DUPLICATE_QUERY_KEYS.has(key)) {
      return res.status(400).json({
        error: 'Duplicate query parameters are not allowed',
        code: 'HTTP_PARAMETER_POLLUTION_BLOCKED',
        key,
      });
    }
  }

  return next();
}

export default {
  preventParameterPollution,
};
