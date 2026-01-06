/**
 * Admin Routes
 * Protected routes for admin panel - Enterprise customer management
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Stripe if key exists
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Admin email whitelist
const ADMIN_EMAILS = [
  'nurettin@telyx.ai'
];

/**
 * Admin middleware - checks if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  }
  next();
};

// Apply auth and admin middleware to all routes
router.use(authenticateToken);
router.use(isAdmin);

/**
 * GET /api/admin/enterprise-customers
 * List all enterprise customers (active + pending)
 */
router.get('/enterprise-customers', async (req, res) => {
  try {
    // Hem aktif enterprise'ları hem de bekleyen enterprise tekliflerini getir
    const subscriptions = await prisma.subscription.findMany({
      where: {
        OR: [
          { plan: 'ENTERPRISE' },           // Aktif enterprise
          { pendingPlanId: 'ENTERPRISE' }   // Bekleyen enterprise teklifi
        ]
      },
      include: {
        business: {
          include: {
            users: {
              where: { role: 'OWNER' },
              take: 1,
              select: { email: true, name: true }
            },
            _count: {
              select: { assistants: true, callLogs: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const customers = subscriptions.map(sub => ({
      id: sub.id,
      businessId: sub.businessId,
      businessName: sub.business?.name,
      ownerEmail: sub.business?.users?.[0]?.email,
      ownerName: sub.business?.users?.[0]?.name,
      currentPlan: sub.plan,                    // Mevcut plan (TRIAL, STARTER vs.)
      pendingPlan: sub.pendingPlanId,           // Bekleyen plan (ENTERPRISE)
      isActive: sub.plan === 'ENTERPRISE',      // Enterprise aktif mi?
      enterpriseMinutes: sub.enterpriseMinutes,
      enterprisePrice: sub.enterprisePrice,
      enterpriseConcurrent: sub.enterpriseConcurrent,
      enterpriseAssistants: sub.enterpriseAssistants,
      enterpriseStartDate: sub.enterpriseStartDate,
      enterpriseEndDate: sub.enterpriseEndDate,
      enterprisePaymentStatus: sub.enterprisePaymentStatus,
      enterpriseNotes: sub.enterpriseNotes,
      minutesUsed: sub.minutesUsed,
      assistantsCount: sub.business?._count?.assistants || 0,
      callsCount: sub.business?._count?.callLogs || 0,
      createdAt: sub.createdAt
    }));

    res.json(customers);
  } catch (error) {
    console.error('Admin: Failed to list enterprise customers:', error);
    res.status(500).json({ error: 'Failed to load enterprise customers' });
  }
});

/**
 * GET /api/admin/users
 * List all users (for upgrade to enterprise)
 */
router.get('/users', async (req, res) => {
  try {
    const { plan } = req.query;

    let whereClause = {};
    if (plan === '!ENTERPRISE') {
      whereClause = {
        subscription: { plan: { not: 'ENTERPRISE' } }
      };
    }

    const businesses = await prisma.business.findMany({
      where: whereClause,
      include: {
        users: {
          where: { role: 'OWNER' },
          take: 1,
          select: { email: true, name: true }
        },
        subscription: {
          select: { plan: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const users = businesses.map(b => ({
      id: b.id,
      businessName: b.name,
      email: b.users?.[0]?.email,
      name: b.users?.[0]?.name,
      plan: b.subscription?.plan || 'FREE'
    }));

    res.json(users);
  } catch (error) {
    console.error('Admin: Failed to list users:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * POST /api/admin/enterprise-customers
 * Upgrade a user to enterprise
 *
 * Akış:
 * 1. Mevcut planı DEĞİŞTİRME (TRIAL, STARTER vs. kalsın)
 * 2. pendingPlanId = 'ENTERPRISE' olarak kaydet
 * 3. Enterprise detaylarını kaydet (fiyat, dakika vs.)
 * 4. enterprisePaymentStatus = 'pending'
 * 5. Ödeme yapılınca (webhook): plan = 'ENTERPRISE', status = 'ACTIVE'
 */
router.post('/enterprise-customers', async (req, res) => {
  try {
    const {
      businessId,
      minutes,
      price,
      concurrent,
      assistants,
      startDate,
      endDate,
      notes
    } = req.body;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    // Mevcut subscription'ı kontrol et
    const existingSubscription = await prisma.subscription.findUnique({
      where: { businessId: parseInt(businessId) }
    });

    // Enterprise eklerken:
    // - Mevcut planı DEĞİŞTİRME (kullanıcı mevcut planını kullanmaya devam etsin)
    // - pendingPlanId = 'ENTERPRISE' olarak ayarla
    // - Enterprise detaylarını kaydet
    // - Ödeme yapılınca plan aktif olacak
    const subscription = await prisma.subscription.upsert({
      where: { businessId: parseInt(businessId) },
      create: {
        businessId: parseInt(businessId),
        plan: 'TRIAL', // Yeni kullanıcıysa TRIAL ile başlasın
        status: 'ACTIVE',
        pendingPlanId: 'ENTERPRISE', // Bekleyen plan
        enterpriseMinutes: minutes || 1000,
        enterprisePrice: price || 8500,
        enterpriseConcurrent: concurrent || 10,
        enterpriseAssistants: assistants || null,
        enterpriseStartDate: startDate ? new Date(startDate) : new Date(),
        enterpriseEndDate: endDate ? new Date(endDate) : null,
        enterprisePaymentStatus: 'pending',
        enterpriseNotes: notes || null
      },
      update: {
        // plan DEĞİŞMİYOR - mevcut planı koru
        pendingPlanId: 'ENTERPRISE', // Bekleyen plan
        enterpriseMinutes: minutes,
        enterprisePrice: price,
        enterpriseConcurrent: concurrent,
        enterpriseAssistants: assistants,
        enterpriseStartDate: startDate ? new Date(startDate) : undefined,
        enterpriseEndDate: endDate ? new Date(endDate) : undefined,
        enterprisePaymentStatus: 'pending',
        enterpriseNotes: notes
      }
    });

    console.log(`✅ Admin: Business ${businessId} - Enterprise teklifi oluşturuldu (pendingPlan). Mevcut plan: ${subscription.plan}`);
    res.json(subscription);
  } catch (error) {
    console.error('Admin: Failed to create enterprise customer:', error);
    res.status(500).json({ error: 'Failed to create enterprise customer' });
  }
});

/**
 * PUT /api/admin/enterprise-customers/:id
 * Update enterprise customer
 * If paymentStatus changes to 'paid', automatically activate the enterprise plan
 */
router.put('/enterprise-customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      minutes,
      price,
      concurrent,
      assistants,
      startDate,
      endDate,
      paymentStatus,
      notes
    } = req.body;

    // Get current subscription to check if we need to activate
    const currentSub = await prisma.subscription.findUnique({
      where: { id: parseInt(id) }
    });

    // Build update data
    const updateData = {
      enterpriseMinutes: minutes,
      enterprisePrice: price,
      enterpriseConcurrent: concurrent,
      enterpriseAssistants: assistants,
      enterpriseStartDate: startDate ? new Date(startDate) : undefined,
      enterpriseEndDate: endDate ? new Date(endDate) : undefined,
      enterprisePaymentStatus: paymentStatus,
      enterpriseNotes: notes,
      minutesLimit: minutes,
      concurrentLimit: concurrent,
      assistantsLimit: assistants || 999
    };

    // If payment status is changing to 'paid' and plan is not ENTERPRISE yet, activate it
    if (paymentStatus === 'paid' && currentSub?.plan !== 'ENTERPRISE') {
      updateData.plan = 'ENTERPRISE';
      updateData.pendingPlanId = null;
      updateData.status = 'ACTIVE';
      updateData.currentPeriodStart = new Date();
      updateData.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      console.log(`✅ Admin: Activating ENTERPRISE plan for subscription ${id} (manual payment confirmation)`);
    }

    const subscription = await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    console.log(`✅ Admin: Enterprise subscription ${id} updated`);
    res.json(subscription);
  } catch (error) {
    console.error('Admin: Failed to update enterprise customer:', error);
    res.status(500).json({ error: 'Failed to update enterprise customer' });
  }
});

/**
 * POST /api/admin/enterprise-customers/:id/payment-link
 * Generate Stripe payment link for enterprise customer
 * Creates a recurring subscription, not one-time payment
 */
router.post('/enterprise-customers/:id/payment-link', async (req, res) => {
  try {
    const { id } = req.params;

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(id) },
      include: { business: true }
    });

    if (!subscription || !subscription.enterprisePrice) {
      return res.status(400).json({ error: 'Kurumsal fiyat belirlenmemiş' });
    }

    // Minimum fiyat kontrolü - Stripe TRY için en az 500 TL gerektirir (~$10)
    // Aslında ~$0.50 ama güvenlik için 500 TL minimum koyuyoruz
    if (subscription.enterprisePrice < 500) {
      return res.status(400).json({
        error: 'Kurumsal fiyat en az 500 TL olmalıdır',
        currentPrice: subscription.enterprisePrice
      });
    }

    // First, create a Stripe product for this enterprise customer
    const product = await stripe.products.create({
      name: `Telyx.AI Kurumsal Plan - ${subscription.business?.name}`,
      description: `${subscription.enterpriseMinutes} dakika dahil, özel kurumsal plan`,
      metadata: {
        businessId: subscription.businessId.toString(),
        type: 'enterprise'
      }
    });

    // Create a recurring price for this product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(subscription.enterprisePrice * 100), // Kuruş
      currency: 'try',
      recurring: {
        interval: 'month'
      },
      metadata: {
        subscriptionId: subscription.id.toString(),
        businessId: subscription.businessId.toString(),
        type: 'enterprise'
      }
    });

    // Create Stripe Payment Link with recurring subscription
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price: price.id,
        quantity: 1,
      }],
      metadata: {
        subscriptionId: subscription.id.toString(),
        businessId: subscription.businessId.toString(),
        type: 'enterprise',
        priceId: price.id
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.FRONTEND_URL || 'https://app.telyx.ai'}/dashboard/subscription?success=true`
        }
      }
    });

    // Store the Stripe price ID for future reference
    await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: {
        stripePriceId: price.id
      }
    });

    console.log(`✅ Admin: Payment link created for subscription ${id} (recurring)`);
    res.json({ url: paymentLink.url });
  } catch (error) {
    console.error('Admin: Failed to create payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link', details: error.message });
  }
});

/**
 * GET /api/admin/stats
 * Get admin dashboard stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalBusinesses,
      enterpriseCount,
      proCount,
      starterCount,
      freeCount,
      totalCalls,
      todayCalls
    ] = await Promise.all([
      prisma.business.count(),
      prisma.subscription.count({ where: { plan: 'ENTERPRISE' } }),
      prisma.subscription.count({ where: { plan: { in: ['PRO', 'PROFESSIONAL'] } } }),
      prisma.subscription.count({ where: { plan: 'STARTER' } }),
      prisma.subscription.count({ where: { plan: 'FREE' } }),
      prisma.callLog.count(),
      prisma.callLog.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      })
    ]);

    res.json({
      totalBusinesses,
      byPlan: {
        enterprise: enterpriseCount,
        pro: proCount,
        starter: starterCount,
        free: freeCount
      },
      calls: {
        total: totalCalls,
        today: todayCalls
      }
    });
  } catch (error) {
    console.error('Admin: Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
