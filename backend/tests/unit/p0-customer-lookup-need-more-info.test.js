import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';

const prismaMock = {
  crmOrder: {
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
  prismaMock.crmOrder.findFirst.mockResolvedValue(null);
  prismaMock.customerData.findMany.mockResolvedValue([]);
  prismaMock.customerData.findFirst.mockResolvedValue(null);
  prismaMock.crmOrder.findUnique.mockResolvedValue(null);
  prismaMock.customerData.findUnique.mockResolvedValue(null);
});

describe('P0 customer_data_lookup deterministic outcomes', () => {
  const business = { id: 1, language: 'TR' };

  it('B1: order without last4 should return NEED_MORE_INFO and ask only phone_last4', async () => {
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

    expect(result.outcome).toBe(ToolOutcome.NEED_MORE_INFO);
    expect(result.askFor).toEqual(['phone_last4']);
    expect(result.message.toLowerCase()).toContain('son 4');
    expect(result.message.toLowerCase()).not.toContain('sipariş numaranızı paylaş');
    expect(prismaMock.crmOrder.findFirst).not.toHaveBeenCalled();
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

    expect(prismaMock.crmOrder.findFirst).toHaveBeenCalled();
    expect(result.outcome).toBe(ToolOutcome.NOT_FOUND);
    expect(result.outcome).not.toBe(ToolOutcome.NEED_MORE_INFO);
  });
});
