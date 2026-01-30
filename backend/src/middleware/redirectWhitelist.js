/**
 * Redirect URL Whitelist Middleware
 * Prevents open redirect vulnerabilities in OAuth callbacks
 *
 * SECURITY:
 * - Validates redirect URLs against whitelist
 * - Prevents attackers from redirecting to malicious sites
 * - Protects against phishing and token theft
 */

/**
 * Get allowed redirect hosts from environment
 * @returns {string[]} Array of allowed hostnames
 */
function getAllowedRedirectHosts() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedHosts = process.env.ALLOWED_REDIRECT_HOSTS?.split(',') || [];

  // Always include FRONTEND_URL hostname
  try {
    const frontendHost = new URL(frontendUrl).hostname;
    if (!allowedHosts.includes(frontendHost)) {
      allowedHosts.push(frontendHost);
    }
  } catch (e) {
    console.error('❌ Invalid FRONTEND_URL:', frontendUrl);
  }

  // Development: allow localhost
  if (process.env.NODE_ENV !== 'production') {
    if (!allowedHosts.includes('localhost')) {
      allowedHosts.push('localhost');
    }
    if (!allowedHosts.includes('127.0.0.1')) {
      allowedHosts.push('127.0.0.1');
    }
  }

  return allowedHosts;
}

/**
 * Validate redirect URL against whitelist
 * @param {string} redirectUrl - URL to validate
 * @returns {boolean} True if URL is allowed
 */
export function isRedirectAllowed(redirectUrl) {
  const allowedHosts = getAllowedRedirectHosts();

  try {
    const url = new URL(redirectUrl);

    // Check hostname whitelist
    if (!allowedHosts.includes(url.hostname)) {
      console.error('❌ Redirect hostname not whitelisted:', {
        hostname: url.hostname,
        allowedHosts
      });
      return false;
    }

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      console.error('❌ Redirect must use HTTPS in production:', redirectUrl);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Invalid redirect URL:', redirectUrl, error.message);
    return false;
  }
}

/**
 * Get safe redirect URL (returns default if invalid)
 * @param {string} redirectUrl - URL to validate
 * @param {string} fallbackPath - Fallback path if URL invalid (default: /dashboard)
 * @returns {string} Safe redirect URL
 */
export function getSafeRedirectUrl(redirectUrl, fallbackPath = '/dashboard') {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!redirectUrl) {
    return `${frontendUrl}${fallbackPath}`;
  }

  // If it's a relative path, prepend frontend URL
  if (redirectUrl.startsWith('/')) {
    return `${frontendUrl}${redirectUrl}`;
  }

  // If it's an absolute URL, validate it
  if (isRedirectAllowed(redirectUrl)) {
    return redirectUrl;
  }

  // Fallback to safe default
  console.warn('⚠️ Redirect URL rejected, using fallback:', {
    attempted: redirectUrl,
    fallback: `${frontendUrl}${fallbackPath}`
  });
  return `${frontendUrl}${fallbackPath}`;
}

/**
 * Middleware: Validate redirect URL in query params
 *
 * Usage:
 *   router.get('/callback', validateRedirect('returnUrl'), async (req, res) => {
 *     const safeUrl = req.validatedRedirectUrl;
 *     res.redirect(safeUrl);
 *   });
 *
 * @param {string} paramName - Query param name (default: 'redirect')
 * @returns {Function} Express middleware
 */
export function validateRedirect(paramName = 'redirect') {
  return (req, res, next) => {
    const redirectUrl = req.query[paramName];

    if (!redirectUrl) {
      // No redirect specified, use default
      req.validatedRedirectUrl = getSafeRedirectUrl();
      return next();
    }

    const safeUrl = getSafeRedirectUrl(redirectUrl);
    req.validatedRedirectUrl = safeUrl;

    next();
  };
}

/**
 * Safe redirect helper
 * @param {object} res - Express response object
 * @param {string} url - URL to redirect to
 * @param {string} fallbackPath - Fallback if URL invalid
 */
export function safeRedirect(res, url, fallbackPath = '/dashboard') {
  const safeUrl = getSafeRedirectUrl(url, fallbackPath);
  res.redirect(safeUrl);
}
