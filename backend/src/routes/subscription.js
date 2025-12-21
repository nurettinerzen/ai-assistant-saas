// ============================================================================
// UPDATED SUBSCRIPTION ROUTES
// ============================================================================
// FILE: backend/src/routes/subscription.js
//
// Enhanced with iyzico support for Turkish customers
// Stripe for global customers, iyzico for Turkey (TR)
// ============================================================================

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, verifyBusinessAccess } from '../middleware/auth.js';
import Stripe from 'stripe';
import emailService from '../services/emailService.js';
import iyzicoSubscription from '../services/iyzicoSubscription.js';
import paymentProvider from '../services/paymentProvider.js';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan configurations with both Stripe and iyzico pricing
const PLAN_CONFIG = {
  FREE: {
    name: 'FREE',
    price: 0,
    priceTRY: 0,
    minutesLimit: 0,
    callsLimit: 0,
    assistantsLimit: 0,
    phoneNumbersLimit: 0
  },
  STARTER: {
    name: 'STARTER',
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
    iyzicoPlanRef: process.env.IYZICO_STARTER_PLAN_REF,
    price: 27,
    priceTRY: 899,
    minutesLimit: 300,
    callsLimit: 50,
    assistantsLimit: 1,
    phoneNumbersLimit: 1
  },
  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_professional',
    iyzicoPlanRef: process.env.IYZICO_PROFESSIONAL_PLAN_REF,
    price: 77,
    priceTRY: 2599,
    minutesLimit: 1500,
    callsLimit: -1, // unlimited
    assistantsLimit: 2,
    phoneNumbersLimit: 3
  },
  ENTERPRISE: {
    name: 'ENTERPRISE',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
    iyzicoPlanRef: process.env.IYZICO_ENTERPRISE_PLAN_REF,
    price: 199,
    priceTRY: 6799,
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

          // Note: Phone numbers are now provisioned manually via the Phone Numbers page
          // Users can add 11Labs phone numbers after subscription activation

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
// IYZICO WEBHOOK
// ============================================================================

router.post('/iyzico-webhook', express.json(), async (req, res) => {
  console.log('📥 iyzico webhook received:', req.body);

  try {
    const result = await iyzicoSubscription.processWebhook(req.body);

    if (result.success) {
      res.json({ received: true });
    } else {
      console.error('❌ iyzico webhook processing failed:', result.error);
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ iyzico webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ============================================================================
// IYZICO PAYMENT CALLBACK (Simple checkout - not subscription)
// ============================================================================

router.post('/iyzico-payment-callback', async (req, res) => {
  const { token } = req.body;
  const { planId, businessId } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  console.log('📥 iyzico payment callback received:', { token, planId, businessId });

  if (!token) {
    return res.redirect(`${frontendUrl}/pricing?error=missing_token`);
  }

  try {
    // Retrieve checkout form result
    const Iyzipay = (await import('iyzipay')).default;
    const iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY,
      secretKey: process.env.IYZICO_SECRET_KEY,
      uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
    });

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: `callback-${Date.now()}`,
      token: token
    };

    iyzipay.checkoutForm.retrieve(request, async (err, result) => {
      if (err) {
        console.error('iyzico retrieve error:', err);
        return res.redirect(`${frontendUrl}/pricing?error=payment_failed`);
      }

      console.log('iyzico payment result:', result.status, result.paymentStatus);

      if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
        // Payment successful - activate subscription
        const planConfig = PLAN_CONFIG[planId];

        if (planConfig && businessId) {
          await prisma.subscription.upsert({
            where: { businessId: parseInt(businessId) },
            create: {
              businessId: parseInt(businessId),
              paymentProvider: 'iyzico',
              iyzicoPaymentId: result.paymentId,
              plan: planId,
              status: 'ACTIVE',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              minutesLimit: planConfig.minutesLimit,
              callsLimit: planConfig.callsLimit,
              assistantsLimit: planConfig.assistantsLimit,
              phoneNumbersLimit: planConfig.phoneNumbersLimit
            },
            update: {
              paymentProvider: 'iyzico',
              iyzicoPaymentId: result.paymentId,
              plan: planId,
              status: 'ACTIVE',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              minutesLimit: planConfig.minutesLimit,
              callsLimit: planConfig.callsLimit,
              assistantsLimit: planConfig.assistantsLimit,
              phoneNumbersLimit: planConfig.phoneNumbersLimit
            }
          });

          console.log('✅ iyzico payment successful, plan activated:', planId);
        }

        return res.redirect(`${frontendUrl}/dashboard/assistant?success=true&provider=iyzico`);
      } else {
        console.log('❌ iyzico payment failed:', result.errorMessage);
        return res.redirect(`${frontendUrl}/pricing?error=payment_failed&message=${encodeURIComponent(result.errorMessage || 'Ödeme başarısız')}`);
      }
    });
  } catch (error) {
    console.error('iyzico callback error:', error);
    return res.redirect(`${frontendUrl}/pricing?error=callback_failed`);
  }
});

// iyzico Subscription Callback - POST handler for form submission
router.post('/iyzico-subscription-callback', async (req, res) => {
  const { token } = req.body;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  console.log('📥 iyzico subscription callback received:', { token });

  if (!token) {
    return res.redirect(`${frontendUrl}/dashboard/subscription?status=error&message=missing_token`);
  }

  try {
    const Iyzipay = (await import('iyzipay')).default;
    const iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY,
      secretKey: process.env.IYZICO_SECRET_KEY,
      uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
    });

    // Retrieve subscription checkout form result
    iyzipay.subscriptionCheckoutForm.retrieve({
      locale: Iyzipay.LOCALE.TR,
      conversationId: token,
      token: token
    }, async (err, result) => {
      if (err || result.status !== 'success') {
        console.error('iyzico callback error:', err || result);
        return res.redirect(`${frontendUrl}/dashboard/subscription?status=error`);
      }

      console.log('iyzico subscription result:', result);

      // Find subscription by pending token
      const subscription = await prisma.subscription.findFirst({
        where: { pendingSubscriptionToken: token }
      });

      if (subscription) {
        const planId = subscription.pendingPlanId;
        const planConfig = PLAN_CONFIG[planId] || PLAN_CONFIG.STARTER;

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            plan: planId,
            status: 'ACTIVE',
            paymentProvider: 'iyzico',
            iyzicoSubscriptionId: result.subscriptionReferenceCode || result.referenceCode,
            iyzicoReferenceCode: result.subscriptionReferenceCode || result.referenceCode,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            pendingSubscriptionToken: null,
            pendingPlanId: null,
            // Set plan limits
            minutesLimit: planConfig.minutesLimit,
            callsLimit: planConfig.callsLimit,
            assistantsLimit: planConfig.assistantsLimit,
            phoneNumbersLimit: planConfig.phoneNumbersLimit
          }
        });

        console.log('✅ iyzico subscription activated:', planId);
      }

      return res.redirect(`${frontendUrl}/dashboard/subscription?status=success`);
    });
  } catch (error) {
    console.error('iyzico subscription callback error:', error);
    return res.redirect(`${frontendUrl}/dashboard/subscription?status=error`);
  }
});

// Legacy callback (GET - for backward compatibility)
router.get('/iyzico-callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.redirect(`${frontendUrl}/dashboard/subscription?status=error&message=use_post`);
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

// Get available plans - includes both Stripe and iyzico pricing
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'FREE',
        name: 'Free',
        price: 0,
        priceTRY: 0,
        currency: 'USD',
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
        priceTRY: 899,
        currency: 'USD',
        interval: 'month',
        stripePriceId: PLAN_CONFIG.STARTER.stripePriceId,
        iyzicoPlanRef: PLAN_CONFIG.STARTER.iyzicoPlanRef,
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
        priceTRY: 2599,
        currency: 'USD',
        interval: 'month',
        stripePriceId: PLAN_CONFIG.PROFESSIONAL.stripePriceId,
        iyzicoPlanRef: PLAN_CONFIG.PROFESSIONAL.iyzicoPlanRef,
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
        priceTRY: 6799,
        currency: 'USD',
        interval: 'month',
        stripePriceId: PLAN_CONFIG.ENTERPRISE.stripePriceId,
        iyzicoPlanRef: PLAN_CONFIG.ENTERPRISE.iyzicoPlanRef,
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

// Get payment provider for current business
router.get('/payment-provider', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;
    const provider = await paymentProvider.getProviderForBusiness(businessId);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { country: true }
    });

    res.json({
      provider,
      country: business?.country || 'US',
      isIyzico: provider === 'iyzi co',
      isStripe: provider === 'stripe'
    });
  } catch (error) {
    console.error('Get payment provider error:', error);
    res.status(500).json({ error: 'Failed to get payment provider' });
  }
});

// Create checkout session - Automatically selects Stripe or iyzico based on country
router.post('/create-checkout', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;
    const { priceId, planId, forceProvider } = req.body;

    if (!priceId && !planId) {
      return res.status(400).json({ error: 'Price ID or Plan ID required' });
    }

    // Get business to determine provider
    const user = await prisma.user.findFirst({
      where: { businessId },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine payment provider (can be forced or auto-detected)
    const provider = forceProvider || paymentProvider.getProviderForCountry(user.business.country);

    console.log(`💳 Creating checkout for business ${businessId} with provider: ${provider} (country: ${user.business.country})`);

    // ========== IYZICO CHECKOUT ==========
    if (provider === 'iyzico') {
      const finalPlanId = planId || Object.keys(PLAN_CONFIG).find(
        key => PLAN_CONFIG[key].stripePriceId === priceId
      );

      if (!finalPlanId || finalPlanId === 'FREE') {
        return res.status(400).json({ error: 'Invalid plan for iyzico' });
      }

      const result = await iyzicoSubscription.initializeCheckoutForm(businessId, finalPlanId);

      if (!result.success) {
        return res.status(400).json({
          error: 'Failed to initialize iyzico checkout',
          details: result.error
        });
      }

      return res.json({
        provider: 'iyzico',
        checkoutFormContent: result.checkoutFormContent,
        token: result.token,
        tokenExpireTime: result.tokenExpireTime
      });
    }

    // ========== STRIPE CHECKOUT ==========
    // Get price ID from plan ID if not provided
    let finalPriceId = priceId;
    if (!finalPriceId && planId) {
      finalPriceId = PLAN_CONFIG[planId]?.stripePriceId;
    }

    if (!finalPriceId) {
      return res.status(400).json({ error: 'Invalid plan or price ID' });
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
          paymentProvider: 'stripe',
          plan: 'FREE',
          status: 'INCOMPLETE'
        },
        update: {
          stripeCustomerId,
          paymentProvider: 'stripe'
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
      success_url: `${frontendUrl}/dashboard/assistant?success=true&provider=stripe`,
      cancel_url: `${frontendUrl}/pricing?canceled=true`,
      metadata: {
        businessId: businessId.toString(),
        priceId: finalPriceId
      }
    });

    res.json({
      provider: 'stripe',
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

// Cancel subscription - supports both Stripe and iyzico
router.post('/cancel', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;

    const subscription = await prisma.subscription.findUnique({
      where: { businessId }
    });

    if (!subscription) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Handle based on payment provider
    if (subscription.paymentProvider === 'iyzico' && subscription.iyzicoSubscriptionId) {
      // Cancel iyzico subscription
      const result = await iyzicoSubscription.cancelSubscription(subscription.iyzicoSubscriptionId);

      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Failed to cancel iyzico subscription' });
      }

      await prisma.subscription.update({
        where: { businessId },
        data: {
          cancelAtPeriodEnd: true
        }
      });

      return res.json({
        success: true,
        provider: 'iyzico',
        message: 'Aboneliğiniz iptal edildi'
      });
    }

    // Stripe cancellation
    if (!subscription.stripeSubscriptionId) {
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
      provider: 'stripe',
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

    if (!subscription) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    // Handle based on payment provider
    if (subscription.paymentProvider === 'iyzico') {
      // iyzico doesn't support reactivation the same way
      // User needs to create a new subscription
      return res.status(400).json({
        error: 'iyzico subscriptions cannot be reactivated. Please create a new subscription.',
        needsNewSubscription: true
      });
    }

    // Stripe reactivation
    if (!subscription.stripeSubscriptionId) {
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

// ============================================================================
// UPGRADE ENDPOINT - iyzico Subscription API with Plan References
// ============================================================================

router.post('/upgrade', verifyBusinessAccess, async (req, res) => {
  try {
    const { businessId } = req.user;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Normalize planId to uppercase
    const normalizedPlanId = planId.toUpperCase();

    if (!PLAN_CONFIG[normalizedPlanId] || normalizedPlanId === 'FREE') {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Get user and business info
    const user = await prisma.user.findFirst({
      where: { businessId },
      include: { business: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine payment provider based on country
    const provider = paymentProvider.getProviderForCountry(user.business.country);

    console.log(`💳 Upgrade request for business ${businessId}, plan: ${normalizedPlanId}, provider: ${provider}`);

    // ========== IYZICO SUBSCRIPTION API ==========
    if (provider === 'iyzico') {
      const planConfig = PLAN_CONFIG[normalizedPlanId];
      const planRef = planConfig.iyzicoPlanRef;

      if (!planRef) {
        return res.status(400).json({ error: 'iyzico plan reference not configured' });
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Use iyzico Subscription Checkout Form Initialize
      const Iyzipay = (await import('iyzipay')).default;
      const iyzipay = new Iyzipay({
        apiKey: process.env.IYZICO_API_KEY,
        secretKey: process.env.IYZICO_SECRET_KEY,
        uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
      });

      const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: `sub_${businessId}_${Date.now()}`,
        pricingPlanReferenceCode: planRef,
        subscriptionInitialStatus: 'ACTIVE',
        callbackUrl: `${frontendUrl}/dashboard/subscription/callback`,
        customer: {
          name: user.name?.split(' ')[0] || 'Ad',
          surname: user.name?.split(' ').slice(1).join(' ') || 'Soyad',
          email: user.email,
          gsmNumber: '+905551234567',
          identityNumber: '11111111111',
          shippingAddress: {
            contactName: user.name || 'Müşteri',
            city: 'Istanbul',
            country: 'Turkey',
            address: 'Türkiye'
          },
          billingAddress: {
            contactName: user.name || 'Müşteri',
            city: 'Istanbul',
            country: 'Turkey',
            address: 'Türkiye'
          }
        }
      };

      return new Promise(async (resolve) => {
        iyzipay.subscriptionCheckoutFormInitialize.create(request, async (err, result) => {
          if (err) {
            console.error('iyzico subscription error:', err);
            return resolve(res.status(500).json({ error: 'Abonelik başlatılamadı' }));
          }

          if (result.status !== 'success') {
            console.error('iyzico subscription failed:', result);
            return resolve(res.status(400).json({ error: result.errorMessage || 'Abonelik başlatılamadı' }));
          }

          // Save pending subscription token for callback
          await prisma.subscription.upsert({
            where: { businessId },
            create: {
              businessId,
              paymentProvider: 'iyzico',
              plan: 'FREE',
              status: 'INCOMPLETE',
              pendingSubscriptionToken: result.token,
              pendingPlanId: normalizedPlanId
            },
            update: {
              pendingSubscriptionToken: result.token,
              pendingPlanId: normalizedPlanId
            }
          });

          resolve(res.json({
            provider: 'iyzico',
            checkoutFormContent: result.checkoutFormContent,
            token: result.token,
            tokenExpireTime: result.tokenExpireTime
          }));
        });
      });
    }

    // ========== STRIPE CHECKOUT ==========
    const planConfig = PLAN_CONFIG[normalizedPlanId];
    const priceId = planConfig.stripePriceId;

    if (!priceId) {
      return res.status(400).json({ error: 'Stripe price not configured for this plan' });
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
          paymentProvider: 'stripe',
          plan: 'FREE',
          status: 'INCOMPLETE'
        },
        update: {
          stripeCustomerId,
          paymentProvider: 'stripe'
        }
      });
    }

    // Create Stripe checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${frontendUrl}/dashboard/assistant?success=true&provider=stripe`,
      cancel_url: `${frontendUrl}/pricing?canceled=true`,
      metadata: {
        businessId: businessId.toString(),
        priceId: priceId,
        planId: normalizedPlanId
      }
    });

    return res.json({
      provider: 'stripe',
      sessionUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({
      error: 'Upgrade failed',
      details: error.message
    });
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
