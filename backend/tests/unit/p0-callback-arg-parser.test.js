import { describe, it, expect } from '@jest/globals';
import {
  extractCallbackPhone,
  extractCallbackName,
  hydrateCreateCallbackArgs,
  buildCallbackMissingGuidance
} from '../../src/core/orchestrator/steps/06_toolLoop.js';

describe('P0 create_callback deterministic parser', () => {
  it('extracts full name and phone from a single user message', () => {
    const message = 'nurettin erzen. 4245275089';
    expect(extractCallbackPhone(message)).toBe('4245275089');
    expect(extractCallbackName(message)?.toLowerCase()).toBe('nurettin erzen');
  });

  it('hydrates callback args before tool execution', () => {
    const state = {
      extractedSlots: {},
      callbackFlow: { pending: true }
    };

    const hydrated = hydrateCreateCallbackArgs({
      userMessage: 'nurettin erzen. 4245275089',
      state,
      args: {}
    });

    expect(hydrated.hydratedArgs.customerName?.toLowerCase()).toBe('nurettin erzen');
    expect(hydrated.hydratedArgs.customerPhone).toBe('4245275089');
    expect(hydrated.extracted.customer_name?.toLowerCase()).toBe('nurettin erzen');
    expect(hydrated.extracted.phone).toBe('4245275089');
  });

  it('asks only the missing callback field', () => {
    const askPhone = buildCallbackMissingGuidance(['phone'], 'TR').toLowerCase();
    const askName = buildCallbackMissingGuidance(['customer_name'], 'TR').toLowerCase();

    expect(askPhone).toContain('telefon');
    expect(askPhone).not.toContain('ad-soyad ve telefon');

    expect(askName).toContain('ad-soyad');
    expect(askName).not.toContain('telefon numaranizi');
  });
});
