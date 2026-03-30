import { afterEach, describe, expect, it } from '@jest/globals';
import {
  getConfiguredStripePriceIdsForPlan,
  resolvePlanFromStripePriceId,
  resolveStripePriceIdForPlan,
} from '../../src/services/stripePlanCatalog.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('stripePlanCatalog', () => {
  it('prefers TRY price ids for TR businesses', () => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_usd_starter';
    process.env.STRIPE_STARTER_PRICE_ID_TRY = 'price_try_starter';

    expect(resolveStripePriceIdForPlan('STARTER', 'TR', 'fallback_price')).toBe('price_try_starter');
  });

  it('falls back to default price id when regional price is missing', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_default_pro';

    expect(resolveStripePriceIdForPlan('PRO', 'TR', 'fallback_price')).toBe('price_default_pro');
    expect(resolveStripePriceIdForPlan('PRO', 'US', 'fallback_price')).toBe('price_default_pro');
  });

  it('resolves plans from any configured regional price id', () => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_default';
    process.env.STRIPE_STARTER_PRICE_ID_TRY = 'price_starter_try';
    process.env.STRIPE_PRO_PRICE_ID_TRY = 'price_pro_try';

    expect(resolvePlanFromStripePriceId('price_starter_default')).toBe('STARTER');
    expect(resolvePlanFromStripePriceId('price_starter_try')).toBe('STARTER');
    expect(resolvePlanFromStripePriceId('price_pro_try')).toBe('PRO');
  });

  it('returns unique configured ids only', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_same';
    process.env.STRIPE_PRO_PRICE_ID_TRY = 'price_same';
    process.env.STRIPE_PRO_PRICE_ID_EUR = 'price_pro_eur';

    expect(getConfiguredStripePriceIdsForPlan('PRO')).toEqual(['price_same', 'price_pro_eur']);
  });
});
