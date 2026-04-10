import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';

const prismaMock = {
  $disconnect: jest.fn(),
  emailThread: {
    count: jest.fn(),
  },
  emailDraft: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

const authenticateTokenMock = jest.fn((req, _res, next) => {
  req.user = { id: 1, email: 'admin@example.com', role: 'ADMIN' };
  req.userId = 1;
  req.auth = { amr: ['pwd'], adminMfaAt: null };
  next();
});

const isAdminMock = jest.fn((req, _res, next) => {
  req.admin = { id: 10, email: 'admin@example.com', role: 'SUPER_ADMIN', isActive: true };
  next();
});

const requireAdminMfaMock = jest.fn((_req, res, _next) => {
  return res.status(428).json({
    error: 'Admin MFA required',
    code: 'ADMIN_MFA_REQUIRED',
  });
});

const getDashboardMetricsMock = jest.fn(() => ({
  tools: { overallFailRate: 0 },
  violations: [],
  blockedClaims: { blockedClaimCount: 0 },
}));

const getShadowModeStatsMock = jest.fn(() => ({ totalRuns: 0 }));
const getIdempotencyStatsMock = jest.fn(() => ({ entries: 0 }));

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: authenticateTokenMock,
}));

jest.unstable_mockModule('../../src/middleware/adminAuth.js', () => ({
  isAdmin: isAdminMock,
  requireAdminMfa: requireAdminMfaMock,
}));

jest.unstable_mockModule('../../src/services/routing-metrics.js', () => ({
  getDashboardMetrics: getDashboardMetricsMock,
}));

jest.unstable_mockModule('../../src/utils/shadow-mode.js', () => ({
  getShadowModeStats: getShadowModeStatsMock,
}));

jest.unstable_mockModule('../../src/services/tool-idempotency.js', () => ({
  getIdempotencyStats: getIdempotencyStatsMock,
}));

let adminRagMetricsRouter;
let metricsRouter;

beforeAll(async () => {
  ({ default: adminRagMetricsRouter } = await import('../../src/routes/admin-rag-metrics.js'));
  ({ default: metricsRouter } = await import('../../src/routes/metrics.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.emailThread.count.mockResolvedValue(0);
  prismaMock.emailDraft.count.mockResolvedValue(0);
  prismaMock.emailDraft.findMany.mockResolvedValue([]);
});

describe('Admin MFA enforcement', () => {
  it('blocks admin RAG metrics routes when admin MFA is missing', async () => {
    const app = express();
    app.use('/api/admin/email-rag', adminRagMetricsRouter);

    const response = await request(app).get('/api/admin/email-rag/metrics/overview');

    expect(response.status).toBe(428);
    expect(response.body.code).toBe('ADMIN_MFA_REQUIRED');
    expect(requireAdminMfaMock).toHaveBeenCalled();
    expect(prismaMock.emailThread.count).not.toHaveBeenCalled();
  });

  it('blocks internal metrics routes when admin MFA is missing', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use('/api/metrics', metricsRouter);

    const response = await request(app)
      .get('/api/metrics/dashboard')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(response.status).toBe(428);
    expect(response.body.code).toBe('ADMIN_MFA_REQUIRED');
    expect(requireAdminMfaMock).toHaveBeenCalled();
    expect(getDashboardMetricsMock).not.toHaveBeenCalled();
  });

  it('keeps WhatsApp admin/test routes behind MFA middleware', () => {
    const source = readFileSync(new URL('../../src/routes/whatsapp.js', import.meta.url), 'utf8');

    expect(source).toContain("import { isAdmin, requireAdminMfa } from '../middleware/adminAuth.js';");
    expect(source).toContain("router.use('/send', authenticateToken, isAdmin, requireAdminMfa);");
    expect(source).toContain("router.use('/conversations', authenticateToken, isAdmin, requireAdminMfa);");
  });
});
