const HEADER_INJECTION_PATTERN = /[\r\n]|%0[ad]/gi;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeHeaderValue(value = '') {
  return String(value || '')
    .replace(HEADER_INJECTION_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeEmailAddress(value = '') {
  const sanitized = sanitizeHeaderValue(value).toLowerCase();
  return SIMPLE_EMAIL_PATTERN.test(sanitized) ? sanitized : null;
}

export function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default {
  sanitizeHeaderValue,
  sanitizeEmailAddress,
  escapeHtml,
};
