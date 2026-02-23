import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ToolOutcome } from '../../src/tools/toolResult.js';
import {
  ORDER_NUMBER_EXAMPLE,
  getOrderNumberValidationMessage,
  isLikelyValidOrderNumber,
  normalizeOrderNumber
} from '../../src/utils/order-number.js';

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
});

describe('Order number validation contract', () => {
  it('accepts production-supported formats and normalizes consistently', () => {
    expect(isLikelyValidOrderNumber('ORD-123456')).toBe(true);
    expect(isLikelyValidOrderNumber('ORDER_2024_001')).toBe(true);
    expect(isLikelyValidOrderNumber('SIP 987654')).toBe(true);
    expect(isLikelyValidOrderNumber('123456')).toBe(true);

    expect(normalizeOrderNumber('ORD-2024-001')).toBe('2024001');
    expect(normalizeOrderNumber('ORDER_123456')).toBe('123456');
    expect(normalizeOrderNumber(' 123 456 ')).toBe('123456');
  });

  it('rejects unsupported or alpha-mixed formats', () => {
    expect(isLikelyValidOrderNumber('ORD-TEST-7890')).toBe(false);
    expect(isLikelyValidOrderNumber('XYZ9999')).toBe(false);
    expect(isLikelyValidOrderNumber('ORD-ABCD')).toBe(false);
  });

  it('returns one-question validation guidance with example format', () => {
    const message = getOrderNumberValidationMessage('TR');
    expect(message).toContain(ORDER_NUMBER_EXAMPLE);
    expect(message).toContain('paylaşır mısın');
  });
});

describe('customer_data_lookup validation result contract', () => {
  it('returns VALIDATION_ERROR + structured validation metadata for fake order prefixes', async () => {
    const result = await executeLookup(
      {
        query_type: 'siparis',
        order_number: 'ORD-TEST-7890'
      },
      { id: 1, language: 'TR' },
      { state: {}, sessionId: 'order-validation-contract-test' }
    );

    expect(result.outcome).toBe(ToolOutcome.VALIDATION_ERROR);
    expect(result.field).toBe('order_number');
    expect(result.expectedFormat).toBe(ORDER_NUMBER_EXAMPLE);
    expect(result.promptStyle).toBe('single_question_with_example');
    expect(result.validationCode).toBe('ORDER_NUMBER_FORMAT_INVALID');
    expect(result.message).toContain(ORDER_NUMBER_EXAMPLE);
    expect(prismaMock.crmOrder.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.customerData.findMany).not.toHaveBeenCalled();
  });
});

