import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';

const prismaMock = {
  crmOrder: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn()
  },
  customerData: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn()
  }
};

jest.unstable_mockModule('../../src/prismaClient.js', () => ({
  default: prismaMock
}));

let executeLookup;

beforeAll(async () => {
  const module = await import('../../src/tools/handlers/customer-data-lookup.js');
  executeLookup = module.execute;
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.crmOrder.findMany.mockResolvedValue([]);
  prismaMock.crmOrder.findFirst.mockResolvedValue(null);
  prismaMock.customerData.findMany.mockResolvedValue([]);
  prismaMock.customerData.findFirst.mockResolvedValue(null);
  prismaMock.crmOrder.findUnique.mockResolvedValue(null);
  prismaMock.customerData.findUnique.mockResolvedValue(null);
});

describe('P0 customer_data_lookup deterministic outcomes', () => {
  const business = { id: 1, language: 'TR' };

  it('B1: existing order without last4 should request verification (phone_last4)', async () => {
    prismaMock.crmOrder.findMany.mockResolvedValueOnce([{
      id: 'crm-order-1',
      businessId: 1,
      orderNumber: 'ORD-9837459',
      customerName: 'Ahmet Yılmaz',
      customerPhone: '+905551234567',
      customerEmail: 'ahmet@example.com',
      status: 'Hazırlanıyor'
    }]);

    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: 'ORD-9837459'
      },
      business,
      {
        state: { verification: { status: 'none' } },
        sessionId: 'test-b1'
      }
    );

    expect(result.outcome).toBe(ToolOutcome.VERIFICATION_REQUIRED);
    expect(result.data?.askFor).toBe('phone_last4');
    expect(result.message.toLowerCase()).toContain('son 4');
    expect(prismaMock.crmOrder.findMany).toHaveBeenCalled();
  });

  it('B3: order + last4 provided but record missing should return NOT_FOUND (not NEED_MORE_INFO)', async () => {
    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: 'ORD-9837459',
        verification_input: '1234'
      },
      business,
      {
        state: { verification: { status: 'none' } },
        sessionId: 'test-b3'
      }
    );

    expect(prismaMock.crmOrder.findMany).toHaveBeenCalled();
    expect(result.outcome).toBe(ToolOutcome.NOT_FOUND);
    expect(result.outcome).not.toBe(ToolOutcome.NEED_MORE_INFO);
  });

  it('B4: numeric order input should fallback to phone lookup before returning NOT_FOUND', async () => {
    prismaMock.crmOrder.findMany.mockResolvedValueOnce([]);
    prismaMock.crmOrder.findFirst.mockResolvedValueOnce({
      id: 'crm-order-phone-1',
      businessId: 1,
      orderNumber: 'ORD-424527',
      customerName: 'Ahmet Yılmaz',
      customerPhone: '4245275089',
      customerEmail: 'ahmet@example.com',
      status: 'Hazırlanıyor'
    });

    prismaMock.customerData.findMany.mockResolvedValue([]);
    prismaMock.customerData.findFirst.mockResolvedValue(null);

    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: '4245275089'
      },
      business,
      {
        state: { verification: { status: 'none' } },
        sessionId: 'test-b4'
      }
    );

    expect(result.outcome).not.toBe(ToolOutcome.NOT_FOUND);
    expect(prismaMock.crmOrder.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.crmOrder.findFirst).toHaveBeenCalled();
    expect(prismaMock.crmOrder.findFirst.mock.calls[0][0]?.where?.OR?.[0]).toHaveProperty('customerPhone');
  });

  it('B5: verified session should bypass re-verification and return full order data', async () => {
    prismaMock.crmOrder.findMany.mockResolvedValueOnce([{
      id: 'crm-order-verified-1',
      businessId: 1,
      orderNumber: 'ORD-777777',
      customerName: 'Nurettin Erzen',
      customerPhone: '+14245275089',
      customerEmail: 'nurettin@example.com',
      status: 'kargoda',
      trackingNumber: 'TRK123456',
      carrier: 'Yurtici Kargo',
      estimatedDelivery: '2026-02-28'
    }]);
    prismaMock.customerData.findMany.mockResolvedValue([]);

    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: 'ORD-777777'
      },
      business,
      {
        sessionId: 'test-b5',
        state: {
          verification: {
            status: 'verified',
            anchor: { id: 'prev-anchor-id' }
          }
        }
      }
    );

    expect(result.outcome).toBe(ToolOutcome.OK);
    expect(result.message.toLowerCase()).toContain('kargoda');
    expect(result.data?.order?.status).toBe('kargoda');
    expect(result.data?.order?.trackingNumber).toBe('TRK123456');
    expect(result.data?.order?.carrier).toBe('Yurtici Kargo');
    expect(result.data?.order?.estimatedDelivery).toBeDefined();
  });
});
