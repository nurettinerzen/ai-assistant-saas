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


// Import jobs
import { initMonthlyResetJob } from './jobs/monthlyReset.js';

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
