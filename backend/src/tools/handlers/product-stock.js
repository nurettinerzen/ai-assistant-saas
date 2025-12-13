/**
 * Product Stock Handler
 * Checks product availability via E-commerce Aggregator (Shopify, WooCommerce)
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';

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
        error: business.language === 'TR'
          ? 'Ürün adı gerekli.'
          : 'Product name required.'
      };
    }

    // Use aggregator to search product
    const result = await ecommerceAggregator.searchProductStock(business.id, product_name);

    // Handle not found / no platform
    if (!result.success) {
      if (result.code === 'NO_PLATFORM') {
        return {
          success: false,
          error: business.language === 'TR'
            ? 'E-ticaret platformu bağlı değil.'
            : 'No e-commerce platform connected.'
        };
      }

      return {
        success: false,
        error: result.error || (business.language === 'TR'
          ? `"${product_name}" adlı ürün bulunamadı.`
          : `Product "${product_name}" not found.`)
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
      error: business.language === 'TR'
        ? 'Stok sorgulanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        : 'An error occurred while checking stock. Please try again later.'
    };
  }
}

export default { execute };
