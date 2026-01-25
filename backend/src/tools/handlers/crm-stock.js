/**
 * CRM Stock Handler
 * Checks stock from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';
import { ok, notFound, validationError, systemError } from '../toolResult.js';

/**
 * Execute CRM stock check
 */
export async function execute(args, business, context = {}) {
  try {
    const { product_name, sku } = args;
    const language = business.language || 'TR';

    console.log('🔍 CRM: Checking stock:', { product_name, sku });

    // Validate - at least one parameter required
    if (!product_name && !sku) {
      return validationError(
        language === 'TR'
          ? 'Ürün adı veya SKU kodu gerekli.'
          : 'Product name or SKU is required.',
        'product_name | sku'
      );
    }

    // Build query
    const whereClause = { businessId: business.id };

    if (sku) {
      whereClause.sku = { equals: sku, mode: 'insensitive' };
    } else if (product_name) {
      whereClause.OR = [
        { sku: { contains: product_name, mode: 'insensitive' } },
        { productName: { contains: product_name, mode: 'insensitive' } }
      ];
    }

    // Search for stock
    const stock = await prisma.crmStock.findFirst({
      where: whereClause
    });

    if (!stock) {
      return notFound(
        language === 'TR'
          ? `"${product_name || sku}" için stok bilgisi bulunamadı.`
          : `Stock information not found for "${product_name || sku}".`
      );
    }

    console.log(`✅ CRM Stock found: ${stock.productName}`);

    // Format response
    const responseMessage = formatStockMessage(stock, language);

    return ok({
      sku: stock.sku,
      product_name: stock.productName,
      in_stock: stock.inStock,
      quantity: stock.quantity,
      price: stock.price,
      estimated_restock: stock.estimatedRestock,
      last_update: stock.externalUpdatedAt
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

// Format stock message
function formatStockMessage(stock, language) {
  if (language === 'TR') {
    let message = `${stock.productName}`;

    if (stock.inStock) {
      message += ` stokta mevcut`;
      if (stock.quantity !== null) {
        message += ` (${stock.quantity} adet)`;
      }
      message += '.';
    } else {
      message += ` şu anda stokta yok.`;
      if (stock.estimatedRestock) {
        const date = new Date(stock.estimatedRestock);
        message += ` Tahmini stok yenileme tarihi: ${date.toLocaleDateString('tr-TR')}.`;
      }
    }

    if (stock.price) {
      message += ` Fiyat: ${stock.price.toLocaleString('tr-TR')} TL.`;
    }

    return message;
  }

  let message = `${stock.productName}`;

  if (stock.inStock) {
    message += ` is in stock`;
    if (stock.quantity !== null) {
      message += ` (${stock.quantity} available)`;
    }
    message += '.';
  } else {
    message += ` is currently out of stock.`;
    if (stock.estimatedRestock) {
      const date = new Date(stock.estimatedRestock);
      message += ` Expected restock date: ${date.toLocaleDateString('en-US')}.`;
    }
  }

  if (stock.price) {
    message += ` Price: ${stock.price} TL.`;
  }

  return message;
}

export default { execute };
