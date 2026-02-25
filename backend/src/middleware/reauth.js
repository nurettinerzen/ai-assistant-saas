/**
 * Sensitive endpoints must require recent primary authentication
 * to reduce session hijack blast radius.
 */
export function requireRecentAuth(maxAgeMinutes = 15) {
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  return (req, res, next) => {
    const now = Date.now();
    const issuedAtMs = req.auth?.issuedAt ? Number(req.auth.issuedAt) * 1000 : 0;
    const reauthAtMs = req.auth?.reauthAt ? Number(req.auth.reauthAt) : issuedAtMs;

    if (!reauthAtMs || (now - reauthAtMs) > maxAgeMs) {
      return res.status(428).json({
        error: 'Re-authentication required',
        code: 'RECENT_AUTH_REQUIRED',
        maxAgeMinutes,
      });
    }

    next();
  };
}

export default {
  requireRecentAuth,
};
