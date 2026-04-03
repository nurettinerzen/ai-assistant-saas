function normalizeUrl(value, fallback) {
  const candidate = String(value || fallback || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return String(fallback || '').trim().replace(/\/$/, '');
  }
}

function normalizeAppEnv(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['production', 'prod', 'live'].includes(normalized)) return 'production';
  if (['beta', 'staging', 'stage', 'preview', 'preprod'].includes(normalized)) return 'beta';
  if (normalized === 'test') return 'test';

  return 'development';
}

function inferStripeMode(secretKey) {
  const key = String(secretKey || '').trim();
  if (!key) return 'unconfigured';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

const appEnv = normalizeAppEnv(process.env.APP_ENV || process.env.NODE_ENV);
const nodeEnv = String(process.env.NODE_ENV || 'development').trim().toLowerCase();

const defaultFrontendUrl = appEnv === 'production'
  ? 'https://app.telyx.ai'
  : 'http://localhost:3000';
const defaultBackendUrl = appEnv === 'production'
  ? 'https://api.telyx.ai'
  : 'http://localhost:3001';
const defaultSiteUrl = appEnv === 'production'
  ? 'https://telyx.ai'
  : defaultFrontendUrl;

const frontendUrl = normalizeUrl(process.env.FRONTEND_URL, defaultFrontendUrl);
const backendUrl = normalizeUrl(process.env.BACKEND_URL, defaultBackendUrl);
const siteUrl = normalizeUrl(process.env.SITE_URL || process.env.FRONTEND_URL, defaultSiteUrl);
const stripeMode = inferStripeMode(process.env.STRIPE_SECRET_KEY);

const runtimeWarnings = [];

if (appEnv === 'beta' && stripeMode === 'live') {
  runtimeWarnings.push('APP_ENV=beta but STRIPE_SECRET_KEY is live. Prefer Stripe test keys and beta-specific webhook endpoints.');
}

if (appEnv === 'production' && stripeMode === 'test') {
  runtimeWarnings.push('APP_ENV=production but STRIPE_SECRET_KEY is a Stripe test key. Production checkout will not process live payments.');
}

if (appEnv !== 'development' && frontendUrl.includes('localhost')) {
  runtimeWarnings.push(`APP_ENV=${appEnv} is using a localhost FRONTEND_URL (${frontendUrl}).`);
}

if (appEnv !== 'development' && backendUrl.includes('localhost')) {
  runtimeWarnings.push(`APP_ENV=${appEnv} is using a localhost BACKEND_URL (${backendUrl}).`);
}

export const runtimeConfig = Object.freeze({
  appEnv,
  nodeEnv,
  isDevelopmentApp: appEnv === 'development',
  isBetaApp: appEnv === 'beta',
  isProductionApp: appEnv === 'production',
  frontendUrl,
  backendUrl,
  siteUrl,
  stripeMode,
  runtimeWarnings,
});

export function buildFrontendUrl(path = '/') {
  const normalizedPath = String(path || '/').trim();
  if (!normalizedPath || normalizedPath === '/') return runtimeConfig.frontendUrl;
  return `${runtimeConfig.frontendUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

export function buildBackendUrl(path = '/') {
  const normalizedPath = String(path || '/').trim();
  if (!normalizedPath || normalizedPath === '/') return runtimeConfig.backendUrl;
  return `${runtimeConfig.backendUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

export function buildSiteUrl(path = '/') {
  const normalizedPath = String(path || '/').trim();
  if (!normalizedPath || normalizedPath === '/') return runtimeConfig.siteUrl;
  return `${runtimeConfig.siteUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

export default runtimeConfig;
