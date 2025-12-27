// ============================================================================
// CREDITS API - KREDİ SATIN ALMA VE BAKIYE YÖNETİMİ
// ============================================================================
// FILE: backend/src/routes/credits.js
//
// Handles credit purchases, balance inquiries, and purchase history
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { getCreditUnitPrice, calculateCreditPrice, getRegionalPricing, getPlanConfig } from '../config/plans.js';

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// GET /api/credits/balance - Bakiye sorgula
// ============================================================================
router.get('/balance', async (req, res) => {
  try {
    const businessId = req.businessId;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: { country: true }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Get plan config for correct minutes limit
    const country = subscription.business?.country || 'TR';
    const regionalPricing = getRegionalPricing(country);
    const planPricing = regionalPricing.plans[subscription.plan];

    // Use plan config minutes if available, otherwise fall back to DB value
    // For legacy plans (BASIC, PROFESSIONAL), use their configured values
    const configMinutesLimit = planPricing?.minutes ?? subscription.minutesLimit;

    // Calculate remaining values using config-based limit
    const packageRemaining = Math.max(0, configMinutesLimit - subscription.minutesUsed);
    const creditRemaining = Math.max(0, subscription.creditMinutes - subscription.creditMinutesUsed);

    res.json({
      package: {
        limit: configMinutesLimit,
        used: subscription.minutesUsed,
        remaining: packageRemaining,
        percentage: configMinutesLimit > 0
          ? Math.round((subscription.minutesUsed / configMinutesLimit) * 100)
          : 0
      },
      credit: {
        total: subscription.creditMinutes,
        used: subscription.creditMinutesUsed,
        remaining: creditRemaining,
        percentage: subscription.creditMinutes > 0
          ? Math.round((subscription.creditMinutesUsed / subscription.creditMinutes) * 100)
          : 0
      },
      overage: {
        minutes: subscription.overageMinutes,
        rate: subscription.overageRate,
        amount: subscription.overageMinutes * subscription.overageRate,
        limit: subscription.overageLimit,
        limitReached: subscription.overageLimitReached
      },
      warnings: {
        packageAt80: subscription.packageWarningAt80,
        creditAt80: subscription.creditWarningAt80
      },
      plan: subscription.plan,
      periodEnd: subscription.currentPeriodEnd
    });
  } catch (error) {
    console.error('❌ Get balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/credits/calculate - Fiyat hesapla
// ============================================================================
router.post('/calculate', async (req, res) => {
  try {
    const { minutes } = req.body;

    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Geçersiz dakika miktarı' });
    }

    const calculation = calculateCreditPrice(minutes);

    res.json(calculation);
  } catch (error) {
    console.error('❌ Calculate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/credits/pricing - Fiyatlandırma tablosu
// ============================================================================
router.get('/pricing', async (req, res) => {
  try {
    res.json({
      tiers: [
        { minMinutes: 1, maxMinutes: 49, unitPrice: 9.00, description: '1-49 dakika' },
        { minMinutes: 50, maxMinutes: 99, unitPrice: 8.50, description: '50-99 dakika' },
        { minMinutes: 100, maxMinutes: 249, unitPrice: 8.00, description: '100-249 dakika' },
        { minMinutes: 250, maxMinutes: null, unitPrice: 7.50, description: '250+ dakika' }
      ],
      currency: 'TRY',
      note: 'Krediler süresiz geçerlidir ve aylık sıfırlanmaz.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/credits/purchase - Kredi satın al
// ============================================================================
router.post('/purchase', async (req, res) => {
  try {
    const { minutes } = req.body;
    const businessId = req.businessId;

    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Geçersiz dakika miktarı' });
    }

    const unitPrice = getCreditUnitPrice(minutes);
    const totalAmount = minutes * unitPrice;

    // Business ve kayıtlı kart bilgisini al
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: true }
    });

    if (!business?.subscription) {
      return res.status(400).json({ error: 'Abonelik bulunamadı' });
    }

    // Kayıtlı kart kontrolü
    if (!business.subscription.iyzicoCardToken) {
      return res.status(400).json({
        error: 'Kayıtlı kart bulunamadı',
        requiresCard: true,
        message: 'Kredi satın almak için önce bir kart kaydetmeniz gerekiyor.'
      });
    }

    // CreditPurchase kaydı oluştur (PENDING)
    const purchase = await prisma.creditPurchase.create({
      data: {
        businessId,
        minutes,
        amount: totalAmount,
        unitPrice,
        status: 'PENDING'
      }
    });

    // TODO: iyzico ile ödeme al
    // const Iyzipay = (await import('iyzipay')).default;
    // const iyzipay = new Iyzipay({
    //   apiKey: process.env.IYZICO_API_KEY,
    //   secretKey: process.env.IYZICO_SECRET_KEY,
    //   uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
    // });
    //
    // const paymentResult = await new Promise((resolve, reject) => {
    //   iyzipay.threedsPayment.create({
    //     locale: Iyzipay.LOCALE.TR,
    //     conversationId: purchase.id,
    //     price: totalAmount.toFixed(2),
    //     paidPrice: totalAmount.toFixed(2),
    //     currency: Iyzipay.CURRENCY.TRY,
    //     paymentCard: {
    //       cardToken: business.subscription.iyzicoCardToken,
    //       cardUserKey: business.subscription.iyzicoCustomerId
    //     },
    //     // ... diğer parametreler
    //   }, (err, result) => {
    //     if (err) reject(err);
    //     else resolve(result);
    //   });
    // });

    // Şimdilik direkt başarılı say (iyzico entegrasyonu sonra)
    const paymentSuccess = true;

    if (paymentSuccess) {
      // Purchase güncelle
      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: {
          status: 'COMPLETED',
          paymentId: 'manual-' + Date.now()
        }
      });

      // Kredileri ekle ve aşım limitini sıfırla (eğer aşıldıysa)
      const updatedSubscription = await prisma.subscription.update({
        where: { businessId },
        data: {
          creditMinutes: { increment: minutes },
          // Aşım limiti aşıldıysa ve kredi alındıysa sıfırla
          overageLimitReached: false
        }
      });

      // Usage log kaydet
      await prisma.usageLog.create({
        data: {
          businessId,
          type: 'CREDIT_PURCHASE',
          minutes: minutes,
          source: 'PURCHASE',
          metadata: {
            purchaseId: purchase.id,
            amount: totalAmount,
            unitPrice
          }
        }
      });

      console.log(`💰 Kredi satın alındı: Business ${businessId}, ${minutes} dk, ${totalAmount} TL`);

      res.json({
        success: true,
        message: `${minutes} dakika krediniz eklendi!`,
        purchase: {
          id: purchase.id,
          minutes,
          amount: totalAmount,
          unitPrice
        },
        newBalance: {
          creditMinutes: updatedSubscription.creditMinutes,
          creditRemaining: updatedSubscription.creditMinutes - updatedSubscription.creditMinutesUsed
        }
      });
    } else {
      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' }
      });

      res.status(400).json({ error: 'Ödeme başarısız' });
    }
  } catch (error) {
    console.error('❌ Credit purchase error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/credits/history - Satın alma geçmişi
// ============================================================================
router.get('/history', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { limit = 20, offset = 0 } = req.query;

    const [purchases, total] = await Promise.all([
      prisma.creditPurchase.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.creditPurchase.count({
        where: { businessId }
      })
    ]);

    res.json({
      purchases,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + purchases.length < total
      }
    });
  } catch (error) {
    console.error('❌ Get history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/credits/usage-logs - Kullanım logları
// ============================================================================
router.get('/usage-logs', async (req, res) => {
  try {
    const businessId = req.businessId;
    const { limit = 50, offset = 0, type } = req.query;

    const where = { businessId };
    if (type) {
      where.type = type;
    }

    const [logs, total] = await Promise.all([
      prisma.usageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.usageLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + logs.length < total
      }
    });
  } catch (error) {
    console.error('❌ Get usage logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/credits/can-make-call - Arama yapılabilir mi?
// ============================================================================
router.get('/can-make-call', async (req, res) => {
  try {
    const businessId = req.businessId;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription) {
      return res.json({
        allowed: false,
        reason: 'NO_SUBSCRIPTION',
        message: 'Aktif abonelik bulunamadı.'
      });
    }

    // Aşım limiti aşıldıysa
    if (subscription.overageLimitReached) {
      return res.json({
        allowed: false,
        reason: 'OVERAGE_LIMIT_REACHED',
        message: 'Aşım limitine ulaşıldı. Kredi satın alarak aramaya devam edebilirsiniz.'
      });
    }

    // Kalan dakika kontrolü
    const packageRemaining = subscription.minutesLimit - subscription.minutesUsed;
    const creditRemaining = subscription.creditMinutes - subscription.creditMinutesUsed;
    const overageRemaining = subscription.overageLimit - subscription.overageMinutes;

    const totalAvailable = packageRemaining + creditRemaining + overageRemaining;

    if (totalAvailable <= 0) {
      return res.json({
        allowed: false,
        reason: 'NO_MINUTES',
        message: 'Kullanılabilir dakikanız kalmadı. Kredi satın alın.'
      });
    }

    res.json({
      allowed: true,
      availableMinutes: totalAvailable,
      breakdown: {
        package: Math.max(0, packageRemaining),
        credit: Math.max(0, creditRemaining),
        overage: Math.max(0, overageRemaining)
      }
    });
  } catch (error) {
    console.error('❌ Can make call check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/credits/add-manual - Manuel kredi ekleme (Admin only)
// ============================================================================
router.post('/add-manual', async (req, res) => {
  try {
    const { businessId, minutes, reason } = req.body;
    const adminBusinessId = req.businessId;

    // TODO: Admin kontrolü ekle
    // Şimdilik sadece kendi business'ına eklemeye izin ver
    const targetBusinessId = businessId || adminBusinessId;

    if (!minutes || minutes < 1) {
      return res.status(400).json({ error: 'Geçersiz dakika miktarı' });
    }

    // Kredileri ekle
    const updatedSubscription = await prisma.subscription.update({
      where: { businessId: targetBusinessId },
      data: {
        creditMinutes: { increment: minutes }
      }
    });

    // Purchase kaydı oluştur (manuel)
    await prisma.creditPurchase.create({
      data: {
        businessId: targetBusinessId,
        minutes,
        amount: 0,
        unitPrice: 0,
        status: 'COMPLETED',
        paymentId: `manual-admin-${Date.now()}`
      }
    });

    // Usage log kaydet
    await prisma.usageLog.create({
      data: {
        businessId: targetBusinessId,
        type: 'CREDIT_MANUAL',
        minutes,
        source: 'ADMIN',
        metadata: { reason, addedBy: adminBusinessId }
      }
    });

    console.log(`🎁 Manuel kredi eklendi: Business ${targetBusinessId}, ${minutes} dk, Sebep: ${reason}`);

    res.json({
      success: true,
      message: `${minutes} dakika kredi eklendi.`,
      newBalance: updatedSubscription.creditMinutes
    });
  } catch (error) {
    console.error('❌ Manual credit add error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
