function resolveCommitHash() {
  const value = process.env.COMMIT_HASH
    || process.env.GIT_COMMIT_HASH
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.RENDER_GIT_COMMIT
    || process.env.HEROKU_SLUG_COMMIT;

  if (!value) return 'unknown';
  return String(value).trim().slice(0, 12) || 'unknown';
}

function resolveVersion() {
  return process.env.APP_VERSION || process.env.npm_package_version || '2.0.0';
}

export const BUILD_INFO = Object.freeze({
  commitHash: resolveCommitHash(),
  version: resolveVersion(),
  buildTime: process.env.BUILD_TIME || new Date().toISOString()
});

export default BUILD_INFO;
