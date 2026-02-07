/**
 * Deterministic variant selector.
 * Ensures stable wording choice for the same seed while allowing controlled variation.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function stableHash(value = '') {
  const input = String(value);
  let hash = FNV_OFFSET_BASIS;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to unsigned 32-bit integer
  return hash >>> 0;
}

export function buildDeterministicSeed(parts = []) {
  return parts
    .filter(part => part !== undefined && part !== null && String(part).length > 0)
    .map(part => String(part))
    .join('|');
}

export function selectVariantIndex(variantCount, seed = '') {
  if (!Number.isInteger(variantCount) || variantCount <= 1) {
    return 0;
  }

  const hash = stableHash(seed || 'default-seed');
  return hash % variantCount;
}

export function selectVariant(variants, seed = '') {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { value: '', index: 0 };
  }

  const index = selectVariantIndex(variants.length, seed);
  return {
    value: variants[index],
    index
  };
}

