import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const prismaMock = {
  subscription: {
    findUnique: jest.fn()
  },
  business: {
    findUnique: jest.fn()
  }
};

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock)
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 8, businessId: 11 };
    req.userId = 8;
    req.businessId = 11;
    next();
  }
}));

jest.unstable_mockModule('../../src/config/plans.js', () => ({
  getCreditUnitPrice: jest.fn(() => 7),
  calculateCreditPrice: jest.fn(() => ({ minutes: 10, unitPrice: 7, total: 70 })),
  getRegionalPricing: jest.fn(() => ({
    plans: {
      STARTER: { minutes: 0 },
      ENTERPRISE: { minutes: 0 }
    }
  })),
  getPlanConfig: jest.fn(() => ({}))
}));

let router;

beforeAll(async () => {
  ({ default: router } = await import('../../src/routes/credits.js'));
});

describe('Credits balance route schema-safe reads', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/credits', router);
  });

  it('returns legacy credit balance without selecting billing v2-only columns', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 33,
      businessId: 11,
      plan: 'ENTERPRISE',
      minutesLimit: 1000,
      minutesUsed: 120,
      creditMinutes: 300,
      creditMinutesUsed: 20,
      overageMinutes: 5,
      overageRate: 23,
      overageLimit: 100,
      overageLimitReached: false,
      packageWarningAt80: false,
      creditWarningAt80: false,
      currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
      business: { country: 'TR' }
    });

    const response = await request(app).get('/api/credits/balance');

    expect(response.status).toBe(200);
    expect(response.body.plan).toBe('ENTERPRISE');
    expect(response.body.credit.remaining).toBe(280);

    const select = prismaMock.subscription.findUnique.mock.calls[0][0].select;
    expect(select.plan).toBe(true);
    expect(select.business).toBeDefined();
    expect(select.voiceAddOnMinutesBalance).toBeUndefined();
    expect(select.writtenInteractionAddOnBalance).toBeUndefined();
  });
});
