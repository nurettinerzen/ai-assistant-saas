import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';
import {
  isLikelyValidOrderNumber,
  normalizeOrderLookupInput,
  normalizeOrderNumber
} from '../../src/utils/order-number.js';

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
  prismaMock.crmOrder.findUnique.mockResolvedValue(null);
  prismaMock.customerData.findMany.mockResolvedValue([]);
  prismaMock.customerData.findFirst.mockResolvedValue(null);
  prismaMock.customerData.findUnique.mockResolvedValue(null);
});

describe('Order number validation contract', () => {
  it('keeps minimal validation and normalizes consistently', () => {
    expect(isLikelyValidOrderNumber('ORD-123456')).toBe(true);
    expect(isLikelyValidOrderNumber('ORD-TEST-7890')).toBe(true);
    expect(isLikelyValidOrderNumber('XYZ9999')).toBe(true);
    expect(isLikelyValidOrderNumber('ORDER_2024_001')).toBe(true);
    expect(isLikelyValidOrderNumber('SIP 987654')).toBe(true);
    expect(isLikelyValidOrderNumber('123456')).toBe(true);

    expect(normalizeOrderLookupInput('  ord -  123  ')).toBe('ORD - 123');
    expect(normalizeOrderNumber('ORD-2024-001')).toBe('2024001');
    expect(normalizeOrderNumber('ORDER_123456')).toBe('123456');
    expect(normalizeOrderNumber(' 123 456 ')).toBe('123456');
  });

  it('rejects only empty or very short inputs', () => {
    expect(isLikelyValidOrderNumber('')).toBe(false);
    expect(isLikelyValidOrderNumber('  ')).toBe(false);
    expect(isLikelyValidOrderNumber('12')).toBe(false);
    expect(isLikelyValidOrderNumber('--')).toBe(false);
  });
});

describe('customer_data_lookup validation result contract', () => {
  it('does not reject alphanumeric order formats before DB lookup', async () => {
    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: 'ORD-TEST-7890'
      },
      { id: 1, language: 'TR' },
      { state: {}, sessionId: 'order-validation-contract-test' }
    );

    expect(result.outcome).toBe(ToolOutcome.NOT_FOUND);
    expect(prismaMock.crmOrder.findMany).toHaveBeenCalled();
    expect(prismaMock.customerData.findMany).toHaveBeenCalled();
  });

  it('returns VALIDATION_ERROR only for too-short order identifiers', async () => {
    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: '12'
      },
      { id: 1, language: 'TR' },
      { state: {}, sessionId: 'order-validation-short-test' }
    );

    expect(result.outcome).toBe(ToolOutcome.VALIDATION_ERROR);
    expect(result.field).toBe('order_number');
    expect(prismaMock.crmOrder.findMany).not.toHaveBeenCalled();
    expect(prismaMock.customerData.findMany).not.toHaveBeenCalled();
  });

  it('returns NEED_MORE_INFO when normalized order lookup matches multiple records', async () => {
    prismaMock.crmOrder.findMany.mockResolvedValueOnce([
      {
        id: 'crm-order-raw',
        businessId: 1,
        orderNumber: 'ORD-12345',
        customerName: 'Raw Match',
        customerPhone: '+905551111111',
        status: 'Hazırlanıyor'
      },
      {
        id: 'crm-order-compact',
        businessId: 1,
        orderNumber: '12345',
        customerName: 'Compact Match',
        customerPhone: '+905552222222',
        status: 'Hazırlanıyor'
      }
    ]);

    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: 'ORD-12345'
      },
      { id: 1, language: 'TR' },
      { state: {}, sessionId: 'order-ambiguity-test' }
    );

    expect(result.outcome).toBe(ToolOutcome.NEED_MORE_INFO);
    expect(result.field).toBe('order_number');
    expect(result.ambiguity).toBe(true);
  });
});
