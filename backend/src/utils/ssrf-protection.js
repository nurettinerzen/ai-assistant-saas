/**
 * SSRF Protection Utility
 *
 * P0 SECURITY: Prevents Server-Side Request Forgery attacks
 * Blocks access to private IPs, localhost, and metadata endpoints
 *
 * CRITICAL: This must be checked BEFORE making any HTTP request with user-provided URLs
 */

import dns from 'dns';
import { promisify } from 'util';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/**
 * Private IP ranges (RFC 1918, RFC 4193, etc.)
 */
const PRIVATE_IP_RANGES = [
  /^127\./,                    // 127.0.0.0/8 (localhost)
  /^10\./,                     // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (private)
  /^192\.168\./,               // 192.168.0.0/16 (private)
  /^169\.254\./,               // 169.254.0.0/16 (link-local)
  /^::1$/,                     // IPv6 localhost (exact match)
  /^::$/,                      // IPv6 unspecified
  /^::ffff:127\./,             // IPv4-mapped IPv6 localhost
  /^fe80:/i,                   // IPv6 link-local
  /^fc00:/i,                   // IPv6 unique local
  /^fd00:/i,                   // IPv6 unique local
];

/**
 * Dangerous hostnames
 */
const DANGEROUS_HOSTNAMES = [
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',  // Google Cloud metadata
  'instance-data',              // AWS metadata (old)
];

/**
 * Check if IP address is private/internal
 * @param {string} ip - IP address to check
 * @returns {boolean} True if IP is private
 */
function isPrivateIP(ip) {
  return PRIVATE_IP_RANGES.some(range => range.test(ip));
}

/**
 * Check if hostname is dangerous
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if hostname is dangerous
 */
function isDangerousHostname(hostname) {
  const lower = hostname.toLowerCase();
  return DANGEROUS_HOSTNAMES.some(dangerous => lower === dangerous || lower.endsWith(`.${dangerous}`));
}

/**
 * Validate URL for SSRF protection
 * @param {string} url - URL to validate
 * @returns {Promise<{safe: boolean, reason?: string, resolvedIPs?: string[]}>}
 */
export async function validateUrlForSSRF(url) {
  try {
    const parsed = new URL(url);

    // 1. Protocol check - only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        safe: false,
        reason: `Protocol not allowed: ${parsed.protocol}. Only http: and https: are permitted.`
      };
    }

    // Extract hostname (strip IPv6 brackets if present)
    let hostname = parsed.hostname;
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    // 2. Hostname check - block dangerous hostnames
    if (isDangerousHostname(hostname)) {
      return {
        safe: false,
        reason: `Dangerous hostname blocked: ${hostname}`
      };
    }

    // 3. Direct IP check (if hostname is an IP)
    // IPv4 check
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (isPrivateIP(hostname)) {
        return {
          safe: false,
          reason: `Private IP address blocked: ${hostname}`
        };
      }
    }

    // IPv6 check (hostname stripped of brackets)
    if (isPrivateIP(hostname)) {
      return {
        safe: false,
        reason: `Private IPv6 address blocked: ${hostname}`
      };
    }

    // 4. DNS resolution check (prevent DNS rebinding attacks)
    // Resolve hostname to IP addresses
    let resolvedIPs = [];
    try {
      // Try IPv4 first
      const ipv4Addresses = await dnsResolve4(hostname).catch(() => []);
      resolvedIPs.push(...ipv4Addresses);

      // Try IPv6
      const ipv6Addresses = await dnsResolve6(hostname).catch(() => []);
      resolvedIPs.push(...ipv6Addresses);
    } catch (error) {
      // DNS resolution failed - likely invalid hostname
      return {
        safe: false,
        reason: `DNS resolution failed for: ${hostname}`
      };
    }

    // Check if any resolved IP is private
    const privateIPs = resolvedIPs.filter(ip => isPrivateIP(ip));
    if (privateIPs.length > 0) {
      return {
        safe: false,
        reason: `Hostname resolves to private IP: ${privateIPs[0]}`,
        resolvedIPs: privateIPs
      };
    }

    // 5. AWS metadata endpoint check (specific IP)
    if (resolvedIPs.includes('169.254.169.254')) {
      return {
        safe: false,
        reason: 'AWS metadata endpoint blocked (169.254.169.254)'
      };
    }

    // All checks passed
    return {
      safe: true,
      resolvedIPs
    };

  } catch (error) {
    return {
      safe: false,
      reason: `Invalid URL: ${error.message}`
    };
  }
}

/**
 * Log SSRF attempt (for security monitoring)
 * @param {Object} params - Attack details
 * @param {Object} req - Express request object (optional, for logging)
 */
export async function logSSRFAttempt(params, req = null) {
  const {
    url,
    reason,
    businessId,
    userId,
    timestamp
  } = params;

  console.error('🚨 [SSRF_PROTECTION] Attack attempt blocked', {
    url,
    reason,
    businessId,
    userId,
    timestamp,
    severity: 'HIGH'
  });

  // P0: Write SecurityEvent to database for Red Alert monitoring
  if (req) {
    const { logSSRFBlock } = await import('../middleware/securityEventLogger.js');
    await logSSRFBlock(req, url, businessId);
  }
}

export default {
  validateUrlForSSRF,
  logSSRFAttempt,
  isPrivateIP
};
