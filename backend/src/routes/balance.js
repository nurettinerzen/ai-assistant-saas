// ============================================================================
// BALANCE API ROUTES - Bakiye Yönetimi
// ============================================================================
// FILE: backend/src/routes/balance.js
//
// Endpoints:
// POST /api/balance/topup - Bakiye yükle
// GET  /api/balance - Mevcut bakiye
// GET  /api/balance/transactions - Bakiye hareketleri
// PUT  /api/balance/auto-reload - Otomatik yükleme ayarları
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import balanceService from '../services/balanceService.js';
import {
  getPricePerMinute,
  getMinTopupMinutes,
  calculateTLToMinutes
} from '../config/plans.js';

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// POST /api/balance/topup - Bakiye yükle
// ============================================================================
router.post('/topup', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { minutes } = req.body; // Dakika cinsinden yükleme miktarı

    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: 'Geçersiz dakika miktarı' });
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: { country: true }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonelik bulunamadı' });
    }

    const country = subscription.business?.country || 'TR';

    // Check minimum topup for PAYG
    if (subscription.plan === 'PAYG') {
      const minMinutes = getMinTopupMinutes(country);
      if (minutes < minMinutes) {
        return res.status(400).json({
          error: `Minimum ${minMinutes} dakika yükleme yapılabilir`,
          minMinutes
        });
      }
    }

    // Calculate amount in TL
    const pricePerMinute = getPricePerMinute(subscription.plan, country);
    const amountTL = minutes * pricePerMinute;

    // For now, we'll create a pending payment
    // In production, this would create a Stripe PaymentIntent or iyzico checkout
    // TODO: Implement actual payment processing

    // Mock: Direct topup for testing
    const result = await balanceService.topUp(
      subscription.id,
      amountTL,
      { /* payment info would go here */ },
      `${minutes} dakika bakiye yüklendi`
    );

    res.json({
      success: true,
      balance: result.balance,
      balanceMinutes: result.balanceMinutes,
      transaction: result.transaction,
      message: `${minutes} dakika (${amountTL} TL) bakiye yüklendi`
    });

  } catch (error) {
    console.error('❌ Balance topup error:', error);
    res.status(500).json({ error: error.message || 'Bakiye yükleme hatası' });
  }
});

// ============================================================================
// GET /api/balance - Mevcut bakiye
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { businessId } = req.user;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: { country: true }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonelik bulunamadı' });
    }

    const country = subscription.business?.country || 'TR';
    const plan = subscription.plan;
    const pricePerMinute = getPricePerMinute(plan, country);
    const balanceMinutes = calculateTLToMinutes(subscription.balance || 0, plan, country);

    // Get included minutes limit based on plan
    // Legacy: BASIC/PROFESSIONAL → STARTER/PRO values
    const INCLUDED_MINUTES = {
      TRIAL: 15,
      PAYG: 0,
      STARTER: 150,
      BASIC: 150,
      PRO: 500,
      PROFESSIONAL: 500,
      ENTERPRISE: 800
    };

    // Get overage rate
    const { getOverageRate } = await import('../config/plans.js');
    const overageRate = getOverageRate(plan, country);

    // Calculate trial chat days remaining
    let trialChat = null;
    if (plan === 'TRIAL' && subscription.trialChatExpiry) {
      const now = new Date();
      const expiry = new Date(subscription.trialChatExpiry);
      const daysLeft = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
      trialChat = { daysLeft, expiry: subscription.trialChatExpiry };
    }

    res.json({
      // Basic info
      plan,
      balance: subscription.balance || 0,
      balanceMinutes,
      pricePerMinute,
      currency: country === 'TR' ? '₺' : country === 'BR' ? 'R$' : '$',

      // Included minutes (for STARTER/PRO/ENTERPRISE/BASIC/PROFESSIONAL)
      includedMinutes: {
        used: subscription.includedMinutesUsed || subscription.minutesUsed || 0,
        limit: subscription.minutesLimit || INCLUDED_MINUTES[plan] || 0
      },

      // Trial info (for TRIAL plan)
      trialMinutes: plan === 'TRIAL' ? {
        used: subscription.trialMinutesUsed || 0,
        limit: 15
      } : null,
      trialChat,

      // Overage info
      overageRate,
      overage: {
        minutes: subscription.overageMinutes || 0,
        amount: (subscription.overageMinutes || 0) * overageRate
      },

      // Auto-reload settings
      autoReload: {
        enabled: subscription.autoReloadEnabled || false,
        threshold: subscription.autoReloadThreshold || 2,
        amount: subscription.autoReloadAmount || 5
      },

      // Period info
      periodEnd: subscription.currentPeriodEnd
    });

  } catch (error) {
    console.error('❌ Get balance error:', error);
    res.status(500).json({ error: error.message || 'Bakiye bilgisi alınamadı' });
  }
});

// ============================================================================
// GET /api/balance/transactions - Bakiye hareketleri
// ============================================================================
router.get('/transactions', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { limit = 20, offset = 0, type } = req.query;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonelik bulunamadı' });
    }

    const result = await balanceService.getTransactions(subscription.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      type: type || null
    });

    res.json({
      transactions: result.transactions,
      total: result.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.status(500).json({ error: error.message || 'İşlem geçmişi alınamadı' });
  }
});

// ============================================================================
// PUT /api/balance/auto-reload - Otomatik yükleme ayarları
// ============================================================================
router.put('/auto-reload', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { enabled, threshold, amount } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled alanı gerekli (true/false)' });
    }

    if (enabled) {
      if (!threshold || threshold < 1) {
        return res.status(400).json({ error: 'Eşik değeri en az 1 dakika olmalı' });
      }
      if (!amount || amount < 1) {
        return res.status(400).json({ error: 'Yükleme miktarı en az 1 dakika olmalı' });
      }
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonelik bulunamadı' });
    }

    const updated = await balanceService.updateAutoReloadSettings(subscription.id, {
      enabled,
      threshold: threshold || 2,
      amount: amount || 5
    });

    res.json({
      success: true,
      autoReload: {
        enabled: updated.autoReloadEnabled,
        threshold: updated.autoReloadThreshold,
        amount: updated.autoReloadAmount
      },
      message: enabled ? 'Otomatik yükleme aktif edildi' : 'Otomatik yükleme kapatıldı'
    });

  } catch (error) {
    console.error('❌ Update auto-reload error:', error);
    res.status(500).json({ error: error.message || 'Otomatik yükleme ayarları güncellenemedi' });
  }
});

// ============================================================================
// POST /api/balance/create-checkout - Ödeme oturumu oluştur
// ============================================================================
router.post('/create-checkout', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { minutes, paymentProvider = 'stripe' } = req.body;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: 'Geçersiz dakika miktarı' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: { country: true, name: true }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonelik bulunamadı' });
    }

    const country = subscription.business?.country || 'TR';

    // Check minimum topup for PAYG
    if (subscription.plan === 'PAYG') {
      const minMinutes = getMinTopupMinutes(country);
      if (minutes < minMinutes) {
        return res.status(400).json({
          error: `Minimum ${minMinutes} dakika yükleme yapılabilir`,
          minMinutes
        });
      }
    }

    // Calculate amount
    const pricePerMinute = getPricePerMinute(subscription.plan, country);
    const amountTL = minutes * pricePerMinute;

    // Create payment session based on provider
    if (paymentProvider === 'stripe') {
      // TODO: Implement Stripe checkout session
      // const stripe = (await import('../services/stripe.js')).default;
      // const session = await stripe.createCheckoutSession({...});
      // return res.json({ sessionUrl: session.url });

      return res.status(501).json({ error: 'Stripe ödeme henüz aktif değil' });
    }

    if (paymentProvider === 'iyzico') {
      // TODO: Implement iyzico checkout form
      // const iyzico = (await import('../services/iyzicoSubscription.js')).default;
      // const checkoutForm = await iyzico.createCheckoutForm({...});
      // return res.json({ checkoutFormContent: checkoutForm.content });

      return res.status(501).json({ error: 'iyzico ödeme henüz aktif değil' });
    }

    return res.status(400).json({ error: 'Geçersiz ödeme sağlayıcısı' });

  } catch (error) {
    console.error('❌ Create checkout error:', error);
    res.status(500).json({ error: error.message || 'Ödeme oturumu oluşturulamadı' });
  }
});

export default router;
