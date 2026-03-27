import { describe, expect, it } from '@jest/globals';
import {
  buildMultiProductStockClarification,
  buildStockQueryArgs,
  detectMultiProductStockQuery,
  extractProductSearchPhrase,
  extractRequestedQuantity,
  extractSkuCandidates,
  looksLikeSkuCandidate
} from '../../src/services/stock-query-parser.js';

describe('stock query parser', () => {
  it('detects bare SKU queries inside natural language', () => {
    expect(looksLikeSkuCandidate('RRCAPL0126')).toBe(true);
    expect(extractSkuCandidates('RRCAPL0126 stokta var mı')).toEqual(['RRCAPL0126']);
    expect(buildStockQueryArgs({
      userMessage: 'RRCAPL0126 stokta var mı',
      extractedSlots: {},
      args: {},
      toolName: 'check_stock_crm'
    })).toEqual({
      sku: 'RRCAPL0126',
      product_name: null,
      requested_qty: null
    });
  });

  it('falls back to product_name for natural product family queries', () => {
    expect(extractProductSearchPhrase('artemis var mı stokta')).toBe('artemis');
    expect(buildStockQueryArgs({
      userMessage: 'artemis var mı stokta',
      extractedSlots: {},
      args: {},
      toolName: 'check_stock_crm'
    })).toEqual({
      sku: null,
      product_name: 'artemis',
      requested_qty: null
    });
  });

  it('removes boilerplate from natural stock utterances', () => {
    expect(extractProductSearchPhrase('Merhaba Artemis Ses Geçidi var mı stokta?')).toBe('Artemis Ses Geçidi');
  });

  it('extracts requested quantity only when explicitly given', () => {
    expect(extractRequestedQuantity('2 adet Apple iPhone 17 var mı')).toBe('2');
    expect(extractRequestedQuantity('Apple iPhone 17 stokta ne kadar var')).toBeNull();
  });

  it('detects multi-product stock queries for clarification', () => {
    expect(detectMultiProductStockQuery('2 adet ASUS M3N78VM 1 adet ECS H55H-M H55 DDR3 almak istiyorum')).toBe(true);
    expect(buildMultiProductStockClarification('TR')).toContain('birden fazla ürün');
  });
});
