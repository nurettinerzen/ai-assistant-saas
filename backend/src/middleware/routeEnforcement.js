/**
 * Route Protection Enforcement
 *
 * Ensures all routes (except public ones) have authentication/authorization
 * FAILS IN STAGING/CI if unprotected routes are found
 */

const PUBLIC_PATHS = [
  // Health checks
  '/health',
  '/api/health',

  // Auth endpoints (public by design)
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/google',
  '/api/auth/google/code',
  '/api/auth/microsoft/callback',

  // Webhooks (secured by signature verification, not JWT)
  '/api/subscription/webhook',
  '/api/elevenlabs/webhook',
  '/api/elevenlabs/post-call',
  '/api/webhook/incoming',
  '/api/webhook/crm',
  '/api/webhooks/*',

  // Public invitation endpoints
  '/api/team/invitation/:token',

  // Waitlist (public)
  '/api/waitlist',

  // Cron jobs (secured by cron-secret header, not JWT)
  '/api/cron/*'
];

const PROTECTED_MIDDLEWARE_NAMES = [
  'authenticateToken',
  'isAdmin',
  'checkPermission',
  'requireOwner',
  'requireManagerOrAbove',
  'checkAnyPermission',
  'checkAllPermissions'
];

/**
 * Check if a path matches public patterns
 */
function isPublicPath(path) {
  return PUBLIC_PATHS.some(publicPath => {
    if (publicPath.includes('*')) {
      const regex = new RegExp('^' + publicPath.replace('*', '.*') + '$');
      return regex.test(path);
    }
    if (publicPath.includes(':')) {
      const regex = new RegExp('^' + publicPath.replace(/:[^/]+/g, '[^/]+') + '$');
      return regex.test(path);
    }
    return path === publicPath;
  });
}

/**
 * Check if a route has protection middleware
 */
function hasProtectionMiddleware(route) {
  if (!route.stack) return false;

  return route.stack.some(layer => {
    const middlewareName = layer.handle?.name || layer.name;
    return PROTECTED_MIDDLEWARE_NAMES.includes(middlewareName);
  });
}

/**
 * Extract all routes from Express app
 */
function extractRoutes(app) {
  const routes = [];

  function processStack(stack, basePath = '') {
    stack.forEach(middleware => {
      if (middleware.route) {
        // Regular route
        const path = basePath + middleware.route.path;
        const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());

        routes.push({
          path,
          methods,
          protected: hasProtectionMiddleware(middleware.route)
        });
      } else if (middleware.name === 'router' && middleware.handle?.stack) {
        // Router middleware
        const routerPath = middleware.regexp?.toString().match(/\^\\\/([^?\\]+)/)?.[1] || '';
        processStack(middleware.handle.stack, basePath + '/' + routerPath);
      }
    });
  }

  if (app._router?.stack) {
    processStack(app._router.stack);
  }

  return routes;
}

/**
 * Assert all routes are protected (except public ones)
 * FAILS in staging/CI, WARNS in production
 */
export function assertAllRoutesProtected(app) {
  const routes = extractRoutes(app);

  const unprotected = routes.filter(route => {
    // Skip if protected
    if (route.protected) return false;

    // Skip if public path
    if (isPublicPath(route.path)) return false;

    return true;
  });

  if (unprotected.length > 0) {
    console.error('\n🚨 ============================================');
    console.error('🚨 UNPROTECTED ROUTES DETECTED');
    console.error('🚨 ============================================');
    console.error(`Found ${unprotected.length} unprotected routes:\n`);

    unprotected.forEach(route => {
      console.error(`  ❌ ${route.methods.join(',')} ${route.path}`);
    });

    console.error('\n💡 Add one of these middleware to protect:');
    console.error('  - authenticateToken');
    console.error('  - checkPermission(...)');
    console.error('  - requireOwner');
    console.error('  - isAdmin');
    console.error('🚨 ============================================\n');

    const env = process.env.NODE_ENV;

    if (env === 'production') {
      // In production: warn but don't crash
      console.error('⚠️  WARNING: Running in production with unprotected routes!');
      console.error('⚠️  This is a SECURITY RISK. Fix immediately.\n');
    } else {
      // In staging/dev/CI: FAIL
      throw new Error(`SECURITY: ${unprotected.length} unprotected routes found. Deploy blocked.`);
    }
  } else {
    console.log('✅ Route protection check: All routes are protected');
  }
}

/**
 * Express middleware version (optional, for runtime checks)
 */
export function enforceRouteProtection(req, res, next) {
  // This is more for documentation - actual enforcement is at boot time
  next();
}

export default {
  assertAllRoutesProtected,
  enforceRouteProtection,
  isPublicPath
};
