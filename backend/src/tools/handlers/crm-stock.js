/**
 * CRM Stock Handler
 * Checks stock from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';

/**
 * Execute CRM stock check
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { product_name, sku } = args;

    console.log('🔍 CRM: Checking stock:', { product_name, sku });

    // Validate - at least one parameter required
    if (!product_name && !sku) {
      return {
        success: false,
        validation: {
          status: "missing_params",
          provided: { product_name, sku },
          expectedParams: ['product_name', 'sku']
        },
        context: { language: business.language }
      };
    }

    // Build query
    const whereClause = {
      businessId: business.id
    };

    if (sku) {
      // Exact match for SKU (case insensitive)
      whereClause.sku = { equals: sku, mode: 'insensitive' };
    } else if (product_name) {
      // Partial match for product name or SKU
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
      return {
        success: false,
        validation: {
          status: "not_found",
          searchCriteria: { product_name, sku },
          platform: "crm"
        },
        context: { language: business.language }
      };
    }

    console.log(`✅ CRM Stock found: ${stock.productName}`);

    // Format response
    const responseMessage = formatStockMessage(stock, business.language);

    return {
      success: true,
      data: {
        sku: stock.sku,
        product_name: stock.productName,
        in_stock: stock.inStock,
        quantity: stock.quantity,
        price: stock.price,
        estimated_restock: stock.estimatedRestock,
        last_update: stock.externalUpdatedAt
      },
      message: responseMessage
    };

  } catch (error) {
    console.error('❌ CRM stock lookup error:', error);
    return {
      success: false,
      validation: {
        status: "system_error",
        issue: "crm_query_failed",
        errorMessage: error.message
      },
      context: { language: business.language }
    };
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
