/**
 * CRM Stock Handler
 *
 * LLM-first approach: returns the full stock catalog to LLM.
 * LLM decides which product matches the customer's query (handles typos,
 * Turkish chars, partial names, etc.) and responds accordingly.
 *
 * - SKU given → exact match (single product)
 * - product_name given → return full catalog, LLM matches
 * - Stock Disclosure Policy: NEVER return raw quantities to LLM
 */

import prisma from '../../prismaClient.js';
import { ok, notFound, systemError } from '../toolResult.js';
import {
  applyDisclosurePolicy,
  formatAvailabilityStatus,
  formatQuantityCheck
} from '../../policies/stockDisclosurePolicy.js';

const CATALOG_LIMIT = 200;

/**
 * Execute CRM stock check
 */
export async function execute(args, business, context = {}) {
  try {
    const { product_name, sku, requested_qty } = args;
    const language = business.language || 'TR';

    console.log('🔍 CRM: Checking stock:', { product_name, sku, requested_qty });

    const reqQty = requested_qty ? parseInt(requested_qty, 10) : null;

    // ─── SKU: exact match ──────────────────────────────────────────
    if (sku) {
      const candidates = await prisma.crmStock.findMany({
        where: { businessId: business.id, sku: { equals: sku, mode: 'insensitive' } },
        take: 5
      });

      if (candidates.length === 0) {
        return notFound(
          language === 'TR'
            ? `"${sku}" SKU kodlu ürün bulunamadı.`
            : `Product with SKU "${sku}" not found.`
        );
      }

      const stock = candidates[0];
      const disclosed = applyDisclosurePolicy(stock, { requestedQty: reqQty });

      return ok({
        match_type: 'EXACT_SKU',
        sku: stock.sku,
        product_name: stock.productName,
        availability: disclosed.availability,
        price: stock.price,
        estimated_restock: disclosed.estimated_restock,
        quantity_check: disclosed.quantity_check || null,
        last_update: stock.externalUpdatedAt
      }, formatSingleStockMessage(stock, disclosed, language));
    }

    // ─── Product name: return full catalog, LLM decides ────────────
    const allStock = await prisma.crmStock.findMany({
      where: { businessId: business.id },
      select: {
        sku: true,
        productName: true,
        inStock: true,
        price: true,
        estimatedRestock: true,
        externalUpdatedAt: true
      },
      orderBy: { productName: 'asc' },
      take: CATALOG_LIMIT
    });

    if (allStock.length === 0) {
      return notFound(
        language === 'TR'
          ? 'Bu işletme için stok verisi bulunamadı.'
          : 'No stock data found for this business.'
      );
    }

    console.log(`✅ CRM Stock: Returning ${allStock.length} items from catalog`);

    // Build compact catalog for LLM
    const catalog = allStock.map(item => ({
      sku: item.sku,
      name: item.productName,
      in_stock: item.inStock,
      price: item.price
    }));

    const responseMessage = language === 'TR'
      ? `Stok kataloğunda ${allStock.length} ürün bulundu. Müşterinin sorduğu "${product_name || ''}" ile eşleşen ürünü belirle ve stok durumunu bildir.`
      : `Found ${allStock.length} products in stock catalog. Match the customer's query "${product_name || ''}" and report stock status.`;

    return ok({
      match_type: 'CATALOG',
      search_term: product_name || null,
      total_products: allStock.length,
      catalog
    }, responseMessage);

  } catch (error) {
    console.error('❌ CRM stock lookup error:', error);
    return systemError(
      business.language === 'TR'
        ? 'Stok sorgusunda sistem hatası oluştu.'
        : 'System error during stock query.',
      error
    );
  }
}

// ─── Formatting helpers ──────────────────────────────────────────────

function formatSingleStockMessage(stock, disclosed, language) {
  const statusLabel = formatAvailabilityStatus(disclosed.availability, language);

  if (language === 'TR') {
    let message = `${stock.productName}: ${statusLabel}.`;

    if (disclosed.quantity_check) {
      message += ` ${formatQuantityCheck(disclosed.quantity_check, 'TR')}`;
    }

    if (disclosed.availability === 'OUT_OF_STOCK' && stock.estimatedRestock) {
      const date = new Date(stock.estimatedRestock);
      message += ` Tahmini stok yenileme tarihi: ${date.toLocaleDateString('tr-TR')}.`;
    }

    if (stock.price) {
      message += ` Fiyat: ${stock.price.toLocaleString('tr-TR')} TL.`;
    }

    return message;
  }

  let message = `${stock.productName}: ${statusLabel}.`;

  if (disclosed.quantity_check) {
    message += ` ${formatQuantityCheck(disclosed.quantity_check, 'EN')}`;
  }

  if (disclosed.availability === 'OUT_OF_STOCK' && stock.estimatedRestock) {
    const date = new Date(stock.estimatedRestock);
    message += ` Expected restock date: ${date.toLocaleDateString('en-US')}.`;
  }

  if (stock.price) {
    message += ` Price: ${stock.price} TL.`;
  }

  return message;
}

export default { execute };
