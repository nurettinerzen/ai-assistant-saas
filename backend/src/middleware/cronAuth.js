/**
 * Cron Job Authentication Middleware
 * Protects internal cron endpoints from unauthorized access
 *
 * SECURITY:
 * - Requires X-Cron-Secret header
 * - Constant-time comparison (prevents timing attacks)
 * - Fails closed (no secret = reject all requests)
 * - Secrets NEVER in query params (URL logging)
 */

import crypto from 'crypto';

/**
 * Middleware: Require valid cron secret header
 *
 * Usage:
 *   router.post('/cleanup', requireCronSecret, async (req, res) => {...});
 *
 * Required env var: CRON_SECRET
 * Required header: X-Cron-Secret
 *
 * @returns {Function} Express middleware
 */
export function requireCronSecret(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: if secret not configured, reject all requests
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured in environment');
    return res.status(500).json({
      error: 'Server misconfiguration',
      message: 'Cron authentication not configured'
    });
  }

  // Check for secret in header
  const providedSecret = req.headers['x-cron-secret'];
  if (!providedSecret) {
    console.error('❌ Cron request missing X-Cron-Secret header', {
      path: req.path,
      ip: req.ip
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Cron-Secret header'
    });
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSecret),
      Buffer.from(cronSecret)
    );

    if (!isValid) {
      console.error('❌ Invalid cron secret provided', {
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid cron secret'
      });
    }

    // Success: continue to cron handler
    console.log(`✅ Cron auth successful: ${req.method} ${req.path}`);
    next();
  } catch (error) {
    console.error('❌ Cron auth error:', error.message, {
      path: req.path,
      ip: req.ip
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional: IP allowlist middleware (use with requireCronSecret)
 *
 * Usage:
 *   router.post('/cleanup',
 *     requireCronSecret,
 *     requireCronIP(['1.2.3.4', '5.6.7.8']),
 *     async (req, res) => {...}
 *   );
 *
 * @param {string[]} allowedIPs - Array of allowed IP addresses
 * @returns {Function} Express middleware
 */
export function requireCronIP(allowedIPs = []) {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!allowedIPs.includes(clientIP)) {
      console.error('❌ Cron request from unauthorized IP', {
        clientIP,
        path: req.path,
        allowedIPs
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'IP not whitelisted'
      });
    }

    console.log(`✅ Cron IP check passed: ${clientIP}`);
    next();
  };
}
