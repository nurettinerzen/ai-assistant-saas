// ============================================================================
// UPDATED SUBSCRIPTION ROUTES
// ============================================================================
// FILE: backend/src/routes/subscription.js
//
// REPLACE your existing subscription.js with this file
// Enhanced with phone provisioning, plan limits, and better webhook handling
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, verifyBusinessAccess } from '../middleware/auth.js';
import Stripe from 'stripe';
import vapiPhoneNumber from '../services/vapiPhoneNumber.js';
import emailService from '../services/emailService.js';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan configurations
const PLAN_CONFIG = {
  FREE: {
    name: 'FREE',
    price: 0,
    minutesLimit: 0,
    callsLimit: 0,
    assistantsLimit: 0,
    phoneNumbersLimit: 0
  },
  STARTER: {
    name: 'STARTER',
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
    price: 27,
    minutesLimit: 300,
    callsLimit: 50,
    assistantsLimit: 1,
    phoneNumbersLimit: 1
  },
  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_professional',
    price: 77,
    minutesLimit: 1500,
    callsLimit: -1, // unlimited
    assistantsLimit: 2,
    phoneNumbersLimit: 3
  },
  ENTERPRISE: {
    name: 'ENTERPRISE',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
    price: 199,
    minutesLimit: -1, // unlimited
    callsLimit: -1,
    assistantsLimit: 5,
    phoneNumbersLimit: 10
  }
};

// GET /api/subscription - Get current subscription
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// ============================================================================
// WEBHOOK - MUST BE FIRST (before express.json middleware)
// ============================================================================

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('💳 Checkout completed:', session.id);

        const subscriptionId = session.subscription;
        const customerId = session.customer;
        const priceId = session.line_items?.data[0]?.price?.id || session.metadata?.priceId;

        // Determine plan from price ID
        let plan = 'STARTER';
        if (priceId === PLAN_CONFIG.PROFESSIONAL.stripePriceId) plan = 'PROFESSIONAL';
        if (priceId === PLAN_CONFIG.ENTERPRISE.stripePriceId) plan = 'ENTERPRISE';

        const planConfig = PLAN_CONFIG[plan];

        // Update subscription in database
        const subscription = await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            plan: plan,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            // Set plan limits
            minutesLimit: planConfig.minutesLimit,
            callsLimit: planConfig.callsLimit,
            assistantsLimit: planConfig.assistantsLimit,
            phoneNumbersLimit: planConfig.phoneNumbersLimit
          }
        });

        // Get business ID
        const sub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
          include: {
            business: {
              select: {
                id: true,
                name: true,
                vapiAssistantId: true,
                users: {
                  where: { role: 'OWNER' },
                  select: { email: true },
                  take: 1
                }
              }
            }
          }
        });

        if (sub && sub.business) {
          const businessId = sub.business.id;
          const ownerEmail = sub.business.users[0]?.email;

          // Auto-provision phone number for STARTER+ plans
          if (planConfig.phoneNumbersLimit > 0 && sub.business.vapiAssistantId) {
            try {
              const phoneResult = await vapiPhoneNumber.provisionPhoneNumber(
                businessId,
                sub.business.vapiAssistantId
              );

              console.log('📞 Phone number provisioned:', phoneResult.phoneNumber);

              // Send phone activated email
              if (ownerEmail) {
                await emailService.sendPhoneActivatedEmail(
                  ownerEmail,
                  sub.business.name,
                  phoneResult.phoneNumber
                );
              }
            } catch (phoneError) {
              console.error('❌ Failed to provision phone number:', phoneError);
              // Don't fail the webhook - user can provision manually
            }
          }

          // Send payment success email
          if (ownerEmail) {
            await emailService.sendPaymentSuccessEmail(
              ownerEmail,
              sub.business.name,
              planConfig.price * 100,
              plan
            );
          }
        }

        console.log('✅ Subscription activated:', plan);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('🔄 Subscription updated:', subscription.id);

        const priceId = subscription.items.data[0]?.price?.id;
        let plan = 'STARTER';
        if (priceId === PLAN_CONFIG.PROFESSIONAL.stripePriceId) plan = 'PROFESSIONAL';
        if (priceId === PLAN_CONFIG.ENTERPRISE.stripePriceId) plan = 'ENTERPRISE';

        const planConfig = PLAN_CONFIG[plan];

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: plan,
            status: subscription.status.toUpperCase(),
            stripePriceId: priceId,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            // Update limits
            minutesLimit: planConfig.minutesLimit,
            callsLimit: planConfig.callsLimit,
            assistantsLimit: planConfig.assistantsLimit,
            phoneNumbersLimit: planConfig.phoneNumbersLimit
          }
        });

        console.log('✅ Subscription plan updated to:', plan);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('❌ Subscription canceled:', subscription.id);

        // Downgrade to FREE plan
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: 'FREE',
            status: 'CANCELED',
            stripeSubscriptionId: null,
            stripePriceId: null,
            // Reset limits to FREE
            minutesLimit: 0,
            callsLimit: 0,
            assistantsLimit: 0,
            phoneNumbersLimit: 0
          }
        });

        console.log('✅ Downgraded to FREE plan');
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('✅ Payment succeeded:', invoice.id);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: invoice.customer },
          data: { status: 'ACTIVE' }
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('❌ Payment failed:', invoice.id);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: invoice.customer },
          data: { status: 'PAST_DUE' }
        });

        // Get owner email and send notification
        const sub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: invoice.customer },
          include: {
            business: {
              select: {
                name: true,
                users: {
                  where: { role: 'OWNER' },
                  select: { email: true },
                  take: 1
                }
              }
            }
          }
        });

        if (sub?.business.users[0]?.email) {
          await emailService.sendPaymentFailedEmail(
            sub.business.users[0].email,
            sub.business.name
          );
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

router.use(authenticateToken);

// Get current subscription
router.get('/current', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            phoneNumbers: true
          }
        }
      }
    });

    if (!subscription) {
      return res.json({
        plan: 'FREE',
        status: 'TRIAL',
        usage: {
          minutes: { used: 0, limit: 0 },
          calls: { used: 0, limit: 0 },
          assistants: { used: 0, limit: 0 },
          phoneNumbers: { used: 0, limit: 0 }
        }
      });
    }

    // Calculate usage percentages
    const response = {
      ...subscription,
      usage: {
        minutes: {
          used: subscription.minutesUsed,
          limit: subscription.minutesLimit,
          percentage: subscription.minutesLimit > 0
            ? Math.round((subscription.minutesUsed / subscription.minutesLimit) * 100)
            : 0,
          unlimited: subscription.minutesLimit === -1
        },
        calls: {
          used: subscription.callsThisMonth,
          limit: subscription.callsLimit,
          percentage: subscription.callsLimit > 0
            ? Math.round((subscription.callsThisMonth / subscription.callsLimit) * 100)
            : 0,
          unlimited: subscription.callsLimit === -1
        },
        assistants: {
          used: subscription.assistantsCreated,
          limit: subscription.assistantsLimit
        },
        phoneNumbers: {
          used: subscription.business.phoneNumbers?.length || 0,
          limit: subscription.phoneNumbersLimit
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'FREE',
        name: 'Free',
        price: 0,
        interval: 'month',
        features: [
          'Web voice test only (60s limit)',
          '3 AI trainings',
          '0 permanent assistants',
          'No phone number',
          'No integrations',
          'No analytics'
        ],
        limits: PLAN_CONFIG.FREE
      },
      {
        id: 'STARTER',
        name: 'Starter',
        price: 27,
        interval: 'month',
        stripePriceId: PLAN_CONFIG.STARTER.stripePriceId,
        popular: true,
        features: [
          '1 AI assistant',
          '1 phone number',
          '300 minutes per month',
          '50 calls per month',
          'Unlimited trainings',
          'Basic analytics',
          'All integrations',
          'Email support'
        ],
        limits: PLAN_CONFIG.STARTER
      },
      {
        id: 'PROFESSIONAL',
        name: 'Professional',
        price: 77,
        interval: 'month',
        stripePriceId: PLAN_CONFIG.PROFESSIONAL.stripePriceId,
        bestValue: true,
        features: [
          '2 AI assistants',
          '3 phone numbers',
          '1500 minutes per month',
          'Unlimited calls',
          'Unlimited trainings',
          'Advanced analytics with AI insights',
          'All integrations',
          'Priority support',
          'API access'
        ],
        limits: PLAN_CONFIG.PROFESSIONAL
      },
      {
        id: 'ENTERPRISE',
        name: 'Enterprise',
        price: 199,
        interval: 'month',
        stripePriceId: PLAN_CONFIG.ENTERPRISE.stripePriceId,
        features: [
          '5 AI assistants',
          '10 phone numbers',
          'Unlimited everything',
          'Custom voice cloning',
          'White-label option',
          'Dedicated account manager',
          'SLA guarantee',
          'Custom integrations'
        ],
        limits: PLAN_CONFIG.ENTERPRISE
      }
    ];

    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

// Create checkout session
router.post('/create-checkout', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;
    const { priceId, planId } = req.body;

    if (!priceId && !planId) {
      return res.status(400).json({ error: 'Price ID or Plan ID required' });
    }

    // Get price ID from plan ID if not provided
    let finalPriceId = priceId;
    if (!finalPriceId && planId) {
      finalPriceId = PLAN_CONFIG[planId]?.stripePriceId;
    }

    if (!finalPriceId) {
      return res.status(400).json({ error: 'Invalid plan or price ID' });
    }

    const user = await prisma.user.findFirst({
      where: { businessId },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create Stripe customer
    let stripeCustomerId;
    const existingSub = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (existingSub?.stripeCustomerId) {
      stripeCustomerId = existingSub.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.business.name,
        metadata: {
          businessId: businessId.toString()
        }
      });
      stripeCustomerId = customer.id;

      // Save customer ID
      await prisma.subscription.upsert({
        where: { businessId },
        create: {
          businessId,
          stripeCustomerId,
          plan: 'FREE',
          status: 'INCOMPLETE'
        },
        update: {
          stripeCustomerId
        }
      });
    }

    // Create checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1
        }
      ],
      success_url: `${frontendUrl}/dashboard/assistant?success=true`,
      cancel_url: `${frontendUrl}/pricing?canceled=true`,
      metadata: {
        businessId: businessId.toString(),
        priceId: finalPriceId
      }
    });

    res.json({
      sessionUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({
      error: 'Failed to create checkout',
      details: error.message
    });
  }
});

// Cancel subscription
router.post('/cancel', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    // Cancel at period end (don't cancel immediately)
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update database
    await prisma.subscription.update({
      where: { businessId },
      data: {
        cancelAtPeriodEnd: true
      }
    });

    res.json({ 
      success: true,
      message: 'Subscription will be canceled at the end of the current period'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate canceled subscription
router.post('/reactivate', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Remove cancel_at_period_end
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    await prisma.subscription.update({
      where: { businessId },
      data: {
        cancelAtPeriodEnd: false
      }
    });

    res.json({ 
      success: true,
      message: 'Subscription reactivated'
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Create portal session (for managing payment methods)
router.post('/create-portal-session', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard/settings?tab=billing`
    });

    res.json({
      portalUrl: session.url
    });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// GET /api/subscription/billing-history
router.get('/billing-history', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: true
      }
    });

    if (!subscription) {
      return res.json({ history: [] });
    }

    // Mock billing history for now (Stripe webhook'tan gelecek)
    const history = [
      {
        id: 1,
        date: new Date().toISOString(),
        amount: subscription.plan === 'FREE' ? 0 : subscription.plan === 'BASIC' ? 29 : 99,
        status: 'paid',
        plan: subscription.plan,
        period: 'monthly'
      }
    ];

    res.json({ history });
  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

export default router;
