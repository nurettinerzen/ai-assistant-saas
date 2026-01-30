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
  '/api/register',
  '/api/signup',
  '/api/login',
  '/api/verify-email',
  '/api/google',
  '/api/google/code',
  '/api/microsoft/callback',
  '/api/forgot-password',
  '/api/reset-password',

  // Webhooks (secured by signature verification, not JWT)
  '/api/subscription/webhook',
  '/api/elevenlabs/webhook',
  '/api/elevenlabs/post-call',
  '/api/elevenlabs/call-started',
  '/api/elevenlabs/call-ended',
  '/api/webhook/incoming',
  '/api/webhook/crm',
  '/api/webhooks/send',
  '/api/webhooks/*',
  '/api/webhook/*',
  '/api/iyzico-webhook',
  '/api/iyzico-payment-callback',
  '/api/iyzico-subscription-callback',
  '/api/iyzico-callback',
  '/api/stripe',
  '/api/whatsapp/webhook',
  '/api/whatsapp/conversations',
  '/api/whatsapp/conversations/:businessId/:phoneNumber',

  // Public widget/embed endpoints (no JWT, uses embedKey)
  '/api/chat', // Public chat widget
  '/api/chat-legacy',
  '/api/widget',
  '/api/widget/*',
  '/api/embed/:embedKey',

  // Demo endpoints (public)
  '/api/demo/*',
  '/api/demo-request',

  // Public integrations callbacks (OAuth, no JWT)
  '/api/google/callback',
  '/api/integrations/google-calendar/callback',
  '/api/integrations/hubspot/callback',
  '/api/google-sheets/callback',
  '/api/email/gmail/callback',
  '/api/email/outlook/callback',
  '/api/auth/microsoft/callback',
  '/api/integrations/shopify/callback',
  '/api/integrations/ideasoft/callback',

  // Public invitation endpoints
  '/api/team/invitation/:token',
  '/api/team/invitation/:token/accept',
  '/api/invitation/:token',
  '/api/invitation/:token/accept',

  // Waitlist (public)
  '/api/waitlist',
  '/api/waitlist/check/:email',

  // Cron jobs (secured by cron-secret header, not JWT)
  '/api/cron/*',

  // Public pricing/plans info
  '/api/subscription/plans',
  '/api/cost-calculator/pricing',

  // Media access (secured by signed token, not JWT)
  '/api/media/signed/:token',

  // CRM webhook (secured by webhookSecret, not JWT)
  '/api/webhook/crm/:businessId/:webhookSecret',
  '/api/crm/:businessId/:webhookSecret',

  // Voice samples (public for demos/previews)
  '/api/voices',
  '/api/voices/:id',
  '/api/voices/language/:code',
  '/api/voices/preview/:voiceId',
  '/api/voices/sample/:voiceId',
  '/api/voices/elevenlabs/all',

  // Cost calculator (public pricing tool)
  '/api/cost-calculator/calculate',
  '/api/cost-calculator/pricing',
  '/api/cost-calculator/assistant/:assistantId',

  // Media signed URLs (secured by JWT token in URL, not session)
  '/api/media/signed-url/:assistantId',

  // Dashboard public metrics (no sensitive data)
  '/api/concurrent-metrics/dashboard',
  '/api/concurrent-metrics/shadow-mode',
  '/api/concurrent-metrics/idempotency',
  '/api/concurrent-metrics/prometheus',

  // Cron endpoints (secured by cron-secret header)
  '/api/cron/reset-minutes',
  '/api/cron/low-balance',
  '/api/cron/auto-reload',
  '/api/cron/trial-expired',
  '/api/cron/cleanup',
  '/api/cron/email-rag-backfill',
  '/api/cron/email-lock-cleanup',
  '/api/cron/email-embedding-cleanup',
  '/api/cron/status',
  '/api/cron/reset-state',

  // VoiceID public endpoints (demo/preview)
  '/api/voiceid',
  '/api/voiceid/:id',
  '/api/voiceid/template',
  '/api/voiceid/callback',

  // API root (health check)
  '/api/',
  '/api/status'
];

const PROTECTED_MIDDLEWARE_NAMES = [
  'authenticateToken',
  'verifyBusinessAccess',
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

  function processStack(stack, basePath = '', inheritedProtection = false) {
    // Check if this stack has router-level auth middleware (router.use(authenticateToken))
    let hasRouterLevelAuth = inheritedProtection;

    stack.forEach(layer => {
      // Check for router-level middleware (router.use)
      if (!layer.route && layer.handle && layer.handle.name) {
        const middlewareName = layer.handle.name;
        if (PROTECTED_MIDDLEWARE_NAMES.includes(middlewareName)) {
          hasRouterLevelAuth = true;
        }
      }
    });

    stack.forEach(middleware => {
      if (middleware.route) {
        // Regular route
        const path = basePath + middleware.route.path;
        const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());

        routes.push({
          path,
          methods,
          protected: hasRouterLevelAuth || hasProtectionMiddleware(middleware.route)
        });
      } else if (middleware.name === 'router' && middleware.handle?.stack) {
        // Router middleware
        const routerPath = middleware.regexp?.toString().match(/\^\\\/([^?\\]+)/)?.[1] || '';
        processStack(middleware.handle.stack, basePath + '/' + routerPath, hasRouterLevelAuth);
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
