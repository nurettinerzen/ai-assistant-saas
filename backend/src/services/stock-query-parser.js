const SKU_CANDIDATE_PATTERN = /[A-Za-z0-9][A-Za-z0-9/_-]{5,}/g;
const REQUESTED_QTY_PATTERN = /\b(\d{1,4})\s*(?:adet|tane|pcs?|piece|unit|x)\b/gi;
const STOCK_QUERY_STOPWORDS = new Set([
  'merhaba', 'selam', 'slm', 'hey', 'lutfen', 'lütfen', 'rica', 'ederim',
  'bana', 'bir', 'bu', 'su', 'şu', 'sizde', 'sizdeki', 'stok', 'stokta',
  'stoklarinizda', 'stoklarınızda', 'mevcut', 'midir', 'mıdır', 'mudur', 'müdür',
  'mu', 'mü', 'mi', 'mı', 'var', 'varmi', 'varmı', 'varyok', 'yok', 'urun', 'ürün', 'urunu', 'ürünü',
  'urunler', 'ürünler', 'urunden', 'üründen', 'hakkinda', 'hakkında',
  'almak', 'alacagim', 'alacağım', 'alabilir', 'alabilirim', 'istiyorum',
  'istiyorum=', 'ariyorum', 'arıyorum', 'bakar', 'misin', 'misiniz', 'verir',
  'verir misin', 'verir misiniz', 'gorebilir', 'görebilir', 'olur', 'olurmu',
  'olurmu=', 'lazim', 'lazım', 'adet', 'tane', 'stoklarinizda', 'stoklarınızda',
  'mevcutmudur', 'mevcutmudur=', 'mevcutmudur', 'mevcutmu', 'mecvut'
]);

function normalizeStockUtterance(text = '') {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanupToken(token = '') {
  return String(token || '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[^A-Za-z0-9/_-]+$/, '')
    .trim();
}

export function looksLikeSkuCandidate(token = '') {
  const clean = cleanupToken(token);
  if (clean.length < 6) return false;
  if (!/[A-Za-z]/.test(clean)) return false;
  if (!/\d/.test(clean)) return false;
  if (/^\d+$/.test(clean)) return false;
  return true;
}

export function extractSkuCandidates(text = '') {
  const normalized = normalizeStockUtterance(text);
  const matches = normalized.match(SKU_CANDIDATE_PATTERN) || [];
  const deduped = new Set();

  for (const raw of matches) {
    const candidate = cleanupToken(raw);
    if (looksLikeSkuCandidate(candidate)) {
      deduped.add(candidate.toUpperCase());
    }
  }

  return Array.from(deduped);
}

export function extractRequestedQuantity(text = '') {
  const normalized = normalizeStockUtterance(text);
  const matches = [...normalized.matchAll(REQUESTED_QTY_PATTERN)];
  if (matches.length !== 1) return null;
  return matches[0]?.[1] || null;
}

export function detectMultiProductStockQuery(text = '') {
  const normalized = normalizeStockUtterance(text);
  const skuCandidates = extractSkuCandidates(normalized);
  if (skuCandidates.length > 1) return true;

  const qtyMentions = [...normalized.matchAll(REQUESTED_QTY_PATTERN)];
  if (qtyMentions.length > 1) return true;

  return false;
}

export function extractProductSearchPhrase(text = '') {
  const normalized = normalizeStockUtterance(text);
  if (!normalized) return null;

  const skuCandidates = new Set(extractSkuCandidates(normalized));
  const cleaned = normalized
    .replace(REQUESTED_QTY_PATTERN, ' ')
    .replace(/[^\p{L}\p{N}\s/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  const tokens = cleaned
    .split(/\s+/)
    .map(token => cleanupToken(token))
    .filter(Boolean)
    .filter(token => {
      if (skuCandidates.has(token.toUpperCase())) return false;

      const lower = token.toLocaleLowerCase('tr-TR');
      if (STOCK_QUERY_STOPWORDS.has(lower)) return false;
      if (/^\d+$/.test(lower)) return false;
      return lower.length >= 2;
    });

  if (tokens.length === 0) return null;
  return tokens.join(' ').trim() || null;
}

export function buildMultiProductStockClarification(language = 'TR') {
  if (String(language || '').toUpperCase() === 'EN') {
    return 'I detected more than one product in the same stock request. To help accurately, please share one product at a time, preferably with the exact product name or SKU.';
  }

  return 'Aynı stok sorgusunda birden fazla ürün gördüm. Size doğru yardımcı olabilmem için lütfen ürünleri tek tek, mümkünse tam ürün adı veya SKU ile paylaşır mısınız?';
}

export function buildStockQueryArgs({ userMessage, extractedSlots = {}, args = {}, toolName }) {
  const normalizedMessage = normalizeStockUtterance(userMessage);
  const skuCandidates = extractSkuCandidates(normalizedMessage);

  const existingSku =
    args.sku ||
    args.product_sku ||
    args.barcode ||
    extractedSlots.sku ||
    extractedSlots.product_sku ||
    extractedSlots.barcode ||
    null;

  const singleDetectedSku = existingSku || (skuCandidates.length === 1 ? skuCandidates[0] : null);
  const requestedQty = args.requested_qty || extractedSlots.requested_qty || extractRequestedQuantity(normalizedMessage) || null;
  const normalizedProductName = extractProductSearchPhrase(
    args.product_name ||
    extractedSlots.product_name ||
    normalizedMessage
  );

  const resolvedProductName =
    singleDetectedSku ? null : (normalizedProductName || null);

  if (toolName === 'get_product_stock') {
    return {
      product_sku: singleDetectedSku || args.product_sku || null,
      barcode: args.barcode || null,
      product_name: resolvedProductName,
      requested_qty: requestedQty
    };
  }

  return {
    sku: singleDetectedSku || args.sku || null,
    product_name: resolvedProductName,
    requested_qty: requestedQty
  };
}
