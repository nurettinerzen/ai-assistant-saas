import { describe, expect, it } from '@jest/globals';
import { routeMessage } from '../../src/services/message-router.js';

describe('message router stock/product routing', () => {
  it('keeps stock queries toolable even at low confidence', async () => {
    const result = await routeMessage(
      'Artemis var mı stokta?',
      {},
      '',
      'TR',
      {},
      {
        type: 'NEW_INTENT',
        confidence: 0.62,
        suggestedFlow: 'STOCK_CHECK',
        reason: 'test',
        extractedSlots: { product_name: 'artemis' }
      }
    );

    expect(result.routing.action).toBe('RUN_INTENT_ROUTER');
    expect(result.routing.suggestedFlow).toBe('STOCK_CHECK');
  });

  it('keeps product info queries toolable even at low confidence', async () => {
    const result = await routeMessage(
      'iPhone 17 fiyatı nedir?',
      {},
      '',
      'TR',
      {},
      {
        type: 'NEW_INTENT',
        confidence: 0.64,
        suggestedFlow: 'PRODUCT_INFO',
        reason: 'test',
        extractedSlots: { product_name: 'iphone 17' }
      }
    );

    expect(result.routing.action).toBe('RUN_INTENT_ROUTER');
    expect(result.routing.suggestedFlow).toBe('PRODUCT_INFO');
  });
});
