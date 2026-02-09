/**
 * Product Stock Handler
 * Checks product availability via E-commerce Aggregator (Shopify, WooCommerce, etc.)
 *
 * PRIORITY: WebhookInventory > CrmStock > E-commerce platforms
 *
 * ARCHITECTURE:
 * - Phase A: Candidate listing (findMany, not findFirst)
 * - Phase B: Disambiguation if multiple candidates
 * - Stock Disclosure Policy: NEVER return raw quantities to LLM
 *
 * match_type: EXACT_SKU | MULTIPLE_CANDIDATES | NO_MATCH
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';
import prisma from '../../prismaClient.js';
import { ok, notFound, validationError, systemError } from '../toolResult.js';
import {
  applyDisclosurePolicy,
  applyDisclosureToCandidates,
  formatAvailabilityStatus,
  formatQuantityCheck
} from '../../policies/stockDisclosurePolicy.js';

/**
 * Execute product stock check
 */
export async function execute(args, business, context = {}) {
  try {
    const { product_name, barcode, product_sku, requested_qty } = args;
    const language = business.language || 'TR';

    console.log('🔍 Checking product stock:', { product_name, barcode, product_sku, requested_qty });

    // Validate input
    if (!product_name && !barcode && !product_sku) {
      return validationError(
        language === 'TR'
          ? 'Ürün adı, barkod veya SKU gerekli.'
          : 'Product name, barcode, or SKU is required.',
        'product_name | barcode | product_sku'
      );
    }

    const searchTerm = product_name || barcode || product_sku;
    const reqQty = requested_qty ? parseInt(requested_qty, 10) : null;

    // ============================================================================
    // PRIORITY 1: Check WebhookInventory (Shopify/İkas webhook data)
    // ============================================================================
    console.log('🔗 Checking WebhookInventory');

    const webhookWhere = { businessId: business.id };
    if (product_sku || barcode) {
      webhookWhere.sku = { equals: product_sku || barcode, mode: 'insensitive' };
    } else {
      webhookWhere.productName = { contains: product_name, mode: 'insensitive' };
    }

    const webhookCandidates = await prisma.webhookInventory.findMany({
      where: webhookWhere,
      take: 20
    });

    if (webhookCandidates.length > 0) {
      console.log(`✅ Found ${webhookCandidates.length} in WebhookInventory`);
      return handleCandidates(webhookCandidates, 'webhook', searchTerm, reqQty, language);
    }

    // ============================================================================
    // PRIORITY 2: Check CrmStock (Custom CRM data)
    // ============================================================================
    console.log('🔗 Checking CrmStock');

    const crmWhere = { businessId: business.id };
    if (product_sku || barcode) {
      crmWhere.sku = { equals: product_sku || barcode, mode: 'insensitive' };
    } else {
      crmWhere.productName = { contains: product_name, mode: 'insensitive' };
    }

    const crmCandidates = await prisma.crmStock.findMany({
      where: crmWhere,
      take: 20
    });

    if (crmCandidates.length > 0) {
      console.log(`✅ Found ${crmCandidates.length} in CrmStock`);
      return handleCandidates(crmCandidates, 'crm', searchTerm, reqQty, language);
    }

    console.log('⚠️ Not found in integrations, checking e-commerce platforms...');

    // ============================================================================
    // PRIORITY 3: Check E-commerce platforms (Shopify, İkas, etc.)
    // ============================================================================
    const result = await ecommerceAggregator.searchProductStock(business.id, product_name || product_sku);

    // Handle not found / no platform
    if (!result.success) {
      if (result.code === 'NO_PLATFORM') {
        return validationError(
          language === 'TR'
            ? 'E-ticaret platformu bağlı değil.'
            : 'No e-commerce platform connected.',
          'integration'
        );
      }

      return notFound(
        language === 'TR'
          ? `"${searchTerm}" için stok bilgisi bulunamadı.`
          : `Stock information not found for "${searchTerm}".`
      );
    }

    const product = result.product;
    console.log(`✅ Product found from ${product.platform}: ${product.title}`);

    // E-commerce products may have variants → treat as disambiguation
    if (product.variants && product.variants.length > 1) {
      return handleEcommerceVariants(product, searchTerm, reqQty, language);
    }

    // Single product from e-commerce
    const disclosed = applyDisclosurePolicy({
      inStock: product.available,
      stock: product.totalStock,
      productName: product.title,
      price: product.price
    }, {
      requestedQty: reqQty
    });

    const responseMessage = formatSingleProductMessage(product.title, disclosed, language);

    return ok({
      match_type: 'EXACT_SKU',
      title: product.title,
      availability: disclosed.availability,
      quantity_check: disclosed.quantity_check || null,
      platform: product.platform
      // NOTE: raw stock count is NEVER included
    }, responseMessage);

  } catch (error) {
    console.error('❌ Get product stock error:', error);
    return systemError(
      business.language === 'TR'
        ? 'Stok sorgusunda sistem hatası oluştu.'
        : 'System error during stock query.',
      error
    );
  }
}

// ─── Internal helpers ────────────────────────────────────────────────

/**
 * Handle candidates from WebhookInventory or CrmStock
 */
function handleCandidates(candidates, platform, searchTerm, reqQty, language) {
  if (candidates.length === 1) {
    const item = candidates[0];
    const inStock = platform === 'webhook'
      ? item.stock > 0
      : item.inStock && (item.quantity === null || item.quantity > 0);

    const disclosed = applyDisclosurePolicy({
      inStock,
      stock: platform === 'webhook' ? item.stock : item.quantity,
      productName: item.productName,
      sku: item.sku,
      price: item.price,
      estimatedRestock: item.estimatedRestock
    }, {
      requestedQty: reqQty
    });

    const responseMessage = formatSingleProductMessage(item.productName, disclosed, language);

    return ok({
      match_type: 'EXACT_SKU',
      title: item.productName,
      sku: item.sku,
      availability: disclosed.availability,
      quantity_check: disclosed.quantity_check || null,
      price: item.price || null,
      estimated_restock: disclosed.estimated_restock || null,
      platform
      // NOTE: raw stock count is NEVER included
    }, responseMessage);
  }

  // Multiple candidates → disambiguation
  const normalizedCandidates = candidates.map(c => ({
    productName: c.productName,
    sku: c.sku,
    inStock: platform === 'webhook' ? c.stock > 0 : c.inStock,
    quantity: platform === 'webhook' ? c.stock : c.quantity,
    price: c.price
  }));

  const disambiguationResult = applyDisclosureToCandidates(normalizedCandidates, {
    requestedQty: reqQty
  });

  const responseMessage = formatDisambiguationMessage(searchTerm, disambiguationResult, language);

  return ok({
    match_type: 'MULTIPLE_CANDIDATES',
    search_term: searchTerm,
    candidates_summary: disambiguationResult.candidates_summary,
    disambiguation_required: true,
    platform
  }, responseMessage);
}

/**
 * Handle e-commerce products with multiple variants
 */
function handleEcommerceVariants(product, searchTerm, reqQty, language) {
  const variantCandidates = product.variants.map(v => ({
    productName: `${product.title} - ${v.title}`,
    sku: v.sku || v.title,
    inStock: v.available,
    quantity: v.stock
  }));

  const disambiguationResult = applyDisclosureToCandidates(variantCandidates, {
    requestedQty: reqQty
  });

  const responseMessage = formatDisambiguationMessage(searchTerm, disambiguationResult, language);

  return ok({
    match_type: 'MULTIPLE_CANDIDATES',
    search_term: searchTerm,
    product_family: product.title,
    candidates_summary: disambiguationResult.candidates_summary,
    disambiguation_required: true,
    platform: product.platform
  }, responseMessage);
}

// ─── Formatting helpers ──────────────────────────────────────────────

/**
 * Format stock message for a single product (no raw quantity)
 */
function formatSingleProductMessage(productName, disclosed, language) {
  const statusLabel = formatAvailabilityStatus(disclosed.availability, language);

  if (language === 'TR') {
    let message = `"${productName}": ${statusLabel}.`;

    if (disclosed.quantity_check) {
      message += ` ${formatQuantityCheck(disclosed.quantity_check, 'TR')}`;
    }

    if (disclosed.price) {
      message += ` Fiyat: ${disclosed.price} TL.`;
    }

    if (disclosed.estimated_restock) {
      const date = new Date(disclosed.estimated_restock);
      message += ` Tahmini stok yenileme: ${date.toLocaleDateString('tr-TR')}.`;
    }

    return message;
  }

  // English
  let message = `"${productName}": ${statusLabel}.`;

  if (disclosed.quantity_check) {
    message += ` ${formatQuantityCheck(disclosed.quantity_check, 'EN')}`;
  }

  if (disclosed.price) {
    message += ` Price: ${disclosed.price} TRY.`;
  }

  if (disclosed.estimated_restock) {
    const date = new Date(disclosed.estimated_restock);
    message += ` Estimated restock: ${date.toLocaleDateString('en-US')}.`;
  }

  return message;
}

/**
 * Format disambiguation message when multiple candidates found
 */
function formatDisambiguationMessage(searchTerm, result, language) {
  const { candidates_summary } = result;
  const count = candidates_summary.count;
  const options = candidates_summary.top_options.map(o => o.label);
  const dims = candidates_summary.dimensions;

  if (language === 'TR') {
    let message = `"${searchTerm}" araması için ${count} farklı ürün bulundu.`;

    if (dims.length > 0) {
      const dimLabels = {
        model: 'model',
        storage: 'depolama',
        color: 'renk',
        size: 'beden',
        carrier: 'operatör'
      };
      const dimStr = dims.map(d => dimLabels[d] || d).join(', ');
      message += ` Varyasyon boyutları: ${dimStr}.`;
    }

    message += ` Seçenekler: ${options.join(', ')}.`;
    message += ` Stok durumu ürüne göre değişiyor. Hangi ürünü sorgulamak istediğini netleştirmek gerekiyor.`;

    return message;
  }

  // English
  let message = `Found ${count} products matching "${searchTerm}".`;

  if (dims.length > 0) {
    message += ` Variation dimensions: ${dims.join(', ')}.`;
  }

  message += ` Options: ${options.join(', ')}.`;
  message += ` Stock status varies by product. Please specify which one you'd like to check.`;

  return message;
}

export default { execute };
