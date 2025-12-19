// ============================================================================
// UPDATED SERVER.JS
// ============================================================================
// FILE: backend/src/server.js
//
// UPDATE your existing server.js to include new routes and cron jobs
// ============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

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
import googleSheetsRoutes from './routes/googleSheets.js';
import integrationsRoutes from './routes/integrations.js';
import aiTrainingRoutes from './routes/aiTraining.js';
import demoRoutes from './routes/demo.js';
import phoneNumberRoutes from './routes/phoneNumber.js';
import vapiRoutes from './routes/vapi.js'; // Updated VAPI routes
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import voicesRoutes from './routes/voices.js';
import knowledgeRoutes from './routes/knowledge.js';
import analyticsRoutes from './routes/analytics.js';
import costCalculatorRoutes from './routes/costCalculator.js';
import webhooksRoutes from './routes/webhooks.js';
import chatRoutes from './routes/chat.js';
import whatsappRoutes from './routes/whatsapp.js';
import parasutRoutes from './routes/parasut.js';
import iyzicoRoutes from './routes/iyzico.js';
import emailRoutes from './routes/email.js';
// E-commerce integrations
import shopifyRoutes from './routes/shopify.js';
import woocommerceRoutes from './routes/woocommerce.js';
import webhookRoutes from './routes/webhook.js';
// Batch call / Collection campaigns
import batchCallRoutes from './routes/batch-call.js';
import { processAllQueues } from './services/batch-call.js';
// Team management
import teamRoutes from './routes/team.js';
// Waitlist
import waitlistRoutes from './routes/waitlist.js';
// Onboarding
import onboardingRoutes from './routes/onboarding.js';
// Credits
import creditsRoutes from './routes/credits.js';
// CRM Webhook Integration
import crmWebhookRoutes from './routes/crm-webhook.js';
import crmRoutes from './routes/crm.js';


// Import jobs
import { initMonthlyResetJob } from './jobs/monthlyReset.js';
import { initEmailSyncJob } from './jobs/emailSync.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors({
  origin: [
    'https://ai-assistant-saas-frontend-a5cbuji7l.vercel.app',
    'https://telyx.ai',
    'http://localhost:3000'
  ],
  credentials: true
}));

// ⚠️ WEBHOOK ROUTES - RAW BODY (BEFORE express.json())
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
app.use('/api/vapi/webhook', express.json()); // VAPI webhook needs parsed JSON
app.use('/api/webhook/incoming', express.json()); // External webhooks (Zapier, etc.)

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
app.use('/api/phone-number', phoneNumberRoutes); // NEW
app.use('/api/phone-numbers', phoneNumberRoutes); // Alias for frontend compatibility
app.use('/api/vapi', vapiRoutes); // Updated VAPI routes
app.use('/api', demoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/voices', voicesRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cost-calculator', costCalculatorRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/parasut', parasutRoutes);
app.use('/api/iyzico', iyzicoRoutes);
app.use('/api/email', emailRoutes);
// E-commerce integrations
app.use('/api/shopify', shopifyRoutes);
app.use('/api/woocommerce', woocommerceRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/batch-call', batchCallRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/credits', creditsRoutes);
// CRM Webhook Integration
app.use('/api/webhook/crm', crmWebhookRoutes);
app.use('/api/crm', crmRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize cron jobs
if (process.env.NODE_ENV !== 'test') {
  console.log('\n🚀 Initializing background jobs...');
  initMonthlyResetJob();
  initEmailSyncJob();

  // Batch Call Queue Worker - processes collection campaigns every 10 seconds
  setInterval(() => {
    processAllQueues().catch(err => {
      console.error('Batch call queue error:', err);
    });
  }, 10000);
  console.log('📞 Batch call queue worker started (10s interval)');
  console.log('✅ Background jobs initialized\n');
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
