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
 * List all enterprise customers
 */
router.get('/enterprise-customers', async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { plan: 'ENTERPRISE' },
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

    const subscription = await prisma.subscription.upsert({
      where: { businessId: parseInt(businessId) },
      create: {
        businessId: parseInt(businessId),
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        enterpriseMinutes: minutes || 1000,
        enterprisePrice: price || 8500,
        enterpriseConcurrent: concurrent || 10,
        enterpriseAssistants: assistants || null,
        enterpriseStartDate: startDate ? new Date(startDate) : new Date(),
        enterpriseEndDate: endDate ? new Date(endDate) : null,
        enterprisePaymentStatus: 'pending',
        enterpriseNotes: notes || null,
        minutesLimit: minutes || 1000,
        concurrentLimit: concurrent || 10,
        assistantsLimit: assistants || 999
      },
      update: {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        enterpriseMinutes: minutes,
        enterprisePrice: price,
        enterpriseConcurrent: concurrent,
        enterpriseAssistants: assistants,
        enterpriseStartDate: startDate ? new Date(startDate) : undefined,
        enterpriseEndDate: endDate ? new Date(endDate) : undefined,
        enterprisePaymentStatus: 'pending',
        enterpriseNotes: notes,
        minutesLimit: minutes,
        concurrentLimit: concurrent,
        assistantsLimit: assistants || 999
      }
    });

    console.log(`✅ Admin: Business ${businessId} upgraded to ENTERPRISE`);
    res.json(subscription);
  } catch (error) {
    console.error('Admin: Failed to create enterprise customer:', error);
    res.status(500).json({ error: 'Failed to create enterprise customer' });
  }
});

/**
 * PUT /api/admin/enterprise-customers/:id
 * Update enterprise customer
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

    const subscription = await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: {
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
      }
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

    // Create Stripe Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: 'try',
          product_data: {
            name: `Telyx.AI Kurumsal Plan - ${subscription.enterpriseMinutes} Dakika`,
            description: `${subscription.business?.name} için özel kurumsal plan`
          },
          unit_amount: Math.round(subscription.enterprisePrice * 100), // Kuruş
        },
        quantity: 1,
      }],
      metadata: {
        subscriptionId: subscription.id.toString(),
        businessId: subscription.businessId.toString(),
        type: 'enterprise'
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.FRONTEND_URL || 'https://app.telyx.ai'}/dashboard/subscription?success=true`
        }
      }
    });

    console.log(`✅ Admin: Payment link created for subscription ${id}`);
    res.json({ url: paymentLink.url });
  } catch (error) {
    console.error('Admin: Failed to create payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
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
