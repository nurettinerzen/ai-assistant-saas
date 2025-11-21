import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth.js';
import businessRoutes from '../src/routes/business.js';
import callLogRoutes from '../src/routes/callLogs.js';
import subscriptionRoutes from '../src/routes/subscription.js';
import assistantRoutes from '../src/routes/assistant.js';
import calendarRoutes from '../src/routes/calendar.js';
import inventoryRoutes from '../src/routes/inventory.js';
import productsRoutes from '../src/routes/products.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    'https://ai-assistant-saas-frontend-a5cbuji7l.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Assistant SaaS Backend - Phase 2' });
});

app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/call-logs', callLogRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;