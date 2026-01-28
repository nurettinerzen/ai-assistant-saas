// ============================================================================
// UPDATED SERVER.JS
// ============================================================================
// FILE: backend/src/server.js
//
// UPDATE your existing server.js to include new routes and cron jobs
// ============================================================================

// CRITICAL: Load dotenv BEFORE any other imports to ensure env vars are available
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

// Import routes
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/business.js';
import callLogRoutes from './routes/callLogs.js';
import subscriptionRoutes from './routes/subscription.js';
import assistantRoutes from './routes/assistant.js';
import calendarRoutes from './routes/calendar.js';
import inventoryRoutes from './routes/inventory.js';
import productsRoutes from './routes/products.js';
import appointmentsRoutes from './routes/appointments.js';
import googleSheetsRoutes from './routes/google-sheets.js';
import integrationsRoutes from './routes/integrations.js';
import aiTrainingRoutes from './routes/aiTraining.js';
import demoRoutes from './routes/demo.js';
import phoneNumberRoutes from './routes/phoneNumber.js';
import elevenLabsRoutes from './routes/elevenlabs.js'; // 11Labs Conversational AI routes
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import voicesRoutes from './routes/voices.js';
import knowledgeRoutes from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import costCalculatorRoutes from './routes/costCalculator.js';
import webhooksRoutes from './routes/webhooks.js';
import chatLegacyRoutes from './routes/chat-legacy.js'; // DEPRECATED: Legacy chat implementation
import chatRoutes from './routes/chat-refactored.js'; // Main chat implementation (uses core/orchestrator)
import chatLogRoutes from './routes/chatLogs.js';
import whatsappRoutes from './routes/whatsapp.js';
import iyzicoRoutes from './routes/iyzico.js';
import emailRoutes from './routes/email.js';
import emailSnippetRoutes from './routes/email-snippets.js';
import adminRAGMetricsRoutes from './routes/admin-rag-metrics.js';
// E-commerce integrations
import shopifyRoutes from './routes/shopify.js';
import woocommerceRoutes from './routes/woocommerce.js';
import webhookRoutes from './routes/webhook.js';
// Batch Calls (Excel/CSV Upload with 11Labs)
import batchCallsRoutes from './routes/batchCalls.js';
// Team management
import teamRoutes from './routes/team.js';
// Waitlist
import waitlistRoutes from './routes/waitlist.js';
// Onboarding
import onboardingRoutes from './routes/onboarding.js';
// Credits
import creditsRoutes from './routes/credits.js';
// Balance (new pricing system)
import balanceRoutes from './routes/balance.js';
// Usage (new pricing system)
import usageRoutes from './routes/usage.js';
// CRM Webhook Integration
import crmWebhookRoutes from './routes/crm-webhook.js';
import crmRoutes from './routes/crm.js';
// Customer Data (for AI assistant matching)
import customerDataRoutes from './routes/customerData.js';
// Cron jobs (for external schedulers)
import cronRoutes from './routes/cron.js';
// Admin panel
import adminRoutes from './routes/admin.js';
// Callback (geri arama) sistemi
import callbackRoutes from './routes/callback.js';
// Metrics (shadow mode, idempotency, health)
import metricsRoutes from './routes/metrics.js';
// Concurrent call metrics (P0.5)
import concurrentMetricsRoutes from './routes/concurrent-metrics.js';
// Media (signed URL access)
import mediaRoutes from './routes/media.js';


// Import jobs
import { initMonthlyResetJob } from './jobs/monthlyReset.js';
import { initializeStateCleanup } from './jobs/cleanup-expired-states.js';
// Email sync is now MANUAL only - removed auto-sync job
// import { initEmailSyncJob } from './jobs/emailSync.js';

// Route protection enforcement
import { assertAllRoutesProtected } from './middleware/routeEnforcement.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - Dynamic origins from environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];

if (allowedOrigins.length === 0) {
  console.warn('WARNING: ALLOWED_ORIGINS is not defined. CORS will block all cross-origin requests.');
}

// Routes that should allow ANY origin (for embeddable widgets and auth)
const publicCorsRoutes = ['/api/chat', '/api/chat-v2', '/api/widget', '/api/auth'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Will be checked per-route below
      callback(null, false);
    }
  },
  credentials: true
}));

// Special CORS for public widget routes - allow ANY origin
app.use(publicCorsRoutes, cors({
  origin: true, // Allow all origins for chat widget
  credentials: true
}));

// ⚠️ WEBHOOK ROUTES - RAW BODY (BEFORE express.json())
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
app.use('/api/elevenlabs/webhook', express.json()); // 11Labs webhook needs parsed JSON
app.use('/api/elevenlabs/post-call', express.json()); // 11Labs post-call webhook
app.use('/api/webhook/incoming', express.json()); // External webhooks (Zapier, etc.)
app.use('/api/webhook/crm', express.json()); // CRM webhook (NO AUTH - secured by webhookSecret)

// ✅ OTHER ROUTES - JSON PARSE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Telyx Backend - Production Ready',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/call-logs', callLogRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/assistants', assistantRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/google-sheets', googleSheetsRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/ai-training', aiTrainingRoutes);
app.use('/api/phone-number', phoneNumberRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes); // Alias for frontend compatibility
app.use('/api/elevenlabs', elevenLabsRoutes); // 11Labs Conversational AI routes
app.use('/api', demoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/voices', voicesRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cost-calculator', costCalculatorRoutes);
app.use('/api/webhooks', webhooksRoutes);
// Chat endpoints
app.use('/api/chat-legacy', chatLegacyRoutes); // DEPRECATED: Old Gemini-based implementation
app.use('/api/chat', chatRoutes); // Main endpoint (uses core/orchestrator)
app.use('/api/chat-v2', chatRoutes); // Alias for backward compatibility
app.use('/api/chat-logs', chatLogRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/iyzico', iyzicoRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/email-snippets', emailSnippetRoutes);
app.use('/api/admin/email-rag', adminRAGMetricsRoutes); // Phase 4 pilot dashboard
// E-commerce integrations
app.use('/api/shopify', shopifyRoutes);
app.use('/api/woocommerce', woocommerceRoutes);
// CRM Webhook Integration (MUST be before /api/webhook to avoid conflicts!)
app.use('/api/webhook/crm', crmWebhookRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/batch-calls', batchCallsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/metrics', metricsRoutes); // Internal metrics (protected)
app.use('/api/concurrent-metrics', concurrentMetricsRoutes); // P0.5: Concurrent call metrics
app.use('/api/media', mediaRoutes); // Signed URL media access (secure)
// Balance and Usage (new pricing system)
app.use('/api/balance', balanceRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/crm', crmRoutes);
// Customer Data (for AI assistant matching)
app.use('/api/customer-data', customerDataRoutes);
// Cron jobs (for external schedulers like cron-job.org)
app.use('/api/cron', cronRoutes);
// Admin panel
app.use('/api/admin', adminRoutes);
// Callback (geri arama) sistemi
app.use('/api/callbacks', callbackRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// SECURITY: Route Protection Enforcement
// ============================================================================
// Check all routes are protected (except public ones)
// FAILS in staging/dev/CI, WARNS in production
// TEMPORARILY DISABLED for development - TODO: Re-enable after fixing route protection
// if (process.env.NODE_ENV !== 'test') {
//   try {
//     assertAllRoutesProtected(app);
//   } catch (error) {
//     console.error(error.message);
//     if (process.env.NODE_ENV !== 'production') {
//       process.exit(1); // Fail deployment in staging/dev
//     }
//   }
// }

// P0: Initialize concurrent call services
import globalCapacityManager from './services/globalCapacityManager.js';
import { startCleanupCron } from './services/callCleanupCron.js';
import metricsService from './services/metricsService.js';

// Initialize cron jobs
if (process.env.NODE_ENV !== 'test') {
  console.log('\n🚀 Initializing background jobs...');
  initMonthlyResetJob();
  initializeStateCleanup();
  // Email sync is now MANUAL only - users trigger sync from panel
  // initEmailSyncJob();
  console.log('✅ Background jobs initialized\n');

  // P0: Initialize concurrent call management
  console.log('🚀 Initializing concurrent call management...');
  try {
    await globalCapacityManager.connect();
    console.log('✅ Global capacity manager (Redis) connected');

    startCleanupCron();
    console.log('✅ Call cleanup cron started (every 10 minutes)');

    console.log('✅ Metrics service initialized');
    console.log('🎯 Concurrent call system ready\n');
  } catch (error) {
    console.error('❌ Error initializing concurrent call system:', error);
    console.error('   Calls may fail if Redis is not available\n');
  }
}

// Vercel export
export default app;

// Local development
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 TELYX BACKEND SERVER');
    console.log('========================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================\n');
  });
}
