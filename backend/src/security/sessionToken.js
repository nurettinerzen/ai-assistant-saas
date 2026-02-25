import jwt from 'jsonwebtoken';

export const SESSION_COOKIE_NAME = '__Host-telyx_session';
const SESSION_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

function normalizeCookieHeader(cookieHeader = '') {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValueParts] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValueParts.join('=') || '');
    return acc;
  }, {});
}

export function extractSessionToken(req) {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieMap = normalizeCookieHeader(req.headers?.cookie || '');
  return cookieMap[SESSION_COOKIE_NAME] || null;
}

export function buildSessionPayload(user, extra = {}) {
  const amr = Array.isArray(extra.amr) && extra.amr.length > 0 ? extra.amr : ['pwd'];
  return {
    userId: user.id,
    email: user.email,
    businessId: user.businessId,
    role: user.role,
    tv: Number.isInteger(user.tokenVersion) ? user.tokenVersion : 0,
    reauthAt: Date.now(),
    amr,
    ...extra,
  };
}

export function signSessionToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_EXPIRES_IN });
}

export function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  });
}

export function issueSession(res, user, extraClaims = {}) {
  const token = signSessionToken(buildSessionPayload(user, extraClaims));
  setSessionCookie(res, token);
  return token;
}

export default {
  SESSION_COOKIE_NAME,
  extractSessionToken,
  buildSessionPayload,
  signSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
  issueSession,
};
