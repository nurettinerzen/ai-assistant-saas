/**
 * Product Stock Handler
 * Checks product availability via E-commerce Aggregator (Shopify, WooCommerce)
 * PRIORITY: WebhookInventory > CrmStock > E-commerce platforms
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';
import prisma from '../../prismaClient.js';

/**
 * Execute product stock check
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { product_name } = args;

    console.log('🔍 Checking product stock:', { product_name });

    // Validate input
    if (!product_name) {
      return {
        success: false,
        validation: {
          status: "missing_params",
          provided: { product_name },
          missingParams: ['product_name']
        },
        context: { language: business.language }
      };
    }

    // ============================================================================
    // PRIORITY 1: Check WebhookInventory (Shopify/İkas webhook data)
    // ============================================================================
    console.log('🔗 Checking WebhookInventory');
    const webhookStock = await prisma.webhookInventory.findFirst({
      where: {
        businessId: business.id,
        productName: {
          contains: product_name,
          mode: 'insensitive'
        }
      }
    });

    if (webhookStock) {
      console.log('✅ Found in WebhookInventory:', webhookStock.productName);
      const inStock = webhookStock.stock > 0;
      const responseMessage = business.language === 'TR'
        ? `"${webhookStock.productName}" ${inStock ? `stoğumuzda mevcut (${webhookStock.stock} adet)` : 'şu anda stokta yok'}.`
        : `"${webhookStock.productName}" is ${inStock ? `in stock (${webhookStock.stock} units)` : 'currently out of stock'}.`;

      return {
        success: true,
        data: {
          title: webhookStock.productName,
          sku: webhookStock.sku,
          available: inStock,
          stock: webhookStock.stock,
          platform: 'webhook'
        },
        message: responseMessage
      };
    }

    // ============================================================================
    // PRIORITY 2: Check CrmStock (Custom CRM data)
    // ============================================================================
    console.log('🔗 Checking CrmStock');
    const crmStock = await prisma.crmStock.findFirst({
      where: {
        businessId: business.id,
        productName: {
          contains: product_name,
          mode: 'insensitive'
        }
      }
    });

    if (crmStock) {
      console.log('✅ Found in CrmStock:', crmStock.productName);
      const inStock = crmStock.inStock && (crmStock.quantity === null || crmStock.quantity > 0);
      const responseMessage = business.language === 'TR'
        ? `"${crmStock.productName}" ${inStock ? (crmStock.quantity ? `stoğumuzda mevcut (${crmStock.quantity} adet)` : 'stoğumuzda mevcut') : 'şu anda stokta yok'}.${crmStock.price ? ` Fiyat: ${crmStock.price} TL` : ''}${crmStock.estimatedRestock && !inStock ? ` Tahmini stok girişi: ${crmStock.estimatedRestock.toLocaleDateString('tr-TR')}` : ''}`
        : `"${crmStock.productName}" is ${inStock ? (crmStock.quantity ? `in stock (${crmStock.quantity} units)` : 'in stock') : 'currently out of stock'}.${crmStock.price ? ` Price: ${crmStock.price} TRY` : ''}${crmStock.estimatedRestock && !inStock ? ` Estimated restock: ${crmStock.estimatedRestock.toLocaleDateString('en-US')}` : ''}`;

      return {
        success: true,
        data: {
          title: crmStock.productName,
          sku: crmStock.sku,
          available: inStock,
          stock: crmStock.quantity,
          price: crmStock.price,
          platform: 'crm'
        },
        message: responseMessage
      };
    }

    console.log('⚠️ Not found in integrations, checking e-commerce platforms...');

    // ============================================================================
    // PRIORITY 3: Check E-commerce platforms (Shopify, İkas, etc.)
    // ============================================================================
    const result = await ecommerceAggregator.searchProductStock(business.id, product_name);

    // Handle not found / no platform
    if (!result.success) {
      if (result.code === 'NO_PLATFORM') {
        return {
          success: false,
          validation: {
            status: "configuration_error",
            issue: "no_ecommerce_platform_connected"
          },
          context: { language: business.language }
        };
      }

      return {
        success: false,
        validation: {
          status: "not_found",
          searchCriteria: { product_name },
          attemptedPlatforms: ["webhook", "crm", "ecommerce"]
        },
        context: { language: business.language }
      };
    }

    const product = result.product;
    console.log(`✅ Product found from ${product.platform}: ${product.title}`);

    // Format response message using aggregator helper
    const responseMessage = ecommerceAggregator.formatProductStock(product, business.language);

    return {
      success: true,
      data: {
        title: product.title,
        available: product.available,
        stock: product.totalStock,
        variants: product.variants?.map(v => ({
          title: v.title,
          available: v.available,
          stock: v.stock
        })),
        platform: product.platform
      },
      message: responseMessage
    };

  } catch (error) {
    console.error('❌ Get product stock error:', error);

    return {
      success: false,
      validation: {
        status: "system_error",
        issue: "stock_query_failed",
        errorMessage: error.message
      },
      context: { language: business.language }
    };
  }
}

export default { execute };
