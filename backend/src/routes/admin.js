/**
 * Admin Routes
 * Protected routes for admin panel - Full database management
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/auth.js';
import {
  isAdmin,
  logAuditAction,
  sanitizeResponse,
  buildChangesObject,
  ADMIN_EMAILS
} from '../middleware/adminAuth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Stripe if key exists
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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

// ==================== USER MANAGEMENT ====================

/**
 * GET /api/admin/users
 * List all users with pagination and filters
 */
router.get('/users', async (req, res) => {
  try {
    const { search, plan, suspended, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      deletedAt: null // Exclude soft-deleted
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { business: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Suspended filter
    if (suspended === 'true') {
      where.suspended = true;
    } else if (suspended === 'false') {
      where.suspended = false;
    }

    // Plan filter (filter by business subscription)
    let subscriptionFilter = {};
    if (plan && plan !== 'ALL') {
      if (plan === '!ENTERPRISE') {
        subscriptionFilter = { plan: { not: 'ENTERPRISE' } };
      } else {
        subscriptionFilter = { plan };
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          ...where,
          role: 'OWNER', // Only list business owners
          business: plan ? { subscription: subscriptionFilter } : undefined
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          suspended: true,
          suspendedAt: true,
          createdAt: true,
          updatedAt: true,
          business: {
            select: {
              id: true,
              name: true,
              country: true,
              createdAt: true,
              subscription: {
                select: {
                  id: true,
                  plan: true,
                  status: true,
                  minutesUsed: true,
                  balance: true,
                  enterpriseMinutes: true,
                  enterprisePrice: true,
                  enterprisePaymentStatus: true
                }
              },
              _count: {
                select: { assistants: true, callLogs: true, users: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({
        where: {
          ...where,
          role: 'OWNER',
          business: plan ? { subscription: subscriptionFilter } : undefined
        }
      })
    ]);

    // Transform response
    const transformedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      suspended: u.suspended,
      suspendedAt: u.suspendedAt,
      createdAt: u.createdAt,
      businessId: u.business?.id,
      businessName: u.business?.name,
      country: u.business?.country,
      plan: u.business?.subscription?.plan || 'FREE',
      subscriptionStatus: u.business?.subscription?.status,
      minutesUsed: u.business?.subscription?.minutesUsed || 0,
      balance: u.business?.subscription?.balance || 0,
      enterpriseMinutes: u.business?.subscription?.enterpriseMinutes,
      enterprisePrice: u.business?.subscription?.enterprisePrice,
      enterprisePaymentStatus: u.business?.subscription?.enterprisePaymentStatus,
      assistantsCount: u.business?._count?.assistants || 0,
      callsCount: u.business?._count?.callLogs || 0,
      teamSize: u.business?._count?.users || 1
    }));

    res.json({
      users: transformedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin: Failed to list users:', error);
    res.status(500).json({ error: 'Kullanıcılar alınamadı' });
  }
});

/**
 * GET /api/admin/users/:id
 * Get user detail
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        suspended: true,
        suspendedAt: true,
        suspendReason: true,
        onboardingCompleted: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        business: {
          select: {
            id: true,
            name: true,
            country: true,
            language: true,
            currency: true,
            timezone: true,
            businessType: true,
            createdAt: true,
            suspended: true,
            suspendedAt: true,
            suspendReason: true,
            subscription: {
              select: {
                id: true,
                plan: true,
                status: true,
                minutesUsed: true,
                minutesLimit: true,
                balance: true,
                callsThisMonth: true,
                assistantsCreated: true,
                phoneNumbersUsed: true,
                concurrentLimit: true,
                enterpriseMinutes: true,
                enterprisePrice: true,
                enterpriseConcurrent: true,
                enterpriseAssistants: true,
                enterpriseStartDate: true,
                enterpriseEndDate: true,
                enterprisePaymentStatus: true,
                enterpriseNotes: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                createdAt: true,
                updatedAt: true
              }
            },
            assistants: {
              select: {
                id: true,
                name: true,
                isActive: true,
                callDirection: true,
                createdAt: true,
                _count: { select: { callbackRequests: true } }
              },
              orderBy: { createdAt: 'desc' }
            },
            _count: {
              select: { callLogs: true, users: true, provisionedPhoneNumbers: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Get recent calls (without transcript)
    const recentCalls = await prisma.callLog.findMany({
      where: { businessId: user.business?.id },
      select: {
        id: true,
        callId: true,
        duration: true,
        status: true,
        callResult: true,
        callStatus: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      ...user,
      recentCalls
    });
  } catch (error) {
    console.error('Admin: Failed to get user:', error);
    res.status(500).json({ error: 'Kullanıcı alınamadı' });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update user (plan, minutes, enterprise settings)
 */
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedUserFields = ['suspended'];
    const allowedSubscriptionFields = [
      'plan', 'status', 'minutesUsed', 'balance', 'minutesLimit',
      'enterpriseMinutes', 'enterprisePrice', 'enterpriseConcurrent',
      'enterpriseAssistants', 'enterprisePaymentStatus', 'enterpriseNotes',
      'currentPeriodStart', 'currentPeriodEnd'
    ];

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { business: { include: { subscription: true } } }
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    const userUpdates = {};
    const subscriptionUpdates = {};
    const changes = {};

    // Filter user updates
    for (const field of allowedUserFields) {
      if (req.body[field] !== undefined) {
        userUpdates[field] = req.body[field];
        changes[`user.${field}`] = { old: user[field], new: req.body[field] };
      }
    }

    // Filter subscription updates
    for (const field of allowedSubscriptionFields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        // Handle date fields
        if (['currentPeriodStart', 'currentPeriodEnd', 'enterpriseStartDate', 'enterpriseEndDate'].includes(field) && value) {
          value = new Date(value);
        }
        subscriptionUpdates[field] = value;
        changes[`subscription.${field}`] = {
          old: user.business?.subscription?.[field],
          new: value
        };
      }
    }

    // Update user if needed
    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: parseInt(id) },
        data: userUpdates
      });
    }

    // Update subscription if needed
    if (Object.keys(subscriptionUpdates).length > 0 && user.business?.subscription) {
      await prisma.subscription.update({
        where: { id: user.business.subscription.id },
        data: subscriptionUpdates
      });
    }

    // Audit log
    if (Object.keys(changes).length > 0) {
      await logAuditAction(req.admin, 'UPDATE', 'User', id, changes, req);
    }

    // Refetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { business: { include: { subscription: true } } }
    });

    res.json({ success: true, user: sanitizeResponse(updatedUser, 'User') });
  } catch (error) {
    console.error('Admin: Failed to update user:', error);
    res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
  }
});

/**
 * POST /api/admin/users/:id/suspend
 * Suspend or unsuspend user
 */
router.post('/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { suspended, reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Update user
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        suspended: suspended,
        suspendedAt: suspended ? new Date() : null,
        suspendReason: suspended ? reason : null
      }
    });

    // Also suspend/unsuspend business
    if (user.businessId) {
      await prisma.business.update({
        where: { id: user.businessId },
        data: {
          suspended: suspended,
          suspendedAt: suspended ? new Date() : null,
          suspendReason: suspended ? reason : null
        }
      });
    }

    await logAuditAction(
      req.admin,
      suspended ? 'SUSPEND' : 'ACTIVATE',
      'User',
      id,
      { suspended: { old: !suspended, new: suspended }, reason },
      req
    );

    res.json({
      success: true,
      message: suspended ? 'Kullanıcı donduruldu' : 'Kullanıcı aktif edildi'
    });
  } catch (error) {
    console.error('Admin: Failed to suspend user:', error);
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Send password reset link (placeholder)
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // TODO: Implement password reset email
    // For now, just log the action

    await logAuditAction(req.admin, 'PASSWORD_RESET', 'User', id, null, req);

    res.json({ success: true, message: 'Şifre sıfırlama linki gönderildi' });
  } catch (error) {
    console.error('Admin: Failed to reset password:', error);
    res.status(500).json({ error: 'İşlem başarısız' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Soft delete user
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // Soft delete user
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        suspended: true,
        deletedAt: new Date()
      }
    });

    // Soft delete business
    if (user.businessId) {
      await prisma.business.update({
        where: { id: user.businessId },
        data: {
          suspended: true,
          deletedAt: new Date()
        }
      });
    }

    await logAuditAction(req.admin, 'DELETE', 'User', id, null, req);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin: Failed to delete user:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi' });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      enterpriseCount,
      proCount,
      starterCount,
      paygCount,
      trialCount,
      freeCount,
      totalCalls,
      todayCalls,
      monthCalls,
      totalAssistants,
      pendingCallbacks,
      totalUsers
    ] = await Promise.all([
      prisma.business.count({ where: { deletedAt: null } }),
      prisma.business.count({ where: { deletedAt: null, suspended: false } }),
      prisma.business.count({ where: { suspended: true } }),
      prisma.subscription.count({ where: { plan: 'ENTERPRISE' } }),
      prisma.subscription.count({ where: { plan: { in: ['PRO', 'PROFESSIONAL'] } } }),
      prisma.subscription.count({ where: { plan: 'STARTER' } }),
      prisma.subscription.count({ where: { plan: 'PAYG' } }),
      prisma.subscription.count({ where: { plan: 'TRIAL' } }),
      prisma.subscription.count({ where: { plan: 'FREE' } }),
      prisma.callLog.count(),
      prisma.callLog.count({ where: { createdAt: { gte: today } } }),
      prisma.callLog.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.assistant.count(),
      prisma.callbackRequest.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { deletedAt: null } })
    ]);

    res.json({
      users: {
        total: totalUsers,
        businesses: totalBusinesses,
        active: activeBusinesses,
        suspended: suspendedBusinesses
      },
      byPlan: {
        enterprise: enterpriseCount,
        pro: proCount,
        starter: starterCount,
        payg: paygCount,
        trial: trialCount,
        free: freeCount
      },
      calls: {
        total: totalCalls,
        today: todayCalls,
        month: monthCalls
      },
      assistants: totalAssistants,
      pendingCallbacks
    });
  } catch (error) {
    console.error('Admin: Failed to get stats:', error);
    res.status(500).json({ error: 'İstatistikler alınamadı' });
  }
});

// ==================== ASSISTANTS ====================

/**
 * GET /api/admin/assistants
 * List all assistants
 */
router.get('/assistants', async (req, res) => {
  try {
    const { search, businessId, isActive, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (businessId) {
      where.businessId = parseInt(businessId);
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [assistants, total] = await Promise.all([
      prisma.assistant.findMany({
        where,
        select: {
          id: true,
          name: true,
          isActive: true,
          voiceProvider: true,
          callDirection: true,
          tone: true,
          createdAt: true,
          updatedAt: true,
          business: {
            select: {
              id: true,
              name: true,
              users: {
                where: { role: 'OWNER' },
                take: 1,
                select: { email: true }
              }
            }
          },
          _count: {
            select: { callbackRequests: true, phoneNumbers: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.assistant.count({ where })
    ]);

    const transformedAssistants = assistants.map(a => ({
      ...a,
      businessName: a.business?.name,
      ownerEmail: a.business?.users?.[0]?.email,
      callbacksCount: a._count?.callbackRequests || 0,
      phoneNumbersCount: a._count?.phoneNumbers || 0
    }));

    res.json({
      assistants: transformedAssistants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin: Failed to list assistants:', error);
    res.status(500).json({ error: 'Asistanlar alınamadı' });
  }
});

/**
 * DELETE /api/admin/assistants/:id
 * Delete assistant
 */
router.delete('/assistants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const assistant = await prisma.assistant.findUnique({
      where: { id },
      include: { business: true }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Asistan bulunamadı' });
    }

    // TODO: Delete from 11Labs if needed
    // await delete11LabsAgent(assistant.elevenLabsAgentId);

    await prisma.assistant.delete({ where: { id } });

    await logAuditAction(req.admin, 'DELETE', 'Assistant', id, {
      name: assistant.name,
      businessId: assistant.businessId
    }, req);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin: Failed to delete assistant:', error);
    res.status(500).json({ error: 'Asistan silinemedi' });
  }
});

// ==================== CALLS ====================

/**
 * GET /api/admin/calls
 * List all calls (without transcript/recording)
 */
router.get('/calls', async (req, res) => {
  try {
    const { businessId, status, callResult, startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (businessId) where.businessId = parseInt(businessId);
    if (status) where.status = status;
    if (callResult) where.callResult = callResult;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [calls, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        select: {
          id: true,
          callId: true,
          callerId: true,
          duration: true,
          status: true,
          callResult: true,
          callStatus: true,
          summary: true,
          voicemailDetected: true,
          createdAt: true,
          business: {
            select: {
              id: true,
              name: true
            }
          }
          // transcript, transcriptText, recordingUrl EXCLUDED
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.callLog.count({ where })
    ]);

    res.json({
      calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin: Failed to list calls:', error);
    res.status(500).json({ error: 'Aramalar alınamadı' });
  }
});

// ==================== CALLBACKS ====================

/**
 * GET /api/admin/callbacks
 * List all callback requests
 */
router.get('/callbacks', async (req, res) => {
  try {
    const { status, priority, businessId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (businessId) where.businessId = parseInt(businessId);

    const [callbacks, total] = await Promise.all([
      prisma.callbackRequest.findMany({
        where,
        include: {
          business: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.callbackRequest.count({ where })
    ]);

    res.json({
      callbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin: Failed to list callbacks:', error);
    res.status(500).json({ error: 'Geri aramalar alınamadı' });
  }
});

/**
 * PATCH /api/admin/callbacks/:id
 * Update callback status
 */
router.patch('/callbacks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, callbackNotes, priority } = req.body;

    const current = await prisma.callbackRequest.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'Geri arama bulunamadı' });
    }

    const updates = {};
    const changes = {};

    if (status !== undefined) {
      updates.status = status;
      changes.status = { old: current.status, new: status };
      if (status === 'COMPLETED') {
        updates.completedAt = new Date();
      }
    }
    if (notes !== undefined) {
      updates.notes = notes;
      changes.notes = { old: current.notes, new: notes };
    }
    if (callbackNotes !== undefined) {
      updates.callbackNotes = callbackNotes;
      changes.callbackNotes = { old: current.callbackNotes, new: callbackNotes };
    }
    if (priority !== undefined) {
      updates.priority = priority;
      changes.priority = { old: current.priority, new: priority };
    }

    const callback = await prisma.callbackRequest.update({
      where: { id },
      data: updates
    });

    await logAuditAction(req.admin, 'UPDATE', 'CallbackRequest', id, changes, req);

    res.json(callback);
  } catch (error) {
    console.error('Admin: Failed to update callback:', error);
    res.status(500).json({ error: 'Geri arama güncellenemedi' });
  }
});

// ==================== SUBSCRIPTIONS ====================

/**
 * GET /api/admin/subscriptions
 * List all subscriptions
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const { plan, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (plan) where.plan = plan;
    if (status) where.status = status;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          business: {
            select: {
              id: true,
              name: true,
              users: {
                where: { role: 'OWNER' },
                take: 1,
                select: { email: true, name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.subscription.count({ where })
    ]);

    // Sanitize subscriptions (remove sensitive fields)
    const sanitizedSubscriptions = subscriptions.map(sub => {
      const { stripeCustomerId, iyzicoCardToken, iyzicoPaymentId, stripeSubscriptionId, ...safe } = sub;
      return {
        ...safe,
        businessName: sub.business?.name,
        ownerEmail: sub.business?.users?.[0]?.email,
        ownerName: sub.business?.users?.[0]?.name
      };
    });

    res.json({
      subscriptions: sanitizedSubscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin: Failed to list subscriptions:', error);
    res.status(500).json({ error: 'Abonelikler alınamadı' });
  }
});

/**
 * PATCH /api/admin/subscriptions/:id
 * Update subscription
 */
router.patch('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'plan', 'status', 'minutesUsed', 'minutesLimit', 'balance',
      'currentPeriodStart', 'currentPeriodEnd',
      'enterpriseMinutes', 'enterprisePrice', 'enterpriseConcurrent',
      'enterpriseAssistants', 'enterpriseStartDate', 'enterpriseEndDate',
      'enterprisePaymentStatus', 'enterpriseNotes'
    ];

    const current = await prisma.subscription.findUnique({ where: { id: parseInt(id) } });
    if (!current) {
      return res.status(404).json({ error: 'Abonelik bulunamadı' });
    }

    const updates = {};
    const changes = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        // Handle date fields
        if (['currentPeriodStart', 'currentPeriodEnd', 'enterpriseStartDate', 'enterpriseEndDate'].includes(field) && value) {
          value = new Date(value);
        }
        updates[field] = value;
        changes[field] = { old: current[field], new: value };
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    const subscription = await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: updates
    });

    await logAuditAction(req.admin, 'UPDATE', 'Subscription', id, changes, req);

    res.json(sanitizeResponse(subscription, 'Subscription'));
  } catch (error) {
    console.error('Admin: Failed to update subscription:', error);
    res.status(500).json({ error: 'Abonelik güncellenemedi' });
  }
});

// ==================== AUDIT LOG ====================

/**
 * GET /api/admin/audit-log
 * List audit logs
 */
router.get('/audit-log', async (req, res) => {
  try {
    const { adminId, entityType, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (adminId) where.adminId = adminId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          admin: { select: { email: true, name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin: Failed to list audit logs:', error);
    res.status(500).json({ error: 'Audit log alınamadı' });
  }
});

export default router;
