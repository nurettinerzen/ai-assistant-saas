/**
 * Stock Disclosure Policy
 *
 * Controls what stock information is revealed to the user.
 * Prevents raw quantity leakage (trade secret / competitive risk).
 *
 * RULES:
 * 1. NEVER return raw on_hand / available_qty to the LLM.
 * 2. Return availability band: IN_STOCK | LOW_STOCK | OUT_OF_STOCK
 * 3. For quantity requests ("50 adet var mi?"), return threshold check only.
 * 4. Role-based exception: warehouse/admin users CAN see raw quantities.
 */

// ─── Availability bands ────────────────────────────────────────────
const AvailabilityStatus = Object.freeze({
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK'
});

/**
 * Derive availability status from raw quantity
 * @param {boolean} inStock - Whether the product is in stock
 * @param {number|null} quantity - Raw stock quantity (null = unknown)
 * @param {number} lowStockThreshold - Threshold for LOW_STOCK (default: 10)
 * @returns {string} AvailabilityStatus
 */
function deriveAvailabilityStatus(inStock, quantity, lowStockThreshold = 10) {
  if (!inStock || quantity === 0) {
    return AvailabilityStatus.OUT_OF_STOCK;
  }

  if (quantity === null || quantity === undefined) {
    // Unknown quantity but marked as in stock
    return AvailabilityStatus.IN_STOCK;
  }

  if (quantity <= lowStockThreshold) {
    return AvailabilityStatus.LOW_STOCK;
  }

  return AvailabilityStatus.IN_STOCK;
}

/**
 * Check if a requested quantity can be fulfilled (threshold check)
 * Never reveals actual stock count, only YES/NO/PARTIAL
 *
 * @param {number|null} availableQty - Actual available quantity
 * @param {number} requestedQty - Quantity the customer asked about
 * @returns {Object} { result: 'YES'|'NO'|'PARTIAL', range?: [min, max] }
 */
function checkQuantityFulfillment(availableQty, requestedQty) {
  if (availableQty === null || availableQty === undefined) {
    return { result: 'UNKNOWN' };
  }

  if (availableQty >= requestedQty) {
    return { result: 'YES' };
  }

  if (availableQty === 0) {
    return { result: 'NO' };
  }

  // Partial: give a banded range (not exact number)
  const lowerBand = Math.floor(availableQty / 10) * 10;
  const upperBand = Math.ceil(availableQty / 10) * 10;

  return {
    result: 'PARTIAL',
    range: [
      Math.max(1, lowerBand),
      Math.min(upperBand, availableQty)
    ]
  };
}

/**
 * Apply disclosure policy to a stock result before returning to LLM
 *
 * Strips raw quantity and replaces with availability status.
 * Role-based override: if user has warehouse/admin role, raw qty is kept.
 *
 * @param {Object} stockData - Raw stock data from DB
 * @param {Object} options
 * @param {string} [options.userRole] - User role (e.g., 'customer', 'admin', 'warehouse')
 * @param {number} [options.requestedQty] - If user asked "do you have X units?"
 * @param {number} [options.lowStockThreshold] - Custom threshold (default: 10)
 * @returns {Object} Policy-filtered stock data
 */
function applyDisclosurePolicy(stockData, options = {}) {
  const {
    userRole = 'customer',
    requestedQty = null,
    lowStockThreshold = 10
  } = options;

  // Admin/warehouse users get full data
  const privilegedRoles = ['admin', 'warehouse', 'owner'];
  if (privilegedRoles.includes(userRole)) {
    return {
      ...stockData,
      _disclosureLevel: 'FULL'
    };
  }

  // Customer: strip raw quantities
  const inStock = stockData.inStock ?? (stockData.available ?? (stockData.stock > 0));
  const rawQty = stockData.quantity ?? stockData.stock ?? null;

  const status = deriveAvailabilityStatus(inStock, rawQty, lowStockThreshold);

  const filtered = {
    product_name: stockData.product_name || stockData.productName || stockData.title,
    sku: stockData.sku || null,
    availability: status,
    price: stockData.price || null,
    estimated_restock: (!inStock && stockData.estimatedRestock) ? stockData.estimatedRestock : null,
    _disclosureLevel: 'CUSTOMER'
  };

  // Quantity threshold check (if user asked "50 adet var mi?")
  if (requestedQty !== null && requestedQty > 0) {
    filtered.quantity_check = checkQuantityFulfillment(rawQty, requestedQty);
    filtered.quantity_check.requested = requestedQty;
  }

  return filtered;
}

/**
 * Apply disclosure policy to a list of candidates (multiple product matches)
 *
 * @param {Array} candidates - Array of stock records
 * @param {Object} options - Same as applyDisclosurePolicy options
 * @returns {Object} Disambiguation-ready response
 */
function applyDisclosureToCandidates(candidates, options = {}) {
  const {
    userRole = 'customer',
    requestedQty = null,
    lowStockThreshold = 10
  } = options;

  // Admin/warehouse: return full data
  const privilegedRoles = ['admin', 'warehouse', 'owner'];
  if (privilegedRoles.includes(userRole)) {
    return {
      match_type: candidates.length === 1 ? 'EXACT_SKU' : 'MULTIPLE_CANDIDATES',
      candidates: candidates.map(c => ({
        ...c,
        _disclosureLevel: 'FULL'
      })),
      _disclosureLevel: 'FULL'
    };
  }

  // Customer: strip quantities, provide summary
  const dimensions = extractDimensions(candidates);

  return {
    match_type: candidates.length === 1 ? 'EXACT_SKU' : 'MULTIPLE_CANDIDATES',
    candidates_summary: {
      count: candidates.length,
      dimensions,
      top_options: candidates.slice(0, 5).map(c => ({
        id: c.id || c.sku,
        label: c.productName || c.product_name || c.title,
        sku: c.sku
      }))
      // NO stock quantities here
    },
    // If single match, apply individual disclosure
    ...(candidates.length === 1 ? {
      availability: applyDisclosurePolicy(candidates[0], { userRole, requestedQty, lowStockThreshold })
    } : {}),
    _disclosureLevel: 'CUSTOMER'
  };
}

/**
 * Extract variation dimensions from candidates
 * e.g., ["model", "storage", "color"]
 */
function extractDimensions(candidates) {
  const dimensions = new Set();
  const names = candidates.map(c => (c.productName || c.product_name || c.title || '').toLowerCase());

  // Detect common variation patterns
  const patterns = {
    storage: /\b(\d+)\s*(gb|tb)\b/i,
    color: /\b(siyah|beyaz|mavi|kirmizi|kırmızı|yeşil|yesil|gri|pembe|mor|turuncu|sarı|sari|black|white|blue|red|green|gray|grey|pink|purple|orange|yellow|gold|silver|space\s*gray|midnight|starlight|titanium)\b/i,
    model: /\b(pro|max|plus|ultra|lite|mini|se|air)\b/i,
    size: /\b(xs|s|m|l|xl|xxl|\d+\s*(cm|mm|inch|"|'))\b/i,
    carrier: /\b(unlocked|kilitsiz|turkcell|vodafone|turk\s*telekom)\b/i
  };

  for (const name of names) {
    for (const [dim, regex] of Object.entries(patterns)) {
      if (regex.test(name)) {
        dimensions.add(dim);
      }
    }
  }

  // If multiple products but no pattern detected, likely "model" variation
  if (candidates.length > 1 && dimensions.size === 0) {
    dimensions.add('model');
  }

  return [...dimensions];
}

/**
 * Format availability status for human-readable message
 * @param {string} status - AvailabilityStatus value
 * @param {string} language - 'TR' or 'EN'
 * @returns {string}
 */
function formatAvailabilityStatus(status, language = 'TR') {
  const labels = {
    TR: {
      [AvailabilityStatus.IN_STOCK]: 'stokta mevcut',
      [AvailabilityStatus.LOW_STOCK]: 'sınırlı stok',
      [AvailabilityStatus.OUT_OF_STOCK]: 'stokta yok'
    },
    EN: {
      [AvailabilityStatus.IN_STOCK]: 'in stock',
      [AvailabilityStatus.LOW_STOCK]: 'limited stock',
      [AvailabilityStatus.OUT_OF_STOCK]: 'out of stock'
    }
  };

  return (labels[language] || labels.TR)[status] || status;
}

/**
 * Format quantity check result for human-readable message
 * @param {Object} check - Result from checkQuantityFulfillment
 * @param {string} language - 'TR' or 'EN'
 * @returns {string}
 */
function formatQuantityCheck(check, language = 'TR') {
  if (!check) return '';

  if (language === 'TR') {
    switch (check.result) {
      case 'YES':
        return `Evet, ${check.requested} adet karşılanabilir.`;
      case 'NO':
        return `Hayır, ${check.requested} adet şu an karşılanamıyor.`;
      case 'PARTIAL':
        return `Kısmi karşılanabilir: yaklaşık ${check.range[0]}–${check.range[1]} adet mevcut.`;
      case 'UNKNOWN':
        return 'Miktar bilgisi şu an doğrulanamıyor.';
      default:
        return '';
    }
  }

  // English
  switch (check.result) {
    case 'YES':
      return `Yes, ${check.requested} units can be fulfilled.`;
    case 'NO':
      return `No, ${check.requested} units cannot be fulfilled at this time.`;
    case 'PARTIAL':
      return `Partial fulfillment: approximately ${check.range[0]}–${check.range[1]} units available.`;
    case 'UNKNOWN':
      return 'Quantity cannot be verified at this time.';
    default:
      return '';
  }
}

export {
  AvailabilityStatus,
  deriveAvailabilityStatus,
  checkQuantityFulfillment,
  applyDisclosurePolicy,
  applyDisclosureToCandidates,
  extractDimensions,
  formatAvailabilityStatus,
  formatQuantityCheck
};

export default {
  AvailabilityStatus,
  deriveAvailabilityStatus,
  checkQuantityFulfillment,
  applyDisclosurePolicy,
  applyDisclosureToCandidates,
  extractDimensions,
  formatAvailabilityStatus,
  formatQuantityCheck
};
