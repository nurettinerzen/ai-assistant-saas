/**
 * Product Stock Handler
 * Checks product availability via E-commerce Aggregator (Shopify, WooCommerce)
 * PRIORITY: WebhookInventory > CrmStock > E-commerce platforms
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';
import prisma from '../../prismaClient.js';
import { ok, notFound, validationError, systemError } from '../toolResult.js';

/**
 * Execute product stock check
 */
export async function execute(args, business, context = {}) {
  try {
    const { product_name } = args;
    const language = business.language || 'TR';

    console.log('🔍 Checking product stock:', { product_name });

    // Validate input
    if (!product_name) {
      return validationError(
        language === 'TR'
          ? 'Ürün adı gerekli.'
          : 'Product name is required.',
        'product_name'
      );
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
      const responseMessage = language === 'TR'
        ? `"${webhookStock.productName}" ${inStock ? `stoğumuzda mevcut (${webhookStock.stock} adet)` : 'şu anda stokta yok'}.`
        : `"${webhookStock.productName}" is ${inStock ? `in stock (${webhookStock.stock} units)` : 'currently out of stock'}.`;

      return ok({
        title: webhookStock.productName,
        sku: webhookStock.sku,
        available: inStock,
        stock: webhookStock.stock,
        platform: 'webhook'
      }, responseMessage);
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
      const responseMessage = language === 'TR'
        ? `"${crmStock.productName}" ${inStock ? (crmStock.quantity ? `stoğumuzda mevcut (${crmStock.quantity} adet)` : 'stoğumuzda mevcut') : 'şu anda stokta yok'}.${crmStock.price ? ` Fiyat: ${crmStock.price} TL` : ''}${crmStock.estimatedRestock && !inStock ? ` Tahmini stok girişi: ${crmStock.estimatedRestock.toLocaleDateString('tr-TR')}` : ''}`
        : `"${crmStock.productName}" is ${inStock ? (crmStock.quantity ? `in stock (${crmStock.quantity} units)` : 'in stock') : 'currently out of stock'}.${crmStock.price ? ` Price: ${crmStock.price} TRY` : ''}${crmStock.estimatedRestock && !inStock ? ` Estimated restock: ${crmStock.estimatedRestock.toLocaleDateString('en-US')}` : ''}`;

      return ok({
        title: crmStock.productName,
        sku: crmStock.sku,
        available: inStock,
        stock: crmStock.quantity,
        price: crmStock.price,
        platform: 'crm'
      }, responseMessage);
    }

    console.log('⚠️ Not found in integrations, checking e-commerce platforms...');

    // ============================================================================
    // PRIORITY 3: Check E-commerce platforms (Shopify, İkas, etc.)
    // ============================================================================
    const result = await ecommerceAggregator.searchProductStock(business.id, product_name);

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
          ? `"${product_name}" için stok bilgisi bulunamadı.`
          : `Stock information not found for "${product_name}".`
      );
    }

    const product = result.product;
    console.log(`✅ Product found from ${product.platform}: ${product.title}`);

    // Format response message using aggregator helper
    const responseMessage = ecommerceAggregator.formatProductStock(product, language);

    return ok({
      title: product.title,
      available: product.available,
      stock: product.totalStock,
      variants: product.variants?.map(v => ({
        title: v.title,
        available: v.available,
        stock: v.stock
      })),
      platform: product.platform
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

export default { execute };
