import { describe, it, expect } from '@jest/globals';
import {
  isFieldGroundingResponseComplete,
  buildDeterministicOrderResponse
} from '../../src/core/handleIncomingMessage.js';

describe('P0 FIELD_GROUNDING regression helpers', () => {
  const payload = {
    status: 'kargoda',
    trackingNumber: 'TRK123456',
    carrier: 'Yurtici Kargo',
    estimatedDelivery: '28 Subat 2026',
    items: ['Kulaklik'],
    totalAmount: '1499'
  };

  it('flags correction output as incomplete when required order fields are dropped', () => {
    const minimal = 'Siparisiniz kargoda.';
    expect(
      isFieldGroundingResponseComplete(minimal, payload, 'Siparisiniz kargoda. Takip no TRK123456, firma Yurtici Kargo.')
    ).toBe(false);
  });

  it('builds deterministic response containing required order detail fields', () => {
    const deterministic = buildDeterministicOrderResponse(payload, 'TR').toLowerCase();
    expect(deterministic).toContain('status');
    expect(deterministic).toContain('trackingnumber');
    expect(deterministic).toContain('carrier');
    expect(deterministic).toContain('estimateddelivery');
    expect(deterministic).toContain('trk123456');
    expect(deterministic).toContain('yurtici kargo');
  });
});
