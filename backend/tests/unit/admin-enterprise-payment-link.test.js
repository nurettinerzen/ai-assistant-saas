import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const prismaMock = {
  subscription: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
};

const stripeClientMock = {
  products: {
    create: jest.fn()
  },
  prices: {
    retrieve: jest.fn(),
    create: jest.fn()
  },
  paymentLinks: {
    create: jest.fn()
  }
};

const canAccessBusinessMock = jest.fn();
const createAdminAuditLogMock = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock)
}));

jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => stripeClientMock)
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, businessId: 11 };
    next();
  }
}));

jest.unstable_mockModule('../../src/middleware/adminAuth.js', () => ({
  isAdmin: (req, res, next) => {
    req.admin = { id: 1, role: 'SUPER_ADMIN', businessId: null };
    next();
  },
  requireAdminMfa: (req, res, next) => next(),
  logAuditAction: () => (req, res, next) => next(),
  sanitizeResponse: (_req, res, next) => next(),
  buildChangesObject: jest.fn(),
  validateBusinessAccess: jest.fn(),
  canAccessBusiness: canAccessBusinessMock
}));

jest.unstable_mockModule('../../src/middleware/auditLog.js', () => ({
  createAdminAuditLog: createAdminAuditLogMock,
  calculateChanges: jest.fn(),
  auditContext: jest.fn()
}));

jest.unstable_mockModule('../../src/services/stripeEnterpriseService.js', () => ({
  updateEnterpriseStripePrice: jest.fn(),
  hasActiveStripeSubscription: jest.fn()
}));

jest.unstable_mockModule('../../src/services/phoneInboundGate.js', () => ({
  isPhoneInboundEnabledForBusinessRecord: jest.fn(() => false),
  isPhoneInboundForceDisabled: jest.fn(() => false)
}));

jest.unstable_mockModule('../../src/security/configIntegrity.js', () => ({
  buildSecurityConfigDigest: jest.fn(),
  compareBaselineDigest: jest.fn()
}));

let router;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.FRONTEND_URL = 'https://telyx.ai';
  ({ default: router } = await import('../../src/routes/admin.js'));
});

describe('Admin enterprise payment link flow', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.FRONTEND_URL = 'https://telyx.ai';

    app = express();
    app.use(express.json());
    app.use('/api/admin', router);

    canAccessBusinessMock.mockReturnValue(true);
    createAdminAuditLogMock.mockResolvedValue({});

    stripeClientMock.products.create.mockResolvedValue({ id: 'prod_test_123' });
    stripeClientMock.prices.create.mockResolvedValue({ id: 'price_test_123' });
    stripeClientMock.paymentLinks.create.mockResolvedValue({
      url: 'https://pay.stripe.test/enterprise'
    });
    prismaMock.subscription.update.mockResolvedValue({});
  });

  it('creates a recurring monthly Stripe payment link for enterprise offers', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 77,
      businessId: 11,
      enterprisePrice: 2500,
      enterpriseMinutes: 900,
      enterpriseSupportInteractions: 1500,
      enterpriseConcurrent: 3,
      enterpriseAssistants: 12,
      stripePriceId: null,
      business: {
        name: 'Acme'
      }
    });

    const response = await request(app)
      .post('/api/admin/enterprise-customers/77/payment-link')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.url).toBe('https://pay.stripe.test/enterprise');
    expect(stripeClientMock.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_test_123',
        unit_amount: 250000,
        currency: 'try',
        recurring: {
          interval: 'month'
        },
        metadata: expect.objectContaining({
          subscriptionId: '77',
          businessId: '11',
          type: 'enterprise'
        })
      }),
      expect.objectContaining({
        idempotencyKey: 'ent-77-2500-TRY-month'
      })
    );
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        stripePriceId: 'price_test_123'
      }
    });
  });

  it('reuses the existing Stripe price when the enterprise config hash matches', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 77,
      businessId: 11,
      enterprisePrice: 2500,
      enterpriseMinutes: 900,
      enterpriseSupportInteractions: 1500,
      stripePriceId: 'price_existing_123',
      business: {
        name: 'Acme'
      }
    });
    stripeClientMock.prices.retrieve.mockResolvedValue({
      metadata: {
        priceHash: 'ent-77-2500-TRY-month'
      }
    });
    stripeClientMock.paymentLinks.create.mockResolvedValue({
      url: 'https://pay.stripe.test/existing'
    });

    const response = await request(app)
      .post('/api/admin/enterprise-customers/77/payment-link')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.idempotent).toBe(true);
    expect(response.body.priceId).toBe('price_existing_123');
    expect(stripeClientMock.prices.create).not.toHaveBeenCalled();
    expect(stripeClientMock.paymentLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{
          price: 'price_existing_123',
          quantity: 1
        }]
      })
    );
  });
});
